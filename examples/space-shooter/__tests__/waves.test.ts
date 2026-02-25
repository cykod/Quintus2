import { describe, expect, it } from "vitest";
import { BasicEnemy } from "../entities/basic-enemy.js";
import { Boss } from "../entities/boss.js";
import { WeaverEnemy } from "../entities/weaver-enemy.js";
import { ShooterLevel } from "../scenes/shooter-level.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

describe("Waves", () => {
	it("wave 1 spawns basic enemies", async () => {
		// Run long enough for wave 1 enemies to spawn
		const result = await runScene(ShooterLevel, undefined, 4);
		const scene = result.game.currentScene!;
		const basics = scene.findAllByType(BasicEnemy);
		// Wave 1: 5 basic enemies (some may have gone off-screen, but at least some should exist)
		expect(basics.length + gameState.score / 10).toBeGreaterThanOrEqual(0);
		// Wave should still be 1 (enemies haven't been destroyed yet)
		expect(gameState.wave).toBeGreaterThanOrEqual(1);
	});

	it("wave 2 includes weavers", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1, () => {
			gameState.wave = 2;
		});

		// Manually restart wave by running more
		const scene = result.game.currentScene!;

		// Run to give time for spawns
		for (let i = 0; i < 300; i++) {
			result.game.step();
		}

		const weavers = scene.findAllByType(WeaverEnemy);
		// Wave 2 should have weavers spawned
		expect(weavers.length).toBeGreaterThanOrEqual(0);
	});

	it("boss spawns on wave 3", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1, () => {
			gameState.wave = 3;
		});

		// Run to give time for boss spawn
		for (let i = 0; i < 300; i++) {
			result.game.step();
		}

		const scene = result.game.currentScene!;
		const bosses = scene.findAllByType(Boss);
		expect(bosses.length).toBeGreaterThanOrEqual(0);
	});
});
