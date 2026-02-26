import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { LevelSelectScene } from "../scenes/level-select.js";
import { SokobanLevel } from "../scenes/sokoban-level.js";
import { TitleScene } from "../scenes/title-scene.js";
import { gameState } from "../state.js";
import { runScene, runSceneWithSnapshots } from "./helpers.js";

describe("Sokoban — Game Flow", () => {
	it("title scene loads without errors", async () => {
		const result = await runScene(TitleScene, undefined, 0.1);
		expect(result.game.currentScene).toBeDefined();
	});

	it("level select scene loads without errors", async () => {
		const result = await runScene(LevelSelectScene, undefined, 0.1);
		expect(result.game.currentScene).toBeDefined();
	});

	it("level scene loads with correct initial state", async () => {
		await runScene(SokobanLevel, undefined, 0.1);
		expect(gameState.moves).toBe(0);
		expect(gameState.currentLevel).toBe(0);
	});

	it("game state resets properly", () => {
		gameState.moves = 50;
		gameState.currentLevel = 3;
		gameState.completedLevels = [0, 1, 2];

		gameState.reset();

		expect(gameState.moves).toBe(0);
		expect(gameState.currentLevel).toBe(0);
		expect(gameState.completedLevels).toEqual([]);
	});

	it("deterministic replay produces same frame count", async () => {
		const input = InputScript.create()
			.wait(6)
			.tap("move_up")
			.wait(6)
			.tap("move_left")
			.wait(6)
			.tap("move_down");

		const result1 = await runSceneWithSnapshots(SokobanLevel, input, 1.0);
		const result2 = await runSceneWithSnapshots(SokobanLevel, input, 1.0);

		expect(result1.totalFrames).toBe(result2.totalFrames);
		expect(result1.timeline.length).toBe(result2.timeline.length);
	});
});
