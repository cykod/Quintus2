// Shapes
export type {
	CapsuleShape,
	CircleShape,
	PolygonShape,
	RectShape,
	Shape2D,
} from "./shapes.js";
export { Shape, shapeAABB } from "./shapes.js";

// Collision groups
export type { CollisionGroupsConfig, GroupConfig } from "./collision-groups.js";
export { CollisionGroups } from "./collision-groups.js";

// Collision info
export type {
	CollisionInfo,
	CollisionObject,
	CollisionShapeNode,
} from "./collision-info.js";

// SAT collision detection
export type { SATResult } from "./sat.js";
export { findTOI, flip, sweptAABB, testOverlap } from "./sat.js";

// Spatial hash (broad phase)
export { SpatialHash } from "./spatial-hash.js";
