import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("./__test-utils__/three-mock.js"));

import { Game, Scene } from "@quintus/core";
import { ActionQueue, easeInOutQuad, linear } from "./action-queue.js";
import { Node3D } from "./node3d.js";
import { ThreePlugin } from "./three-plugin.js";

vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
	GLTFLoader: class {
		loadAsync() {
			return Promise.resolve({});
		}
	},
}));

function createGame(): Game {
	const game = new Game({ width: 800, height: 600, renderer: null });
	game.use(ThreePlugin());
	return game;
}

describe("ActionQueue", () => {
	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("is not running when empty", () => {
		const queue = new ActionQueue();
		expect(queue.isRunning).toBe(false);
	});

	it("moveTo interpolates position over time", () => {
		const game = createGame();

		let queue!: ActionQueue;
		let target!: Node3D;

		class TestScene extends Scene {
			onReady() {
				target = this.add(Node3D);
				target.position.set(0, 0, 0);
				queue = this.add(ActionQueue, { target });
			}
		}
		game.start(TestScene);

		queue.play(0, (q) => q.moveTo({ x: 10, y: 0, z: 0 }, 1, linear));
		expect(queue.isRunning).toBe(true);

		// Advance half way (dt=0.5 at 60fps, but onFixedUpdate gets dt)
		// Actually the game.step() calls onFixedUpdate with the fixed timestep
		// Let's manually call onFixedUpdate
		queue.onFixedUpdate(0.5);
		expect(target.position.x).toBeCloseTo(5, 1);

		queue.onFixedUpdate(0.5);
		expect(target.position.x).toBeCloseTo(10, 1);
		expect(queue.isRunning).toBe(false);
	});

	it("rotateTo uses shortest path", () => {
		const target = new Node3D();
		target.rotation.y = Math.PI * 0.9; // close to PI

		const queue = new ActionQueue();
		queue.target = target;

		queue.play(0, (q) => q.rotateTo(-Math.PI * 0.9, 1, linear));
		queue.onFixedUpdate(0.5);

		// Should go through PI (short way), not through 0 (long way)
		// Start: 0.9*PI, End: -0.9*PI. Delta should be +0.2*PI (through PI), not -1.8*PI
		expect(Math.abs(target.rotation.y)).toBeGreaterThan(Math.PI * 0.8);
	});

	it("scaleTo with uniform number", () => {
		const target = new Node3D();
		target.scale.set(1, 1, 1);

		const queue = new ActionQueue();
		queue.target = target;

		queue.play(0, (q) => q.scaleTo(2, 1, linear));
		queue.onFixedUpdate(1);

		expect(target.scale.x).toBeCloseTo(2);
		expect(target.scale.y).toBeCloseTo(2);
		expect(target.scale.z).toBeCloseTo(2);
	});

	it("wait delays next step", () => {
		const target = new Node3D();
		target.position.set(0, 0, 0);

		const queue = new ActionQueue();
		queue.target = target;

		queue.play(0, (q) => q.wait(0.5).moveTo({ x: 10, y: 0, z: 0 }, 0.5, linear));

		queue.onFixedUpdate(0.5); // wait completes
		expect(target.position.x).toBeCloseTo(0); // move hasn't started yet

		queue.onFixedUpdate(0.5); // move completes
		expect(target.position.x).toBeCloseTo(10);
	});

	it("parallel runs steps concurrently", () => {
		const target = new Node3D();
		target.position.set(0, 0, 0);
		target.scale.set(1, 1, 1);

		const queue = new ActionQueue();
		queue.target = target;

		queue.play(0, (q) =>
			q.parallel(
				(q2) => q2.moveTo({ x: 10, y: 0, z: 0 }, 1, linear),
				(q2) => q2.scaleTo(2, 1, linear),
			),
		);

		queue.onFixedUpdate(1);
		expect(target.position.x).toBeCloseTo(10);
		expect(target.scale.x).toBeCloseTo(2);
		expect(queue.isRunning).toBe(false);
	});

	it("emits completed signal", () => {
		const target = new Node3D();
		const queue = new ActionQueue();
		queue.target = target;

		const completedFn = vi.fn();
		queue.completed.connect(completedFn);

		queue.play(0, (q) => q.wait(0.1));
		queue.onFixedUpdate(0.1);

		expect(completedFn).toHaveBeenCalledTimes(1);
	});

	it("cancel emits cancelled signal", () => {
		const target = new Node3D();
		const queue = new ActionQueue();
		queue.target = target;

		const cancelledFn = vi.fn();
		queue.cancelled.connect(cancelledFn);

		queue.play(0, (q) => q.wait(10));
		queue.cancel();

		expect(cancelledFn).toHaveBeenCalledTimes(1);
		expect(queue.isRunning).toBe(false);
	});

	it("higher priority interrupts lower", () => {
		const target = new Node3D();
		target.position.set(0, 0, 0);

		const queue = new ActionQueue();
		queue.target = target;

		queue.play(0, (q) => q.moveTo({ x: 10, y: 0, z: 0 }, 10, linear));
		queue.play(1, (q) => q.moveTo({ x: -5, y: 0, z: 0 }, 1, linear));

		queue.onFixedUpdate(1);
		expect(target.position.x).toBeCloseTo(-5); // higher priority wins
	});

	it("lower priority is ignored while higher is running", () => {
		const target = new Node3D();
		target.position.set(0, 0, 0);

		const queue = new ActionQueue();
		queue.target = target;

		queue.play(1, (q) => q.moveTo({ x: 10, y: 0, z: 0 }, 10, linear));
		queue.play(0, (q) => q.moveTo({ x: -5, y: 0, z: 0 }, 1, linear)); // ignored

		queue.onFixedUpdate(1);
		// Should still be running toward x=10, not x=-5
		expect(target.position.x).toBeGreaterThan(0);
	});

	it("call step executes callback", () => {
		const target = new Node3D();
		const queue = new ActionQueue();
		queue.target = target;

		const fn = vi.fn();
		queue.play(0, (q) => q.call(fn));
		queue.onFixedUpdate(0.016);

		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("easeInOutQuad returns correct values", () => {
		expect(easeInOutQuad(0)).toBe(0);
		expect(easeInOutQuad(0.5)).toBeCloseTo(0.5);
		expect(easeInOutQuad(1)).toBe(1);
		expect(easeInOutQuad(0.25)).toBeLessThan(0.25); // ease-in phase
		expect(easeInOutQuad(0.75)).toBeGreaterThan(0.75); // ease-out phase
	});

	it("onDestroy cancels all steps", () => {
		const target = new Node3D();
		const queue = new ActionQueue();
		queue.target = target;

		queue.play(0, (q) => q.wait(10));
		expect(queue.isRunning).toBe(true);

		queue.onDestroy();
		expect(queue.isRunning).toBe(false);
	});

	it("works with null target gracefully", () => {
		const queue = new ActionQueue();
		// no target set

		queue.play(0, (q) => q.moveTo({ x: 10, y: 0, z: 0 }, 1, linear));
		queue.onFixedUpdate(1);

		// Should complete without error
		expect(queue.isRunning).toBe(false);
	});
});
