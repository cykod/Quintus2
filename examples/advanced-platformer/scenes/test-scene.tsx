import { Vec2 } from "@quintus/math";
import { MovingPlatform } from "../entities/moving-platform.js";
import { BaseLevelScene, ENEMY_TILE_IDS } from "./base-level-scene.js";

// Re-export for backward compatibility with tests
export { ENEMY_TILE_IDS };

/**
 * Level 1 — Grasslands.
 * Green terrain, cloud platforms, introductory mechanics.
 */
export class Level1Scene extends BaseLevelScene {
	readonly tmxAsset = "level1";
	readonly sceneName = "level1";
	readonly nextSceneName = "level2";
	readonly levelNumber = 1;

	protected override readonly bgSkyTexture = "bg_solid_sky";
	protected override readonly bgCloudsTexture = "bg_clouds";
	protected override readonly bgFarTexture = "bg_fade_hills";
	protected override readonly bgNearTexture = "bg_color_hills";

	protected override _spawnEnemiesFromTiles(): void {
		super._spawnEnemiesFromTiles();

		// Moving platform over the second gap area
		const mp = this.add(MovingPlatform);
		mp.position = new Vec2(3776, 832);
		mp.direction = "horizontal";
		mp.distance = 256;
		mp.speed = 80;
		mp.waitTime = 0.5;
	}
}

/** @deprecated Use Level1Scene instead. */
export const TestScene = Level1Scene;
