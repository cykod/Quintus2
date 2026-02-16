import { definePlugin, type Game, type Plugin } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { CollisionGroupsConfig } from "./collision-groups.js";
import { CollisionGroups } from "./collision-groups.js";
import { _registerPhysicsAccessors } from "./collision-object.js";
import { PhysicsWorld } from "./physics-world.js";

export interface PhysicsPluginConfig {
	/** World gravity. Default: Vec2(0, 800). */
	gravity?: Vec2;
	/** Spatial hash cell size in pixels. Default: 64. */
	cellSize?: number;
	/** Named collision groups. Default: { default: { collidesWith: ["default"] } }. */
	collisionGroups?: CollisionGroupsConfig;
}

/**
 * Module-level WeakMap storing PhysicsWorld per Game.
 * Used by CollisionObject to find the world without core changes.
 */
const worldMap = new WeakMap<Game, PhysicsWorld>();

/** Get the PhysicsWorld for a game. Returns null if not installed. */
export function getPhysicsWorld(game: Game): PhysicsWorld | null {
	return worldMap.get(game) ?? null;
}

/** Create the physics plugin. */
export function PhysicsPlugin(config: PhysicsPluginConfig = {}): Plugin {
	return definePlugin({
		name: "physics",
		install(game) {
			const gravity = config.gravity ?? new Vec2(0, 800);
			const groups = new CollisionGroups(
				config.collisionGroups ?? {
					default: { collidesWith: ["default"] },
				},
			);

			const world = new PhysicsWorld({ gravity, groups, cellSize: config.cellSize });
			worldMap.set(game, world);

			// Hook into postFixedUpdate for overlap monitoring (sensors + monitored bodies + onCollision callbacks)
			game.postFixedUpdate.connect(() => {
				world.stepMonitoring();
			});
		},
	});
}

// Register accessors so CollisionObject can access the world and plugin
// without a direct import (breaks circular dependency).
_registerPhysicsAccessors(getPhysicsWorld, (config?: Record<string, unknown>) =>
	PhysicsPlugin(config as PhysicsPluginConfig),
);
