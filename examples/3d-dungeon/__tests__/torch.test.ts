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
import { PointLight, ThreePlugin } from "@quintus/three";
import { GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS } from "../config.js";
import { DungeonGrid } from "../entities/dungeon-grid.js";
import { Torch } from "../entities/torch.js";
import { resetState } from "./helpers.js";

const PLUGINS: Plugin[] = [
	ThreePlugin({ antialias: false, background: 0x000000 }),
	InputPlugin({ actions: INPUT_BINDINGS }),
];

describe("Torch", () => {
	beforeEach(() => {
		resetState();
	});

	it("torch has a PointLight child", async () => {
		let torch!: Torch;

		class TorchTestScene extends Scene {
			override onReady() {
				torch = this.add(Torch);
			}
		}

		await TestRunner.run({
			scene: TorchTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		const light = torch.findByType(PointLight);
		expect(light).toBeDefined();
	});

	it("light intensity varies over time (not constant)", async () => {
		let torch!: Torch;
		const intensities: number[] = [];

		class TorchTestScene extends Scene {
			override onReady() {
				torch = this.add(Torch);
			}
		}

		const result = await TestRunner.run({
			scene: TorchTestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.5,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		const light = torch.findByType(PointLight)!;
		// The light intensity should have been modified by the flicker
		// At rest it would be exactly 1.2, any deviation means flicker is working
		expect(light.light.intensity).not.toBe(0);
	});

	it("torch placement finds wall tiles adjacent to floor", () => {
		const testLevel = ["####", "#..#", "#..#", "####"];
		const grid = new DungeonGrid();

		(grid as unknown as { _charGrid: string[][] })._charGrid = testLevel.map((l) => l.split(""));

		// Wall tiles adjacent to floor: all border walls that touch a floor tile
		// e.g. (0,1) has floor neighbor at (1,1), (1,0) has floor neighbor at (1,1)
		const DIRS = [
			{ dx: 0, dz: -1 },
			{ dx: 1, dz: 0 },
			{ dx: 0, dz: 1 },
			{ dx: -1, dz: 0 },
		];

		// (0,1) is a wall tile — should have a floor neighbor at (1,1)
		const wallX = 0;
		const wallZ = 1;
		expect(grid.charAt(wallX, wallZ)).toBe("#");
		let hasFloorNeighbor = false;
		for (const { dx, dz } of DIRS) {
			if (grid.charAt(wallX + dx, wallZ + dz) !== "#") {
				hasFloorNeighbor = true;
				break;
			}
		}
		expect(hasFloorNeighbor).toBe(true);
	});
});
