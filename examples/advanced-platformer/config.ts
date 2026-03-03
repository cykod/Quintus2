import type { CollisionGroupsConfig } from "@quintus/physics";

export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;

export const COLLISION_GROUPS: CollisionGroupsConfig = {
	player: { collidesWith: ["world", "enemies", "items", "hazards"] },
	world: { collidesWith: ["player", "enemies"] },
	enemies: { collidesWith: ["world", "player"] },
	hazards: { collidesWith: ["player"] },
	items: { collidesWith: ["player"] },
};

export const INPUT_BINDINGS: Record<string, string[]> = {
	left: ["ArrowLeft", "KeyA", "gamepad:left-stick-left", "gamepad:dpad-left"],
	right: ["ArrowRight", "KeyD", "gamepad:left-stick-right", "gamepad:dpad-right"],
	up: ["ArrowUp", "KeyW", "gamepad:left-stick-up", "gamepad:dpad-up"],
	down: ["ArrowDown", "KeyS", "gamepad:left-stick-down", "gamepad:dpad-down"],
	jump: ["Space", "KeyZ", "gamepad:a"],
	duck: ["ArrowDown", "KeyS", "gamepad:left-stick-down"],
	ui_confirm: ["Enter", "gamepad:a", "gamepad:start"],
};
