import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { Player } from "../entities/player.js";
import { ArenaScene } from "../scenes/arena-scene.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

describe("Player", () => {
	it("starts at center of arena", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		expect(player?.position.x).toBeCloseTo(GAME_WIDTH / 2, 0);
		expect(player?.position.y).toBeCloseTo(GAME_HEIGHT / 2, 0);
	});

	it("moves right when move_right is pressed", async () => {
		const result = await runScene(ArenaScene, InputScript.create().press("move_right", 30), 0.5);
		const player = result.game.currentScene?.findByType(Player);
		expect(player?.position.x).toBeGreaterThan(GAME_WIDTH / 2);
	});

	it("moves up when move_up is pressed", async () => {
		const result = await runScene(ArenaScene, InputScript.create().press("move_up", 30), 0.5);
		const player = result.game.currentScene?.findByType(Player);
		expect(player?.position.y).toBeLessThan(GAME_HEIGHT / 2);
	});

	it("taking damage reduces health", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();

		player?.takeDamage(30);
		expect(gameState.health).toBe(70);
	});

	it("emits died signal when health reaches zero", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();

		let didDie = false;
		player?.died.connect(() => {
			didDie = true;
		});

		player?.takeDamage(100);
		expect(didDie).toBe(true);
		expect(gameState.health).toBe(0);
	});
});
