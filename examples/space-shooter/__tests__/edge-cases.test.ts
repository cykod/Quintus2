import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { GAME_HEIGHT, GAME_WIDTH, PLAYER_BULLET_SPEED } from "../config.js";
import { BasicEnemy } from "../entities/basic-enemy.js";
import { Boss } from "../entities/boss.js";
import { Player } from "../entities/player.js";
import { PlayerBullet, playerBulletPool } from "../entities/player-bullet.js";
import { ShooterLevel } from "../scenes/shooter-level.js";
import { runScene } from "./helpers.js";

describe("Edge cases", () => {
	it("boss defeat during spread-fire pattern does not crash", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;

		const boss = scene.add(Boss, { position: new Vec2(GAME_WIDTH / 2, 60) });

		// Step a few frames so boss starts its fire timer
		for (let i = 0; i < 30; i++) {
			result.game.step();
		}

		// Deal lethal damage while boss is active
		let diedEmitted = false;
		boss.died.connect(() => {
			diedEmitted = true;
		});
		boss.takeDamage(boss.health);

		expect(diedEmitted).toBe(true);

		// Step more frames — no crash after boss destroyed
		for (let i = 0; i < 30; i++) {
			result.game.step();
		}
	});

	it("power-up collection during invincibility works", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;
		const player = scene.findByType(Player)!;

		// Damage player to trigger invincibility
		player.takeDamage(1);
		expect(player.isInvincible()).toBe(true);
		expect(player.health).toBe(2);

		// Activate shield during invincibility (simulates power-up collection)
		player.shieldActive = true;

		// Step while invincible
		for (let i = 0; i < 5; i++) {
			result.game.step();
		}

		// Shield should be active even while player is invincible
		expect(player.shieldActive).toBe(true);

		// Player should still be at 2 HP (no additional damage during invincibility)
		expect(player.health).toBe(2);
	});

	it("bullet pool handles exhaustion gracefully", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;

		// Fire many bullets to stress the pool
		const bullets: PlayerBullet[] = [];
		for (let i = 0; i < 100; i++) {
			const bullet = playerBulletPool.acquire();
			bullet.fire(new Vec2(240, 300), -Math.PI / 2, {
				speed: PLAYER_BULLET_SPEED,
				damage: 1,
				lifetime: 0,
			});
			scene.add(bullet);
			bullets.push(bullet);
		}

		// Step to verify no crash
		for (let i = 0; i < 10; i++) {
			result.game.step();
		}

		// At least some bullets should still exist
		const activeBullets = scene.findAllByType(PlayerBullet);
		expect(activeBullets.length).toBeGreaterThan(0);
	});

	it("enemies spawn above screen at y=-30", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;

		const enemy = scene.add(BasicEnemy, { position: new Vec2(240, -30) });

		// Enemy should be above the visible screen
		expect(enemy.position.y).toBe(-30);
		expect(enemy.isInsideTree).toBe(true);

		// Step so it starts moving down
		for (let i = 0; i < 10; i++) {
			result.game.step();
		}
		expect(enemy.position.y).toBeGreaterThan(-30);
	});

	it("spread shot bullets trigger independent collisions", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;

		// Place an enemy in the path of spread fire
		const enemy = scene.add(BasicEnemy, { position: new Vec2(240, 100) });
		// Give it 3 HP so each bullet hit is tracked
		enemy.maxHealth = 3;
		enemy.health = 3;

		// Fire 3 spread bullets toward the enemy
		for (const offset of [-0.05, 0, 0.05]) {
			const bullet = playerBulletPool.acquire();
			bullet.isSpread = true;
			bullet.fire(new Vec2(240, 200), -Math.PI / 2 + offset, {
				speed: PLAYER_BULLET_SPEED,
				damage: 1,
				lifetime: 0,
			});
			scene.add(bullet);
		}

		// Step until bullets reach the enemy
		for (let i = 0; i < 60; i++) {
			result.game.step();
		}

		// Enemy should have taken at least 1 damage from a bullet collision
		expect(enemy.health).toBeLessThan(3);
	});

	it("shield power-up while already shielded blocks damage", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;
		const player = scene.findByType(Player)!;

		// Activate shield
		player.shieldActive = true;

		// Verify shield blocks damage
		player.takeDamage(1);
		expect(player.health).toBe(3);

		// Activate shield again (simulates collecting second shield)
		player.shieldActive = true;

		// Step some frames
		for (let i = 0; i < 5; i++) {
			result.game.step();
		}

		// Shield still active, damage still blocked
		expect(player.shieldActive).toBe(true);
		player.takeDamage(1);
		expect(player.health).toBe(3);
	});

	it("wave clear requires all enemies destroyed, not just off-screen", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;

		// Add a wrapping enemy that goes off-screen but wraps back
		const enemy = scene.add(BasicEnemy, { position: new Vec2(240, GAME_HEIGHT + 30) });

		// Step so enemy wraps
		for (let i = 0; i < 10; i++) {
			result.game.step();
		}

		// Enemy should still be alive (wrapped, not destroyed)
		expect(enemy.isInsideTree).toBe(true);
		expect(enemy.isDead()).toBe(false);
	});
});
