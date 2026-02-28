import type { Game } from "@quintus/core";
import { SpriteSheet, TextureAtlas } from "@quintus/sprites";

// ─── Atlas Instances (populated by loadAtlases) ─────────────────

export let tileAtlas: TextureAtlas;
export let charAtlas: TextureAtlas;
export let enemyAtlas: TextureAtlas;

// ─── SpriteSheet Instances (populated by loadAtlases) ───────────

export let playerSheet: SpriteSheet;
export let slimeSheet: SpriteSheet;
export let beeSheet: SpriteSheet;
export let snailSheet: SpriteSheet;
export let frogSheet: SpriteSheet;
export let sawSheet: SpriteSheet;

// ─── Grid Constants ─────────────────────────────────────────────

/** Characters spritesheet: 128×128 px frames, 1px spacing, 7 columns. */
const CHAR_COLS = 7;
const CHAR_SPACING = 1;

/** Enemies spritesheet: 64×64 px frames, 1px spacing, 8 columns. */
const ENEMY_COLS = 8;
const ENEMY_SPACING = 1;

// ─── Named Tile Frames (for Sprite.sourceRect lookups via tileAtlas) ─

export const FRAME = {
	// HUD elements
	HUD_HEART: "hud_heart",
	HUD_HEART_HALF: "hud_heart_half",
	HUD_HEART_EMPTY: "hud_heart_empty",
	HUD_COIN: "hud_coin",
	HUD_MULTIPLY: "hud_character_multiply",
	HUD_KEY_RED: "hud_key_red",
	HUD_KEY_BLUE: "hud_key_blue",
	HUD_KEY_GREEN: "hud_key_green",
	HUD_KEY_YELLOW: "hud_key_yellow",

	// Collectibles
	COIN_GOLD: "coin_gold",
	COIN_SILVER: "coin_silver",
	COIN_BRONZE: "coin_bronze",
	COIN_GOLD_SIDE: "coin_gold_side",
	GEM_BLUE: "gem_blue",
	GEM_GREEN: "gem_green",
	GEM_RED: "gem_red",
	GEM_YELLOW: "gem_yellow",
	HEART: "heart",
	STAR: "star",

	// Keys and locks
	KEY_RED: "key_red",
	KEY_BLUE: "key_blue",
	KEY_GREEN: "key_green",
	KEY_YELLOW: "key_yellow",
	LOCK_RED: "lock_red",
	LOCK_BLUE: "lock_blue",
	LOCK_GREEN: "lock_green",
	LOCK_YELLOW: "lock_yellow",

	// Interactive blocks
	BLOCK_COIN: "block_coin",
	BLOCK_COIN_ACTIVE: "block_coin_active",
	BLOCK_EXCLAMATION: "block_exclamation",
	BLOCK_EXCLAMATION_ACTIVE: "block_exclamation_active",
	BLOCK_EMPTY: "block_empty",
	BLOCK_EMPTY_WARNING: "block_empty_warning",
	BRICK_BROWN: "brick_brown",
	BRICK_GREY: "brick_grey",
	BRICKS_BROWN: "bricks_brown",
	BRICKS_GREY: "bricks_grey",

	// Spring
	SPRING: "spring",
	SPRING_OUT: "spring_out",

	// Hazards
	SPIKES: "spikes",
	BLOCK_SPIKES: "block_spikes",
	SAW: "saw",

	// Doors and flags
	DOOR_CLOSED: "door_closed",
	DOOR_CLOSED_TOP: "door_closed_top",
	DOOR_OPEN: "door_open",
	DOOR_OPEN_TOP: "door_open_top",
	FLAG_OFF: "flag_off",
	FLAG_YELLOW_A: "flag_yellow_a",
	FLAG_YELLOW_B: "flag_yellow_b",

	// Character front (for title/menus)
	CHAR_GREEN_FRONT: "character_green_front",
} as const;

// ─── HUD Digit Frames ──────────────────────────────────────────

/** Frame names for HUD digit sprites (0-9). */
export const HUD_DIGITS = [
	"hud_character_0",
	"hud_character_1",
	"hud_character_2",
	"hud_character_3",
	"hud_character_4",
	"hud_character_5",
	"hud_character_6",
	"hud_character_7",
	"hud_character_8",
	"hud_character_9",
] as const;

// ─── Load Function ──────────────────────────────────────────────

/**
 * Parse texture atlases and build SpriteSheets from loaded assets.
 * Call this after game.assets.load() completes.
 */
export function loadAtlases(game: Game): void {
	// Parse atlases from XML
	tileAtlas = TextureAtlas.fromXml(game.assets.require<string>("tiles"), "tiles");
	charAtlas = TextureAtlas.fromXml(game.assets.require<string>("characters"), "characters");
	enemyAtlas = TextureAtlas.fromXml(game.assets.require<string>("enemies"), "enemies");

	// Build SpriteSheets for AnimatedSprite usage
	const ci = makeFrameIndex(charAtlas, CHAR_COLS, CHAR_SPACING);
	playerSheet = new SpriteSheet({
		texture: "characters",
		frameWidth: 128,
		frameHeight: 128,
		columns: CHAR_COLS,
		spacing: CHAR_SPACING,
		animations: {
			idle: { frames: [ci("character_green_idle")], fps: 1, loop: true },
			walk: {
				frames: [ci("character_green_walk_a"), ci("character_green_walk_b")],
				fps: 6,
				loop: true,
			},
			jump: { frames: [ci("character_green_jump")], fps: 1, loop: false },
			duck: { frames: [ci("character_green_duck")], fps: 1, loop: false },
			climb: {
				frames: [ci("character_green_climb_a"), ci("character_green_climb_b")],
				fps: 4,
				loop: true,
			},
			hit: { frames: [ci("character_green_hit")], fps: 1, loop: false },
		},
	});

	const ei = makeFrameIndex(enemyAtlas, ENEMY_COLS, ENEMY_SPACING);
	slimeSheet = new SpriteSheet({
		texture: "enemies",
		frameWidth: 64,
		frameHeight: 64,
		columns: ENEMY_COLS,
		spacing: ENEMY_SPACING,
		animations: {
			walk: {
				frames: [ei("slime_normal_walk_a"), ei("slime_normal_walk_b")],
				fps: 4,
				loop: true,
			},
			rest: { frames: [ei("slime_normal_rest")], fps: 1, loop: false },
			flat: { frames: [ei("slime_normal_flat")], fps: 1, loop: false },
		},
	});

	beeSheet = new SpriteSheet({
		texture: "enemies",
		frameWidth: 64,
		frameHeight: 64,
		columns: ENEMY_COLS,
		spacing: ENEMY_SPACING,
		animations: {
			fly: { frames: [ei("bee_a"), ei("bee_b")], fps: 6, loop: true },
			rest: { frames: [ei("bee_rest")], fps: 1, loop: false },
		},
	});

	snailSheet = new SpriteSheet({
		texture: "enemies",
		frameWidth: 64,
		frameHeight: 64,
		columns: ENEMY_COLS,
		spacing: ENEMY_SPACING,
		animations: {
			walk: {
				frames: [ei("snail_walk_a"), ei("snail_walk_b")],
				fps: 3,
				loop: true,
			},
			rest: { frames: [ei("snail_rest")], fps: 1, loop: false },
			shell: { frames: [ei("snail_shell")], fps: 1, loop: false },
		},
	});

	frogSheet = new SpriteSheet({
		texture: "enemies",
		frameWidth: 64,
		frameHeight: 64,
		columns: ENEMY_COLS,
		spacing: ENEMY_SPACING,
		animations: {
			idle: { frames: [ei("frog_idle")], fps: 1, loop: false },
			jump: { frames: [ei("frog_jump")], fps: 1, loop: false },
			rest: { frames: [ei("frog_rest")], fps: 1, loop: false },
		},
	});

	sawSheet = new SpriteSheet({
		texture: "enemies",
		frameWidth: 64,
		frameHeight: 64,
		columns: ENEMY_COLS,
		spacing: ENEMY_SPACING,
		animations: {
			spin: { frames: [ei("saw_a"), ei("saw_b")], fps: 8, loop: true },
			rest: { frames: [ei("saw_rest")], fps: 1, loop: false },
		},
	});
}

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Create a function that maps atlas frame names to SpriteSheet grid indices.
 * This works because Kenney spritesheets are uniform grids with consistent spacing.
 */
function makeFrameIndex(
	atlas: TextureAtlas,
	columns: number,
	spacing: number,
): (name: string) => number {
	return (name: string) => {
		const rect = atlas.getFrameOrThrow(name);
		const fw = rect.width;
		const fh = rect.height;
		const col = Math.round(rect.x / (fw + spacing));
		const row = Math.round(rect.y / (fh + spacing));
		return row * columns + col;
	};
}
