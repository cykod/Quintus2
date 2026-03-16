/**
 * Struct-of-Arrays particle pool for cache-friendly iteration.
 * No per-particle objects — just flat typed arrays.
 */
export class ParticlePool {
	readonly capacity: number;

	// Position & velocity
	readonly x: Float32Array;
	readonly y: Float32Array;
	readonly vx: Float32Array;
	readonly vy: Float32Array;

	// Lifecycle
	readonly life: Float32Array;
	readonly age: Float32Array;

	// Appearance
	readonly size: Float32Array;
	readonly rotation: Float32Array;
	readonly angularVelocity: Float32Array;

	// Color start (0-1 range)
	readonly r: Float32Array;
	readonly g: Float32Array;
	readonly b: Float32Array;
	readonly a: Float32Array;

	// Color end (for lerping over lifetime)
	readonly rEnd: Float32Array;
	readonly gEnd: Float32Array;
	readonly bEnd: Float32Array;
	readonly aEnd: Float32Array;

	// Size curve
	readonly sizeStart: Float32Array;
	readonly sizeEnd: Float32Array;

	/** Count of active particles */
	alive = 0;

	constructor(capacity: number) {
		this.capacity = capacity;

		this.x = new Float32Array(capacity);
		this.y = new Float32Array(capacity);
		this.vx = new Float32Array(capacity);
		this.vy = new Float32Array(capacity);

		this.life = new Float32Array(capacity);
		this.age = new Float32Array(capacity);

		this.size = new Float32Array(capacity);
		this.rotation = new Float32Array(capacity);
		this.angularVelocity = new Float32Array(capacity);

		this.r = new Float32Array(capacity);
		this.g = new Float32Array(capacity);
		this.b = new Float32Array(capacity);
		this.a = new Float32Array(capacity);

		this.rEnd = new Float32Array(capacity);
		this.gEnd = new Float32Array(capacity);
		this.bEnd = new Float32Array(capacity);
		this.aEnd = new Float32Array(capacity);

		this.sizeStart = new Float32Array(capacity);
		this.sizeEnd = new Float32Array(capacity);
	}

	/**
	 * Activate a new particle slot at `alive` index.
	 * Returns the index, or -1 if pool is full.
	 */
	spawn(): number {
		if (this.alive >= this.capacity) return -1;
		const i = this.alive;
		this.age[i] = 0;
		this.alive++;
		return i;
	}

	/**
	 * Kill particle at index via swap-remove with last alive particle.
	 * Does NOT increment the loop counter — caller must not advance i.
	 */
	kill(index: number): void {
		const last = this.alive - 1;
		if (last < 0) return;
		if (index !== last) {
			this._swap(index, last);
		}
		this.alive--;
	}

	protected _swap(dst: number, src: number): void {
		this.x[dst] = this.x[src] as number;
		this.y[dst] = this.y[src] as number;
		this.vx[dst] = this.vx[src] as number;
		this.vy[dst] = this.vy[src] as number;
		this.life[dst] = this.life[src] as number;
		this.age[dst] = this.age[src] as number;
		this.size[dst] = this.size[src] as number;
		this.rotation[dst] = this.rotation[src] as number;
		this.angularVelocity[dst] = this.angularVelocity[src] as number;
		this.r[dst] = this.r[src] as number;
		this.g[dst] = this.g[src] as number;
		this.b[dst] = this.b[src] as number;
		this.a[dst] = this.a[src] as number;
		this.rEnd[dst] = this.rEnd[src] as number;
		this.gEnd[dst] = this.gEnd[src] as number;
		this.bEnd[dst] = this.bEnd[src] as number;
		this.aEnd[dst] = this.aEnd[src] as number;
		this.sizeStart[dst] = this.sizeStart[src] as number;
		this.sizeEnd[dst] = this.sizeEnd[src] as number;
	}

	/** Kill all particles */
	reset(): void {
		this.alive = 0;
	}
}
