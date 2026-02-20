import type { CollisionGroupsConfig } from "@quintus/physics";

export const COLLISION_GROUPS: CollisionGroupsConfig = {
	player: { collidesWith: ["world", "enemies", "items"] },
	world: { collidesWith: ["player", "enemies"] },
	enemies: { collidesWith: ["world"] },
	items: { collidesWith: ["player"] },
};

export const INPUT_BINDINGS: Record<string, string[]> = {
	left: ["ArrowLeft", "KeyA"],
	right: ["ArrowRight", "KeyD"],
	jump: ["ArrowUp", "Space", "KeyW"],
};
