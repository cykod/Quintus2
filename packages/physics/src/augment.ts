import { Game } from "@quintus/core";
import { getPhysicsWorld } from "./physics-plugin.js";
import type { PhysicsWorld } from "./physics-world.js";

// Runtime: add getter to Game.prototype
Object.defineProperty(Game.prototype, "physics", {
	get(this: Game): PhysicsWorld {
		const world = getPhysicsWorld(this);
		if (!world) {
			throw new Error(
				"PhysicsPlugin not installed. Call game.use(PhysicsPlugin({...})) before accessing game.physics.",
			);
		}
		return world;
	},
	configurable: true,
});

// TypeScript: merge PhysicsWorld accessor into Game's type
declare module "@quintus/core" {
	interface Game {
		/** Physics world. Requires PhysicsPlugin to be installed. */
		get physics(): PhysicsWorld;
	}
}
