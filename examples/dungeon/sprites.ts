import { SpriteSheet } from "@quintus/sprites";

/** Kenney Tiny Dungeon tileset: 16x16, 12 cols, 11 rows, 1px spacing, 132 tiles. */
export const entitySheet = new SpriteSheet({
	texture: "tileset",
	frameWidth: 16,
	frameHeight: 16,
	columns: 12,
	rows: 11,
	spacing: 1,
	animations: {
		// Player (knight 1, tile 96)
		player_idle: { frames: [96], fps: 1, loop: false },
		player_walk: { frames: [96, 96], fps: 6, loop: true },

		// Dwarf enemy (tile 87)
		dwarf_idle: { frames: [87], fps: 1, loop: false },
		dwarf_walk: { frames: [87, 87], fps: 4, loop: true },

		// Barbarian enemy (tile 88)
		barbarian_idle: { frames: [88], fps: 1, loop: false },
		barbarian_walk: { frames: [88, 88], fps: 4, loop: true },

		// Props
		chest_closed: { frames: [89], fps: 1, loop: false },
		chest_opening: { frames: [90], fps: 1, loop: false },
		chest_open: { frames: [91], fps: 1, loop: false },
		door_closed: { frames: [45], fps: 1, loop: false },
		door_opening_1: { frames: [33], fps: 1, loop: false },
		door_opening_2: { frames: [21], fps: 1, loop: false },
		door_open: { frames: [9], fps: 1, loop: false },

		// Health pickup (red potion used as "heart")
		heart: { frames: [115], fps: 1, loop: false },

		// Potions (used for health display)
		potion_red: { frames: [115], fps: 1, loop: false },
		potion_gray: { frames: [113], fps: 1, loop: false },
		potion_green: { frames: [114], fps: 1, loop: false },
		potion_blue: { frames: [116], fps: 1, loop: false },

		// Equipment (single-frame for display)
		sword_small: { frames: [103], fps: 1, loop: false },
		sword_large: { frames: [104], fps: 1, loop: false },
		sword_barbarian: { frames: [105], fps: 1, loop: false },
		shield_wooden: { frames: [101], fps: 1, loop: false },
		shield_metal: { frames: [102], fps: 1, loop: false },
	},
});

/** 0-based tile indices for Sprite sourceRect lookups via entitySheet.getFrameRect(). */
export const TILE = {
	PLAYER: 96,
	DWARF: 87,
	BARBARIAN: 88,

	CHEST_CLOSED: 89,
	CHEST_OPENING: 90,
	CHEST_OPEN: 91,
	DOOR_CLOSED: 45,
	DOOR_OPENING_1: 33,
	DOOR_OPENING_2: 21,
	DOOR_OPEN: 9,

	POTION_RED: 115,
	POTION_GRAY: 113,
	POTION_GREEN: 114,
	POTION_BLUE: 116,

	SWORD_SMALL: 103,
	SWORD_LARGE: 104,
	SWORD_BARBARIAN: 105,
	HAND_AXE: 119,
	SHIELD_WOODEN: 101,
	SHIELD_METAL: 102,

	// HUD health icons (potions)
	HEALTH_FULL: 115,
	HEALTH_EMPTY: 113,
} as const;
