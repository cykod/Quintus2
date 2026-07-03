import { reactiveState } from "quintus2";

/** Mutable game state. Writes emit per-key signals the HUD listens to. */
export const gameState = reactiveState({
	score: 0,
	lives: 3,
});
