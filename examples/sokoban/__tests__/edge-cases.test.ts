import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP, SokobanGrid } from "../grid.js";
import { LevelSelectScene } from "../scenes/level-select.js";
import { SokobanLevel } from "../scenes/sokoban-level.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

// Crate in a top-left corner — walls above (row 0) and left (col 0) make it permanently stuck.
// Player can reach (2,1) to try pushing left, and (1,2) to try pushing up, but both are blocked.
// Player can never stand on (0,1) or (1,0) to push the crate right or down.
const CORNER_TRAP_LEVEL = `
#####
#$  #
# @ #
#   #
#####
`.trim();

// Single crate/target for push-on / push-off testing
const PUSH_OFF_LEVEL = `
######
#    #
# @$.#
#    #
######
`.trim();

// Multi-crate level: 3 crates, 3 targets, partial coverage testing
const MULTI_CRATE_LEVEL = `
########
#      #
# $$$  #
# ...  #
#  @   #
########
`.trim();

describe("Sokoban Edge Cases — Grid", () => {
	it("push crate into corner (permanently stuck)", () => {
		const grid = SokobanGrid.parse(CORNER_TRAP_LEVEL);
		// Crate at (1,1), player at (2,2). Walls: row 0, row 4, col 0, col 4.
		// Crate is already in the top-left corner: wall above (1,0) and wall left (0,1).

		// Try pushing crate left: navigate player to (2,1), then push left
		grid.tryMove(DIR_UP); // player (2,2) → (2,1)
		const pushLeft = grid.tryMove(DIR_LEFT); // push crate (1,1) left to (0,1) = wall
		expect(pushLeft.moved).toBe(false);
		expect(grid.player).toEqual({ x: 2, y: 1 });
		expect(grid.crates[0]).toEqual({ x: 1, y: 1 });

		// Try pushing crate up: navigate player to (1,2), then push up
		grid.tryMove(DIR_LEFT); // (1,1) blocked by crate → no move
		grid.tryMove(DIR_DOWN); // (2,2)
		grid.tryMove(DIR_LEFT); // (1,2)
		const pushUp = grid.tryMove(DIR_UP); // push crate (1,1) up to (1,0) = wall
		expect(pushUp.moved).toBe(false);
		expect(grid.player).toEqual({ x: 1, y: 2 });
		expect(grid.crates[0]).toEqual({ x: 1, y: 1 });

		// Player can never stand on wall cells (0,1) or (1,0) to push the crate
		// right or down, so the crate is permanently stuck — classic Sokoban deadlock.
	});

	it("push crate onto target, then push it off", () => {
		const grid = SokobanGrid.parse(PUSH_OFF_LEVEL);
		// Player at (2,2), crate at (3,2), target at (4,2)
		// Push crate right onto target
		grid.tryMove(DIR_RIGHT); // push crate (3,2) → (4,2), player → (3,2)
		expect(grid.crates[0]).toEqual({ x: 4, y: 2 });
		expect(grid.isSolved()).toBe(true);

		// Now push it off the target: push crate down from above
		// Player needs to be at (4,1). Move up (3,1), right (4,1), then down.
		grid.tryMove(DIR_UP); // (3,1)
		grid.tryMove(DIR_RIGHT); // (4,1)
		grid.tryMove(DIR_DOWN); // push crate (4,2) → (4,3), player → (4,2)
		expect(grid.crates[0]).toEqual({ x: 4, y: 3 });
		expect(grid.isSolved()).toBe(false);
		// Target at (4,2) is now uncovered
		expect(grid.isTarget({ x: 4, y: 2 })).toBe(true);
		expect(grid.crateAt({ x: 4, y: 2 })).toBe(-1);
	});

	it("undo after pushing crate onto target (target state reverts)", () => {
		const grid = SokobanGrid.parse(PUSH_OFF_LEVEL);
		// Push crate right onto target
		grid.tryMove(DIR_RIGHT); // push crate (3,2) → (4,2)
		expect(grid.isSolved()).toBe(true);

		// Undo — crate should go back, solved should revert
		const undone = grid.undo();
		expect(undone).toBe(true);
		expect(grid.crates[0]).toEqual({ x: 3, y: 2 });
		expect(grid.player).toEqual({ x: 2, y: 2 });
		expect(grid.isSolved()).toBe(false);
	});

	it("undo at move 0 is a no-op (position and count unchanged)", () => {
		const grid = SokobanGrid.parse(PUSH_OFF_LEVEL);
		const originalPlayer = { ...grid.player };

		const undone = grid.undo();
		expect(undone).toBe(false);
		expect(grid.player).toEqual(originalPlayer);
		expect(grid.moveCount).toBe(0);
		expect(grid.historyLength).toBe(0);
	});

	it("level not solved when only some crates are on targets", () => {
		const grid = SokobanGrid.parse(MULTI_CRATE_LEVEL);
		// 3 crates at (2,2), (3,2), (4,2) — 3 targets at (2,3), (3,3), (4,3)
		// Push only the first crate down onto target (2,3)
		// Player at (3,4). Move up to (3,3) — that's a target cell but player can walk on it.
		// Move left to (2,3), up to (2,2) — that has a crate. Can't go there directly.
		// Move player: left (2,4), up (2,3), up — push crate (2,2) to (2,1)
		// That pushes the wrong way. Instead:
		// Get above crate at (2,2): player goes (3,4)→(1,4)→(1,1)→(2,1)
		grid.tryMove(DIR_LEFT); // (2,4)
		grid.tryMove(DIR_LEFT); // (1,4)
		grid.tryMove(DIR_UP); // (1,3)
		grid.tryMove(DIR_UP); // (1,2)
		grid.tryMove(DIR_UP); // (1,1)
		grid.tryMove(DIR_RIGHT); // (2,1)
		grid.tryMove(DIR_DOWN); // push crate (2,2) → (2,3) = target!

		expect(grid.crates[0]).toEqual({ x: 2, y: 3 });
		expect(grid.isTarget({ x: 2, y: 3 })).toBe(true);
		// Only 1 of 3 crates is on a target — not solved
		expect(grid.isSolved()).toBe(false);
	});
});

describe("Sokoban Edge Cases — Scene", () => {
	it("rapid sequential inputs all register as moves", async () => {
		// Send 3 rapid taps without waiting between them.
		// The grid processes moves on isJustPressed, so each tap's leading
		// edge registers on a distinct frame.
		const input = InputScript.create()
			.wait(6) // let scene initialize
			.tap("move_left") // (2,4) → (1,4)
			.wait(1)
			.tap("move_up") // (1,4) → (1,3)
			.wait(1)
			.tap("move_up"); // (1,3) → (1,2)

		const result = await runScene(SokobanLevel, input, 0.5);
		const scene = result.game.currentScene as SokobanLevel;
		const grid = scene.getGrid();

		expect(grid.player).toEqual({ x: 1, y: 2 });
		expect(gameState.moves).toBe(3);
	});

	it("level select renders with partially completed levels", async () => {
		const result = await runScene(LevelSelectScene, undefined, 0.1, () => {
			// Set some levels as completed before scene loads
			gameState.completedLevels = [0, 2];
		});
		expect(result.game.currentScene).toBeDefined();
	});
});
