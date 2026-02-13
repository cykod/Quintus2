// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Rect } from "./rect.js";
import { Vec2 } from "./vec2.js";

describe("Rect", () => {
	// === Construction ===
	it("constructs with x, y, width, height", () => {
		const r = new Rect(10, 20, 100, 50);
		expect(r.x).toBe(10);
		expect(r.y).toBe(20);
		expect(r.width).toBe(100);
		expect(r.height).toBe(50);
	});

	// === Computed Properties ===
	it("left, right, top, bottom", () => {
		const r = new Rect(10, 20, 100, 50);
		expect(r.left).toBe(10);
		expect(r.right).toBe(110);
		expect(r.top).toBe(20);
		expect(r.bottom).toBe(70);
	});

	it("center", () => {
		const r = new Rect(0, 0, 100, 50);
		expect(r.center.equals(new Vec2(50, 25))).toBe(true);
	});

	it("size", () => {
		const r = new Rect(0, 0, 100, 50);
		expect(r.size.equals(new Vec2(100, 50))).toBe(true);
	});

	it("corner accessors", () => {
		const r = new Rect(10, 20, 100, 50);
		expect(r.topLeft.equals(new Vec2(10, 20))).toBe(true);
		expect(r.topRight.equals(new Vec2(110, 20))).toBe(true);
		expect(r.bottomLeft.equals(new Vec2(10, 70))).toBe(true);
		expect(r.bottomRight.equals(new Vec2(110, 70))).toBe(true);
	});

	// === Contains Point ===
	it("contains point inside", () => {
		const r = new Rect(0, 0, 100, 100);
		expect(r.contains(new Vec2(50, 50))).toBe(true);
	});

	it("contains point on edge", () => {
		const r = new Rect(0, 0, 100, 100);
		expect(r.contains(new Vec2(0, 0))).toBe(true);
		expect(r.contains(new Vec2(100, 100))).toBe(true);
	});

	it("does not contain point outside", () => {
		const r = new Rect(0, 0, 100, 100);
		expect(r.contains(new Vec2(-1, 50))).toBe(false);
		expect(r.contains(new Vec2(101, 50))).toBe(false);
	});

	// === Contains Rect ===
	it("containsRect when fully inside", () => {
		const outer = new Rect(0, 0, 100, 100);
		const inner = new Rect(10, 10, 20, 20);
		expect(outer.containsRect(inner)).toBe(true);
	});

	it("containsRect when partially outside", () => {
		const outer = new Rect(0, 0, 100, 100);
		const partial = new Rect(90, 90, 20, 20);
		expect(outer.containsRect(partial)).toBe(false);
	});

	// === Intersects ===
	it("intersects overlapping rects", () => {
		const a = new Rect(0, 0, 100, 100);
		const b = new Rect(50, 50, 100, 100);
		expect(a.intersects(b)).toBe(true);
	});

	it("does not intersect disjoint rects", () => {
		const a = new Rect(0, 0, 100, 100);
		const b = new Rect(200, 200, 100, 100);
		expect(a.intersects(b)).toBe(false);
	});

	it("touching rects do not intersect (exclusive edges)", () => {
		const a = new Rect(0, 0, 100, 100);
		const b = new Rect(100, 0, 100, 100);
		expect(a.intersects(b)).toBe(false);
	});

	// === Intersection ===
	it("intersection returns overlap area", () => {
		const a = new Rect(0, 0, 100, 100);
		const b = new Rect(50, 50, 100, 100);
		const inter = a.intersection(b);
		expect(inter).not.toBeNull();
		expect(inter?.x).toBe(50);
		expect(inter?.y).toBe(50);
		expect(inter?.width).toBe(50);
		expect(inter?.height).toBe(50);
	});

	it("intersection returns null for disjoint", () => {
		const a = new Rect(0, 0, 10, 10);
		const b = new Rect(20, 20, 10, 10);
		expect(a.intersection(b)).toBeNull();
	});

	// === Union ===
	it("union of two rects", () => {
		const a = new Rect(0, 0, 50, 50);
		const b = new Rect(30, 30, 50, 50);
		const u = a.union(b);
		expect(u.x).toBe(0);
		expect(u.y).toBe(0);
		expect(u.width).toBe(80);
		expect(u.height).toBe(80);
	});

	// === Expand ===
	it("expand grows on all sides", () => {
		const r = new Rect(10, 10, 20, 20).expand(5);
		expect(r.x).toBe(5);
		expect(r.y).toBe(5);
		expect(r.width).toBe(30);
		expect(r.height).toBe(30);
	});

	it("expandToInclude", () => {
		const r = new Rect(10, 10, 20, 20).expandToInclude(new Vec2(0, 0));
		expect(r.x).toBe(0);
		expect(r.y).toBe(0);
		expect(r.right).toBe(30);
		expect(r.bottom).toBe(30);
	});

	// === Utility ===
	it("equals", () => {
		expect(new Rect(1, 2, 3, 4).equals(new Rect(1, 2, 3, 4))).toBe(true);
		expect(new Rect(1, 2, 3, 4).equals(new Rect(1, 2, 3, 5))).toBe(false);
	});

	it("clone", () => {
		const r = new Rect(1, 2, 3, 4);
		const c = r.clone();
		expect(c.equals(r)).toBe(true);
		expect(c).not.toBe(r);
	});

	it("toString", () => {
		expect(new Rect(1, 2, 3, 4).toString()).toBe("Rect(1, 2, 3, 4)");
	});

	// === Static Factories ===
	it("fromCenter", () => {
		const r = Rect.fromCenter(new Vec2(50, 50), new Vec2(20, 20));
		expect(r.x).toBe(40);
		expect(r.y).toBe(40);
		expect(r.width).toBe(20);
		expect(r.height).toBe(20);
	});

	it("fromPoints", () => {
		const r = Rect.fromPoints(new Vec2(10, 5), new Vec2(3, 15));
		expect(r.x).toBe(3);
		expect(r.y).toBe(5);
		expect(r.width).toBe(7);
		expect(r.height).toBe(10);
	});

	it("fromMinMax", () => {
		const r = Rect.fromMinMax(new Vec2(5, 10), new Vec2(15, 30));
		expect(r.x).toBe(5);
		expect(r.y).toBe(10);
		expect(r.width).toBe(10);
		expect(r.height).toBe(20);
	});
});
