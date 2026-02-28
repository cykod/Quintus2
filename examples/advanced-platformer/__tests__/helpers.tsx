import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AudioPlugin } from "@quintus/audio";
import { Camera } from "@quintus/camera";
import { _resetNodeIdCounter, type Plugin, Scene } from "@quintus/core";
import type { HeadlessGame } from "@quintus/headless";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { CollisionShape, PhysicsPlugin, Shape, StaticCollider } from "@quintus/physics";
import type { InputScript } from "@quintus/test";
import { TestRunner } from "@quintus/test";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "../config.js";
import { Player } from "../entities/player.js";
import { loadAtlases } from "../sprites.js";
import { gameState } from "../state.js";

const ASSETS_DIR = resolve(import.meta.dirname, "..", "assets");

const XML_FILES = ["characters", "enemies", "tiles"];

export function advancedPlatformerPlugins(): Plugin[] {
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
 * Load XML atlas assets from disk and store them in the game's asset loader.
 * Images are not needed since renderer is null in headless mode.
 */
export async function loadAdvancedPlatformerAssets(game: HeadlessGame): Promise<void> {
	for (const name of XML_FILES) {
		const xml = await readFile(resolve(ASSETS_DIR, `${name}.xml`), "utf-8");
		game.assets._storeCustom(name, xml);
	}
	loadAtlases(game);
}

export function resetState(): void {
	gameState.reset();
	_resetNodeIdCounter();
}

const PLUGINS = advancedPlatformerPlugins();

/** Floor collider with collisionGroup pre-set to "world". */
class Floor extends StaticCollider {
	override collisionGroup = "world";

	override build() {
		return <CollisionShape shape={Shape.rect(640, 16)} />;
	}
}

/** Wall collider with collisionGroup pre-set to "world". */
export class Wall extends StaticCollider {
	override collisionGroup = "world";

	override build() {
		return <CollisionShape shape={Shape.rect(16, 240)} />;
	}
}

/**
 * A minimal test scene with a flat floor and a player.
 * Player starts at (320, 280), floor at (320, 308).
 */
export class TestArena extends Scene {
	player!: Player;
	camera!: Camera;

	override build() {
		return (
			<>
				<Player ref="player" />
				<Camera ref="camera" follow="$player" zoom={1} />
				<Floor position={[320, 308]} />
			</>
		);
	}

	override onReady() {
		this.player.position = new Vec2(320, 280);
	}
}

/** Run the minimal TestArena scene for controlled entity testing. */
export function runArena(input?: InputScript, duration?: number, afterReset?: () => void) {
	return TestRunner.run({
		scene: TestArena,
		seed: 42,
		width: 640,
		height: 360,
		plugins: PLUGINS,
		input,
		duration,
		snapshotInterval: 0,
		setup: loadAdvancedPlatformerAssets,
		beforeRun: () => {
			resetState();
			afterReset?.();
		},
	});
}
