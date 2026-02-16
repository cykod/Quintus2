// Side-effect: install game.physics accessor
import "./augment.js";

// Physics bodies
export { Actor } from "./actor.js";
// Collision groups
export type { CollisionGroupsConfig, GroupConfig } from "./collision-groups.js";
export { CollisionGroups } from "./collision-groups.js";
// Collision info
export type { CollisionInfo } from "./collision-info.js";
// Collision object
export type { BodyType } from "./collision-object.js";
export { CollisionObject } from "./collision-object.js";
// Collision shape
export type { CollisionShapeProps } from "./collision-shape.js";
export { CollisionShape } from "./collision-shape.js";
// Contact point
export { computeContactPoint, shapeSupport } from "./contact-point.js";
// Physics plugin
export type { PhysicsPluginConfig } from "./physics-plugin.js";
export { getPhysicsWorld, PhysicsPlugin } from "./physics-plugin.js";
// Physics world
export type { PhysicsWorldConfig } from "./physics-world.js";
export { findShapePairTOI, PhysicsWorld } from "./physics-world.js";
// Query filter
export { matchesQuery } from "./query-filter.js";
// Query types
export type { QueryOptions, RaycastHit, ShapeCastHit } from "./query-types.js";
// Ray intersection
export type { RayShapeHit } from "./ray.js";
export { pointInShape, rayIntersectShape } from "./ray.js";
// SAT collision detection
export type { SATResult } from "./sat.js";
export { findTOI, flip, sweptAABB, testOverlap } from "./sat.js";
export { Sensor } from "./sensor.js";
export type {
	CapsuleShape,
	CircleShape,
	PolygonShape,
	RectShape,
	Shape2D,
} from "./shapes.js";
export { Shape, shapeAABB } from "./shapes.js";
// Snapshot types
export type {
	ActorSnapshot,
	CollisionShapeSnapshot,
	SensorSnapshot,
	StaticColliderSnapshot,
} from "./snapshot-types.js";
// Spatial hash (broad phase)
export { SpatialHash } from "./spatial-hash.js";
export { StaticCollider } from "./static-collider.js";
