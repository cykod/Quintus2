import type { Vec2 } from "@quintus/math";
import type { CollisionObject } from "./collision-object.js";
import type { CollisionShape } from "./collision-shape.js";

/**
 * Options for filtering query results. All fields are optional.
 * When multiple filters are specified, they are AND-ed together.
 */
export interface QueryOptions {
	/**
	 * Only include bodies whose collisionGroup is in this list.
	 * This is an OR match — the body's single group must appear in the array.
	 */
	groups?: string[];
	/** Exclude bodies in these collision groups. */
	excludeGroups?: string[];
	/** Only include bodies that have ALL of these tags (AND match). */
	tags?: string[];
	/** Exclude these specific body instances. */
	exclude?: CollisionObject[];
	/** Include sensors in results. Default: false. */
	includeSensors?: boolean;
	/** Custom predicate. Return false to exclude a body. */
	filter?: (body: CollisionObject) => boolean;
	/** Stop collecting after this many results. Useful for "find any one" queries. */
	maxResults?: number;
}

/**
 * Result of a raycast query.
 */
export interface RaycastHit {
	/** The body that was hit. */
	collider: CollisionObject;
	/** The specific CollisionShape on the body that was hit. */
	colliderShape: CollisionShape;
	/** World-space point where the ray intersects the shape. */
	point: Vec2;
	/** Surface normal at the hit point (points away from the surface toward the ray origin). */
	normal: Vec2;
	/** Distance from ray origin to the hit point. */
	distance: number;
}

/**
 * Result of a shape cast query.
 */
export interface ShapeCastHit {
	/** The body that was hit. */
	collider: CollisionObject;
	/** The specific CollisionShape on the body that was hit. */
	colliderShape: CollisionShape;
	/** Surface normal at contact. */
	normal: Vec2;
	/** Penetration depth at contact. */
	depth: number;
	/** World-space contact point. */
	point: Vec2;
	/** Motion traveled before collision. */
	travel: Vec2;
	/** Remaining motion after collision. */
	remainder: Vec2;
}
