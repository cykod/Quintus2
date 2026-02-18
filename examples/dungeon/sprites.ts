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
		// Player (brown-haired adventurer, tile 85)
		player_idle: { frames: [85], fps: 1, loop: false },
		player_walk: { frames: [85, 85], fps: 6, loop: true },

		// Skeleton enemy (tile 87)
		skeleton_idle: { frames: [87], fps: 1, loop: false },
		skeleton_walk: { frames: [87, 87], fps: 4, loop: true },

		// Orc enemy (green goblin/orc, tile 114)
		orc_idle: { frames: [114], fps: 1, loop: false },
		orc_walk: { frames: [114, 114], fps: 4, loop: true },

		// Props
		chest_closed: { frames: [46], fps: 1, loop: false },
		chest_open: { frames: [47], fps: 1, loop: false },
		door_closed: { frames: [75], fps: 1, loop: false },
		door_open: { frames: [22], fps: 1, loop: false },

		// Pickups
		heart: { frames: [45], fps: 1, loop: false },
		key_item: { frames: [101], fps: 1, loop: false },

		// Equipment (single-frame for display)
		sword_1: { frames: [93], fps: 1, loop: false },
		sword_2: { frames: [119], fps: 1, loop: false },
		sword_3: { frames: [119], fps: 1, loop: false },
		shield_1: { frames: [66], fps: 1, loop: false },
		shield_2: { frames: [122], fps: 1, loop: false },
	},
});

/** 0-based tile indices for Sprite sourceRect lookups via entitySheet.getFrameRect(). */
export const TILE = {
	PLAYER: 85,
	SKELETON: 87,
	ORC: 114,

	CHEST_CLOSED: 46,
	CHEST_OPEN: 47,
	DOOR_CLOSED: 75,
	DOOR_OPEN: 22,

	HEART: 45,
	KEY: 101,
	SWORD_1: 93,
	SWORD_2: 119,
	SWORD_3: 119,
	SHIELD_1: 66,
	SHIELD_2: 122,

	// HUD heart icons
	HEART_FULL: 45,
	HEART_EMPTY: 44,
} as const;
