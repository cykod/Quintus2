import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { GAME_WIDTH, PADDLE_WIDTH, PADDLE_Y } from "../config.js";
import { Paddle } from "../entities/paddle.js";
import { Level1 } from "../scenes/level1.js";
import { runScene } from "./helpers.js";

describe("Paddle", () => {
	it("starts at center of screen", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const paddle = result.game.currentScene!.findByType(Paddle);
		expect(paddle).toBeDefined();
		expect(paddle!.position.x).toBeCloseTo(GAME_WIDTH / 2, 0);
		expect(paddle!.position.y).toBeCloseTo(PADDLE_Y, 0);
	});

	it("moves right when right is pressed", async () => {
		const result = await runScene(
			Level1,
			InputScript.create().press("right", 30),
			0.5,
		);
		const paddle = result.game.currentScene!.findByType(Paddle);
		expect(paddle!.position.x).toBeGreaterThan(GAME_WIDTH / 2);
	});

	it("moves left when left is pressed", async () => {
		const result = await runScene(
			Level1,
			InputScript.create().press("left", 30),
			0.5,
		);
		const paddle = result.game.currentScene!.findByType(Paddle);
		expect(paddle!.position.x).toBeLessThan(GAME_WIDTH / 2);
	});

	it("stops at left wall", async () => {
		const result = await runScene(
			Level1,
			InputScript.create().press("left", 180),
			3,
		);
		const paddle = result.game.currentScene!.findByType(Paddle);
		// Paddle center should not go past wall + half paddle width
		expect(paddle!.position.x).toBeGreaterThanOrEqual(PADDLE_WIDTH / 2 - 1);
	});

	it("stops at right wall", async () => {
		const result = await runScene(
			Level1,
			InputScript.create().press("right", 180),
			3,
		);
		const paddle = result.game.currentScene!.findByType(Paddle);
		expect(paddle!.position.x).toBeLessThanOrEqual(GAME_WIDTH - PADDLE_WIDTH / 2 + 1);
	});
});
