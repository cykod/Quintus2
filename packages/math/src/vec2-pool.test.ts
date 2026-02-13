// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Vec2Pool } from "./vec2-pool.js";

describe("Vec2Pool", () => {
	it("get returns mutable {x, y} with correct values", () => {
		const pool = new Vec2Pool(4);
		pool.begin();
		const tmp = pool.get(3, 4);
		expect(tmp.x).toBe(3);
		expect(tmp.y).toBe(4);
		pool.end();
	});

	it("begin/end resets cursor — temporaries are reused", () => {
		const pool = new Vec2Pool(4);
		pool.begin();
		const a = pool.get(1, 2);
		pool.end();

		pool.begin();
		const b = pool.get(5, 6);
		expect(b).toBe(a); // Same pooled object
		expect(b.x).toBe(5);
		expect(b.y).toBe(6);
		pool.end();
	});

	it("freeze converts to immutable Vec2", () => {
		const pool = new Vec2Pool(4);
		pool.begin();
		const tmp = pool.get(7, 8);
		const v = pool.freeze(tmp);
		expect(v.x).toBe(7);
		expect(v.y).toBe(8);
		pool.end();
	});

	it("handles pool exhaustion gracefully", () => {
		const pool = new Vec2Pool(2);
		pool.begin();
		pool.get(1, 1);
		pool.get(2, 2);
		// Pool is full, should still return a valid object
		const overflow = pool.get(3, 3);
		expect(overflow.x).toBe(3);
		expect(overflow.y).toBe(3);
		pool.end();
	});

	it("multiple begin/end scopes work correctly", () => {
		const pool = new Vec2Pool(4);

		pool.begin();
		const a = pool.get(1, 2);
		const b = pool.get(3, 4);
		expect(a.x).toBe(1);
		expect(b.x).toBe(3);
		pool.end();

		pool.begin();
		const c = pool.get(10, 20);
		expect(c).toBe(a); // Reused from slot 0
		expect(c.x).toBe(10);
		pool.end();
	});

	it("pool does not interfere with normal Vec2 operations", () => {
		const pool = new Vec2Pool(4);
		pool.begin();
		const tmp = pool.get(1, 2);
		const frozen = pool.freeze(tmp);
		// Modify the pool entry
		tmp.x = 99;
		// Frozen Vec2 is independent
		expect(frozen.x).toBe(1);
		pool.end();
	});

	it("default capacity is 64", () => {
		const pool = new Vec2Pool();
		pool.begin();
		// Should be able to get 64 entries without overflow
		for (let i = 0; i < 64; i++) {
			pool.get(i, i);
		}
		pool.end();
	});
});
