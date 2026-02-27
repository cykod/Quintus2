import { describe, expect, it } from "vitest";
import { PADDLE_WIDE_WIDTH, PADDLE_WIDTH } from "../config.js";
import { Paddle } from "../entities/paddle.js";
import { PowerUp } from "../entities/power-up.js";
import { Level1 } from "../scenes/level1.js";
import { runScene } from "./helpers.js";

describe("Power-ups", () => {
	it("power-up falls downward", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const scene = result.game.currentScene!;
		// Manually add a power-up to test its movement
		const powerUp = scene.add(PowerUp);
		powerUp.position._set(240, 100);
		powerUp.powerUpType = "wide";

		// Step the game to let the power-up fall
		const initialY = powerUp.position.y;
		for (let i = 0; i < 30; i++) {
			result.game.step();
		}
		expect(powerUp.position.y).toBeGreaterThan(initialY);
	});

	it("wide paddle changes paddle size", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const paddle = result.game.currentScene!.findByType(Paddle)!;
		expect(paddle.currentWidth).toBe(PADDLE_WIDTH);

		paddle.setWide(true);
		expect(paddle.currentWidth).toBe(PADDLE_WIDE_WIDTH);

		paddle.setWide(false);
		expect(paddle.currentWidth).toBe(PADDLE_WIDTH);
	});

	it("wide paddle is idempotent", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const paddle = result.game.currentScene!.findByType(Paddle)!;

		paddle.setWide(true);
		paddle.setWide(true); // no-op
		expect(paddle.currentWidth).toBe(PADDLE_WIDE_WIDTH);
	});
});
