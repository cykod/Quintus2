import type { CollisionGroupsConfig } from "quintus2";

/**
 * Internal render resolution. Bigger than a classic 320×240 so there's room for
 * platforms and an enemy; `scale: "fit"` still scales the whole canvas to the window.
 * Sprites are drawn at `SPRITE_SCALE` so the higher resolution doesn't shrink them.
 */
export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 480;

/** How much to enlarge the 8×8 pixel-art sprites (applied as a Node2D scale). */
export const SPRITE_SCALE = 2;

/** How many coins the level contains — collect them all to win. */
export const TOTAL_COINS = 3;

/** Which collision groups interact. The player collides with the world, items, and enemies. */
export const COLLISION_GROUPS: CollisionGroupsConfig = {
	player: { collidesWith: ["world", "items", "enemies"] },
	world: { collidesWith: ["player", "enemies"] },
	items: { collidesWith: ["player"] },
	enemies: { collidesWith: ["player", "world"] },
};

/** Named input actions → key/gamepad bindings. Referenced by `game.input.isPressed(...)`. */
export const INPUT_BINDINGS: Record<string, string[]> = {
	left: ["ArrowLeft", "KeyA", "gamepad:left-stick-left", "gamepad:dpad-left"],
	right: ["ArrowRight", "KeyD", "gamepad:left-stick-right", "gamepad:dpad-right"],
	jump: ["ArrowUp", "Space", "KeyW", "gamepad:a"],
};
