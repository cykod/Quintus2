import type { ParticleConfig3D } from "@quintus/particles";
import { ParticleEmitter3D } from "@quintus/particles";
import type { Node3D } from "@quintus/three";

/** Blood spray when an enemy is hit. Spawned at enemy position, oneShot. */
export const BLOOD_BURST_CONFIG: ParticleConfig3D = {
	maxParticles: 30,
	emissionRate: 0,
	emissionShape3D: "point",
	initialSpeed: [1, 3],
	initialTheta: [0, 60],
	initialPhi: [0, 360],
	gravityY: -4,
	drag: 0.03,
	size: [0.1, 0.25],
	sizeOverLife: [1, 0],
	colorStart: "#cc0000",
	colorEnd: "#66000000",
	blendMode: "normal",
	lifetime: [0.3, 0.6],
};

/** Gold sparkle burst on coin collect. */
export const COIN_BURST_CONFIG: ParticleConfig3D = {
	maxParticles: 40,
	emissionRate: 0,
	emissionShape3D: "point",
	initialSpeed: [1, 2.5],
	initialTheta: [0, 70],
	initialPhi: [0, 360],
	gravityY: -1.5,
	drag: 0.02,
	size: [0.08, 0.2],
	sizeOverLife: [1, 0],
	colorStart: "#ffd700",
	colorEnd: "#ffaa0000",
	blendMode: "additive",
	lifetime: [0.3, 0.7],
};

/** Footstep dust puff. */
export const DUST_PUFF_CONFIG: ParticleConfig3D = {
	maxParticles: 15,
	emissionRate: 0,
	emissionShape3D: "sphere",
	emissionRadius: 0.08,
	initialSpeed: [3, 8],
	initialTheta: [60, 120],
	initialPhi: [0, 360],
	gravityY: 2,
	drag: 0.06,
	size: [0.15, 0.4],
	sizeOverLife: [0.5, 0],
	colorStart: "#aa997744",
	colorEnd: "#aa997700",
	blendMode: "normal",
	lifetime: [0.2, 0.4],
};

/** Green heal burst on health potion pickup. */
export const HEAL_BURST_CONFIG: ParticleConfig3D = {
	maxParticles: 25,
	emissionRate: 0,
	emissionShape3D: "point",
	initialSpeed: [0.8, 2],
	initialTheta: [0, 50],
	initialPhi: [0, 360],
	gravityY: 0.5,
	drag: 0.03,
	size: [0.08, 0.2],
	sizeOverLife: [1, 0],
	colorStart: "#66ff66",
	colorEnd: "#00ff0000",
	blendMode: "additive",
	lifetime: [0.4, 0.8],
};

/** Spawn a blood burst at a world position, auto-destroys. */
export function spawnBloodBurst(parent: Node3D, x: number, y: number, z: number): void {
	ParticleEmitter3D.burst(parent, BLOOD_BURST_CONFIG, { x, y, z }, 20);
}

/** Spawn a gold coin burst at a world position, auto-destroys. */
export function spawnCoinBurst(parent: Node3D, x: number, y: number, z: number): void {
	ParticleEmitter3D.burst(parent, COIN_BURST_CONFIG, { x, y, z }, 30);
}

/** Spawn a dust puff at a world position, auto-destroys. */
export function spawnDustPuff(parent: Node3D, x: number, y: number, z: number): void {
	ParticleEmitter3D.burst(parent, DUST_PUFF_CONFIG, { x, y, z }, 8);
}

/** Spawn a green heal burst at a world position, auto-destroys. */
export function spawnHealBurst(parent: Node3D, x: number, y: number, z: number): void {
	ParticleEmitter3D.burst(parent, HEAL_BURST_CONFIG, { x, y, z }, 20);
}
