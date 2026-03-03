import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { Coin } from "../entities/coin.js";
import { Gem } from "../entities/gem.js";
import { HeartPickup } from "../entities/heart-pickup.js";
import { Player } from "../entities/player.js";
import { PowerUp } from "../entities/power-up.js";
import { gameState } from "../state.js";
import { CoinArena, GemArena, HeartArena, PowerUpArena, runScene } from "./helpers.js";

describe("Collectibles", () => {
	describe("Coin", () => {
		it("awards coins and score when collected", async () => {
			// Walk right into the coin
			const result = await runScene(
				CoinArena,
				InputScript.create().wait(10).hold("right").wait(120),
				2.5,
			);

			const scene = result.game.currentScene!;
			const coins = scene.findAllByType(Coin);

			// Coin should have been collected (destroyed)
			expect(coins.length).toBe(0);
			expect(gameState.coins).toBeGreaterThanOrEqual(1);
			expect(gameState.score).toBeGreaterThanOrEqual(100);

			result.game.stop();
		});

		it("has collectible and coin tags", async () => {
			const result = await runScene(CoinArena, undefined, 0.1);
			const coin = result.game.currentScene!.findByType(Coin)!;

			expect(coin.hasTag("collectible")).toBe(true);
			expect(coin.hasTag("coin")).toBe(true);

			result.game.stop();
		});
	});

	describe("Gem", () => {
		it("awards score when collected", async () => {
			const result = await runScene(
				GemArena,
				InputScript.create().wait(10).hold("right").wait(120),
				2.5,
			);

			const scene = result.game.currentScene!;
			const gems = scene.findAllByType(Gem);

			expect(gems.length).toBe(0);
			expect(gameState.score).toBeGreaterThanOrEqual(100);

			result.game.stop();
		});

		it("has collectible and gem tags", async () => {
			const result = await runScene(GemArena, undefined, 0.1);
			const gem = result.game.currentScene!.findByType(Gem)!;

			expect(gem.hasTag("collectible")).toBe(true);
			expect(gem.hasTag("gem")).toBe(true);

			result.game.stop();
		});
	});

	describe("HeartPickup", () => {
		it("heals the player when collected", async () => {
			const result = await runScene(
				HeartArena,
				InputScript.create().wait(10).hold("right").wait(120),
				2.5,
				() => {
					gameState.health = 3;
				},
			);

			const scene = result.game.currentScene!;
			const player = scene.findByType(Player)!;
			const hearts = scene.findAllByType(HeartPickup);

			// Heart should be collected
			expect(hearts.length).toBe(0);
			// Player should have been healed (health synced to gameState)
			expect(player.health).toBeGreaterThanOrEqual(4);

			result.game.stop();
		});

		it("has collectible and heart tags", async () => {
			const result = await runScene(HeartArena, undefined, 0.1);
			const heart = result.game.currentScene!.findByType(HeartPickup)!;

			expect(heart.hasTag("collectible")).toBe(true);
			expect(heart.hasTag("heart")).toBe(true);

			result.game.stop();
		});
	});

	describe("PowerUp", () => {
		it("grants star power when collected", async () => {
			const result = await runScene(
				PowerUpArena,
				InputScript.create().wait(10).hold("right").wait(120),
				2.5,
			);

			const scene = result.game.currentScene!;
			const player = scene.findByType(Player)!;
			const powerUps = scene.findAllByType(PowerUp);

			expect(powerUps.length).toBe(0);
			expect(player.hasStarPower).toBe(true);
			expect(gameState.starPower).toBe(true);
			expect(gameState.score).toBeGreaterThanOrEqual(500);

			result.game.stop();
		});

		it("has collectible and powerup tags", async () => {
			const result = await runScene(PowerUpArena, undefined, 0.1);
			const powerUp = result.game.currentScene!.findByType(PowerUp)!;

			expect(powerUp.hasTag("collectible")).toBe(true);
			expect(powerUp.hasTag("powerup")).toBe(true);

			result.game.stop();
		});
	});
});
