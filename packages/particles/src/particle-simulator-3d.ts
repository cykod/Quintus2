import type { SeededRandom } from "@quintus/math";
import { degToRad, type ResolvedParticleConfig, resolveRange } from "./particle-config.js";
import { degToRad3D, type ResolvedParticleConfig3D, resolveRange3D } from "./particle-config-3d.js";
import { ParticlePool3D } from "./particle-pool-3d.js";
import { ParticleSimulator } from "./particle-simulator.js";

const TAU = Math.PI * 2;

/** Writable numeric array — compatible with Float32Array, TypedArray, etc. */
export interface WritableNumericArray {
	readonly length: number;
	[index: number]: number;
}

/** Minimal interface for Three.js BufferAttribute — avoids importing three */
export interface BufferAttributeLike {
	array: WritableNumericArray;
	needsUpdate: boolean;
}

// Typed-array element read helper
function f32(arr: Float32Array, i: number): number {
	return arr[i] as number;
}

/**
 * 3D particle simulation with spherical velocity emission,
 * z-axis physics, and buffer synchronization for Three.js rendering.
 */
export class ParticleSimulator3D extends ParticleSimulator {
	declare readonly pool: ParticlePool3D;

	constructor(capacity: number) {
		const pool = new ParticlePool3D(capacity);
		super(capacity, pool);
	}

	protected override _spawnParticle(
		config: ResolvedParticleConfig,
		emitterX: number,
		emitterY: number,
		rng: SeededRandom,
	): void {
		const idx = this.pool.spawn();
		if (idx < 0) return;

		const pool = this.pool;
		const cfg = config as ResolvedParticleConfig3D;

		// 3D emission shape offset
		const [ox, oy, oz] = this._emissionOffset3D(cfg, rng);
		pool.x[idx] = emitterX + ox;
		pool.y[idx] = emitterY + oy;
		pool.z[idx] = oz;

		// Spherical velocity from theta/phi + speed
		const speed = resolveRange(cfg.initialSpeed, rng);
		const thetaDeg = resolveRange3D(cfg.initialTheta, rng);
		const phiDeg = resolveRange3D(cfg.initialPhi, rng);
		const theta = degToRad3D(thetaDeg);
		const phi = degToRad3D(phiDeg);
		const sinTheta = Math.sin(theta);
		pool.vx[idx] = sinTheta * Math.cos(phi) * speed;
		pool.vy[idx] = Math.cos(theta) * speed;
		pool.vz[idx] = sinTheta * Math.sin(phi) * speed;

		// Lifetime
		pool.life[idx] = resolveRange(cfg.lifetime, rng);
		pool.age[idx] = 0;

		// Size
		pool.size[idx] = resolveRange(cfg.size, rng);
		pool.sizeStart[idx] = cfg.sizeOverLife[0];
		pool.sizeEnd[idx] = cfg.sizeOverLife[1];

		// Rotation
		pool.rotation[idx] = degToRad(resolveRange(cfg.initialRotation, rng));
		pool.angularVelocity[idx] = degToRad(resolveRange(cfg.angularVelocity, rng));

		// Color start
		pool.r[idx] = cfg.colorStart.r;
		pool.g[idx] = cfg.colorStart.g;
		pool.b[idx] = cfg.colorStart.b;
		pool.a[idx] = cfg.colorStart.a;

		// Color end
		pool.rEnd[idx] = cfg.colorEnd.r;
		pool.gEnd[idx] = cfg.colorEnd.g;
		pool.bEnd[idx] = cfg.colorEnd.b;
		pool.aEnd[idx] = cfg.colorEnd.a;
	}

	override update(
		config: ResolvedParticleConfig,
		dt: number,
		rng: SeededRandom,
		emitterDX = 0,
		emitterDY = 0,
	): void {
		const cfg = config as ResolvedParticleConfig3D;
		const { x, y, vx, vy, age, life, rotation, angularVelocity } = this.pool;
		const { z, vz } = this.pool;
		const gx = cfg.gravityX;
		const gy = cfg.gravityY;
		const gz = cfg.gravityZ;
		const dragFactor = Math.exp(-cfg.drag * dt);
		const turbulence = cfg.turbulence;
		const isLocal = cfg.simulationSpace === "local";

		let i = 0;
		while (i < this.pool.alive) {
			age[i] = f32(age, i) + dt;
			if (f32(age, i) >= f32(life, i)) {
				this.pool.kill(i);
				continue;
			}

			// Local space offset
			if (isLocal) {
				x[i] = f32(x, i) + emitterDX;
				y[i] = f32(y, i) + emitterDY;
			}

			// Velocity integration with drag + gravity
			vx[i] = f32(vx, i) * dragFactor + gx * dt;
			vy[i] = f32(vy, i) * dragFactor + gy * dt;
			vz[i] = f32(vz, i) * dragFactor + gz * dt;

			// Turbulence
			if (turbulence > 0) {
				vx[i] = f32(vx, i) + rng.float(-turbulence, turbulence) * dt;
				vy[i] = f32(vy, i) + rng.float(-turbulence, turbulence) * dt;
				vz[i] = f32(vz, i) + rng.float(-turbulence, turbulence) * dt;
			}

			// Position integration
			x[i] = f32(x, i) + f32(vx, i) * dt;
			y[i] = f32(y, i) + f32(vy, i) * dt;
			z[i] = f32(z, i) + f32(vz, i) * dt;

			// Rotation
			rotation[i] = f32(rotation, i) + f32(angularVelocity, i) * dt;

			i++;
		}
	}

	/**
	 * Synchronize pool SoA data into Three.js-compatible buffer attributes.
	 * Performs color lerp and size-over-life interpolation.
	 */
	syncBuffers(
		positionAttr: BufferAttributeLike,
		colorAttr: BufferAttributeLike,
		sizeAttr: BufferAttributeLike,
	): void {
		const pool = this.pool;
		const alive = pool.alive;
		const posArr = positionAttr.array;
		const colArr = colorAttr.array;
		const sizeArr = sizeAttr.array;

		for (let i = 0; i < alive; i++) {
			const px = f32(pool.x, i);
			const py = f32(pool.y, i);
			const pz = f32(pool.z, i);

			// Position (vec3)
			const i3 = i * 3;
			posArr[i3] = px;
			posArr[i3 + 1] = py;
			posArr[i3 + 2] = pz;

			// Color lerp (vec4: RGBA)
			const life = f32(pool.life, i);
			const t = life > 0 ? f32(pool.age, i) / life : 0;
			const i4 = i * 4;
			const r = f32(pool.r, i);
			const g = f32(pool.g, i);
			const b = f32(pool.b, i);
			const a = f32(pool.a, i);
			colArr[i4] = r + (f32(pool.rEnd, i) - r) * t;
			colArr[i4 + 1] = g + (f32(pool.gEnd, i) - g) * t;
			colArr[i4 + 2] = b + (f32(pool.bEnd, i) - b) * t;
			colArr[i4 + 3] = a + (f32(pool.aEnd, i) - a) * t;

			// Size over life
			const sStart = f32(pool.sizeStart, i);
			const sEnd = f32(pool.sizeEnd, i);
			const scale = sStart + (sEnd - sStart) * t;
			sizeArr[i] = f32(pool.size, i) * scale;
		}

		positionAttr.needsUpdate = true;
		colorAttr.needsUpdate = true;
		sizeAttr.needsUpdate = true;
	}

	private _emissionOffset3D(
		config: ResolvedParticleConfig3D,
		rng: SeededRandom,
	): [number, number, number] {
		switch (config.emissionShape3D) {
			case "point":
				return [0, 0, 0];

			case "sphere": {
				const u = rng.next();
				const v = rng.next();
				const theta = TAU * u;
				const phi = Math.acos(2 * v - 1);
				const r = config.emissionRadius * Math.cbrt(rng.next());
				const sinPhi = Math.sin(phi);
				return [r * sinPhi * Math.cos(theta), r * Math.cos(phi), r * sinPhi * Math.sin(theta)];
			}

			case "hemisphere": {
				const u = rng.next();
				const v = rng.next() * 0.5; // only upper hemisphere
				const theta = TAU * u;
				const phi = Math.acos(1 - 2 * v);
				const r = config.emissionRadius * Math.cbrt(rng.next());
				const sinPhi = Math.sin(phi);
				return [r * sinPhi * Math.cos(theta), r * Math.cos(phi), r * sinPhi * Math.sin(theta)];
			}

			case "box": {
				return [
					rng.float(-config.emissionBoxX, config.emissionBoxX),
					rng.float(-config.emissionBoxY, config.emissionBoxY),
					rng.float(-config.emissionBoxZ, config.emissionBoxZ),
				];
			}

			default:
				return [0, 0, 0];
		}
	}
}
