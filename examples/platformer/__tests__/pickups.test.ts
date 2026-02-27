import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { Coin } from "../entities/coin.js";
import { HealthPickup } from "../entities/health-pickup.js";
import { Player } from "../entities/player.js";
import { gameState } from "../state.js";
import { runArena } from "./helpers.js";

describe("Coin", () => {
	it("collected by player increases coins and score", async () => {
		const result = await runArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const player = scene.findByType(Player)!;

		// Let player settle on floor first
		for (let i = 0; i < 15; i++) {
			result.game.step();
		}

		// Use props overload so position is set BEFORE onReady captures _baseY
		// for the bob animation. Setting position after add() would be overwritten
		// by Pickup's bob, which uses _baseY = position.y at onReady time.
		scene.add(Coin, {
			position: new Vec2(player.position.x + 20, player.position.y),
		});

		const initialCoins = gameState.coins;
		const initialScore = gameState.score;

		// Walk right into the coin (speed=120, dt=1/60 → 2px/frame, ~10 frames to reach)
		result.game.input.inject("right", true);
		for (let i = 0; i < 30; i++) {
			result.game.step();
		}
		result.game.input.inject("right", false);

		expect(gameState.coins).toBe(initialCoins + 1);
		expect(gameState.score).toBe(initialScore + 10);
		result.game.stop();
	});

	it("bob animation oscillates position", async () => {
		const result = await runArena(undefined, 0.1);
		const scene = result.game.currentScene!;

		// Set position via props so _baseY is captured correctly in onReady
		const coin = scene.add(Coin, { position: new Vec2(50, 100) });

		const yValues: number[] = [];
		for (let i = 0; i < 60; i++) {
			result.game.step();
			yValues.push(coin.position.y);
		}

		// Position should oscillate around baseY (100)
		const minY = Math.min(...yValues);
		const maxY = Math.max(...yValues);
		expect(maxY - minY).toBeGreaterThan(1); // Visible bob
		result.game.stop();
	});
});

describe("HealthPickup", () => {
	it("collected when health is below max", async () => {
		const result = await runArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const player = scene.findByType(Player)!;

		// Let player settle on floor
		for (let i = 0; i < 15; i++) {
			result.game.step();
		}

		// Damage the player first so health < max
		player.takeDamage(1);
		expect(gameState.health).toBe(2);

		// Wait for invincibility to pass (the mixin ticks it down)
		for (let i = 0; i < 120; i++) {
			result.game.step();
		}

		const pickup = scene.add(HealthPickup);
		pickup.position = player.position.clone();

		// Step for the overlap to fire
		for (let i = 0; i < 15; i++) {
			result.game.step();
		}

		expect(gameState.health).toBe(3);
		result.game.stop();
	});

	it("NOT collected when health is already at max", async () => {
		const result = await runArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const player = scene.findByType(Player)!;

		// Let player settle on floor
		for (let i = 0; i < 15; i++) {
			result.game.step();
		}

		expect(gameState.health).toBe(3); // Full health

		const pickup = scene.add(HealthPickup);
		pickup.position = player.position.clone();

		// Step for the overlap to fire
		for (let i = 0; i < 15; i++) {
			result.game.step();
		}

		// Health unchanged — pickup should still exist (not destroyed)
		expect(gameState.health).toBe(3);
		expect(scene.findByType(HealthPickup)).toBeDefined();
		result.game.stop();
	});
});
