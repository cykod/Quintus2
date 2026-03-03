import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import type { MovingPlatform } from "../entities/moving-platform.js";
import { MovingPlatformArena, runScene } from "./helpers.js";

describe("MovingPlatform", () => {
	it("oscillates between start and end positions", async () => {
		const result = await runScene(MovingPlatformArena, undefined, 0.1);
		const scene = result.game.currentScene!;
		const platform = scene.findFirst("moving_platform") as MovingPlatform;

		const startX = platform.position.x;

		// Step enough frames for the platform to move partway
		for (let i = 0; i < 60; i++) result.game.step();

		expect(platform.position.x).toBeGreaterThan(startX);
		expect(platform.position.x).toBeLessThanOrEqual(startX + 200);

		result.game.stop();
	});

	it("reverses direction at endpoint", async () => {
		const result = await runScene(MovingPlatformArena, undefined, 0.1);
		const scene = result.game.currentScene!;
		const platform = scene.findFirst("moving_platform") as MovingPlatform;

		const startX = platform.position.x;

		// At speed=100, distance=200: one way takes 2s = 120 frames.
		// Step 150 frames to pass the endpoint and start returning.
		for (let i = 0; i < 150; i++) result.game.step();

		// Should have started coming back (x < startX + 200)
		expect(platform.position.x).toBeLessThan(startX + 200);

		result.game.stop();
	});

	it("carries player via constantVelocity", async () => {
		const result = await runScene(MovingPlatformArena, undefined, 0.1);
		const scene = result.game.currentScene!;
		const platform = scene.findFirst("moving_platform") as MovingPlatform;
		const player = scene.findFirst("player")!;

		// Place player on top of the platform
		player.position = new Vec2(platform.position.x, platform.position.y - 40);

		// Let player settle on the platform
		for (let i = 0; i < 10; i++) result.game.step();

		const playerXBefore = player.position.x;

		// Step frames — player should be carried along
		for (let i = 0; i < 30; i++) result.game.step();

		expect(player.position.x).toBeGreaterThan(playerXBefore);

		result.game.stop();
	});

	it("pauses at endpoints when waitTime > 0", async () => {
		const result = await runScene(MovingPlatformArena, undefined, 0.1);
		const scene = result.game.currentScene!;
		const platform = scene.findFirst("moving_platform") as MovingPlatform;
		platform.waitTime = 1.0; // 1 second wait

		// At speed=100, distance=200: one way takes 2s = 120 frames.
		// Step 125 frames to reach the endpoint and start waiting.
		for (let i = 0; i < 125; i++) result.game.step();

		const xAtEndpoint = platform.position.x;

		// Step 10 more frames — should still be waiting (not moving back yet)
		for (let i = 0; i < 10; i++) result.game.step();

		expect(platform.position.x).toBeCloseTo(xAtEndpoint, 0);
		expect(platform.constantVelocity.x).toBe(0);

		result.game.stop();
	});

	it("supports vertical direction", async () => {
		const result = await runScene(MovingPlatformArena, undefined, 0.1);
		const scene = result.game.currentScene!;
		const platform = scene.findFirst("moving_platform") as MovingPlatform;
		platform.direction = "vertical";
		platform.distance = 100;
		platform.speed = 100;

		const startY = platform.position.y;

		for (let i = 0; i < 30; i++) result.game.step();

		expect(platform.position.y).toBeGreaterThan(startY);
		expect(platform.constantVelocity.y).toBeGreaterThan(0);
		expect(platform.constantVelocity.x).toBe(0);

		result.game.stop();
	});
});
