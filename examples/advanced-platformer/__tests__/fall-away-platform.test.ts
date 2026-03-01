import { describe, expect, it } from "vitest";
import { FallAwayPlatform } from "../entities/fall-away-platform.js";
import { FallAwayArena, runScene } from "./helpers.js";

describe("FallAwayPlatform", () => {
	it("platform triggers shake when triggered", async () => {
		const result = await runScene(FallAwayArena, undefined, 0.1);
		const platform = result.game.currentScene!.findByType(FallAwayPlatform)!;
		const startX = platform.position.x;

		// Trigger the fall sequence
		platform.trigger();

		// Advance a few frames for the shake tween to start
		for (let i = 0; i < 5; i++) result.game.step();

		// Platform should be shaking — x should be offset from start
		const offset = Math.abs(platform.position.x - startX);
		expect(offset).toBeGreaterThan(0);

		result.game.stop();
	});

	it("platform falls and disappears after delay", async () => {
		const result = await runScene(FallAwayArena, undefined, 0.1);
		const platform = result.game.currentScene!.findByType(FallAwayPlatform)!;
		const startY = platform.position.y;

		platform.trigger();

		// Advance past fallDelay (0.5s = ~30 frames) + fall time (0.4s = ~24 frames)
		for (let i = 0; i < 60; i++) result.game.step();

		// Platform should have moved down significantly
		expect(platform.position.y).toBeGreaterThan(startY + 50);

		result.game.stop();
	});

	it("platform respawns after respawnDelay", async () => {
		const result = await runScene(FallAwayArena, undefined, 0.1);
		const platform = result.game.currentScene!.findByType(FallAwayPlatform)!;
		const startY = platform.position.y;
		platform.respawnDelay = 1.0; // shorter for test

		platform.trigger();

		// Advance past fall sequence (0.5 + 0.4 = 0.9s ≈ 54 frames)
		for (let i = 0; i < 60; i++) result.game.step();

		// Platform should be hidden
		expect(platform.visible).toBe(false);

		// Advance past respawn delay (1.0s = 60 frames)
		for (let i = 0; i < 65; i++) result.game.step();

		// Platform should have respawned at original position
		expect(platform.visible).toBe(true);
		expect(platform.position.y).toBeCloseTo(startY, 0);

		result.game.stop();
	});
});
