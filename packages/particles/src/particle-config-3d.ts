import type { SeededRandom } from "@quintus/math";
import {
	type ParticleConfig,
	type ResolvedParticleConfig,
	resolveConfig,
} from "./particle-config.js";

/** 3D emission shape */
export type EmissionShape3D = "point" | "sphere" | "hemisphere" | "box";

/** Particle config extended with 3D-specific fields */
export interface ParticleConfig3D extends ParticleConfig {
	/** Gravity along the Z axis in units/sec². Default: 0 */
	gravityZ?: number;

	/**
	 * Polar angle (theta) from the +Y axis in degrees.
	 * 0 = up, 90 = horizontal, 180 = down.
	 * A range like [0, 30] creates a cone. Default: [0, 180]
	 */
	initialTheta?: Range3D;

	/**
	 * Azimuthal angle (phi) around the Y axis in degrees.
	 * 0..360 for full rotation. Default: [0, 360]
	 */
	initialPhi?: Range3D;

	/** 3D emission shape. Default: "point" */
	emissionShape3D?: EmissionShape3D;

	/** Half-extent along X for "box" emission shape. Default: 0 */
	emissionBoxX?: number;
	/** Half-extent along Y for "box" emission shape. Default: 0 */
	emissionBoxY?: number;
	/** Half-extent along Z for "box" emission shape. Default: 0 */
	emissionBoxZ?: number;
}

/** Range type for 3D configs (same as 2D Range) */
export type Range3D = number | [min: number, max: number];

/** Fully resolved 3D config */
export interface ResolvedParticleConfig3D extends ResolvedParticleConfig {
	gravityZ: number;
	initialTheta: Range3D;
	initialPhi: Range3D;
	emissionShape3D: EmissionShape3D;
	emissionBoxX: number;
	emissionBoxY: number;
	emissionBoxZ: number;
}

/** Resolve a Range3D to a concrete number */
export function resolveRange3D(range: Range3D, rng: SeededRandom): number {
	if (typeof range === "number") return range;
	return rng.float(range[0], range[1]);
}

const DEG_TO_RAD_3D = Math.PI / 180;

/** Convert degrees to radians (3D version) */
export function degToRad3D(degrees: number): number {
	return degrees * DEG_TO_RAD_3D;
}

/** Apply defaults and resolve a ParticleConfig3D */
export function resolveConfig3D(config: ParticleConfig3D): ResolvedParticleConfig3D {
	const base = resolveConfig(config);

	return {
		...base,
		gravityZ: config.gravityZ ?? 0,
		initialTheta: config.initialTheta ?? [0, 180],
		initialPhi: config.initialPhi ?? [0, 360],
		emissionShape3D: config.emissionShape3D ?? "point",
		emissionBoxX: config.emissionBoxX ?? 0,
		emissionBoxY: config.emissionBoxY ?? 0,
		emissionBoxZ: config.emissionBoxZ ?? 0,
	};
}
