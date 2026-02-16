export interface GameState {
	score: number;
	coins: number;
	health: number;
	maxHealth: number;
	currentLevel: number;
}

/** Mutable game state shared across scenes. */
export const gameState: GameState = {
	score: 0,
	coins: 0,
	health: 3,
	maxHealth: 3,
	currentLevel: 1,
};

/** Reset state for a new game. */
export function resetState(): void {
	gameState.score = 0;
	gameState.coins = 0;
	gameState.health = gameState.maxHealth;
	gameState.currentLevel = 1;
}
