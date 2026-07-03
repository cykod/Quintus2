import { AudioPlugin, InputPlugin, Label, PhysicsPlugin, Vec2 } from "quintus2";
import { TestRunner } from "quintus2/testing";
import { describe, expect, it } from "vitest";
import { COLLISION_GROUPS, GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS, TOTAL_COINS } from "../config.js";
import { Block } from "../entities/block.js";
import { Coin } from "../entities/coin.js";
import { Enemy } from "../entities/enemy.js";
import { Player } from "../entities/player.js";
import { Level1 } from "../scenes/level1.js";
import { WinScene } from "../scenes/win.js";
import { gameState } from "../state.js";

/** Shared plugin set for headless runs of the level. */
const plugins = () => [
	PhysicsPlugin({ gravity: new Vec2(0, 800), collisionGroups: COLLISION_GROUPS }),
	InputPlugin({ actions: INPUT_BINDINGS }),
	AudioPlugin(),
];

describe("Level1", () => {
	it("falls under gravity and lands on the floor", async () => {
		gameState.reset();
		const result = await TestRunner.run({
			scene: Level1,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: plugins(),
			duration: 1,
		});

		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		expect(player!.isOnFloor()).toBe(true);

		result.game.stop();
	});

	it("contains the full arena: coins, an enemy, and border/platform blocks", async () => {
		gameState.reset();
		const result = await TestRunner.run({
			scene: Level1,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: plugins(),
			duration: 0.2,
		});

		const scene = result.game.currentScene;
		expect(scene?.findAllByType(Coin)).toHaveLength(TOTAL_COINS);
		expect(scene?.findAllByType(Enemy)).toHaveLength(1);
		// Floor + 2 walls + 3 platforms = 6 solid blocks.
		expect(scene?.findAllByType(Block).length).toBe(6);

		result.game.stop();
	});
});

describe("WinScene", () => {
	it("shows a 'You Win!' message", async () => {
		gameState.reset();
		const result = await TestRunner.run({
			scene: WinScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: plugins(),
			duration: 0.1,
		});

		const labels = result.game.currentScene?.findAllByType(Label) ?? [];
		expect(labels.some((l) => l.text === "You Win!")).toBe(true);

		result.game.stop();
	});
});
