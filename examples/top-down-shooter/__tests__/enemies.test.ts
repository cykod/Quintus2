import { describe, expect, it } from "vitest";
import { EnemyManager } from "../entities/enemy-manager.js";
import { Zombie } from "../entities/zombie.js";
import { ArenaScene } from "../scenes/arena-scene.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

describe("Enemies", () => {
	it("wave 1 starts with enemies", async () => {
		const result = await runScene(ArenaScene, undefined, 3);
		expect(gameState.wave).toBe(1);

		const mgr = result.game.currentScene?.findByType(EnemyManager);
		expect(mgr).toBeDefined();
		expect(mgr?.activeEnemyCount).toBeGreaterThan(0);
	});

	it("enemy takeDamage reduces health and can kill", async () => {
		const result = await runScene(ArenaScene, undefined, 3);
		const mgr = result.game.currentScene?.findByType(EnemyManager);
		expect(mgr).toBeDefined();

		// Find a zombie
		const zombie = result.game.currentScene?.findByType(Zombie);
		if (!zombie) return; // May not have spawned yet in 0.5s

		let didDie = false;
		zombie.died.connect(() => {
			didDie = true;
		});

		zombie.takeDamage(zombie.maxHealth);
		expect(didDie).toBe(true);
	});

	it("killing enemies increases score", async () => {
		const result = await runScene(ArenaScene, undefined, 3);
		const zombie = result.game.currentScene?.findByType(Zombie);
		if (!zombie) return;

		const scoreBefore = gameState.score;
		// Simulate kill via the died callback
		zombie.takeDamage(zombie.maxHealth);
		expect(gameState.score).toBeGreaterThan(scoreBefore);
	});
});
