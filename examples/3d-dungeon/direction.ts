/**
 * Cardinal direction utilities for grid-based movement.
 * Shared across all dungeon entities.
 */

/** Cardinal direction enum: index values match DIR arrays. */
export enum CardinalDirection {
	North = 0,
	East = 1,
	South = 2,
	West = 3,
}

/**
 * Direction lookup tables and utility functions.
 *
 * Three.js convention: default forward is -Z, so rotation.y = 0 faces North (-Z).
 * Turn right increments index, turn left decrements.
 */
export const Direction = {
	/** Grid X delta per direction: North=0, East=+1, South=0, West=-1 */
	dx: [0, 1, 0, -1] as readonly number[],

	/** Grid Z delta per direction: North=-1, East=0, South=+1, West=0 */
	dz: [-1, 0, 1, 0] as readonly number[],

	/** Rotation.y angle per direction. East is -PI/2 (Three.js convention). */
	angle: [0, -Math.PI / 2, Math.PI, Math.PI / 2] as readonly number[],

	/** Convert a grid delta (dx, dz) to a direction index, or -1 if not cardinal. */
	fromDelta(dx: number, dz: number): CardinalDirection | -1 {
		for (let i = 0; i < 4; i++) {
			if (Direction.dx[i] === dx && Direction.dz[i] === dz) {
				return i as CardinalDirection;
			}
		}
		return -1;
	},

	/** Rotate a direction by a number of 90° steps (positive = clockwise). */
	rotate(dir: CardinalDirection, steps: number): CardinalDirection {
		return ((((dir + steps) % 4) + 4) % 4) as CardinalDirection;
	},

	/** Get the opposite direction. */
	opposite(dir: CardinalDirection): CardinalDirection {
		return ((dir + 2) % 4) as CardinalDirection;
	},

	/** Get the rotation.y angle for a direction. */
	toAngle(dir: CardinalDirection): number {
		return Direction.angle[dir];
	},
} as const;
