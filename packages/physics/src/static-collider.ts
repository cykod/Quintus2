import { Vec2 } from "@quintus/math";
import { type BodyType, CollisionObject } from "./collision-object.js";
import type { StaticColliderSnapshot } from "./snapshot-types.js";

export class StaticCollider extends CollisionObject {
	readonly bodyType: BodyType = "static";

	/**
	 * Velocity for moving platforms.
	 * Actors standing on this collider inherit this velocity via platform carry.
	 * StaticColliders don't move via physics — position them manually or via code.
	 * Default: Vec2.ZERO (truly static).
	 */
	constantVelocity: Vec2 = new Vec2(0, 0);

	/**
	 * Whether this collider acts as one-way (e.g., jump-through platforms).
	 * When true, only collisions from above (in the direction of oneWayDirection)
	 * are resolved. The actor can pass through from below.
	 */
	oneWay = false;

	/**
	 * The "up" direction for one-way detection.
	 * Only relevant when oneWay is true.
	 * Default: Vec2.UP (0, -1) — collisions from above only.
	 */
	oneWayDirection: Vec2 = new Vec2(0, -1);

	// === Serialization ===

	override serialize(): StaticColliderSnapshot {
		return {
			...super.serialize(),
			oneWay: this.oneWay,
			constantVelocity: { x: this.constantVelocity.x, y: this.constantVelocity.y },
			collisionGroup: this.collisionGroup as string,
			bodyType: "static" as const,
		};
	}

	/** @internal */
	override _poolReset(): void {
		super._poolReset();
		this.constantVelocity._set(0, 0);
		this.oneWay = false;
		this.oneWayDirection._set(0, -1);
	}

	/** @internal One-way collision filtering for castMotion. */
	override _shouldSkipCollision(normal: Vec2): boolean {
		if (!this.oneWay) return false;
		// Only count collisions where normal aligns with oneWayDirection.
		// Normal points away from collider into mover (our convention).
		// For a floor hit from above: normal=(0,-1), oneWayDir=(0,-1), dot=1 → keep.
		// For a hit from below: normal=(0,1), oneWayDir=(0,-1), dot=-1 → skip.
		// Threshold cos(45deg) ≈ 0.707 allows some angular tolerance.
		return normal.dot(this.oneWayDirection) < Math.SQRT1_2;
	}
}
