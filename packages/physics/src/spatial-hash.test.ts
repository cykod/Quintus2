import { AABB, Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { SpatialHash } from "./spatial-hash.js";

/** Helper to create an AABB from center + half-extents. */
function aabb(cx: number, cy: number, hw: number, hh: number): AABB {
	return new AABB(new Vec2(cx - hw, cy - hh), new Vec2(cx + hw, cy + hh));
}

describe("SpatialHash", () => {
	it("insert item → queryable in correct cells", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		const item = { label: "a" };
		hash.insert(item, aabb(32, 32, 8, 8));

		const results = hash.query(aabb(32, 32, 1, 1));
		expect(results.has(item)).toBe(true);
		expect(hash.count).toBe(1);
	});

	it("remove item → no longer returned by queries", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		const item = { label: "a" };
		hash.insert(item, aabb(32, 32, 8, 8));
		hash.remove(item);

		const results = hash.query(aabb(32, 32, 1, 1));
		expect(results.has(item)).toBe(false);
		expect(hash.count).toBe(0);
	});

	it("update item after move → found in new cells, not old", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		const item = { label: "a" };
		hash.insert(item, aabb(32, 32, 8, 8)); // cell (0,0)
		hash.update(item, aabb(200, 200, 8, 8)); // cell (3,3)

		const oldQuery = hash.query(aabb(32, 32, 1, 1));
		expect(oldQuery.has(item)).toBe(false);

		const newQuery = hash.query(aabb(200, 200, 1, 1));
		expect(newQuery.has(item)).toBe(true);
	});

	it("update with same cells is a no-op", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		const item = { label: "a" };
		hash.insert(item, aabb(32, 32, 8, 8));
		// Move within the same cell
		hash.update(item, aabb(33, 33, 8, 8));

		const results = hash.query(aabb(32, 32, 1, 1));
		expect(results.has(item)).toBe(true);
	});

	it("query with AABB returns all overlapping items", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		const a = { label: "a" };
		const b = { label: "b" };
		const c = { label: "c" };
		hash.insert(a, aabb(10, 10, 5, 5));
		hash.insert(b, aabb(50, 50, 5, 5));
		hash.insert(c, aabb(200, 200, 5, 5)); // Different cell

		// Query a region overlapping a and b
		const results = hash.query(aabb(32, 32, 40, 40));
		expect(results.has(a)).toBe(true);
		expect(results.has(b)).toBe(true);
		expect(results.has(c)).toBe(false);
	});

	it("query returns empty set for empty regions", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		hash.insert({ label: "a" }, aabb(32, 32, 8, 8));

		const results = hash.query(aabb(500, 500, 1, 1));
		expect(results.size).toBe(0);
	});

	it("queryPairs returns all cell-sharing pairs (no duplicates)", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		const a = { label: "a" };
		const b = { label: "b" };
		const c = { label: "c" };
		// All in the same cell
		hash.insert(a, aabb(10, 10, 5, 5));
		hash.insert(b, aabb(20, 20, 5, 5));
		hash.insert(c, aabb(30, 30, 5, 5));

		const pairs = hash.queryPairs();
		expect(pairs.length).toBe(3); // a-b, a-c, b-c
		// Verify no duplicates
		const pairSet = new Set(pairs.map(([x, y]) => `${x.label}-${y.label}`));
		expect(pairSet.size).toBe(3);
	});

	it("items spanning multiple cells are found from any cell", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		const item = { label: "big" };
		// Spans cells (0,0) and (1,0)
		hash.insert(item, aabb(60, 32, 20, 8));

		// Query cell (0,0)
		const left = hash.query(aabb(10, 32, 1, 1));
		expect(left.has(item)).toBe(true);

		// Query cell (1,0)
		const right = hash.query(aabb(80, 32, 1, 1));
		expect(right.has(item)).toBe(true);
	});

	it("large item spanning many cells works correctly", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		const item = { label: "huge" };
		// Spans 4x4 = 16 cells
		hash.insert(item, aabb(128, 128, 128, 128));

		// Should be found anywhere in its range
		const results = hash.query(aabb(10, 10, 1, 1));
		expect(results.has(item)).toBe(true);

		const far = hash.query(aabb(240, 240, 1, 1));
		expect(far.has(item)).toBe(true);
	});

	it("handles negative coordinates", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		const item = { label: "neg" };
		hash.insert(item, aabb(-100, -100, 8, 8));

		const results = hash.query(aabb(-100, -100, 1, 1));
		expect(results.has(item)).toBe(true);
	});

	it("queryPairs with items in different cells returns no pairs", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		hash.insert({ label: "a" }, aabb(10, 10, 5, 5));
		hash.insert({ label: "b" }, aabb(200, 200, 5, 5));

		const pairs = hash.queryPairs();
		expect(pairs.length).toBe(0);
	});

	it("queryPairs deduplicates across multiple shared cells", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		const a = { label: "a" };
		const b = { label: "b" };
		// Both items span cells (0,0) and (1,0)
		hash.insert(a, aabb(60, 32, 20, 8));
		hash.insert(b, aabb(60, 32, 20, 8));

		const pairs = hash.queryPairs();
		expect(pairs.length).toBe(1); // Only one pair despite sharing 2 cells
	});

	it("clear removes all items", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		hash.insert({ label: "a" }, aabb(10, 10, 5, 5));
		hash.insert({ label: "b" }, aabb(20, 20, 5, 5));
		hash.clear();

		expect(hash.count).toBe(0);
		const results = hash.query(aabb(10, 10, 100, 100));
		expect(results.size).toBe(0);
	});

	it("update inserts if item was not previously in the hash", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		const item = { label: "new" };
		hash.update(item, aabb(32, 32, 8, 8));

		expect(hash.count).toBe(1);
		const results = hash.query(aabb(32, 32, 1, 1));
		expect(results.has(item)).toBe(true);
	});

	it("removing a non-existent item is a no-op", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		hash.remove({ label: "nonexistent" });
		expect(hash.count).toBe(0);
	});

	it("queryPairs covers reverse ID ordering when items re-enter cells", () => {
		const hash = new SpatialHash<{ label: string }>(64);
		const a = { label: "a" }; // gets id 0
		const b = { label: "b" }; // gets id 1
		// Both in cell (0,0)
		hash.insert(a, aabb(10, 10, 5, 5));
		hash.insert(b, aabb(20, 20, 5, 5));

		// Move A away (to cell (3,3)), then back
		hash.update(a, aabb(200, 200, 5, 5));
		hash.update(a, aabb(10, 10, 5, 5));

		// Now cell iteration order is [B, A] (B has id=1 first, A has id=0 second)
		// This exercises the idA > idB branch: lo=idB=0, hi=idA=1
		const pairs = hash.queryPairs();
		expect(pairs.length).toBe(1);
		// Pair should still contain both items regardless of ordering
		const pair = pairs[0] as [{ label: string }, { label: string }];
		const labels = [pair[0].label, pair[1].label].sort();
		expect(labels).toEqual(["a", "b"]);
	});

	it("1000 items insert + query performs within budget", () => {
		const hash = new SpatialHash<{ id: number }>(64);
		const items: Array<{ id: number }> = [];

		// Insert 1000 items scattered across a 1000x1000 world
		for (let i = 0; i < 1000; i++) {
			const item = { id: i };
			items.push(item);
			hash.insert(item, aabb(Math.random() * 1000, Math.random() * 1000, 8, 8));
		}

		expect(hash.count).toBe(1000);

		// Time 1000 queries
		const start = performance.now();
		for (let i = 0; i < 1000; i++) {
			hash.query(aabb(Math.random() * 1000, Math.random() * 1000, 32, 32));
		}
		const elapsed = performance.now() - start;

		// Should complete well under 100ms (typically <10ms)
		expect(elapsed).toBeLessThan(100);
	});
});
