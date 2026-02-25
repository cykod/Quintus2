import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { GAME_HEIGHT } from "../config.js";
import { BasicEnemy } from "../entities/basic-enemy.js";
import { BomberEnemy } from "../entities/bomber-enemy.js";
import { EnemyBullet } from "../entities/enemy-bullet.js";
import { WeaverEnemy } from "../entities/weaver-enemy.js";
import { ShooterLevel } from "../scenes/shooter-level.js";
import { runScene } from "./helpers.js";

describe("Enemies", () => {
	it("BasicEnemy moves straight down", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;

		const enemy = scene.add(BasicEnemy, { position: new Vec2(240, 50) });
		const initialY = enemy.position.y;

		for (let i = 0; i < 30; i++) {
			result.game.step();
		}

		expect(enemy.position.y).toBeGreaterThan(initialY);
		// X should remain roughly the same (straight down)
		expect(enemy.position.x).toBeCloseTo(240, 0);
	});

	it("WeaverEnemy oscillates horizontally", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;

		const enemy = scene.add(WeaverEnemy, { position: new Vec2(240, 50) });
		const initialX = enemy.position.x;
		const initialY = enemy.position.y;

		// Run for a while to see oscillation
		for (let i = 0; i < 60; i++) {
			result.game.step();
		}

		// Should have moved down
		expect(enemy.position.y).toBeGreaterThan(initialY);
		// Should have moved horizontally from center
		expect(Math.abs(enemy.position.x - initialX)).toBeGreaterThan(0);
	});

	it("BomberEnemy drops bombs", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;

		scene.add(BomberEnemy, { position: new Vec2(240, 100) });

		// Run enough frames for the bomber to fire (1.5s interval)
		for (let i = 0; i < 100; i++) {
			result.game.step();
		}

		const bullets = scene.findAllByType(EnemyBullet);
		expect(bullets.length).toBeGreaterThan(0);
	});

	it("enemies are destroyed when hp reaches 0", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;

		const enemy = scene.add(BasicEnemy, { position: new Vec2(240, 100) });
		let diedEmitted = false;
		enemy.died.connect(() => {
			diedEmitted = true;
		});

		enemy.takeDamage(1);
		expect(diedEmitted).toBe(true);
	});

	it("enemy wraps to top when off-screen", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;

		const enemy = scene.add(BasicEnemy, { position: new Vec2(240, 600) });

		// Run until enemy goes off-screen and wraps
		for (let i = 0; i < 60; i++) {
			result.game.step();
		}

		// Enemy should still be in tree (wrapped, not destroyed)
		expect(enemy.isInsideTree).toBe(true);
		// Should have been repositioned to above the screen
		expect(enemy.position.y).toBeLessThan(GAME_HEIGHT);
	});
});
