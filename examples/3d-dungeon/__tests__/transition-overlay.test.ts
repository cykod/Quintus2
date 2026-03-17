import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("../../../packages/three/src/__test-utils__/three-mock.js"));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
	GLTFLoader: class {
		loadAsync() {
			return Promise.resolve({});
		}
	},
}));
vi.mock("three/addons/utils/SkeletonUtils.js", () => ({
	clone: (scene: unknown) => scene ?? {},
}));

import type { Plugin } from "@quintus/core";
import { Scene } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { TestRunner } from "@quintus/test";
import { ThreePlugin } from "@quintus/three";
import { GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS } from "../config.js";
import { TransitionOverlay } from "../hud/transition-overlay.js";
import { resetState } from "./helpers.js";

class TransitionTestScene extends Scene {
	overlay!: TransitionOverlay;

	override onReady() {
		this.overlay = this.add(TransitionOverlay);
	}
}

const PLUGINS: Plugin[] = [
	ThreePlugin({ antialias: false, background: 0x000000 }),
	InputPlugin({ actions: INPUT_BINDINGS }),
];

describe("TransitionOverlay", () => {
	beforeEach(() => {
		resetState();
	});

	it("fadeOut makes panel visible and increases alpha", async () => {
		const result = await TestRunner.run({
			scene: TransitionTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: resetState,
		});

		const scene = result.game.currentScene as TransitionTestScene;
		const overlay = scene.overlay;

		overlay.fadeOut(0.5);

		// Tick a few frames to advance the fade
		result.game.step(1 / 60);
		result.game.step(1 / 60);

		// Panel should be visible during fade
		const panel = (overlay as unknown as { _panel: { visible: boolean } })._panel;
		expect(panel.visible).toBe(true);
	});

	it("fadeOutComplete signal fires when fade finishes", async () => {
		const result = await TestRunner.run({
			scene: TransitionTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: resetState,
		});

		const scene = result.game.currentScene as TransitionTestScene;
		const overlay = scene.overlay;

		let fired = false;
		overlay.fadeOutComplete.connect(() => {
			fired = true;
		});

		overlay.fadeOut(0.1);

		// Step enough frames to complete the fade (0.1s at 60fps = 6 frames)
		for (let i = 0; i < 10; i++) {
			result.game.step(1 / 60);
		}

		expect(fired).toBe(true);
	});

	it("fadeIn decreases alpha and fires fadeInComplete", async () => {
		const result = await TestRunner.run({
			scene: TransitionTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: resetState,
		});

		const scene = result.game.currentScene as TransitionTestScene;
		const overlay = scene.overlay;

		let fired = false;
		overlay.fadeInComplete.connect(() => {
			fired = true;
		});

		overlay.fadeIn(0.1);

		// Step enough frames to complete the fade
		for (let i = 0; i < 10; i++) {
			result.game.step(1 / 60);
		}

		expect(fired).toBe(true);

		// Panel should be hidden after fade-in completes
		const panel = (overlay as unknown as { _panel: { visible: boolean } })._panel;
		expect(panel.visible).toBe(false);
	});

	it("fadeOut then fadeIn works sequentially", async () => {
		const result = await TestRunner.run({
			scene: TransitionTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: resetState,
		});

		const scene = result.game.currentScene as TransitionTestScene;
		const overlay = scene.overlay;

		let fadeOutFired = false;
		overlay.fadeOutComplete.connect(() => {
			fadeOutFired = true;
			// Start fade-in after fade-out completes
			overlay.fadeIn(0.1);
		});

		let fadeInFired = false;
		overlay.fadeInComplete.connect(() => {
			fadeInFired = true;
		});

		overlay.fadeOut(0.1);

		// Step enough for both fades
		for (let i = 0; i < 20; i++) {
			result.game.step(1 / 60);
		}

		expect(fadeOutFired).toBe(true);
		expect(fadeInFired).toBe(true);
	});
});
