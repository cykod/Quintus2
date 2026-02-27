import type { Game } from "@quintus/core";
import { TextureAtlas } from "@quintus/sprites";

// === Atlas instances (populated by loadAtlases) ===
export let paddlesAtlas: TextureAtlas;
export let ballsAtlas: TextureAtlas;
export let tilesBlueAtlas: TextureAtlas;
export let tilesRedAtlas: TextureAtlas;
export let tilesGreenAtlas: TextureAtlas;
export let tilesYellowAtlas: TextureAtlas;
export let tilesGreyAtlas: TextureAtlas;
export let coinsAtlas: TextureAtlas;

// === Scale factors (source pixels → game pixels) ===
/** paddle_05.png (520×140) → 80×16 */
export const PADDLE_SCALE_X = 80 / 520;
export const PADDLE_SCALE_Y = 16 / 140;

/** paddle_06.png (640×140) → 120×16 */
export const PADDLE_WIDE_SCALE_X = 120 / 640;

/** ballBlue_01.png (128×128) → 12×12 */
export const BALL_SCALE = 12 / 128;

/** tileXxx_02.png (188×88) → 40×20 */
export const BRICK_SCALE_X = 40 / 188;
export const BRICK_SCALE_Y = 20 / 88;

/** coin_XX.png (128×128) → 24×24 */
export const COIN_SCALE = 24 / 128;

// === Frame names ===
export const FRAME = {
	PADDLE_NORMAL: "paddle_05.png",
	PADDLE_WIDE: "paddle_06.png",
	BALL: "ballBlue_01.png",
	BRICK_BLUE: "tileBlue_02.png",
	BRICK_RED: "tileRed_02.png",
	BRICK_GREEN: "tileGreen_02.png",
	BRICK_YELLOW: "tileYellow_02.png",
	BRICK_GREY: "tileGrey_02.png",
	COIN_BLUE: "coin_01.png",
	COIN_GREY: "coin_11.png",
	COIN_YELLOW: "coin_21.png",
	COIN_BRONZE: "coin_31.png",
} as const;

/**
 * Parse all XML atlases from loaded custom assets.
 * Must be called after game.assets.load() completes.
 */
export function loadAtlases(game: Game): void {
	paddlesAtlas = TextureAtlas.fromXml(game.assets.require<string>("paddles"), "paddles");
	ballsAtlas = TextureAtlas.fromXml(game.assets.require<string>("balls"), "balls");
	tilesBlueAtlas = TextureAtlas.fromXml(game.assets.require<string>("tiles_blue"), "tiles_blue");
	tilesRedAtlas = TextureAtlas.fromXml(game.assets.require<string>("tiles_red"), "tiles_red");
	tilesGreenAtlas = TextureAtlas.fromXml(game.assets.require<string>("tiles_green"), "tiles_green");
	tilesYellowAtlas = TextureAtlas.fromXml(
		game.assets.require<string>("tiles_yellow"),
		"tiles_yellow",
	);
	tilesGreyAtlas = TextureAtlas.fromXml(game.assets.require<string>("tiles_grey"), "tiles_grey");
	coinsAtlas = TextureAtlas.fromXml(game.assets.require<string>("coins"), "coins");
}
