import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { Player } from "../entities/player.js";
import { PowerUp } from "../entities/power-up.js";
import { ShooterLevel } from "../scenes/shooter-level.js";
import { runScene } from "./helpers.js";

describe("Power-ups", () => {
	it("shield prevents damage", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const player = result.game.currentScene!.findByType(Player)!;

		player.shieldActive = true;
		player.takeDamage(1);

		expect(player.health).toBe(3); // no damage taken
	});

	it("power-up falls downward", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const scene = result.game.currentScene!;

		const powerUp = scene.add(PowerUp, {
			position: new Vec2(240, 100),
		});
		const initialY = powerUp.position.y;

		for (let i = 0; i < 30; i++) {
			result.game.step();
		}

		expect(powerUp.position.y).toBeGreaterThan(initialY);
	});

	it("spread shot fires 3 bullets", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const player = result.game.currentScene!.findByType(Player)!;

		player.spreadShot = true;

		// Inject fire input and step
		const { PlayerBullet } = await import("../entities/player-bullet.js");
		result.game.input.inject("fire", true);
		for (let i = 0; i < 15; i++) {
			result.game.step();
		}

		const bullets = result.game.currentScene!.findAllByType(PlayerBullet);
		// With spread, should fire 3 per shot
		expect(bullets.length).toBeGreaterThanOrEqual(3);
	});
});
