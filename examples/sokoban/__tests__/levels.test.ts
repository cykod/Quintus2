import { describe, expect, it } from "vitest";
import { SokobanGrid } from "../grid.js";
import { LEVELS } from "../levels.js";

describe("Sokoban — Level Definitions", () => {
	it("all levels parse without errors", () => {
		for (const [i, level] of LEVELS.entries()) {
			expect(() => SokobanGrid.parse(level), `Level ${i + 1}`).not.toThrow();
		}
	});

	it("all levels have a player start", () => {
		for (const [i, level] of LEVELS.entries()) {
			const grid = SokobanGrid.parse(level);
			expect(grid.player, `Level ${i + 1} player`).toBeDefined();
		}
	});

	it("crate count equals target count in every level", () => {
		for (const [i, level] of LEVELS.entries()) {
			const grid = SokobanGrid.parse(level);
			expect(
				grid.crates.length,
				`Level ${i + 1}: ${grid.crates.length} crates vs ${grid.targets.length} targets`,
			).toBe(grid.targets.length);
		}
	});

	it("no level starts already solved", () => {
		for (const [i, level] of LEVELS.entries()) {
			const grid = SokobanGrid.parse(level);
			expect(grid.isSolved(), `Level ${i + 1} should not start solved`).toBe(false);
		}
	});

	it("has at least 5 levels", () => {
		expect(LEVELS.length).toBeGreaterThanOrEqual(5);
	});
});
