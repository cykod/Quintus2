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

	// Platforms
	BRIDGE: "bridge",
	BRIDGE_LOGS: "bridge_logs",

	// Spring
	SPRING: "spring",
	SPRING_OUT: "spring_out",

	// Hazards
	SPIKES: "spikes",
	BLOCK_SPIKES: "block_spikes",
	SAW: "saw",

	// Water & Lava
	WATER: "water",
	WATER_TOP: "water_top",
	WATER_TOP_LOW: "water_top_low",
	LAVA: "lava",
	LAVA_TOP: "lava_top",
	LAVA_TOP_LOW: "lava_top_low",

	// Cloud platform tiles
	CLOUD_LEFT: "terrain_grass_cloud_left",
	CLOUD_MIDDLE: "terrain_grass_cloud_middle",
	CLOUD_RIGHT: "terrain_grass_cloud_right",

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

	// Build SpriteSheets from atlases using frame names directly
	playerSheet = SpriteSheet.fromAtlas(charAtlas, {
		idle: { frames: ["character_green_idle"], fps: 1, loop: true },
		walk: {
			frames: ["character_green_walk_a", "character_green_walk_b"],
			fps: 6,
			loop: true,
		},
		jump: { frames: ["character_green_jump"], fps: 1, loop: false },
		duck: { frames: ["character_green_duck"], fps: 1, loop: false },
		climb: {
			frames: ["character_green_climb_a", "character_green_climb_b"],
			fps: 4,
			loop: true,
		},
		hit: { frames: ["character_green_hit"], fps: 1, loop: false },
	});

	slimeSheet = SpriteSheet.fromAtlas(enemyAtlas, {
		walk: {
			frames: ["slime_normal_walk_a", "slime_normal_walk_b"],
			fps: 4,
			loop: true,
		},
		rest: { frames: ["slime_normal_rest"], fps: 1, loop: false },
		flat: { frames: ["slime_normal_flat"], fps: 1, loop: false },
	});

	beeSheet = SpriteSheet.fromAtlas(enemyAtlas, {
		fly: { frames: ["bee_a", "bee_b"], fps: 6, loop: true },
		rest: { frames: ["bee_rest"], fps: 1, loop: false },
	});

	snailSheet = SpriteSheet.fromAtlas(enemyAtlas, {
		walk: {
			frames: ["snail_walk_a", "snail_walk_b"],
			fps: 3,
			loop: true,
		},
		rest: { frames: ["snail_rest"], fps: 1, loop: false },
		shell: { frames: ["snail_shell"], fps: 1, loop: false },
	});

	frogSheet = SpriteSheet.fromAtlas(enemyAtlas, {
		idle: { frames: ["frog_idle"], fps: 1, loop: false },
		jump: { frames: ["frog_jump"], fps: 1, loop: false },
		rest: { frames: ["frog_rest"], fps: 1, loop: false },
	});

	sawSheet = SpriteSheet.fromAtlas(enemyAtlas, {
		spin: { frames: ["saw_a", "saw_b"], fps: 8, loop: true },
		rest: { frames: ["saw_rest"], fps: 1, loop: false },
	});
}
