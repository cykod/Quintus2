import { Vec2 } from "@quintus/math";
import { CELL_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y } from "./config.js";

export interface PathDef {
	/** Waypoints in grid coordinates (col, row). */
	waypoints: Vec2[];
	/** Tile frame indices for drawing path segments. */
	tiles: Array<{ col: number; row: number; frame: number }>;
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

// Path tile frame indices (0-based)
const H = 16; // horizontal
const V = 17; // vertical
const CTL = 18; // corner top-left
const CTR = 19; // corner top-right
const CBL = 20; // corner bottom-left
const CBR = 21; // corner bottom-right
const ET = 43; // end-cap top
const EB = 44; // end-cap bottom
const EL = 45; // end-cap left

/**
 * Level 1: Simple S-curve from top-left to bottom-right.
 *
 * Path shape (grid coords):
 *   (0,0) → (4,0) → (4,2) → (1,2) → (1,5) → (5,5) → (5,7)
 */
export const LEVEL1_PATH: PathDef = {
	waypoints: [
		new Vec2(0, 0),
		new Vec2(4, 0),
		new Vec2(4, 2),
		new Vec2(1, 2),
		new Vec2(1, 5),
		new Vec2(5, 5),
		new Vec2(5, 7),
	],
	tiles: [
		// Entry → right along row 0
		{ col: 0, row: 0, frame: EL }, // entry point
		{ col: 1, row: 0, frame: H },
		{ col: 2, row: 0, frame: H },
		{ col: 3, row: 0, frame: H },
		{ col: 4, row: 0, frame: CTL }, // turn down
		// Down column 4
		{ col: 4, row: 1, frame: V },
		{ col: 4, row: 2, frame: CBR }, // turn left
		// Left along row 2
		{ col: 3, row: 2, frame: H },
		{ col: 2, row: 2, frame: H },
		{ col: 1, row: 2, frame: CTR }, // turn down
		// Down column 1
		{ col: 1, row: 3, frame: V },
		{ col: 1, row: 4, frame: V },
		{ col: 1, row: 5, frame: CBL }, // turn right
		// Right along row 5
		{ col: 2, row: 5, frame: H },
		{ col: 3, row: 5, frame: H },
		{ col: 4, row: 5, frame: H },
		{ col: 5, row: 5, frame: CTL }, // turn down
		// Down column 5
		{ col: 5, row: 6, frame: V },
		{ col: 5, row: 7, frame: EB }, // exit
	],
};

/**
 * Level 2: Longer winding path with more turns.
 *
 * Path shape:
 *   (3,0) → (3,1) → (0,1) → (0,3) → (5,3) → (5,5) → (2,5) → (2,7)
 */
export const LEVEL2_PATH: PathDef = {
	waypoints: [
		new Vec2(3, 0),
		new Vec2(3, 1),
		new Vec2(0, 1),
		new Vec2(0, 3),
		new Vec2(5, 3),
		new Vec2(5, 5),
		new Vec2(2, 5),
		new Vec2(2, 7),
	],
	tiles: [
		// Entry column 3 down
		{ col: 3, row: 0, frame: ET },
		{ col: 3, row: 1, frame: CBR }, // turn left
		// Left along row 1
		{ col: 2, row: 1, frame: H },
		{ col: 1, row: 1, frame: H },
		{ col: 0, row: 1, frame: CTR }, // turn down
		// Down column 0
		{ col: 0, row: 2, frame: V },
		{ col: 0, row: 3, frame: CBL }, // turn right
		// Right along row 3
		{ col: 1, row: 3, frame: H },
		{ col: 2, row: 3, frame: H },
		{ col: 3, row: 3, frame: H },
		{ col: 4, row: 3, frame: H },
		{ col: 5, row: 3, frame: CTL }, // turn down
		// Down column 5
		{ col: 5, row: 4, frame: V },
		{ col: 5, row: 5, frame: CBR }, // turn left
		// Left along row 5
		{ col: 4, row: 5, frame: H },
		{ col: 3, row: 5, frame: H },
		{ col: 2, row: 5, frame: CTR }, // turn down
		// Down column 2
		{ col: 2, row: 6, frame: V },
		{ col: 2, row: 7, frame: EB }, // exit
	],
};

/** Get the set of occupied grid cells for a path (for placement validation). */
export function getPathCells(path: PathDef): Set<string> {
	const cells = new Set<string>();
	for (const tile of path.tiles) {
		cells.add(`${tile.col},${tile.row}`);
	}
	return cells;
}
