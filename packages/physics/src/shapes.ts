import { AABB, type Matrix2D, Vec2 } from "@quintus/math";

/** Rectangle shape, centered on origin. */
export interface RectShape {
	readonly type: "rect";
	readonly width: number;
	readonly height: number;
}

/** Circle shape, centered on origin. */
export interface CircleShape {
	readonly type: "circle";
	readonly radius: number;
}

/** Capsule shape (a rectangle with semicircle caps), centered on origin.
 *  Height is the total height including caps. */
export interface CapsuleShape {
	readonly type: "capsule";
	readonly radius: number;
	readonly height: number;
}

/** Convex polygon shape, vertices in clockwise order relative to origin. */
export interface PolygonShape {
	readonly type: "polygon";
	readonly points: readonly Vec2[];
}

/** Union of all collision shapes. */
export type Shape2D = RectShape | CircleShape | CapsuleShape | PolygonShape;

/** Factory for creating shapes. */
export const Shape = {
	rect(width: number, height: number): RectShape {
		return { type: "rect", width, height };
	},

	circle(radius: number): CircleShape {
		return { type: "circle", radius };
	},

	capsule(radius: number, height: number): CapsuleShape {
		return { type: "capsule", radius, height };
	},

	polygon(points: Vec2[]): PolygonShape {
		if (points.length < 3) {
			throw new Error("Polygon must have at least 3 vertices.");
		}
		// Validate convexity via cross product sign check (must be consistently clockwise)
		let sign = 0;
		for (let i = 0; i < points.length; i++) {
			const a = points[i] as Vec2;
			const b = points[(i + 1) % points.length] as Vec2;
			const c = points[(i + 2) % points.length] as Vec2;
			const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
			if (cross !== 0) {
				if (sign === 0) sign = Math.sign(cross);
				else if (Math.sign(cross) !== sign) {
					throw new Error(
						"Polygon must be convex. Concave shapes should be decomposed into multiple convex CollisionShape children.",
					);
				}
			}
		}
		return { type: "polygon", points: Object.freeze([...points]) };
	},
} as const;

/**
 * Compute world-space AABB for a shape with a given transform.
 * Uses fast path when transform has no rotation/scale (translation only).
 * All math is inlined — no transformPoint(), getScale(), or map() calls.
 */
export function shapeAABB(shape: Shape2D, transform: Matrix2D): AABB {
	const { a, b, c, d, e: tx, f: ty } = transform;

	// Fast path: no rotation or scale (common in platformers)
	if (transform.isTranslationOnly()) {
		switch (shape.type) {
			case "rect":
				return new AABB(
					new Vec2(tx - shape.width / 2, ty - shape.height / 2),
					new Vec2(tx + shape.width / 2, ty + shape.height / 2),
				);
			case "circle":
				return new AABB(
					new Vec2(tx - shape.radius, ty - shape.radius),
					new Vec2(tx + shape.radius, ty + shape.radius),
				);
			case "capsule": {
				const hw = shape.radius;
				const hh = shape.height / 2;
				return new AABB(new Vec2(tx - hw, ty - hh), new Vec2(tx + hw, ty + hh));
			}
			case "polygon": {
				let minX = Infinity;
				let minY = Infinity;
				let maxX = -Infinity;
				let maxY = -Infinity;
				for (const p of shape.points) {
					const wx = p.x + tx;
					const wy = p.y + ty;
					if (wx < minX) minX = wx;
					if (wy < minY) minY = wy;
					if (wx > maxX) maxX = wx;
					if (wy > maxY) maxY = wy;
				}
				return new AABB(new Vec2(minX, minY), new Vec2(maxX, maxY));
			}
		}
	}

	// Rotated/scaled path: inline transform math
	switch (shape.type) {
		case "rect": {
			// OBB-to-AABB formula: extentX = |a|*hw + |c|*hh, extentY = |b|*hw + |d|*hh
			const hw = shape.width / 2;
			const hh = shape.height / 2;
			const extentX = Math.abs(a) * hw + Math.abs(c) * hh;
			const extentY = Math.abs(b) * hw + Math.abs(d) * hh;
			return new AABB(new Vec2(tx - extentX, ty - extentY), new Vec2(tx + extentX, ty + extentY));
		}
		case "circle": {
			// Inline scale computation: sx = sqrt(a*a + b*b). No getScale() call.
			const sx = Math.sqrt(a * a + b * b);
			const sy = Math.sqrt(c * c + d * d);
			const effectiveRadius = Math.max(sx, sy) * shape.radius;
			return new AABB(
				new Vec2(tx - effectiveRadius, ty - effectiveRadius),
				new Vec2(tx + effectiveRadius, ty + effectiveRadius),
			);
		}
		case "capsule": {
			// Transform segment endpoints inline, then expand by scaled radius
			const halfSeg = shape.height / 2 - shape.radius;
			// Top center = transform * (0, -halfSeg)
			const topX = c * -halfSeg + tx;
			const topY = d * -halfSeg + ty;
			// Bottom center = transform * (0, +halfSeg)
			const botX = c * halfSeg + tx;
			const botY = d * halfSeg + ty;
			// Inline scale for radius — conservative approximation for non-uniform scale
			const sx = Math.sqrt(a * a + b * b);
			const sy = Math.sqrt(c * c + d * d);
			const effectiveRadius = Math.max(sx, sy) * shape.radius;
			return new AABB(
				new Vec2(Math.min(topX, botX) - effectiveRadius, Math.min(topY, botY) - effectiveRadius),
				new Vec2(Math.max(topX, botX) + effectiveRadius, Math.max(topY, botY) + effectiveRadius),
			);
		}
		case "polygon": {
			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;
			for (const p of shape.points) {
				const wx = a * p.x + c * p.y + tx;
				const wy = b * p.x + d * p.y + ty;
				if (wx < minX) minX = wx;
				if (wy < minY) minY = wy;
				if (wx > maxX) maxX = wx;
				if (wy > maxY) maxY = wy;
			}
			return new AABB(new Vec2(minX, minY), new Vec2(maxX, maxY));
		}
	}
}
