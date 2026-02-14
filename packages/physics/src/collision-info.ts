import type { Vec2 } from "@quintus/math";
import type { CollisionObject } from "./collision-object.js";
import type { CollisionShape } from "./collision-shape.js";

export interface CollisionInfo {
	/** The other object involved in the collision. */
	readonly collider: CollisionObject;

	/** The specific CollisionShape on the other object that was hit. */
	readonly colliderShape: CollisionShape;

	/** Collision normal pointing away from the collider (into the moving body). */
	readonly normal: Vec2;

	/** Penetration depth along the normal. */
	readonly depth: number;

	/** World-space point of contact (approximate — center of contact region). */
	readonly point: Vec2;

	/** The portion of the requested motion that was traveled before collision. */
	readonly travel: Vec2;

	/** The portion of the requested motion that remains after collision. */
	readonly remainder: Vec2;
}
