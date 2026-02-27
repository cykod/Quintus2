import type { WaveEntry } from "@quintus/ai-prefabs";
import type { CollisionGroupsConfig } from "@quintus/physics";

// === Game dimensions ===
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 640;

// === Grid ===
export const CELL_SIZE = 64;
export const GRID_COLS = 7; // 480 / 64 ≈ 7.5, use 7 cols centered
export const GRID_ROWS = 8; // 8 rows of grid for gameplay, HUD below
export const GRID_OFFSET_X = (GAME_WIDTH - GRID_COLS * CELL_SIZE) / 2; // center the grid
export const GRID_OFFSET_Y = 16; // small top margin

// === Towers ===
export const TOWER_ARROW_COST = 50;
export const TOWER_ARROW_RANGE = 140;
export const TOWER_ARROW_DAMAGE = 1;
export const TOWER_ARROW_FIRE_RATE = 1.0; // seconds between shots

export const TOWER_CANNON_COST = 100;
export const TOWER_CANNON_RANGE = 120;
export const TOWER_CANNON_DAMAGE = 3;
export const TOWER_CANNON_FIRE_RATE = 2.0;
export const TOWER_CANNON_SPLASH_RADIUS = 50;

export const TOWER_SLOW_COST = 75;
export const TOWER_SLOW_RANGE = 130;
export const TOWER_SLOW_DAMAGE = 0;
export const TOWER_SLOW_FIRE_RATE = 1.5;
export const TOWER_SLOW_MULTIPLIER = 0.4; // speed multiplied by this
export const TOWER_SLOW_DURATION = 2.0; // seconds

// === Enemies ===
export const BASIC_CREEP_SPEED = 60;
export const BASIC_CREEP_HP = 5;
export const BASIC_CREEP_GOLD = 10;

export const FAST_CREEP_SPEED = 120;
export const FAST_CREEP_HP = 3;
export const FAST_CREEP_GOLD = 15;

export const TANK_CREEP_SPEED = 35;
export const TANK_CREEP_HP = 15;
export const TANK_CREEP_GOLD = 25;

// === Projectiles ===
export const PROJECTILE_SPEED = 300;

// === Economy ===
export const STARTING_GOLD = 200;
export const STARTING_LIVES = 20;

// === Wave definitions ===
// Wave composition scales difficulty: wave 1 is basic-only, later waves mix in fast/tank
// enemies with increasing counts. Wave 5 is the boss wave with all three types.
export const WAVE_DEFS: WaveEntry[][] = [
	[{ type: "basic", count: 5 }],
	[
		{ type: "basic", count: 4 },
		{ type: "fast", count: 3 },
	],
	[
		{ type: "basic", count: 5 },
		{ type: "fast", count: 4 },
		{ type: "tank", count: 1 },
	],
	[
		{ type: "fast", count: 5 },
		{ type: "tank", count: 3 },
	],
	[
		{ type: "basic", count: 6 },
		{ type: "fast", count: 5 },
		{ type: "tank", count: 4 },
	],
];
export const WAVE_COUNT = WAVE_DEFS.length;
export const SPAWN_INTERVAL = 0.8; // seconds between enemy spawns
export const WAVE_DELAY = 3.0; // seconds between waves

// === Collision groups ===
export const COLLISION_GROUPS: CollisionGroupsConfig = {
	towers: { collidesWith: ["enemies"] },
	enemies: { collidesWith: ["towers"] },
};

// === Input bindings ===
export const INPUT_BINDINGS: Record<string, string[]> = {
	select: ["mouse:left", "Space"],
	tower_arrow: ["Digit1", "Numpad1"],
	tower_cannon: ["Digit2", "Numpad2"],
	tower_slow: ["Digit3", "Numpad3"],
};
