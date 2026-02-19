/**
 * Side-effect import that registers physics factories with TileMap.
 *
 * Usage: `import "@quintus/tilemap/physics";`
 *
 * This replaces the manual `TileMap.registerPhysics({ ... as never ... })` pattern.
 */
import { CollisionShape, Shape, StaticCollider } from "@quintus/physics";
import { TileMap } from "./tilemap.js";

TileMap.registerPhysics({
	StaticCollider: StaticCollider as never,
	CollisionShape: CollisionShape as never,
	shapeRect: Shape.rect,
});
