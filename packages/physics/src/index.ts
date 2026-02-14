// Shapes

// Collision groups
export type { CollisionGroupsConfig, GroupConfig } from "./collision-groups.js";
export { CollisionGroups } from "./collision-groups.js";

// Collision info
export type {
	CollisionInfo,
	CollisionObject,
	CollisionShapeNode,
} from "./collision-info.js";
export type {
	CapsuleShape,
	CircleShape,
	PolygonShape,
	RectShape,
	Shape2D,
} from "./shapes.js";
export { Shape, shapeAABB } from "./shapes.js";
