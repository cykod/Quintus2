import { _resetNodeIdCounter, Scene } from "@quintus/core";
import type { HeadlessGame } from "@quintus/headless";
import { Vec2 } from "@quintus/math";
import { TestRunner } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { AMMO_BONUS, GAME_HEIGHT, GAME_WIDTH, MAX_WIND, TARGET_POINTS } from "../config.js";
import { Target } from "../entities/target.js";
import { GameScene } from "../scenes/game-scene.js";
import { gameState } from "../state.js";
import { artilleryPlugins } from "./helpers.js";

// onDetonate/onFire play SFX (audio) and run blast queries (physics).
const PLUGINS = artilleryPlugins({ physics: true, audio: true });

/** Placeholder so `afterShot()`'s `switchTo("results")` resolves in tests. */
class StubResultsScene extends Scene {}

/** GameScene without auto target placement — tests place targets by hand. */
class ScoringScene extends GameScene {
	protected override placeTargets(): void {}
}

async function makeScene() {
	const result = await TestRunner.run({
		scene: ScoringScene,
		seed: 1337,
		width: GAME_WIDTH,
		height: GAME_HEIGHT,
		plugins: PLUGINS,
		duration: 0,
		beforeRun: () => {
			gameState.reset();
			_resetNodeIdCounter();
		},
		setup: (game: HeadlessGame) => {
			game.registerScenes({ results: StubResultsScene });
		},
	});
	return result;
}

function addTarget(scene: ScoringScene, x: number, y: number): Target {
	const t = scene.add(Target);
	t.position._set(x, y);
	return t;
}

describe("Scoring — blast resolution", () => {
	it("scores single points for a target inside BLAST_RADIUS but outside DIRECT_HIT_RADIUS", async () => {
		const result = await makeScene();
		const scene = result.game.currentScene as ScoringScene;
		const target = addTarget(scene, 400, 300);
		const scoreBefore = gameState.score;
		const remainingBefore = gameState.targetsRemaining;

		scene.onDetonate(new Vec2(425, 300)); // 25px from center: < BLAST(44), > DIRECT(14)

		expect(gameState.score).toBe(scoreBefore + TARGET_POINTS);
		expect(gameState.targetsRemaining).toBe(remainingBefore - 1);
		expect(target.isDestroyed).toBe(true);
	});

	it("doubles points for a direct hit inside DIRECT_HIT_RADIUS", async () => {
		const result = await makeScene();
		const scene = result.game.currentScene as ScoringScene;
		addTarget(scene, 400, 300);
		const scoreBefore = gameState.score;

		scene.onDetonate(new Vec2(410, 300)); // 10px from center: <= DIRECT(14)

		expect(gameState.score).toBe(scoreBefore + TARGET_POINTS * 2);
	});

	it("leaves score and target count unchanged with no target in range", async () => {
		const result = await makeScene();
		const scene = result.game.currentScene as ScoringScene;
		addTarget(scene, 400, 300);
		const scoreBefore = gameState.score;
		const remainingBefore = gameState.targetsRemaining;

		scene.onDetonate(new Vec2(100, 100)); // far from the only target

		expect(gameState.score).toBe(scoreBefore);
		expect(gameState.targetsRemaining).toBe(remainingBefore);
		expect(scene.findAllByType(Target).length).toBe(1);
	});

	it("destroys and scores two targets caught in one blast", async () => {
		const result = await makeScene();
		const scene = result.game.currentScene as ScoringScene;
		const t1 = addTarget(scene, 400, 300);
		const t2 = addTarget(scene, 430, 300);
		const scoreBefore = gameState.score;
		const remainingBefore = gameState.targetsRemaining;

		scene.onDetonate(new Vec2(415, 300)); // 15px from each: both < BLAST, both > DIRECT

		expect(gameState.score).toBe(scoreBefore + TARGET_POINTS * 2);
		expect(gameState.targetsRemaining).toBe(remainingBefore - 2);
		expect(t1.isDestroyed).toBe(true);
		expect(t2.isDestroyed).toBe(true);
	});
});

describe("Scoring — self-destruct", () => {
	it("ends the round immediately as a loss when a shell detonates on the cannon", async () => {
		const result = await makeScene();
		const scene = result.game.currentScene as ScoringScene;
		addTarget(scene, 400, 300); // a distant target must not save the player
		const cannon = scene.cannon.position;

		scene.onDetonate(new Vec2(cannon.x, cannon.y));

		expect(gameState.selfDestruct).toBe(true);
		expect(gameState.won).toBe(false);
		expect(result.game.currentScene).toBeInstanceOf(StubResultsScene);
	});

	it("does not self-destruct for a shot that lands well away from the cannon", async () => {
		const result = await makeScene();
		const scene = result.game.currentScene as ScoringScene;
		addTarget(scene, 400, 300);

		scene.onDetonate(new Vec2(400, 300)); // on the target, far from the cannon

		expect(gameState.selfDestruct).toBe(false);
		expect(result.game.currentScene).toBe(scene); // round continues, no switch
	});
});

describe("Scoring — afterShot branches", () => {
	it("wins, adds the leftover-ammo bonus, and requests results when all targets are cleared", async () => {
		const result = await makeScene();
		const scene = result.game.currentScene as ScoringScene;
		gameState.targetsRemaining = 0;
		gameState.ammo = 3;
		const scoreBefore = gameState.score;

		scene.afterShot();

		expect(gameState.won).toBe(true);
		expect(gameState.score).toBe(scoreBefore + 3 * AMMO_BONUS);
		expect(result.game.currentScene).toBeInstanceOf(StubResultsScene);
	});

	it("loses and requests results when ammo runs out with targets remaining", async () => {
		const result = await makeScene();
		const scene = result.game.currentScene as ScoringScene;
		gameState.targetsRemaining = 2;
		gameState.ammo = 0;

		scene.afterShot();

		expect(gameState.won).toBe(false);
		expect(result.game.currentScene).toBeInstanceOf(StubResultsScene);
	});

	it("continues the round: re-rolls wind in range and restores canFire", async () => {
		const result = await makeScene();
		const scene = result.game.currentScene as ScoringScene;
		gameState.targetsRemaining = 3;
		gameState.ammo = 5;
		scene.cannon.canFire = false;

		scene.afterShot();

		expect(scene.cannon.canFire).toBe(true);
		expect(gameState.wind).toBeGreaterThanOrEqual(-MAX_WIND);
		expect(gameState.wind).toBeLessThanOrEqual(MAX_WIND);
		expect(result.game.currentScene).toBe(scene); // no scene switch
	});

	it("re-rolls wind deterministically for the same seed", async () => {
		const runContinue = async (): Promise<number> => {
			const result = await makeScene();
			const scene = result.game.currentScene as ScoringScene;
			gameState.targetsRemaining = 3;
			gameState.ammo = 5;
			scene.afterShot();
			return gameState.wind;
		};
		expect(await runContinue()).toBe(await runContinue());
	});
});
