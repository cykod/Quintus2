import { _resetNodeIdCounter } from "@quintus/core";
import { createHeadlessGame, type HeadlessGame } from "@quintus/headless";
import { getInput } from "@quintus/input";
import type { Vec2 } from "@quintus/math";
import { assertDeterministic, InputScript, type TestResult, TestRunner } from "@quintus/test";
import { describe, expect, it } from "vitest";
import {
	AMMO,
	AMMO_BONUS,
	DEFAULT_POWER,
	DIRECT_HIT_MULTIPLIER,
	GAME_HEIGHT,
	GAME_WIDTH,
	MIN_POWER,
	POWER_RATE,
	SEED,
	TARGET_COUNT,
	TARGET_POINTS,
} from "../config.js";
import { Target } from "../entities/target.js";
import { GameScene } from "../scenes/game-scene.js";
import { ResultsScene } from "../scenes/results-scene.js";
import { TitleScene } from "../scenes/title-scene.js";
import { gameState } from "../state.js";
import { artilleryPlugins } from "./helpers.js";

/** Physics (blast queries), input (scripted firing), audio (SFX call sites). */
const plugins = () => artilleryPlugins({ physics: true, input: true, audio: true });

/** Records detonation points so a test can assert the crater / derive the landing point. */
class InstrumentedScene extends GameScene {
	readonly detonations: Vec2[] = [];
	override onDetonate(point: Vec2): void {
		this.detonations.push(point);
		super.onDetonate(point);
	}
}

/**
 * No seeded targets — the shell falls into an empty field (loss playthrough), and
 * (via `InstrumentedScene`) records where a default shot lands so the win test can
 * derive the target position at runtime instead of hardcoding a seed-probed literal.
 */
class EmptyFieldScene extends InstrumentedScene {
	protected override placeTargets(): void {}
}

/**
 * Exactly one target, placed at a landing point captured at runtime (see the win
 * test). Because `placeTargets` draws no RNG here, the wind — and thus the flight —
 * matches the empty-field probe, so the shell detonates on the target for a
 * guaranteed direct hit. No hardcoded, seed-derived coordinate that silently rots
 * when an unrelated ballistics constant (gravity, power, cannon placement) changes.
 */
class OneTargetScene extends GameScene {
	/** Set by the win test from the probe run's captured detonation point. */
	static targetX = 0;
	static targetY = 0;
	protected override placeTargets(): void {
		const t = this.add(Target);
		t.position._set(OneTargetScene.targetX, OneTargetScene.targetY);
	}
	override onReady(): void {
		super.onReady();
		gameState.targetsRemaining = 1;
	}
}

function runScene(scene: typeof GameScene, input: InputScript): Promise<TestResult> {
	return TestRunner.run({
		scene,
		seed: SEED,
		width: GAME_WIDTH,
		height: GAME_HEIGHT,
		plugins: plugins(),
		input,
		beforeRun: () => {
			gameState.reset();
			_resetNodeIdCounter();
		},
		setup: (game: HeadlessGame) => {
			game.registerScenes({ results: ResultsScene });
		},
	});
}

/**
 * A single default shot: hold `fire` long enough to charge to DEFAULT_POWER, release,
 * then let the shell arc and land. Charging to DEFAULT_POWER reproduces the reference
 * arc the seed-tuned scoring/terrain/win assertions below depend on. (Power ramps from
 * MIN_POWER by POWER_RATE*dt per held frame after the first — see Cannon.onFixedUpdate.)
 */
const DEFAULT_POWER_FRAMES = Math.round((DEFAULT_POWER - MIN_POWER) / (POWER_RATE / 60)) + 1;
const singleShot = (): InputScript =>
	InputScript.create().press("fire", DEFAULT_POWER_FRAMES).wait(250);

describe("Artillery — integration", () => {
	it("is deterministic: two runs of the same input yield identical gameState singleton values", async () => {
		// Pins the module-singleton `gameState` (score, targetsRemaining) specifically.
		// `assertDeterministic` (next test) snapshots the scene TREE, which does not
		// capture the `gameState` singleton — so this is a distinct determinism surface.
		const r1 = await runScene(InstrumentedScene, singleShot());
		const score1 = gameState.score;
		const remaining1 = gameState.targetsRemaining;
		r1.game.stop();

		const r2 = await runScene(InstrumentedScene, singleShot());
		const score2 = gameState.score;
		const remaining2 = gameState.targetsRemaining;
		r2.game.stop();

		// Guard against a tautological pass: the default shot must actually score,
		// otherwise `0 === 0` / `6 === 6` would "pass" even on a mutual miss.
		expect(score1).toBeGreaterThan(0);
		expect(score2).toBe(score1);
		expect(remaining2).toBe(remaining1);
	});

	it("produces a bit-identical scene snapshot across runs (assertDeterministic)", async () => {
		await assertDeterministic(
			{
				scene: GameScene,
				seed: SEED,
				width: GAME_WIDTH,
				height: GAME_HEIGHT,
				plugins: plugins(),
				input: singleShot(),
				beforeRun: () => gameState.reset(),
				setup: (game: HeadlessGame) => {
					game.registerScenes({ results: ResultsScene });
				},
			},
			2,
		);
	});

	it("scoring playthrough: a default shot destroys at least one target and raises the score", async () => {
		const result = await runScene(InstrumentedScene, singleShot());
		expect(gameState.score).toBeGreaterThan(0);
		expect(gameState.targetsRemaining).toBeLessThan(TARGET_COUNT);
		result.game.stop();
	});

	it("terrain destruction: the impact point is no longer solid after the crater is carved", async () => {
		const result = await runScene(InstrumentedScene, singleShot());
		const scene = result.game.currentScene as InstrumentedScene;
		expect(scene.detonations.length).toBeGreaterThan(0);
		const impact = scene.detonations[0]!;
		expect(scene.terrain.isSolid(impact.x, impact.y)).toBe(false);
		result.game.stop();
	});

	it("lose path: exhausting ammo into an empty field ends on results with targets remaining", async () => {
		const input = InputScript.create();
		for (let i = 0; i < AMMO + 4; i++) input.tap("fire").wait(200);

		const result = await runScene(EmptyFieldScene, input);

		expect(result.game.currentScene).toBeInstanceOf(ResultsScene);
		expect(gameState.won).toBe(false);
		expect(gameState.ammo).toBe(0);
		expect(gameState.targetsRemaining).toBeGreaterThan(0);
		result.game.stop();
	});

	it("win bonus: clearing all targets adds the leftover-ammo bonus to the score", async () => {
		// Derive the landing point at runtime instead of hardcoding a seed-probed
		// coordinate: fire once into an empty field and capture where the default shot
		// detonates. Neither scene's `placeTargets` draws RNG, so the wind (and thus
		// the flight) is identical — the one-target run detonates at the same point,
		// with the target sitting exactly there for a guaranteed direct hit.
		const probe = await runScene(EmptyFieldScene, singleShot());
		const probeScene = probe.game.currentScene as EmptyFieldScene;
		expect(probeScene.detonations.length).toBeGreaterThan(0);
		const landing = probeScene.detonations[0]!;
		OneTargetScene.targetX = landing.x;
		OneTargetScene.targetY = landing.y;
		probe.game.stop();

		const result = await runScene(OneTargetScene, singleShot());

		expect(gameState.won).toBe(true);
		expect(result.game.currentScene).toBeInstanceOf(ResultsScene);
		// The guaranteed direct hit (target at the detonation point) doubles the
		// target's points; the win then adds AMMO_BONUS per unfired shell (AMMO - 1
		// remain after the single winning shot).
		expect(gameState.score).toBe(TARGET_POINTS * DIRECT_HIT_MULTIPLIER + (AMMO - 1) * AMMO_BONUS);
		result.game.stop();
	});
});

describe("Artillery — scene flow (real scenes)", () => {
	function makeGame(): HeadlessGame {
		const game = createHeadlessGame({
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			seed: SEED,
			plugins: plugins(),
		});
		game.registerScenes({ title: TitleScene, game: GameScene, results: ResultsScene });
		return game;
	}

	it("resets gameState on title entry, then ui_confirm starts a fresh game", () => {
		_resetNodeIdCounter();
		// Dirty the singleton first to prove TitleScene.onReady actually resets it
		// (the key Phase-6 correctness property for the play-again loop).
		gameState.score = 999;
		gameState.ammo = 0;
		gameState.targetsRemaining = 0;
		gameState.won = true;

		const game = makeGame();
		game.start("title");

		// TitleScene.onReady → gameState.reset(): the singleton is clean on entry.
		expect(game.currentScene).toBeInstanceOf(TitleScene);
		expect(gameState.score).toBe(0);
		expect(gameState.ammo).toBe(AMMO);
		expect(gameState.targetsRemaining).toBe(TARGET_COUNT);
		expect(gameState.won).toBe(false);

		// ui_confirm → GameScene, which builds a fresh round on top of the reset state.
		const input = getInput(game);
		input.inject("ui_confirm", true);
		game.step();
		input.inject("ui_confirm", false);
		game.step();

		expect(game.currentScene).toBeInstanceOf(GameScene);
		expect(gameState.score).toBe(0);
		expect(gameState.ammo).toBe(AMMO);
		expect(gameState.targetsRemaining).toBe(TARGET_COUNT);
		game.stop();
	});

	it("returns from a finished round's results to the title and resets there", () => {
		_resetNodeIdCounter();
		const game = makeGame();
		// Simulate a completed, won round carrying dirty leftover state.
		gameState.score = 500;
		gameState.ammo = 3;
		gameState.targetsRemaining = 0;
		gameState.won = true;

		game.start("results");
		expect(game.currentScene).toBeInstanceOf(ResultsScene);
		// Results must NOT reset — the round's outcome/score still reads on screen.
		expect(gameState.score).toBe(500);

		const input = getInput(game);
		input.inject("ui_confirm", true);
		game.step();
		input.inject("ui_confirm", false);
		game.step();

		// ResultsScene.onFixedUpdate → title; TitleScene.onReady → reset.
		expect(game.currentScene).toBeInstanceOf(TitleScene);
		expect(gameState.score).toBe(0);
		expect(gameState.ammo).toBe(AMMO);
		expect(gameState.targetsRemaining).toBe(TARGET_COUNT);
		expect(gameState.won).toBe(false);
		game.stop();
	});
});
