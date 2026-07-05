import { reactiveState } from "@quintus/core";
import { AMMO, DEFAULT_ANGLE, MIN_POWER, TARGET_COUNT } from "./config.js";

export const gameState = reactiveState({
	score: 0,
	ammo: AMMO,
	targetsRemaining: TARGET_COUNT,
	wind: 0, // px/s², signed
	angle: DEFAULT_ANGLE, // radians
	power: MIN_POWER, // px/s — charged by holding fire; starts empty
	won: false, // set by afterShot before switching to results (no switchTo params channel)
	selfDestruct: false, // true when the round ended by the player blowing themselves up
});
