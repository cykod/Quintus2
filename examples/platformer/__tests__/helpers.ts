import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AudioPlugin } from "@quintus/audio";
import type { Plugin } from "@quintus/core";
import type { HeadlessGame } from "@quintus/headless";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "../config.js";
import { gameState } from "../state.js";

const ASSETS_DIR = resolve(import.meta.dirname, "..", "assets");

export function platformerPlugins(): Plugin[] {
	return [
		PhysicsPlugin({
			gravity: new Vec2(0, 800),
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
export async function loadPlatformerAssets(game: HeadlessGame): Promise<void> {
	const level1 = await readFile(resolve(ASSETS_DIR, "level1.tmx"), "utf-8");
	const level2 = await readFile(resolve(ASSETS_DIR, "level2.tmx"), "utf-8");
	game.assets._storeCustom("level1", level1);
	game.assets._storeCustom("level2", level2);
}

export function resetPlatformerState(): void {
	gameState.reset();
}
