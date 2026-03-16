import type { SeededRandom } from "@quintus/math";
import { degToRad, type ResolvedParticleConfig, resolveRange } from "./particle-config.js";
import { ParticlePool } from "./particle-pool.js";

const TAU = Math.PI * 2;

// Typed-array element read. Always safe for indices within [0, alive).
// Uses `as number` instead of `!` to satisfy biome noNonNullAssertion.
function f32(arr: Float32Array, i: number): number {
	return arr[i] as number;
}

/**
 * Pure simulation logic: emission, physics integration, and death.
 * Separated from rendering and scene tree for headless testing.
 */
export class ParticleSimulator {
	readonly pool: ParticlePool;
	private _emissionAccumulator = 0;
	private _prevConfig: ResolvedParticleConfig | null = null;

	constructor(capacity: number, pool?: ParticlePool) {
		this.pool = pool ?? new ParticlePool(capacity);
	}

	/** Emit new particles based on config emission rate and dt */
	emit(
		config: ResolvedParticleConfig,
		dt: number,
		emitterX: number,
		emitterY: number,
		rng: SeededRandom,
	): void {
		// Reset accumulator if config reference changed
		if (config !== this._prevConfig) {
			this._emissionAccumulator = 0;
			this._prevConfig = config;
		}

		this._emissionAccumulator += config.emissionRate * dt;

		// Cap emissions per frame to prevent spawn storms after lag spikes
		const maxPerFrame = Math.ceil(config.maxParticles * 0.25);
		const toEmit = Math.min(Math.floor(this._emissionAccumulator), maxPerFrame);
		this._emissionAccumulator -= toEmit;

		for (let n = 0; n < toEmit; n++) {
			this._spawnParticle(config, emitterX, emitterY, rng);
		}
	}

	/** Emit a fixed number of particles immediately (burst mode) */
	burst(
		config: ResolvedParticleConfig,
		count: number,
		emitterX: number,
		emitterY: number,
		rng: SeededRandom,
	): void {
		for (let n = 0; n < count; n++) {
			this._spawnParticle(config, emitterX, emitterY, rng);
		}
	}

	/**
	 * Update all alive particles: motion, aging, death.
	 * emitterDX/DY are the emitter's frame-to-frame position delta,
	 * used to offset particles when simulationSpace is "local".
	 */
	update(
		config: ResolvedParticleConfig,
		dt: number,
		rng: SeededRandom,
		emitterDX = 0,
		emitterDY = 0,
	): void {
		const { x, y, vx, vy, age, life, rotation, angularVelocity } = this.pool;
		const gx = config.gravityX;
		const gy = config.gravityY;
		const dragFactor = Math.exp(-config.drag * dt);
		const turbulence = config.turbulence;
		const isLocal = config.simulationSpace === "local";

		let i = 0;
		while (i < this.pool.alive) {
			age[i] = f32(age, i) + dt;
			if (f32(age, i) >= f32(life, i)) {
				this.pool.kill(i);
				continue;
			}

			// Local space: offset particles by emitter movement delta
			if (isLocal) {
				x[i] = f32(x, i) + emitterDX;
				y[i] = f32(y, i) + emitterDY;
			}

			// Velocity integration (exponential drag for determinism across timesteps)
			vx[i] = f32(vx, i) * dragFactor + gx * dt;
			vy[i] = f32(vy, i) * dragFactor + gy * dt;

			// Turbulence (random jitter)
			if (turbulence > 0) {
				vx[i] = f32(vx, i) + rng.float(-turbulence, turbulence) * dt;
				vy[i] = f32(vy, i) + rng.float(-turbulence, turbulence) * dt;
			}

			// Position integration
			x[i] = f32(x, i) + f32(vx, i) * dt;
			y[i] = f32(y, i) + f32(vy, i) * dt;

			// Rotation
			rotation[i] = f32(rotation, i) + f32(angularVelocity, i) * dt;

			i++;
		}
	}

	/** Reset the emission accumulator */
	resetAccumulator(): void {
		this._emissionAccumulator = 0;
	}

	protected _spawnParticle(
		config: ResolvedParticleConfig,
		emitterX: number,
		emitterY: number,
		rng: SeededRandom,
	): void {
		const idx = this.pool.spawn();
		if (idx < 0) return; // Pool full

		const pool = this.pool;

		// Position from emission shape
		const [ox, oy] = this._emissionOffset(config, rng);
		pool.x[idx] = emitterX + ox;
		pool.y[idx] = emitterY + oy;

		// Velocity from angle + speed
		const angleDeg = resolveRange(config.initialAngle, rng);
		const angleRad = degToRad(angleDeg);
		const speed = resolveRange(config.initialSpeed, rng);
		pool.vx[idx] = Math.cos(angleRad) * speed;
		pool.vy[idx] = Math.sin(angleRad) * speed;

		// Lifetime
		pool.life[idx] = resolveRange(config.lifetime, rng);
		pool.age[idx] = 0;

		// Size
		const baseSize = resolveRange(config.size, rng);
		pool.size[idx] = baseSize;
		pool.sizeStart[idx] = config.sizeOverLife[0];
		pool.sizeEnd[idx] = config.sizeOverLife[1];

		// Rotation
		pool.rotation[idx] = degToRad(resolveRange(config.initialRotation, rng));
		pool.angularVelocity[idx] = degToRad(resolveRange(config.angularVelocity, rng));

		// Color start
		pool.r[idx] = config.colorStart.r;
		pool.g[idx] = config.colorStart.g;
		pool.b[idx] = config.colorStart.b;
		pool.a[idx] = config.colorStart.a;

		// Color end
		pool.rEnd[idx] = config.colorEnd.r;
		pool.gEnd[idx] = config.colorEnd.g;
		pool.bEnd[idx] = config.colorEnd.b;
		pool.aEnd[idx] = config.colorEnd.a;
	}

	protected _emissionOffset(config: ResolvedParticleConfig, rng: SeededRandom): [number, number] {
		switch (config.emissionShape) {
			case "point":
				return [0, 0];

			case "circle": {
				const angle = rng.float(0, TAU);
				const r = config.emissionRadius * Math.sqrt(rng.next());
				return [Math.cos(angle) * r, Math.sin(angle) * r];
			}

			case "ring": {
				const angle = rng.float(0, TAU);
				const r = config.emissionRadius;
				return [Math.cos(angle) * r, Math.sin(angle) * r];
			}

			case "rect": {
				const hw = config.emissionWidth * 0.5;
				const hh = config.emissionHeight * 0.5;
				return [rng.float(-hw, hw), rng.float(-hh, hh)];
			}

			case "line": {
				const halfLen = config.emissionLength * 0.5;
				const t = rng.float(-halfLen, halfLen);
				const lineAngle = degToRad(config.emissionLineAngle);
				return [Math.cos(lineAngle) * t, Math.sin(lineAngle) * t];
			}

			default:
				return [0, 0];
		}
	}
}
