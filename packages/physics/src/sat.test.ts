import { EPSILON, Matrix2D, Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { findTOI, flip, type SATResult, sweptAABB, testOverlap } from "./sat.js";
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

/** Helper: compose transform from position + rotation + scale. */
function txrs(x: number, y: number, angle: number, sx: number, sy: number): Matrix2D {
	return Matrix2D.compose(new Vec2(x, y), angle, new Vec2(sx, sy));
}

/** Assert normal approximately equals expected. */
function expectNormal(result: SATResult | null, nx: number, ny: number): void {
	expect(result).not.toBeNull();
	expect(result?.normal.x).toBeCloseTo(nx, 4);
	expect(result?.normal.y).toBeCloseTo(ny, 4);
}

// ── Shared shapes ────────────────────────────────────────────────

/** 20×20 square polygon (equivalent to Shape.rect(20,20) but as polygon type). */
const sqPoly = Shape.polygon([
	new Vec2(-10, -10),
	new Vec2(10, -10),
	new Vec2(10, 10),
	new Vec2(-10, 10),
]);

/** Small equilateral-ish triangle (radius ~10). */
const smallTri = Shape.polygon([new Vec2(0, -10), new Vec2(8.66, 5), new Vec2(-8.66, 5)]);

/** Large hexagon (radius ~20). */
const bigHex = Shape.polygon([
	new Vec2(20, 0),
	new Vec2(10, 17.32),
	new Vec2(-10, 17.32),
	new Vec2(-20, 0),
	new Vec2(-10, -17.32),
	new Vec2(10, -17.32),
]);

// ── Rect vs Rect ─────────────────────────────────────────────────

describe("SAT: Rect vs Rect", () => {
	const r16 = Shape.rect(16, 16);
	const r32 = Shape.rect(32, 32);

	it("overlapping rectangles → correct depth, normal", () => {
		const result = testOverlap(r16, tx(0, 0), r16, tx(10, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(6);
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
		expect(result?.depth).toBeCloseTo(24);
	});

	it("equal-sized rects at same position → stable normal", () => {
		const result = testOverlap(r16, tx(5, 5), r16, tx(5, 5));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(16);
		// Normal is valid (either axis is fine for coincident centers)
		const n = result?.normal;
		expect(n.x * n.x + n.y * n.y).toBeCloseTo(1);
	});

	it("vertical overlap → Y normal", () => {
		const result = testOverlap(r16, tx(0, 0), r16, tx(0, 10));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(6);
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
		expect(result?.depth).toBeCloseTo(5); // 10+10-15
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
		expect(result?.depth).toBeCloseTo(20); // 10+10
		// Normal is arbitrary but valid
		const n = result?.normal;
		expect(n.x * n.x + n.y * n.y).toBeCloseTo(1);
	});

	it("different radii → correct depth", () => {
		const result = testOverlap(c10, tx(0, 0), c5, tx(12, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(3); // 10+5-12
	});

	it("scaled circle → uses effective radius", () => {
		const result = testOverlap(c10, txs(0, 0, 2, 2), c10, tx(25, 0));
		// radiusA = 20, radiusB = 10, dist = 25
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(5); // 20+10-25
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
		expect(result?.depth).toBeCloseTo(6);
		expectNormal(result, 1, 0); // From rect toward circle
	});

	it("circle overlapping rect corner → normal toward circle center", () => {
		// Circle near the top-right corner
		const result = testOverlap(r32, tx(0, 0), c10, tx(20, -20));
		expect(result).not.toBeNull();
		// Normal should point from rect toward circle (toward top-right)
		expect(result?.normal.x).toBeGreaterThan(0);
		expect(result?.normal.y).toBeLessThan(0);
	});

	it("circle inside rect → correct separation axis", () => {
		const result = testOverlap(r32, tx(0, 0), c10, tx(2, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("circle at center of wide rect → Y-axis normal (overlapX > overlapY)", () => {
		// Wide rect: 32×8. Circle radius 3 at rect center.
		// overlapX = 16 + 3 = 19, overlapY = 4 + 3 = 7 → Y-axis minimum
		const wideRect = Shape.rect(32, 8);
		const c3 = Shape.circle(3);
		const result = testOverlap(wideRect, tx(0, 0), c3, tx(0, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(7); // halfH + radius = 4 + 3
		// Normal should be along Y axis (arbitrary direction for centered circle)
		expect(Math.abs(result?.normal.y)).toBeCloseTo(1);
		expect(result?.normal.x).toBeCloseTo(0);
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
		expect(result?.depth).toBeGreaterThan(0);
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
		const result = testOverlap(r16, txr(0, 0, Math.PI / 4), c5, tx(15, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("capsule vs rect → correct collision and normal", () => {
		const capsule = Shape.capsule(5, 20); // radius 5, height 20
		const rect = Shape.rect(32, 32);
		// A=rect at origin, B=capsule to the right → normal points right
		const result = testOverlap(rect, tx(0, 0), capsule, tx(20, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
		// Capsule (B) is to the right of rect (A)
		expect(result?.normal.x).toBeGreaterThan(0);
	});

	it("capsule vs circle → correct collision", () => {
		const capsule = Shape.capsule(5, 20);
		const circle = Shape.circle(5);
		const result = testOverlap(capsule, tx(0, 0), circle, tx(8, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(2); // 5+5-8
	});

	it("capsule vs capsule → correct collision", () => {
		const cap = Shape.capsule(5, 20);
		const result = testOverlap(cap, tx(0, 0), cap, tx(8, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(2); // 5+5-8 (side by side)
	});

	it("rotated capsule (horizontal) vs rect → correct collision", () => {
		const capsule = Shape.capsule(5, 20);
		const rect = Shape.rect(32, 32);
		// Rotate capsule 90° to make it horizontal
		const result = testOverlap(capsule, txr(0, 0, Math.PI / 2), rect, tx(20, 0));
		expect(result).not.toBeNull();
	});

	it("triangle vs triangle → correct overlap", () => {
		const tri1 = Shape.polygon([new Vec2(0, -10), new Vec2(10, 10), new Vec2(-10, 10)]);
		const tri2 = Shape.polygon([new Vec2(0, -10), new Vec2(10, 10), new Vec2(-10, 10)]);
		const result = testOverlap(tri1, tx(0, 0), tri2, tx(5, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
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
		const tri = Shape.polygon([new Vec2(0, -5), new Vec2(5, 5), new Vec2(-5, 5)]);
		const result = testOverlap(tri, tx(0, 0), tri, tx(100, 0));
		expect(result).toBeNull();
	});

	it("adjacent polygons (sharing edge) → depth near zero or null", () => {
		// Two triangles placed edge-to-edge
		const tri = Shape.polygon([new Vec2(0, -10), new Vec2(10, 10), new Vec2(-10, 10)]);
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
		expect(result?.normal.x).toBeGreaterThan(0);

		// B to the left
		result = testOverlap(r16, tx(0, 0), r16, tx(-10, 0));
		expect(result?.normal.x).toBeLessThan(0);

		// B below
		result = testOverlap(r16, tx(0, 0), r16, tx(0, 10));
		expect(result?.normal.y).toBeGreaterThan(0);

		// B above
		result = testOverlap(r16, tx(0, 0), r16, tx(0, -10));
		expect(result?.normal.y).toBeLessThan(0);
	});

	it("flip() correctly reverses the result", () => {
		const r16 = Shape.rect(16, 16);
		const result = testOverlap(r16, tx(0, 0), r16, tx(10, 0));
		const flipped = flip(result);
		expect(flipped).not.toBeNull();
		expect(flipped?.normal.x).toBeCloseTo(-result?.normal.x);
		expect(flipped?.normal.y).toBeCloseTo(-result?.normal.y);
		expect(flipped?.depth).toBeCloseTo(result?.depth);
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
		expect(result?.normal.x).toBeGreaterThan(0);
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
		expect(result?.toi).toBe(0);
	});

	it("returns correct toi for motion into obstacle", () => {
		// A at 0, B at 100, both 16x16. A moves right 95px.
		// At t=1: A at (95,0), overlaps B at (100,0) with dx=5
		// Contact at x=84 (A right edge=92 meets B left edge=92)
		// toi ≈ 84/95 = 0.884
		const result = findTOI(r16, tx(0, 0), new Vec2(95, 0), r16, tx(100, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeCloseTo(84 / 95, 1);
	});

	it("works with rotated shapes", () => {
		// Short enough motion that endpoint overlaps
		const result = findTOI(r16, txr(0, 0, Math.PI / 4), new Vec2(40, 0), r16, tx(50, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeGreaterThan(0);
		expect(result?.toi).toBeLessThan(1);
	});

	it("fast-moving body detected (no tunneling through thin wall)", () => {
		// Thin wall (4px wide) at x=100. Motion ends inside wall.
		const wall = Shape.rect(4, 100);
		const result = findTOI(r16, tx(0, 0), new Vec2(100, 0), wall, tx(100, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeGreaterThan(0);
		expect(result?.toi).toBeLessThan(1);
	});

	it("zero-length motion → no collision", () => {
		const result = findTOI(r16, tx(0, 0), Vec2.ZERO, r16, tx(5, 0));
		expect(result).toBeNull();
	});

	it("motion parallel to wall surface → null", () => {
		// Wall to the right at x=100, move straight up
		const result = findTOI(r16, tx(0, 0), new Vec2(0, -100), r16, tx(100, 0));
		expect(result).toBeNull();
	});

	it("sub-epsilon motion vector → treated as no motion", () => {
		const tiny = new Vec2(EPSILON * 0.1, EPSILON * 0.1);
		const result = findTOI(r16, tx(0, 0), tiny, r16, tx(5, 0));
		expect(result).toBeNull();
	});

	it("works with circles", () => {
		// Motion ends with overlap: at t=1, body at (35,0), dist to (50,0)=15 < 20
		const result = findTOI(c10, tx(0, 0), new Vec2(35, 0), c10, tx(50, 0));
		expect(result).not.toBeNull();
		// Contact when distance = 20 (both radii = 10), so at x=30
		// toi ≈ 30/35 = 0.857
		expect(result?.toi).toBeCloseTo(30 / 35, 1);
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
		expect(swept?.toi).toBeCloseTo(binary?.toi, 1);
	});

	it("returns toi=0 with correct normal for already-overlapping rects", () => {
		const result = sweptAABB(r16, tx(0, 0), new Vec2(100, 0), r16, tx(5, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBe(0);
	});

	it("returns null for non-colliding paths", () => {
		const result = sweptAABB(r16, tx(0, 0), new Vec2(100, 0), r16, tx(0, 100));
		expect(result).toBeNull();
	});

	it("zero-length motion → null", () => {
		const result = sweptAABB(r16, tx(0, 0), Vec2.ZERO, r16, tx(5, 0));
		expect(result).toBeNull();
	});

	it("correct normal for rightward motion", () => {
		const result = sweptAABB(r16, tx(0, 0), new Vec2(200, 0), r16, tx(100, 0));
		expect(result).not.toBeNull();
		expectNormal(result as unknown as SATResult, 1, 0); // A toward B
	});

	it("correct normal for downward motion", () => {
		const result = sweptAABB(r16, tx(0, 0), new Vec2(0, 200), r16, tx(0, 100));
		expect(result).not.toBeNull();
		expect(result?.normal.x).toBeCloseTo(0);
		expect(result?.normal.y).toBeCloseTo(1);
	});

	it("correct toi for simple case", () => {
		// A at x=0, B at x=100, both 16x16, motion = (200, 0)
		// A right edge starts at 8, B left edge at 92
		// Contact when A moves 84: toi = 84/200 = 0.42
		const result = sweptAABB(r16, tx(0, 0), new Vec2(200, 0), r16, tx(100, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeCloseTo(0.42);
	});

	it("diagonal motion → correct entry axis", () => {
		// Move diagonally, hit the Y face first
		const result = sweptAABB(r16, tx(0, 0), new Vec2(50, 200), r32, tx(0, 100));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeGreaterThan(0);
		expect(result?.toi).toBeLessThan(1);
	});

	it("motion past target → still detects collision within t=0..1", () => {
		const result = sweptAABB(r16, tx(0, 0), new Vec2(1000, 0), r16, tx(100, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeGreaterThan(0);
		expect(result?.toi).toBeLessThan(1);
	});

	it("grazing/tangent collision", () => {
		// Move right, barely clip the top edge of B
		const result = sweptAABB(r16, tx(0, -7), new Vec2(200, 0), r16, tx(100, 0));
		// Vertical separation: |-7| = 7 < 16 = combinedHalfH, so they do overlap vertically
		expect(result).not.toBeNull();
	});
});

// ── Swept: sweptAABB (already overlapping — Y-normal branch) ─────

describe("Swept: sweptAABB (already-overlapping edge cases)", () => {
	const r16 = Shape.rect(16, 16);

	it("returns Y-axis normal when overlapX >= overlapY (B below)", () => {
		// A at (0,0), B at (0,5). Both 16x16.
		// overlapX = 16 - |0| = 16, overlapY = 16 - |5| = 11
		// overlapX > overlapY → Y-axis normal
		// dy = 5 >= 0 → normal = (0, 1)
		const result = sweptAABB(r16, tx(0, 0), new Vec2(100, 0), r16, tx(0, 5));
		expect(result).not.toBeNull();
		expect(result?.toi).toBe(0);
		expect(result?.normal.x).toBeCloseTo(0);
		expect(result?.normal.y).toBeCloseTo(1);
	});

	it("returns Y-axis normal with negative dy (B above)", () => {
		// A at (0,0), B at (0,-5).
		// overlapX = 16, overlapY = 11
		// overlapX > overlapY → Y-axis normal
		// dy = -5 < 0 → normal = (0, -1)
		const result = sweptAABB(r16, tx(0, 0), new Vec2(100, 0), r16, tx(0, -5));
		expect(result).not.toBeNull();
		expect(result?.toi).toBe(0);
		expect(result?.normal.x).toBeCloseTo(0);
		expect(result?.normal.y).toBeCloseTo(-1);
	});

	it("returns X-axis normal when overlapX < overlapY (B to the right)", () => {
		// A at (0,0), B at (5,0). Both 16x16.
		// overlapX = 16 - 5 = 11, overlapY = 16 - 0 = 16
		// overlapX < overlapY → X-axis normal
		// dx = 5 >= 0 → normal = (1, 0)
		const result = sweptAABB(r16, tx(0, 0), new Vec2(0, 100), r16, tx(5, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBe(0);
		expect(result?.normal.x).toBeCloseTo(1);
		expect(result?.normal.y).toBeCloseTo(0);
	});

	it("returns X-axis normal with negative dx (B to the left)", () => {
		// A at (0,0), B at (-5,0). Both 16x16.
		// overlapX = 16 - 5 = 11, overlapY = 16
		// overlapX < overlapY → X-axis normal
		// dx = -5 < 0 → normal = (-1, 0)
		const result = sweptAABB(r16, tx(0, 0), new Vec2(0, 100), r16, tx(-5, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBe(0);
		expect(result?.normal.x).toBeCloseTo(-1);
		expect(result?.normal.y).toBeCloseTo(0);
	});
});

describe("Swept: sweptAABB (near-zero motion components)", () => {
	const r16 = Shape.rect(16, 16);

	it("near-zero x motion with overlapping x range uses Infinity entry", () => {
		// motion.x ≈ 0, bodies overlap on x-axis
		// This triggers txEntry = -Infinity, txExit = Infinity branch
		const result = sweptAABB(r16, tx(0, 0), new Vec2(0, 200), r16, tx(0, 100));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeGreaterThan(0);
		expect(result?.toi).toBeLessThan(1);
	});

	it("near-zero x motion with non-overlapping x range returns null", () => {
		// motion.x ≈ 0, bodies far apart on x-axis
		// This triggers txEntry = Infinity, txExit = -Infinity → no collision
		const result = sweptAABB(r16, tx(0, 0), new Vec2(0, 200), r16, tx(100, 100));
		expect(result).toBeNull();
	});

	it("near-zero y motion with overlapping y range detects collision", () => {
		// motion.y ≈ 0, bodies overlap on y-axis
		const result = sweptAABB(r16, tx(0, 0), new Vec2(200, 0), r16, tx(100, 0));
		expect(result).not.toBeNull();
	});

	it("near-zero y motion with non-overlapping y range returns null", () => {
		// motion.y ≈ 0, bodies far apart on y-axis
		const result = sweptAABB(r16, tx(0, 0), new Vec2(200, 0), r16, tx(100, 100));
		expect(result).toBeNull();
	});

	it("leftward motion produces correct negative-x normal", () => {
		// A moving left toward B
		const result = sweptAABB(r16, tx(100, 0), new Vec2(-200, 0), r16, tx(0, 0));
		expect(result).not.toBeNull();
		expect(result?.normal.x).toBeCloseTo(-1);
		expect(result?.normal.y).toBeCloseTo(0);
	});

	it("upward motion produces correct negative-y normal", () => {
		// A moving up toward B
		const result = sweptAABB(r16, tx(0, 100), new Vec2(0, -200), r16, tx(0, 0));
		expect(result).not.toBeNull();
		expect(result?.normal.x).toBeCloseTo(0);
		expect(result?.normal.y).toBeCloseTo(-1);
	});
});

// ── Capsule-vs-Capsule: closestPointsSegments edge cases ────────

describe("SAT: Capsule-vs-Capsule (segment endpoint clamping)", () => {
	it("capsules positioned so t < 0 in closestPointsSegments", () => {
		// A vertical at (8,0): segment from (8,-5) to (8,5)
		// B horizontal (90° rotated) at origin: segment from (5,0) to (-5,0)
		// d2=(-10,0), p0=(8,-5), q0=(5,0) → rx=3, ff=d2·r=(-10)*3=-30
		// s=0.5, t=(0*0.5+(-30))/100=-0.3 < 0 → clamped to 0
		const cap = Shape.capsule(5, 20);
		const result = testOverlap(cap, tx(8, 0), cap, txr(0, 0, Math.PI / 2));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("capsules positioned so t > 1 in closestPointsSegments", () => {
		// A vertical at (-8,0): segment from (-8,-5) to (-8,5)
		// B horizontal (90° rotated) at origin: segment from (5,0) to (-5,0)
		// d2=(-10,0), p0=(-8,-5), q0=(5,0) → rx=-13, ff=(-10)*(-13)=130
		// s near 0, t=(0+130)/100=1.3 > 1 → clamped to 1
		const cap = Shape.capsule(5, 20);
		const result = testOverlap(cap, tx(-8, 0), cap, txr(0, 0, Math.PI / 2));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("degenerate capsule A (aa <= EPSILON) triggers first-segment-point branch", () => {
		// Capsule A degenerate (halfSeg=0), capsule B normal
		const degenerateCap = Shape.capsule(5, 10); // halfSeg = 10/2 - 5 = 0
		const normalCap = Shape.capsule(5, 20);
		const result = testOverlap(degenerateCap, tx(0, 0), normalCap, tx(8, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(2); // 5+5-8
	});

	it("degenerate capsule B (ee <= EPSILON) triggers second-segment-point branch", () => {
		// Capsule A normal, capsule B degenerate → ee ≈ 0
		const degenerateCap = Shape.capsule(5, 10);
		const normalCap = Shape.capsule(5, 20);
		const result = testOverlap(normalCap, tx(0, 0), degenerateCap, tx(8, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(2); // 5+5-8
	});

	it("both capsules degenerate triggers point-vs-point branch", () => {
		// Both capsules have zero-length segments → aa ≈ 0 and ee ≈ 0
		const degenerateCap = Shape.capsule(5, 10);
		const result = testOverlap(degenerateCap, tx(0, 0), degenerateCap, tx(8, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(2); // 5+5-8
	});

	it("parallel capsules trigger denom <= EPSILON fallback", () => {
		// Two vertical capsules side by side — segments are parallel
		// denom = aa*ee - bb*bb ≈ 0 for parallel segments → s = 0 fallback
		const cap = Shape.capsule(5, 20);
		const result = testOverlap(cap, tx(0, 0), cap, tx(8, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(2); // 5+5-8
	});
});

// ── Circle vs Polygon ────────────────────────────────────────────

describe("SAT: Circle vs Polygon", () => {
	const c10 = Shape.circle(10);

	it("overlapping circle and square polygon → correct depth", () => {
		// Circle at (15,0), sqPoly at origin. sqPoly edge at x=10, circle left at 5. Overlap=5
		const result = testOverlap(c10, tx(15, 0), sqPoly, tx(0, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(5);
	});

	it("non-overlapping circle and polygon → null", () => {
		const result = testOverlap(c10, tx(50, 0), sqPoly, tx(0, 0));
		expect(result).toBeNull();
	});

	it("circle overlapping polygon corner → positive depth", () => {
		// Circle near top-right corner of sqPoly
		const result = testOverlap(c10, tx(16, -16), sqPoly, tx(0, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("circle fully inside polygon → depth > 0", () => {
		const c3 = Shape.circle(3);
		const result = testOverlap(c3, tx(0, 0), sqPoly, tx(0, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("polygon (A) vs circle (B) → normal A→B", () => {
		// Polygon on left, circle on right
		const result = testOverlap(sqPoly, tx(0, 0), c10, tx(15, 0));
		expect(result).not.toBeNull();
		expect(result?.normal.x).toBeGreaterThan(0);
	});

	it("circle vs hexagon → overlap detected", () => {
		const result = testOverlap(c10, tx(25, 0), bigHex, tx(0, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});
});

// ── Capsule vs Polygon ───────────────────────────────────────────

describe("SAT: Capsule vs Polygon", () => {
	const cap = Shape.capsule(5, 20); // radius 5, height 20

	it("overlapping capsule and square polygon → positive depth", () => {
		// Capsule at (12,0), sqPoly at origin. Capsule left side at 12-5=7, sqPoly right at 10. Overlap=3
		const result = testOverlap(cap, tx(12, 0), sqPoly, tx(0, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(3);
	});

	it("non-overlapping capsule and polygon → null", () => {
		const result = testOverlap(cap, tx(50, 0), sqPoly, tx(0, 0));
		expect(result).toBeNull();
	});

	it("capsule overlapping polygon edge vertically", () => {
		// Capsule above sqPoly, overlapping top edge
		// Capsule bottom at 0 + height/2 = 10, poly top at -10
		const result = testOverlap(cap, tx(0, -17), sqPoly, tx(0, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("capsule fully inside large polygon → depth > 0", () => {
		const result = testOverlap(cap, tx(0, 0), bigHex, tx(0, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("polygon (A) vs capsule (B) → normal A→B", () => {
		const result = testOverlap(sqPoly, tx(0, 0), cap, tx(12, 0));
		expect(result).not.toBeNull();
		expect(result?.normal.x).toBeGreaterThan(0);
	});

	it("capsule vs triangle → overlap detected", () => {
		const result = testOverlap(cap, tx(10, 0), smallTri, tx(0, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});
});

// ── Rect vs Rect (scaled) ───────────────────────────────────────

describe("SAT: Rect vs Rect (scaled)", () => {
	const r16 = Shape.rect(16, 16);

	it("uniformly scaled rect vs unscaled → uses generalSAT", () => {
		// 2x scaled: effective 32×32. At distance 20, should overlap.
		const result = testOverlap(r16, txs(0, 0, 2, 2), r16, tx(20, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("scaled rect no overlap → null", () => {
		const result = testOverlap(r16, txs(0, 0, 2, 2), r16, tx(50, 0));
		expect(result).toBeNull();
	});

	it("both rects scaled → correct overlap", () => {
		// A: 2x → 32×32, B: 1.5x → 24×24, distance 20
		// Half widths: 16 + 12 = 28 > 20, overlap = 8
		const result = testOverlap(r16, txs(0, 0, 2, 2), r16, txs(20, 0, 1.5, 1.5));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeCloseTo(8, 0);
	});

	it("non-uniform scale on rect → correct collision", () => {
		// Scale X by 3 → 48 wide, scale Y by 1 → 16 tall
		const result = testOverlap(r16, txs(0, 0, 3, 1), r16, tx(30, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});
});

// ── Rect vs Circle (scaled/rotated) ─────────────────────────────

describe("SAT: Rect vs Circle (scaled/rotated)", () => {
	const r16 = Shape.rect(16, 16);
	const c10 = Shape.circle(10);

	it("scaled rect vs circle → uses generalSAT fallback", () => {
		// Scaled rect is no longer translation-only, falls through to generalSAT
		const result = testOverlap(r16, txs(0, 0, 2, 2), c10, tx(25, 0));
		expect(result).not.toBeNull();
		// Scaled rect half-width = 16, circle edge at 15. Overlap > 0
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("rotated rect vs scaled circle → overlap", () => {
		const result = testOverlap(r16, txr(0, 0, Math.PI / 4), c10, txs(18, 0, 1.5, 1.5));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});
});

// ── Rect vs Polygon (rotated) ───────────────────────────────────

describe("SAT: Rect vs Polygon (rotated)", () => {
	const r16 = Shape.rect(16, 16);

	it("rotated rect vs polygon → overlap detected", () => {
		const result = testOverlap(r16, txr(0, 0, Math.PI / 6), sqPoly, tx(15, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("rotated polygon vs rect → overlap detected", () => {
		const result = testOverlap(r16, tx(0, 0), sqPoly, txr(15, 0, Math.PI / 4));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});
});

// ── Circle vs Capsule (rotated) ─────────────────────────────────

describe("SAT: Circle vs Capsule (rotated)", () => {
	const c10 = Shape.circle(10);
	const cap = Shape.capsule(5, 20);

	it("circle vs horizontally-rotated capsule → overlap", () => {
		// Rotating capsule 90° makes it horizontal (extends along X)
		const result = testOverlap(c10, tx(0, 0), cap, txr(12, 0, Math.PI / 2));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("circle vs 45°-rotated capsule → overlap", () => {
		const result = testOverlap(c10, tx(0, 0), cap, txr(10, 0, Math.PI / 4));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});
});

// ── Capsule vs Capsule (rotated) ────────────────────────────────

describe("SAT: Capsule vs Capsule (rotated)", () => {
	const cap = Shape.capsule(5, 20);

	it("cross-shaped capsules (90° rotated) → overlap at center", () => {
		// One vertical, one horizontal, both at origin
		const result = testOverlap(cap, tx(0, 0), cap, txr(0, 0, Math.PI / 2));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("45°-angled capsules nearby → overlap", () => {
		const result = testOverlap(cap, txr(0, 0, Math.PI / 4), cap, txr(7, 0, -Math.PI / 4));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("parallel rotated capsules far apart → null", () => {
		const result = testOverlap(cap, txr(0, 0, Math.PI / 4), cap, txr(50, 50, Math.PI / 4));
		expect(result).toBeNull();
	});
});

// ── Polygon vs Polygon (rotated) ────────────────────────────────

describe("SAT: Polygon vs Polygon (rotated)", () => {
	it("rotated square polygon vs unrotated → overlap", () => {
		const result = testOverlap(sqPoly, txr(0, 0, Math.PI / 4), sqPoly, tx(16, 0));
		// 45° rotation extends square diagonal, so overlaps at distance 16
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("two rotated triangles → overlap", () => {
		const result = testOverlap(smallTri, txr(0, 0, Math.PI / 6), smallTri, txr(8, 0, -Math.PI / 6));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("rotated hexagon vs triangle → separation when far apart", () => {
		const result = testOverlap(bigHex, txr(0, 0, Math.PI / 3), smallTri, tx(50, 0));
		expect(result).toBeNull();
	});
});

// ── Non-uniform scale ───────────────────────────────────────────

describe("SAT: Non-uniform scale", () => {
	it("non-uniform scaled circle uses max scale for radius", () => {
		const c10 = Shape.circle(10);
		// Scale X=2, Y=1 → effective radius = 20 (max)
		const result = testOverlap(c10, txs(0, 0, 2, 1), c10, tx(25, 0));
		expect(result).not.toBeNull();
		// 20 + 10 - 25 = 5
		expect(result?.depth).toBeCloseTo(5);
	});

	it("non-uniform scaled rect → generalSAT fallback", () => {
		const r16 = Shape.rect(16, 16);
		// Scale X=3 → effective width = 48, Y=1 → height = 16
		// At distance 30, half-widths: 24 + 8 = 32 > 30, should overlap
		const result = testOverlap(r16, txs(0, 0, 3, 1), r16, tx(30, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("non-uniform scaled capsule vs circle → overlap", () => {
		const cap = Shape.capsule(5, 20);
		const c10 = Shape.circle(10);
		// Scale capsule X=2, Y=1 → effective radius = 10
		const result = testOverlap(cap, txs(0, 0, 2, 1), c10, tx(15, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});
});

// ── Composed transforms (translate + rotate + scale) ────────────

describe("SAT: Composed transforms", () => {
	it("translated + rotated + scaled rect vs rect → overlap", () => {
		const r16 = Shape.rect(16, 16);
		// Scale 1.5x + rotate 30° + translate to (10,0)
		const result = testOverlap(r16, txrs(10, 0, Math.PI / 6, 1.5, 1.5), r16, tx(25, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("composed transform on circle vs polygon → overlap", () => {
		const c5 = Shape.circle(5);
		// Scale 2x + rotate 45° + translate to (5,5)
		const result = testOverlap(c5, txrs(5, 5, Math.PI / 4, 2, 2), sqPoly, tx(15, 5));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("composed transform on capsule vs rect → overlap", () => {
		const cap = Shape.capsule(5, 20);
		const r16 = Shape.rect(16, 16);
		const result = testOverlap(cap, txrs(0, 0, Math.PI / 3, 1.5, 1.5), r16, tx(18, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});
});

// ── Argument order swap (normal reversal) ────────────────────────

describe("SAT: Argument order swap", () => {
	const r16 = Shape.rect(16, 16);
	const cap = Shape.capsule(5, 20);
	const c10 = Shape.circle(10);

	it("Rect×Capsule vs Capsule×Rect → flipped normal", () => {
		const ab = testOverlap(r16, tx(0, 0), cap, tx(12, 0));
		const ba = testOverlap(cap, tx(12, 0), r16, tx(0, 0));
		expect(ab).not.toBeNull();
		expect(ba).not.toBeNull();
		expect(ab?.normal.x).toBeCloseTo(-ba?.normal.x, 3);
		expect(ab?.normal.y).toBeCloseTo(-ba?.normal.y, 3);
		expect(ab?.depth).toBeCloseTo(ba?.depth, 3);
	});

	it("Rect×Polygon vs Polygon×Rect → flipped normal", () => {
		const ab = testOverlap(r16, tx(0, 0), sqPoly, tx(12, 0));
		const ba = testOverlap(sqPoly, tx(12, 0), r16, tx(0, 0));
		expect(ab).not.toBeNull();
		expect(ba).not.toBeNull();
		expect(ab?.normal.x).toBeCloseTo(-ba?.normal.x, 3);
		expect(ab?.normal.y).toBeCloseTo(-ba?.normal.y, 3);
		expect(ab?.depth).toBeCloseTo(ba?.depth, 3);
	});

	it("Circle×Capsule vs Capsule×Circle → flipped normal", () => {
		const ab = testOverlap(c10, tx(0, 0), cap, tx(12, 0));
		const ba = testOverlap(cap, tx(12, 0), c10, tx(0, 0));
		expect(ab).not.toBeNull();
		expect(ba).not.toBeNull();
		expect(ab?.normal.x).toBeCloseTo(-ba?.normal.x, 3);
		expect(ab?.normal.y).toBeCloseTo(-ba?.normal.y, 3);
		expect(ab?.depth).toBeCloseTo(ba?.depth, 3);
	});

	it("Circle×Polygon vs Polygon×Circle → flipped normal", () => {
		const ab = testOverlap(c10, tx(0, 0), sqPoly, tx(15, 0));
		const ba = testOverlap(sqPoly, tx(15, 0), c10, tx(0, 0));
		expect(ab).not.toBeNull();
		expect(ba).not.toBeNull();
		expect(ab?.normal.x).toBeCloseTo(-ba?.normal.x, 3);
		expect(ab?.normal.y).toBeCloseTo(-ba?.normal.y, 3);
		expect(ab?.depth).toBeCloseTo(ba?.depth, 3);
	});
});

// ── Full containment ─────────────────────────────────────────────

describe("SAT: Full containment", () => {
	it("small circle inside large circle → correct depth", () => {
		const c3 = Shape.circle(3);
		const c20 = Shape.circle(20);
		const result = testOverlap(c3, tx(0, 0), c20, tx(0, 0));
		expect(result).not.toBeNull();
		// 3 + 20 = 23
		expect(result?.depth).toBeCloseTo(23);
	});

	it("small polygon inside large polygon → positive depth", () => {
		const result = testOverlap(smallTri, tx(0, 0), bigHex, tx(0, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});

	it("small capsule inside large rect → positive depth", () => {
		const cap = Shape.capsule(3, 10);
		const bigRect = Shape.rect(100, 100);
		const result = testOverlap(cap, tx(0, 0), bigRect, tx(0, 0));
		expect(result).not.toBeNull();
		expect(result?.depth).toBeGreaterThan(0);
	});
});

// ── Swept: findTOI (extended) ───────────────────────────────────

describe("Swept: findTOI (extended)", () => {
	const c10 = Shape.circle(10);
	const r16 = Shape.rect(16, 16);
	const cap = Shape.capsule(5, 20);

	it("circle moving into rect → toi in (0,1)", () => {
		// Circle at x=0 moves right 50. Rect at x=40.
		// Contact: circle right edge at 0+10+motion*t = rect left (40-8)=32
		// 10 + 50*t = 32 → t ≈ 0.44
		const result = findTOI(c10, tx(0, 0), new Vec2(50, 0), r16, tx(40, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeGreaterThan(0);
		expect(result?.toi).toBeLessThan(1);
	});

	it("capsule moving into rect → toi in (0,1)", () => {
		// Capsule at x=0 moves right 50. Rect at x=40.
		const result = findTOI(cap, tx(0, 0), new Vec2(50, 0), r16, tx(40, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeGreaterThan(0);
		expect(result?.toi).toBeLessThan(1);
	});

	it("polygon moving into rect → toi in (0,1)", () => {
		// sqPoly (20×20) at x=0 moves right 50. Rect (16×16) at x=40.
		// At t=1: poly center at 50, range [40,60] overlaps rect range [32,48].
		// Contact at t ≈ 22/50 = 0.44
		const result = findTOI(sqPoly, tx(0, 0), new Vec2(50, 0), r16, tx(40, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeGreaterThan(0);
		expect(result?.toi).toBeLessThan(1);
	});

	it("capsule moving into circle → toi in (0,1)", () => {
		const result = findTOI(cap, tx(0, 0), new Vec2(50, 0), c10, tx(50, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeGreaterThan(0);
		expect(result?.toi).toBeLessThan(1);
	});

	it("circle moving into polygon → toi in (0,1)", () => {
		const result = findTOI(c10, tx(0, 0), new Vec2(50, 0), sqPoly, tx(50, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeGreaterThan(0);
		expect(result?.toi).toBeLessThan(1);
	});

	it("polygon moving into polygon → toi in (0,1)", () => {
		const result = findTOI(sqPoly, tx(0, 0), new Vec2(60, 0), sqPoly, tx(60, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeGreaterThan(0);
		expect(result?.toi).toBeLessThan(1);
	});

	it("capsule moving into capsule → toi in (0,1)", () => {
		const result = findTOI(cap, tx(0, 0), new Vec2(40, 0), cap, tx(40, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeGreaterThan(0);
		expect(result?.toi).toBeLessThan(1);
	});

	it("polygon moving into capsule → toi in (0,1)", () => {
		const result = findTOI(sqPoly, tx(0, 0), new Vec2(50, 0), cap, tx(50, 0));
		expect(result).not.toBeNull();
		expect(result?.toi).toBeGreaterThan(0);
		expect(result?.toi).toBeLessThan(1);
	});
});

// ── Normal direction (general cases) ─────────────────────────────

describe("SAT: Normal direction (general)", () => {
	it("capsule pair: normal points from A toward B", () => {
		const cap = Shape.capsule(5, 20);
		// B is to the right
		const result = testOverlap(cap, tx(0, 0), cap, tx(8, 0));
		expect(result).not.toBeNull();
		expect(result?.normal.x).toBeGreaterThan(0);

		// B is to the left
		const result2 = testOverlap(cap, tx(0, 0), cap, tx(-8, 0));
		expect(result2).not.toBeNull();
		expect(result2?.normal.x).toBeLessThan(0);
	});

	it("polygon pair: normal points from A toward B", () => {
		// B is to the right
		const result = testOverlap(sqPoly, tx(0, 0), sqPoly, tx(15, 0));
		expect(result).not.toBeNull();
		expect(result?.normal.x).toBeGreaterThan(0);

		// B is above
		const result2 = testOverlap(sqPoly, tx(0, 0), sqPoly, tx(0, -15));
		expect(result2).not.toBeNull();
		expect(result2?.normal.y).toBeLessThan(0);
	});
});
