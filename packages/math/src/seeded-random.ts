import { Color } from "./color.js";
import { Vec2 } from "./vec2.js";

export class SeededRandom {
	/** The original seed value passed to the constructor (immutable). */
	readonly seed: number;

	private _state: number;

	constructor(seed: number) {
		this.seed = seed;
		this._state = seed;
	}

	// === Core ===
	/** Returns a float in [0, 1). Advances the state. */
	next(): number {
		return this.advance();
	}

	// === Convenience ===
	/** Random integer in [min, max] (inclusive). */
	int(min: number, max: number): number {
		return min + Math.floor(this.advance() * (max - min + 1));
	}

	/** Random float in [min, max). */
	float(min: number, max: number): number {
		return min + this.advance() * (max - min);
	}

	/** Returns true with the given probability (default 0.5). */
	bool(probability: number = 0.5): boolean {
		return this.advance() < probability;
	}

	/** Pick a random element from an array. */
	pick<T>(array: readonly T[]): T {
		return array[Math.floor(this.advance() * array.length)] as T;
	}

	/** Return a shuffled copy (Fisher-Yates). Does NOT mutate the input. */
	shuffle<T>(array: readonly T[]): T[] {
		const result = [...array];
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(this.advance() * (i + 1));
			const tmp = result[i] as T;
			result[i] = result[j] as T;
			result[j] = tmp;
		}
		return result;
	}

	/** Random angle in [0, 2*PI). */
	angle(): number {
		return this.advance() * Math.PI * 2;
	}

	/** Random unit vector (direction). */
	direction(): Vec2 {
		const a = this.angle();
		return new Vec2(Math.cos(a), Math.sin(a));
	}

	/** Random point inside a circle of given radius, centered at origin. */
	inCircle(radius: number): Vec2 {
		const a = this.angle();
		const r = radius * Math.sqrt(this.advance());
		return new Vec2(Math.cos(a) * r, Math.sin(a) * r);
	}

	/** Random point inside a rectangle of given size, starting at origin. */
	inRect(width: number, height: number): Vec2 {
		return new Vec2(this.advance() * width, this.advance() * height);
	}

	/** Random color (full alpha). */
	color(): Color {
		return new Color(this.advance(), this.advance(), this.advance(), 1);
	}

	/** Weighted random selection. */
	weighted<T>(items: ReadonlyArray<{ value: T; weight: number }>): T {
		let total = 0;
		for (const item of items) {
			total += item.weight;
		}
		let roll = this.advance() * total;
		for (const item of items) {
			roll -= item.weight;
			if (roll <= 0) return item.value;
		}
		return (items[items.length - 1] as { value: T; weight: number }).value;
	}

	/**
	 * Fork: create a child RNG with its own independent sequence.
	 * The child's seed is derived deterministically from the parent's state + label hash.
	 */
	fork(label?: string): SeededRandom {
		let childSeed = this._state;
		if (label) {
			// Simple string hash (djb2)
			let hash = 5381;
			for (let i = 0; i < label.length; i++) {
				hash = ((hash << 5) + hash + label.charCodeAt(i)) | 0;
			}
			childSeed = (childSeed + hash) | 0;
		}
		// Advance parent state so subsequent forks produce different seeds
		this.advance();
		return new SeededRandom(childSeed);
	}

	/** Get the current internal state (for serialization/restore). */
	get state(): number {
		return this._state;
	}

	/** Restore an RNG from a previously serialized state. */
	static fromState(state: number): SeededRandom {
		const rng = new SeededRandom(0);
		rng._state = state;
		return rng;
	}

	// === Private: mulberry32 ===
	private advance(): number {
		this._state += 0x6d2b79f5;
		let t = this._state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
}
