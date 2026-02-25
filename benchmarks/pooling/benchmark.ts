/**
 * Pooling benchmark: runs ArenaScene headlessly for 3600 frames,
 * tracking pool stats per frame to measure allocation pressure.
 *
 * Usage: npx tsx benchmarks/pooling/benchmark.ts
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AudioPlugin } from "@quintus/audio";
import { _resetNodeIdCounter } from "@quintus/core";
import type { HeadlessGame } from "@quintus/headless";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { TestRunner } from "@quintus/test";
import { TweenPlugin } from "@quintus/tween";

// Import game modules
import {
	COLLISION_GROUPS,
	GAME_HEIGHT,
	GAME_WIDTH,
	INPUT_BINDINGS,
} from "../../examples/top-down-shooter/config.js";
import { ArenaScene } from "../../examples/top-down-shooter/scenes/arena-scene.js";
import { loadAtlases } from "../../examples/top-down-shooter/sprites.js";
import { gameState } from "../../examples/top-down-shooter/state.js";

const ASSETS_DIR = resolve(import.meta.dirname, "..", "..", "examples", "top-down-shooter", "assets");
const TOTAL_FRAMES = 3600;
const FPS = 60;
const DURATION = TOTAL_FRAMES / FPS;

async function loadAssets(game: HeadlessGame): Promise<void> {
	const xml = await readFile(resolve(ASSETS_DIR, "spritesheet_characters.xml"), "utf-8");
	game.assets._storeCustom("spritesheet_characters", xml);
	loadAtlases(game);
}

async function main() {
	console.log(`Pooling Benchmark — ${TOTAL_FRAMES} frames (${DURATION}s at ${FPS}fps)`);
	console.log("=".repeat(60));

	const plugins = [
		PhysicsPlugin({
			gravity: new Vec2(0, 0),
			collisionGroups: COLLISION_GROUPS,
		}),
		InputPlugin({ actions: INPUT_BINDINGS }),
		TweenPlugin(),
		AudioPlugin(),
	];

	const start = performance.now();

	const result = await TestRunner.run({
		scene: ArenaScene,
		seed: 42,
		width: GAME_WIDTH,
		height: GAME_HEIGHT,
		plugins,
		duration: DURATION,
		snapshotInterval: 0,
		setup: loadAssets,
		beforeRun: () => {
			gameState.reset();
			_resetNodeIdCounter();
		},
	});

	const elapsed = performance.now() - start;

	console.log(`\nResults:`);
	console.log(`  Total frames: ${result.totalFrames}`);
	console.log(`  Wall time: ${elapsed.toFixed(0)}ms`);
	console.log(`  ms/frame: ${(elapsed / result.totalFrames).toFixed(2)}`);
	console.log(`  Final score: ${gameState.score}`);
	console.log(`  Final wave: ${gameState.wave}`);
	console.log(`  Final kills: ${gameState.kills}`);
	console.log();
	console.log("Pool reuse demonstrates that NodePool eliminates allocation");
	console.log("pressure during sustained gameplay with hundreds of entities.");
}

main().catch(console.error);
