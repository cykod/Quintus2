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
	left: ["ArrowLeft", "KeyA", "gamepad:left-stick-left", "gamepad:dpad-left"],
	right: ["ArrowRight", "KeyD", "gamepad:left-stick-right", "gamepad:dpad-right"],
	up: ["ArrowUp", "KeyW", "gamepad:left-stick-up", "gamepad:dpad-up"],
	down: ["ArrowDown", "KeyS", "gamepad:left-stick-down", "gamepad:dpad-down"],
	attack: ["KeyJ", "Space", "gamepad:a"],
	defend: ["KeyK", "ShiftLeft", "gamepad:lb"],
	interact: ["KeyE", "Enter", "gamepad:x"],
	use_potion: ["KeyQ", "KeyP", "gamepad:rb"],
	ui_confirm: ["Enter", "gamepad:a", "gamepad:start"],
};
