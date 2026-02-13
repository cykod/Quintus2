// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Matrix2D } from "./matrix2d.js";
import { Vec2 } from "./vec2.js";

describe("Matrix2D", () => {
	// === Identity ===
	it("IDENTITY transforms points unchanged", () => {
		const p = new Vec2(5, 10);
		const result = Matrix2D.IDENTITY.transformPoint(p);
		expect(result.equals(p)).toBe(true);
	});

	it("IDENTITY has correct values", () => {
		const m = Matrix2D.IDENTITY;
		expect(m.a).toBe(1);
		expect(m.b).toBe(0);
		expect(m.c).toBe(0);
		expect(m.d).toBe(1);
		expect(m.e).toBe(0);
		expect(m.f).toBe(0);
	});

	// === Translate ===
	it("translate offsets points", () => {
		const m = Matrix2D.translate(10, 20);
		const p = m.transformPoint(new Vec2(1, 2));
		expect(p.x).toBe(11);
		expect(p.y).toBe(22);
	});

	// === Rotate ===
	it("rotate 90 degrees", () => {
		const m = Matrix2D.rotate(Math.PI / 2);
		const p = m.transformPoint(new Vec2(1, 0));
		expect(p.x).toBeCloseTo(0);
		expect(p.y).toBeCloseTo(1);
	});

	it("rotate 180 degrees", () => {
		const m = Matrix2D.rotate(Math.PI);
		const p = m.transformPoint(new Vec2(1, 0));
		expect(p.x).toBeCloseTo(-1);
		expect(p.y).toBeCloseTo(0);
	});

	it("rotate 270 degrees", () => {
		const m = Matrix2D.rotate((3 * Math.PI) / 2);
		const p = m.transformPoint(new Vec2(1, 0));
		expect(p.x).toBeCloseTo(0);
		expect(p.y).toBeCloseTo(-1);
	});

	// === Scale ===
	it("uniform scale", () => {
		const m = Matrix2D.scale(2, 2);
		const p = m.transformPoint(new Vec2(3, 4));
		expect(p.x).toBe(6);
		expect(p.y).toBe(8);
	});

	it("non-uniform scale", () => {
		const m = Matrix2D.scale(2, 3);
		const p = m.transformPoint(new Vec2(4, 5));
		expect(p.x).toBe(8);
		expect(p.y).toBe(15);
	});

	// === Compose ===
	it("compose matches sequential T*R*S", () => {
		const pos = new Vec2(10, 20);
		const rot = Math.PI / 4;
		const scl = new Vec2(2, 3);

		const composed = Matrix2D.compose(pos, rot, scl);
		const sequential = Matrix2D.translate(pos.x, pos.y)
			.multiply(Matrix2D.rotate(rot))
			.multiply(Matrix2D.scale(scl.x, scl.y));

		expect(composed.approxEquals(sequential)).toBe(true);
	});

	it("compose with no rotation or scale is just translation", () => {
		const m = Matrix2D.compose(new Vec2(5, 10), 0, Vec2.ONE);
		const p = m.transformPoint(Vec2.ZERO);
		expect(p.x).toBeCloseTo(5);
		expect(p.y).toBeCloseTo(10);
	});

	// === Multiply ===
	it("multiply two matrices", () => {
		const a = Matrix2D.translate(10, 0);
		const b = Matrix2D.scale(2, 2);
		const ab = a.multiply(b);
		// Apply scale first, then translate
		const p = ab.transformPoint(new Vec2(5, 0));
		expect(p.x).toBe(20); // 5*2 + 10
		expect(p.y).toBe(0);
	});

	it("premultiply", () => {
		const a = Matrix2D.translate(10, 0);
		const b = Matrix2D.scale(2, 2);
		// a.premultiply(b) === b.multiply(a)
		const result = a.premultiply(b);
		const expected = b.multiply(a);
		expect(result.equals(expected)).toBe(true);
	});

	// === Transform Point vs Vector ===
	it("transformVector ignores translation", () => {
		const m = Matrix2D.compose(new Vec2(100, 200), 0, new Vec2(2, 2));
		const v = m.transformVector(new Vec2(1, 0));
		expect(v.x).toBeCloseTo(2);
		expect(v.y).toBeCloseTo(0);
	});

	// === Inverse ===
	it("M * M.inverse() equals identity", () => {
		const m = Matrix2D.compose(new Vec2(10, 20), Math.PI / 6, new Vec2(2, 3));
		const mInv = m.inverse();
		const identity = m.multiply(mInv);
		expect(identity.approxEquals(Matrix2D.IDENTITY)).toBe(true);
	});

	it("inverseTransformPoint round-trips", () => {
		const m = Matrix2D.compose(new Vec2(10, 20), Math.PI / 3, new Vec2(2, 0.5));
		const original = new Vec2(7, 13);
		const transformed = m.transformPoint(original);
		const recovered = m.inverseTransformPoint(transformed);
		expect(recovered.approxEquals(original)).toBe(true);
	});

	// === Decompose ===
	it("decompose round-trips through compose", () => {
		const pos = new Vec2(10, 20);
		const rot = Math.PI / 6;
		const scl = new Vec2(2, 3);
		const m = Matrix2D.compose(pos, rot, scl);
		const d = m.decompose();
		expect(d.position.approxEquals(pos)).toBe(true);
		expect(d.rotation).toBeCloseTo(rot);
		expect(d.scale.approxEquals(scl)).toBe(true);
	});

	it("getTranslation", () => {
		const m = Matrix2D.compose(new Vec2(5, 10), 0, Vec2.ONE);
		expect(m.getTranslation().equals(new Vec2(5, 10))).toBe(true);
	});

	it("getRotation", () => {
		const m = Matrix2D.compose(Vec2.ZERO, Math.PI / 4, Vec2.ONE);
		expect(m.getRotation()).toBeCloseTo(Math.PI / 4);
	});

	it("getScale", () => {
		const m = Matrix2D.compose(Vec2.ZERO, 0, new Vec2(3, 4));
		const s = m.getScale();
		expect(s.x).toBeCloseTo(3);
		expect(s.y).toBeCloseTo(4);
	});

	// === Determinant ===
	it("identity determinant is 1", () => {
		expect(Matrix2D.IDENTITY.determinant()).toBe(1);
	});

	it("scale determinant is sx * sy", () => {
		expect(Matrix2D.scale(2, 3).determinant()).toBeCloseTo(6);
	});

	// === Comparison ===
	it("equals", () => {
		const a = new Matrix2D(1, 2, 3, 4, 5, 6);
		const b = new Matrix2D(1, 2, 3, 4, 5, 6);
		expect(a.equals(b)).toBe(true);
	});

	it("approxEquals", () => {
		const a = new Matrix2D(1, 0, 0, 1, 0, 0);
		const b = new Matrix2D(1.0000001, 0, 0, 1.0000001, 0, 0);
		expect(a.approxEquals(b)).toBe(true);
	});

	// === Utility ===
	it("toArray returns 6 values", () => {
		const m = new Matrix2D(1, 2, 3, 4, 5, 6);
		expect(m.toArray()).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it("toString", () => {
		const m = new Matrix2D(1, 2, 3, 4, 5, 6);
		expect(m.toString()).toBe("Matrix2D(1, 2, 3, 4, 5, 6)");
	});

	// === Canvas2D compatibility ===
	it("values map to setTransform(a, b, c, d, e, f)", () => {
		const m = Matrix2D.compose(new Vec2(100, 200), Math.PI / 2, new Vec2(2, 2));
		const [a, b, _c, _d, e, f] = m.toArray();
		// a=cos*sx, b=sin*sx, c=-sin*sy, d=cos*sy, e=tx, f=ty
		expect(e).toBe(100);
		expect(f).toBe(200);
		expect(a).toBeCloseTo(0); // cos(90)*2
		expect(b).toBeCloseTo(2); // sin(90)*2
	});
});
