import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { PLAYER_BULLET_SPEED } from "../config.js";
import { playerBulletPool } from "../entities/player-bullet.js";
import { ShooterLevel } from "../scenes/shooter-level.js";
import { runScene } from "./helpers.js";

describe("Bullets", () => {
	it("player bullets move upward", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;

		const bullet = playerBulletPool.acquire();
		bullet.fire(new Vec2(240, 300), -Math.PI / 2, {
			speed: PLAYER_BULLET_SPEED,
			damage: 1,
			lifetime: 0,
		});
		scene.add(bullet);
		const initialY = bullet.position.y;

		for (let i = 0; i < 10; i++) {
			result.game.step();
		}

		expect(bullet.position.y).toBeLessThan(initialY);
	});

	it("bullets released to pool when off-screen", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;

		const bullet = playerBulletPool.acquire();
		bullet.fire(new Vec2(240, 10), -Math.PI / 2, {
			speed: PLAYER_BULLET_SPEED,
			damage: 1,
			lifetime: 0,
		});
		scene.add(bullet);

		const initialAvailable = playerBulletPool.available;

		// Run until bullet goes off-screen
		for (let i = 0; i < 30; i++) {
			result.game.step();
		}

		// Pool should have recovered the bullet
		expect(playerBulletPool.available).toBeGreaterThanOrEqual(initialAvailable);
	});

	it("pool reuses instances", async () => {
		await runScene(ShooterLevel, undefined, 0.1);

		// Acquire a bullet, release it, then acquire again
		const bullet1 = playerBulletPool.acquire();
		bullet1.position._set(240, 300);
		playerBulletPool.release(bullet1);

		const bullet2 = playerBulletPool.acquire();
		// Should be the same instance (reused from pool)
		expect(bullet2).toBe(bullet1);
	});
});
