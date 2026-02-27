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
export const PLAYER_RADIUS = 8;
export const PLAYER_CAPSULE_HEIGHT = 24;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_INVINCIBILITY_DURATION = 1.0;

// === Enemies ===
export const ENEMY_RADIUS = 8;
export const ENEMY_CAPSULE_HEIGHT = 24;
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
	move_up: ["KeyW", "ArrowUp", "gamepad:left-stick-up", "gamepad:dpad-up"],
	move_down: ["KeyS", "ArrowDown", "gamepad:left-stick-down", "gamepad:dpad-down"],
	move_left: ["KeyA", "ArrowLeft", "gamepad:left-stick-left", "gamepad:dpad-left"],
	move_right: ["KeyD", "ArrowRight", "gamepad:left-stick-right", "gamepad:dpad-right"],
	aim_up: ["gamepad:right-stick-up"],
	aim_down: ["gamepad:right-stick-down"],
	aim_left: ["gamepad:right-stick-left"],
	aim_right: ["gamepad:right-stick-right"],
	fire: ["Space", "mouse:left", "gamepad:rt"],
	weapon1: ["Digit1", "gamepad:x"],
	weapon2: ["Digit2", "gamepad:y"],
	weapon3: ["Digit3", "gamepad:b"],
};
