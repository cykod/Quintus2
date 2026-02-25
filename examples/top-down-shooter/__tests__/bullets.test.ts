import { describe, expect, it } from "vitest";
import type { PlayerBullet } from "../entities/bullet.js";
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

		const seen = new Set<PlayerBullet>();
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
});
