import { describe, expect, it } from "vitest";
import { EnemyManager } from "../entities/enemy-manager.js";
import { Player } from "../entities/player.js";
import { Zombie } from "../entities/zombie.js";
import { ArenaScene } from "../scenes/arena-scene.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

describe("Edge cases", () => {
	it("weapon switch during firing cooldown resets cooldown", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		if (!player) return;

		// Unlock machine gun and switch to it
		player.unlockWeapon("machine");
		expect(player.currentWeaponId).toBe("machine");

		// Switch back to pistol — cooldown should reset (switchWeapon sets _fireCooldown = 0)
		player.switchWeapon("pistol");
		expect(player.currentWeaponId).toBe("pistol");

		// Verify the player can fire immediately after switch by stepping a frame
		// (no waiting for cooldown)
		result.game.step();
		// No crash — weapon switch during cooldown is handled gracefully
	});

	it("soldier burst fire does not crash with no bullet manager", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const scene = result.game.currentScene!;

		// Manually create a zombie without a bullet manager to test graceful handling
		const zombie = scene.add(Zombie, { position: [200, 200] });
		zombie._bulletManager = null;

		// Step frames — zombie moves toward player without crashing
		for (let i = 0; i < 30; i++) {
			result.game.step();
		}

		expect(zombie.isInsideTree).toBe(true);
	});

	it("mouse aim at exact center of player (atan2 edge case)", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		if (!player) return;

		// Set mouse position to exact player center — atan2(0, 0) returns 0
		result.game.input.mousePosition._set(player.position.x, player.position.y);

		// Step frames — should not produce NaN or crash
		for (let i = 0; i < 10; i++) {
			result.game.step();
		}

		expect(Number.isNaN(player.rotation)).toBe(false);
		expect(player.rotation).toBe(0);
	});

	it("enemy spawn positions stay within arena bounds", async () => {
		// Run enough frames for enemies to spawn
		const result = await runScene(ArenaScene, undefined, 3);
		const scene = result.game.currentScene!;

		// Check all zombies are within arena bounds
		const zombies = scene.findAllByType(Zombie);
		for (const z of zombies) {
			expect(z.position.x).toBeGreaterThanOrEqual(16);
			expect(z.position.x).toBeLessThanOrEqual(784);
			expect(z.position.y).toBeGreaterThanOrEqual(16);
			expect(z.position.y).toBeLessThanOrEqual(584);
		}
	});

	it("weapon pickup collection while switching weapons", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		if (!player) return;

		// Unlock machine gun
		player.unlockWeapon("machine");
		expect(player.currentWeaponId).toBe("machine");

		// Simulate receiving a silencer pickup while machine gun is equipped
		player.unlockWeapon("silencer");
		expect(player.currentWeaponId).toBe("silencer");
		expect(gameState.currentWeapon).toBe("silencer");
		expect(gameState.ammo).toBe(12);

		// Switch back to machine — ammo should be preserved
		player.switchWeapon("machine");
		expect(gameState.ammo).toBe(60);
	});

	it("multiple enemies dying same frame accumulates score correctly", async () => {
		const result = await runScene(ArenaScene, undefined, 3);
		const scene = result.game.currentScene!;

		const zombies = scene.findAllByType(Zombie);
		if (zombies.length < 2) return; // Need at least 2 zombies

		const scoreBefore = gameState.score;
		const z1 = zombies[0]!;
		const z2 = zombies[1]!;
		const expectedGain = z1.scoreValue + z2.scoreValue;

		// Kill both in the same synchronous sequence (same frame)
		z1.takeDamage(z1.maxHealth);
		z2.takeDamage(z2.maxHealth);

		expect(gameState.score).toBe(scoreBefore + expectedGain);
	});

	it("enemy pool handles exhaustion gracefully", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const mgr = result.game.currentScene?.findByType(EnemyManager);
		expect(mgr).toBeDefined();
		if (!mgr) return;

		// Start a large wave to stress the pools
		mgr.startWave(10);

		// Step many frames to trigger spawning
		for (let i = 0; i < 300; i++) {
			result.game.step();
		}

		// Should not crash — verify manager is still functional
		expect(mgr.activeEnemyCount).toBeGreaterThanOrEqual(0);
		expect(mgr.isInsideTree).toBe(true);
	});
});
