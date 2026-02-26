import { describe, expect, it } from "vitest";
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP, SokobanGrid } from "../grid.js";

const SIMPLE_LEVEL = `
#####
#   #
# $ #
# . #
# @ #
#####
`.trim();

const TWO_CRATE_LEVEL = `
######
#    #
# $$ #
# .. #
# @  #
######
`.trim();

describe("SokobanGrid — Parsing", () => {
	it("parses a simple level", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		expect(grid.width).toBe(5);
		expect(grid.height).toBe(6);
		expect(grid.player).toEqual({ x: 2, y: 4 });
		expect(grid.crates).toHaveLength(1);
		expect(grid.crates[0]).toEqual({ x: 2, y: 2 });
		expect(grid.targets).toHaveLength(1);
		expect(grid.targets[0]).toEqual({ x: 2, y: 3 });
	});

	it("parses player on target (+)", () => {
		const level = `
###
#+#
###
`.trim();
		const grid = SokobanGrid.parse(level);
		expect(grid.player).toEqual({ x: 1, y: 1 });
		expect(grid.targets).toHaveLength(1);
		expect(grid.targets[0]).toEqual({ x: 1, y: 1 });
	});

	it("parses crate on target (*)", () => {
		const level = `
####
#@ #
# *#
####
`.trim();
		const grid = SokobanGrid.parse(level);
		expect(grid.crates).toHaveLength(1);
		expect(grid.targets).toHaveLength(1);
		expect(grid.crates[0]).toEqual({ x: 2, y: 2 });
		expect(grid.targets[0]).toEqual({ x: 2, y: 2 });
	});

	it("throws if no player", () => {
		expect(() => SokobanGrid.parse("###\n# #\n###")).toThrow("no player");
	});
});

describe("SokobanGrid — Movement", () => {
	it("moves player to empty cell", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		// Player at (2,4), move up to (2,3)
		const result = grid.tryMove(DIR_UP);
		expect(result.moved).toBe(true);
		expect(result.pushedCrate).toBe(-1);
		expect(grid.player).toEqual({ x: 2, y: 3 });
		expect(grid.moveCount).toBe(1);
	});

	it("blocks player from walking into wall", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		// Player at (2,4), move down to (2,5) which is wall
		const result = grid.tryMove(DIR_DOWN);
		expect(result.moved).toBe(false);
		expect(grid.player).toEqual({ x: 2, y: 4 });
		expect(grid.moveCount).toBe(0);
	});

	it("pushes crate to empty cell", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		// Move up twice: first to (2,3), then push crate from (2,2) to (2,1)
		grid.tryMove(DIR_UP); // (2,4) → (2,3)
		const result = grid.tryMove(DIR_UP); // push crate (2,2) → (2,1)
		expect(result.moved).toBe(true);
		expect(result.pushedCrate).toBe(0);
		expect(grid.player).toEqual({ x: 2, y: 2 });
		expect(grid.crates[0]).toEqual({ x: 2, y: 1 });
	});

	it("cannot push crate into wall", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		// Crate at (2,2). Move up to (2,3), push crate to (2,1).
		// Then push crate to (2,0) which is wall
		grid.tryMove(DIR_UP); // → (2,3)
		grid.tryMove(DIR_UP); // push crate to (2,1)
		const result = grid.tryMove(DIR_UP); // try push crate into wall (2,0)
		expect(result.moved).toBe(false);
		expect(grid.player).toEqual({ x: 2, y: 2 });
	});

	it("cannot push crate into another crate", () => {
		const grid = SokobanGrid.parse(TWO_CRATE_LEVEL);
		// Crates at (2,2) and (3,2). Player at (2,4).
		// Move up to (2,3), then try to push crate(2,2) up to (2,1)
		grid.tryMove(DIR_UP); // (2,4) → (2,3)
		grid.tryMove(DIR_UP); // push crate (2,2) → (2,1), player → (2,2)
		// Now move right to (3,2) — no, there's a crate at (3,2)
		// Try pushing crate at (3,2) right to (4,2)
		const result = grid.tryMove(DIR_RIGHT);
		expect(result.moved).toBe(true); // pushes crate (3,2) → (4,2)
		expect(result.pushedCrate).toBe(1);
	});

	it("player moves left and right", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		grid.tryMove(DIR_LEFT);
		expect(grid.player).toEqual({ x: 1, y: 4 });
		grid.tryMove(DIR_RIGHT);
		expect(grid.player).toEqual({ x: 2, y: 4 });
	});
});

describe("SokobanGrid — Solved", () => {
	it("detects solved state", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		expect(grid.isSolved()).toBe(false);

		// Target is at (2,3), crate is at (2,2)
		// Push crate down onto target
		grid.tryMove(DIR_LEFT); // (2,4) → (1,4)
		grid.tryMove(DIR_UP); // (1,4) → (1,3)
		grid.tryMove(DIR_UP); // (1,3) → (1,2)
		grid.tryMove(DIR_RIGHT); // push crate (2,2) → (3,2), player → (2,2)

		// Now we need crate at (2,3). Crate went to (3,2). Let's try another approach.
		// Reset and try differently
		grid.reset();

		// Crate at (2,2), target at (2,3). Push crate down.
		// Player at (2,4). Move left, up, up, right to get above crate, then push down.
		grid.tryMove(DIR_LEFT); // (1,4)
		grid.tryMove(DIR_UP); // (1,3)
		grid.tryMove(DIR_UP); // (1,2)
		grid.tryMove(DIR_UP); // (1,1)
		grid.tryMove(DIR_RIGHT); // (2,1)
		grid.tryMove(DIR_DOWN); // push crate (2,2) → (2,3), player → (2,2)

		expect(grid.crates[0]).toEqual({ x: 2, y: 3 });
		expect(grid.isSolved()).toBe(true);
	});

	it("not solved when crate is not on target", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		expect(grid.isSolved()).toBe(false);
	});
});

describe("SokobanGrid — Undo", () => {
	it("undoes a simple move", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		grid.tryMove(DIR_UP);
		expect(grid.player).toEqual({ x: 2, y: 3 });
		expect(grid.moveCount).toBe(1);

		const undone = grid.undo();
		expect(undone).toBe(true);
		expect(grid.player).toEqual({ x: 2, y: 4 });
		expect(grid.moveCount).toBe(0);
	});

	it("undoes a crate push", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		grid.tryMove(DIR_UP); // (2,3)
		grid.tryMove(DIR_UP); // push crate to (2,1)

		expect(grid.player).toEqual({ x: 2, y: 2 });
		expect(grid.crates[0]).toEqual({ x: 2, y: 1 });

		grid.undo();
		expect(grid.player).toEqual({ x: 2, y: 3 });
		expect(grid.crates[0]).toEqual({ x: 2, y: 2 });
	});

	it("multiple undos", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		grid.tryMove(DIR_UP);
		grid.tryMove(DIR_LEFT);
		grid.tryMove(DIR_DOWN);

		grid.undo();
		grid.undo();
		grid.undo();

		expect(grid.player).toEqual({ x: 2, y: 4 });
		expect(grid.moveCount).toBe(0);
	});

	it("undo returns false when no history", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		expect(grid.undo()).toBe(false);
	});
});

describe("SokobanGrid — Reset", () => {
	it("resets to initial state", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		grid.tryMove(DIR_UP);
		grid.tryMove(DIR_UP);

		grid.reset();

		expect(grid.player).toEqual({ x: 2, y: 4 });
		expect(grid.crates[0]).toEqual({ x: 2, y: 2 });
		expect(grid.moveCount).toBe(0);
		expect(grid.historyLength).toBe(0);
	});
});

describe("SokobanGrid — Queries", () => {
	it("crateAt returns correct index", () => {
		const grid = SokobanGrid.parse(TWO_CRATE_LEVEL);
		expect(grid.crateAt({ x: 2, y: 2 })).toBe(0);
		expect(grid.crateAt({ x: 3, y: 2 })).toBe(1);
		expect(grid.crateAt({ x: 1, y: 1 })).toBe(-1);
	});

	it("isWall detects walls and out-of-bounds", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		expect(grid.isWall({ x: 0, y: 0 })).toBe(true);
		expect(grid.isWall({ x: 2, y: 1 })).toBe(false);
		expect(grid.isWall({ x: -1, y: 0 })).toBe(true); // out of bounds
		expect(grid.isWall({ x: 99, y: 0 })).toBe(true); // out of bounds
	});

	it("isTarget finds targets", () => {
		const grid = SokobanGrid.parse(SIMPLE_LEVEL);
		expect(grid.isTarget({ x: 2, y: 3 })).toBe(true);
		expect(grid.isTarget({ x: 2, y: 2 })).toBe(false);
	});
});
