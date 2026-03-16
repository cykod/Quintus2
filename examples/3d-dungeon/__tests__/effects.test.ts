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
import { ParticleEmitter3D } from "@quintus/particles";
import { TestRunner } from "@quintus/test";
import { Node3D, ThreePlugin } from "@quintus/three";
import { GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS } from "../config.js";
import {
	spawnBloodBurst,
	spawnCoinBurst,
	spawnDustPuff,
	spawnHealBurst,
} from "../entities/effects.js";
import { resetState } from "./helpers.js";

const PLUGINS: Plugin[] = [
	ThreePlugin({ antialias: false, background: 0x000000 }),
	InputPlugin({ actions: INPUT_BINDINGS }),
];

describe("effects", () => {
	beforeEach(() => {
		resetState();
	});

	it("spawnBloodBurst creates a oneShot emitter", async () => {
		let emitterCount = 0;

		class EffectTestScene extends Scene {
			override onReady() {
				const parent = this.add(Node3D);
				spawnBloodBurst(parent, 1, 0.5, 2);
				emitterCount = parent.findAllByType(ParticleEmitter3D).length;
			}
		}

		await TestRunner.run({
			scene: EffectTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		expect(emitterCount).toBe(1);
	});

	it("spawnCoinBurst creates a oneShot emitter", async () => {
		let emitterCount = 0;

		class EffectTestScene extends Scene {
			override onReady() {
				const parent = this.add(Node3D);
				spawnCoinBurst(parent, 1, 0.3, 2);
				emitterCount = parent.findAllByType(ParticleEmitter3D).length;
			}
		}

		await TestRunner.run({
			scene: EffectTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		expect(emitterCount).toBe(1);
	});

	it("spawnDustPuff creates a oneShot emitter", async () => {
		let emitterCount = 0;

		class EffectTestScene extends Scene {
			override onReady() {
				const parent = this.add(Node3D);
				spawnDustPuff(parent, 1, 0.02, 2);
				emitterCount = parent.findAllByType(ParticleEmitter3D).length;
			}
		}

		await TestRunner.run({
			scene: EffectTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		expect(emitterCount).toBe(1);
	});

	it("spawnHealBurst creates a oneShot emitter", async () => {
		let emitterCount = 0;

		class EffectTestScene extends Scene {
			override onReady() {
				const parent = this.add(Node3D);
				spawnHealBurst(parent, 1, 0.3, 2);
				emitterCount = parent.findAllByType(ParticleEmitter3D).length;
			}
		}

		await TestRunner.run({
			scene: EffectTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		expect(emitterCount).toBe(1);
	});
});
