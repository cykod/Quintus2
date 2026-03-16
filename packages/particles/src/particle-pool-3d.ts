import { ParticlePool } from "./particle-pool.js";

/**
 * Extends ParticlePool with z-axis position and velocity arrays
 * for 3D particle simulation.
 */
export class ParticlePool3D extends ParticlePool {
	readonly z: Float32Array;
	readonly vz: Float32Array;

	constructor(capacity: number) {
		super(capacity);
		this.z = new Float32Array(capacity);
		this.vz = new Float32Array(capacity);
	}

	override spawn(): number {
		const i = super.spawn();
		if (i >= 0) {
			this.z[i] = 0;
			this.vz[i] = 0;
		}
		return i;
	}

	protected override _swap(dst: number, src: number): void {
		super._swap(dst, src);
		this.z[dst] = this.z[src] as number;
		this.vz[dst] = this.vz[src] as number;
	}
}
