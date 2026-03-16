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
import { CameraShake } from "../entities/camera-shake.js";
import { resetState } from "./helpers.js";

const PLUGINS: Plugin[] = [
	ThreePlugin({ antialias: false, background: 0x000000 }),
	InputPlugin({ actions: INPUT_BINDINGS }),
];

describe("CameraShake", () => {
	beforeEach(() => {
		resetState();
	});

	it("shake() sets position offset during timer", async () => {
		let shakeNode!: CameraShake;

		class ShakeTestScene extends Scene {
			override onReady() {
				shakeNode = this.add(CameraShake);
				shakeNode.shake(0.1, 0.2);
			}
		}

		await TestRunner.run({
			scene: ShakeTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		// During shake, position should be non-zero (statistically)
		const pos = shakeNode.position;
		const hasOffset = pos.x !== 0 || pos.y !== 0 || pos.z !== 0;
		expect(hasOffset).toBe(true);
	});

	it("position returns to (0,0,0) after duration expires", async () => {
		let shakeNode!: CameraShake;

		class ShakeTestScene extends Scene {
			override onReady() {
				shakeNode = this.add(CameraShake);
				shakeNode.shake(0.1, 0.1);
			}
		}

		await TestRunner.run({
			scene: ShakeTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.5,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		expect(shakeNode.position.x).toBe(0);
		expect(shakeNode.position.y).toBe(0);
		expect(shakeNode.position.z).toBe(0);
	});

	it("latest shake overrides previous", async () => {
		let shakeNode!: CameraShake;

		class ShakeTestScene extends Scene {
			override onReady() {
				shakeNode = this.add(CameraShake);
				shakeNode.shake(0.01, 0.01);
				// Override with a longer shake
				shakeNode.shake(0.5, 1.0);
			}
		}

		await TestRunner.run({
			scene: ShakeTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		// Should still be shaking (second shake has 1.0s duration)
		const pos = shakeNode.position;
		const hasOffset = pos.x !== 0 || pos.y !== 0 || pos.z !== 0;
		expect(hasOffset).toBe(true);
	});
});
