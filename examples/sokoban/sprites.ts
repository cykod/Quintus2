import { SpriteSheet } from "@quintus/sprites";

// === SpriteSheet for the 13×8 grid tileset (64×64 cells) ===
// Frame indices are 0-based, row-major (row * 13 + col)
export const tileSheet = new SpriteSheet({
	texture: "tileset",
	frameWidth: 64,
	frameHeight: 64,
	columns: 13,
	rows: 8,
});

// === Frame indices (0-based, verified against tileset.png) ===

// Crates
export const FRAME_CRATE_BLUE = 14; // brown wooden crate front (standard)
export const FRAME_CRATE_ON_TARGET = 17; // green crate front (solved state)

// Walls
export const FRAME_WALL = 11; // dark grey/charcoal wall block

// Targets
export const FRAME_TARGET = 50; // blue diamond on dark background

// Floors
export const FRAME_FLOOR = 89; // grey stone mosaic floor

// Player — direction frames
export const FRAME_PLAYER_DOWN = 52;
export const FRAME_PLAYER_LEFT = 65;
export const FRAME_PLAYER_UP = 78;
export const FRAME_PLAYER_RIGHT = 91;
