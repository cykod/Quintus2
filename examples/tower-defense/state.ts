import { reactiveState } from "@quintus/core";
import { STARTING_GOLD, STARTING_LIVES } from "./config.js";

export type TowerType = "arrow" | "cannon" | "slow";

export const gameState = reactiveState({
	gold: STARTING_GOLD,
	lives: STARTING_LIVES,
	wave: 0,
	score: 0,
	selectedTower: "arrow" as TowerType | null,
});
