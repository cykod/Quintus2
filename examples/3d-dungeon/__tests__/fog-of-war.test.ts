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
import {
	FOG_HIDDEN_OPACITY,
	FOG_VISITED_OPACITY,
	GAME_HEIGHT,
	GAME_WIDTH,
	INPUT_BINDINGS,
} from "../config.js";
import { FogOfWar } from "../entities/fog-of-war.js";
import { resetState } from "./helpers.js";

const PLUGINS: Plugin[] = [
	ThreePlugin({ antialias: false, background: 0x000000 }),
	InputPlugin({ actions: INPUT_BINDINGS }),
];

/** Build a wall grid from level strings: true = wall (#), false = floor. */
function buildWallGrid(lines: string[]): boolean[][] {
	return lines.map((line) => line.split("").map((ch) => ch === "#"));
}

type FogMesh = {
	visible: boolean;
	material: { opacity: number };
	position: { x: number; z: number };
};

describe("FogOfWar", () => {
	beforeEach(() => {
		resetState();
	});

	it("tiles within sight range are hidden (invisible)", async () => {
		const level = ["######", "#P...#", "#....#", "#....#", "#....#", "######"];
		const wallGrid = buildWallGrid(level);
		let fog!: FogOfWar;

		class TestScene extends Scene {
			override onReady() {
				fog = this.add(FogOfWar);
				fog.init(level[0].length, level.length, wallGrid);
				fog.updatePlayerPosition(1, 1);
			}
		}

		await TestRunner.run({
			scene: TestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		// Tile (1,1) is the player position — cube should be invisible
		const mesh11 = fog.object3d.children.find(
			(c) => c.position.x === 1 && c.position.z === 1,
		) as FogMesh;
		expect(mesh11).toBeDefined();
		expect(mesh11.visible).toBe(false);

		// Tile (2,1) is distance 1 from player — within range, invisible
		const mesh21 = fog.object3d.children.find(
			(c) => c.position.x === 2 && c.position.z === 1,
		) as FogMesh;
		expect(mesh21).toBeDefined();
		expect(mesh21.visible).toBe(false);
	});

	it("tiles outside range that were never visited have full opacity", async () => {
		const level = [
			"########",
			"#P.....#",
			"#......#",
			"#......#",
			"#......#",
			"#......#",
			"#......#",
			"########",
		];
		const wallGrid = buildWallGrid(level);
		let fog!: FogOfWar;

		class TestScene extends Scene {
			override onReady() {
				fog = this.add(FogOfWar);
				fog.init(level[0].length, level.length, wallGrid);
				fog.updatePlayerPosition(1, 1);
			}
		}

		await TestRunner.run({
			scene: TestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		// Tile (6,6) is far from player (1,1) — distance 10, never visited
		const meshFar = fog.object3d.children.find(
			(c) => c.position.x === 6 && c.position.z === 6,
		) as FogMesh;
		expect(meshFar).toBeDefined();
		expect(meshFar.visible).toBe(true);
		expect(meshFar.material.opacity).toBe(FOG_HIDDEN_OPACITY);
	});

	it("visited tiles outside range have partial opacity", async () => {
		const level = [
			"########",
			"#P.....#",
			"#......#",
			"#......#",
			"#......#",
			"#......#",
			"#......#",
			"########",
		];
		const wallGrid = buildWallGrid(level);
		let fog!: FogOfWar;

		class TestScene extends Scene {
			override onReady() {
				fog = this.add(FogOfWar);
				fog.init(level[0].length, level.length, wallGrid);
				// First update: player at (1,1) — reveals nearby tiles
				fog.updatePlayerPosition(1, 1);
				// Second update: player moves far away — previously visible tiles become visited
				fog.updatePlayerPosition(6, 6);
			}
		}

		await TestRunner.run({
			scene: TestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		// Tile (1,1) was visited when player was there, now player is at (6,6)
		// Distance from (6,6) to (1,1) = 10, so outside range but visited
		const mesh11 = fog.object3d.children.find(
			(c) => c.position.x === 1 && c.position.z === 1,
		) as FogMesh;
		expect(mesh11).toBeDefined();
		expect(mesh11.visible).toBe(true);
		expect(mesh11.material.opacity).toBe(FOG_VISITED_OPACITY);
	});

	it("moving reveals new tiles and dims old ones", async () => {
		const level = [
			"########",
			"#......#",
			"#......#",
			"#......#",
			"#......#",
			"#......#",
			"#......#",
			"########",
		];
		const wallGrid = buildWallGrid(level);
		let fog!: FogOfWar;

		class TestScene extends Scene {
			override onReady() {
				fog = this.add(FogOfWar);
				fog.init(level[0].length, level.length, wallGrid);
				fog.updatePlayerPosition(1, 1);
			}
		}

		await TestRunner.run({
			scene: TestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		// Before move: tile (6,6) should be hidden (visible but opaque)
		const meshFar = fog.object3d.children.find(
			(c) => c.position.x === 6 && c.position.z === 6,
		) as FogMesh;
		expect(meshFar.visible).toBe(true);
		expect(meshFar.material.opacity).toBe(FOG_HIDDEN_OPACITY);

		// Move player to (6,6)
		fog.updatePlayerPosition(6, 6);

		// Now tile (6,6) should be invisible (revealed)
		expect(meshFar.visible).toBe(false);

		// And tile (1,1) which was visited should now be dimmed
		const meshOld = fog.object3d.children.find(
			(c) => c.position.x === 1 && c.position.z === 1,
		) as FogMesh;
		expect(meshOld.visible).toBe(true);
		expect(meshOld.material.opacity).toBe(FOG_VISITED_OPACITY);
	});

	it("edge walls have no fog, interior walls do", async () => {
		// 5x5 grid: edge ring is all walls, interior has a wall at (2,2)
		const level = ["#####", "#...#", "#.#.#", "#...#", "#####"];
		const wallGrid = buildWallGrid(level);
		let fog!: FogOfWar;

		class TestScene extends Scene {
			override onReady() {
				fog = this.add(FogOfWar);
				fog.init(level[0].length, level.length, wallGrid);
				fog.updatePlayerPosition(1, 1);
			}
		}

		await TestRunner.run({
			scene: TestScene,
			seed: 42,
			width: GAME_WIDTH,
			height: GAME_HEIGHT,
			plugins: PLUGINS,
			duration: 0.05,
			snapshotInterval: 0,
			beforeRun: () => resetState(),
		});

		// 5x5 = 25 tiles. 16 edge tiles skipped. 9 interior tiles get fog (including wall at 2,2).
		expect(fog.object3d.children.length).toBe(9);

		// Interior wall at (2,2) should have a fog mesh
		const wallMesh = fog.object3d.children.find((c) => c.position.x === 2 && c.position.z === 2);
		expect(wallMesh).toBeDefined();
	});
});
