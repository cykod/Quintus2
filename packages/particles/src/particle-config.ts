import type { SeededRandom } from "@quintus/math";
import { Color } from "@quintus/math";
import type { PropertyCurves } from "./curve.js";

/** Range type: either a fixed value or [min, max] for random sampling */
export type Range = number | [min: number, max: number];

/** Emission area shape */
export type EmissionShape = "point" | "circle" | "rect" | "line" | "ring";

/** Particle render shape */
export type ParticleShape = "circle" | "rect" | "texture" | "triangle";

/** Blend mode */
export type BlendMode = "normal" | "additive";

export interface ParticleConfig {
	// --- Emission ---
	/** Maximum simultaneous particles. Default: 100 */
	maxParticles?: number;
	/** Particles emitted per second (continuous mode). Default: 10 */
	emissionRate?: number;
	/** Shape of the emission area. Default: "point" */
	emissionShape?: EmissionShape;
	/** Radius for "circle" and "ring" emission shapes. Default: 0 */
	emissionRadius?: number;
	/** Width for "rect" emission shape. Default: 0 */
	emissionWidth?: number;
	/** Height for "rect" emission shape. Default: 0 */
	emissionHeight?: number;
	/** Length for "line" emission shape. Default: 0 */
	emissionLength?: number;
	/** Angle of "line" emission shape in degrees. Default: 0 */
	emissionLineAngle?: number;

	// --- Motion ---
	/** Initial speed in pixels/sec. Default: 100 */
	initialSpeed?: Range;
	/**
	 * Direction of emission in degrees.
	 * 0 = right, 90 = down, -90 = up, 180 = left.
	 * A range like [-100, -80] creates a spread.
	 * Default: [-90, -90] (straight up)
	 */
	initialAngle?: Range;
	/** Gravity X acceleration in pixels/sec². Default: 0 */
	gravityX?: number;
	/** Gravity Y acceleration in pixels/sec². Default: 0 */
	gravityY?: number;
	/** Exponential velocity damping coefficient. Default: 0 */
	drag?: number;
	/** Random velocity jitter added each frame (pixels/sec²). Default: 0 */
	turbulence?: number;

	// --- Appearance ---
	/** Render shape. Default: "circle" */
	shape?: ParticleShape;
	/** Particle size in pixels. Default: 4 */
	size?: Range;
	/** Size multiplier over lifetime: [startScale, endScale]. Default: [1, 1] */
	sizeOverLife?: [start: number, end: number];
	/** Start color (hex string or Color). Default: "#ffffff" */
	colorStart?: string | Color;
	/** End color (hex string or Color). Lerped over lifetime. Default: same as colorStart */
	colorEnd?: string | Color;
	/** Blend mode. Default: "normal" */
	blendMode?: BlendMode;
	/** Texture asset name (when shape is "texture"). Default: undefined */
	texture?: string;

	// --- Rotation ---
	/** Initial rotation in degrees. Default: 0 */
	initialRotation?: Range;
	/** Angular velocity in degrees/sec. Default: 0 */
	angularVelocity?: Range;

	// --- Lifetime ---
	/** Particle lifetime in seconds. Default: 1 */
	lifetime?: Range;

	// --- Advanced ---
	/** Whether to simulate in local or world space. Default: "world" */
	simulationSpace?: "local" | "world";
	/** Custom property curves (Phase 4). */
	curves?: PropertyCurves;
}

/** Fully resolved config with no optional fields (except curves and texture) */
export interface ResolvedParticleConfig {
	maxParticles: number;
	emissionRate: number;
	emissionShape: EmissionShape;
	emissionRadius: number;
	emissionWidth: number;
	emissionHeight: number;
	emissionLength: number;
	emissionLineAngle: number;

	initialSpeed: Range;
	initialAngle: Range;
	gravityX: number;
	gravityY: number;
	drag: number;
	turbulence: number;

	shape: ParticleShape;
	size: Range;
	sizeOverLife: [number, number];
	colorStart: Color;
	colorEnd: Color;
	blendMode: BlendMode;
	texture: string | undefined;

	initialRotation: Range;
	angularVelocity: Range;

	lifetime: Range;

	simulationSpace: "local" | "world";
	curves: PropertyCurves | undefined;

	/** Pre-computed: true when colorStart equals colorEnd (uniform color fast path) */
	_uniformColor: string | null;
}

const DEG_TO_RAD = Math.PI / 180;

/** Resolve a Range to a concrete number using the RNG */
export function resolveRange(range: Range, rng: SeededRandom): number {
	if (typeof range === "number") return range;
	return rng.float(range[0], range[1]);
}

/** Convert degrees to radians */
export function degToRad(degrees: number): number {
	return degrees * DEG_TO_RAD;
}

/** Coerce a color value (hex string or Color) to a Color instance */
export function resolveColor(value: string | Color): Color {
	if (value instanceof Color) return value;
	return Color.fromHex(value);
}

/** Apply defaults and resolve color/angle values */
export function resolveConfig(config: ParticleConfig): ResolvedParticleConfig {
	const colorStart = resolveColor(config.colorStart ?? "#ffffff");
	const colorEnd = config.colorEnd !== undefined ? resolveColor(config.colorEnd) : colorStart;

	const uniformColor = colorStart.equals(colorEnd) ? colorStart.toCSS() : null;

	return {
		maxParticles: config.maxParticles ?? 100,
		emissionRate: config.emissionRate ?? 10,
		emissionShape: config.emissionShape ?? "point",
		emissionRadius: config.emissionRadius ?? 0,
		emissionWidth: config.emissionWidth ?? 0,
		emissionHeight: config.emissionHeight ?? 0,
		emissionLength: config.emissionLength ?? 0,
		emissionLineAngle: config.emissionLineAngle ?? 0,

		initialSpeed: config.initialSpeed ?? 100,
		initialAngle: config.initialAngle ?? [-90, -90],
		gravityX: config.gravityX ?? 0,
		gravityY: config.gravityY ?? 0,
		drag: config.drag ?? 0,
		turbulence: config.turbulence ?? 0,

		shape: config.shape ?? "circle",
		size: config.size ?? 4,
		sizeOverLife: config.sizeOverLife ?? [1, 1],
		colorStart,
		colorEnd,
		blendMode: config.blendMode ?? "normal",
		texture: config.texture,

		initialRotation: config.initialRotation ?? 0,
		angularVelocity: config.angularVelocity ?? 0,

		lifetime: config.lifetime ?? 1,

		simulationSpace: config.simulationSpace ?? "world",
		curves: config.curves,

		_uniformColor: uniformColor,
	};
}
