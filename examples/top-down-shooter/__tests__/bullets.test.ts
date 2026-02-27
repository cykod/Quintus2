import { describe, expect, it } from "vitest";
import type { ShooterBullet } from "../entities/bullet.js";
import { BulletManager } from "../entities/bullet-manager.js";
import { ArenaScene } from "../scenes/arena-scene.js";
import { runScene } from "./helpers.js";

describe("Bullets", () => {
	it("spawns player bullet at correct position", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const mgr = result.game.currentScene?.findByType(BulletManager);
		expect(mgr).toBeDefined();

		const bullet = mgr?.spawnPlayerBullet(200, 300, 0, 400, 25);
		expect(bullet).toBeDefined();
		expect(bullet?.position.x).toBeCloseTo(200, 0);
		expect(bullet?.position.y).toBeCloseTo(300, 0);
	});

	it("bullets recycle after being released", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const mgr = result.game.currentScene?.findByType(BulletManager);
		expect(mgr).toBeDefined();
		if (!mgr) return;

		const statsBefore = mgr.getPoolStats();
		const availableBefore = statsBefore.playerBullets.available;

		// Spawn and recycle
		const bullet = mgr.spawnPlayerBullet(200, 300, 0, 400, 25);
		mgr.recyclePlayerBullet(bullet);

		const statsAfter = mgr.getPoolStats();
		expect(statsAfter.playerBullets.available).toBeGreaterThanOrEqual(availableBefore);
	});

	it("pool reuses instances across 100 spawn/recycle cycles", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const mgr = result.game.currentScene?.findByType(BulletManager);
		expect(mgr).toBeDefined();
		if (!mgr) return;

		const seen = new Set<ShooterBullet>();
		for (let i = 0; i < 100; i++) {
			const bullet = mgr.spawnPlayerBullet(200, 300, 0, 400, 25);
			seen.add(bullet);
			mgr.recyclePlayerBullet(bullet);
		}

		// Pool should reuse instances, so we see far fewer unique objects than 100
		expect(seen.size).toBeLessThan(100);
	});

	it("pool stats show correct available count", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const mgr = result.game.currentScene?.findByType(BulletManager);
		expect(mgr).toBeDefined();
		if (!mgr) return;

		const stats = mgr.getPoolStats();
		expect(stats.playerBullets.max).toBe(300);
		expect(stats.enemyBullets.max).toBe(200);
		expect(stats.playerBullets.available).toBeGreaterThan(0);
	});

	it("bullet acquires from pool with correct collisionGroup", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const mgr = result.game.currentScene?.findByType(BulletManager);
		expect(mgr).toBeDefined();
		if (!mgr) return;

		// Spawn, recycle, and re-spawn to test pool reuse
		const bullet1 = mgr.spawnPlayerBullet(100, 100, 0, 400, 25);
		mgr.recyclePlayerBullet(bullet1);
		const bullet2 = mgr.spawnPlayerBullet(200, 200, 0, 400, 25);

		expect(bullet2.collisionGroup).toBe("player_bullets");

		// Also test enemy bullets
		const enemy1 = mgr.spawnEnemyBullet(100, 100, 0, 200, 15);
		mgr.recycleEnemyBullet(enemy1);
		const enemy2 = mgr.spawnEnemyBullet(200, 200, 0, 200, 15);

		expect(enemy2.collisionGroup).toBe("enemy_bullets");
	});

	it("bullet acquires from pool with applyGravity = false", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const mgr = result.game.currentScene?.findByType(BulletManager);
		expect(mgr).toBeDefined();
		if (!mgr) return;

		const bullet1 = mgr.spawnPlayerBullet(100, 100, 0, 400, 25);
		mgr.recyclePlayerBullet(bullet1);
		const bullet2 = mgr.spawnPlayerBullet(200, 200, 0, 400, 25);

		expect(bullet2.applyGravity).toBe(false);
	});

	it("bullet collision handler fires after pool reuse", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const mgr = result.game.currentScene?.findByType(BulletManager);
		expect(mgr).toBeDefined();
		if (!mgr) return;

		// Spawn, recycle, re-spawn
		const bullet1 = mgr.spawnEnemyBullet(100, 100, 0, 200, 15);
		mgr.recycleEnemyBullet(bullet1);
		const bullet2 = mgr.spawnEnemyBullet(200, 200, 0, 200, 15);

		// The collided signal should have a listener (connected in onReady)
		expect(bullet2.collided.listenerCount).toBeGreaterThan(0);
	});
});
