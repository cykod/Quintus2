/** Degrees to radians conversion factor. */
export const DEG2RAD: number = Math.PI / 180;

/** Radians to degrees conversion factor. */
export const RAD2DEG: number = 180 / Math.PI;

/** Default epsilon for floating-point comparisons. */
export const EPSILON: number = 1e-6;

/** Clamp value between min and max. */
export function clamp(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value;
}

/** Linear interpolation between a and b. */
export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/** Inverse lerp: returns t such that lerp(a, b, t) === value. */
export function inverseLerp(a: number, b: number, value: number): number {
	if (a === b) return 0;
	return (value - a) / (b - a);
}

/** Remap value from [inMin, inMax] to [outMin, outMax]. */
export function remap(
	value: number,
	inMin: number,
	inMax: number,
	outMin: number,
	outMax: number,
): number {
	const t = inverseLerp(inMin, inMax, value);
	return lerp(outMin, outMax, t);
}

/** Wrap value to [min, max) range (like modulo but handles negatives). */
export function wrap(value: number, min: number, max: number): number {
	const range = max - min;
	if (range === 0) return min;
	return min + ((((value - min) % range) + range) % range);
}

/** Check if two floats are approximately equal. */
export function approxEqual(a: number, b: number, epsilon: number = EPSILON): boolean {
	return Math.abs(a - b) <= epsilon;
}

/** Snap value to nearest multiple of step. */
export function snap(value: number, step: number): number {
	if (step === 0) return value;
	return Math.round(value / step) * step;
}
