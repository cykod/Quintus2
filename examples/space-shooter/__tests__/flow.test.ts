import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { ShooterLevel } from "../scenes/shooter-level.js";
import { TitleScene } from "../scenes/title-scene.js";
import { gameState } from "../state.js";
import { runScene, runSceneWithSnapshots } from "./helpers.js";

describe("Game flow", () => {
	it("title scene starts without errors", async () => {
		const result = await runScene(TitleScene, undefined, 0.1);
		expect(result.game.currentScene).toBeDefined();
	});

	it("game scene starts with correct initial state", async () => {
		await runScene(ShooterLevel, undefined, 0.1);
		expect(gameState.score).toBe(0);
		expect(gameState.lives).toBe(3);
		expect(gameState.wave).toBe(1);
	});

	it("game state resets properly", () => {
		gameState.score = 5000;
		gameState.lives = 1;
		gameState.wave = 5;
		gameState.shieldActive = true;
		gameState.spreadShot = true;
		gameState.rapidFire = true;

		gameState.reset();

		expect(gameState.score).toBe(0);
		expect(gameState.lives).toBe(3);
		expect(gameState.wave).toBe(1);
		expect(gameState.shieldActive).toBe(false);
		expect(gameState.spreadShot).toBe(false);
		expect(gameState.rapidFire).toBe(false);
	});

	it("deterministic replay produces same final frame count", async () => {
		const input = InputScript.create()
			.wait(6)
			.press("fire", 30)
			.press("right", 60)
			.press("left", 60);

		const result1 = await runSceneWithSnapshots(ShooterLevel, input, 2.5);
		const result2 = await runSceneWithSnapshots(ShooterLevel, input, 2.5);

		expect(result1.totalFrames).toBe(result2.totalFrames);
		expect(result1.timeline.length).toBe(result2.timeline.length);
	});
});
