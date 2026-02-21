import { createHeadlessGame } from "@quintus/headless";
import { getInput } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { assertDeterministic, InputScript } from "@quintus/test";
import { describe, expect, test } from "vitest";
import { Chest } from "../entities/chest.js";
import { Door } from "../entities/door.js";
import { Player } from "../entities/player.js";
import { PotionPickup } from "../entities/potion-pickup.js";
import { Level1 } from "../scenes/level1.js";
import { Level2 } from "../scenes/level2.js";
import { Level3 } from "../scenes/level3.js";
import { TitleScene } from "../scenes/title-scene.js";
import {
	dungeonPlugins,
	loadDungeonAssets,
	resetDungeonState,
	runScene,
} from "./helpers.js";

const PLUGINS_IMPORT = await import("./helpers.js").then((m) => m.dungeonPlugins());

describe("Dungeon — Scene Flow", () => {
	test("title scene loads", async () => {
		const result = await runScene(TitleScene, undefined, 0.5);
		expect(result.totalFrames).toBeGreaterThan(0);
		result.game.stop();
	});

	test("level 1 loads and is playable", async () => {
		const result = await runScene(Level1, undefined, 0.5);
		const player = result.timeline.findNode(0, "Player");
		expect(player).not.toBeNull();
		result.game.stop();
	});

	test("level 2 loads", async () => {
		const result = await runScene(Level2, undefined, 0.5);
		const player = result.timeline.findNode(0, "Player");
		expect(player).not.toBeNull();
		result.game.stop();
	});

	test("level 3 loads", async () => {
		const result = await runScene(Level3, undefined, 0.5);
		const player = result.timeline.findNode(0, "Player");
		expect(player).not.toBeNull();
		result.game.stop();
	});

	test("spawnObjects auto-applies Tiled properties to Chest", async () => {
		const result = await runScene(Level1, undefined, 0.5);
		// Level1 has a Chest with lootType="sword", lootTier=0
		const chest = result.game.currentScene?.findByType(Chest);
		expect(chest).not.toBeNull();
		expect(chest!.lootType).toBe("sword");
		expect(chest!.lootTier).toBe(0);
		result.game.stop();
	});

	test("spawnObjects auto-applies potionType to PotionPickup", async () => {
		const result = await runScene(Level2, undefined, 0.5);
		const potion = result.game.currentScene?.findByType(PotionPickup);
		expect(potion).not.toBeNull();
		expect(potion!.potionType).toBe("speed");
		result.game.stop();
	});

	test("door entity exists with correct nextScene", async () => {
		const result = await runScene(Level1, undefined, 0.5);
		const scene = result.game.currentScene!;
		const door = scene.findByType(Door);
		expect(door).not.toBeNull();
		expect(door!.nextScene).toBe("level2");
		expect(door!.locked).toBe(false);
		// Verify the door is in the tree and has a collision shape
		expect(door!.isInsideTree).toBe(true);
		expect(door!.getShapes().length).toBeGreaterThan(0);
		result.game.stop();
	});

	test("door interact triggers scene transition", async () => {
		resetDungeonState();
		const game = createHeadlessGame({
			width: 320,
			height: 240,
			seed: 42,
			plugins: dungeonPlugins(),
		});
		await loadDungeonAssets(game);
		// Register scenes so switchTo("level2") works
		game.registerScene("level2", Level2);
		game.start(Level1);

		const scene = game.currentScene!;
		const player = scene.findByType(Player)!;
		const door = scene.findByType(Door)!;
		const input = getInput(game)!;

		expect(player).not.toBeNull();
		expect(door).not.toBeNull();
		expect(door.nextScene).toBe("level2");

		// Teleport player to door position
		player.position = new Vec2(door.globalPosition.x, door.globalPosition.y);

		// Step several frames so physics overlap detection kicks in
		for (let i = 0; i < 5; i++) game.step();

		// Verify player is in range (bodyEntered should have fired)
		// We can't directly check _playerInRange since it's private,
		// so we just press interact and see what happens
		input.inject("interact", true);
		game.step();
		input.inject("interact", false);

		// Step past the 0.6s animation delay (at 60fps = 36 frames)
		for (let i = 0; i < 40; i++) game.step();

		// Scene should have switched to Level2
		expect(game.currentScene).not.toBe(scene);

		game.stop();
	});

	test("all three levels run sequentially without crash", async () => {
		for (const SceneClass of [Level1, Level2, Level3]) {
			const result = await runScene(SceneClass, undefined, 0.5);
			expect(result.totalFrames).toBeGreaterThan(0);
			result.game.stop();
		}
	});

	test("deterministic: same inputs produce same state", async () => {
		await assertDeterministic(
			{
				scene: Level1,
				seed: 42,
				width: 320,
				height: 240,
				plugins: PLUGINS_IMPORT,
				input: InputScript.create()
					.press("right", 60)
					.press("down", 30)
					.tap("attack")
					.press("right", 60),
				snapshotInterval: 0,
				setup: loadDungeonAssets,
				beforeRun: resetDungeonState,
			},
			3,
		);
	});
});
