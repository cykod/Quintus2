import "@quintus/tilemap/physics";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AudioPlugin } from "@quintus/audio";
import { Camera } from "@quintus/camera";
import { _resetNodeIdCounter, type Plugin, Scene, type SceneConstructor } from "@quintus/core";
import type { HeadlessGame } from "@quintus/headless";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { CollisionShape, PhysicsPlugin, Shape, StaticCollider } from "@quintus/physics";
import type { InputScript } from "@quintus/test";
import { TestRunner } from "@quintus/test";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "../config.js";
import { Player } from "../entities/player.js";
import { GameOverScene } from "../scenes/game-over-scene.js";
import { Level1 } from "../scenes/level1.js";
import { Level2 } from "../scenes/level2.js";
import { TitleScene } from "../scenes/title-scene.js";
import { VictoryScene } from "../scenes/victory-scene.js";
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

export async function loadPlatformerAssets(game: HeadlessGame): Promise<void> {
	const level1 = await readFile(resolve(ASSETS_DIR, "level1.tmx"), "utf-8");
	const level2 = await readFile(resolve(ASSETS_DIR, "level2.tmx"), "utf-8");
	game.assets._storeCustom("level1", level1);
	game.assets._storeCustom("level2", level2);
}

export function resetPlatformerState(): void {
	gameState.reset();
	_resetNodeIdCounter();
}

/** Floor collider with collisionGroup pre-set to "world". */
class Floor extends StaticCollider {
	override collisionGroup = "world";

	override onReady() {
		super.onReady();
		this.add(CollisionShape).shape = Shape.rect(640, 16);
	}
}

/** Wall collider with collisionGroup pre-set to "world". */
export class Wall extends StaticCollider {
	override collisionGroup = "world";

	override onReady() {
		super.onReady();
		this.add(CollisionShape).shape = Shape.rect(8, 64);
	}
}

const PLUGINS = platformerPlugins();

/**
 * A minimal test scene with a flat floor and a player.
 * Entities can be added after construction for controlled edge-case testing.
 */
export class TestArena extends Scene {
	player!: Player;

	override onReady() {
		this.player = this.add(Player);
		this.player.position = new Vec2(160, 192);

		const camera = this.add(Camera);
		camera.follow = this.player;
		camera.zoom = 1;

		const floor = this.add(Floor);
		floor.position = new Vec2(160, 208);
	}
}

function registerAllScenes(game: HeadlessGame): void {
	game.registerScenes({
		level1: Level1,
		level2: Level2,
		"game-over": GameOverScene,
		title: TitleScene,
		victory: VictoryScene,
	});
}

/** Run Level1 with real TMX assets. */
export function runLevel1(input?: InputScript, duration?: number, afterReset?: () => void) {
	return TestRunner.run({
		scene: Level1,
		seed: 42,
		width: 320,
		height: 240,
		plugins: PLUGINS,
		input,
		duration,
		snapshotInterval: 0,
		setup: async (game) => {
			registerAllScenes(game);
			await loadPlatformerAssets(game);
		},
		beforeRun: () => {
			resetPlatformerState();
			afterReset?.();
		},
	});
}

/** Run the minimal TestArena scene for controlled entity testing. */
export function runArena(input?: InputScript, duration?: number, afterReset?: () => void) {
	return TestRunner.run({
		scene: TestArena,
		seed: 42,
		width: 320,
		height: 240,
		plugins: PLUGINS,
		input,
		duration,
		snapshotInterval: 0,
		setup: async (game) => {
			registerAllScenes(game);
		},
		beforeRun: () => {
			resetPlatformerState();
			afterReset?.();
		},
	});
}

/** Run any scene with standard platformer config. */
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
		snapshotInterval: 0,
		setup: async (game) => {
			registerAllScenes(game);
			await loadPlatformerAssets(game);
		},
		beforeRun: () => {
			resetPlatformerState();
			afterReset?.();
		},
	});
}
