import { Color } from "@quintus/math";

/** A keyframe on a curve. time is 0..1 (normalized lifetime) */
export interface CurveKey {
	time: number;
	value: number;
}

/**
 * Piecewise-linear curve evaluated over particle lifetime.
 * A number means constant. An array of CurveKeys is interpolated.
 */
export type Curve = CurveKey[] | number;

/** Evaluate a curve at normalized time t (0..1) */
export function evaluateCurve(curve: Curve, t: number): number {
	if (typeof curve === "number") return curve;
	const len = curve.length;
	if (len === 0) return 0;

	const first = curve[0] as CurveKey;
	if (len === 1) return first.value;

	// Clamp t
	if (t <= first.time) return first.value;
	const last = curve[len - 1] as CurveKey;
	if (t >= last.time) return last.value;

	// Find segment
	for (let i = 0; i < len - 1; i++) {
		const a = curve[i] as CurveKey;
		const b = curve[i + 1] as CurveKey;
		if (t >= a.time && t <= b.time) {
			const segT = (t - a.time) / (b.time - a.time);
			return a.value + (b.value - a.value) * segT;
		}
	}

	return last.value;
}

/** A stop on a color gradient */
export interface GradientStop {
	time: number;
	color: string | Color;
}

/** Multi-stop color gradient over particle lifetime */
export type ColorGradient = GradientStop[];

/** Resolve a gradient stop color to a Color instance */
function resolveGradientColor(c: string | Color): Color {
	return c instanceof Color ? c : Color.fromHex(c);
}

/** Evaluate gradient at normalized time t (0..1) */
export function evaluateGradient(gradient: ColorGradient, t: number): Color {
	const len = gradient.length;
	if (len === 0) return Color.WHITE;

	const first = gradient[0] as GradientStop;
	if (len === 1) return resolveGradientColor(first.color);

	// Clamp
	if (t <= first.time) return resolveGradientColor(first.color);
	const last = gradient[len - 1] as GradientStop;
	if (t >= last.time) return resolveGradientColor(last.color);

	// Find segment
	for (let i = 0; i < len - 1; i++) {
		const a = gradient[i] as GradientStop;
		const b = gradient[i + 1] as GradientStop;
		if (t >= a.time && t <= b.time) {
			const segT = (t - a.time) / (b.time - a.time);
			return resolveGradientColor(a.color).lerp(resolveGradientColor(b.color), segT);
		}
	}

	return resolveGradientColor(last.color);
}

/** Property curves that can override per-particle-lifetime behavior */
export interface PropertyCurves {
	/** Size multiplier over lifetime */
	size?: Curve;
	/** Alpha multiplier over lifetime */
	alpha?: Curve;
	/** Speed multiplier over lifetime */
	speed?: Curve;
	/** Color over lifetime (overrides colorStart/colorEnd) */
	color?: ColorGradient;
}
