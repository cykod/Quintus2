import { Scene } from "@quintus/core";
import { describe, expect, test } from "vitest";
import { createHeadlessGame } from "./create-headless-game.js";
import { HeadlessGame } from "./headless-game.js";

class EmptyScene extends Scene {
	onReady(): void {}
}

describe("HeadlessGame", () => {
	test("creates without errors", () => {
		const game = new HeadlessGame({ width: 320, height: 240, seed: 42 });
		expect(game).toBeInstanceOf(HeadlessGame);
		expect(game.width).toBe(320);
		expect(game.height).toBe(240);
	});

	test("step() advances frames", () => {
		const game = new HeadlessGame({ width: 320, height: 240, seed: 42 });
		game.start(EmptyScene);
		expect(game.fixedFrame).toBe(0);
		game.step();
		expect(game.fixedFrame).toBe(1);
		game.step();
		expect(game.fixedFrame).toBe(2);
	});

	test("runFor() advances correct number of frames", () => {
		const game = new HeadlessGame({ width: 320, height: 240, seed: 42 });
		game.start(EmptyScene);
		const frames = game.runFor(10);
		expect(frames).toBe(600);
		expect(game.fixedFrame).toBe(600);
	});

	test("runUntil() stops when condition is true", () => {
		const game = new HeadlessGame({ width: 320, height: 240, seed: 42 });
		game.start(EmptyScene);
		const met = game.runUntil(() => game.fixedFrame >= 100);
		expect(met).toBe(true);
		expect(game.fixedFrame).toBe(100);
	});

	test("runUntil() returns false on timeout", () => {
		const game = new HeadlessGame({ width: 320, height: 240, seed: 42 });
		game.start(EmptyScene);
		const met = game.runUntil(() => false, 0.5);
		expect(met).toBe(false);
		expect(game.fixedFrame).toBe(30); // 0.5s at 60fps
	});

	test("deterministic RNG with same seed", () => {
		const game1 = new HeadlessGame({ width: 320, height: 240, seed: 42 });
		const game2 = new HeadlessGame({ width: 320, height: 240, seed: 42 });
		expect(game1.random.next()).toBe(game2.random.next());
		expect(game1.random.next()).toBe(game2.random.next());
	});
});

describe("createHeadlessGame", () => {
	test("creates game with options", () => {
		const game = createHeadlessGame({ width: 320, height: 240, seed: 42 });
		expect(game).toBeInstanceOf(HeadlessGame);
	});

	test("installs plugins", () => {
		const installed: string[] = [];
		const game = createHeadlessGame({
			width: 320,
			height: 240,
			seed: 42,
			plugins: [{ name: "test-plugin", install: () => installed.push("test-plugin") }],
		});
		expect(installed).toEqual(["test-plugin"]);
		expect(game.hasPlugin("test-plugin")).toBe(true);
	});
});
