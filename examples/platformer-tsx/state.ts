import { reactiveState } from "@quintus/core";

/** Mutable game state shared across scenes. */
export const gameState = reactiveState({
	score: 0,
	coins: 0,
	health: 3,
	maxHealth: 3,
	currentLevel: 1,
});
