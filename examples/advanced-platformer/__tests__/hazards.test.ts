import { describe, expect, it } from "vitest";
import type { Player } from "../entities/player.js";
import { runScene, SpikeArena, WaterZoneArena } from "./helpers.js";

describe("Spike", () => {
	it("damages player on overlap", async () => {
		const result = await runScene(SpikeArena, undefined, 0.1);
		const scene = result.game.currentScene!;
		const player = scene.findFirst("player") as Player;

		const healthBefore = player.health;

		// Walk player into the spike at x=400
		player.position.x = 390;

		for (let i = 0; i < 10; i++) result.game.step();

		expect(player.health).toBeLessThan(healthBefore);

		result.game.stop();
	});

	it("does not damage invincible player", async () => {
		const result = await runScene(SpikeArena, undefined, 0.1);
		const scene = result.game.currentScene!;
		const player = scene.findFirst("player") as Player;

		// Give player star power (makes them invincible to damage)
		player.activateStarPower(5);
		const healthBefore = player.health;

		// Walk player into the spike
		player.position.x = 390;

		for (let i = 0; i < 10; i++) result.game.step();

		expect(player.health).toBe(healthBefore);

		result.game.stop();
	});
});

describe("WaterZone", () => {
	it("kills player on overlap (lethal damage)", async () => {
		const result = await runScene(WaterZoneArena, undefined, 0.1);
		const scene = result.game.currentScene!;
		const player = scene.findFirst("player") as Player;

		expect(player.isDead()).toBe(false);

		// Move player into water zone at x=450
		player.position.x = 440;
		player.position.y = 340;

		for (let i = 0; i < 10; i++) result.game.step();

		expect(player.isDead()).toBe(true);

		result.game.stop();
	});
});
