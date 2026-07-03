// 3D subpath: re-exports the Three.js bridge. `three` itself is kept external at build
// time (an optional peer dependency), so 2D consumers never pull it in transitively.
export * from "@quintus/three";
