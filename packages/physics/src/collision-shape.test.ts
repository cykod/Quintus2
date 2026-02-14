import { describe, expect, it } from "vitest";
import { AABB, Matrix2D, Vec2 } from "@quintus/math";
import { Node2D } from "@quintus/core";
import { CollisionShape } from "./collision-shape.js";
import { Shape } from "./shapes.js";

/** Helper: create a standalone CollisionShape (not in a tree, uses identity global transform). */
function createShape(shape: ReturnType<typeof Shape.rect>, position?: Vec2): CollisionShape {
	const cs = new CollisionShape();
	cs.shape = shape;
	if (position) {
		cs.position = position;
	}
	return cs;
}

describe("CollisionShape", () => {
	describe("getWorldAABB", () => {
		it("returns correct AABB for rect shape at origin", () => {
			const cs = createShape(Shape.rect(20, 10));
			const aabb = cs.getWorldAABB();
			expect(aabb).not.toBeNull();
			expect(aabb!.min.x).toBeCloseTo(-10);
			expect(aabb!.min.y).toBeCloseTo(-5);
			expect(aabb!.max.x).toBeCloseTo(10);
			expect(aabb!.max.y).toBeCloseTo(5);
		});

		it("returns correct AABB with position offset", () => {
			const cs = createShape(Shape.rect(20, 10), new Vec2(100, 50));
			const aabb = cs.getWorldAABB();
			expect(aabb).not.toBeNull();
			expect(aabb!.min.x).toBeCloseTo(90);
			expect(aabb!.min.y).toBeCloseTo(45);
			expect(aabb!.max.x).toBeCloseTo(110);
			expect(aabb!.max.y).toBeCloseTo(55);
		});

		it("returns null when disabled", () => {
			const cs = createShape(Shape.rect(20, 10));
			cs.disabled = true;
			expect(cs.getWorldAABB()).toBeNull();
		});

		it("returns null when shape is null", () => {
			const cs = new CollisionShape();
			expect(cs.getWorldAABB()).toBeNull();
		});

		it("returns correct AABB for circle shape", () => {
			const cs = createShape(Shape.circle(15));
			const aabb = cs.getWorldAABB();
			expect(aabb).not.toBeNull();
			expect(aabb!.min.x).toBeCloseTo(-15);
			expect(aabb!.min.y).toBeCloseTo(-15);
			expect(aabb!.max.x).toBeCloseTo(15);
			expect(aabb!.max.y).toBeCloseTo(15);
		});
	});

	describe("getWorldTransform", () => {
		it("returns globalTransform (identity when standalone)", () => {
			const cs = createShape(Shape.rect(10, 10));
			const tx = cs.getWorldTransform();
			expect(tx.e).toBeCloseTo(0);
			expect(tx.f).toBeCloseTo(0);
		});

		it("includes position offset", () => {
			const cs = createShape(Shape.rect(10, 10), new Vec2(50, 30));
			const tx = cs.getWorldTransform();
			expect(tx.e).toBeCloseTo(50);
			expect(tx.f).toBeCloseTo(30);
		});
	});

	describe("disabled", () => {
		it("defaults to false", () => {
			const cs = new CollisionShape();
			expect(cs.disabled).toBe(false);
		});

		it("can be toggled", () => {
			const cs = createShape(Shape.rect(10, 10));
			cs.disabled = true;
			expect(cs.getWorldAABB()).toBeNull();
			cs.disabled = false;
			expect(cs.getWorldAABB()).not.toBeNull();
		});
	});

	describe("parent transform cascade", () => {
		it("inherits parent Node2D transform", () => {
			const parent = new Node2D();
			parent.position = new Vec2(100, 200);
			const cs = parent.addChild(CollisionShape);
			cs.shape = Shape.rect(20, 10);
			cs.position = new Vec2(10, 0);

			const aabb = cs.getWorldAABB();
			expect(aabb).not.toBeNull();
			// Parent at (100, 200) + child at (10, 0) = global (110, 200)
			// Rect 20x10: AABB = (100, 195) to (120, 205)
			expect(aabb!.min.x).toBeCloseTo(100);
			expect(aabb!.min.y).toBeCloseTo(195);
			expect(aabb!.max.x).toBeCloseTo(120);
			expect(aabb!.max.y).toBeCloseTo(205);
		});
	});
});
