import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { SokobanLevel } from "../scenes/sokoban-level.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

describe("Sokoban — Movement", () => {
	it("arrow up moves player one grid cell up", async () => {
		const result = await runScene(SokobanLevel, InputScript.create().wait(6).tap("move_up"), 0.5);
		const scene = result.game.currentScene as SokobanLevel;
		const grid = scene.getGrid();
		// Level 1: player starts at (2,4), moving up goes to (2,3)
		expect(grid.player).toEqual({ x: 2, y: 3 });
	});

	it("move counter increments on valid move", async () => {
		await runScene(SokobanLevel, InputScript.create().wait(6).tap("move_up"), 0.5);
		expect(gameState.moves).toBe(1);
	});

	it("move counter does not increment on blocked move", async () => {
		// Move down into wall
		await runScene(SokobanLevel, InputScript.create().wait(6).tap("move_down"), 0.5);
		expect(gameState.moves).toBe(0);
	});

	it("player can move in all four directions", async () => {
		const result = await runScene(
			SokobanLevel,
			InputScript.create()
				.wait(6)
				.tap("move_left")
				.wait(6)
				.tap("move_up")
				.wait(6)
				.tap("move_right")
				.wait(6)
				.tap("move_down"),
			1.0,
		);
		const scene = result.game.currentScene as SokobanLevel;
		const grid = scene.getGrid();
		// Left: (2,4)→(1,4), Up: (1,4)→(1,3), Right: (1,3)→(2,3), Down: (2,3)→(2,4)
		expect(grid.player).toEqual({ x: 2, y: 4 });
		expect(gameState.moves).toBe(4);
	});
});
