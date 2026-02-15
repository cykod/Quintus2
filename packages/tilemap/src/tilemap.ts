import { type DrawContext, type Node, Node2D, type NodeConstructor } from "@quintus/core";
import { Rect, Vec2 } from "@quintus/math";
import type { PhysicsFactories } from "./tile-collision.js";
import { buildSolidGrid, createColliders, getSolidTileIds, mergeRects } from "./tile-collision.js";
import type { ParsedMap, ParsedObject, ParsedTileLayer } from "./tiled-parser.js";
import { parseTiledMap } from "./tiled-parser.js";
import type { TiledMap, TiledTileset } from "./tiled-types.js";

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
	private _collisionGenerated = false;

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

	// === Tile Collision ===

	/**
	 * Generate StaticCollider + CollisionShape children from solid tiles.
	 */
	generateCollision(options?: {
		layer?: string;
		allSolid?: boolean;
		collisionGroup?: string;
	}): number {
		if (!this._parsed) {
			throw new Error("TileMap: Map not loaded. Cannot generate collision.");
		}
		if (this._collisionGenerated) return 0;

		const game = this.game;
		if (!game || !game.hasPlugin("physics")) {
			throw new Error(
				"TileMap.generateCollision() requires PhysicsPlugin. Call game.use(PhysicsPlugin()) first.",
			);
		}

		const tileLayer = this._getTileLayer(options?.layer);
		if (!tileLayer) return 0;

		const allSolid = options?.allSolid ?? false;
		const collisionGroup = options?.collisionGroup ?? "default";

		// Build solid grid
		const solidTileIds = allSolid ? null : getSolidTileIds(this._parsed.tilesets);
		const solid = buildSolidGrid(tileLayer, solidTileIds);

		// Merge into rectangles
		const rects = mergeRects(solid, tileLayer.width, tileLayer.height);

		// Create colliders — pass physics factories to avoid hard dependency in tile-collision.ts
		const factories = this._getPhysicsFactories();
		const colliders = createColliders(
			rects,
			this._parsed.tileWidth,
			this._parsed.tileHeight,
			collisionGroup,
			this,
			factories,
		);

		this._collisionGenerated = true;
		return colliders.length;
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
		if (!game) {
			throw new Error("TileMap: Cannot load map — node is not in a scene tree.");
		}

		const json = game.assets.getJSON<TiledMap>(this.asset);
		if (!json) {
			throw new Error(
				`TileMap: Asset '${this.asset}' not found. Load it via game.assets.load({ json: ['${this.asset}.json'] }) before starting the scene.`,
			);
		}

		this._parsed = parseTiledMap(json);
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
		let startCol = 0;
		let startRow = 0;
		let endCol = layer.width;
		let endRow = layer.height;

		if (game) {
			const scene = this.scene;
			const vt = scene?.viewTransform;
			if (
				vt &&
				!(vt.a === 1 && vt.b === 0 && vt.c === 0 && vt.d === 1 && vt.e === 0 && vt.f === 0)
			) {
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
