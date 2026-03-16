import type { ParticleConfig3D } from "./particle-config-3d.js";

function preset(base: ParticleConfig3D, overrides?: Partial<ParticleConfig3D>): ParticleConfig3D {
	return { ...base, ...overrides };
}

/** Built-in 3D particle presets. Each function returns a fresh config safe to mutate. */
export const Particles3D = {
	/** Upward flames with 3D spread */
	fire(overrides?: Partial<ParticleConfig3D>): ParticleConfig3D {
		return preset(
			{
				maxParticles: 150,
				emissionRate: 40,
				emissionShape3D: "sphere",
				emissionRadius: 3,
				initialSpeed: [60, 100],
				initialTheta: [0, 30], // upward cone
				initialPhi: [0, 360],
				gravityY: 20,
				drag: 0.01,
				turbulence: 15,
				size: [3, 7],
				sizeOverLife: [1, 0],
				colorStart: "#ffcc00",
				colorEnd: "#ff000000",
				blendMode: "additive",
				lifetime: [0.3, 0.8],
			},
			overrides,
		);
	},

	/** Bright sparks flying outward in all directions */
	sparks(overrides?: Partial<ParticleConfig3D>): ParticleConfig3D {
		return preset(
			{
				maxParticles: 80,
				emissionRate: 30,
				emissionShape3D: "point",
				initialSpeed: [100, 250],
				initialTheta: [0, 180], // full sphere
				initialPhi: [0, 360],
				gravityY: -150,
				drag: 0.03,
				size: [1, 3],
				sizeOverLife: [1, 0],
				colorStart: "#ffee88",
				colorEnd: "#ff660000",
				blendMode: "additive",
				lifetime: [0.2, 0.6],
			},
			overrides,
		);
	},

	/** Radial burst in 3D — use with burst() */
	explosion(overrides?: Partial<ParticleConfig3D>): ParticleConfig3D {
		return preset(
			{
				maxParticles: 200,
				emissionRate: 0,
				emissionShape3D: "point",
				initialSpeed: [150, 350],
				initialTheta: [0, 180],
				initialPhi: [0, 360],
				gravityY: -100,
				drag: 0.04,
				turbulence: 20,
				size: [3, 8],
				sizeOverLife: [1, 0],
				colorStart: "#ffaa00",
				colorEnd: "#ff000000",
				blendMode: "additive",
				lifetime: [0.3, 0.8],
			},
			overrides,
		);
	},

	/** Floating sparkles in a sphere — magical aura effect */
	magic(overrides?: Partial<ParticleConfig3D>): ParticleConfig3D {
		return preset(
			{
				maxParticles: 120,
				emissionRate: 30,
				emissionShape3D: "sphere",
				emissionRadius: 15,
				initialSpeed: [5, 20],
				initialTheta: [0, 180],
				initialPhi: [0, 360],
				gravityY: 5,
				drag: 0.01,
				turbulence: 8,
				size: [1, 4],
				sizeOverLife: [0, 1],
				colorStart: "#cc88ff",
				colorEnd: "#4422ff00",
				blendMode: "additive",
				lifetime: [0.5, 1.5],
			},
			overrides,
		);
	},

	/** 3D snowfall from a wide box area above */
	snow(overrides?: Partial<ParticleConfig3D>): ParticleConfig3D {
		return preset(
			{
				maxParticles: 200,
				emissionRate: 40,
				emissionShape3D: "box",
				emissionBoxX: 200,
				emissionBoxY: 0,
				emissionBoxZ: 200,
				initialSpeed: [20, 50],
				initialTheta: [170, 180], // downward
				initialPhi: [0, 360],
				gravityY: -10,
				drag: 0.01,
				turbulence: 15,
				size: [2, 5],
				sizeOverLife: [1, 0.8],
				colorStart: "#ffffffcc",
				colorEnd: "#ffffff44",
				lifetime: [2, 5],
			},
			overrides,
		);
	},

	/** Trail behind a moving 3D object */
	trail(overrides?: Partial<ParticleConfig3D>): ParticleConfig3D {
		return preset(
			{
				maxParticles: 100,
				emissionRate: 60,
				emissionShape3D: "point",
				initialSpeed: [0, 5],
				initialTheta: [0, 180],
				initialPhi: [0, 360],
				drag: 0.05,
				size: [2, 4],
				sizeOverLife: [1, 0],
				colorStart: "#ffffffcc",
				colorEnd: "#ffffff00",
				blendMode: "additive",
				lifetime: [0.2, 0.5],
			},
			overrides,
		);
	},
};
