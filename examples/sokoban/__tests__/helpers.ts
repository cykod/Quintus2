import { AudioPlugin } from "@quintus/audio";
import { _resetNodeIdCounter, type Plugin, type SceneConstructor } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import type { InputScript } from "@quintus/test";
import { TestRunner } from "@quintus/test";
import { TweenPlugin } from "@quintus/tween";
import { GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS } from "../config.js";
import { gameState } from "../state.js";

export function sokobanPlugins(): Plugin[] {
	return [InputPlugin({ actions: INPUT_BINDINGS }), TweenPlugin(), AudioPlugin()];
}

export function resetSokobanState(): void {
	gameState.reset();
	_resetNodeIdCounter();
}

const PLUGINS = sokobanPlugins();

/** Run a sokoban scene with the standard test config. */
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
		beforeRun: () => {
			resetSokobanState();
			afterReset?.();
		},
	});
}

/** Run a sokoban scene with snapshots enabled. */
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
		beforeRun: () => {
			resetSokobanState();
			afterReset?.();
		},
	});
}
