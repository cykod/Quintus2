import type { CollisionGroupsConfig } from "@quintus/physics";

// === Game dimensions ===
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

// === Arena ===
export const WALL_THICKNESS = 16;
export const ARENA_LEFT = WALL_THICKNESS;
export const ARENA_TOP = WALL_THICKNESS;
export const ARENA_RIGHT = GAME_WIDTH - WALL_THICKNESS;
export const ARENA_BOTTOM = GAME_HEIGHT - WALL_THICKNESS;
export const ARENA_WIDTH = ARENA_RIGHT - ARENA_LEFT;
export const ARENA_HEIGHT = ARENA_BOTTOM - ARENA_TOP;

// === Player ===
export const PLAYER_SPEED = 150;
export const PLAYER_RADIUS = 12;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_INVINCIBILITY_DURATION = 1.0;

// === Enemies ===
export const ENEMY_RADIUS = 12;
export const ENEMY_SPAWN_MIN_DISTANCE = 150;

// === Collision groups ===
export const COLLISION_GROUPS: CollisionGroupsConfig = {
	player: { collidesWith: ["walls", "enemies", "enemy_bullets"] },
	walls: { collidesWith: ["player", "enemies", "player_bullets", "enemy_bullets"] },
	enemies: { collidesWith: ["walls", "player_bullets", "player"] },
	player_bullets: { collidesWith: ["walls", "enemies"] },
	enemy_bullets: { collidesWith: ["walls", "player"] },
	pickups: { collidesWith: ["player"] },
};

// === Input bindings ===
export const INPUT_BINDINGS: Record<string, string[]> = {
	move_up: ["KeyW", "ArrowUp"],
	move_down: ["KeyS", "ArrowDown"],
	move_left: ["KeyA", "ArrowLeft"],
	move_right: ["KeyD", "ArrowRight"],
	fire: ["Space"],
	reload: ["KeyR"],
	weapon1: ["Digit1"],
	weapon2: ["Digit2"],
	weapon3: ["Digit3"],
};
