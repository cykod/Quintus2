// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Vec2 } from "./vec2.js";

describe("Vec2", () => {
	// === Construction ===
	it("constructs with x and y", () => {
		const v = new Vec2(3, 4);
		expect(v.x).toBe(3);
		expect(v.y).toBe(4);
	});

	// === Static Constants ===
	it("ZERO is (0, 0)", () => {
		expect(Vec2.ZERO.x).toBe(0);
		expect(Vec2.ZERO.y).toBe(0);
	});

	it("ONE is (1, 1)", () => {
		expect(Vec2.ONE.x).toBe(1);
		expect(Vec2.ONE.y).toBe(1);
	});

	it("UP is (0, -1) (screen-space)", () => {
		expect(Vec2.UP.x).toBe(0);
		expect(Vec2.UP.y).toBe(-1);
	});

	it("DOWN is (0, 1)", () => {
		expect(Vec2.DOWN.equals(new Vec2(0, 1))).toBe(true);
	});

	it("LEFT is (-1, 0)", () => {
		expect(Vec2.LEFT.equals(new Vec2(-1, 0))).toBe(true);
	});

	it("RIGHT is (1, 0)", () => {
		expect(Vec2.RIGHT.equals(new Vec2(1, 0))).toBe(true);
	});

	// === Arithmetic ===
	it("add", () => {
		const result = new Vec2(1, 2).add(new Vec2(3, 4));
		expect(result.x).toBe(4);
		expect(result.y).toBe(6);
	});

	it("sub", () => {
		const result = new Vec2(5, 7).sub(new Vec2(2, 3));
		expect(result.x).toBe(3);
		expect(result.y).toBe(4);
	});

	it("mul (component-wise)", () => {
		const result = new Vec2(2, 3).mul(new Vec2(4, 5));
		expect(result.x).toBe(8);
		expect(result.y).toBe(15);
	});

	it("div (component-wise)", () => {
		const result = new Vec2(10, 20).div(new Vec2(2, 5));
		expect(result.x).toBe(5);
		expect(result.y).toBe(4);
	});

	it("scale", () => {
		const result = new Vec2(3, 4).scale(2);
		expect(result.x).toBe(6);
		expect(result.y).toBe(8);
	});

	it("negate", () => {
		const result = new Vec2(3, -4).negate();
		expect(result.x).toBe(-3);
		expect(result.y).toBe(4);
	});

	// === Geometry ===
	it("dot", () => {
		expect(new Vec2(1, 2).dot(new Vec2(3, 4))).toBe(11);
	});

	it("cross", () => {
		expect(new Vec2(1, 0).cross(new Vec2(0, 1))).toBe(1);
		expect(new Vec2(0, 1).cross(new Vec2(1, 0))).toBe(-1);
	});

	it("length", () => {
		expect(new Vec2(3, 4).length()).toBe(5);
	});

	it("lengthSquared", () => {
		expect(new Vec2(3, 4).lengthSquared()).toBe(25);
	});

	it("normalize produces unit vector", () => {
		const n = new Vec2(3, 4).normalize();
		expect(n.x).toBeCloseTo(0.6);
		expect(n.y).toBeCloseTo(0.8);
		expect(n.length()).toBeCloseTo(1);
	});

	it("normalize zero vector returns ZERO", () => {
		const n = Vec2.ZERO.normalize();
		expect(n.x).toBe(0);
		expect(n.y).toBe(0);
	});

	it("withLength", () => {
		const v = new Vec2(3, 4).withLength(10);
		expect(v.length()).toBeCloseTo(10);
	});

	it("withLength on zero vector returns ZERO", () => {
		expect(Vec2.ZERO.withLength(5).equals(Vec2.ZERO)).toBe(true);
	});

	// === Distance ===
	it("distanceTo", () => {
		expect(new Vec2(0, 0).distanceTo(new Vec2(3, 4))).toBe(5);
	});

	it("distanceSquaredTo", () => {
		expect(new Vec2(0, 0).distanceSquaredTo(new Vec2(3, 4))).toBe(25);
	});

	// === Rotation ===
	it("angle from positive x-axis", () => {
		expect(new Vec2(1, 0).angle()).toBeCloseTo(0);
		expect(new Vec2(0, 1).angle()).toBeCloseTo(Math.PI / 2);
		expect(new Vec2(-1, 0).angle()).toBeCloseTo(Math.PI);
	});

	it("angleTo", () => {
		const a = new Vec2(1, 0);
		const b = new Vec2(0, 1);
		expect(a.angleTo(b)).toBeCloseTo(Math.PI / 2);
	});

	it("rotate 90 degrees", () => {
		const v = new Vec2(1, 0).rotate(Math.PI / 2);
		expect(v.x).toBeCloseTo(0);
		expect(v.y).toBeCloseTo(1);
	});

	it("rotate 180 degrees", () => {
		const v = new Vec2(1, 0).rotate(Math.PI);
		expect(v.x).toBeCloseTo(-1);
		expect(v.y).toBeCloseTo(0);
	});

	it("rotate arbitrary angle", () => {
		const v = new Vec2(1, 0).rotate(Math.PI / 4);
		expect(v.x).toBeCloseTo(Math.SQRT2 / 2);
		expect(v.y).toBeCloseTo(Math.SQRT2 / 2);
	});

	// === Interpolation ===
	it("lerp at t=0 returns this", () => {
		const a = new Vec2(0, 0);
		const b = new Vec2(10, 20);
		const result = a.lerp(b, 0);
		expect(result.x).toBe(0);
		expect(result.y).toBe(0);
	});

	it("lerp at t=1 returns target", () => {
		const a = new Vec2(0, 0);
		const b = new Vec2(10, 20);
		const result = a.lerp(b, 1);
		expect(result.x).toBe(10);
		expect(result.y).toBe(20);
	});

	it("lerp at t=0.5 returns midpoint", () => {
		const a = new Vec2(0, 0);
		const b = new Vec2(10, 20);
		const result = a.lerp(b, 0.5);
		expect(result.x).toBe(5);
		expect(result.y).toBe(10);
	});

	it("moveToward reaches target", () => {
		const a = new Vec2(0, 0);
		const b = new Vec2(3, 4);
		const result = a.moveToward(b, 10);
		expect(result.equals(b)).toBe(true);
	});

	it("moveToward moves partial distance", () => {
		const a = new Vec2(0, 0);
		const b = new Vec2(10, 0);
		const result = a.moveToward(b, 3);
		expect(result.x).toBeCloseTo(3);
		expect(result.y).toBeCloseTo(0);
	});

	// === Comparison ===
	it("equals", () => {
		expect(new Vec2(1, 2).equals(new Vec2(1, 2))).toBe(true);
		expect(new Vec2(1, 2).equals(new Vec2(1, 3))).toBe(false);
	});

	it("approxEquals", () => {
		expect(new Vec2(1, 2).approxEquals(new Vec2(1.0000001, 2.0000001))).toBe(true);
		expect(new Vec2(1, 2).approxEquals(new Vec2(1.1, 2))).toBe(false);
	});

	it("approxEquals with custom epsilon", () => {
		expect(new Vec2(1, 2).approxEquals(new Vec2(1.05, 2.05), 0.1)).toBe(true);
	});

	// === Utility ===
	it("abs", () => {
		const v = new Vec2(-3, -4).abs();
		expect(v.x).toBe(3);
		expect(v.y).toBe(4);
	});

	it("floor", () => {
		const v = new Vec2(1.7, 2.3).floor();
		expect(v.x).toBe(1);
		expect(v.y).toBe(2);
	});

	it("ceil", () => {
		const v = new Vec2(1.1, 2.9).ceil();
		expect(v.x).toBe(2);
		expect(v.y).toBe(3);
	});

	it("round", () => {
		const v = new Vec2(1.4, 2.6).round();
		expect(v.x).toBe(1);
		expect(v.y).toBe(3);
	});

	it("clamp", () => {
		const v = new Vec2(5, -3).clamp(new Vec2(0, 0), new Vec2(3, 3));
		expect(v.x).toBe(3);
		expect(v.y).toBe(0);
	});

	it("clone returns equal but different instance", () => {
		const v = new Vec2(1, 2);
		const c = v.clone();
		expect(c.equals(v)).toBe(true);
		expect(c).not.toBe(v);
	});

	it("toString", () => {
		expect(new Vec2(1, 2).toString()).toBe("Vec2(1, 2)");
	});

	it("toArray", () => {
		expect(new Vec2(1, 2).toArray()).toEqual([1, 2]);
	});

	// === Mutability ===
	it("x and y are mutable", () => {
		const v = new Vec2(1, 2);
		v.x = 10;
		v.y = 20;
		expect(v.x).toBe(10);
		expect(v.y).toBe(20);
	});

	it("operations return new instances (original unchanged)", () => {
		const a = new Vec2(1, 2);
		const b = new Vec2(3, 4);
		const result = a.add(b);
		expect(result).not.toBe(a);
		expect(result).not.toBe(b);
		expect(a.x).toBe(1);
		expect(a.y).toBe(2);
	});

	// === Frozen Constants ===
	it("static constants are frozen (throw on mutation)", () => {
		expect(() => {
			(Vec2.ZERO as Vec2).x = 1;
		}).toThrow();
		expect(() => {
			(Vec2.ONE as Vec2).y = 2;
		}).toThrow();
		expect(() => {
			(Vec2.UP as Vec2).x = 1;
		}).toThrow();
		expect(() => {
			(Vec2.DOWN as Vec2).y = 2;
		}).toThrow();
		expect(() => {
			(Vec2.LEFT as Vec2).x = 1;
		}).toThrow();
		expect(() => {
			(Vec2.RIGHT as Vec2).y = 2;
		}).toThrow();
	});

	// === Static Factories ===
	it("from", () => {
		const v = Vec2.from({ x: 5, y: 6 });
		expect(v.x).toBe(5);
		expect(v.y).toBe(6);
	});

	it("fromAngle produces unit vectors", () => {
		const v = Vec2.fromAngle(0);
		expect(v.x).toBeCloseTo(1);
		expect(v.y).toBeCloseTo(0);

		const v2 = Vec2.fromAngle(Math.PI / 2);
		expect(v2.x).toBeCloseTo(0);
		expect(v2.y).toBeCloseTo(1);
	});
});
