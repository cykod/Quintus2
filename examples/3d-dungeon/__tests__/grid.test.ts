import { describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("../../../packages/three/src/__test-utils__/three-mock.js"));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
	GLTFLoader: class {
		loadAsync() {
			return Promise.resolve({});
		}
	},
}));

import { LEVELS } from "../config.js";
import { DungeonGrid } from "../entities/dungeon-grid.js";

/** Subclass that skips _defineTiles (which needs game.assets). */
class TestGrid extends DungeonGrid {
	parseTestLevel(lines: string[]): void {
		// Replicate parseLevel logic without _defineTiles
		(this as unknown as { _charGrid: string[][] })._charGrid = lines.map((l) => l.split(""));
		// Skip parseGrid/rebuild — we only test char-grid methods
	}
}

function makeGrid(lines: string[]): TestGrid {
	const grid = new TestGrid();
	grid.parseTestLevel(lines);
	return grid;
}

const SIMPLE_LEVEL = ["####", "#P.#", "#CE#", "####"];

describe("DungeonGrid", () => {
	describe("charAt", () => {
		it("returns correct characters", () => {
			const grid = makeGrid(SIMPLE_LEVEL);
			expect(grid.charAt(0, 0)).toBe("#");
			expect(grid.charAt(1, 1)).toBe("P");
			expect(grid.charAt(2, 1)).toBe(".");
			expect(grid.charAt(1, 2)).toBe("C");
			expect(grid.charAt(2, 2)).toBe("E");
		});

		it("returns '#' for out-of-bounds", () => {
			const grid = makeGrid(SIMPLE_LEVEL);
			expect(grid.charAt(-1, 0)).toBe("#");
			expect(grid.charAt(0, -1)).toBe("#");
			expect(grid.charAt(10, 0)).toBe("#");
			expect(grid.charAt(0, 10)).toBe("#");
		});
	});

	describe("isWalkable", () => {
		it("returns true for floor, coin, trap, exit, player", () => {
			const grid = makeGrid(SIMPLE_LEVEL);
			// Need to set size for isInBounds
			grid.setSize(4, 4);
			expect(grid.isWalkable(2, 1)).toBe(true); // "."
			expect(grid.isWalkable(1, 1)).toBe(true); // "P"
			expect(grid.isWalkable(1, 2)).toBe(true); // "C"
			expect(grid.isWalkable(2, 2)).toBe(true); // "E"
		});

		it("returns false for walls", () => {
			const grid = makeGrid(SIMPLE_LEVEL);
			grid.setSize(4, 4);
			expect(grid.isWalkable(0, 0)).toBe(false);
			expect(grid.isWalkable(3, 3)).toBe(false);
		});

		it("returns false for out-of-bounds", () => {
			const grid = makeGrid(SIMPLE_LEVEL);
			grid.setSize(4, 4);
			expect(grid.isWalkable(-1, 0)).toBe(false);
			expect(grid.isWalkable(4, 0)).toBe(false);
		});
	});

	describe("findChar", () => {
		it("finds first occurrence of a character", () => {
			const grid = makeGrid(SIMPLE_LEVEL);
			const pos = grid.findChar("P");
			expect(pos).toEqual({ gridX: 1, gridZ: 1 });
		});

		it("returns null for missing character", () => {
			const grid = makeGrid(SIMPLE_LEVEL);
			expect(grid.findChar("T")).toBeNull();
		});
	});

	describe("findAllChars", () => {
		it("finds all occurrences", () => {
			const grid = makeGrid(["####", "#C.#", "#.C#", "####"]);
			const coins = grid.findAllChars("C");
			expect(coins).toHaveLength(2);
			expect(coins).toContainEqual({ gridX: 1, gridZ: 1 });
			expect(coins).toContainEqual({ gridX: 2, gridZ: 2 });
		});

		it("returns empty array for missing character", () => {
			const grid = makeGrid(SIMPLE_LEVEL);
			expect(grid.findAllChars("T")).toEqual([]);
		});
	});

	describe("clearCell", () => {
		it("changes character to '.'", () => {
			const grid = makeGrid(SIMPLE_LEVEL);
			expect(grid.charAt(1, 2)).toBe("C");
			grid.clearCell(1, 2);
			expect(grid.charAt(1, 2)).toBe(".");
		});

		it("ignores out-of-bounds", () => {
			const grid = makeGrid(SIMPLE_LEVEL);
			grid.clearCell(-1, 0); // Should not throw
			grid.clearCell(100, 100);
		});
	});

	describe("level data integrity", () => {
		it("Level 1 has player and exit", () => {
			const grid = makeGrid(LEVELS[0] as string[]);
			expect(grid.findChar("P")).not.toBeNull();
			expect(grid.findChar("E")).not.toBeNull();
		});

		it("Level 2 has player, exit, coins, and traps", () => {
			const grid = makeGrid(LEVELS[1] as string[]);
			expect(grid.findChar("P")).not.toBeNull();
			expect(grid.findChar("E")).not.toBeNull();
			expect(grid.findAllChars("C").length).toBeGreaterThan(0);
			expect(grid.findAllChars("T").length).toBeGreaterThan(0);
		});

		it("Level 3 has player, exit, coins, and traps", () => {
			const grid = makeGrid(LEVELS[2] as string[]);
			expect(grid.findChar("P")).not.toBeNull();
			expect(grid.findChar("E")).not.toBeNull();
			expect(grid.findAllChars("C").length).toBeGreaterThan(0);
			expect(grid.findAllChars("T").length).toBeGreaterThan(0);
		});
	});
});
