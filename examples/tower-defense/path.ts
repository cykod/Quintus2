import { Vec2 } from "@quintus/math";
import type { TileMap } from "@quintus/tilemap";
import { CELL_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y } from "./config.js";

export interface PathDef {
	/** Waypoints in grid coordinates (col, row). */
	waypoints: Vec2[];
}

/** Convert grid coordinates to world-space center of that cell. */
export function gridToWorld(col: number, row: number): Vec2 {
	return new Vec2(
		GRID_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2,
		GRID_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2,
	);
}

/** Convert world-space position to grid coordinates (col, row). */
export function worldToGrid(x: number, y: number): { col: number; row: number } {
	return {
		col: Math.floor((x - GRID_OFFSET_X) / CELL_SIZE),
		row: Math.floor((y - GRID_OFFSET_Y) / CELL_SIZE),
	};
}

// === TMX path layer tile IDs (0-based local) ===
/** Road tile — enemies walk here. */
const ROAD_TILE = 15;
/** Placement tile — towers can be built here. */
const PLACEMENT_TILE = 16;
/** Start tile — enemy spawn point. */
const START_TILE = 18;
/** End tile — enemy exit point. */
const END_TILE = 17;

/**
 * Data extracted from a TMX path layer.
 */
export interface MapPathData {
	/** Waypoints in grid coordinates, derived by tracing road tiles from start → end. */
	waypoints: Vec2[];
	/** Grid cells valid for tower placement. */
	placementCells: Set<string>;
}

/**
 * Read the "path" layer from a loaded TileMap and extract:
 * - enemy waypoints (traced from start tile through road tiles to end tile)
 * - valid tower placement cells
 *
 * Path layer tile convention:
 *   tile 18 (TMX GID 19) = start
 *   tile 17 (TMX GID 18) = end
 *   tile 15 (TMX GID 16) = road
 *   tile 16 (TMX GID 17) = placement
 */
export function readPathFromMap(map: TileMap): MapPathData {
	let start: { col: number; row: number } | null = null;
	let end: { col: number; row: number } | null = null;
	const roadCells = new Set<string>();
	const placementCells = new Set<string>();

	// Scan the path layer
	for (let row = 0; row < map.mapHeight; row++) {
		for (let col = 0; col < map.mapWidth; col++) {
			const tile = map.getTileAt(col, row, "path");
			const key = `${col},${row}`;
			if (tile === ROAD_TILE) {
				roadCells.add(key);
			} else if (tile === PLACEMENT_TILE) {
				placementCells.add(key);
			} else if (tile === START_TILE) {
				start = { col, row };
			} else if (tile === END_TILE) {
				end = { col, row };
			}
		}
	}

	if (!start) throw new Error("TMX path layer missing start tile (tile 18 / GID 19)");
	if (!end) throw new Error("TMX path layer missing end tile (tile 17 / GID 18)");

	// Trace path from start to end through road tiles
	const path: Array<{ col: number; row: number }> = [start];
	const visited = new Set<string>();
	visited.add(`${start.col},${start.row}`);

	let current = start;
	while (current.col !== end.col || current.row !== end.row) {
		const neighbors = [
			{ col: current.col + 1, row: current.row },
			{ col: current.col - 1, row: current.row },
			{ col: current.col, row: current.row + 1 },
			{ col: current.col, row: current.row - 1 },
		];

		let found = false;
		for (const n of neighbors) {
			const key = `${n.col},${n.row}`;
			if (visited.has(key)) continue;
			if (roadCells.has(key) || (n.col === end.col && n.row === end.row)) {
				visited.add(key);
				path.push(n);
				current = n;
				found = true;
				break;
			}
		}
		if (!found) break;
	}

	// Extract waypoints at direction changes
	const waypoints: Vec2[] = [new Vec2(path[0]!.col, path[0]!.row)];
	for (let i = 1; i < path.length - 1; i++) {
		const prev = path[i - 1]!;
		const curr = path[i]!;
		const next = path[i + 1]!;
		const dx1 = curr.col - prev.col;
		const dy1 = curr.row - prev.row;
		const dx2 = next.col - curr.col;
		const dy2 = next.row - curr.row;
		if (dx1 !== dx2 || dy1 !== dy2) {
			waypoints.push(new Vec2(curr.col, curr.row));
		}
	}
	if (path.length > 1) {
		const last = path[path.length - 1]!;
		waypoints.push(new Vec2(last.col, last.row));
	}

	return { waypoints, placementCells };
}
