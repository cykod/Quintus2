import type { Game } from "@quintus/core";
import { SpriteSheet, TextureAtlas } from "@quintus/sprites";

// === Atlas instance (populated by loadAtlas) ===
export let tilesetAtlas: TextureAtlas;

// === Scale factors (source pixels -> game pixels) ===
/** playerShip1_blue.png (99x75) -> ~40x30 */
export const PLAYER_SCALE_X = 40 / 99;
export const PLAYER_SCALE_Y = 30 / 75;

/** enemyBlack1.png (93x84) -> ~36x32 */
export const BASIC_ENEMY_SCALE_X = 36 / 93;
export const BASIC_ENEMY_SCALE_Y = 32 / 84;

/** enemyBlue2.png (104x84) -> ~36x28 */
export const WEAVER_ENEMY_SCALE_X = 36 / 104;
export const WEAVER_ENEMY_SCALE_Y = 28 / 84;

/** enemyRed3.png (103x84) -> ~36x28 */
export const BOMBER_ENEMY_SCALE_X = 36 / 103;
export const BOMBER_ENEMY_SCALE_Y = 28 / 84;

/** ufoRed.png (91x91) -> ~60x60 */
export const BOSS_SCALE = 60 / 91;

/** laserBlue01.png (9x54) -> ~6x20 */
export const PLAYER_BULLET_SCALE_X = 6 / 9;
export const PLAYER_BULLET_SCALE_Y = 20 / 54;

/** laserRed01.png (9x54) -> ~6x20 */
export const ENEMY_BULLET_SCALE_X = 6 / 9;
export const ENEMY_BULLET_SCALE_Y = 20 / 54;

/** laserGreen02.png (13x57) -> ~8x20 */
export const SPREAD_BULLET_SCALE_X = 8 / 13;
export const SPREAD_BULLET_SCALE_Y = 20 / 57;

/** powerup icons (34x33) -> ~24x24 */
export const POWERUP_SCALE = 24 / 34;

/** shield1.png (133x108) -> ~50x40 */
export const SHIELD_SCALE_X = 50 / 133;
export const SHIELD_SCALE_Y = 40 / 108;

/** star sprites (24-25px) -> ~8x8 */
export const STAR_SCALE = 8 / 25;

// === Frame names ===
export const FRAME = {
	PLAYER: "playerShip1_blue.png",
	BASIC_ENEMY: "enemyBlack1.png",
	WEAVER_ENEMY: "enemyBlue2.png",
	BOMBER_ENEMY: "enemyRed3.png",
	BOSS: "ufoRed.png",
	PLAYER_BULLET: "laserBlue01.png",
	ENEMY_BULLET: "laserRed01.png",
	SPREAD_BULLET: "laserGreen02.png",
	POWERUP_SHIELD: "powerupBlue_shield.png",
	POWERUP_RAPID: "powerupBlue_bolt.png",
	POWERUP_SPREAD: "powerupGreen_star.png",
	SHIELD_EFFECT: "shield1.png",
	STAR1: "star1.png",
	STAR2: "star2.png",
	STAR3: "star3.png",
} as const;

// === Particle spritesheet (flash + explosion, 9 cols x 2 rows, 64x64 cells) ===
export const particleSheet = new SpriteSheet({
	texture: "particles",
	frameWidth: 64,
	frameHeight: 64,
	columns: 9,
	rows: 2,
	animations: {
		flash: { frames: [0, 1, 2, 3, 4, 5, 6, 7, 8], fps: 30, loop: false },
		explosion: { frames: [9, 10, 11, 12, 13, 14, 15, 16, 17], fps: 24, loop: false },
	},
});

/**
 * Parse the XML atlas from loaded assets.
 * Must be called after game.assets.load() completes.
 */
export function loadAtlas(game: Game): void {
	tilesetAtlas = TextureAtlas.fromXml(game.assets.get<string>("tileset")!, "tileset");
}
