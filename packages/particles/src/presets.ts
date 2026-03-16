import type { ParticleConfig } from "./particle-config.js";

function preset(
    base: ParticleConfig,
    overrides?: Partial<ParticleConfig>,
): ParticleConfig {
    return { ...base, ...overrides };
}

/** Built-in particle presets. Each function returns a fresh config safe to mutate. */
export const Particles = {
    /** Upward flames, yellow to orange to red, fading to transparent */
    fire(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 150,
                emissionRate: 40,
                emissionShape: "circle",
                emissionRadius: 5,
                initialSpeed: [60, 100],
                initialAngle: [-100, -80],
                gravityY: -20,
                drag: 0.01,
                turbulence: 15,
                shape: "circle",
                size: [3, 7],
                sizeOverLife: [1, 0],
                colorStart: "#ffcc00",
                colorEnd: "#ff000000",
                blendMode: "additive",
                lifetime: [0.3, 0.8],
                simulationSpace: "world",
            },
            overrides,
        );
    },

    /** Soft gray puffs, rising and expanding */
    smoke(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 100,
                emissionRate: 20,
                emissionShape: "circle",
                emissionRadius: 3,
                initialSpeed: [20, 40],
                initialAngle: [-100, -80],
                gravityY: -10,
                drag: 0.02,
                turbulence: 10,
                shape: "circle",
                size: [4, 8],
                sizeOverLife: [0.5, 1],
                colorStart: "#88888888",
                colorEnd: "#44444400",
                blendMode: "normal",
                lifetime: [1, 2.5],
                simulationSpace: "world",
            },
            overrides,
        );
    },

    /** Short-lived bright dots flying outward in all directions */
    sparks(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 80,
                emissionRate: 30,
                emissionShape: "point",
                initialSpeed: [100, 250],
                initialAngle: [0, 360],
                gravityY: 150,
                drag: 0.03,
                turbulence: 0,
                shape: "rect",
                size: [1, 3],
                sizeOverLife: [1, 0],
                colorStart: "#ffee88",
                colorEnd: "#ff660000",
                blendMode: "additive",
                lifetime: [0.2, 0.6],
                simulationSpace: "world",
            },
            overrides,
        );
    },

    /** Radial burst, fast outward, quick fade — use with burst() */
    explosion(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 200,
                emissionRate: 0,
                emissionShape: "point",
                initialSpeed: [150, 350],
                initialAngle: [0, 360],
                gravityY: 100,
                drag: 0.04,
                turbulence: 20,
                shape: "circle",
                size: [3, 8],
                sizeOverLife: [1, 0],
                colorStart: "#ffaa00",
                colorEnd: "#ff000000",
                blendMode: "additive",
                lifetime: [0.3, 0.8],
                simulationSpace: "world",
            },
            overrides,
        );
    },

    /** Directional splatter with gravity — use with burst() */
    blood(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 100,
                emissionRate: 0,
                emissionShape: "point",
                initialSpeed: [80, 200],
                initialAngle: [-160, -20],
                gravityY: 300,
                drag: 0.02,
                turbulence: 5,
                shape: "circle",
                size: [2, 5],
                sizeOverLife: [1, 0.6],
                colorStart: "#cc0000",
                colorEnd: "#66000000",
                blendMode: "normal",
                lifetime: [0.3, 0.8],
                simulationSpace: "world",
            },
            overrides,
        );
    },

    /** Downward streaks across a wide area */
    rain(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 300,
                emissionRate: 150,
                emissionShape: "rect",
                emissionWidth: 400,
                emissionHeight: 0,
                initialSpeed: [300, 500],
                initialAngle: [85, 95],
                gravityY: 0,
                drag: 0,
                turbulence: 0,
                shape: "rect",
                size: [1, 2],
                sizeOverLife: [1, 1],
                colorStart: "#aaccff88",
                colorEnd: "#aaccff44",
                blendMode: "normal",
                lifetime: [0.3, 0.6],
                simulationSpace: "world",
            },
            overrides,
        );
    },

    /** Slow, drifting, slightly random snowflakes */
    snow(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 200,
                emissionRate: 40,
                emissionShape: "rect",
                emissionWidth: 400,
                emissionHeight: 0,
                initialSpeed: [20, 50],
                initialAngle: [80, 100],
                gravityY: 10,
                drag: 0.01,
                turbulence: 15,
                shape: "circle",
                size: [4, 8],
                sizeOverLife: [1, 0.8],
                colorStart: "#ffffffcc",
                colorEnd: "#ffffff44",
                blendMode: "normal",
                angularVelocity: [-60, 90],
                lifetime: [2, 5],
                simulationSpace: "world",
            },
            overrides,
        );
    },

    /** Radial sparkle with slow drift — magical aura effect */
    magic(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 120,
                emissionRate: 30,
                emissionShape: "circle",
                emissionRadius: 15,
                initialSpeed: [5, 20],
                initialAngle: [0, 360],
                gravityY: -5,
                drag: 0.01,
                turbulence: 8,
                shape: "circle",
                size: [1, 4],
                sizeOverLife: [0, 1],
                colorStart: "#cc88ff",
                colorEnd: "#4422ff00",
                blendMode: "additive",
                lifetime: [0.5, 1.5],
                simulationSpace: "world",
            },
            overrides,
        );
    },

    /** Dark wisps rising from a surface */
    poison(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 80,
                emissionRate: 20,
                emissionShape: "line",
                emissionLength: 30,
                emissionLineAngle: 0,
                initialSpeed: [15, 35],
                initialAngle: [-100, -80],
                gravityY: -5,
                drag: 0.02,
                turbulence: 12,
                shape: "circle",
                size: [3, 6],
                sizeOverLife: [0.8, 0],
                colorStart: "#44cc44aa",
                colorEnd: "#22662200",
                blendMode: "normal",
                lifetime: [0.8, 1.8],
                simulationSpace: "world",
            },
            overrides,
        );
    },

    /** Very fast, short-lived bright sparks — electrical effect */
    electric(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 60,
                emissionRate: 40,
                emissionShape: "point",
                initialSpeed: [200, 400],
                initialAngle: [0, 360],
                gravityY: 0,
                drag: 0.1,
                turbulence: 100,
                shape: "rect",
                size: [1, 2],
                sizeOverLife: [1, 0],
                colorStart: "#88ccff",
                colorEnd: "#4488ffaa",
                blendMode: "additive",
                lifetime: [0.05, 0.15],
                simulationSpace: "world",
            },
            overrides,
        );
    },

    /** Slow, rising, slightly transparent circles */
    bubbles(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 60,
                emissionRate: 10,
                emissionShape: "line",
                emissionLength: 40,
                emissionLineAngle: 0,
                initialSpeed: [20, 40],
                initialAngle: [-95, -85],
                gravityY: -15,
                drag: 0.01,
                turbulence: 8,
                shape: "circle",
                size: [3, 7],
                sizeOverLife: [1, 1],
                colorStart: "#aaddff66",
                colorEnd: "#aaddff00",
                blendMode: "normal",
                lifetime: [1, 3],
                simulationSpace: "world",
            },
            overrides,
        );
    },

    /** Slow falling with rotation and horizontal drift */
    leaves(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 80,
                emissionRate: 10,
                emissionShape: "rect",
                emissionWidth: 300,
                emissionHeight: 0,
                initialSpeed: [10, 30],
                initialAngle: [70, 110],
                gravityY: 20,
                drag: 0.01,
                turbulence: 20,
                shape: "rect",
                size: [8, 8],
                sizeOverLife: [1, 0.7],
                colorStart: "#88aa44",
                colorEnd: "#aa882244",
                blendMode: "normal",
                angularVelocity: [-90, 90],
                initialRotation: [0, 360],
                lifetime: [2, 5],
                simulationSpace: "world",
            },
            overrides,
        );
    },

    /** Trail effect behind a moving object */
    trail(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 100,
                emissionRate: 60,
                emissionShape: "point",
                initialSpeed: [0, 5],
                initialAngle: [0, 360],
                gravityY: 0,
                drag: 0.05,
                turbulence: 0,
                shape: "circle",
                size: [2, 4],
                sizeOverLife: [1, 0],
                colorStart: "#ffffffcc",
                colorEnd: "#ffffff00",
                blendMode: "additive",
                lifetime: [0.2, 0.5],
                simulationSpace: "world",
            },
            overrides,
        );
    },

    /** Small chunks flying from an impact point — use with burst() */
    debris(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 80,
                emissionRate: 0,
                initialSpeed: [80, 200],
                initialAngle: [-150, -30],
                gravityY: 400,
                drag: 0.01,
                turbulence: 0,
                shape: "rect",
                size: [2, 5],
                sizeOverLife: [1, 0.8],
                colorStart: "#997755",
                colorEnd: "#66442200",
                blendMode: "normal",
                angularVelocity: [-360, 360],
                initialRotation: [0, 360],
                lifetime: [0.4, 1.0],
                simulationSpace: "world",
            },
            overrides,
        );
    },

    /** Collect/pickup sparkle effect — use with burst() */
    collect(overrides?: Partial<ParticleConfig>): ParticleConfig {
        return preset(
            {
                maxParticles: 60,
                emissionRate: 0,
                emissionShape: "circle",
                emissionRadius: 8,
                initialSpeed: [30, 80],
                initialAngle: [0, 360],
                gravityY: -30,
                drag: 0.03,
                turbulence: 5,
                shape: "circle",
                size: [1, 4],
                sizeOverLife: [1, 0],
                colorStart: "#ffee44",
                colorEnd: "#ffcc0000",
                blendMode: "additive",
                lifetime: [0.3, 0.7],
                simulationSpace: "world",
            },
            overrides,
        );
    },
};
