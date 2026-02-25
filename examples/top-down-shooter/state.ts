import { reactiveState } from "@quintus/core";
import { PLAYER_MAX_HEALTH } from "./config.js";

export const gameState = reactiveState({
	score: 0,
	wave: 0,
	health: PLAYER_MAX_HEALTH,
	maxHealth: PLAYER_MAX_HEALTH,
	ammo: Infinity,
	maxAmmo: Infinity,
	currentWeapon: "pistol" as string,
	kills: 0,
	isReloading: false,
});
