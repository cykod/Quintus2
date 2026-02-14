import { Node2D } from "@quintus/core";
import type { AABB, Matrix2D } from "@quintus/math";
import { CollisionShape } from "./collision-shape.js";
import type { PhysicsWorld } from "./physics-world.js";
import type { Shape2D } from "./shapes.js";

/** Discriminant for the three physics body types. */
export type BodyType = "actor" | "static" | "sensor";

/**
 * Module-level reference to getPhysicsWorld and PhysicsPlugin factory.
 * Set by physics-plugin.ts at module load time to break the circular dependency.
 * (collision-object → physics-plugin → physics-world → collision-object)
 */
let _getPhysicsWorldFn: ((game: import("@quintus/core").Game) => PhysicsWorld | null) | null = null;
let _physicsPluginFn:
	| ((config?: Record<string, unknown>) => import("@quintus/core").Plugin)
	| null = null;

/** @internal Called by physics-plugin.ts to register the accessor. */
export function _registerPhysicsAccessors(
	getWorld: (game: import("@quintus/core").Game) => PhysicsWorld | null,
	pluginFactory: (config?: Record<string, unknown>) => import("@quintus/core").Plugin,
): void {
	_getPhysicsWorldFn = getWorld;
	_physicsPluginFn = pluginFactory;
}

export abstract class CollisionObject extends Node2D {
	/** What type of physics body this is. Set by subclasses. */
	abstract readonly bodyType: BodyType;

	/** Collision group name. Must match a group in PhysicsPlugin config. Default: "default". */
	collisionGroup = "default";

	/** Whether this body is currently registered in the PhysicsWorld. */
	private _registered = false;

	// === Shape Queries ===

	/** Get all enabled CollisionShape children. */
	getShapes(): CollisionShape[] {
		return this.getChildren(CollisionShape).filter((s) => !s.disabled && s.shape != null);
	}

	/** Get shape + transform pairs for collision testing. */
	getShapeTransforms(): Array<{ shape: Shape2D; transform: Matrix2D }> {
		return this.getShapes().map((s) => ({
			// getShapes() already filters for non-null shape
			shape: s.shape as Shape2D,
			transform: s.getWorldTransform(),
		}));
	}

	/** Compute world-space AABB encompassing all enabled shapes. Null if no shapes. */
	getWorldAABB(): AABB | null {
		const shapes = this.getShapes();
		if (shapes.length === 0) return null;
		const first = shapes[0];
		if (!first) return null;
		let aabb = first.getWorldAABB();
		if (!aabb) return null;
		for (let i = 1; i < shapes.length; i++) {
			const other = shapes[i]?.getWorldAABB();
			if (other) aabb = aabb.merge(other);
		}
		return aabb;
	}

	// === PhysicsWorld Registration ===

	/** @internal — uses onReady (not onEnterTree) so CollisionShape children are available. */
	override onReady(): void {
		super.onReady();
		this._registerInWorld();
	}

	/** @internal */
	override onExitTree(): void {
		if (this._registered) {
			const world = this._getWorld();
			if (world) world.unregister(this);
			this._registered = false;
		}
		super.onExitTree();
	}

	/** Get the PhysicsWorld from the game's plugin. */
	protected _getWorld(): PhysicsWorld | null {
		const game = this.game;
		if (!game || !_getPhysicsWorldFn) return null;
		return _getPhysicsWorldFn(game);
	}

	/** @internal Called by PhysicsWorld.stepSensors() for entered events. Override in Sensor. */
	_onBodyEntered(_body: CollisionObject): void {}

	/** @internal Called by PhysicsWorld.stepSensors() for exited events. Override in Sensor. */
	_onBodyExited(_body: CollisionObject): void {}

	/** @internal Whether this sensor should be monitored. Override in Sensor. */
	get _monitoring(): boolean {
		return false;
	}

	/** @internal Register this body in the PhysicsWorld. Handles auto-install. */
	private _registerInWorld(): void {
		const game = this.game;
		if (!game) return;

		if (!game.hasPlugin("physics") && _physicsPluginFn) {
			console.warn(
				"PhysicsPlugin auto-installed with defaults. For custom gravity/groups, call game.use(PhysicsPlugin({...})) explicitly.",
			);
			game.use(_physicsPluginFn());
		}

		const world = this._getWorld();
		if (world) {
			world.register(this);
			this._registered = true;
		}
	}
}
