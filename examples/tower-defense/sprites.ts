import { SpriteSheet } from "@quintus/sprites";

// === SpriteSheet for the 23×13 grid tileset (64×64 cells) ===
// Frame indices are 0-based (CSV uses 1-based, subtract 1)
export const tileSheet = new SpriteSheet({
	texture: "tileset",
	frameWidth: 64,
	frameHeight: 64,
	columns: 23,
	rows: 13,
});

// === Frame indices (0-based from CSV's 1-based) ===

// Terrain
export const FRAME_GRASS = 12; // csv 13
export const FRAME_SAND = 5; // csv 6
export const FRAME_GREY = 9; // csv 10

// Path segments
export const FRAME_PATH_H = 16; // csv 17
export const FRAME_PATH_V = 17; // csv 18
export const FRAME_PATH_CORNER_TL = 18; // csv 19
export const FRAME_PATH_CORNER_TR = 19; // csv 20
export const FRAME_PATH_CORNER_BL = 20; // csv 21
export const FRAME_PATH_CORNER_BR = 21; // csv 22
export const FRAME_PATH_CROSS = 22; // csv 23
export const FRAME_PATH_T_UP = 39; // csv 40
export const FRAME_PATH_T_DOWN = 40; // csv 41
export const FRAME_PATH_T_LEFT = 41; // csv 42
export const FRAME_PATH_T_RIGHT = 42; // csv 43
export const FRAME_PATH_END_TOP = 43; // csv 44
export const FRAME_PATH_END_BOTTOM = 44; // csv 45
export const FRAME_PATH_END_LEFT = 45; // csv 46

// Tower bases
export const FRAME_TOWER_BASE_SMALL = 202; // csv 203
export const FRAME_TOWER_BASE_CROSS = 225; // csv 226
export const FRAME_TOWER_BASE_SQUARE = 226; // csv 227
export const FRAME_TOWER_BASE_ROUND = 227; // csv 228
export const FRAME_TOWER_BASE_PENTAGON = 228; // csv 229

// Turrets
export const FRAME_TURRET_ARROW = 203; // csv 204
export const FRAME_TURRET_CANNON = 204; // csv 205
export const FRAME_TURRET_SLOW = 248; // csv 249

// Enemies
export const FRAME_ENEMY_BASIC = 245; // csv 246 — green UFO
export const FRAME_ENEMY_FAST = 246; // csv 247
export const FRAME_ENEMY_TANK = 247; // csv 248

// Projectiles
export const FRAME_ARROW = 296; // csv 297
export const FRAME_CANNONBALL = 250; // csv 251
export const FRAME_SLOW_EFFECT = 294; // csv 295

// UI
export const FRAME_COIN = 271; // csv 272
