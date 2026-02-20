import { type DrawContext, type Node, Node2D, type NodeConstructor } from "@quintus/core";
import { Rect, Vec2 } from "@quintus/math";
import type { PhysicsFactories } from "./tile-collision.js";
import { buildSolidGrid, createColliders, getSolidTileIds, mergeRects } from "./tile-collision.js";
import type { ParsedMap, ParsedObject, ParsedTileLayer } from "./tiled-parser.js";
import { parseTiledMap } from "./tiled-parser.js";
import type { TiledMap, TiledTileset } from "./tiled-types.js";
import { parseTmx } from "./tmx-parser.js";

/** Result of a tilemap grid raycast. */
export interface TileRayHit {
	/** Tile column index. */
	col: number;
	/** Tile row index. */
	row: number;
	/** Tile ID at the hit location. */
	tileId: number;
	/** World-space point where the ray enters the tile. */
	point: Vec2;
	/** Normal of the tile face that was hit (axis-aligned: left/right/top/bottom). */
	normal: Vec2;
	/** Distance from ray origin to the hit point. */
	distance: number;
}

/** Module-level cache for physics factories (registered via TileMap.registerPhysics). */
let _cachedPhysicsFactories: PhysicsFactories | null = null;

export class TileMap extends Node2D {
	// === Map Data ===

	/** Asset key for the Tiled JSON file (loaded via game.assets). */
	private _asset = "";

	/** Override tileset image key. Default: uses the image path from the Tiled JSON. */
	tilesetImage: string | null = null;

	// === Internal State ===
	private _parsed: ParsedMap | null = null;
	private _collisionGeneratedLayers = new Set<string>();

	get asset(): string {
		return this._asset;
	}

	set asset(value: string) {
		this._asset = value;
		if (this.isInsideTree && value && !this._parsed) {
			this._loadMap();
		}
	}

	// === Lifecycle ===

	onReady(): void {
		if (this._asset && !this._parsed) {
			this._loadMap();
		}
	}

	// === Map Properties ===

	/** Map width in tiles. */
	get mapWidth(): number {
		return this._parsed?.width ?? 0;
	}

	/** Map height in tiles. */
	get mapHeight(): number {
		return this._parsed?.height ?? 0;
	}

	/** Tile width in pixels. */
	get tileWidth(): number {
		return this._parsed?.tileWidth ?? 0;
	}

	/** Tile height in pixels. */
	get tileHeight(): number {
		return this._parsed?.tileHeight ?? 0;
	}

	/** Total map bounds in pixels. */
	get bounds(): Rect {
		return this._parsed?.bounds ?? new Rect(0, 0, 0, 0);
	}

	/** Whether the map has been loaded and parsed. */
	get isLoaded(): boolean {
		return this._parsed !== null;
	}

	// === Tile Queries ===

	/**
	 * Get the tile ID at a grid position.
	 * @param col Column index (0-based).
	 * @param row Row index (0-based).
	 * @param layer Layer name. Default: first tile layer.
	 * @returns Tile ID (local, 0-based) or 0 if empty/out of bounds.
	 */
	getTileAt(col: number, row: number, layer?: string): number {
		const tileLayer = this._getTileLayer(layer);
		if (!tileLayer) return 0;
		if (col < 0 || col >= tileLayer.width || row < 0 || row >= tileLayer.height) return 0;
		const tile = tileLayer.tiles[row * tileLayer.width + col];
		return tile ? tile.localId : 0;
	}

	/**
	 * Set the tile ID at a grid position.
	 * @param col Column index.
	 * @param row Row index.
	 * @param tileId Local tile ID (0 = empty).
	 * @param layer Layer name. Default: first tile layer.
	 */
	setTileAt(col: number, row: number, tileId: number, layer?: string): void {
		const tileLayer = this._getTileLayer(layer);
		if (!tileLayer) return;
		if (col < 0 || col >= tileLayer.width || row < 0 || row >= tileLayer.height) return;
		const idx = row * tileLayer.width + col;
		if (tileId === 0) {
			tileLayer.tiles[idx] = null;
		} else {
			const tileset = this._parsed?.tilesets[0];
			if (tileset) {
				tileLayer.tiles[idx] = {
					localId: tileId,
					tileset,
					flipH: false,
					flipV: false,
					flipD: false,
				};
			}
		}
	}

	/**
	 * Convert a world position to tile grid coordinates.
	 * Accounts for the TileMap's position in the scene.
	 */
	worldToTile(worldPos: Vec2): Vec2 {
		if (!this._parsed) return new Vec2(0, 0);
		const local = this.toLocal(worldPos);
		return new Vec2(
			Math.floor(local.x / this._parsed.tileWidth),
			Math.floor(local.y / this._parsed.tileHeight),
		);
	}

	/**
	 * Convert tile grid coordinates to world position (top-left of tile).
	 */
	tileToWorld(col: number, row: number): Vec2 {
		if (!this._parsed) return new Vec2(0, 0);
		const localX = col * this._parsed.tileWidth;
		const localY = row * this._parsed.tileHeight;
		return this.toGlobal(new Vec2(localX, localY));
	}

	// === Object Layer Queries ===

	/**
	 * Get a named spawn point from any object layer.
	 * @returns World position of the spawn point.
	 * @throws If the spawn point is not found.
	 */
	getSpawnPoint(name: string): Vec2 {
		if (!this._parsed) {
			throw new Error(`TileMap: Map not loaded. Cannot find spawn point '${name}'.`);
		}
		for (const layer of this._parsed.objectLayers) {
			for (const obj of layer.objects) {
				if (obj.name === name) {
					return this.toGlobal(new Vec2(obj.x, obj.y));
				}
			}
		}
		throw new Error(`TileMap: Spawn point '${name}' not found in any object layer.`);
	}

	/**
	 * Get all objects from a named object layer.
	 */
	getObjects(layerName: string): ParsedObject[] {
		if (!this._parsed) return [];
		const layer = this._parsed.objectLayers.find((l) => l.name === layerName);
		return layer?.objects ?? [];
	}

	/**
	 * Spawn nodes from an object layer using a type -> constructor mapping.
	 */
	spawnObjects(layerName: string, mapping: Record<string, NodeConstructor>): Node[] {
		const objects = this.getObjects(layerName);
		const spawned: Node[] = [];

		for (const obj of objects) {
			const Ctor = mapping[obj.type];
			if (!Ctor) continue;

			const node = new Ctor();
			if (node instanceof Node2D) {
				node.position.x = obj.x;
				node.position.y = obj.y;
			}
			if (obj.name) {
				node.name = obj.name;
			}

			// Apply Tiled properties to node
			for (const [key, value] of obj.properties) {
				if (key in node) {
					// biome-ignore lint/suspicious/noExplicitAny: dynamic property assignment from Tiled
					(node as any)[key] = value;
				}
			}

			this.addChild(node);
			spawned.push(node);
		}

		return spawned;
	}

	/**
	 * Spawn nodes from a tile layer using a local tile ID -> constructor mapping.
	 * Each matching tile is replaced by a spawned node positioned at the tile center.
	 * Tiles are cleared after spawning so they don't render.
	 *
	 * @param layerName The tile layer to read from.
	 * @param mapping Map of local tile IDs (0-based) to Node constructors.
	 * @param options.clearTiles Remove matched tiles after spawning (default: true).
	 * @returns Array of spawned nodes.
	 */
	spawnFromTiles(
		layerName: string,
		mapping: Record<number, NodeConstructor>,
		options?: { clearTiles?: boolean },
	): Node[] {
		const layer = this._getTileLayer(layerName);
		if (!layer || !this._parsed) return [];

		const parsed = this._parsed;
		const spawned: Node[] = [];
		const clearTiles = options?.clearTiles ?? true;

		for (let row = 0; row < layer.height; row++) {
			for (let col = 0; col < layer.width; col++) {
				const idx = row * layer.width + col;
				const tile = layer.tiles[idx];
				if (!tile) continue;

				const Ctor = mapping[tile.localId];
				if (!Ctor) continue;

				const node = new Ctor();
				if (node instanceof Node2D) {
					node.position.x = col * parsed.tileWidth + parsed.tileWidth / 2;
					node.position.y = row * parsed.tileHeight + parsed.tileHeight / 2;
				}

				this.addChild(node);
				spawned.push(node);

				if (clearTiles) {
					layer.tiles[idx] = null;
				}
			}
		}

		return spawned;
	}

	// === Tile Collision ===

	/**
	 * Generate StaticCollider + CollisionShape children from solid tiles.
	 */
	generateCollision(options?: {
		layer?: string;
		allSolid?: boolean;
		collisionGroup?: string;
		oneWay?: boolean;
		/** Local tile IDs that should generate one-way (jump-through) colliders
		 *  instead of solid colliders. These tiles are excluded from the solid grid
		 *  and get their own one-way colliders. */
		oneWayTileIds?: number[];
	}): number {
		if (!this._parsed) {
			throw new Error("TileMap: Map not loaded. Cannot generate collision.");
		}

		const layerKey = options?.layer ?? "";
		if (this._collisionGeneratedLayers.has(layerKey)) return 0;

		if (!this.game.hasPlugin("physics")) {
			throw new Error(
				"TileMap.generateCollision() requires PhysicsPlugin. Call game.use(PhysicsPlugin()) first.",
			);
		}

		const tileLayer = this._getTileLayer(options?.layer);
		if (!tileLayer) return 0;

		const allSolid = options?.allSolid ?? false;
		const collisionGroup = options?.collisionGroup ?? "default";
		const factories = this._getPhysicsFactories();
		const oneWayTileIds = options?.oneWayTileIds;

		let totalColliders = 0;

		if (oneWayTileIds && oneWayTileIds.length > 0) {
			const oneWayIdSet = new Set(oneWayTileIds);

			// Build solid grid excluding one-way tiles
			const solidTileIds = allSolid ? null : getSolidTileIds(this._parsed.tilesets);
			const solidGrid = buildSolidGrid(tileLayer, solidTileIds, oneWayIdSet);
			const solidRects = mergeRects(solidGrid, tileLayer.width, tileLayer.height);
			totalColliders += createColliders(
				solidRects,
				this._parsed.tileWidth,
				this._parsed.tileHeight,
				collisionGroup,
				this,
				factories,
				false,
			).length;

			// Build one-way grid from only one-way tile IDs
			const oneWayGrid = buildSolidGrid(tileLayer, oneWayIdSet);
			const oneWayRects = mergeRects(oneWayGrid, tileLayer.width, tileLayer.height);
			totalColliders += createColliders(
				oneWayRects,
				this._parsed.tileWidth,
				this._parsed.tileHeight,
				collisionGroup,
				this,
				factories,
				true,
			).length;
		} else {
			// Original code path
			const solidTileIds = allSolid ? null : getSolidTileIds(this._parsed.tilesets);
			const solid = buildSolidGrid(tileLayer, solidTileIds);
			const rects = mergeRects(solid, tileLayer.width, tileLayer.height);
			totalColliders = createColliders(
				rects,
				this._parsed.tileWidth,
				this._parsed.tileHeight,
				collisionGroup,
				this,
				factories,
				options?.oneWay,
			).length;
		}

		this._collisionGeneratedLayers.add(layerKey);
		return totalColliders;
	}

	private _getPhysicsFactories(): PhysicsFactories {
		// Lazy import to avoid hard dependency on @quintus/physics
		// Physics must be installed as a peer dep for generateCollision to work
		if (!_cachedPhysicsFactories) {
			throw new Error(
				"TileMap.generateCollision() requires @quintus/physics. " +
					"Call TileMap.registerPhysics() or import '@quintus/tilemap/physics' first.",
			);
		}
		return _cachedPhysicsFactories;
	}

	/**
	 * Register physics constructors for tile collision generation.
	 * Called automatically when @quintus/physics is available.
	 */
	static registerPhysics(factories: PhysicsFactories): void {
		_cachedPhysicsFactories = factories;
	}

	// === Grid Raycast (DDA) ===

	/**
	 * Cast a ray through the tile grid using DDA traversal.
	 * Returns the first solid tile hit, or null.
	 *
	 * Only works when the TileMap has a pure translation transform (no rotation/scale).
	 */
	raycast(
		origin: Vec2,
		direction: Vec2,
		maxDistance = 10000,
		solidCheck?: (tileId: number, col: number, row: number) => boolean,
		layer?: string,
	): TileRayHit | null {
		if (!this._parsed) return null;

		const gt = this.globalTransform;
		if (!gt.isTranslationOnly()) {
			console.warn(
				"TileMap.raycast() only supports translation transforms. Rotation/scale detected.",
			);
			return null;
		}

		const tileLayer = this._getTileLayer(layer);
		if (!tileLayer) return null;

		const tw = this._parsed.tileWidth;
		const th = this._parsed.tileHeight;
		// Default: any non-empty tile is solid. Empty tiles have tileId = -1.
		const check = solidCheck ?? ((tileId: number) => tileId >= 0);

		// Normalize direction
		const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
		if (len < 1e-10) return null;
		const dirX = direction.x / len;
		const dirY = direction.y / len;

		// Convert origin to local space (just translation)
		const localX = origin.x - gt.e;
		const localY = origin.y - gt.f;

		// Starting tile coordinates
		let col = Math.floor(localX / tw);
		let row = Math.floor(localY / th);

		// Check if starting tile is solid
		if (col >= 0 && col < tileLayer.width && row >= 0 && row < tileLayer.height) {
			const startTileId = this._getTileId(tileLayer, col, row);
			if (check(startTileId, col, row)) {
				return {
					col,
					row,
					tileId: startTileId,
					point: new Vec2(origin.x, origin.y),
					normal: new Vec2(0, 0),
					distance: 0,
				};
			}
		}

		// DDA setup
		const stepX = dirX > 0 ? 1 : dirX < 0 ? -1 : 0;
		const stepY = dirY > 0 ? 1 : dirY < 0 ? -1 : 0;

		// tMax: parametric distance to next tile boundary on each axis
		let tMaxX: number;
		let tMaxY: number;
		// tDelta: parametric distance between tile boundaries
		let tDeltaX: number;
		let tDeltaY: number;

		if (stepX !== 0) {
			const nextBoundaryX = stepX > 0 ? (col + 1) * tw : col * tw;
			tMaxX = (nextBoundaryX - localX) / dirX;
			tDeltaX = (tw * stepX) / dirX;
		} else {
			tMaxX = Infinity;
			tDeltaX = Infinity;
		}

		if (stepY !== 0) {
			const nextBoundaryY = stepY > 0 ? (row + 1) * th : row * th;
			tMaxY = (nextBoundaryY - localY) / dirY;
			tDeltaY = (th * stepY) / dirY;
		} else {
			tMaxY = Infinity;
			tDeltaY = Infinity;
		}

		// Step through grid
		let distance = 0;
		while (distance < maxDistance) {
			let normalX: number;
			let normalY: number;

			if (tMaxX < tMaxY) {
				col += stepX;
				distance = tMaxX;
				tMaxX += tDeltaX;
				normalX = -stepX;
				normalY = 0;
			} else {
				row += stepY;
				distance = tMaxY;
				tMaxY += tDeltaY;
				normalX = 0;
				normalY = -stepY;
			}

			if (distance > maxDistance) break;

			// Check bounds
			if (col < 0 || col >= tileLayer.width || row < 0 || row >= tileLayer.height) {
				// Out of map — could continue if ray re-enters, but for simplicity stop
				if (stepX > 0 && col >= tileLayer.width) break;
				if (stepX < 0 && col < 0) break;
				if (stepY > 0 && row >= tileLayer.height) break;
				if (stepY < 0 && row < 0) break;
				continue;
			}

			const tileId = this._getTileId(tileLayer, col, row);
			if (check(tileId, col, row)) {
				const hitX = origin.x + dirX * distance;
				const hitY = origin.y + dirY * distance;
				return {
					col,
					row,
					tileId,
					point: new Vec2(hitX, hitY),
					normal: new Vec2(normalX, normalY),
					distance,
				};
			}
		}

		return null;
	}

	private _getTileId(layer: ParsedTileLayer, col: number, row: number): number {
		const tile = layer.tiles[row * layer.width + col];
		return tile ? tile.localId : -1;
	}

	// === Rendering ===

	onDraw(ctx: DrawContext): void {
		if (!this._parsed) return;

		for (const layer of this._parsed.tileLayers) {
			if (!layer.visible) continue;
			this._drawTileLayer(ctx, layer);
		}
	}

	// === Map Properties ===

	/**
	 * Get a map-level custom property.
	 */
	getProperty<T extends boolean | number | string>(name: string): T | undefined {
		return this._parsed?.properties.get(name) as T | undefined;
	}

	// === Internal ===

	private _loadMap(): void {
		const game = this.game;

		// Try JSON first (existing path)
		const json = game.assets.getJSON<TiledMap>(this.asset);
		if (json) {
			this._parsed = parseTiledMap(json);
			return;
		}

		// Try TMX text (loaded via custom "tmx" loader or stored as custom asset)
		const tmxText = game.assets.get<string>(this.asset);
		if (tmxText && typeof tmxText === "string") {
			const tiledMap = parseTmx(tmxText);
			this._parsed = parseTiledMap(tiledMap);
			return;
		}

		throw new Error(
			`TileMap: Asset '${this.asset}' not found. Load it via game.assets.load({ json: ['${this.asset}.json'] }) or game.assets.load({ tmx: ['${this.asset}.tmx'] }) before starting the scene.`,
		);
	}

	private _getTileLayer(name?: string): ParsedTileLayer | null {
		if (!this._parsed) return null;
		if (!name) return this._parsed.tileLayers[0] ?? null;
		return this._parsed.tileLayers.find((l) => l.name === name) ?? null;
	}

	private _drawTileLayer(ctx: DrawContext, layer: ParsedTileLayer): void {
		if (!this._parsed) return;
		const parsed = this._parsed;

		// Determine visible tile range from the scene's viewTransform
		const game = this.game;
		const vt = this.scene.viewTransform;
		let startCol = 0;
		let startRow = 0;
		let endCol = layer.width;
		let endRow = layer.height;

		if (!(vt.a === 1 && vt.b === 0 && vt.c === 0 && vt.d === 1 && vt.e === 0 && vt.f === 0)) {
			// Compute inverse view transform to get visible world rect
			const inv = vt.inverse();
			const topLeft = inv.transformPoint(new Vec2(0, 0));
			const bottomRight = inv.transformPoint(new Vec2(game.width, game.height));

			// Convert to tile coordinates with padding
			startCol = Math.max(0, Math.floor(topLeft.x / parsed.tileWidth) - 1);
			startRow = Math.max(0, Math.floor(topLeft.y / parsed.tileHeight) - 1);
			endCol = Math.min(layer.width, Math.ceil(bottomRight.x / parsed.tileWidth) + 1);
			endRow = Math.min(layer.height, Math.ceil(bottomRight.y / parsed.tileHeight) + 1);
		}

		// Draw visible tiles
		for (let row = startRow; row < endRow; row++) {
			for (let col = startCol; col < endCol; col++) {
				const tile = layer.tiles[row * layer.width + col];
				if (!tile) continue;

				const tileset = tile.tileset;
				const imageName = this._getTilesetImageName(tileset);
				const sourceRect = this._getTileSourceRect(tile.localId, tileset);
				const x = col * parsed.tileWidth + layer.offsetX;
				const y = row * parsed.tileHeight + layer.offsetY;

				if (layer.opacity < 1) {
					ctx.save();
					ctx.setAlpha(layer.opacity);
				}

				ctx.image(imageName, new Vec2(x, y), {
					sourceRect,
					flipH: tile.flipH,
					flipV: tile.flipV,
				});

				if (layer.opacity < 1) {
					ctx.restore();
				}
			}
		}
	}

	private _getTilesetImageName(tileset: TiledTileset): string {
		if (this.tilesetImage) return this.tilesetImage;
		// Strip path and extension: "../tilesets/tiles.png" -> "tiles"
		const path = tileset.image;
		const parts = path.split("/");
		const filename = parts[parts.length - 1] ?? path;
		const dotIdx = filename.lastIndexOf(".");
		return dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
	}

	private _getTileSourceRect(localId: number, tileset: TiledTileset): Rect {
		const spacing = tileset.spacing ?? 0;
		const margin = tileset.margin ?? 0;
		const col = localId % tileset.columns;
		const row = Math.floor(localId / tileset.columns);
		const x = margin + col * (tileset.tilewidth + spacing);
		const y = margin + row * (tileset.tileheight + spacing);
		return new Rect(x, y, tileset.tilewidth, tileset.tileheight);
	}
}
