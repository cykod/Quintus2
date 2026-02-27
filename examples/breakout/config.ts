import type { CollisionGroupsConfig } from "@quintus/physics";

// === Game dimensions ===
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 640;

// === Paddle ===
export const PADDLE_WIDTH = 80;
export const PADDLE_WIDE_WIDTH = 120;
export const PADDLE_HEIGHT = 16;
export const PADDLE_Y = 610;
export const PADDLE_SPEED = 350;

// === Ball ===
export const BALL_RADIUS = 6;
export const BALL_SPEED = 300;
export const MAX_BOUNCES = 4;

// === Bricks ===
export const BRICK_WIDTH = 40;
export const BRICK_HEIGHT = 20;
export const BRICK_COLS = 10;
export const BRICK_GAP = 2;
export const BRICK_START_X = 51;
export const BRICK_START_Y = 60;
export const BRICK_STEP_X = BRICK_WIDTH + BRICK_GAP;
export const BRICK_STEP_Y = BRICK_HEIGHT + BRICK_GAP;

// === Power-ups ===
export const POWERUP_FALL_SPEED = 100;
export const POWERUP_SIZE = 24;
export const WIDE_PADDLE_DURATION = 10;
export const SPEED_UP_MULTIPLIER = 1.5;
export const SPEED_UP_DURATION = 10;
export const POWERUP_DROP_CHANCE = 0.15;

// === Ball auto-launch ===
export const AUTO_LAUNCH_DELAY = 3;

// === Collision groups ===
export const COLLISION_GROUPS: CollisionGroupsConfig = {
	paddle: { collidesWith: ["walls", "ball"] },
	ball: { collidesWith: ["paddle", "bricks", "walls"] },
	bricks: { collidesWith: ["ball"] },
	walls: { collidesWith: ["ball", "paddle"] },
	powerup: { collidesWith: ["paddle"] },
};

// === Input bindings ===
export const INPUT_BINDINGS: Record<string, string[]> = {
	left: ["ArrowLeft", "KeyA", "gamepad:left-stick-left", "gamepad:dpad-left"],
	right: ["ArrowRight", "KeyD", "gamepad:left-stick-right", "gamepad:dpad-right"],
	launch: ["Space", "ArrowUp", "KeyW", "gamepad:a"],
	ui_confirm: ["Enter", "gamepad:a", "gamepad:start"],
};
