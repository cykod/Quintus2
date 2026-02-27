/** Direction vector for grid movement. */
export interface Dir {
	dx: number;
	dy: number;
}

export const DIR_UP: Dir = { dx: 0, dy: -1 };
export const DIR_DOWN: Dir = { dx: 0, dy: 1 };
export const DIR_LEFT: Dir = { dx: -1, dy: 0 };
export const DIR_RIGHT: Dir = { dx: 1, dy: 0 };

/** Position on the grid. */
export interface Pos {
	x: number;
	y: number;
}

/**
 * Records a single move for the undo stack. Each record stores the player's
 * previous position and, if a crate was pushed, the crate's array index and
 * its previous position. `crateIndex: -1` means no crate was involved.
 * This enables O(1) undo: simply restore the saved positions and pop the stack.
 */
interface MoveRecord {
	playerFrom: Pos;
	crateIndex: number; // -1 if no crate was pushed
	crateFrom: Pos | null;
}

/**
 * Sokoban standard format:
 * # = wall, . = target, $ = crate, @ = player
 * + = player on target, * = crate on target, space = floor, - = floor (alt)
 */
const WALL = "#";
const TARGET = ".";
const CRATE = "$";
const PLAYER = "@";
const PLAYER_ON_TARGET = "+";
const CRATE_ON_TARGET = "*";

/**
 * Pure grid-based Sokoban logic with zero engine dependency.
 *
 * Keeping the rules layer separate from rendering means:
 * 1. Grid logic can be unit-tested directly without bootstrapping a Game/Scene.
 * 2. The game logic is portable — it could drive a terminal UI or a server.
 * 3. The scene layer (SokobanLevel) only handles visuals and input mapping.
 *
 * All positions are {x, y} where x = column, y = row.
 */
export class SokobanGrid {
	readonly width: number;
	readonly height: number;
	/** True where walls exist. */
	private readonly _walls: boolean[][];
	/** Target positions. */
	readonly targets: Pos[];
	/** Current crate positions (mutable). */
	readonly crates: Pos[];
	/** Current player position (mutable). */
	player: Pos;
	/** Number of moves taken. */
	moveCount = 0;
	/** Undo history stack. */
	private readonly _history: MoveRecord[] = [];

	/** Initial state for reset. */
	private readonly _initialPlayer: Pos;
	private readonly _initialCrates: Pos[];

	constructor(
		width: number,
		height: number,
		walls: boolean[][],
		targets: Pos[],
		crates: Pos[],
		player: Pos,
	) {
		this.width = width;
		this.height = height;
		this._walls = walls;
		this.targets = targets;
		this.crates = crates;
		this.player = player;
		this._initialPlayer = { ...player };
		this._initialCrates = crates.map((c) => ({ ...c }));
	}

	/**
	 * Parse a level string into a SokobanGrid.
	 * Lines are separated by \n. Trailing whitespace is trimmed per line.
	 */
	static parse(levelStr: string): SokobanGrid {
		const lines = levelStr.split("\n").filter((line) => line.length > 0);
		const height = lines.length;
		const width = Math.max(...lines.map((l) => l.length));

		const walls: boolean[][] = [];
		const targets: Pos[] = [];
		const crates: Pos[] = [];
		let player: Pos | null = null;

		for (let y = 0; y < height; y++) {
			const row: boolean[] = [];
			walls[y] = row;
			const line = lines[y] ?? "";
			for (let x = 0; x < width; x++) {
				const ch = x < line.length ? (line[x] ?? " ") : " ";
				row[x] = false;

				switch (ch) {
					case WALL:
						row[x] = true;
						break;
					case TARGET:
						targets.push({ x, y });
						break;
					case CRATE:
						crates.push({ x, y });
						break;
					case PLAYER:
						player = { x, y };
						break;
					case PLAYER_ON_TARGET:
						player = { x, y };
						targets.push({ x, y });
						break;
					case CRATE_ON_TARGET:
						crates.push({ x, y });
						targets.push({ x, y });
						break;
					// space or '-' = empty floor
				}
			}
		}

		if (!player) {
			throw new Error("Level has no player start position (@)");
		}

		return new SokobanGrid(width, height, walls, targets, crates, player);
	}

	/** Check if a position is a wall. */
	isWall(pos: Pos): boolean {
		if (pos.x < 0 || pos.x >= this.width || pos.y < 0 || pos.y >= this.height) {
			return true; // out of bounds = wall
		}
		return this._walls[pos.y]?.[pos.x] ?? true;
	}

	/** Find the crate index at a position, or -1. */
	crateAt(pos: Pos): number {
		return this.crates.findIndex((c) => c.x === pos.x && c.y === pos.y);
	}

	/** Check if a target exists at a position. */
	isTarget(pos: Pos): boolean {
		return this.targets.some((t) => t.x === pos.x && t.y === pos.y);
	}

	/**
	 * Attempt to move the player in the given direction.
	 *
	 * Returns `{ moved, pushedCrate }` as a single struct rather than separate
	 * methods because the caller (SokobanLevel) needs both pieces atomically —
	 * it must know whether to animate and, if so, which crate sprite to tween.
	 * `pushedCrate` is the crate array index, or -1 if no crate was pushed.
	 */
	tryMove(dir: Dir): { moved: boolean; pushedCrate: number } {
		const newX = this.player.x + dir.dx;
		const newY = this.player.y + dir.dy;
		const dest: Pos = { x: newX, y: newY };

		// Blocked by wall
		if (this.isWall(dest)) {
			return { moved: false, pushedCrate: -1 };
		}

		const crateIdx = this.crateAt(dest);
		if (crateIdx >= 0) {
			// There's a crate — check if we can push it
			const crateDest: Pos = { x: newX + dir.dx, y: newY + dir.dy };
			if (this.isWall(crateDest) || this.crateAt(crateDest) >= 0) {
				// Can't push: wall or another crate behind
				return { moved: false, pushedCrate: -1 };
			}

			// Push the crate
			const record: MoveRecord = {
				playerFrom: { ...this.player },
				crateIndex: crateIdx,
				crateFrom: { ...this.crates[crateIdx] } as Pos,
			};
			this._history.push(record);

			this.crates[crateIdx] = crateDest;
			this.player = dest;
			this.moveCount++;
			return { moved: true, pushedCrate: crateIdx };
		}

		// Empty cell — just move
		const record: MoveRecord = {
			playerFrom: { ...this.player },
			crateIndex: -1,
			crateFrom: null,
		};
		this._history.push(record);

		this.player = dest;
		this.moveCount++;
		return { moved: true, pushedCrate: -1 };
	}

	/** Undo the last move. Returns true if there was a move to undo. */
	undo(): boolean {
		const record = this._history.pop();
		if (!record) return false;

		this.player = record.playerFrom;
		if (record.crateIndex >= 0 && record.crateFrom) {
			this.crates[record.crateIndex] = record.crateFrom;
		}
		this.moveCount--;
		return true;
	}

	/** Check if all targets are covered by crates. */
	isSolved(): boolean {
		return this.targets.every((t) => this.crateAt(t) >= 0);
	}

	/** Reset to initial state. */
	reset(): void {
		this.player = { ...this._initialPlayer };
		for (let i = 0; i < this._initialCrates.length; i++) {
			this.crates[i] = { ...(this._initialCrates[i] as Pos) };
		}
		this.moveCount = 0;
		this._history.length = 0;
	}

	/** Number of undoable moves in history. */
	get historyLength(): number {
		return this._history.length;
	}
}
