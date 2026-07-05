import { _resetNodeIdCounter } from "@quintus/core";
import type { SeededRandom } from "@quintus/math";
import { TestRunner } from "@quintus/test";
import { describe, expect, it } from "vitest";
import {
	GAME_HEIGHT,
	GAME_WIDTH,
	SEED,
	TARGET_COUNT,
	TARGET_MAX_X,
	TARGET_MIN_SPACING,
	TARGET_MIN_X,
	TARGET_RADIUS,
} from "../config.js";
import { Target } from "../entities/target.js";
import { GameScene } from "../scenes/game-scene.js";
import { gameState } from "../state.js";
import { Terrain } from "../terrain/terrain.js";
import { artilleryPlugins } from "./helpers.js";

const PLUGINS = artilleryPlugins({ physics: true });

async function runGameScene() {
	return TestRunner.run({
		scene: GameScene,
		seed: SEED,
		width: GAME_WIDTH,
		height: GAME_HEIGHT,
		plugins: PLUGINS,
		duration: 0,
		beforeRun: () => {
			gameState.reset();
			_resetNodeIdCounter();
		},
	});
}

describe("Target placement", () => {
	it("places TARGET_COUNT targets", async () => {
		const result = await runGameScene();
		const targets = result.game.currentScene!.findAllByType(Target);
		expect(targets.length).toBe(TARGET_COUNT);
	});

	it("rests every target on the terrain surface", async () => {
		const result = await runGameScene();
		const scene = result.game.currentScene as GameScene;
		for (const target of scene.findAllByType(Target)) {
			const x = target.position.x;
			const surfaceY = scene.terrain.surfaceY(x);
			// Placed so the crate's bottom sits on the topmost solid row.
			expect(target.position.y).toBe(surfaceY - TARGET_RADIUS);
			// Solid just at/below the surface, empty just above it.
			expect(scene.terrain.isSolid(x, surfaceY)).toBe(true);
			expect(scene.terrain.isSolid(x, surfaceY - 1)).toBe(false);
		}
	});

	it("respects the minimum spacing between target centers", async () => {
		const result = await runGameScene();
		const xs = result.game
			.currentScene!.findAllByType(Target)
			.map((t) => t.position.x)
			.sort((a, b) => a - b);
		for (let i = 1; i < xs.length; i++) {
			expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(TARGET_MIN_SPACING);
		}
	});

	it("is deterministic across runs with the same seed", async () => {
		const positionsFor = async (): Promise<Array<[number, number]>> => {
			const result = await runGameScene();
			return result.game
				.currentScene!.findAllByType(Target)
				.map((t) => [t.position.x, t.position.y] as [number, number]);
		};
		expect(await positionsFor()).toEqual(await positionsFor());
	});
});

/**
 * Forces the placement fallback branch: a degenerate RNG that returns the SAME
 * column on every draw, so after the first target every random candidate
 * collides on TARGET_MIN_SPACING, all attempts are exhausted, and targets 2..N
 * are placed by the deterministic evenly-spaced fallback.
 */
class FallbackScene extends GameScene {
	override onReady(): void {
		this.terrain = new Terrain(GAME_WIDTH, GAME_HEIGHT);
		this.add(this.terrain);
		this.terrain.generate(this.game.random.fork("artillery"));
		const fixedX = Math.floor((TARGET_MIN_X + TARGET_MAX_X) / 2);
		const stubRng = { int: () => fixedX } as unknown as SeededRandom;
		this.placeTargets(this.terrain, stubRng);
	}
}

describe("Target placement — deterministic fallback", () => {
	async function runFallback() {
		return TestRunner.run({
			scene: FallbackScene,
			seed: SEED,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0,
			beforeRun: () => {
				gameState.reset();
				_resetNodeIdCounter();
			},
		});
	}

	it("still places TARGET_COUNT targets, in-range and on-surface, when attempts are exhausted", async () => {
		const result = await runFallback();
		const scene = result.game.currentScene as GameScene;
		const targets = scene.findAllByType(Target);
		expect(targets.length).toBe(TARGET_COUNT);
		for (const target of targets) {
			const x = target.position.x;
			// Fallback columns stay strictly inside the target band.
			expect(x).toBeGreaterThanOrEqual(TARGET_MIN_X);
			expect(x).toBeLessThanOrEqual(TARGET_MAX_X);
			// And still rest on the terrain surface, like the random path.
			const surfaceY = scene.terrain.surfaceY(x);
			expect(target.position.y).toBe(surfaceY - TARGET_RADIUS);
			expect(scene.terrain.isSolid(x, surfaceY)).toBe(true);
			expect(scene.terrain.isSolid(x, surfaceY - 1)).toBe(false);
		}
	});

	it("is deterministic on the fallback path across runs", async () => {
		const xsFor = async (): Promise<number[]> =>
			(await runFallback()).game.currentScene!.findAllByType(Target).map((t) => t.position.x);
		expect(await xsFor()).toEqual(await xsFor());
	});
});
