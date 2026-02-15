export type EasingFn = (t: number) => number;

export const Ease = {
	// Linear
	linear: (t: number) => t,

	// Quadratic
	quadIn: (t: number) => t * t,
	quadOut: (t: number) => t * (2 - t),
	quadInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

	// Cubic
	cubicIn: (t: number) => t * t * t,
	cubicOut: (t: number) => {
		const u = t - 1;
		return u * u * u + 1;
	},
	cubicInOut: (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),

	// Sine
	sineIn: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
	sineOut: (t: number) => Math.sin((t * Math.PI) / 2),
	sineInOut: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,

	// Exponential
	expoIn: (t: number) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
	expoOut: (t: number) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),

	// Elastic
	elasticOut: (t: number) => {
		const c4 = (2 * Math.PI) / 3;
		return t === 0 ? 0 : t === 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
	},

	// Bounce
	bounceOut: (t: number) => {
		const n1 = 7.5625;
		const d1 = 2.75;
		if (t < 1 / d1) return n1 * t * t;
		if (t < 2 / d1) {
			const b = t - 1.5 / d1;
			return n1 * b * b + 0.75;
		}
		if (t < 2.5 / d1) {
			const b = t - 2.25 / d1;
			return n1 * b * b + 0.9375;
		}
		const b = t - 2.625 / d1;
		return n1 * b * b + 0.984375;
	},

	// Back (overshoots)
	backOut: (t: number) => {
		const c1 = 1.70158;
		const c3 = c1 + 1;
		return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
	},
} as const;
