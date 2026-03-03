import { Vec2 } from "@quintus/math";
import { MovingPlatform } from "../entities/moving-platform.js";
import { BaseLevelScene } from "./base-level-scene.js";

/**
 * Level 3 — Dark Fortress.
 * Grey stone terrain, spikes, saws, multiple keys/locks, challenging platforming.
 */
export class Level3Scene extends BaseLevelScene {
	readonly tmxAsset = "level3";
	readonly sceneName = "level3";
	readonly nextSceneName = "victory";
	readonly levelNumber = 3;

	protected override readonly bgSkyTexture = "bg_solid_sky";
	protected override readonly bgCloudsTexture = "bg_clouds";
	protected override readonly bgFarTexture = "bg_fade_mushrooms";
	protected override readonly bgNearTexture = "bg_color_mushrooms";

	protected override _spawnEnemiesFromTiles(): void {
		super._spawnEnemiesFromTiles();

		// Moving platform over spike pit
		const mp1 = this.add(MovingPlatform);
		mp1.position = new Vec2(3520, 1472);
		mp1.direction = "horizontal";
		mp1.distance = 256;
		mp1.speed = 60;
		mp1.waitTime = 0.3;

		// Vertical platform for upper path access
		const mp2 = this.add(MovingPlatform);
		mp2.position = new Vec2(5760, 1280);
		mp2.direction = "vertical";
		mp2.distance = 384;
		mp2.speed = 50;
		mp2.waitTime = 0.5;

		// Fast horizontal platform in final section
		const mp3 = this.add(MovingPlatform);
		mp3.position = new Vec2(8000, 1472);
		mp3.direction = "horizontal";
		mp3.distance = 320;
		mp3.speed = 100;
		mp3.waitTime = 0.2;
	}
}
