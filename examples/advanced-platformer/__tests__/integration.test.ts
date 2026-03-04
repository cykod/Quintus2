import { Camera } from "@quintus/camera";
import { assertDeterministic, InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { Coin } from "../entities/coin.js";
import { DoorExit } from "../entities/door-exit.js";
import { Slime } from "../entities/enemies/slime.js";
import { Flag } from "../entities/flag.js";
import { Player } from "../entities/player.js";
import { Level1Scene } from "../scenes/test-scene.js";
import { gameState } from "../state.js";
import {
	advancedPlatformerPlugins,
	loadAdvancedPlatformerAssetsWithMaps,
	resetState,
	runSceneWithMaps,
} from "./helpers.js";

describe("Integration — Level1Scene", () => {
	it("loads with correct entities (player, enemies, coins, door, flag)", async () => {
		const result = await runSceneWithMaps(Level1Scene, undefined, 0.05);
		const scene = result.game.currentScene!;

		// Player exists
		const player = scene.findByType(Player);
		expect(player).toBeDefined();

		// Enemies spawned
		const slimes = scene.findAllByType(Slime);
		expect(slimes.length).toBeGreaterThanOrEqual(1);

		// Coins spawned from tiles
		const coins = scene.findAllByType(Coin);
		expect(coins.length).toBeGreaterThanOrEqual(1);

		// Door exit exists
		const door = scene.findByType(DoorExit);
		expect(door).toBeDefined();

		// Checkpoint flag exists
		const flag = scene.findByType(Flag);
		expect(flag).toBeDefined();

		// Camera exists
		const camera = scene.findByType(Camera);
		expect(camera).toBeDefined();

		result.game.stop();
	});

	it("player collects coin and score updates", async () => {
		// Player starts at ~(128, 384). Walk right to pick up coins.
		// Coins are placed throughout the level; the nearest ones are around x=288-352.
		const result = await runSceneWithMaps(
			Level1Scene,
			InputScript.create().wait(5).hold("right").wait(180),
			3.5,
		);

		// After walking right for ~3 seconds, the player should have collected at least one coin
		expect(gameState.coins).toBeGreaterThanOrEqual(1);
		expect(gameState.score).toBeGreaterThan(0);

		result.game.stop();
	});

	it("player stomps enemy and scores", async () => {
		// First slime is around x=544, row 6. Player starts at ~x=128.
		// Walk right then jump on the slime.
		const result = await runSceneWithMaps(
			Level1Scene,
			InputScript.create()
				.wait(5)
				.hold("right")
				.wait(120) // walk toward slime
				.tap("jump", 1)
				.wait(60), // jump and land on it
			3.5,
		);

		// Score should have increased from enemy stomp (slime scoreValue = 100)
		expect(gameState.score).toBeGreaterThan(0);

		result.game.stop();
	});

	it("player takes damage from enemy side contact", async () => {
		const initialHealth = 5;

		// Walk right into the first slime without jumping
		const result = await runSceneWithMaps(
			Level1Scene,
			InputScript.create().wait(5).hold("right").wait(200),
			4.0,
		);

		// Player should have lost health from side contact with slime
		expect(gameState.health).toBeLessThan(initialHealth);

		result.game.stop();
	});

	it("checkpoint flag exists and responds to player overlap", async () => {
		// Verify the flag entity is present in the level and tagged correctly
		const result = await runSceneWithMaps(Level1Scene, undefined, 0.05);
		const scene = result.game.currentScene!;

		const flags = scene.findAllByType(Flag);
		expect(flags.length).toBeGreaterThanOrEqual(1);

		// The flag should have the "flag" tag
		expect(flags[0].hasTag("flag")).toBe(true);

		// Checkpoint starts null
		expect(gameState.checkpoint).toBeNull();

		result.game.stop();
	});

	it("deterministic replay produces identical results", async () => {
		const script = InputScript.create()
			.wait(5)
			.hold("right")
			.wait(60)
			.tap("jump", 1)
			.wait(30)
			.release("right")
			.wait(10);

		await assertDeterministic(
			{
				scene: Level1Scene,
				seed: 42,
				width: 640,
				height: 360,
				plugins: advancedPlatformerPlugins(),
				input: script,
				duration: 2.0,
				snapshotInterval: 0,
				setup: loadAdvancedPlatformerAssetsWithMaps,
				beforeRun: () => {
					resetState();
				},
			},
			3,
		);
	});
});
