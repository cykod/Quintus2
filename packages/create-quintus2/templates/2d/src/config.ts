import type { CollisionGroupsConfig } from "quintus2";

/** Which collision groups interact. The player collides with the world and picks up items. */
export const COLLISION_GROUPS: CollisionGroupsConfig = {
	player: { collidesWith: ["world", "items"] },
	world: { collidesWith: ["player"] },
	items: { collidesWith: ["player"] },
};

/** Named input actions → key/gamepad bindings. Referenced by `game.input.isPressed(...)`. */
export const INPUT_BINDINGS: Record<string, string[]> = {
	left: ["ArrowLeft", "KeyA", "gamepad:left-stick-left", "gamepad:dpad-left"],
	right: ["ArrowRight", "KeyD", "gamepad:left-stick-right", "gamepad:dpad-right"],
	jump: ["ArrowUp", "Space", "KeyW", "gamepad:a"],
};
