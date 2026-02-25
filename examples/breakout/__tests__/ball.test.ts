import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { BALL_SPEED, GAME_WIDTH } from "../config.js";
import { Ball } from "../entities/ball.js";
import { Paddle } from "../entities/paddle.js";
import { Level1 } from "../scenes/level1.js";
import { runScene } from "./helpers.js";

describe("Ball", () => {
	it("follows paddle before launch", async () => {
		const result = await runScene(
			Level1,
			InputScript.create().press("right", 30),
			0.5,
		);
		const paddle = result.game.currentScene!.findByType(Paddle);
		const ball = result.game.currentScene!.findByType(Ball);
		expect(ball).toBeDefined();
		expect(ball!.attached).toBe(true);
		expect(ball!.position.x).toBeCloseTo(paddle!.position.x, 0);
	});

	it("launches on input", async () => {
		const result = await runScene(
			Level1,
			InputScript.create().wait(6).tap("launch"),
			0.3,
		);
		const ball = result.game.currentScene!.findByType(Ball);
		expect(ball!.attached).toBe(false);
		// Ball should be moving upward
		expect(ball!.velocity.y).toBeLessThan(0);
	});

	it("launches at an angle from paddle", async () => {
		const result = await runScene(
			Level1,
			InputScript.create().wait(6).tap("launch"),
			0.15,
		);
		const ball = result.game.currentScene!.findByType(Ball);
		// Ball should launch at ~20° from vertical
		const angle = Math.PI / 9;
		expect(ball!.velocity.x).toBeCloseTo(Math.sin(angle) * BALL_SPEED, 0);
		expect(ball!.velocity.y).toBeLessThan(0);
	});

	it("ball starts attached and centered on paddle", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const paddle = result.game.currentScene!.findByType(Paddle);
		const ball = result.game.currentScene!.findByType(Ball);
		expect(ball!.attached).toBe(true);
		expect(ball!.position.x).toBeCloseTo(GAME_WIDTH / 2, 0);
		expect(ball!.position.y).toBeLessThan(paddle!.position.y);
	});
});
