import { assertDeterministic, InputScript, TestRunner } from "@quintus/test";
import { describe, expect, test } from "vitest";
import { Level1 } from "../scenes/level1.js";
import { loadPlatformerAssets, platformerPlugins, resetPlatformerState } from "./helpers.js";

const PLUGINS = platformerPlugins();

function runLevel1(input?: InputScript, duration?: number) {
	return TestRunner.run({
		scene: Level1,
		seed: 42,
		width: 320,
		height: 240,
		plugins: PLUGINS,
		input,
		duration,
		snapshotInterval: 1,
		setup: loadPlatformerAssets,
		beforeRun: resetPlatformerState,
	});
}

describe("Platformer — Player Movement", () => {
	test("player moves right when right is held", async () => {
		const result = await runLevel1(InputScript.create().press("right", 60));
		const startPlayer = result.timeline.findNode(0, "Player");
		const player = result.timeline.findNode(60, "Player");

		expect(startPlayer).not.toBeNull();
		expect(player).not.toBeNull();

		const startX = (startPlayer as Record<string, unknown> & { position: { x: number } }).position
			.x;
		const endX = (player as Record<string, unknown> & { position: { x: number } }).position.x;
		expect(endX).toBeGreaterThan(startX);

		result.game.stop();
	});

	test("player moves left when left is held", async () => {
		const result = await runLevel1(InputScript.create().press("left", 60));
		const startPlayer = result.timeline.findNode(0, "Player");
		const player = result.timeline.findNode(60, "Player");

		expect(startPlayer).not.toBeNull();
		expect(player).not.toBeNull();

		const startX = (startPlayer as Record<string, unknown> & { position: { x: number } }).position
			.x;
		const endX = (player as Record<string, unknown> & { position: { x: number } }).position.x;
		expect(endX).toBeLessThan(startX);

		result.game.stop();
	});

	test("player jumps when on floor and jump is tapped", async () => {
		const result = await runLevel1(
			InputScript.create()
				.wait(10) // Let player settle on floor
				.tap("jump"),
		);
		const player = result.timeline.findNode(result.totalFrames, "Player");
		expect(player).not.toBeNull();

		// After jumping, velocity.y should be negative (upward)
		const vel = (player as Record<string, unknown> & { velocity: { y: number } }).velocity;
		expect(vel.y).toBeLessThan(0);

		result.game.stop();
	});
});

describe("Platformer — Determinism", () => {
	test("same seed + same inputs = identical final state", async () => {
		await assertDeterministic(
			{
				scene: Level1,
				seed: 42,
				width: 320,
				height: 240,
				plugins: PLUGINS,
				input: InputScript.create()
					.press("right", 120)
					.tap("jump")
					.press("right", 60)
					.tap("jump")
					.press("right", 120),
				snapshotInterval: 0,
				setup: loadPlatformerAssets,
				beforeRun: resetPlatformerState,
			},
			3,
		);
	});

	test("different seeds both run successfully", async () => {
		const result1 = await TestRunner.run({
			scene: Level1,
			seed: 42,
			plugins: PLUGINS,
			duration: 3,
			snapshotInterval: 0,
			setup: loadPlatformerAssets,
			beforeRun: resetPlatformerState,
		});
		const result2 = await TestRunner.run({
			scene: Level1,
			seed: 99,
			plugins: PLUGINS,
			duration: 3,
			snapshotInterval: 0,
			setup: loadPlatformerAssets,
			beforeRun: resetPlatformerState,
		});

		expect(result1.totalFrames).toBe(result2.totalFrames);
		result1.game.stop();
		result2.game.stop();
	});
});

describe("Platformer — Enemies", () => {
	test("patrol enemies exist in level", async () => {
		const result = await runLevel1(undefined, 1);
		const enemies = result.timeline.findNodes(60, "enemy");
		expect(enemies.length).toBeGreaterThan(0);

		result.game.stop();
	});
});

describe("Platformer — Collectibles", () => {
	test("coins exist in level at start", async () => {
		const result = await runLevel1(undefined, 0.5);
		const coins = result.timeline.findNodes(0, "coin");
		expect(coins.length).toBeGreaterThan(0);

		result.game.stop();
	});
});
