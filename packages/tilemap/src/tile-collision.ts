import type { Node2D } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { ParsedTileLayer } from "./tiled-parser.js";
import type { TiledTileset } from "./tiled-types.js";

/** A merged rectangle of solid tiles. */
export interface MergedRect {
	/** Top-left column. */
	col: number;
	/** Top-left row. */
	row: number;
	/** Width in tiles. */
	spanW: number;
	/** Height in tiles. */
	spanH: number;
}

/** Physics constructors passed to createColliders to avoid hard dependency. */
export interface PhysicsFactories {
	StaticCollider: new () => Node2D & { collisionGroup: string; oneWay: boolean };
	CollisionShape: new () => Node2D & { shape: unknown };
	shapeRect: (w: number, h: number) => unknown;
	shapePolygon?: (points: Vec2[]) => unknown;
}

/**
 * Run greedy rectangle merging on a solid tile grid.
 *
 * @param solid Row-major boolean array (true = solid).
 * @param width Grid width in tiles.
 * @param height Grid height in tiles.
 * @returns Array of merged rectangles.
 */
export function mergeRects(solid: boolean[], width: number, height: number): MergedRect[] {
	const rects: MergedRect[] = [];
	const visited = new Uint8Array(width * height);

	for (let row = 0; row < height; row++) {
		for (let col = 0; col < width; col++) {
			const idx = row * width + col;
			if (!solid[idx] || visited[idx]) continue;

			// Extend right
			let maxW = 0;
			while (
				col + maxW < width &&
				solid[row * width + col + maxW] &&
				!visited[row * width + col + maxW]
			) {
				maxW++;
			}

			// Extend down
			let maxH = 1;
			outer: while (row + maxH < height) {
				for (let c = col; c < col + maxW; c++) {
					const i = (row + maxH) * width + c;
					if (!solid[i] || visited[i]) break outer;
				}
				maxH++;
			}

			// Mark visited
			for (let r = row; r < row + maxH; r++) {
				for (let c = col; c < col + maxW; c++) {
					visited[r * width + c] = 1;
				}
			}

			rects.push({ col, row, spanW: maxW, spanH: maxH });
		}
	}

	return rects;
}

/**
 * Build a solid-tile grid from a parsed tile layer.
 *
 * @param layer Parsed tile layer.
 * @param solidTileIds Set of local tile IDs that are solid.
 *        If null, all non-empty tiles are treated as solid.
 * @param excludeTileIds Optional set of local tile IDs to exclude from solid.
 *        Useful for carving out one-way tiles from an allSolid layer.
 * @returns Row-major boolean array.
 */
export function buildSolidGrid(
	layer: ParsedTileLayer,
	solidTileIds: Set<number> | null,
	excludeTileIds?: Set<number>,
): boolean[] {
	const solid = new Array<boolean>(layer.tiles.length);
	for (let i = 0; i < layer.tiles.length; i++) {
		const tile = layer.tiles[i];
		if (!tile) {
			solid[i] = false;
		} else if (excludeTileIds?.has(tile.localId)) {
			solid[i] = false;
		} else if (solidTileIds === null) {
			// allSolid mode: all non-empty tiles are solid
			solid[i] = true;
		} else {
			solid[i] = solidTileIds.has(tile.localId);
		}
	}
	return solid;
}

/**
 * Get the set of local tile IDs marked as solid in tilesets.
 * A tile is solid if it has a property "solid" with value true.
 */
export function getSolidTileIds(tilesets: TiledTileset[]): Set<number> {
	const solidIds = new Set<number>();
	for (const ts of tilesets) {
		if (!ts.tiles) continue;
		for (const tileDef of ts.tiles) {
			if (!tileDef.properties) continue;
			for (const prop of tileDef.properties) {
				if (prop.name === "solid" && prop.value === true) {
					solidIds.add(tileDef.id);
				}
			}
		}
	}
	return solidIds;
}

/**
 * Create StaticCollider + CollisionShape nodes from merged rectangles.
 *
 * Each merged rectangle becomes one StaticCollider child of the parent,
 * with a single rect CollisionShape sized to cover the merged area.
 *
 * @param rects Merged rectangles from mergeRects().
 * @param tileWidth Tile width in pixels.
 * @param tileHeight Tile height in pixels.
 * @param collisionGroup Collision group name.
 * @param parent Node to add colliders to (the TileMap).
 * @param factories Physics constructors (injected to avoid hard dependency).
 * @returns Array of created collider nodes.
 */
export function createColliders(
	rects: MergedRect[],
	tileWidth: number,
	tileHeight: number,
	collisionGroup: string,
	parent: Node2D,
	factories: PhysicsFactories,
	oneWay?: boolean,
): Node2D[] {
	const colliders: Node2D[] = [];

	for (const rect of rects) {
		const pixelW = rect.spanW * tileWidth;
		const pixelH = rect.spanH * tileHeight;

		// Position at center of the merged rectangle
		const centerX = rect.col * tileWidth + pixelW / 2;
		const centerY = rect.row * tileHeight + pixelH / 2;

		const collider = new factories.StaticCollider();
		collider.name = `TileCollider_${rect.col}_${rect.row}`;
		collider.position.x = centerX;
		collider.position.y = centerY;
		collider.collisionGroup = collisionGroup;
		if (oneWay) collider.oneWay = true;

		const shape = new factories.CollisionShape();
		shape.shape = factories.shapeRect(pixelW, pixelH);
		collider.add(shape);

		parent.add(collider);
		colliders.push(collider);
	}

	return colliders;
}

/**
 * Ensure polygon vertices are wound clockwise.
 * Clockwise winding in screen coordinates means positive cross product sum.
 */
function ensureClockwise(points: Vec2[]): Vec2[] {
	// Compute signed area (positive = clockwise in screen coords where Y points down)
	let sum = 0;
	for (let i = 0; i < points.length; i++) {
		const a = points[i] as Vec2;
		const b = points[(i + 1) % points.length] as Vec2;
		sum += (b.x - a.x) * (b.y + a.y);
	}
	// If sum < 0, winding is counterclockwise — reverse
	if (sum < 0) {
		return [...points].reverse();
	}
	return points;
}

/**
 * Create individual StaticCollider + CollisionShape nodes from tiles that have
 * per-tile collision shapes defined in Tiled's collision editor (objectgroup).
 *
 * Supports polygon and rectangle shapes. Polygon vertices are offset relative
 * to tile center and corrected for flip flags and clockwise winding.
 *
 * @param layer Parsed tile layer.
 * @param tilesets The map's tilesets (contain tile definitions with objectgroups).
 * @param tileWidth Tile width in pixels.
 * @param tileHeight Tile height in pixels.
 * @param collisionGroup Collision group name.
 * @param parent Node to add colliders to (the TileMap).
 * @param factories Physics constructors.
 * @returns Set of local tile IDs that were handled (should be excluded from rect merging).
 */
export function createTileShapeColliders(
	layer: ParsedTileLayer,
	tilesets: TiledTileset[],
	tileWidth: number,
	tileHeight: number,
	collisionGroup: string,
	parent: Node2D,
	factories: PhysicsFactories,
): Set<number> {
	if (!factories.shapePolygon) return new Set();

	// Build a map of localId -> objectgroup from tileset definitions
	const tileObjectGroups = new Map<
		number,
		NonNullable<TiledTileset["tiles"]>[number]["objectgroup"]
	>();
	for (const ts of tilesets) {
		if (!ts.tiles) continue;
		for (const tileDef of ts.tiles) {
			if (tileDef.objectgroup) {
				tileObjectGroups.set(tileDef.id, tileDef.objectgroup);
			}
		}
	}

	if (tileObjectGroups.size === 0) return new Set();

	const handledIds = new Set<number>();
	const halfW = tileWidth / 2;
	const halfH = tileHeight / 2;

	for (let row = 0; row < layer.height; row++) {
		for (let col = 0; col < layer.width; col++) {
			const tile = layer.tiles[row * layer.width + col];
			if (!tile) continue;

			const objGroup = tileObjectGroups.get(tile.localId);
			if (!objGroup) continue;

			handledIds.add(tile.localId);

			// Tile center in world space (relative to tilemap)
			const tileCenterX = col * tileWidth + halfW;
			const tileCenterY = row * tileHeight + halfH;

			for (const obj of objGroup.objects) {
				let shape: unknown;

				if (obj.polygon && obj.polygon.length >= 3) {
					// Polygon: vertices are relative to obj.x/obj.y within the tile
					let points = obj.polygon.map((p) => new Vec2(obj.x + p.x - halfW, obj.y + p.y - halfH));

					// Handle flip flags
					if (tile.flipH) {
						points = points.map((p) => new Vec2(-p.x, p.y));
					}
					if (tile.flipV) {
						points = points.map((p) => new Vec2(p.x, -p.y));
					}

					points = ensureClockwise(points);
					shape = factories.shapePolygon(points);
				} else if (obj.width > 0 && obj.height > 0) {
					// Rectangle collision shape
					// If the rect covers the entire tile, use shapeRect
					if (obj.x === 0 && obj.y === 0 && obj.width === tileWidth && obj.height === tileHeight) {
						shape = factories.shapeRect(tileWidth, tileHeight);
					} else {
						// Convert rect to polygon (relative to tile center)
						let points = [
							new Vec2(obj.x - halfW, obj.y - halfH),
							new Vec2(obj.x + obj.width - halfW, obj.y - halfH),
							new Vec2(obj.x + obj.width - halfW, obj.y + obj.height - halfH),
							new Vec2(obj.x - halfW, obj.y + obj.height - halfH),
						];

						if (tile.flipH) {
							points = points.map((p) => new Vec2(-p.x, p.y));
						}
						if (tile.flipV) {
							points = points.map((p) => new Vec2(p.x, -p.y));
						}

						points = ensureClockwise(points);
						shape = factories.shapePolygon(points);
					}
				} else {
					continue;
				}

				const collider = new factories.StaticCollider();
				collider.name = `TileShapeCollider_${col}_${row}`;
				collider.position.x = tileCenterX;
				collider.position.y = tileCenterY;
				collider.collisionGroup = collisionGroup;

				const collisionShape = new factories.CollisionShape();
				collisionShape.shape = shape;
				collider.add(collisionShape);

				parent.add(collider);
			}
		}
	}

	return handledIds;
}
