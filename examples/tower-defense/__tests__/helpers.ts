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
import { COLLISION_GROUPS, GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS } from "../config.js";
import type { PathDef } from "../path.js";
import { gameState } from "../state.js";

const ASSETS_DIR = resolve(import.meta.dirname, "..", "assets");

export function tdPlugins(): Plugin[] {
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

export function resetTDState(): void {
	gameState.reset();
	_resetNodeIdCounter();
}

/**
 * Load TMX level assets from disk and store them in the game's asset loader.
 * Images are not needed since renderer is null.
 */
export async function loadTDAssets(game: HeadlessGame): Promise<void> {
	const level1 = await readFile(resolve(ASSETS_DIR, "level1.tmx"), "utf-8");
	const level2 = await readFile(resolve(ASSETS_DIR, "level2.tmx"), "utf-8");
	game.assets._storeCustom("level1", level1);
	game.assets._storeCustom("level2", level2);
}

/** Simple path for unit tests. Enemies walk from (0,0) → (4,0) → (4,4). */
export const TEST_PATH: PathDef = {
	waypoints: [new Vec2(0, 0), new Vec2(4, 0), new Vec2(4, 4)],
};

const PLUGINS = tdPlugins();

/** Run a tower-defense scene with the standard test config. */
export function runScene(
	scene: SceneConstructor,
	input?: InputScript,
	duration?: number,
	afterReset?: () => void,
) {
	return TestRunner.run({
		scene,
		seed: 42,
		width: GAME_WIDTH,
		height: GAME_HEIGHT,
		plugins: PLUGINS,
		input,
		duration,
		snapshotInterval: 0,
		setup: loadTDAssets,
		beforeRun: () => {
			resetTDState();
			afterReset?.();
		},
	});
}

/** Run a tower-defense scene with snapshots enabled. */
export function runSceneWithSnapshots(
	scene: SceneConstructor,
	input?: InputScript,
	duration?: number,
	afterReset?: () => void,
) {
	return TestRunner.run({
		scene,
		seed: 42,
		width: GAME_WIDTH,
		height: GAME_HEIGHT,
		plugins: PLUGINS,
		input,
		duration,
		snapshotInterval: 1,
		setup: loadTDAssets,
		beforeRun: () => {
			resetTDState();
			afterReset?.();
		},
	});
}
