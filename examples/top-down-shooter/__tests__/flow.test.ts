import { describe, expect, it } from "vitest";
import { ArenaScene } from "../scenes/arena-scene.js";
import { TitleScene } from "../scenes/title-scene.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

describe("Game flow", () => {
	it("title scene starts without errors", async () => {
		const result = await runScene(TitleScene, undefined, 0.1);
		expect(result.game.currentScene).toBeDefined();
	});

	it("arena scene starts with correct initial state", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		expect(result.game.currentScene).toBeDefined();
		expect(gameState.score).toBe(0);
		expect(gameState.wave).toBe(1);
		expect(gameState.health).toBe(100);
	});

	it("game state resets properly", () => {
		gameState.score = 1000;
		gameState.wave = 5;
		gameState.health = 20;
		gameState.kills = 50;

		gameState.reset();

		expect(gameState.score).toBe(0);
		expect(gameState.wave).toBe(0);
		expect(gameState.health).toBe(100);
		expect(gameState.kills).toBe(0);
	});
});
