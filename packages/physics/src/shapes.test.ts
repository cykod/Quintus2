import { Matrix2D, Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { Shape, shapeAABB } from "./shapes.js";

describe("Shape factory", () => {
	describe("rect", () => {
		it("returns correct type and dimensions", () => {
			const s = Shape.rect(16, 24);
			expect(s.type).toBe("rect");
			expect(s.width).toBe(16);
			expect(s.height).toBe(24);
		});
	});

	describe("circle", () => {
		it("returns correct type and radius", () => {
			const s = Shape.circle(10);
			expect(s.type).toBe("circle");
			expect(s.radius).toBe(10);
		});
	});

	describe("capsule", () => {
		it("returns correct type, radius, and height", () => {
			const s = Shape.capsule(8, 32);
			expect(s.type).toBe("capsule");
			expect(s.radius).toBe(8);
			expect(s.height).toBe(32);
		});
	});

	describe("polygon", () => {
		it("creates a valid convex polygon", () => {
			const s = Shape.polygon([new Vec2(0, 0), new Vec2(10, 0), new Vec2(10, 10), new Vec2(0, 10)]);
			expect(s.type).toBe("polygon");
			expect(s.points).toHaveLength(4);
		});

		it("freezes the points array", () => {
			const s = Shape.polygon([new Vec2(0, 0), new Vec2(10, 0), new Vec2(10, 10)]);
			expect(Object.isFrozen(s.points)).toBe(true);
		});

		it("throws on fewer than 3 vertices", () => {
			expect(() => Shape.polygon([new Vec2(0, 0), new Vec2(1, 0)])).toThrow("at least 3 vertices");
		});

		it("throws on concave polygon", () => {
			// L-shaped (concave)
			expect(() =>
				Shape.polygon([
					new Vec2(0, 0),
					new Vec2(10, 0),
					new Vec2(10, 5),
					new Vec2(5, 5),
					new Vec2(5, 10),
					new Vec2(0, 10),
				]),
			).toThrow("convex");
		});

		it("accepts a triangle", () => {
			const s = Shape.polygon([new Vec2(0, 0), new Vec2(10, 0), new Vec2(5, 10)]);
			expect(s.points).toHaveLength(3);
		});
	});
});

describe("shapeAABB", () => {
	describe("translation-only (fast path)", () => {
		const t = Matrix2D.translate(100, 200);

		it("rect at position", () => {
			const aabb = shapeAABB(Shape.rect(20, 10), t);
			expect(aabb.min.x).toBeCloseTo(90);
			expect(aabb.min.y).toBeCloseTo(195);
			expect(aabb.max.x).toBeCloseTo(110);
			expect(aabb.max.y).toBeCloseTo(205);
		});

		it("circle at position", () => {
			const aabb = shapeAABB(Shape.circle(15), t);
			expect(aabb.min.x).toBeCloseTo(85);
			expect(aabb.min.y).toBeCloseTo(185);
			expect(aabb.max.x).toBeCloseTo(115);
			expect(aabb.max.y).toBeCloseTo(215);
		});

		it("capsule at position", () => {
			const aabb = shapeAABB(Shape.capsule(8, 32), t);
			// width = radius*2 = 16, height = 32
			expect(aabb.min.x).toBeCloseTo(92);
			expect(aabb.min.y).toBeCloseTo(184);
			expect(aabb.max.x).toBeCloseTo(108);
			expect(aabb.max.y).toBeCloseTo(216);
		});

		it("polygon at position", () => {
			const poly = Shape.polygon([
				new Vec2(-5, -5),
				new Vec2(5, -5),
				new Vec2(5, 5),
				new Vec2(-5, 5),
			]);
			const aabb = shapeAABB(poly, t);
			expect(aabb.min.x).toBeCloseTo(95);
			expect(aabb.min.y).toBeCloseTo(195);
			expect(aabb.max.x).toBeCloseTo(105);
			expect(aabb.max.y).toBeCloseTo(205);
		});
	});

	describe("identity transform", () => {
		const t = Matrix2D.IDENTITY;

		it("rect centered at origin", () => {
			const aabb = shapeAABB(Shape.rect(20, 10), t);
			expect(aabb.min.x).toBeCloseTo(-10);
			expect(aabb.min.y).toBeCloseTo(-5);
			expect(aabb.max.x).toBeCloseTo(10);
			expect(aabb.max.y).toBeCloseTo(5);
		});
	});

	describe("rotated transform", () => {
		// 90 degree rotation
		const t = Matrix2D.rotate(Math.PI / 2);

		it("rect rotated 90 degrees", () => {
			const aabb = shapeAABB(Shape.rect(20, 10), t);
			// 20x10 rotated 90° becomes effectively 10x20
			expect(aabb.min.x).toBeCloseTo(-5);
			expect(aabb.min.y).toBeCloseTo(-10);
			expect(aabb.max.x).toBeCloseTo(5);
			expect(aabb.max.y).toBeCloseTo(10);
		});

		it("circle rotated (unchanged)", () => {
			const aabb = shapeAABB(Shape.circle(10), t);
			expect(aabb.min.x).toBeCloseTo(-10);
			expect(aabb.min.y).toBeCloseTo(-10);
			expect(aabb.max.x).toBeCloseTo(10);
			expect(aabb.max.y).toBeCloseTo(10);
		});

		it("polygon rotated 90 degrees", () => {
			const poly = Shape.polygon([
				new Vec2(-10, -5),
				new Vec2(10, -5),
				new Vec2(10, 5),
				new Vec2(-10, 5),
			]);
			const aabb = shapeAABB(poly, t);
			// 20x10 polygon rotated 90° → 10x20 AABB
			expect(aabb.min.x).toBeCloseTo(-5);
			expect(aabb.min.y).toBeCloseTo(-10);
			expect(aabb.max.x).toBeCloseTo(5);
			expect(aabb.max.y).toBeCloseTo(10);
		});
	});

	describe("scaled transform", () => {
		const t = Matrix2D.scale(2, 3);

		it("rect scaled", () => {
			const aabb = shapeAABB(Shape.rect(10, 10), t);
			// 10x10 scaled by (2,3) → effective 20x30 centered
			expect(aabb.min.x).toBeCloseTo(-10);
			expect(aabb.min.y).toBeCloseTo(-15);
			expect(aabb.max.x).toBeCloseTo(10);
			expect(aabb.max.y).toBeCloseTo(15);
		});

		it("circle scaled uses max scale", () => {
			const aabb = shapeAABB(Shape.circle(5), t);
			// sx=2, sy=3, effective radius = max(2,3) * 5 = 15
			expect(aabb.min.x).toBeCloseTo(-15);
			expect(aabb.min.y).toBeCloseTo(-15);
			expect(aabb.max.x).toBeCloseTo(15);
			expect(aabb.max.y).toBeCloseTo(15);
		});
	});

	describe("composed transform (translate + rotate)", () => {
		it("rect with rotation and translation", () => {
			// 45 degree rotation at (50, 50)
			const t = Matrix2D.compose(new Vec2(50, 50), Math.PI / 4, new Vec2(1, 1));
			const aabb = shapeAABB(Shape.rect(10, 10), t);
			// 10x10 rect rotated 45° → diagonal ≈ 14.14
			const halfDiag = (10 * Math.SQRT2) / 2;
			expect(aabb.min.x).toBeCloseTo(50 - halfDiag);
			expect(aabb.min.y).toBeCloseTo(50 - halfDiag);
			expect(aabb.max.x).toBeCloseTo(50 + halfDiag);
			expect(aabb.max.y).toBeCloseTo(50 + halfDiag);
		});
	});

	describe("capsule with rotation", () => {
		it("capsule rotated 90 degrees at origin", () => {
			const t = Matrix2D.rotate(Math.PI / 2);
			const aabb = shapeAABB(Shape.capsule(5, 20), t);
			// Capsule: radius=5, height=20, halfSeg = 10 - 5 = 5
			// After 90° rotation, the vertical capsule becomes horizontal
			// The AABB should encompass the rotated capsule
			expect(aabb.width).toBeGreaterThan(0);
			expect(aabb.height).toBeGreaterThan(0);
			// Rotated 90°, should be wider than tall
			expect(aabb.width).toBeGreaterThan(aabb.height);
		});
	});
});
