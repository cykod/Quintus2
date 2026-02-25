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
import { loadAtlas } from "../sprites.js";
import { gameState } from "../state.js";

const ASSETS_DIR = resolve(import.meta.dirname, "..", "assets");

export function shooterPlugins(): Plugin[] {
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
 * Load XML atlas asset from disk and store it in the game's asset loader.
 * Images are not needed since renderer is null.
 */
export async function loadShooterAssets(game: HeadlessGame): Promise<void> {
	const xml = await readFile(resolve(ASSETS_DIR, "tileset.xml"), "utf-8");
	game.assets._storeCustom("tileset", xml);
	loadAtlas(game);
}

export function resetShooterState(): void {
	gameState.reset();
	_resetNodeIdCounter();
}

const PLUGINS = shooterPlugins();

/** Run a space-shooter scene with the standard test config. */
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
		setup: loadShooterAssets,
		beforeRun: () => {
			resetShooterState();
			afterReset?.();
		},
	});
}

/** Run a space-shooter scene with snapshots enabled. */
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
		setup: loadShooterAssets,
		beforeRun: () => {
			resetShooterState();
			afterReset?.();
		},
	});
}
