import { Color, Vec2 } from "@quintus/math";
import { MovingPlatform } from "../entities/moving-platform.js";
import { BaseLevelScene } from "./base-level-scene.js";

/**
 * Level 2 — Desert Ruins.
 * Brown terrain, ladders, fall-away platforms, key/lock, water hazards.
 */
export class Level2Scene extends BaseLevelScene {
	readonly tmxAsset = "level2";
	readonly sceneName = "level2";
	readonly nextSceneName = "level3";
	readonly levelNumber = 2;

	protected override readonly bgSkyTexture = "bg_solid_sand";
	protected override readonly bgCloudsTexture = "bg_clouds";
	protected override readonly bgHillsTexture = "bg_color_desert";
	protected override readonly bgFillBelowColor = Color.fromHex("#f3c7a5");

	protected override _spawnEnemiesFromTiles(): void {
		super._spawnEnemiesFromTiles();

		// Horizontal moving platform over pit section
		const mp1 = this.add(MovingPlatform);
		mp1.position = new Vec2(2880, 1088);
		mp1.direction = "horizontal";
		mp1.distance = 320;
		mp1.speed = 70;
		mp1.waitTime = 0.3;

		// Vertical moving platform near ladder area
		const mp2 = this.add(MovingPlatform);
		mp2.position = new Vec2(5440, 960);
		mp2.direction = "vertical";
		mp2.distance = 256;
		mp2.speed = 60;
		mp2.waitTime = 0.5;

		// Horizontal platform near the end
		const mp3 = this.add(MovingPlatform);
		mp3.position = new Vec2(6720, 1088);
		mp3.direction = "horizontal";
		mp3.distance = 200;
		mp3.speed = 90;
		mp3.waitTime = 0.3;
	}
}
