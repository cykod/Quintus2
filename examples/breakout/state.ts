import { reactiveState } from "@quintus/core";

export const gameState = reactiveState({
	score: 0,
	lives: 3,
	level: 1,
	bricksRemaining: 0,
});
