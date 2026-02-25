import { reactiveState } from "@quintus/core";

export const gameState = reactiveState({
	score: 0,
	lives: 3,
	wave: 1,
	shieldActive: false,
	spreadShot: false,
	rapidFire: false,
});
