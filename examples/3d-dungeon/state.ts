import { reactiveState } from "@quintus/core";

export const gameState = reactiveState({
	score: 0,
	health: 3,
	maxHealth: 3,
	level: 1,
});
