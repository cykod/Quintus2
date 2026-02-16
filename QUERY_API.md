# Scene Query API — Detailed Design

> **Goal:** Give actors and game logic a rich, composable API to query the physics world — raycasting, point/area queries, shape casts, and gameplay convenience methods (edge detection, line-of-sight).
> **Outcome:** Enemies can patrol platforms and reverse at edges, raycasts enable line-of-sight checks and projectile targeting, and area queries power proximity mechanics — all without manual spatial math.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Raycast primitives | Pending |
| 2 | Point & area queries | Pending |
| 3 | Shape cast | Pending |
| 4 | Actor convenience methods | Pending |
| 5 | TileMap grid raycast (DDA) | Pending |

---

## Overview

The scene query API extends `PhysicsWorld` with spatial queries that don't require a body reference. Today you can ask "what does this body collide with?" (`castMotion`, `testOverlap`). After this work you can ask "what's at this point?", "what does this ray hit?", and "is there a floor edge ahead of this actor?".

### Design Principles

1. **Queries don't modify state** — all methods are pure reads, no side effects.
2. **Composable filtering** — a single `QueryOptions` type works across all query methods.
3. **Fast by default** — all queries go through the spatial hash broad phase first.
4. **Convenience builds on primitives** — `Actor.isEdgeAhead()` is sugar over two raycasts. Users can compose their own helpers from the same primitives.

### Where Queries Live

```
PhysicsWorld        — all primitives (raycast, queryPoint, queryRect, etc.)
  └ Actor           — convenience methods (this.raycast(), isEdgeAhead(), hasLineOfSight())
  └ TileMap         — grid raycast via DDA (no physics shapes needed)
```

---

## Shared Types

These types are used across all query methods. They live in `packages/physics/src/query-types.ts`.

```typescript
import type { Vec2 } from "@quintus/math";
import type { CollisionObject } from "./collision-object.js";
import type { CollisionShape } from "./collision-shape.js";

/**
 * Options for filtering query results. All fields are optional.
 * When multiple filters are specified, they are AND-ed together.
 */
export interface QueryOptions {
	/**
	 * Only include bodies whose collisionGroup is in this list.
	 * This is an OR match — the body's single group must appear in the array.
	 * For AND-style multi-category filtering, use `tags` instead.
	 */
	groups?: string[];
	/** Exclude bodies in these collision groups. */
	excludeGroups?: string[];
	/** Only include bodies that have ALL of these tags (AND match). */
	tags?: string[];
	/** Exclude these specific body instances. */
	exclude?: CollisionObject[];
	/** Include sensors in results. Default: false. */
	includeSensors?: boolean;
	/** Custom predicate. Return false to exclude a body. */
	filter?: (body: CollisionObject) => boolean;
	/** Stop collecting after this many results. Useful for "find any one" queries. */
	maxResults?: number;
}

/**
 * Result of a raycast query.
 */
export interface RaycastHit {
	/** The body that was hit. */
	collider: CollisionObject;
	/** The specific CollisionShape on the body that was hit. */
	colliderShape: CollisionShape;
	/** World-space point where the ray intersects the shape. */
	point: Vec2;
	/** Surface normal at the hit point (points away from the surface toward the ray origin). */
	normal: Vec2;
	/** Distance from ray origin to the hit point. */
	distance: number;
}
```

---

## Phase 1: Raycast Primitives

Add ray-vs-shape intersection to the SAT module and expose `raycast()` / `raycastAll()` on `PhysicsWorld`.

### Ray-Shape Intersection (`packages/physics/src/ray.ts`)

New file. Pure geometry functions, no physics world dependency.

```typescript
import type { Matrix2D, Vec2 } from "@quintus/math";
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
 * This matches Godot/Box2D behavior — callers use QueryOptions.exclude to skip
 * bodies they expect to overlap (e.g., the casting actor itself), and the
 * geometry layer treats "already inside" as "no hit" rather than returning a
 * degenerate t=0 result.
 */
export function rayIntersectShape(
	origin: Vec2,
	direction: Vec2,    // must be normalized
	maxT: number,       // max parametric distance
	shape: Shape2D,
	transform: Matrix2D,
): RayShapeHit | null;
```

#### Algorithm per Shape Type

**Rect (axis-aligned fast path):**
Standard ray-AABB slab intersection. Compute entry/exit t for X and Y slabs, check overlap. Normal is the axis of the entry slab.

**Rect (rotated):**
Inverse-transform the ray into the rect's local space (using `Matrix2D.inverse()`), then apply the axis-aligned algorithm. Transform the normal back to world space.

**Circle:**
Ray-circle intersection via quadratic formula. Given ray `P + tD` and circle at center `C` with radius `r`:
```
a = D·D (always 1 for normalized direction)
b = 2 * D·(P-C)
c = (P-C)·(P-C) - r²
discriminant = b² - 4ac
t = (-b - sqrt(discriminant)) / 2a   // near hit
```
Normal is `(hitPoint - C).normalize()`.

**Capsule:**
Transform ray into capsule-local space (spine along Y-axis), then decompose:
1. Ray vs the two parallel side walls at x = ±radius (slab intersection), clamped to the capsule height range `[-height/2, +height/2]`
2. Ray vs circle at each cap endpoint (center ± height/2 along spine, radius = capsule radius)
Return the earliest hit with t >= 0. Transform normal back to world space.

**Polygon:**
For each edge of the polygon, compute ray-segment intersection. Return the closest hit whose t is in range. Normal is the edge's outward normal.

### PhysicsWorld Methods

Add to `packages/physics/src/physics-world.ts`:

```typescript
/**
 * Cast a ray and return the first hit, or null.
 * Direction is automatically normalized.
 */
raycast(
	origin: Vec2,
	direction: Vec2,
	maxDistance?: number,  // default: 10000
	options?: QueryOptions,
): RaycastHit | null;

/**
 * Cast a ray and return ALL hits, sorted by distance (nearest first).
 * Direction is automatically normalized.
 */
raycastAll(
	origin: Vec2,
	direction: Vec2,
	maxDistance?: number,
	options?: QueryOptions,
): RaycastHit[];
```

#### Implementation

```
raycast(origin, direction, maxDistance, options):
  1. Normalize direction
  2. Broad phase — march through spatial hash cells along the ray:
     a. Compute the starting cell from origin
     b. Use DDA to step through hash cells along the ray direction
     c. For each cell, query hash for bodies in that cell
     d. Deduplicate candidates across cells (Set<CollisionObject>)
     e. Stop marching once the nearest confirmed hit is closer than the next cell boundary
     This avoids the degenerate case of a long diagonal ray producing a huge AABB
     that pulls most of the scene out of the spatial hash.
     Fallback: if the hash cell size is unknown or the ray is short (maxDistance < 2 * cellSize),
     use a single AABB query from origin to origin + direction * maxDistance.
  3. Filter candidates by QueryOptions (groups, tags, sensors, exclude, maxResults, custom predicate)
  4. For each candidate body:
     a. AABB rejection: does ray AABB overlap body's AABB?
     b. For each shape on the body: rayIntersectShape(origin, dir, maxT, shape, transform)
     c. Track the closest hit (smallest t)
  5. Build RaycastHit with collider, colliderShape, point, normal, distance
  6. Return closest hit or null
```

`raycastAll` is identical but collects all hits and sorts by distance.

### Filtering Logic (shared helper)

```typescript
// packages/physics/src/query-filter.ts

/**
 * Returns true if the body passes all filters in QueryOptions.
 * Used by all query methods.
 */
export function matchesQuery(
	body: CollisionObject,
	options?: QueryOptions,
): boolean {
	if (!options) return true;

	// Sensor filtering (excluded by default)
	if (body.bodyType === "sensor" && !options.includeSensors) return false;

	// Collision group filtering (OR — body's single group must be in the list)
	if (options.groups && !options.groups.includes(body.collisionGroup)) return false;
	if (options.excludeGroups?.includes(body.collisionGroup)) return false;

	// Tag filtering (AND — body must have ALL specified tags)
	if (options.tags) {
		for (const tag of options.tags) {
			if (!body.hasTag(tag)) return false;
		}
	}

	// Instance exclusion
	if (options.exclude?.includes(body)) return false;

	// Custom predicate
	if (options.filter && !options.filter(body)) return false;

	return true;
}
```

### Tests (`packages/physics/src/ray.test.ts`)

- [ ] Ray hits axis-aligned rect — correct point, normal, distance
- [ ] Ray misses rect (parallel, past end) — returns null
- [ ] Ray hits rotated rect — correct normal in world space
- [ ] Ray hits circle — near hit point and normal
- [ ] Ray origin inside circle — returns null (inside-origin rule)
- [ ] Ray origin inside rect — returns null (inside-origin rule)
- [ ] Ray hits capsule body / cap — correct hit point
- [ ] Ray hits convex polygon — correct edge normal
- [ ] Ray with maxDistance stops short — no hit beyond limit
- [ ] `raycast()` returns closest hit across multiple bodies
- [ ] `raycastAll()` returns all hits sorted by distance
- [ ] `QueryOptions.groups` filters correctly
- [ ] `QueryOptions.tags` filters correctly
- [ ] `QueryOptions.exclude` skips specified bodies
- [ ] `QueryOptions.includeSensors` controls sensor inclusion
- [ ] `QueryOptions.filter` custom predicate works
- [ ] Ray against body with multiple shapes returns closest shape hit
- [ ] Broad phase: ray doesn't test distant bodies (verify via mock/spy on shape tests)

---

## Phase 2: Point & Area Queries

Add region-based queries that find all bodies overlapping a point, rectangle, circle, or arbitrary shape.

### PhysicsWorld Methods

```typescript
/**
 * Find all bodies containing a world-space point.
 */
queryPoint(
	point: Vec2,
	options?: QueryOptions,
): CollisionObject[];

/**
 * Find all bodies overlapping an axis-aligned rectangle.
 */
queryRect(
	aabb: AABB,
	options?: QueryOptions,
): CollisionObject[];

/**
 * Find all bodies overlapping a circle.
 */
queryCircle(
	center: Vec2,
	radius: number,
	options?: QueryOptions,
): CollisionObject[];

/**
 * Find all bodies overlapping an arbitrary shape at a given transform.
 * This is the most general query — queryPoint, queryRect, queryCircle
 * are optimized specializations.
 */
queryShape(
	shape: Shape2D,
	transform: Matrix2D,
	options?: QueryOptions,
): CollisionObject[];
```

#### Implementation

All follow the same pattern:

```
1. Compute query AABB (trivial for rect/circle, use shapeAABB for arbitrary shapes)
2. Broad phase: hash.query(queryAABB)
3. Filter candidates by QueryOptions
4. Narrow phase:
   - queryPoint: point-in-shape test for each candidate shape
   - queryRect/queryCircle/queryShape: SAT testOverlap() against each candidate
5. Return matching bodies
```

### Point-in-Shape Test (`packages/physics/src/ray.ts`)

Add to the ray module (it's related geometry):

```typescript
/**
 * Test if a point is inside a shape at the given transform.
 */
export function pointInShape(
	point: Vec2,
	shape: Shape2D,
	transform: Matrix2D,
): boolean;
```

Per shape type:
- **Rect**: Inverse-transform point into local space, check `|x| <= w/2 && |y| <= h/2`
- **Circle**: `distance(point, center) <= radius` (accounting for transform scale)
- **Capsule**: Distance from point to line segment <= radius
- **Polygon**: Point-in-convex-polygon via cross product sign test (all edges same side)

### Tests (`packages/physics/src/query.test.ts`)

- [ ] `queryPoint` finds body containing the point
- [ ] `queryPoint` returns empty array for empty space
- [ ] `queryPoint` with rotated shape works correctly
- [ ] `queryRect` finds all overlapping bodies
- [ ] `queryRect` with tight AABB finds exact matches
- [ ] `queryCircle` finds bodies within radius
- [ ] `queryCircle` excludes bodies just outside radius
- [ ] `queryShape` with polygon finds overlapping bodies
- [ ] All area queries respect `QueryOptions` filters
- [ ] `queryRect` with `maxResults: 1` returns at most one body
- [ ] `queryPoint` works with circle, rect, capsule, polygon shapes
- [ ] Multiple shapes on one body — hit on any shape counts

---

## Phase 3: Shape Cast

Sweep an arbitrary shape along a motion vector and find the first collision. Generalizes `castMotion()` (which requires a body reference) to work with ad-hoc shapes.

### PhysicsWorld Method

```typescript
/**
 * Sweep a shape along a motion vector. Returns the first hit, or null.
 * Like castMotion() but doesn't require a registered body — works with
 * ad-hoc shapes for explosion radii, sweep attacks, bullet trajectories, etc.
 */
shapeCast(
	shape: Shape2D,
	transform: Matrix2D,
	motion: Vec2,
	options?: QueryOptions,
): ShapeCastHit | null;
```

```typescript
/** Result of a shape cast query. */
export interface ShapeCastHit {
	/** The body that was hit. */
	collider: CollisionObject;
	/** The specific CollisionShape on the body that was hit. */
	colliderShape: CollisionShape;
	/** Surface normal at contact. */
	normal: Vec2;
	/** Penetration depth at contact. */
	depth: number;
	/** World-space contact point. */
	point: Vec2;
	/** Motion traveled before collision. */
	travel: Vec2;
	/** Remaining motion after collision. */
	remainder: Vec2;
}
```

#### Implementation

**Prerequisite refactor:** Extract the private `_findShapePairTOI` from `PhysicsWorld` into a standalone module-level function:

```typescript
// packages/physics/src/toi.ts (or add to sat.ts)
export function findShapePairTOI(
	shapeA: Shape2D, transformA: Matrix2D, motion: Vec2,
	shapeB: Shape2D, transformB: Matrix2D,
): { t: number; normal: Vec2; depth: number } | null;
```

Both `castMotion()` and `shapeCast()` call this extracted function. Do this refactor first with tests confirming `castMotion()` behavior is unchanged before adding `shapeCast()`.

```
shapeCast(shape, transform, motion, options):
  1. Compute swept AABB from shape AABB expanded along motion
  2. Broad phase: hash.query(sweptAABB)
  3. Filter candidates by QueryOptions
  4. For each candidate, for each shape pair: findShapePairTOI()
  5. Track earliest hit, compute contact point
  6. Build ShapeCastHit
```

### Tests

- [ ] Shape cast with rect finds first collision
- [ ] Shape cast with circle sweeps correctly
- [ ] Shape cast along clear path returns null
- [ ] Shape cast respects QueryOptions filters
- [ ] Shape cast returns correct travel/remainder
- [ ] Shape cast contact point is accurate

---

## Phase 4: Actor Convenience Methods

High-level methods on `Actor` that compose the Phase 1–3 primitives into common gameplay patterns.

### Actor Methods (`packages/physics/src/actor.ts`)

First, add a merged AABB accessor to `CollisionObject` (needed by `isEdgeAhead`):

```typescript
class CollisionObject extends Node2D {
	// ... existing API ...

	/**
	 * Compute the merged world-space AABB of all child CollisionShapes.
	 * Returns null if no collision shapes are attached.
	 */
	getWorldAABB(): AABB | null;
}
```

Then add convenience methods to `Actor`:

```typescript
class Actor extends CollisionObject {
	// ... existing API ...

	/**
	 * Cast a ray from this actor's center (or a custom offset).
	 * Automatically excludes self from results.
	 *
	 * @param direction — Ray direction (auto-normalized)
	 * @param maxDistance — Maximum distance (default: 10000)
	 * @param options — Query filter options (self is always excluded)
	 */
	raycast(
		direction: Vec2,
		maxDistance?: number,
		options?: QueryOptions,
	): RaycastHit | null;

	/**
	 * Check if there is a floor edge ahead of this actor in the given direction.
	 * Used for patrol AI: walk until isEdgeAhead() returns true, then reverse.
	 *
	 * Uses getWorldAABB() to determine actor dimensions. Returns false (safe default)
	 * if no collision shapes are attached.
	 *
	 * Algorithm:
	 * 1. From the actor's bottom-front corner, cast a ray downward
	 * 2. If the ray doesn't hit floor within a threshold, there's an edge
	 *
	 * @param direction — Horizontal direction to check (required). Use Vec2.RIGHT
	 *   or Vec2.LEFT. Callers should track facing direction explicitly rather
	 *   than relying on velocity, which is unreliable at boundaries.
	 * @param probeDistance — How far ahead to check (default: half actor width + 4px)
	 * @param dropThreshold — How far down to check for floor (default: actor height)
	 */
	isEdgeAhead(
		direction: Vec2,
		probeDistance?: number,
		dropThreshold?: number,
	): boolean;

	/**
	 * Check if this actor has an unobstructed line of sight to a target position.
	 * Casts a single ray from self to target, returns true if nothing blocks it.
	 *
	 * **Limitation:** Checks center-to-center only. A tall actor peeking over a
	 * half-height wall may report "no line of sight" if its center is below the wall.
	 * Use the `originOffset` parameter to cast from a custom "eye" position, or
	 * compose multiple `world.raycast()` calls for more precise checks.
	 *
	 * @param target — World position or Node2D (uses its global position)
	 * @param options — Query filter options (self is always excluded)
	 * @param originOffset — Offset from actor's globalPosition to use as ray origin
	 *   (e.g., Vec2(0, -12) to cast from the actor's "eyes" instead of center)
	 */
	hasLineOfSight(
		target: Vec2 | Node2D,
		options?: QueryOptions,
		originOffset?: Vec2,
	): boolean;

	/**
	 * Find the nearest body matching the given options within maxDistance.
	 * Useful for targeting systems. Uses a linear scan (O(n)) — no sorting.
	 *
	 * @param maxDistance — Search radius (default: 10000)
	 * @param options — Query filter options (self is always excluded)
	 */
	findNearest(
		maxDistance?: number,
		options?: QueryOptions,
	): CollisionObject | null;
}
```

### `isEdgeAhead()` Algorithm Detail

```
isEdgeAhead(direction, probeDistance, dropThreshold):
  1. Get merged actor AABB via getWorldAABB()
     - If null (no collision shapes), return false (safe default)
  2. Normalize direction to horizontal component
  3. Compute probe origin:
     - x: actor center + (actorHalfWidth + probeDistance) * direction.x
     - y: actor bottom edge (AABB max.y)
  4. Raycast downward from probe origin, maxDistance = dropThreshold
  5. If ray hits a floor-angled surface → no edge (return false)
  6. If ray hits nothing → edge ahead (return true)
```

```
           Actor          probe
          ┌─────┐           │
          │     │           │ raycast down
          │     │           ▼
  ════════╧═════╧═══════════     ← floor ends here
                            ↕ dropThreshold
                        (no hit = edge!)
```

### `hasLineOfSight()` Algorithm Detail

```
hasLineOfSight(target, options, originOffset):
  1. Compute ray origin = this.globalPosition + (originOffset ?? Vec2.ZERO)
  2. Get target position (Vec2 directly, or node.globalPosition)
  3. Compute direction = targetPos - rayOrigin
  4. maxDistance = direction.length()
  5. Merge options with { exclude: [this] }
  6. world.raycast(rayOrigin, direction.normalize(), maxDistance, mergedOptions)
  7. Return result === null (nothing blocking the line)
```

### `findNearest()` Algorithm Detail

```
findNearest(maxDistance, options):
  1. queryCircle(this.globalPosition, maxDistance, options) — excluding self
  2. Linear scan: track candidate with smallest distance² to this.globalPosition
     (O(n) — no sort needed since we only want the minimum)
  3. Return closest, or null
```

### Tests (`packages/physics/src/actor-queries.test.ts`)

- [ ] `actor.raycast()` casts from actor center, excludes self
- [ ] `actor.raycast()` with options filters correctly
- [ ] `CollisionObject.getWorldAABB()` merges all child shape AABBs
- [ ] `CollisionObject.getWorldAABB()` returns null with no shapes
- [ ] `isEdgeAhead()` returns true at platform edge
- [ ] `isEdgeAhead()` returns false on continuous platform
- [ ] `isEdgeAhead()` returns false when actor has no collision shapes
- [ ] `isEdgeAhead()` with Vec2.LEFT checks left side
- [ ] `isEdgeAhead()` with custom probeDistance/dropThreshold
- [ ] `hasLineOfSight()` returns true when unobstructed
- [ ] `hasLineOfSight()` returns false when wall blocks view
- [ ] `hasLineOfSight()` accepts Vec2 or Node2D target
- [ ] `hasLineOfSight()` with originOffset casts from custom position
- [ ] `findNearest()` returns closest body
- [ ] `findNearest()` returns null when nothing in range
- [ ] `findNearest()` respects tag/group filters

---

## Phase 5: TileMap Grid Raycast (DDA)

Fast raycast directly against the tile grid, without going through physics shapes. Uses the DDA (Digital Differential Analyzer) algorithm to step through tiles one at a time.

This is useful when you want to query tile data (what tile type is here?) rather than collision bodies, or when you need fast line-of-sight checks against the tilemap grid without the overhead of shape intersection.

### TileMap Method (`packages/tilemap/src/tilemap.ts`)

> **Transform limitation:** `TileMap.raycast()` only supports translation transforms on the
> TileMap node. Rotation and non-uniform scale are not supported because the DDA algorithm
> assumes axis-aligned tiles. At runtime, if the TileMap's `globalTransform` has rotation or
> non-uniform scale, a warning is logged and the method returns null.

```typescript
/** Result of a tilemap grid raycast. */
export interface TileRayHit {
	/** Tile column index. */
	col: number;
	/** Tile row index. */
	row: number;
	/** Tile ID at the hit location. */
	tileId: number;
	/** World-space point where the ray enters the tile. */
	point: Vec2;
	/** Normal of the tile face that was hit (axis-aligned: left/right/top/bottom). */
	normal: Vec2;
	/** Distance from ray origin to the hit point. */
	distance: number;
}

class TileMap extends Node2D {
	// ... existing API ...

	/**
	 * Cast a ray through the tile grid using DDA traversal.
	 * Returns the first solid tile hit, or null.
	 *
	 * Only works when the TileMap has a pure translation transform (no rotation/scale).
	 * Logs a warning and returns null if the transform is not axis-aligned.
	 *
	 * @param origin — World-space ray origin
	 * @param direction — Ray direction (auto-normalized)
	 * @param maxDistance — Maximum ray length in pixels (default: 10000)
	 * @param solidCheck — Predicate to determine if a tile is "solid".
	 *   Default: tileId > 0 (any non-empty tile). Override for custom logic
	 *   (e.g. only certain tile types block vision).
	 * @param layer — Which tile layer to check (default: 0)
	 */
	raycast(
		origin: Vec2,
		direction: Vec2,
		maxDistance?: number,
		solidCheck?: (tileId: number, col: number, row: number) => boolean,
		layer?: number,
	): TileRayHit | null;
}
```

### DDA Algorithm

```
raycast(origin, direction, maxDistance, solidCheck, layer):
  1. Convert origin to tile coordinates (using worldToTile)
  2. Normalize direction
  3. Compute step direction: stepX = sign(direction.x), stepY = sign(direction.y)
  4. Compute tMax: distance to next tile boundary on each axis
  5. Compute tDelta: distance between tile boundaries on each axis
  6. Step through grid:
     while distance < maxDistance:
       if tMaxX < tMaxY:
         advance X: col += stepX, tMaxX += tDeltaX
         normal = (-stepX, 0)
       else:
         advance Y: row += stepY, tMaxY += tDeltaY
         normal = (0, -stepY)
       if tile at (col, row) passes solidCheck:
         compute exact world-space hit point
         return TileRayHit
  7. Return null (no solid tile hit)
```

DDA is O(n) in the number of tiles traversed, not the number of tiles in the map. Very fast for long-range line-of-sight checks.

### Tests (`packages/tilemap/src/tilemap-raycast.test.ts`)

- [ ] Horizontal ray hits first solid tile
- [ ] Vertical ray hits first solid tile
- [ ] Diagonal ray traverses correctly
- [ ] Ray misses (no solid tiles in path) returns null
- [ ] Ray respects maxDistance
- [ ] Hit point is on the tile boundary (not tile center)
- [ ] Normal points outward from the hit tile face
- [ ] Custom solidCheck filters specific tile types
- [ ] Ray starting inside a solid tile returns that tile at distance 0
- [ ] Works with non-zero TileMap position offset
- [ ] Returns null and warns when TileMap has rotation transform
- [ ] Returns null and warns when TileMap has non-uniform scale

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `packages/physics/src/ray.ts` | Ray-shape intersection + point-in-shape functions |
| `packages/physics/src/query-types.ts` | `QueryOptions`, `RaycastHit`, `ShapeCastHit` types |
| `packages/physics/src/query-filter.ts` | `matchesQuery()` shared filter helper |
| `packages/physics/src/ray.test.ts` | Ray intersection unit tests |
| `packages/physics/src/query.test.ts` | Point/area query tests |
| `packages/physics/src/actor-queries.test.ts` | Actor convenience method tests |
| `packages/tilemap/src/tilemap-raycast.test.ts` | TileMap DDA raycast tests |

### Modified Files

| File | Changes |
|------|---------|
| `packages/physics/src/physics-world.ts` | Add `raycast`, `raycastAll`, `queryPoint`, `queryRect`, `queryCircle`, `queryShape`, `shapeCast`; refactor `_findShapePairTOI` to use extracted `findShapePairTOI` |
| `packages/physics/src/collision-object.ts` | Add `getWorldAABB()` method (merged AABB of all child CollisionShapes) |
| `packages/physics/src/actor.ts` | Add `raycast`, `isEdgeAhead`, `hasLineOfSight`, `findNearest` |
| `packages/physics/src/index.ts` | Export new types and functions |
| `packages/tilemap/src/tilemap.ts` | Add `raycast` method and `TileRayHit` type |
| `packages/tilemap/src/index.ts` | Export `TileRayHit` |

### Exports Added to `@quintus/physics`

```typescript
// Types
export type { QueryOptions, RaycastHit, ShapeCastHit } from "./query-types.js";
export type { RayShapeHit } from "./ray.js";

// Functions
export { rayIntersectShape, pointInShape } from "./ray.js";
export { matchesQuery } from "./query-filter.js";
export { findShapePairTOI } from "./sat.js"; // extracted from PhysicsWorld._findShapePairTOI
```

---

## Usage Examples

### Patrol Enemy (edge detection)

```typescript
class PatrolEnemy extends Actor {
	speed = 80;
	facingRight = true;

	onFixedUpdate(dt: number) {
		const dir = this.facingRight ? Vec2.RIGHT : Vec2.LEFT;

		// Reverse at edges or walls
		if (this.isEdgeAhead(dir) || this.isOnWall()) {
			this.facingRight = !this.facingRight;
		}

		this.velocity.x = (this.facingRight ? 1 : -1) * this.speed;
		this.move(dt);
	}
}
```

### Turret with Line-of-Sight

```typescript
class Turret extends Actor {
	fireRate = 2; // shots per second
	private cooldown = 0;
	// Cast from the turret's "eye" (top of sprite), not center
	private eyeOffset = new Vec2(0, -12);

	onFixedUpdate(dt: number) {
		this.cooldown -= dt;
		const player = this.scene?.findAll("player")[0] as Node2D | undefined;
		if (!player) return;

		if (this.hasLineOfSight(player, { excludeGroups: ["enemies"] }, this.eyeOffset)) {
			if (this.cooldown <= 0) {
				this.shoot(player);
				this.cooldown = 1 / this.fireRate;
			}
		}
	}

	private shoot(target: Node2D) {
		const bullet = this.scene!.add(Bullet);
		bullet.position = this.position.clone();
		const dir = target.globalPosition.sub(this.globalPosition).normalize();
		bullet.velocity = dir.scale(400);
	}
}
```

### Explosion Damage Radius

```typescript
function explode(scene: Scene, center: Vec2, radius: number) {
	const world = scene.game!.physics;
	const hit = world.queryCircle(center, radius, {
		tags: ["damageable"],
		includeSensors: true,
	});

	for (const body of hit) {
		const dist = body.globalPosition.sub(center).length();
		const falloff = 1 - dist / radius;
		(body as Damageable).takeDamage(100 * falloff);
	}
}
```

### Projectile Targeting (raycast)

```typescript
class Sniper extends Actor {
	onFixedUpdate(dt: number) {
		const aimDir = this.getAimDirection(); // from input
		const hit = this.raycast(aimDir, 800, {
			groups: ["enemies"],
		});

		if (hit) {
			// Draw laser line from self to hit point
			this.drawLaser(this.globalPosition, hit.point);
		}
	}
}
```

### TileMap Line-of-Sight (DDA)

```typescript
class Guard extends Actor {
	canSeePlayer(player: Node2D, tilemap: TileMap): boolean {
		const dir = player.globalPosition.sub(this.globalPosition);
		const dist = dir.length();
		const hit = tilemap.raycast(this.globalPosition, dir, dist);
		return hit === null; // no wall tile blocks the path
	}
}
```

### Find Nearest Pickup

```typescript
class Magnet extends Actor {
	attractRadius = 120;

	onFixedUpdate(dt: number) {
		const nearest = this.findNearest(this.attractRadius, {
			tags: ["pickup"],
			includeSensors: true,
		});

		if (nearest) {
			// Pull pickup toward self
			const dir = this.globalPosition.sub(nearest.globalPosition).normalize();
			(nearest as Actor).velocity = dir.scale(200);
		}
	}
}
```

---

## Definition of Done

- [ ] All phases marked Done in status table
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes with no warnings
- [ ] `pnpm lint` clean
- [ ] All new types exported from `@quintus/physics` and `@quintus/tilemap`
- [ ] All query methods documented with JSDoc
- [ ] Usage examples in this doc are accurate (compile-checked against real API)
