import type { Matrix2D, Vec2 } from "@quintus/math";
import { Vec2 as Vec2Class } from "@quintus/math";
import type { Shape2D } from "./shapes.js";

/**
 * Find the support point (furthest point along a direction) for a shape in world space.
 * Used by computeContactPoint() and extensible for future GJK/clipping.
 */
export function shapeSupport(shape: Shape2D, transform: Matrix2D, direction: Vec2): Vec2 {
	const { a, b, c, d, e: tx, f: ty } = transform;

	switch (shape.type) {
		case "circle": {
			// Effective radius under transform
			const sx = Math.sqrt(a * a + b * b);
			const sy = Math.sqrt(c * c + d * d);
			const effectiveRadius = Math.max(sx, sy) * shape.radius;
			const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
			if (len < 1e-10) return new Vec2Class(tx, ty);
			return new Vec2Class(
				tx + (direction.x / len) * effectiveRadius,
				ty + (direction.y / len) * effectiveRadius,
			);
		}

		case "rect": {
			const hw = shape.width / 2;
			const hh = shape.height / 2;
			// Transform the 4 corners and find the one with max dot product along direction
			let bestDot = -Infinity;
			let bestX = 0;
			let bestY = 0;
			for (let sx = -1; sx <= 1; sx += 2) {
				for (let sy = -1; sy <= 1; sy += 2) {
					const lx = sx * hw;
					const ly = sy * hh;
					const wx = a * lx + c * ly + tx;
					const wy = b * lx + d * ly + ty;
					const dot = wx * direction.x + wy * direction.y;
					if (dot > bestDot) {
						bestDot = dot;
						bestX = wx;
						bestY = wy;
					}
				}
			}
			return new Vec2Class(bestX, bestY);
		}

		case "capsule": {
			// Endpoints of the capsule segment
			const halfSeg = shape.height / 2 - shape.radius;
			const topX = c * -halfSeg + tx;
			const topY = d * -halfSeg + ty;
			const botX = c * halfSeg + tx;
			const botY = d * halfSeg + ty;

			// Pick endpoint closest to direction
			const dotTop = topX * direction.x + topY * direction.y;
			const dotBot = botX * direction.x + botY * direction.y;
			const epX = dotTop >= dotBot ? topX : botX;
			const epY = dotTop >= dotBot ? topY : botY;

			// Extend by effective radius along direction
			const sx = Math.sqrt(a * a + b * b);
			const sy = Math.sqrt(c * c + d * d);
			const effectiveRadius = Math.max(sx, sy) * shape.radius;
			const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
			if (len < 1e-10) return new Vec2Class(epX, epY);
			return new Vec2Class(
				epX + (direction.x / len) * effectiveRadius,
				epY + (direction.y / len) * effectiveRadius,
			);
		}

		case "polygon": {
			// Find vertex with max dot product along direction
			let bestDot = -Infinity;
			let bestX = 0;
			let bestY = 0;
			for (const p of shape.points) {
				const wx = a * p.x + c * p.y + tx;
				const wy = b * p.x + d * p.y + ty;
				const dot = wx * direction.x + wy * direction.y;
				if (dot > bestDot) {
					bestDot = dot;
					bestX = wx;
					bestY = wy;
				}
			}
			return new Vec2Class(bestX, bestY);
		}
	}
}

/**
 * Compute an approximate contact point between two colliding shapes.
 * Accurate for circles and vertex-face contacts (the common platformer cases).
 * Approximate for edge-edge (off by at most half the overlap width — fine for effects/debug).
 */
export function computeContactPoint(
	shapeA: Shape2D,
	transformA: Matrix2D,
	shapeB: Shape2D,
	transformB: Matrix2D,
	normal: Vec2,
): Vec2 {
	// supportA: deepest point of A into B (along +normal)
	const supportA = shapeSupport(shapeA, transformA, normal);
	// supportB: deepest point of B into A (along -normal)
	const negNormal = new Vec2Class(-normal.x, -normal.y);
	const supportB = shapeSupport(shapeB, transformB, negNormal);
	// Contact point is midpoint
	return new Vec2Class((supportA.x + supportB.x) / 2, (supportA.y + supportB.y) / 2);
}
