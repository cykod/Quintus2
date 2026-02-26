import type { Node2D } from "@quintus/core";
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
