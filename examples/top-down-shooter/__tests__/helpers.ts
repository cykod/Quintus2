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
import { loadAtlases } from "../sprites.js";
import { gameState } from "../state.js";

const ASSETS_DIR = resolve(import.meta.dirname, "..", "assets");

const XML_FILES = ["spritesheet_characters"];

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

export async function loadShooterAssets(game: HeadlessGame): Promise<void> {
	for (const name of XML_FILES) {
		const xml = await readFile(resolve(ASSETS_DIR, `${name}.xml`), "utf-8");
		game.assets._storeCustom(name, xml);
	}
	loadAtlases(game);
}

export function resetShooterState(): void {
	gameState.reset();
	_resetNodeIdCounter();
}

const PLUGINS = shooterPlugins();

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
