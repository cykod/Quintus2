import type { Game } from "@quintus/core";
import { TextureAtlas } from "@quintus/sprites";

// === Atlas instance (populated by loadAtlases) ===
export let charactersAtlas: TextureAtlas;

// === Scale factor ===
// Characters are ~49x43 in the atlas; we want ~24x21 in-game
export const CHARACTER_SCALE = 24 / 49;

// === Frame names ===
export const FRAME = {
	// Player (hitman)
	PLAYER_GUN: "hitman1_gun.png",
	PLAYER_MACHINE: "hitman1_machine.png",
	PLAYER_SILENCER: "hitman1_silencer.png",
	PLAYER_STAND: "hitman1_stand.png",
	PLAYER_HOLD: "hitman1_hold.png",
	PLAYER_RELOAD: "hitman1_reload.png",

	// Zombie
	ZOMBIE_HOLD: "zoimbie1_hold.png",
	ZOMBIE_STAND: "zoimbie1_stand.png",

	// Robot
	ROBOT_GUN: "robot1_gun.png",
	ROBOT_MACHINE: "robot1_machine.png",
	ROBOT_STAND: "robot1_stand.png",

	// Soldier enemy
	SOLDIER_GUN: "soldier1_gun.png",
	SOLDIER_MACHINE: "soldier1_machine.png",
	SOLDIER_STAND: "soldier1_stand.png",
} as const;

/**
 * Parse the XML atlas from loaded custom assets.
 * Must be called after game.assets.load() completes.
 */
export function loadAtlases(game: Game): void {
	const xml = game.assets.get<string>("spritesheet_characters");
	if (!xml) throw new Error("spritesheet_characters XML not loaded");
	charactersAtlas = TextureAtlas.fromXml(xml, "spritesheet_characters");
}
