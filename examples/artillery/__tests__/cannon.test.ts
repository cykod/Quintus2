import { _resetNodeIdCounter, Scene } from "@quintus/core";
import type { Vec2 } from "@quintus/math";
import { InputScript, TestRunner } from "@quintus/test";
import { describe, expect, it } from "vitest";
import {
	ANGLE_RATE,
	CANNON_X,
	DEFAULT_ANGLE,
	DEFAULT_POWER,
	GAME_HEIGHT,
	GAME_WIDTH,
	MAX_ANGLE,
	MAX_POWER,
	MIN_ANGLE,
	MIN_POWER,
	POWER_RATE,
} from "../config.js";
import { Cannon } from "../entities/cannon.js";
import { gameState } from "../state.js";
import { artilleryPlugins } from "./helpers.js";

const DT = 1 / 60;
const PLUGINS = artilleryPlugins({ input: true });

/** Minimal scene holding a single cannon and recording every `fired` velocity. */
class CannonTestScene extends Scene {
	cannon!: Cannon;
	readonly firedVelocities: Vec2[] = [];
	/** Overridable by subclasses to start the cannon with firing disabled. */
	protected initialCanFire = true;

	override onReady(): void {
		this.cannon = this.add(Cannon);
		this.cannon.position._set(CANNON_X, GAME_HEIGHT - 60);
		this.cannon.canFire = this.initialCanFire;
		this.cannon.fired.connect(({ velocity }) => this.firedVelocities.push(velocity));
	}
}

/** Same scene, but the cannon cannot fire — for testing the `canFire` guard. */
class NoFireScene extends CannonTestScene {
	protected override initialCanFire = false;
}

function run(
	input: InputScript,
	duration?: number,
	scene: typeof CannonTestScene = CannonTestScene,
) {
	return TestRunner.run({
		scene,
		seed: 1337,
		width: GAME_WIDTH,
		height: GAME_HEIGHT,
		plugins: PLUGINS,
		input,
		duration,
		beforeRun: () => {
			gameState.reset();
			_resetNodeIdCounter();
		},
	});
}

function getScene(result: Awaited<ReturnType<typeof run>>): CannonTestScene {
	return result.game.currentScene as CannonTestScene;
}

/** Frames to hold `fire` to charge to a given power. The first held frame seeds
 *  MIN_POWER, each subsequent held frame ramps by POWER_RATE*dt, and the shot fires
 *  on the frame after release — so N held frames yield MIN_POWER + (N-1)*POWER_RATE*dt. */
const framesForPower = (power: number): number =>
	Math.round((power - MIN_POWER) / (POWER_RATE * DT)) + 1;

const magnitude = (v: Vec2): number => Math.hypot(v.x, v.y);

describe("Cannon", () => {
	it("raises angle while aim_raise is held, by ≈ ANGLE_RATE * frames * dt", async () => {
		const frames = 30;
		const scene = getScene(await run(InputScript.create().press("aim_raise", frames), 1));
		const expected = DEFAULT_ANGLE + ANGLE_RATE * frames * DT;
		expect(scene.cannon.angle).toBeCloseTo(expected, 1);
		expect(scene.cannon.angle).toBeLessThanOrEqual(MAX_ANGLE);
		expect(scene.cannon.angle).toBeGreaterThan(DEFAULT_ANGLE);
	});

	it("clamps angle to MAX_ANGLE when aim_raise is held long enough", async () => {
		const scene = getScene(await run(InputScript.create().press("aim_raise", 200), 4));
		expect(scene.cannon.angle).toBe(MAX_ANGLE);
	});

	it("clamps angle to MIN_ANGLE when aim_lower is held long enough", async () => {
		const scene = getScene(await run(InputScript.create().press("aim_lower", 200), 4));
		expect(scene.cannon.angle).toBe(MIN_ANGLE);
	});

	it("fires a minimum-power shell on a quick tap, aimed along the current angle", async () => {
		const scene = getScene(await run(InputScript.create().tap("fire").wait(20), 1));
		expect(scene.firedVelocities).toHaveLength(1);
		const v = scene.firedVelocities[0]!;
		// A 1-frame tap barely charges: fires at ~MIN_POWER along the default angle.
		expect(magnitude(v)).toBeGreaterThanOrEqual(MIN_POWER);
		expect(magnitude(v)).toBeLessThan(MIN_POWER + 30);
		expect(Math.atan2(-v.y, v.x)).toBeCloseTo(DEFAULT_ANGLE, 5);
	});

	it("charges a stronger shot the longer fire is held, then fires on release", async () => {
		const frames = framesForPower(DEFAULT_POWER);
		const scene = getScene(await run(InputScript.create().press("fire", frames).wait(20), 2));
		expect(scene.firedVelocities).toHaveLength(1);
		expect(magnitude(scene.firedVelocities[0]!)).toBeCloseTo(DEFAULT_POWER, 0);
	});

	it("clamps the charged power at MAX_POWER for a long hold", async () => {
		const scene = getScene(await run(InputScript.create().press("fire", 200).wait(10), 4));
		expect(scene.firedVelocities).toHaveLength(1);
		expect(magnitude(scene.firedVelocities[0]!)).toBeCloseTo(MAX_POWER, 5);
	});

	it("charges while held without firing, mirroring the rising power into gameState", async () => {
		// Fire stays held for the whole (short) run — the shell charges but is never released.
		const scene = getScene(await run(InputScript.create().press("fire", 60), 0.25));
		expect(scene.firedVelocities).toHaveLength(0);
		expect(scene.cannon.power).toBeGreaterThan(MIN_POWER);
		expect(scene.cannon.power).toBeLessThan(MAX_POWER);
		expect(gameState.power).toBe(scene.cannon.power);
	});

	it("does not fire when canFire is false", async () => {
		const scene = getScene(
			await run(InputScript.create().press("fire", 20).wait(20), 1, NoFireScene),
		);
		expect(scene.firedVelocities).toHaveLength(0);
	});

	it("mirrors angle into gameState after an update", async () => {
		const scene = getScene(await run(InputScript.create().press("aim_raise", 10), 1));
		expect(gameState.angle).toBe(scene.cannon.angle);
		expect(gameState.angle).toBeGreaterThan(DEFAULT_ANGLE);
	});
});
