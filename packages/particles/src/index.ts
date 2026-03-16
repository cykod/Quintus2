// Phase 1: Core simulation
export {
	type BlendMode,
	degToRad,
	type EmissionShape,
	type ParticleConfig,
	type ParticleShape,
	type Range,
	type ResolvedParticleConfig,
	resolveColor,
	resolveConfig,
	resolveRange,
} from "./particle-config.js";
// Phase 3: Emitter node & plugin
export { ParticleEmitter } from "./particle-emitter.js";
export { getParticleSystem, ParticlePlugin } from "./particle-plugin.js";
export { ParticlePool } from "./particle-pool.js";
// Phase 2: Rendering
export { ParticleRenderer2D } from "./particle-renderer-2d.js";
export { ParticleSimulator } from "./particle-simulator.js";
import "./augment.js";

// Phase 4: Curves & gradients
export {
	type ColorGradient,
	type Curve,
	type CurveKey,
	evaluateCurve,
	evaluateGradient,
	type GradientStop,
	type PropertyCurves,
} from "./curve.js";
export {
	degToRad3D,
	type EmissionShape3D,
	type ParticleConfig3D,
	type Range3D,
	type ResolvedParticleConfig3D,
	resolveConfig3D,
	resolveRange3D,
} from "./particle-config-3d.js";

// Phase 6: 3D particle support (Three.js-free types and simulation)
export { ParticlePool3D } from "./particle-pool-3d.js";
export { type BufferAttributeLike, ParticleSimulator3D } from "./particle-simulator-3d.js";
// Phase 5: Presets
export { Particles } from "./presets.js";
export { Particles3D } from "./presets-3d.js";
