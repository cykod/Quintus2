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

// Phase 5: Presets
export { Particles } from "./presets.js";
