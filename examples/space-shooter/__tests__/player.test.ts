import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { Player } from "../entities/player.js";
import { PlayerBullet } from "../entities/player-bullet.js";
import { ShooterLevel } from "../scenes/shooter-level.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

describe("Player", () => {
	it("starts at bottom center of screen", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const player = result.game.currentScene!.findByType(Player);
		expect(player).toBeDefined();
		expect(player!.position.x).toBeCloseTo(GAME_WIDTH / 2, 0);
		expect(player!.position.y).toBeCloseTo(GAME_HEIGHT - 60, 0);
	});

	it("moves right with input", async () => {
		const result = await runScene(ShooterLevel, InputScript.create().press("right", 30), 0.6);
		const player = result.game.currentScene!.findByType(Player);
		expect(player!.position.x).toBeGreaterThan(GAME_WIDTH / 2);
	});

	it("moves left with input", async () => {
		const result = await runScene(ShooterLevel, InputScript.create().press("left", 30), 0.6);
		const player = result.game.currentScene!.findByType(Player);
		expect(player!.position.x).toBeLessThan(GAME_WIDTH / 2);
	});

	it("clamps to screen bounds", async () => {
		// Press right for a very long time to hit the right edge
		const result = await runScene(ShooterLevel, InputScript.create().press("right", 300), 5);
		const player = result.game.currentScene!.findByType(Player);
		expect(player!.position.x).toBeLessThanOrEqual(GAME_WIDTH);
	});

	it("fires bullets on fire input", async () => {
		const result = await runScene(ShooterLevel, InputScript.create().wait(6).press("fire", 30), 1);
		const scene = result.game.currentScene!;
		const bullets = scene.findAllByType(PlayerBullet);
		expect(bullets.length).toBeGreaterThan(0);
	});

	it("takes damage and decrements lives", async () => {
		const result = await runScene(ShooterLevel, undefined, 0.1);
		const player = result.game.currentScene!.findByType(Player)!;
		expect(player.health).toBe(3);

		player.takeDamage(1);
		expect(player.health).toBe(2);
		expect(gameState.lives).toBe(2);
	});
});
