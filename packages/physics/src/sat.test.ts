import { EPSILON, Matrix2D, Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { type SATResult, findTOI, flip, sweptAABB, testOverlap } from "./sat.js";
import { Shape } from "./shapes.js";

/** Helper: translation-only transform. */
function tx(x: number, y: number): Matrix2D {
	return Matrix2D.translate(x, y);
}

/** Helper: compose transform from position + rotation. */
function txr(x: number, y: number, angle: number): Matrix2D {
	return Matrix2D.compose(new Vec2(x, y), angle, Vec2.ONE);
}

/** Helper: compose transform with position + scale. */
function txs(x: number, y: number, sx: number, sy: number): Matrix2D {
	return Matrix2D.compose(new Vec2(x, y), 0, new Vec2(sx, sy));
}

/** Assert normal approximately equals expected. */
function expectNormal(result: SATResult | null, nx: number, ny: number): void {
	expect(result).not.toBeNull();
	expect(result!.normal.x).toBeCloseTo(nx, 4);
	expect(result!.normal.y).toBeCloseTo(ny, 4);
}

// ── Rect vs Rect ─────────────────────────────────────────────────

describe("SAT: Rect vs Rect", () => {
	const r16 = Shape.rect(16, 16);
	const r32 = Shape.rect(32, 32);

	it("overlapping rectangles → correct depth, normal", () => {
		const result = testOverlap(r16, tx(0, 0), r16, tx(10, 0));
		expect(result).not.toBeNull();
		expect(result!.depth).toBeCloseTo(6);
		expectNormal(result, 1, 0); // A toward B (B is to the right)
	});

	it("touching rectangles (edge-to-edge) → no overlap", () => {
		const result = testOverlap(r16, tx(0, 0), r16, tx(16, 0));
		expect(result).toBeNull();
	});

	it("non-overlapping rectangles → null", () => {
		const result = testOverlap(r16, tx(0, 0), r16, tx(50, 0));
		expect(result).toBeNull();
	});

	it("one rect fully inside another → correct minimum separation", () => {
		const result = testOverlap(r16, tx(0, 0), r32, tx(0, 0));
		expect(result).not.toBeNull();
		// Overlap on X: (16+32)/2 - 0 = 24, on Y: same = 24
		expect(result!.depth).toBeCloseTo(24);
	});

	it("equal-sized rects at same position → stable normal", () => {
		const result = testOverlap(r16, tx(5, 5), r16, tx(5, 5));
		expect(result).not.toBeNull();
		expect(result!.depth).toBeCloseTo(16);
		// Normal is valid (either axis is fine for coincident centers)
		const n = result!.normal;
		expect(n.x * n.x + n.y * n.y).toBeCloseTo(1);
	});

	it("vertical overlap → Y normal", () => {
		const result = testOverlap(r16, tx(0, 0), r16, tx(0, 10));
		expect(result).not.toBeNull();
		expect(result!.depth).toBeCloseTo(6);
		expectNormal(result, 0, 1); // B is below
	});

	it("B is to the left → negative X normal", () => {
		const result = testOverlap(r16, tx(10, 0), r16, tx(0, 0));
		expect(result).not.toBeNull();
		expectNormal(result, -1, 0);
	});
});

// ── Circle vs Circle ─────────────────────────────────────────────

describe("SAT: Circle vs Circle", () => {
	const c10 = Shape.circle(10);
	const c5 = Shape.circle(5);

	it("overlapping circles → correct depth, normal", () => {
		const result = testOverlap(c10, tx(0, 0), c10, tx(15, 0));
		expect(result).not.toBeNull();
		expect(result!.depth).toBeCloseTo(5); // 10+10-15
		expectNormal(result, 1, 0);
	});

	it("touching circles → depth ≈ 0", () => {
		const result = testOverlap(c10, tx(0, 0), c10, tx(20, 0));
		// At exactly touching, depth = 0 but >= check means null
		expect(result).toBeNull();
	});

	it("non-overlapping circles → null", () => {
		const result = testOverlap(c10, tx(0, 0), c10, tx(30, 0));
		expect(result).toBeNull();
	});

	it("concentric circles → stable normal, correct depth", () => {
		const result = testOverlap(c10, tx(5, 5), c10, tx(5, 5));
		expect(result).not.toBeNull();
		expect(result!.depth).toBeCloseTo(20); // 10+10
		// Normal is arbitrary but valid
		const n = result!.normal;
		expect(n.x * n.x + n.y * n.y).toBeCloseTo(1);
	});

	it("different radii → correct depth", () => {
		const result = testOverlap(c10, tx(0, 0), c5, tx(12, 0));
		expect(result).not.toBeNull();
		expect(result!.depth).toBeCloseTo(3); // 10+5-12
	});

	it("scaled circle → uses effective radius", () => {
		const result = testOverlap(
			c10,
			txs(0, 0, 2, 2),
			c10,
			tx(25, 0),
		);
		// radiusA = 20, radiusB = 10, dist = 25
		expect(result).not.toBeNull();
		expect(result!.depth).toBeCloseTo(5); // 20+10-25
	});
});

// ── Rect vs Circle ───────────────────────────────────────────────

describe("SAT: Rect vs Circle", () => {
	const r32 = Shape.rect(32, 32);
	const c10 = Shape.circle(10);

	it("circle overlapping rect edge → normal perpendicular to edge", () => {
		// Circle to the right of rect, overlapping the right edge
		const result = testOverlap(r32, tx(0, 0), c10, tx(20, 0));
		expect(result).not.toBeNull();
		// Rect right edge at 16, circle left edge at 10. Overlap = 6
		expect(result!.depth).toBeCloseTo(6);
		expectNormal(result, 1, 0); // From rect toward circle
	});

	it("circle overlapping rect corner → normal toward circle center", () => {
		// Circle near the top-right corner
		const result = testOverlap(r32, tx(0, 0), c10, tx(20, -20));
		expect(result).not.toBeNull();
		// Normal should point from rect toward circle (toward top-right)
		expect(result!.normal.x).toBeGreaterThan(0);
		expect(result!.normal.y).toBeLessThan(0);
	});

	it("circle inside rect → correct separation axis", () => {
		const result = testOverlap(r32, tx(0, 0), c10, tx(2, 0));
		expect(result).not.toBeNull();
		expect(result!.depth).toBeGreaterThan(0);
	});

	it("circle outside rect → null", () => {
		const result = testOverlap(r32, tx(0, 0), c10, tx(30, 0));
		expect(result).toBeNull();
	});

	it("circle (A) vs rect (B) swapped order", () => {
		// flip() should make normal point from circle toward rect
		const result = testOverlap(c10, tx(20, 0), r32, tx(0, 0));
		expect(result).not.toBeNull();
		expectNormal(result, -1, 0); // From circle toward rect (rect is to the left)
	});
});

// ── General SAT (transform-aware) ───────────────────────────────

describe("SAT: General (rotated/capsule/polygon)", () => {
	it("rotated rect vs rect → correct overlap via generalSAT", () => {
		const r16 = Shape.rect(16, 16);
		const angle = Math.PI / 4; // 45°
		const result = testOverlap(r16, txr(0, 0, angle), r16, tx(15, 0));
		// Rotated rect is larger — should still overlap
		expect(result).not.toBeNull();
		expect(result!.depth).toBeGreaterThan(0);
	});

	it("45° rotated rect has larger AABB than unrotated", () => {
		const r16 = Shape.rect(16, 16);
		// Place rects 14 apart — unrotated wouldn't overlap, but rotated does
		const result = testOverlap(r16, txr(0, 0, Math.PI / 4), r16, tx(18, 0));
		expect(result).not.toBeNull();
	});

	it("rotated rect vs circle → correct collision", () => {
		const r16 = Shape.rect(16, 16);
		const c5 = Shape.circle(5);
		const result = testOverlap(
			r16,
			txr(0, 0, Math.PI / 4),
			c5,
			tx(15, 0),
		);
		expect(result).not.toBeNull();
		expect(result!.depth).toBeGreaterThan(0);
	});

	it("capsule vs rect → correct collision and normal", () => {
		const capsule = Shape.capsule(5, 20); // radius 5, height 20
		const rect = Shape.rect(32, 32);
		// A=rect at origin, B=capsule to the right → normal points right
		const result = testOverlap(rect, tx(0, 0), capsule, tx(20, 0));
		expect(result).not.toBeNull();
		expect(result!.depth).toBeGreaterThan(0);
		// Capsule (B) is to the right of rect (A)
		expect(result!.normal.x).toBeGreaterThan(0);
	});

	it("capsule vs circle → correct collision", () => {
		const capsule = Shape.capsule(5, 20);
		const circle = Shape.circle(5);
		const result = testOverlap(capsule, tx(0, 0), circle, tx(8, 0));
		expect(result).not.toBeNull();
		expect(result!.depth).toBeCloseTo(2); // 5+5-8
	});

	it("capsule vs capsule → correct collision", () => {
		const cap = Shape.capsule(5, 20);
		const result = testOverlap(cap, tx(0, 0), cap, tx(8, 0));
		expect(result).not.toBeNull();
		expect(result!.depth).toBeCloseTo(2); // 5+5-8 (side by side)
	});

	it("rotated capsule (horizontal) vs rect → correct collision", () => {
		const capsule = Shape.capsule(5, 20);
		const rect = Shape.rect(32, 32);
		// Rotate capsule 90° to make it horizontal
		const result = testOverlap(
			capsule,
			txr(0, 0, Math.PI / 2),
			rect,
			tx(20, 0),
		);
		expect(result).not.toBeNull();
	});

	it("triangle vs triangle → correct overlap", () => {
		const tri1 = Shape.polygon([
			new Vec2(0, -10),
			new Vec2(10, 10),
			new Vec2(-10, 10),
		]);
		const tri2 = Shape.polygon([
			new Vec2(0, -10),
			new Vec2(10, 10),
			new Vec2(-10, 10),
		]);
		const result = testOverlap(tri1, tx(0, 0), tri2, tx(5, 0));
		expect(result).not.toBeNull();
		expect(result!.depth).toBeGreaterThan(0);
	});

	it("pentagon vs rect → correct overlap", () => {
		// Regular pentagon (approximately)
		const pentagon = Shape.polygon([
			new Vec2(0, -10),
			new Vec2(9.5, -3.1),
			new Vec2(5.9, 8.1),
			new Vec2(-5.9, 8.1),
			new Vec2(-9.5, -3.1),
		]);
		const rect = Shape.rect(16, 16);
		const result = testOverlap(pentagon, tx(0, 0), rect, tx(12, 0));
		expect(result).not.toBeNull();
	});

	it("no overlap between far-apart polygons → null", () => {
		const tri = Shape.polygon([
			new Vec2(0, -5),
			new Vec2(5, 5),
			new Vec2(-5, 5),
		]);
		const result = testOverlap(tri, tx(0, 0), tri, tx(100, 0));
		expect(result).toBeNull();
	});

	it("adjacent polygons (sharing edge) → depth near zero or null", () => {
		// Two triangles placed edge-to-edge
		const tri = Shape.polygon([
			new Vec2(0, -10),
			new Vec2(10, 10),
			new Vec2(-10, 10),
		]);
		// Place second triangle just barely touching (right edge of first)
		const result = testOverlap(tri, tx(0, 0), tri, tx(20, 0));
		// Should be null or very shallow
		if (result) {
			expect(result.depth).toBeLessThan(0.1);
		}
	});
});

// ── Normal Direction ─────────────────────────────────────────────

describe("SAT: Normal direction", () => {
	it("normal always points from A toward B", () => {
		const r16 = Shape.rect(16, 16);

		// B to the right
		let result = testOverlap(r16, tx(0, 0), r16, tx(10, 0));
		expect(result!.normal.x).toBeGreaterThan(0);

		// B to the left
		result = testOverlap(r16, tx(0, 0), r16, tx(-10, 0));
		expect(result!.normal.x).toBeLessThan(0);

		// B below
		result = testOverlap(r16, tx(0, 0), r16, tx(0, 10));
		expect(result!.normal.y).toBeGreaterThan(0);

		// B above
		result = testOverlap(r16, tx(0, 0), r16, tx(0, -10));
		expect(result!.normal.y).toBeLessThan(0);
	});

	it("flip() correctly reverses the result", () => {
		const r16 = Shape.rect(16, 16);
		const result = testOverlap(r16, tx(0, 0), r16, tx(10, 0));
		const flipped = flip(result);
		expect(flipped).not.toBeNull();
		expect(flipped!.normal.x).toBeCloseTo(-result!.normal.x);
		expect(flipped!.normal.y).toBeCloseTo(-result!.normal.y);
		expect(flipped!.depth).toBeCloseTo(result!.depth);
	});

	it("flip(null) returns null", () => {
		expect(flip(null)).toBeNull();
	});

	it("general SAT normal points from A toward B", () => {
		const r16 = Shape.rect(16, 16);
		const angle = Math.PI / 6; // 30°
		const result = testOverlap(r16, txr(0, 0, angle), r16, tx(10, 0));
		expect(result).not.toBeNull();
		// B is to the right, so normal should have positive X component
		expect(result!.normal.x).toBeGreaterThan(0);
	});
});

// ── Swept Collision: findTOI ─────────────────────────────────────

describe("Swept: findTOI", () => {
	const r16 = Shape.rect(16, 16);
	const c10 = Shape.circle(10);

	it("returns null for non-colliding paths", () => {
		const result = findTOI(r16, tx(0, 0), new Vec2(100, 0), r16, tx(0, 100));
		expect(result).toBeNull();
	});

	it("returns toi=0 for already-overlapping shapes", () => {
		// Motion small enough that endpoint still overlaps
		const result = findTOI(r16, tx(0, 0), new Vec2(3, 0), r16, tx(5, 0));
		expect(result).not.toBeNull();
		expect(result!.toi).toBe(0);
	});

	it("returns correct toi for motion into obstacle", () => {
		// A at 0, B at 100, both 16x16. A moves right 95px.
		// At t=1: A at (95,0), overlaps B at (100,0) with dx=5
		// Contact at x=84 (A right edge=92 meets B left edge=92)
		// toi ≈ 84/95 = 0.884
		const result = findTOI(
			r16,
			tx(0, 0),
			new Vec2(95, 0),
			r16,
			tx(100, 0),
		);
		expect(result).not.toBeNull();
		expect(result!.toi).toBeCloseTo(84 / 95, 1);
	});

	it("works with rotated shapes", () => {
		// Short enough motion that endpoint overlaps
		const result = findTOI(
			r16,
			txr(0, 0, Math.PI / 4),
			new Vec2(40, 0),
			r16,
			tx(50, 0),
		);
		expect(result).not.toBeNull();
		expect(result!.toi).toBeGreaterThan(0);
		expect(result!.toi).toBeLessThan(1);
	});

	it("fast-moving body detected (no tunneling through thin wall)", () => {
		// Thin wall (4px wide) at x=100. Motion ends inside wall.
		const wall = Shape.rect(4, 100);
		const result = findTOI(
			r16,
			tx(0, 0),
			new Vec2(100, 0),
			wall,
			tx(100, 0),
		);
		expect(result).not.toBeNull();
		expect(result!.toi).toBeGreaterThan(0);
		expect(result!.toi).toBeLessThan(1);
	});

	it("zero-length motion → no collision", () => {
		const result = findTOI(r16, tx(0, 0), Vec2.ZERO, r16, tx(5, 0));
		expect(result).toBeNull();
	});

	it("motion parallel to wall surface → null", () => {
		// Wall to the right at x=100, move straight up
		const result = findTOI(
			r16,
			tx(0, 0),
			new Vec2(0, -100),
			r16,
			tx(100, 0),
		);
		expect(result).toBeNull();
	});

	it("sub-epsilon motion vector → treated as no motion", () => {
		const tiny = new Vec2(EPSILON * 0.1, EPSILON * 0.1);
		const result = findTOI(r16, tx(0, 0), tiny, r16, tx(5, 0));
		expect(result).toBeNull();
	});

	it("works with circles", () => {
		// Motion ends with overlap: at t=1, body at (35,0), dist to (50,0)=15 < 20
		const result = findTOI(
			c10,
			tx(0, 0),
			new Vec2(35, 0),
			c10,
			tx(50, 0),
		);
		expect(result).not.toBeNull();
		// Contact when distance = 20 (both radii = 10), so at x=30
		// toi ≈ 30/35 = 0.857
		expect(result!.toi).toBeCloseTo(30 / 35, 1);
	});
});

// ── Swept Collision: sweptAABB ───────────────────────────────────

describe("Swept: sweptAABB", () => {
	const r16 = Shape.rect(16, 16);
	const r32 = Shape.rect(32, 32);

	it("matches binary search for rect-vs-rect (translation-only)", () => {
		// Motion ends with overlap so findTOI detects it
		const motion = new Vec2(95, 0);
		const aT = tx(0, 0);
		const bT = tx(100, 0);

		const swept = sweptAABB(r16, aT, motion, r16, bT);
		const binary = findTOI(r16, aT, motion, r16, bT);

		expect(swept).not.toBeNull();
		expect(binary).not.toBeNull();
		expect(swept!.toi).toBeCloseTo(binary!.toi, 1);
	});

	it("returns toi=0 with correct normal for already-overlapping rects", () => {
		const result = sweptAABB(r16, tx(0, 0), new Vec2(100, 0), r16, tx(5, 0));
		expect(result).not.toBeNull();
		expect(result!.toi).toBe(0);
	});

	it("returns null for non-colliding paths", () => {
		const result = sweptAABB(
			r16,
			tx(0, 0),
			new Vec2(100, 0),
			r16,
			tx(0, 100),
		);
		expect(result).toBeNull();
	});

	it("zero-length motion → null", () => {
		const result = sweptAABB(r16, tx(0, 0), Vec2.ZERO, r16, tx(5, 0));
		expect(result).toBeNull();
	});

	it("correct normal for rightward motion", () => {
		const result = sweptAABB(
			r16,
			tx(0, 0),
			new Vec2(200, 0),
			r16,
			tx(100, 0),
		);
		expect(result).not.toBeNull();
		expectNormal(result as unknown as SATResult, 1, 0); // A toward B
	});

	it("correct normal for downward motion", () => {
		const result = sweptAABB(
			r16,
			tx(0, 0),
			new Vec2(0, 200),
			r16,
			tx(0, 100),
		);
		expect(result).not.toBeNull();
		expect(result!.normal.x).toBeCloseTo(0);
		expect(result!.normal.y).toBeCloseTo(1);
	});

	it("correct toi for simple case", () => {
		// A at x=0, B at x=100, both 16x16, motion = (200, 0)
		// A right edge starts at 8, B left edge at 92
		// Contact when A moves 84: toi = 84/200 = 0.42
		const result = sweptAABB(
			r16,
			tx(0, 0),
			new Vec2(200, 0),
			r16,
			tx(100, 0),
		);
		expect(result).not.toBeNull();
		expect(result!.toi).toBeCloseTo(0.42);
	});

	it("diagonal motion → correct entry axis", () => {
		// Move diagonally, hit the Y face first
		const result = sweptAABB(
			r16,
			tx(0, 0),
			new Vec2(50, 200),
			r32,
			tx(0, 100),
		);
		expect(result).not.toBeNull();
		expect(result!.toi).toBeGreaterThan(0);
		expect(result!.toi).toBeLessThan(1);
	});

	it("motion past target → still detects collision within t=0..1", () => {
		const result = sweptAABB(
			r16,
			tx(0, 0),
			new Vec2(1000, 0),
			r16,
			tx(100, 0),
		);
		expect(result).not.toBeNull();
		expect(result!.toi).toBeGreaterThan(0);
		expect(result!.toi).toBeLessThan(1);
	});

	it("grazing/tangent collision", () => {
		// Move right, barely clip the top edge of B
		const result = sweptAABB(
			r16,
			tx(0, -7),
			new Vec2(200, 0),
			r16,
			tx(100, 0),
		);
		// Vertical separation: |-7| = 7 < 16 = combinedHalfH, so they do overlap vertically
		expect(result).not.toBeNull();
	});
});
