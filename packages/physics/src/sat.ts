import { clamp, EPSILON, Matrix2D, Vec2 } from "@quintus/math";
import type { CapsuleShape, CircleShape, RectShape, Shape2D } from "./shapes.js";

/** Point-like type for intermediate calculations. */
type XY = { x: number; y: number };

/** Result of a SAT overlap test. */
export interface SATResult {
	/** Whether the shapes overlap. */
	readonly overlapping: boolean;
	/** Minimum translation vector normal (points from shape A toward shape B). */
	readonly normal: Vec2;
	/** Penetration depth along the normal. */
	readonly depth: number;
}

/** Reverse a SAT result's normal (used when argument order is swapped in dispatch). */
export function flip(result: SATResult | null): SATResult | null {
	if (!result) return null;
	return { overlapping: true, normal: result.normal.negate(), depth: result.depth };
}

/**
 * Test overlap between two shapes with given world-space transforms.
 * Returns null if no overlap. Normal points from A toward B.
 */
export function testOverlap(
	shapeA: Shape2D,
	transformA: Matrix2D,
	shapeB: Shape2D,
	transformB: Matrix2D,
): SATResult | null {
	const a = shapeA.type;
	const b = shapeB.type;
	const bothAxisAligned = transformA.isTranslationOnly() && transformB.isTranslationOnly();

	// Fast path: axis-aligned rect vs rect (most common in platformers)
	if (a === "rect" && b === "rect" && bothAxisAligned) {
		return rectVsRect(
			shapeA as RectShape,
			transformA.e,
			transformA.f,
			shapeB as RectShape,
			transformB.e,
			transformB.f,
		);
	}

	// Circle vs circle: rotation-invariant, only need centers + scaled radii
	if (a === "circle" && b === "circle") {
		return circleVsCircle(shapeA as CircleShape, transformA, shapeB as CircleShape, transformB);
	}

	// Fast path: axis-aligned rect vs circle
	if (a === "rect" && b === "circle" && transformA.isTranslationOnly()) {
		const sxB = Math.sqrt(transformB.a * transformB.a + transformB.b * transformB.b);
		const syB = Math.sqrt(transformB.c * transformB.c + transformB.d * transformB.d);
		const radiusB = Math.max(sxB, syB) * (shapeB as CircleShape).radius;
		return rectVsCircle(
			shapeA as RectShape,
			transformA.e,
			transformA.f,
			radiusB,
			transformB.e,
			transformB.f,
		);
	}
	if (a === "circle" && b === "rect" && transformB.isTranslationOnly()) {
		const sxA = Math.sqrt(transformA.a * transformA.a + transformA.b * transformA.b);
		const syA = Math.sqrt(transformA.c * transformA.c + transformA.d * transformA.d);
		const radiusA = Math.max(sxA, syA) * (shapeA as CircleShape).radius;
		return flip(
			rectVsCircle(
				shapeB as RectShape,
				transformB.e,
				transformB.f,
				radiusA,
				transformA.e,
				transformA.f,
			),
		);
	}

	// General case: full SAT with transformed vertices/axes
	return generalSAT(shapeA, transformA, shapeB, transformB);
}

// ── Fast Paths ───────────────────────────────────────────────────

/** AABB overlap for axis-aligned rects. Normal points from A toward B. */
function rectVsRect(
	a: RectShape,
	ax: number,
	ay: number,
	b: RectShape,
	bx: number,
	by: number,
): SATResult | null {
	const dx = bx - ax;
	const dy = by - ay;
	const overlapX = (a.width + b.width) / 2 - Math.abs(dx);
	const overlapY = (a.height + b.height) / 2 - Math.abs(dy);

	if (overlapX <= 0 || overlapY <= 0) return null;

	if (overlapX < overlapY) {
		return {
			overlapping: true,
			normal: new Vec2(dx >= 0 ? 1 : -1, 0),
			depth: overlapX,
		};
	}
	return {
		overlapping: true,
		normal: new Vec2(0, dy >= 0 ? 1 : -1),
		depth: overlapY,
	};
}

/** Circle vs circle overlap. Normal points from A toward B. */
function circleVsCircle(
	a: CircleShape,
	transformA: Matrix2D,
	b: CircleShape,
	transformB: Matrix2D,
): SATResult | null {
	const ax = transformA.e;
	const ay = transformA.f;
	const bx = transformB.e;
	const by = transformB.f;
	const sxA = Math.sqrt(transformA.a * transformA.a + transformA.b * transformA.b);
	const syA = Math.sqrt(transformA.c * transformA.c + transformA.d * transformA.d);
	const sxB = Math.sqrt(transformB.a * transformB.a + transformB.b * transformB.b);
	const syB = Math.sqrt(transformB.c * transformB.c + transformB.d * transformB.d);
	const radiusA = Math.max(sxA, syA) * a.radius;
	const radiusB = Math.max(sxB, syB) * b.radius;

	const dx = bx - ax;
	const dy = by - ay;
	const distSq = dx * dx + dy * dy;
	const radiiSum = radiusA + radiusB;

	if (distSq >= radiiSum * radiiSum) return null;

	const dist = Math.sqrt(distSq);
	if (dist < EPSILON) {
		// Concentric — push apart with arbitrary normal
		return { overlapping: true, normal: new Vec2(0, -1), depth: radiiSum };
	}

	return {
		overlapping: true,
		normal: new Vec2(dx / dist, dy / dist),
		depth: radiiSum - dist,
	};
}

/**
 * Axis-aligned rect vs circle. Normal points from rect toward circle.
 * The radius parameter is the effective radius (already scaled by transform).
 */
function rectVsCircle(
	rect: RectShape,
	rx: number,
	ry: number,
	radius: number,
	cx: number,
	cy: number,
): SATResult | null {
	const halfW = rect.width / 2;
	const halfH = rect.height / 2;
	const relX = cx - rx;
	const relY = cy - ry;
	const closestX = clamp(relX, -halfW, halfW);
	const closestY = clamp(relY, -halfH, halfH);

	const dx = relX - closestX;
	const dy = relY - closestY;
	const distSq = dx * dx + dy * dy;

	if (distSq >= radius * radius) return null;

	// Circle center is inside rect — use minimum penetration axis
	if (distSq < EPSILON) {
		const overlapX = halfW - Math.abs(relX) + radius;
		const overlapY = halfH - Math.abs(relY) + radius;
		if (overlapX < overlapY) {
			return {
				overlapping: true,
				normal: new Vec2(relX >= 0 ? 1 : -1, 0),
				depth: overlapX,
			};
		}
		return {
			overlapping: true,
			normal: new Vec2(0, relY >= 0 ? 1 : -1),
			depth: overlapY,
		};
	}

	const dist = Math.sqrt(distSq);
	return {
		overlapping: true,
		normal: new Vec2(dx / dist, dy / dist),
		depth: radius - dist,
	};
}

// ── General SAT ──────────────────────────────────────────────────

/** Compute effective radius for circle/capsule under a transform. */
function getEffectiveRadius(shape: CircleShape | CapsuleShape, transform: Matrix2D): number {
	const sx = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
	const sy = Math.sqrt(transform.c * transform.c + transform.d * transform.d);
	return Math.max(sx, sy) * shape.radius;
}

/** Transform shape vertices to world space. */
function getWorldVertices(shape: Shape2D, transform: Matrix2D): XY[] {
	const { a, b, c, d, e, f } = transform;
	switch (shape.type) {
		case "rect": {
			const hw = shape.width / 2;
			const hh = shape.height / 2;
			return [
				{ x: a * -hw + c * -hh + e, y: b * -hw + d * -hh + f },
				{ x: a * hw + c * -hh + e, y: b * hw + d * -hh + f },
				{ x: a * hw + c * hh + e, y: b * hw + d * hh + f },
				{ x: a * -hw + c * hh + e, y: b * -hw + d * hh + f },
			];
		}
		case "circle":
			return [];
		case "capsule": {
			const halfSeg = shape.height / 2 - shape.radius;
			return [
				{ x: c * -halfSeg + e, y: d * -halfSeg + f },
				{ x: c * halfSeg + e, y: d * halfSeg + f },
			];
		}
		case "polygon":
			return shape.points.map((p) => ({
				x: a * p.x + c * p.y + e,
				y: b * p.x + d * p.y + f,
			}));
	}
}

/** Add normalized edge normals from world-space polygon vertices. */
function addEdgeNormals(verts: XY[], axes: XY[]): void {
	for (let i = 0; i < verts.length; i++) {
		const va = verts[i] as XY;
		const vb = verts[(i + 1) % verts.length] as XY;
		const edgeX = vb.x - va.x;
		const edgeY = vb.y - va.y;
		const len = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
		if (len > EPSILON) {
			// Perpendicular (90° CCW)
			axes.push({ x: -edgeY / len, y: edgeX / len });
		}
	}
}

/** Add axes from circle center to each vertex of the other shape. */
function addCircleAxes(transform: Matrix2D, otherVerts: XY[], axes: XY[]): void {
	const cx = transform.e;
	const cy = transform.f;
	for (const v of otherVerts) {
		const dx = v.x - cx;
		const dy = v.y - cy;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len > EPSILON) {
			axes.push({ x: dx / len, y: dy / len });
		}
	}
}

/** Add capsule separation axes: basis vectors + segment-to-vertex axes. */
function addCapsuleAxes(transform: Matrix2D, endpoints: XY[], otherVerts: XY[], axes: XY[]): void {
	// Basis vectors (perpendicular and parallel to capsule orientation)
	const bxLen = Math.sqrt(transform.a * transform.a + transform.b * transform.b);
	if (bxLen > EPSILON) {
		axes.push({ x: transform.a / bxLen, y: transform.b / bxLen });
	}
	const byLen = Math.sqrt(transform.c * transform.c + transform.d * transform.d);
	if (byLen > EPSILON) {
		axes.push({ x: transform.c / byLen, y: transform.d / byLen });
	}

	// Segment endpoint to each vertex of other shape
	for (const ep of endpoints) {
		for (const v of otherVerts) {
			const dx = v.x - ep.x;
			const dy = v.y - ep.y;
			const len = Math.sqrt(dx * dx + dy * dy);
			if (len > EPSILON) {
				axes.push({ x: dx / len, y: dy / len });
			}
		}
	}
}

/** Find closest points between two line segments. */
function closestPointsSegments(p0: XY, p1: XY, q0: XY, q1: XY): { a: XY; b: XY } {
	const d1x = p1.x - p0.x;
	const d1y = p1.y - p0.y;
	const d2x = q1.x - q0.x;
	const d2y = q1.y - q0.y;
	const rx = p0.x - q0.x;
	const ry = p0.y - q0.y;

	const aa = d1x * d1x + d1y * d1y;
	const ee = d2x * d2x + d2y * d2y;
	const ff = d2x * rx + d2y * ry;

	let s: number;
	let t: number;

	if (aa <= EPSILON && ee <= EPSILON) {
		// Both degenerate to points
		return { a: { x: p0.x, y: p0.y }, b: { x: q0.x, y: q0.y } };
	}

	if (aa <= EPSILON) {
		s = 0;
		t = clamp(ff / ee, 0, 1);
	} else {
		const cc = d1x * rx + d1y * ry;
		if (ee <= EPSILON) {
			t = 0;
			s = clamp(-cc / aa, 0, 1);
		} else {
			const bb = d1x * d2x + d1y * d2y;
			const denom = aa * ee - bb * bb;

			s = denom > EPSILON ? clamp((bb * ff - cc * ee) / denom, 0, 1) : 0;
			t = (bb * s + ff) / ee;

			if (t < 0) {
				t = 0;
				s = clamp(-cc / aa, 0, 1);
			} else if (t > 1) {
				t = 1;
				s = clamp((bb - cc) / aa, 0, 1);
			}
		}
	}

	return {
		a: { x: p0.x + s * d1x, y: p0.y + s * d1y },
		b: { x: q0.x + t * d2x, y: q0.y + t * d2y },
	};
}

/** Project a shape onto a separation axis, returning the min/max interval. */
function projectOntoAxis(
	shape: Shape2D,
	transform: Matrix2D,
	verts: XY[],
	axis: XY,
): { min: number; max: number } {
	switch (shape.type) {
		case "circle": {
			const center = transform.e * axis.x + transform.f * axis.y;
			const r = getEffectiveRadius(shape, transform);
			return { min: center - r, max: center + r };
		}
		case "capsule": {
			let min = Infinity;
			let max = -Infinity;
			for (const v of verts) {
				const d = v.x * axis.x + v.y * axis.y;
				if (d < min) min = d;
				if (d > max) max = d;
			}
			const r = getEffectiveRadius(shape, transform);
			return { min: min - r, max: max + r };
		}
		default: {
			// rect or polygon — project vertices
			let min = Infinity;
			let max = -Infinity;
			for (const v of verts) {
				const d = v.x * axis.x + v.y * axis.y;
				if (d < min) min = d;
				if (d > max) max = d;
			}
			return { min, max };
		}
	}
}

/** Collect all separation axes for a shape pair. */
function getSeparationAxes(
	shapeA: Shape2D,
	transformA: Matrix2D,
	vertsA: XY[],
	shapeB: Shape2D,
	transformB: Matrix2D,
	vertsB: XY[],
): XY[] {
	const axes: XY[] = [];

	// Axes from shape A
	switch (shapeA.type) {
		case "rect":
		case "polygon":
			addEdgeNormals(vertsA, axes);
			break;
		case "circle":
			addCircleAxes(transformA, vertsB, axes);
			break;
		case "capsule":
			addCapsuleAxes(transformA, vertsA, vertsB, axes);
			break;
	}

	// Axes from shape B
	switch (shapeB.type) {
		case "rect":
		case "polygon":
			addEdgeNormals(vertsB, axes);
			break;
		case "circle":
			addCircleAxes(transformB, vertsA, axes);
			break;
		case "capsule":
			addCapsuleAxes(transformB, vertsB, vertsA, axes);
			break;
	}

	// Special case: capsule-vs-capsule needs segment-to-segment axis
	if (shapeA.type === "capsule" && shapeB.type === "capsule") {
		const closest = closestPointsSegments(
			vertsA[0] as XY,
			vertsA[1] as XY,
			vertsB[0] as XY,
			vertsB[1] as XY,
		);
		const dx = closest.b.x - closest.a.x;
		const dy = closest.b.y - closest.a.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len > EPSILON) {
			axes.push({ x: dx / len, y: dy / len });
		}
	}

	return axes;
}

/** General SAT for any shape pair with world-space transforms. */
function generalSAT(
	shapeA: Shape2D,
	transformA: Matrix2D,
	shapeB: Shape2D,
	transformB: Matrix2D,
): SATResult | null {
	const vertsA = getWorldVertices(shapeA, transformA);
	const vertsB = getWorldVertices(shapeB, transformB);
	const axes = getSeparationAxes(shapeA, transformA, vertsA, shapeB, transformB, vertsB);

	let minDepth = Infinity;
	let minNormalX = 0;
	let minNormalY = 0;

	for (const axis of axes) {
		const projA = projectOntoAxis(shapeA, transformA, vertsA, axis);
		const projB = projectOntoAxis(shapeB, transformB, vertsB, axis);
		const overlap = Math.min(projA.max - projB.min, projB.max - projA.min);

		if (overlap <= 0) return null; // Separating axis found

		if (overlap < minDepth) {
			minDepth = overlap;
			minNormalX = axis.x;
			minNormalY = axis.y;
		}
	}

	// No axes tested → no meaningful collision
	if (minDepth === Infinity) return null;

	// Ensure normal points from A toward B
	const dx = transformB.e - transformA.e;
	const dy = transformB.f - transformA.f;
	if (dx * minNormalX + dy * minNormalY < 0) {
		minNormalX = -minNormalX;
		minNormalY = -minNormalY;
	}

	return {
		overlapping: true,
		normal: new Vec2(minNormalX, minNormalY),
		depth: minDepth,
	};
}

// ── Swept Collision ──────────────────────────────────────────────

/**
 * Binary search for time of impact along a motion vector.
 * Returns null if no collision along the path.
 * Only translation changes during motion — rotation/scale are constant.
 */
export function findTOI(
	bodyShape: Shape2D,
	bodyTransform: Matrix2D,
	motion: Vec2,
	otherShape: Shape2D,
	otherTransform: Matrix2D,
	maxIterations: number = 8,
): { toi: number; result: SATResult } | null {
	// Sub-epsilon motion → no collision
	const motionLenSq = motion.x * motion.x + motion.y * motion.y;
	if (motionLenSq < EPSILON * EPSILON) return null;

	const txAtTime = (t: number): Matrix2D => {
		return new Matrix2D(
			bodyTransform.a,
			bodyTransform.b,
			bodyTransform.c,
			bodyTransform.d,
			bodyTransform.e + motion.x * t,
			bodyTransform.f + motion.y * t,
		);
	};

	// Check full motion endpoint
	const endResult = testOverlap(bodyShape, txAtTime(1), otherShape, otherTransform);
	if (!endResult) return null;

	// Check start: already overlapping?
	const startResult = testOverlap(bodyShape, bodyTransform, otherShape, otherTransform);
	if (startResult) {
		return { toi: 0, result: startResult };
	}

	// Binary search between 0 and 1
	let lo = 0;
	let hi = 1;
	let lastOverlap: SATResult | null = null;

	for (let i = 0; i < maxIterations; i++) {
		const mid = (lo + hi) / 2;
		const midResult = testOverlap(bodyShape, txAtTime(mid), otherShape, otherTransform);
		if (midResult) {
			hi = mid;
			lastOverlap = midResult;
		} else {
			lo = mid;
		}
	}

	return lastOverlap ? { toi: lo, result: lastOverlap } : null;
}

/**
 * Analytical swept AABB for axis-aligned rect-vs-rect (fast path).
 * Only valid when both transforms are translation-only.
 * Normal points from mover (A) toward obstacle (B).
 */
export function sweptAABB(
	a: RectShape,
	aTransform: Matrix2D,
	motion: Vec2,
	b: RectShape,
	bTransform: Matrix2D,
): { toi: number; normal: Vec2 } | null {
	// Sub-epsilon motion → no collision
	const motionLenSq = motion.x * motion.x + motion.y * motion.y;
	if (motionLenSq < EPSILON * EPSILON) return null;

	const ax = aTransform.e;
	const ay = aTransform.f;
	const bx = bTransform.e;
	const by = bTransform.f;
	const dx = bx - ax;
	const dy = by - ay;
	const combinedHalfW = (a.width + b.width) / 2;
	const combinedHalfH = (a.height + b.height) / 2;

	let txEntry: number;
	let txExit: number;
	let tyEntry: number;
	let tyExit: number;

	if (Math.abs(motion.x) > EPSILON) {
		const xEntry = motion.x > 0 ? dx - combinedHalfW : dx + combinedHalfW;
		const xExit = motion.x > 0 ? dx + combinedHalfW : dx - combinedHalfW;
		txEntry = xEntry / motion.x;
		txExit = xExit / motion.x;
	} else {
		txEntry = Math.abs(dx) < combinedHalfW ? -Infinity : Infinity;
		txExit = Math.abs(dx) < combinedHalfW ? Infinity : -Infinity;
	}

	if (Math.abs(motion.y) > EPSILON) {
		const yEntry = motion.y > 0 ? dy - combinedHalfH : dy + combinedHalfH;
		const yExit = motion.y > 0 ? dy + combinedHalfH : dy - combinedHalfH;
		tyEntry = yEntry / motion.y;
		tyExit = yExit / motion.y;
	} else {
		tyEntry = Math.abs(dy) < combinedHalfH ? -Infinity : Infinity;
		tyExit = Math.abs(dy) < combinedHalfH ? Infinity : -Infinity;
	}

	const tEntry = Math.max(txEntry, tyEntry);
	const tExit = Math.min(txExit, tyExit);

	if (tEntry > tExit || tEntry > 1 || tExit < 0) return null;

	// tEntry < 0 means already overlapping at start position
	if (tEntry < 0) {
		const overlapX = combinedHalfW - Math.abs(dx);
		const overlapY = combinedHalfH - Math.abs(dy);
		const normal =
			overlapX < overlapY ? new Vec2(dx >= 0 ? 1 : -1, 0) : new Vec2(0, dy >= 0 ? 1 : -1);
		return { toi: 0, normal };
	}

	let normal: Vec2;
	if (txEntry > tyEntry) {
		normal = motion.x > 0 ? new Vec2(1, 0) : new Vec2(-1, 0);
	} else {
		normal = motion.y > 0 ? new Vec2(0, 1) : new Vec2(0, -1);
	}

	return { toi: tEntry, normal };
}
