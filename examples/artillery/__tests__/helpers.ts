import { AudioPlugin } from "@quintus/audio";
import type { Plugin } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "../config.js";

/** Which engine plugins a given test needs. Omitted plugins are excluded. */
export interface ArtilleryPluginOptions {
	/** Physics with zero gravity + the game's collision groups (blast queries, placement). */
	physics?: boolean;
	/** Input bound to the game's action map (cannon aiming/firing). */
	input?: boolean;
	/** Audio — no-ops in headless (null context), but exercises SFX call sites. */
	audio?: boolean;
}

/**
 * Shared plugin-list factory for artillery tests. Each suite opts into the
 * subset it needs so no test file re-declares the same PhysicsPlugin/InputPlugin
 * config inline. Mirrors breakout's `breakoutPlugins()`.
 */
export function artilleryPlugins(opts: ArtilleryPluginOptions = {}): Plugin[] {
	const plugins: Plugin[] = [];
	if (opts.physics) {
		plugins.push(PhysicsPlugin({ gravity: new Vec2(0, 0), collisionGroups: COLLISION_GROUPS }));
	}
	if (opts.input) {
		plugins.push(InputPlugin({ actions: INPUT_BINDINGS }));
	}
	if (opts.audio) {
		plugins.push(AudioPlugin());
	}
	return plugins;
}
