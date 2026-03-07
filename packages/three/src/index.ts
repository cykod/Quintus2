export { Billboard } from "./billboard.js";
export { Camera3D } from "./camera3d.js";
export { GLTFModel } from "./gltf-model.js";
export { AmbientLight, DirectionalLight, PointLight } from "./lights.js";
export { MeshNode } from "./mesh-node.js";
export { Node3D, type Node3DSnapshot } from "./node3d.js";
export { PointsNode } from "./points-node.js";
export { ThreeContext, type ThreePluginConfig } from "./three-context.js";
export { ThreeLayer } from "./three-layer.js";
export { getThreeContext, ThreePlugin } from "./three-plugin.js";
export { ThreeRenderer } from "./three-renderer.js";

// Side-effect import: adds game.three accessor via module augmentation
import "./augment.js";
