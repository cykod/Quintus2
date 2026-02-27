import type { CollisionGroupsConfig } from "@quintus/physics";

export const COLLISION_GROUPS: CollisionGroupsConfig = {
	player: { collidesWith: ["world", "enemies", "items"] },
	world: { collidesWith: ["player", "enemies"] },
	enemies: { collidesWith: ["world"] },
	items: { collidesWith: ["player"] },
};

export const INPUT_BINDINGS: Record<string, string[]> = {
	left: ["ArrowLeft", "KeyA", "gamepad:left-stick-left", "gamepad:dpad-left"],
	right: ["ArrowRight", "KeyD", "gamepad:left-stick-right", "gamepad:dpad-right"],
	jump: ["ArrowUp", "Space", "KeyW", "gamepad:a"],
	ui_confirm: ["Enter", "gamepad:a", "gamepad:start"],
};
