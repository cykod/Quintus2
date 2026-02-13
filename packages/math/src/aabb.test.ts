// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AABB } from "./aabb.js";
import { Rect } from "./rect.js";
import { Vec2 } from "./vec2.js";

describe("AABB", () => {
	it("constructs with min/max", () => {
		const aabb = new AABB(new Vec2(0, 0), new Vec2(10, 10));
		expect(aabb.min.equals(Vec2.ZERO)).toBe(true);
		expect(aabb.max.equals(new Vec2(10, 10))).toBe(true);
	});

	it("center", () => {
		const aabb = new AABB(new Vec2(0, 0), new Vec2(10, 20));
		expect(aabb.center.equals(new Vec2(5, 10))).toBe(true);
	});

	it("size", () => {
		const aabb = new AABB(new Vec2(5, 10), new Vec2(15, 30));
		expect(aabb.size.equals(new Vec2(10, 20))).toBe(true);
	});

	it("width and height", () => {
		const aabb = new AABB(new Vec2(0, 0), new Vec2(8, 12));
		expect(aabb.width).toBe(8);
		expect(aabb.height).toBe(12);
	});

	it("contains point inside", () => {
		const aabb = new AABB(new Vec2(0, 0), new Vec2(10, 10));
		expect(aabb.contains(new Vec2(5, 5))).toBe(true);
	});

	it("contains point on edge", () => {
		const aabb = new AABB(new Vec2(0, 0), new Vec2(10, 10));
		expect(aabb.contains(new Vec2(0, 0))).toBe(true);
		expect(aabb.contains(new Vec2(10, 10))).toBe(true);
	});

	it("does not contain point outside", () => {
		const aabb = new AABB(new Vec2(0, 0), new Vec2(10, 10));
		expect(aabb.contains(new Vec2(-1, 5))).toBe(false);
		expect(aabb.contains(new Vec2(11, 5))).toBe(false);
	});

	it("overlaps overlapping AABBs", () => {
		const a = new AABB(new Vec2(0, 0), new Vec2(10, 10));
		const b = new AABB(new Vec2(5, 5), new Vec2(15, 15));
		expect(a.overlaps(b)).toBe(true);
	});

	it("does not overlap disjoint AABBs", () => {
		const a = new AABB(new Vec2(0, 0), new Vec2(10, 10));
		const b = new AABB(new Vec2(20, 20), new Vec2(30, 30));
		expect(a.overlaps(b)).toBe(false);
	});

	it("containsAABB", () => {
		const outer = new AABB(new Vec2(0, 0), new Vec2(100, 100));
		const inner = new AABB(new Vec2(10, 10), new Vec2(50, 50));
		expect(outer.containsAABB(inner)).toBe(true);
		expect(inner.containsAABB(outer)).toBe(false);
	});

	it("merge", () => {
		const a = new AABB(new Vec2(0, 0), new Vec2(10, 10));
		const b = new AABB(new Vec2(5, 5), new Vec2(20, 20));
		const merged = a.merge(b);
		expect(merged.min.equals(new Vec2(0, 0))).toBe(true);
		expect(merged.max.equals(new Vec2(20, 20))).toBe(true);
	});

	it("expand", () => {
		const aabb = new AABB(new Vec2(5, 5), new Vec2(10, 10)).expand(2);
		expect(aabb.min.equals(new Vec2(3, 3))).toBe(true);
		expect(aabb.max.equals(new Vec2(12, 12))).toBe(true);
	});

	it("toRect", () => {
		const aabb = new AABB(new Vec2(5, 10), new Vec2(15, 30));
		const rect = aabb.toRect();
		expect(rect.equals(new Rect(5, 10, 10, 20))).toBe(true);
	});

	it("fromRect", () => {
		const rect = new Rect(5, 10, 10, 20);
		const aabb = AABB.fromRect(rect);
		expect(aabb.min.equals(new Vec2(5, 10))).toBe(true);
		expect(aabb.max.equals(new Vec2(15, 30))).toBe(true);
	});

	it("fromPoints", () => {
		const aabb = AABB.fromPoints([
			new Vec2(5, 3),
			new Vec2(1, 8),
			new Vec2(10, 2),
			new Vec2(4, 12),
		]);
		expect(aabb.min.equals(new Vec2(1, 2))).toBe(true);
		expect(aabb.max.equals(new Vec2(10, 12))).toBe(true);
	});

	it("fromPoints empty array", () => {
		const aabb = AABB.fromPoints([]);
		expect(aabb.min.equals(Vec2.ZERO)).toBe(true);
		expect(aabb.max.equals(Vec2.ZERO)).toBe(true);
	});

	it("fromCenterSize", () => {
		const aabb = AABB.fromCenterSize(new Vec2(10, 10), new Vec2(6, 8));
		expect(aabb.min.equals(new Vec2(7, 6))).toBe(true);
		expect(aabb.max.equals(new Vec2(13, 14))).toBe(true);
	});
});
