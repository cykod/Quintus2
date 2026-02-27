import { reactiveState } from "@quintus/core";
import { STARTING_GOLD, STARTING_LIVES } from "./config.js";

export type TowerType = "arrow" | "cannon" | "slow";

// reactiveState() provides onChange listeners for HUD binding and reset() for scene transitions
export const gameState = reactiveState({
	gold: STARTING_GOLD,
	lives: STARTING_LIVES,
	wave: 0,
	score: 0,
	selectedTower: "arrow" as TowerType | null,
});
