import type { CollisionGroupsConfig } from "@quintus/physics";

export const COLLISION_GROUPS: CollisionGroupsConfig = {
	player: { collidesWith: ["world", "enemies", "items"] },
	world: { collidesWith: ["player", "enemies"] },
	enemies: { collidesWith: ["world", "player"] },
	items: { collidesWith: ["player"] },
	weapon: { collidesWith: ["enemies"] },
	eWeapon: { collidesWith: ["player"] },
};

export const INPUT_BINDINGS: Record<string, string[]> = {
	left: ["ArrowLeft", "KeyA"],
	right: ["ArrowRight", "KeyD"],
	up: ["ArrowUp", "KeyW"],
	down: ["ArrowDown", "KeyS"],
	attack: ["KeyJ", "Space"],
	defend: ["KeyK", "ShiftLeft"],
	interact: ["KeyE", "Enter"],
	use_potion: ["KeyQ", "KeyP"],
};
