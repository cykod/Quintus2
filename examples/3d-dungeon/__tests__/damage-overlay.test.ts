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
import { Panel } from "@quintus/ui";
import { GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS } from "../config.js";
import { DamageOverlay } from "../hud/damage-overlay.js";
import { resetState } from "./helpers.js";

const PLUGINS: Plugin[] = [
	ThreePlugin({ antialias: false, background: 0x000000 }),
	InputPlugin({ actions: INPUT_BINDINGS }),
];

describe("DamageOverlay", () => {
	beforeEach(() => {
		resetState();
	});

	it("flash() makes panel visible with red alpha", async () => {
		let overlay!: DamageOverlay;

		class OverlayTestScene extends Scene {
			override onReady() {
				overlay = this.add(DamageOverlay);
			}
		}

		await TestRunner.run({
			scene: OverlayTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		overlay.flash();
		const panel = overlay.findByType(Panel);
		expect(panel).toBeDefined();
		expect(panel!.visible).toBe(true);
		expect(panel!.backgroundColor.a).toBeGreaterThan(0);
	});

	it("panel hidden after timer expires", async () => {
		let overlay!: DamageOverlay;

		class OverlayTestScene extends Scene {
			override onReady() {
				overlay = this.add(DamageOverlay);
				overlay.flash();
			}
		}

		await TestRunner.run({
			scene: OverlayTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.5,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		const panel = overlay.findByType(Panel);
		expect(panel!.visible).toBe(false);
	});
});
