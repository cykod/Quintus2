import { reactiveState } from "@quintus/core";

export const gameState = reactiveState({
	currentLevel: 0,
	moves: 0,
	completedLevels: [] as number[],
});
