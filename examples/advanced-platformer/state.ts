import { reactiveState } from "@quintus/core";
import type { Vec2 } from "@quintus/math";

/** Mutable game state shared across scenes. */
export const gameState = reactiveState({
	score: 0,
	coins: 0,
	health: 5,
	maxHealth: 5,
	lives: 3,
	currentLevel: 1,
	keys: { red: false, blue: false, green: false, yellow: false },
	starPower: false,
	starTimeRemaining: 0,
	checkpoint: null as Vec2 | null,
});
