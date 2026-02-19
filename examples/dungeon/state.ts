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

export const SWORDS: SwordDef[] = [
	{ name: "Pickaxe", damage: 1, spriteFrame: 93 },
	{ name: "Battle Axe", damage: 2, spriteFrame: 119 },
	{ name: "War Axe", damage: 3, spriteFrame: 119 },
];

export const SHIELDS: ShieldDef[] = [
	{ name: "Wooden Shield", defense: 1, spriteFrame: 66 },
	{ name: "Knight's Shield", defense: 2, spriteFrame: 122 },
];

export const gameState = reactiveState({
	health: 3,
	maxHealth: 3,
	currentLevel: 1,
	sword: SWORDS[0] as SwordDef,
	shield: null as ShieldDef | null,
	score: 0,
	keys: 0,
});
