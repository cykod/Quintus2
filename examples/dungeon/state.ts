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

export interface GameState {
	health: number;
	maxHealth: number;
	currentLevel: number;
	sword: SwordDef;
	shield: ShieldDef | null;
	score: number;
	keys: number;
}

export const gameState: GameState = {
	health: 3,
	maxHealth: 3,
	currentLevel: 1,
	sword: SWORDS[0],
	shield: null,
	score: 0,
	keys: 0,
};

export function resetState(): void {
	gameState.health = gameState.maxHealth;
	gameState.currentLevel = 1;
	gameState.sword = SWORDS[0];
	gameState.shield = null;
	gameState.score = 0;
	gameState.keys = 0;
}
