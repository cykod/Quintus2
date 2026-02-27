import type { CollisionGroupsConfig } from "@quintus/physics";

// === Game dimensions ===
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 640;

// === Player ===
export const PLAYER_SPEED = 250;
export const PLAYER_MAX_HEALTH = 3;
export const PLAYER_FIRE_RATE = 0.2; // seconds between shots
export const PLAYER_RAPID_FIRE_RATE = 0.1;
export const PLAYER_INVINCIBILITY_DURATION = 2;

// === Bullets ===
export const PLAYER_BULLET_SPEED = 500;
export const ENEMY_BULLET_SPEED = 250;

// === Enemies ===
export const BASIC_ENEMY_SPEED = 120;
export const BASIC_ENEMY_HP = 1;
export const BASIC_ENEMY_POINTS = 10;

export const WEAVER_ENEMY_SPEED = 80;
export const WEAVER_ENEMY_HP = 1;
export const WEAVER_ENEMY_POINTS = 20;
export const WEAVER_AMPLITUDE = 60;
export const WEAVER_FREQUENCY = 3;

export const BOMBER_ENEMY_SPEED = 70;
export const BOMBER_ENEMY_HP = 2;
export const BOMBER_ENEMY_POINTS = 30;
export const BOMBER_FIRE_INTERVAL = 1.5;

export const BOSS_SPEED = 60;
export const BOSS_HP = 20;
export const BOSS_POINTS = 500;
export const BOSS_FIRE_INTERVAL = 0.8;
export const BOSS_WAVE_INTERVAL = 3; // boss every N waves

// === Power-ups ===
export const POWERUP_FALL_SPEED = 80;
export const POWERUP_DROP_CHANCE = 0.2;
export const SHIELD_DURATION = 8;
export const RAPID_FIRE_DURATION = 10;
export const SPREAD_SHOT_DURATION = 10;

// === Collision groups ===
export const COLLISION_GROUPS: CollisionGroupsConfig = {
	player: { collidesWith: ["enemies", "eBullets", "powerups"] },
	pBullets: { collidesWith: ["enemies"] },
	enemies: { collidesWith: ["player", "pBullets"] },
	eBullets: { collidesWith: ["player"] },
	powerups: { collidesWith: ["player"] },
};

// === Input bindings ===
export const INPUT_BINDINGS: Record<string, string[]> = {
	left: ["ArrowLeft", "KeyA", "gamepad:left-stick-left", "gamepad:dpad-left"],
	right: ["ArrowRight", "KeyD", "gamepad:left-stick-right", "gamepad:dpad-right"],
	up: ["ArrowUp", "KeyW", "gamepad:left-stick-up", "gamepad:dpad-up"],
	down: ["ArrowDown", "KeyS", "gamepad:left-stick-down", "gamepad:dpad-down"],
	fire: ["Space", "gamepad:a", "gamepad:rt"],
};
