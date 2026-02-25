import { describe, expect, it } from "vitest";
import { STARTING_GOLD, STARTING_LIVES } from "../config.js";
import { Level1 } from "../scenes/level1.js";
import { TitleScene } from "../scenes/title-scene.js";
import { gameState } from "../state.js";
import { runScene, runSceneWithSnapshots } from "./helpers.js";

describe("Game flow", () => {
	it("title scene loads without errors", async () => {
		const result = await runScene(TitleScene, undefined, 0.1);
		expect(result.game.currentScene).toBeDefined();
	});

	it("level1 starts with correct initial state", async () => {
		await runScene(Level1, undefined, 0.1);
		expect(gameState.gold).toBe(STARTING_GOLD);
		expect(gameState.lives).toBe(STARTING_LIVES);
		expect(gameState.wave).toBe(1);
		expect(gameState.score).toBe(0);
	});

	it("game state resets properly", () => {
		gameState.gold = 999;
		gameState.lives = 1;
		gameState.wave = 5;
		gameState.score = 5000;
		gameState.selectedTower = "cannon";

		gameState.reset();

		expect(gameState.gold).toBe(STARTING_GOLD);
		expect(gameState.lives).toBe(STARTING_LIVES);
		expect(gameState.wave).toBe(0);
		expect(gameState.score).toBe(0);
		expect(gameState.selectedTower).toBe("arrow");
	});

	it("deterministic replay produces same frame count", async () => {
		const result1 = await runSceneWithSnapshots(Level1, undefined, 1.0);
		const result2 = await runSceneWithSnapshots(Level1, undefined, 1.0);

		expect(result1.totalFrames).toBe(result2.totalFrames);
		expect(result1.timeline.length).toBe(result2.timeline.length);
	});
});
