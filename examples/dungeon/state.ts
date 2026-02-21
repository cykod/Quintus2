import { reactiveState } from "@quintus/core";

export interface SwordDef {
	name: string;
	damage: number;
	spriteFrame: number;
}

export interface ShieldDef {
	name: string;
	defense: number;
	spriteFrame: number;
}

export interface PotionDef {
	name: string;
	type: "health" | "speed" | "attack";
	spriteFrame: number;
	/** Duration in seconds (0 = instant for health). */
	duration: number;
	/** Effect magnitude: heal amount or multiplier. */
	value: number;
}

export const SWORDS: SwordDef[] = [
	{ name: "Small Sword", damage: 1, spriteFrame: 103 },
	{ name: "Large Sword", damage: 2, spriteFrame: 104 },
	{ name: "Barbarian Sword", damage: 3, spriteFrame: 105 },
];

export const SHIELDS: ShieldDef[] = [
	{ name: "Wooden Shield", defense: 1, spriteFrame: 101 },
	{ name: "Metal Shield", defense: 2, spriteFrame: 102 },
];

export const POTIONS: PotionDef[] = [
	{ name: "Health Potion", type: "health", spriteFrame: 115, duration: 0, value: 2 },
	{ name: "Speed Potion", type: "speed", spriteFrame: 116, duration: 10, value: 1.5 },
	{ name: "Attack Potion", type: "attack", spriteFrame: 114, duration: 10, value: 2 },
];

export const gameState = reactiveState({
	health: 3,
	maxHealth: 3,
	currentLevel: 1,
	sword: SWORDS[0] as SwordDef,
	shield: null as ShieldDef | null,
	score: 0,
	keys: 0,
	potion: null as PotionDef | null,
	activeBuff: null as PotionDef | null,
	buffTimeRemaining: 0,
});
