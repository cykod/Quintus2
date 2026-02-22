import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AudioPlugin } from "@quintus/audio";
import { _resetNodeIdCounter, type Plugin, type SceneConstructor } from "@quintus/core";
import type { HeadlessGame } from "@quintus/headless";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import type { InputScript } from "@quintus/test";
import { TestRunner } from "@quintus/test";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "../config.js";
import { Level1 } from "../scenes/level1.js";
import { TestItemsLevel } from "../scenes/test-items-level.js";
import { gameState } from "../state.js";

const ASSETS_DIR = resolve(import.meta.dirname, "..", "assets");

export function dungeonPlugins(): Plugin[] {
	return [
		PhysicsPlugin({
			gravity: new Vec2(0, 0),
			collisionGroups: COLLISION_GROUPS,
		}),
		InputPlugin({ actions: INPUT_BINDINGS }),
		TweenPlugin(),
		AudioPlugin(),
	];
}

/**
 * Load TMX level assets from disk and store them in the game's asset loader.
 * Images are not needed since renderer is null.
 */
export async function loadDungeonAssets(game: HeadlessGame): Promise<void> {
	const level1 = await readFile(resolve(ASSETS_DIR, "level1.tmx"), "utf-8");
	const level2 = await readFile(resolve(ASSETS_DIR, "level2.tmx"), "utf-8");
	const level3 = await readFile(resolve(ASSETS_DIR, "level3.tmx"), "utf-8");
	const testItems = await readFile(resolve(ASSETS_DIR, "test-items.tmx"), "utf-8");
	game.assets._storeCustom("level1", level1);
	game.assets._storeCustom("level2", level2);
	game.assets._storeCustom("level3", level3);
	game.assets._storeCustom("test-items", testItems);
}

export function resetDungeonState(): void {
	gameState.reset();
	_resetNodeIdCounter();
}

const PLUGINS = dungeonPlugins();

export function runLevel1(input?: InputScript, duration?: number, afterReset?: () => void) {
	return TestRunner.run({
		scene: Level1,
		seed: 42,
		width: 320,
		height: 240,
		plugins: PLUGINS,
		input,
		duration,
		snapshotInterval: 1,
		setup: loadDungeonAssets,
		beforeRun: () => {
			resetDungeonState();
			afterReset?.();
		},
	});
}

export function runTestItems(input?: InputScript, duration?: number, afterReset?: () => void) {
	return TestRunner.run({
		scene: TestItemsLevel,
		seed: 42,
		width: 320,
		height: 240,
		plugins: PLUGINS,
		input,
		duration,
		snapshotInterval: 1,
		setup: loadDungeonAssets,
		beforeRun: () => {
			resetDungeonState();
			afterReset?.();
		},
	});
}

/** Run any scene class with the standard dungeon test config. */
export function runScene(
	scene: SceneConstructor,
	input?: InputScript,
	duration?: number,
	afterReset?: () => void,
) {
	return TestRunner.run({
		scene,
		seed: 42,
		width: 320,
		height: 240,
		plugins: PLUGINS,
		input,
		duration,
		snapshotInterval: 1,
		setup: loadDungeonAssets,
		beforeRun: () => {
			resetDungeonState();
			afterReset?.();
		},
	});
}
