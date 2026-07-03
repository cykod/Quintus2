export * from "@quintus/audio";
export * from "@quintus/camera";
export * from "@quintus/core";
export * from "@quintus/input";
export * from "@quintus/math";
export * from "@quintus/physics";
export * from "@quintus/prefabs";
export * from "@quintus/sprites";
export * from "@quintus/tilemap";
export * from "@quintus/touch";
export * from "@quintus/tween";
export * from "@quintus/ui";

// Side-effect: wires TileMap tile-collision to the physics bodies (StaticCollider,
// CollisionShape, Shape) so tile layers generate colliders automatically. Kept in the
// bundled `dist/index.js`, which package.json marks as having side effects.
//
// NOTE: this bare import survives tsup/esbuild bundling only because `@quintus/tilemap`
// (and the other internals) do NOT set `"sideEffects": false`. Do not mark internal
// packages side-effect-free, or esbuild may drop this registration. See tsup.config.ts.
import "@quintus/tilemap/physics";
