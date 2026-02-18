import { EPSILON, type Matrix2D, Vec2 } from "@quintus/math";
import type { Shape2D } from "./shapes.js";

/** Result of a ray-shape intersection test. */
export interface RayShapeHit {
	/** Parametric t along the ray (hit point = origin + direction * t). */
	t: number;
	/** Surface normal at the hit point. */
	normal: Vec2;
}

/**
 * Test a ray against a shape with a world transform.
 * Returns null if no intersection, or the closest hit with t >= 0 and t <= maxT.
 *
 * **Inside-origin rule:** If the ray origin is inside the shape, returns null.
 * This matches Godot/Box2D behavior.
 */
export function rayIntersectShape(
	origin: Vec2,
	direction: Vec2,
	maxT: number,
	shape: Shape2D,
	transform: Matrix2D,
): RayShapeHit | null {
	switch (shape.type) {
		case "rect":
			return rayVsRect(origin, direction, maxT, shape.width, shape.height, transform);
		case "circle":
			return rayVsCircle(origin, direction, maxT, shape.radius, transform);
		case "capsule":
			return rayVsCapsule(origin, direction, maxT, shape.radius, shape.height, transform);
		case "polygon":
			return rayVsPolygon(origin, direction, maxT, shape.points, transform);
	}
}

/**
 * Test if a point is inside a shape at the given transform.
 */
export function pointInShape(point: Vec2, shape: Shape2D, transform: Matrix2D): boolean {
	switch (shape.type) {
		case "rect":
			return pointInRect(point, shape.width, shape.height, transform);
		case "circle":
			return pointInCircle(point, shape.radius, transform);
		case "capsule":
			return pointInCapsule(point, shape.radius, shape.height, transform);
		case "polygon":
			return pointInPolygon(point, shape.points, transform);
	}
}

// ── Ray vs Rect ──────────────────────────────────────────────────

function rayVsRect(
	origin: Vec2,
	direction: Vec2,
	maxT: number,
	width: number,
	height: number,
	transform: Matrix2D,
): RayShapeHit | null {
	// Transform ray into rect's local space
	const inv = transform.inverse();
	const localOriginX = inv.a * origin.x + inv.c * origin.y + inv.e;
	const localOriginY = inv.b * origin.x + inv.d * origin.y + inv.f;
	const localDirX = inv.a * direction.x + inv.c * direction.y;
	const localDirY = inv.b * direction.x + inv.d * direction.y;

	const hw = width / 2;
	const hh = height / 2;

	// Slab intersection
	let tMin = -Infinity;
	let tMax = Infinity;
	let entryAxis = 0; // 0 = X, 1 = Y
	let entrySign = 1;

	// X slab
	if (Math.abs(localDirX) < EPSILON) {
		if (localOriginX < -hw || localOriginX > hw) return null;
	} else {
		const invDx = 1 / localDirX;
		let t1 = (-hw - localOriginX) * invDx;
		let t2 = (hw - localOriginX) * invDx;
		let sign = -1;
		if (t1 > t2) {
			const tmp = t1;
			t1 = t2;
			t2 = tmp;
			sign = 1;
		}
		if (t1 > tMin) {
			tMin = t1;
			entryAxis = 0;
			entrySign = sign;
		}
		if (t2 < tMax) tMax = t2;
		if (tMin > tMax) return null;
	}

	// Y slab
	if (Math.abs(localDirY) < EPSILON) {
		if (localOriginY < -hh || localOriginY > hh) return null;
	} else {
		const invDy = 1 / localDirY;
		let t1 = (-hh - localOriginY) * invDy;
		let t2 = (hh - localOriginY) * invDy;
		let sign = -1;
		if (t1 > t2) {
			const tmp = t1;
			t1 = t2;
			t2 = tmp;
			sign = 1;
		}
		if (t1 > tMin) {
			tMin = t1;
			entryAxis = 1;
			entrySign = sign;
		}
		if (t2 < tMax) tMax = t2;
		if (tMin > tMax) return null;
	}

	// Inside-origin rule: if tMin < 0, the ray started inside the shape
	if (tMin < EPSILON) return null;
	if (tMin > maxT) return null;

	// Compute local normal and transform back to world space
	const localNormalX = entryAxis === 0 ? entrySign : 0;
	const localNormalY = entryAxis === 1 ? entrySign : 0;

	// Transform normal by inverse-transpose (= transform vector by (a,b,c,d) transposed)
	// For affine transform M, normal transforms by (M^-1)^T
	// inv = M^-1, so inv^T has columns = inv rows
	const wnx = inv.a * localNormalX + inv.b * localNormalY;
	const wny = inv.c * localNormalX + inv.d * localNormalY;
	const len = Math.sqrt(wnx * wnx + wny * wny);
	if (len < EPSILON) return null;

	return {
		t: tMin,
		normal: new Vec2(wnx / len, wny / len),
	};
}

// ── Ray vs Circle ────────────────────────────────────────────────

function rayVsCircle(
	origin: Vec2,
	direction: Vec2,
	maxT: number,
	radius: number,
	transform: Matrix2D,
): RayShapeHit | null {
	// Compute effective radius under transform scale
	const sx = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
	const sy = Math.sqrt(transform.c * transform.c + transform.d * transform.d);
	const effectiveRadius = Math.max(sx, sy) * radius;

	const cx = transform.e;
	const cy = transform.f;
	const ocx = origin.x - cx;
	const ocy = origin.y - cy;

	// Quadratic: |P + tD - C|^2 = r^2
	const a = direction.x * direction.x + direction.y * direction.y;
	const b = 2 * (direction.x * ocx + direction.y * ocy);
	const c = ocx * ocx + ocy * ocy - effectiveRadius * effectiveRadius;

	// Inside-origin rule: if origin is inside the circle, return null
	if (c < -EPSILON) return null;

	const discriminant = b * b - 4 * a * c;
	if (discriminant < 0) return null;

	const sqrtDisc = Math.sqrt(discriminant);
	const t = (-b - sqrtDisc) / (2 * a);

	if (t < EPSILON || t > maxT) return null;

	// Normal at hit point
	const hitX = origin.x + direction.x * t;
	const hitY = origin.y + direction.y * t;
	const nx = hitX - cx;
	const ny = hitY - cy;
	const nLen = Math.sqrt(nx * nx + ny * ny);

	return {
		t,
		normal: nLen > EPSILON ? new Vec2(nx / nLen, ny / nLen) : new Vec2(0, -1),
	};
}

// ── Ray vs Capsule ───────────────────────────────────────────────

function rayVsCapsule(
	origin: Vec2,
	direction: Vec2,
	maxT: number,
	radius: number,
	height: number,
	transform: Matrix2D,
): RayShapeHit | null {
	// Transform ray into capsule-local space
	const inv = transform.inverse();
	const localOx = inv.a * origin.x + inv.c * origin.y + inv.e;
	const localOy = inv.b * origin.x + inv.d * origin.y + inv.f;
	const localDx = inv.a * direction.x + inv.c * direction.y;
	const localDy = inv.b * direction.x + inv.d * direction.y;

	// Compute effective radius in local space
	// Since we've already inverse-transformed, the capsule is at origin with its natural radius
	const halfSeg = height / 2 - radius;
	const r = radius;

	let bestT = Infinity;
	let bestLocalNx = 0;
	let bestLocalNy = 0;

	// 1. Side walls: x = ±r, clamped to segment range y ∈ [-halfSeg, +halfSeg]
	if (Math.abs(localDx) > EPSILON) {
		for (const sign of [-1, 1]) {
			const t = (sign * r - localOx) / localDx;
			if (t >= EPSILON && t <= maxT && t < bestT) {
				const hitY = localOy + localDy * t;
				if (hitY >= -halfSeg && hitY <= halfSeg) {
					bestT = t;
					bestLocalNx = sign;
					bestLocalNy = 0;
				}
			}
		}
	}

	// 2. End cap circles at y = -halfSeg and y = +halfSeg
	for (const capY of [-halfSeg, halfSeg]) {
		const ocx = localOx;
		const ocy = localOy - capY;
		const a = localDx * localDx + localDy * localDy;
		const b = 2 * (localDx * ocx + localDy * ocy);
		const c = ocx * ocx + ocy * ocy - r * r;
		const disc = b * b - 4 * a * c;
		if (disc >= 0) {
			const sqrtDisc = Math.sqrt(disc);
			const t = (-b - sqrtDisc) / (2 * a);
			if (t >= EPSILON && t <= maxT && t < bestT) {
				bestT = t;
				const hx = localOx + localDx * t;
				const hy = localOy + localDy * t - capY;
				const hn = Math.sqrt(hx * hx + hy * hy);
				if (hn > EPSILON) {
					bestLocalNx = hx / hn;
					bestLocalNy = hy / hn;
				} else {
					bestLocalNx = 0;
					bestLocalNy = capY < 0 ? -1 : 1;
				}
			}
		}
	}

	if (bestT > maxT) return null;

	// Check inside-origin: is origin inside capsule?
	// Distance from origin to segment ≤ radius means inside
	const clampedY = Math.max(-halfSeg, Math.min(halfSeg, localOy));
	const distToSpine = Math.sqrt(localOx * localOx + (localOy - clampedY) * (localOy - clampedY));
	if (distToSpine < r - EPSILON) return null;

	// Transform normal back to world space
	// Use the original transform (not inverse) to transform the local normal direction
	const wnx = transform.a * bestLocalNx + transform.c * bestLocalNy;
	const wny = transform.b * bestLocalNx + transform.d * bestLocalNy;
	const len = Math.sqrt(wnx * wnx + wny * wny);
	if (len < EPSILON) return null;

	return {
		t: bestT,
		normal: new Vec2(wnx / len, wny / len),
	};
}

// ── Ray vs Polygon ───────────────────────────────────────────────

function rayVsPolygon(
	origin: Vec2,
	direction: Vec2,
	maxT: number,
	points: readonly Vec2[],
	transform: Matrix2D,
): RayShapeHit | null {
	const { a, b, c, d, e, f } = transform;

	let bestT = Infinity;
	let bestNx = 0;
	let bestNy = 0;

	for (let i = 0; i < points.length; i++) {
		const p1 = points[i] as Vec2;
		const p2 = points[(i + 1) % points.length] as Vec2;

		// Transform vertices to world space
		const v1x = a * p1.x + c * p1.y + e;
		const v1y = b * p1.x + d * p1.y + f;
		const v2x = a * p2.x + c * p2.y + e;
		const v2y = b * p2.x + d * p2.y + f;

		// Edge vector
		const edgeX = v2x - v1x;
		const edgeY = v2y - v1y;

		// Ray-segment intersection
		const denom = direction.x * edgeY - direction.y * edgeX;
		if (Math.abs(denom) < EPSILON) continue;

		const diffX = v1x - origin.x;
		const diffY = v1y - origin.y;

		const t = (diffX * edgeY - diffY * edgeX) / denom;
		const u = (diffX * direction.y - diffY * direction.x) / denom;

		if (t >= EPSILON && t <= maxT && u >= 0 && u <= 1 && t < bestT) {
			bestT = t;
			// Outward normal: perpendicular to edge (clockwise winding = outward is right of edge direction)
			const edgeLen = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
			if (edgeLen > EPSILON) {
				bestNx = edgeY / edgeLen;
				bestNy = -edgeX / edgeLen;
			}
		}
	}

	if (bestT > maxT) return null;

	// Inside-origin: check if origin is inside polygon
	if (isPointInConvexPolygon(origin.x, origin.y, points, transform)) return null;

	return {
		t: bestT,
		normal: new Vec2(bestNx, bestNy),
	};
}

// ── Point-in-Shape helpers ───────────────────────────────────────

function pointInRect(point: Vec2, width: number, height: number, transform: Matrix2D): boolean {
	const inv = transform.inverse();
	const lx = inv.a * point.x + inv.c * point.y + inv.e;
	const ly = inv.b * point.x + inv.d * point.y + inv.f;
	return Math.abs(lx) <= width / 2 && Math.abs(ly) <= height / 2;
}

function pointInCircle(point: Vec2, radius: number, transform: Matrix2D): boolean {
	const sx = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
	const sy = Math.sqrt(transform.c * transform.c + transform.d * transform.d);
	const effectiveRadius = Math.max(sx, sy) * radius;
	const dx = point.x - transform.e;
	const dy = point.y - transform.f;
	return dx * dx + dy * dy <= effectiveRadius * effectiveRadius;
}

function pointInCapsule(point: Vec2, radius: number, height: number, transform: Matrix2D): boolean {
	const inv = transform.inverse();
	const lx = inv.a * point.x + inv.c * point.y + inv.e;
	const ly = inv.b * point.x + inv.d * point.y + inv.f;
	const halfSeg = height / 2 - radius;
	const clampedY = Math.max(-halfSeg, Math.min(halfSeg, ly));
	const dx = lx;
	const dy = ly - clampedY;
	return dx * dx + dy * dy <= radius * radius;
}

function pointInPolygon(point: Vec2, points: readonly Vec2[], transform: Matrix2D): boolean {
	return isPointInConvexPolygon(point.x, point.y, points, transform);
}

/**
 * Cross-product sign test for point-in-convex-polygon.
 * Points are in clockwise order, so all cross products should be <= 0.
 */
function isPointInConvexPolygon(
	px: number,
	py: number,
	points: readonly Vec2[],
	transform: Matrix2D,
): boolean {
	const { a, b, c, d, e, f } = transform;
	const n = points.length;
	if (n < 3) return false;

	for (let i = 0; i < n; i++) {
		const p1 = points[i] as Vec2;
		const p2 = points[(i + 1) % n] as Vec2;
		const v1x = a * p1.x + c * p1.y + e;
		const v1y = b * p1.x + d * p1.y + f;
		const v2x = a * p2.x + c * p2.y + e;
		const v2y = b * p2.x + d * p2.y + f;

		const edgeX = v2x - v1x;
		const edgeY = v2y - v1y;
		const toPointX = px - v1x;
		const toPointY = py - v1y;

		// Cross product: edge × toPoint
		const cross = edgeX * toPointY - edgeY * toPointX;
		// For clockwise winding, all cross products should be <= 0 for an interior point
		if (cross > EPSILON) return false;
	}

	return true;
}
