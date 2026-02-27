import { Scene } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { describe, expect, test } from "vitest";
import { InputScript } from "./input-script.js";
import { TestRunner } from "./test-runner.js";

class EmptyScene extends Scene {
	onReady(): void {}
}

describe("TestRunner", () => {
	test("run() throws if neither input nor duration", async () => {
		await expect(
			TestRunner.run({
				scene: EmptyScene,
				seed: 42,
			}),
		).rejects.toThrow("requires at least");
	});

	test("run() with duration only steps correct frames", async () => {
		const result = await TestRunner.run({
			scene: EmptyScene,
			seed: 42,
			duration: 1,
		});
		expect(result.totalFrames).toBe(60);
		expect(result.game.fixedFrame).toBe(60);
		expect(result.seed).toBe(42);
		expect(result.finalState.type).toBe("EmptyScene");
		result.game.stop();
	});

	test("run() with input script", async () => {
		const result = await TestRunner.run({
			scene: EmptyScene,
			seed: 42,
			input: InputScript.create().wait(30),
		});
		expect(result.totalFrames).toBe(30);
		expect(result.game.fixedFrame).toBe(30);
		result.game.stop();
	});

	test("run() uses max of input and duration", async () => {
		const result = await TestRunner.run({
			scene: EmptyScene,
			seed: 42,
			input: InputScript.create().wait(30),
			duration: 2, // 120 frames > 30 frames
		});
		expect(result.totalFrames).toBe(120);
		result.game.stop();
	});

	test("run() records timeline when snapshotInterval > 0", async () => {
		const result = await TestRunner.run({
			scene: EmptyScene,
			seed: 42,
			duration: 1,
			snapshotInterval: 60, // Every second
		});
		// Should have frame 0 and frame 60
		expect(result.timeline.length).toBe(2);
		expect(result.timeline.first?.frame).toBe(0);
		expect(result.timeline.last?.frame).toBe(60);
		result.game.stop();
	});

	test("run() with snapshotInterval=0 captures no timeline entries", async () => {
		const result = await TestRunner.run({
			scene: EmptyScene,
			seed: 42,
			duration: 1,
			snapshotInterval: 0,
		});
		expect(result.timeline.length).toBe(0);
		expect(result.finalState).toBeTruthy();
		result.game.stop();
	});

	test("run() with snapshotInterval=1 captures every frame", async () => {
		const result = await TestRunner.run({
			scene: EmptyScene,
			seed: 42,
			duration: 0.5, // 30 frames
			snapshotInterval: 1,
		});
		// Frame 0 + frames 1-30 = 31 entries
		expect(result.timeline.length).toBe(31);
		result.game.stop();
	});

	test("run() calls beforeRun", async () => {
		let called = false;
		await TestRunner.run({
			scene: EmptyScene,
			seed: 42,
			duration: 0.1,
			beforeRun: () => {
				called = true;
			},
		});
		expect(called).toBe(true);
	});

	test("run() calls async setup", async () => {
		let setupGame = null;
		const result = await TestRunner.run({
			scene: EmptyScene,
			seed: 42,
			duration: 0.1,
			setup: async (game) => {
				setupGame = game;
			},
		});
		expect(setupGame).toBe(result.game);
		result.game.stop();
	});

	test("finalState contains scene tree", async () => {
		const result = await TestRunner.run({
			scene: EmptyScene,
			seed: 42,
			duration: 0.5,
		});
		expect(result.finalState.type).toBe("EmptyScene");
		expect(result.finalState.children).toBeDefined();
		result.game.stop();
	});

	test("totalTime is accurate", async () => {
		const result = await TestRunner.run({
			scene: EmptyScene,
			seed: 42,
			duration: 2,
		});
		expect(result.totalTime).toBeCloseTo(2, 3);
		result.game.stop();
	});

	test("run() with input script executes actions against input system", async () => {
		const result = await TestRunner.run({
			scene: EmptyScene,
			seed: 42,
			plugins: [InputPlugin({ actions: { move_right: [] } })],
			input: InputScript.create().press("move_right", 30),
		});
		expect(result.totalFrames).toBe(30);
		expect(result.game.fixedFrame).toBe(30);
		result.game.stop();
	});

	test("run() with input and longer duration runs remaining frames", async () => {
		const result = await TestRunner.run({
			scene: EmptyScene,
			seed: 42,
			plugins: [InputPlugin({ actions: { jump: [] } })],
			input: InputScript.create().press("jump", 10),
			duration: 1, // 60 frames > 10 from script
		});
		expect(result.totalFrames).toBe(60);
		expect(result.game.fixedFrame).toBe(60);
		result.game.stop();
	});

	test("run() records timeline snapshots during input execution", async () => {
		const result = await TestRunner.run({
			scene: EmptyScene,
			seed: 42,
			plugins: [InputPlugin({ actions: { jump: [] } })],
			input: InputScript.create().press("jump", 30),
			snapshotInterval: 10,
		});
		// Frame 0, 10, 20, 30 = 4 snapshots
		expect(result.timeline.length).toBe(4);
		result.game.stop();
	});

	test("run() with debug mode enables event logging", async () => {
		const result = await TestRunner.run({
			scene: EmptyScene,
			seed: 42,
			duration: 0.5,
			debug: true,
		});
		// Game should have debug mode on
		expect(result.game.debug).toBe(true);
		result.game.stop();
	});
});
