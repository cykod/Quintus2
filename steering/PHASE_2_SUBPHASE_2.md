# Phase 2, Subphase 2: Collision Detection

> **Steps 3–4** | **Duration:** ~3 days
> **Depends on:** Subphase 1 (Shape2D, CollisionInfo types)
> **Produces:** SpatialHash (broad phase), SAT (narrow phase), swept collision detection — all with tests.

**Reference:** [PHASE_2_DESIGN_CORE.md](./PHASE_2_DESIGN_CORE.md) for architecture overview and cross-cutting concerns.

---

## Step 3: Spatial Hash (1 day)

Grid-based spatial indexing for broad-phase collision detection. Reduces O(n²) pair checks to O(n × k) where k is the average number of neighbors per cell.

**File:** `packages/physics/src/spatial-hash.ts`

```typescript
import type { AABB } from "@quintus/math";
import type { CollisionObject } from "./collision-object.js";

export class SpatialHash {
  /** Cell size in pixels. Larger = fewer cells but more candidates per query. */
  readonly cellSize: number;

  /** Map from cell key to set of bodies in that cell. */
  private readonly cells: Map<number, Set<CollisionObject>>;

  /** Reverse lookup: body → set of cell keys it occupies. */
  private readonly bodyToCells: Map<CollisionObject, Set<number>>;

  constructor(cellSize?: number);  // Default: 64

  /** Insert a body into the grid based on its world AABB. */
  insert(body: CollisionObject): void;

  /** Remove a body from all cells. */
  remove(body: CollisionObject): void;

  /**
   * Update a body's position in the grid.
   * Removes from old cells, inserts into new cells.
   * Only re-hashes if the AABB actually changed cells.
   */
  update(body: CollisionObject): void;

  /** Query all bodies that might overlap the given AABB. */
  query(aabb: AABB): Set<CollisionObject>;

  /**
   * Query all unique pairs of bodies that share a cell.
   * Used for the global sensor overlap pass.
   */
  queryPairs(): Array<[CollisionObject, CollisionObject]>;

  /** Remove all bodies from the grid. */
  clear(): void;

  /** Number of bodies in the grid. */
  get count(): number;
}
```

### Cell Key Computation

```typescript
/** Hash a cell coordinate pair to a single number. */
private cellKey(cx: number, cy: number): number {
  // Cantor pairing function — unique key for any (cx, cy) pair
  // Handles negative coordinates via offset
  const a = cx >= 0 ? 2 * cx : -2 * cx - 1;
  const b = cy >= 0 ? 2 * cy : -2 * cy - 1;
  return ((a + b) * (a + b + 1)) / 2 + b;
}

/** Get all cell coordinates that an AABB overlaps. */
private getCells(aabb: AABB): Array<[number, number]> {
  const minCX = Math.floor(aabb.min.x / this.cellSize);
  const minCY = Math.floor(aabb.min.y / this.cellSize);
  const maxCX = Math.floor(aabb.max.x / this.cellSize);
  const maxCY = Math.floor(aabb.max.y / this.cellSize);

  const cells: Array<[number, number]> = [];
  for (let cx = minCX; cx <= maxCX; cx++) {
    for (let cy = minCY; cy <= maxCY; cy++) {
      cells.push([cx, cy]);
    }
  }
  return cells;
}
```

### Design Decisions

- **Hash map, not a fixed-size 2D array.** Supports infinite world coordinates and only allocates for occupied cells.
- **Cell size default: 64px.** Good for tile-based games with 16-32px tiles. Users can tune via `PhysicsPlugin({ cellSize: 128 })`.
- **`update()` is smart.** Only re-hashes if the body's AABB changed cells since last insert. Static bodies → no-op after initial insertion.
- **`queryPairs()` for sensor overlap.** Generate all unique cell-sharing pairs in a single pass. Deduplicate using a `Set<string>` of sorted ID pairs.
- **Cantor pairing for cell keys.** Single number key avoids string concatenation overhead.

### Performance Characteristics

- `insert()`: O(cells covered) — typically 1-4 for normal bodies
- `remove()`: O(cells covered)
- `update()`: O(cells covered) when moved, O(1) when stationary
- `query(aabb)`: O(cells overlapped × bodies per cell)
- `queryPairs()`: O(total cells × bodies per cell²)

**Expected throughput:** 1000+ static colliders with 50 dynamic actors at 60fps on a modern browser.

### Test Plan: spatial-hash.test.ts

- Insert body → queryable in correct cells
- Remove body → no longer returned by queries
- Update body after move → found in new cells, not in old cells
- Query with AABB returns all overlapping bodies
- Query returns empty set for empty regions
- `queryPairs()` returns all cell-sharing pairs (no duplicates)
- Bodies spanning multiple cells are found from any cell
- Large body spanning many cells works correctly
- 1000 bodies insert + query performs within budget (benchmark test)

---

## Step 4: SAT + Swept Collision (2 days)

### 4.1 SAT (Separating Axis Theorem)

Narrow-phase collision detection. Tests overlap between all shape pair combinations and returns penetration depth + normal.

**File:** `packages/physics/src/sat.ts`

```typescript
import type { Matrix2D, Vec2 } from "@quintus/math";
import type { Shape2D } from "./shapes.js";

/** Result of a SAT overlap test. */
export interface SATResult {
  /** Whether the shapes overlap. */
  readonly overlapping: boolean;
  /** Minimum translation vector normal (direction to separate). */
  readonly normal: Vec2;
  /** Penetration depth along the normal. */
  readonly depth: number;
}

/**
 * Test overlap between two shapes with given world-space transforms.
 * Returns null if no overlap.
 */
export function testOverlap(
  shapeA: Shape2D, transformA: Matrix2D,
  shapeB: Shape2D, transformB: Matrix2D,
): SATResult | null;
```

### Shape Pair Dispatch

The dispatcher checks for fast-path opportunities using `isTranslationOnly()`:

```typescript
export function testOverlap(
  shapeA: Shape2D, transformA: Matrix2D,
  shapeB: Shape2D, transformB: Matrix2D,
): SATResult | null {
  const a = shapeA.type;
  const b = shapeB.type;
  const bothAxisAligned = transformA.isTranslationOnly() && transformB.isTranslationOnly();

  // Fast path: axis-aligned rect vs rect (most common in platformers)
  // Inline getTranslation() — access .e/.f directly instead of allocating Vec2
  if (a === "rect" && b === "rect" && bothAxisAligned) {
    return rectVsRect(shapeA, transformA.e, transformA.f, shapeB, transformB.e, transformB.f);
  }

  // Circle vs circle: rotation-invariant, only need centers + scaled radii
  // Inline getTranslation() and getScale() — access matrix elements directly
  if (a === "circle" && b === "circle") {
    return circleVsCircle(shapeA, transformA, shapeB, transformB);
  }

  // Fast path: axis-aligned rect vs circle
  if (a === "rect" && b === "circle" && transformA.isTranslationOnly()) {
    return rectVsCircle(shapeA, transformA.e, transformA.f, shapeB, transformB.e, transformB.f);
  }
  if (a === "circle" && b === "rect" && transformB.isTranslationOnly()) {
    return flip(rectVsCircle(shapeB, transformB.e, transformB.f, shapeA, transformA.e, transformA.f));
  }

  // General case: full SAT with transformed vertices/axes
  return generalSAT(shapeA, transformA, shapeB, transformB);
}
```

### SAT Helper Functions

SAT functions operate on pool temporaries (`{ x: number; y: number }`) returned by `Vec2Pool`, not full `Vec2` instances. `Vec2` methods like `.dot()`, `.normalize()`, etc. are NOT available on pool temporaries. Use standalone helper functions instead:

```typescript
/** Dot product of two {x, y} objects. */
function dot(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return a.x * b.x + a.y * b.y;
}

/** 2D cross product (scalar). */
function cross(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return a.x * b.y - a.y * b.x;
}

/** Squared length. */
function lengthSq(v: { x: number; y: number }): number {
  return v.x * v.x + v.y * v.y;
}

/** Normalize into a pool temporary. */
function normalize(v: { x: number; y: number }, pool: Vec2Pool): { x: number; y: number } {
  const len = Math.sqrt(lengthSq(v));
  return len > EPSILON ? pool.get(v.x / len, v.y / len) : pool.get(0, 0);
}

/** Perpendicular (90° CCW) into a pool temporary. */
function perp(v: { x: number; y: number }, pool: Vec2Pool): { x: number; y: number } {
  return pool.get(-v.y, v.x);
}
```

These accept `{ x: number; y: number }` — the structural type that both `Vec2` and `Vec2Pool` temporaries satisfy.

### Core Algorithms

#### Rect vs Rect (AABB overlap)

The simplest and most common case in platformers. No rotation → only 2 axes (X and Y).

```typescript
function rectVsRect(
  a: RectShape, ax: number, ay: number,
  b: RectShape, bx: number, by: number,
): SATResult | null {
  const dx = bx - ax;
  const dy = by - ay;
  const overlapX = (a.width + b.width) / 2 - Math.abs(dx);
  const overlapY = (a.height + b.height) / 2 - Math.abs(dy);

  if (overlapX <= 0 || overlapY <= 0) return null;

  // Minimum penetration axis
  if (overlapX < overlapY) {
    return {
      overlapping: true,
      normal: new Vec2(dx > 0 ? -1 : 1, 0),
      depth: overlapX,
    };
  }
  return {
    overlapping: true,
    normal: new Vec2(0, dy > 0 ? -1 : 1),
    depth: overlapY,
  };
}
```

#### Circle vs Circle

Rotation-invariant — only need centers and scaled radii. Non-uniform scale uses `max(|scaleX|, |scaleY|) * radius`.

```typescript
function circleVsCircle(
  a: CircleShape, transformA: Matrix2D,
  b: CircleShape, transformB: Matrix2D,
): SATResult | null {
  // Inline getTranslation() — access .e/.f directly
  const ax = transformA.e, ay = transformA.f;
  const bx = transformB.e, by = transformB.f;
  // Inline getScale() — sx = sqrt(a*a + b*b), no Vec2 allocation
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
    // Overlapping at same center — push apart arbitrarily
    return { overlapping: true, normal: Vec2.UP, depth: radiiSum };
  }

  return {
    overlapping: true,
    normal: new Vec2(dx / dist, dy / dist),
    depth: radiiSum - dist,
  };
}
```

#### Rect vs Circle

```typescript
function rectVsCircle(
  rect: RectShape, rx: number, ry: number,
  circle: CircleShape, cx: number, cy: number,
): SATResult | null {
  // Find closest point on rect to circle center
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  const relX = cx - rx;
  const relY = cy - ry;
  const closestX = clamp(relX, -halfW, halfW);
  const closestY = clamp(relY, -halfH, halfH);

  const dx = relX - closestX;
  const dy = relY - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= circle.radius * circle.radius) return null;

  // Circle center is inside rect
  if (distSq < EPSILON) {
    const overlapX = halfW - Math.abs(relX) + circle.radius;
    const overlapY = halfH - Math.abs(relY) + circle.radius;
    if (overlapX < overlapY) {
      return {
        overlapping: true,
        normal: new Vec2(relX > 0 ? -1 : 1, 0),
        depth: overlapX,
      };
    }
    return {
      overlapping: true,
      normal: new Vec2(0, relY > 0 ? -1 : 1),
      depth: overlapY,
    };
  }

  const dist = Math.sqrt(distSq);
  return {
    overlapping: true,
    normal: new Vec2(dx / dist, dy / dist),
    depth: circle.radius - dist,
  };
}
```

#### General SAT (transform-aware)

This is the general-case handler for any shape pair involving rotation, capsules, or polygons. It replaces the old `polygonSAT` and `capsuleDispatch` functions. All shapes' geometry is transformed to world space using their `Matrix2D` transforms.

```typescript
function generalSAT(
  shapeA: Shape2D, transformA: Matrix2D,
  shapeB: Shape2D, transformB: Matrix2D,
): SATResult | null {
  // 1. Get world-space vertices
  const vertsA = getWorldVertices(shapeA, transformA);
  const vertsB = getWorldVertices(shapeB, transformB);

  // 2. Get separation axes
  const axes = getSeparationAxes(shapeA, transformA, vertsA, shapeB, transformB, vertsB);

  let minDepth = Infinity;
  let minNormal = Vec2.ZERO;

  // 3. Standard SAT: project both shapes onto each axis
  for (const axis of axes) {
    const projA = projectShape(shapeA, transformA, vertsA, axis);
    const projB = projectShape(shapeB, transformB, vertsB, axis);
    const overlap = Math.min(projA.max - projB.min, projB.max - projA.min);

    if (overlap <= 0) return null; // Separating axis found

    if (overlap < minDepth) {
      minDepth = overlap;
      minNormal = axis;
    }
  }

  // 4. Ensure normal points from A to B
  const centerA = transformA.getTranslation();
  const centerB = transformB.getTranslation();
  const dir = centerB.sub(centerA);
  if (dir.dot(minNormal) < 0) minNormal = minNormal.negate();

  return { overlapping: true, normal: minNormal, depth: minDepth };
}
```

**`getWorldVertices(shape, transform)` — transforms local geometry to world space:**
- **Rect:** 4 corners at `(±w/2, ±h/2)`, each transformed by `transform.transformPoint()`
- **Circle:** No vertices (handled via projection: center ± radius onto each axis)
- **Capsule:** Two cap centers at `(0, ±(height/2 - radius))`, transformed by `transform.transformPoint()`. Used as line segment; radius handled as expansion during projection.
- **Polygon:** Each vertex transformed by `transform.transformPoint()`

**`getSeparationAxes` — collects axes to test:**
- For rect/polygon: edge normals computed from world-space vertices
- For capsule: transform's basis vectors (via `basisX()`/`basisY()`) + segment-to-point axes (capsule segment endpoint to nearest vertex of other shape)
- For circle: axis from circle center to nearest vertex of other shape

**`projectShape` — projects a shape onto an axis:**
- For shapes with vertices: standard min/max dot product of vertices onto axis
- For circles: project center ± scaled radius
- For capsules: project segment endpoints, then expand by ± scaled radius

**Key insight for capsules:** A capsule's central line segment in local space is vertical: `(0, -halfSegment)` to `(0, +halfSegment)` where `halfSegment = height/2 - radius`. When the transform includes rotation, these endpoints rotate naturally via `transformPoint()`. The capsule-vs-X algorithms (closest point on segment + radius expansion) work identically regardless of segment orientation.

### Design Decisions

- **Transform-based API.** All SAT functions take `(shape, transform: Matrix2D)` pairs. Shapes store local geometry; the transform handles position, rotation, and scale. This matches Godot's approach.
- **World-space SAT.** Vertices and axes are transformed to world space before testing. Simpler than converting to one shape's local space.
- **Specialized fast paths for common unrotated pairs.** `isTranslationOnly()` enables rect-vs-rect (2 axes, not full SAT) and rect-vs-circle fast paths with zero overhead for the unrotated case. These are the hot paths in platformers (~90% of collisions are axis-aligned rects).
- **Normal always points from shape A to shape B.** Convention ensures consistency.
- **`flip()` helper** reverses the normal when argument order is swapped in dispatch.
- **No GJK/EPA.** SAT is simpler, faster for convex 2D shapes, and produces the exact penetration vector directly.
- **Non-uniform scale on circles/capsules.** Uses `max(|scaleX|, |scaleY|) * radius` for effective radius. Non-uniform scale produces approximate results (same as Godot's limitation).

---

### 4.2 Swept Collision Detection

`PhysicsWorld.castMotion` needs to find the **first** collision along a motion vector, not just check overlap at the destination. This prevents tunneling.

#### Approach: Binary Search Time of Impact

For each candidate body from the broad phase:

```
castMotion(body, motion):
  1. Compute swept AABB: body's AABB expanded along motion vector
  2. Query spatial hash with swept AABB → candidates
  3. Filter candidates by collision groups: shouldCollide(mover.group, target.group)
     NOTE: This check is unidirectional — only the mover's mask is checked against
     the target's layer. If symmetric collision is desired, users must define both
     directions in their collision groups config (e.g., player→world AND world→player).
  4. For each candidate:
     a. Test overlap at motion endpoint (full motion applied)
     b. If no overlap: skip (no collision along this path)
     c. If overlap: binary search for time of impact (TOI)
  5. Return collision with smallest TOI
```

**Binary search for TOI:**

```typescript
function findTOI(
  bodyShape: Shape2D, bodyTransform: Matrix2D, motion: Vec2,
  otherShape: Shape2D, otherTransform: Matrix2D,
  maxIterations: number = 8,
): { toi: number; result: SATResult } | null {
  let lo = 0;
  let hi = 1;
  let lastOverlap: SATResult | null = null;

  // Helper: compute body transform at time t along motion.
  // Only translation changes during motion — rotation/scale are constant.
  const txAtTime = (t: number): Matrix2D => {
    return new Matrix2D(
      bodyTransform.a, bodyTransform.b,
      bodyTransform.c, bodyTransform.d,
      bodyTransform.e + motion.x * t,
      bodyTransform.f + motion.y * t,
    );
  };

  // First check: is there overlap at full motion?
  const endTx = txAtTime(1);
  const endResult = testOverlap(bodyShape, endTx, otherShape, otherTransform);
  if (!endResult) return null; // No collision along this path

  // Check start position: already overlapping?
  const startResult = testOverlap(bodyShape, bodyTransform, otherShape, otherTransform);
  if (startResult) {
    // Already overlapping — return immediate collision
    return { toi: 0, result: startResult };
  }

  // Binary search between 0 and 1
  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    const midTx = txAtTime(mid);
    const midResult = testOverlap(bodyShape, midTx, otherShape, otherTransform);

    if (midResult) {
      hi = mid;
      lastOverlap = midResult;
    } else {
      lo = mid;
    }
  }

  return lastOverlap ? { toi: lo, result: lastOverlap } : null;
}
```

**Important design decision:** During a single `move()` call, only translation changes. Rotation and scale are constant for the duration of the motion cast. This matches Godot and greatly simplifies swept collision (no angular interpolation needed).

**The result is a safe travel distance:**
- `travel = motion * toi` — move this far without penetrating
- `remainder = motion * (1 - toi)` — the leftover motion for sliding
- The SAT result at `toi` gives the collision normal

**Why binary search instead of analytical sweep?**
- **Works for ANY shape pair.** Uses the same overlap test we already have.
- **Bounded cost.** 8 iterations = 8 overlap tests per candidate.
- **Correct normals.** SAT at contact position gives accurate collision normal.
- **Can be optimized later** for the rect-vs-rect hot path (§4.3).

### 4.3 Analytical Swept AABB (rect-vs-rect fast path)

The most common pair in platformers. Avoids binary search entirely. Only used when both transforms are translation-only (no rotation/scale):

```typescript
function sweptAABB(
  a: RectShape, aTransform: Matrix2D, motion: Vec2,
  b: RectShape, bTransform: Matrix2D,
): { toi: number; normal: Vec2 } | null {
  // Only used when both transforms are translation-only
  const aCenter = aTransform.getTranslation();
  const bCenter = bTransform.getTranslation();
  const dx = bCenter.x - aCenter.x;
  const dy = bCenter.y - aCenter.y;
  const combinedHalfW = (a.width + b.width) / 2;
  const combinedHalfH = (a.height + b.height) / 2;

  let xEntry: number, xExit: number;
  let yEntry: number, yExit: number;

  if (motion.x > 0) {
    xEntry = dx - combinedHalfW;
    xExit = dx + combinedHalfW;
  } else if (motion.x < 0) {
    xEntry = dx + combinedHalfW;
    xExit = dx - combinedHalfW;
  } else {
    xEntry = Math.abs(dx) < combinedHalfW ? -Infinity : Infinity;
    xExit = Math.abs(dx) < combinedHalfW ? Infinity : -Infinity;
  }

  if (motion.y > 0) {
    yEntry = dy - combinedHalfH;
    yExit = dy + combinedHalfH;
  } else if (motion.y < 0) {
    yEntry = dy + combinedHalfH;
    yExit = dy - combinedHalfH;
  } else {
    yEntry = Math.abs(dy) < combinedHalfH ? -Infinity : Infinity;
    yExit = Math.abs(dy) < combinedHalfH ? Infinity : -Infinity;
  }

  const txEntry = motion.x !== 0 ? xEntry / motion.x : (xEntry < 0 ? -Infinity : Infinity);
  const txExit = motion.x !== 0 ? xExit / motion.x : (xEntry < 0 ? Infinity : -Infinity);
  const tyEntry = motion.y !== 0 ? yEntry / motion.y : (yEntry < 0 ? -Infinity : Infinity);
  const tyExit = motion.y !== 0 ? yExit / motion.y : (yEntry < 0 ? Infinity : -Infinity);

  const tEntry = Math.max(txEntry, tyEntry);
  const tExit = Math.min(txExit, tyExit);

  if (tEntry > tExit || tEntry > 1 || tExit < 0) return null;
  if (tEntry < 0) return null; // Already overlapping (handled separately)

  let normal: Vec2;
  if (txEntry > tyEntry) {
    normal = motion.x > 0 ? new Vec2(-1, 0) : new Vec2(1, 0);
  } else {
    normal = motion.y > 0 ? new Vec2(0, -1) : new Vec2(0, 1);
  }

  return { toi: tEntry, normal };
}
```

Used as fast path in `castMotion` when both shapes are rects and both transforms are translation-only. Falls through to binary search for other pairs or when rotation is involved.

---

## Test Plan: sat.test.ts

**Rect vs Rect:**
- Overlapping rectangles → correct depth, normal
- Touching rectangles (edge-to-edge) → depth ≈ 0 or no overlap (epsilon)
- Non-overlapping rectangles → null
- One rect fully inside another → correct minimum separation
- Equal-sized rects at same position → stable normal

**Circle vs Circle:**
- Overlapping circles → correct depth, normal
- Touching circles → depth ≈ 0
- Non-overlapping → null
- Concentric circles → stable normal, correct depth

**Rect vs Circle:**
- Circle overlapping rect edge → normal perpendicular to edge
- Circle overlapping rect corner → normal along corner-to-center
- Circle inside rect → correct separation axis
- Circle outside rect → null

**General SAT (transform-aware):**
- Capsule vs rect → correct collision and normal
- Capsule vs circle → correct collision
- Capsule vs capsule → correct collision
- Triangle vs triangle → correct overlap
- Pentagon vs rect → correct overlap
- No overlap → null
- Adjacent polygons (sharing edge) → correct behavior
- Rotated rect vs rect → correct overlap and normal via generalSAT
- Rotated rect vs circle → correct collision
- Rotated capsule (horizontal) vs rect → correct collision
- 45° rotated rect AABB is larger than unrotated rect AABB

**Normal direction:**
- Normal always points from shape A toward shape B
- `flip()` correctly reverses the result

**Swept collision:**
- `findTOI` returns null for non-colliding paths
- `findTOI` returns toi=0 for already-overlapping shapes
- `findTOI` returns correct toi for motion into obstacle
- `findTOI` works with rotated shapes (rotation constant during sweep)
- `sweptAABB` matches binary search results for rect-vs-rect cases (translation-only)
- Fast-moving body detected (no tunneling through thin wall)

---

## Completion Checklist

- [ ] `SpatialHash` insert, remove, update, query, queryPairs all work
- [ ] 1000-body benchmark passes within performance budget
- [ ] SAT handles all shape pairs: rect×rect, circle×circle, rect×circle
- [ ] SAT handles capsule pairs: capsule×rect, capsule×circle, capsule×capsule
- [ ] Polygon SAT works for arbitrary convex polygons
- [ ] `findTOI` binary search works for all shape pairs
- [ ] `sweptAABB` analytical fast path works for rect×rect
- [ ] Normal conventions are consistent (A→B direction)
- [ ] All tests pass, `pnpm build` succeeds
