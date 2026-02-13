import { Vec2 } from "./vec2.js";

/**
 * @internal Engine-only. Not exported from the public API.
 *
 * Object pool for temporary Vec2 values in hot paths.
 * Usage pattern:
 *   const pool = new Vec2Pool(64);
 *   pool.begin();         // Start of frame / hot section
 *   const tmp = pool.get(x, y);  // Borrow a temporary
 *   // ... use tmp for intermediate calculations ...
 *   pool.end();           // All borrowed temporaries are "freed"
 *
 * Temporaries MUST NOT escape the begin/end scope (don't store them).
 */
export class Vec2Pool {
	private readonly pool: Array<{ x: number; y: number }>;
	private cursor: number = 0;
	private readonly capacity: number;

	constructor(capacity: number = 64) {
		this.capacity = capacity;
		this.pool = [];
		for (let i = 0; i < capacity; i++) {
			this.pool.push({ x: 0, y: 0 });
		}
	}

	/** Mark the start of a pooled section. Resets the cursor. */
	begin(): void {
		this.cursor = 0;
	}

	/** Get a temporary mutable {x, y} from the pool. */
	get(x: number, y: number): { x: number; y: number } {
		if (this.cursor >= this.capacity) {
			// Pool exhausted — allocate a new temporary (not pooled)
			return { x, y };
		}
		const tmp = this.pool[this.cursor++]!;
		tmp.x = x;
		tmp.y = y;
		return tmp;
	}

	/** Mark the end of a pooled section. */
	end(): void {
		this.cursor = 0;
	}

	/** Convert a pooled temporary back to an immutable Vec2. */
	freeze(tmp: { x: number; y: number }): Vec2 {
		return new Vec2(tmp.x, tmp.y);
	}
}
