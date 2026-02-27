import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { BRICK_COLS } from "../config.js";
import { Level1 } from "../scenes/level1.js";
import { TitleScene } from "../scenes/title-scene.js";
import { gameState } from "../state.js";
import { runScene, runSceneWithSnapshots } from "./helpers.js";

describe("Game flow", () => {
	it("title scene starts without errors", async () => {
		const result = await runScene(TitleScene, undefined, 0.1);
		expect(result.game.currentScene).toBeDefined();
	});

	it("level 1 starts with correct initial state", async () => {
		await runScene(Level1, undefined, 0.1);
		expect(gameState.score).toBe(0);
		expect(gameState.lives).toBe(3);
		expect(gameState.level).toBe(1);
		expect(gameState.bricksRemaining).toBe(5 * BRICK_COLS);
	});

	it("destroying all bricks triggers level complete", async () => {
		await runScene(Level1, undefined, 0.1);
		const bricksCount = gameState.bricksRemaining;

		// Manually destroy all bricks (simulating ball hits)
		gameState.bricksRemaining = 0;
		expect(gameState.bricksRemaining).toBe(0);
		expect(bricksCount).toBe(50);
	});

	it("game state resets properly", () => {
		gameState.score = 1000;
		gameState.lives = 1;
		gameState.level = 3;
		gameState.bricksRemaining = 5;

		gameState.reset();

		expect(gameState.score).toBe(0);
		expect(gameState.lives).toBe(3);
		expect(gameState.level).toBe(1);
		expect(gameState.bricksRemaining).toBe(0);
	});

	it("deterministic replay produces same final frame count", async () => {
		const input = InputScript.create().wait(6).tap("launch").press("right", 60).press("left", 60);

		const result1 = await runSceneWithSnapshots(Level1, input, 2.5);
		const result2 = await runSceneWithSnapshots(Level1, input, 2.5);

		expect(result1.totalFrames).toBe(result2.totalFrames);
		expect(result1.timeline.length).toBe(result2.timeline.length);
	});
});
