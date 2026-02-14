# Phase 2, Subphase 3: Physics Infrastructure

> **Steps 5–6** | **Duration:** ~1.5 days
> **Depends on:** Subphase 2 (SpatialHash, SAT, swept collision)
> **Produces:** CollisionShape node, CollisionObject base class, PhysicsWorld orchestrator, PhysicsPlugin — all with tests.

**Reference:** [PHASE_2_DESIGN_CORE.md](./PHASE_2_DESIGN_CORE.md) for architecture overview and cross-cutting concerns.

---

## Step 5: PhysicsWorld + PhysicsPlugin (1 day)

### 5.1 PhysicsWorld

The central orchestrator. Owns the spatial hash, collision groups, and manages the collision pipeline.

**File:** `packages/physics/src/physics-world.ts`

```typescript
import { Vec2 } from "@quintus/math";
import type { CollisionGroups } from "./collision-groups.js";
import type { CollisionInfo } from "./collision-info.js";
import type { CollisionObject } from "./collision-object.js";
import type { Sensor } from "./sensor.js";
import { SpatialHash } from "./spatial-hash.js";

export interface PhysicsWorldConfig {
  gravity?: Vec2;
  cellSize?: number;
  collisionGroups?: CollisionGroups;
}

export class PhysicsWorld {
  /** World gravity vector. Default: (0, 800). */
  readonly gravity: Vec2;

  /** Compiled collision groups. */
  readonly groups: CollisionGroups;

  /** Spatial hash for broad-phase queries. */
  private readonly hash: SpatialHash;

  /** Current sensor overlaps for enter/exit tracking. */
  private readonly sensorOverlaps: Map<Sensor, Set<CollisionObject>>;

  constructor(config?: PhysicsWorldConfig);

  // === Body Registration ===

  /** Register a body in the spatial hash. Validates collision group. */
  register(body: CollisionObject): void;

  /** Remove a body from the spatial hash. Cleans up sensor overlaps. */
  unregister(body: CollisionObject): void;

  /** Update a body's position in the spatial hash. Called after move(). */
  updatePosition(body: CollisionObject): void;

  // === Collision Queries (used by Actor.move()) ===

  /**
   * Cast a body along a motion vector. Returns the first collision, or null.
   * This is the core query used by Actor.moveAndCollide().
   *
   * Algorithm:
   * 1. Compute swept AABB (body AABB expanded along motion)
   * 2. Broad phase: query spatial hash with swept AABB
   * 3. Filter by collision groups
   * 4. For each candidate, iterate all shape pairs:
   *    - For each (bodyShape, bodyTransform) in body.getShapeTransforms():
   *      For each (otherShape, otherTransform) in candidate.getShapeTransforms():
   *        Find TOI via sweptAABB (rect-rect fast path) or findTOI (binary search + SAT)
   *        Track minimum TOI across all pairs, along with the hit shape pair
   *    - During sweep, only translation interpolates; rotation/scale are constant
   * 5. From the earliest hit: compute travel = motion * toi, remainder = motion - travel
   * 6. Normal convention: CollisionInfo.normal points away from the collider
   *    (into the mover). Use SAT flip() if the raw normal points the wrong way.
   * 7. Contact point: call computeContactPoint() with the hit shape pair
   *    (see contact-point.ts — support point midpoint, NOT computed inside SAT)
   * 8. Return CollisionInfo with { collider, colliderShape, normal, depth, point, travel, remainder }
   */
  castMotion(
    body: CollisionObject,
    motion: Vec2,
  ): CollisionInfo | null;

  /**
   * Test if a body overlaps anything at its current position.
   * Used for sensor detection and post-separation validation.
   */
  testOverlap(body: CollisionObject): CollisionObject[];

  // === Sensor Overlap Detection ===

  /**
   * Run the global sensor overlap pass. Called by PhysicsPlugin
   * after each fixedUpdate via the postFixedUpdate hook.
   *
   * For each sensor with monitoring=true:
   * 1. Query spatial hash for candidates
   * 2. Filter by collision groups
   * 3. Narrow-phase SAT overlap test
   * 4. Compare with previous frame's overlaps
   * 5. Fire entered/exited signals for changes
   */
  stepSensors(): void;

  // === Sensor Queries ===

  /** Get bodies currently overlapping a sensor. */
  getOverlappingBodies(sensor: Sensor): CollisionObject[];

  /** Get sensors currently overlapping a sensor. */
  getOverlappingSensors(sensor: Sensor): Sensor[];
}
```

**Design decisions:**

- **Single responsibility.** PhysicsWorld orchestrates — it delegates broad phase to SpatialHash and narrow phase to SAT functions. It doesn't implement collision algorithms directly.
- **`castMotion` is the hot path.** Every `Actor.move()` call invokes this 1-4 times (once per slide iteration). It must be fast. Uses analytical swept AABB for rect-vs-rect, binary search TOI for other pairs (see Subphase 2). Multi-shape bodies require iterating all shape pairs (N mover × M obstacle); recommend 1-2 shapes per body in practice.
- **Normal convention.** `CollisionInfo.normal` always points away from the collider (into the mover). SAT's `flip()` is used when the raw normal points the wrong way. This is consistent across all collision query methods.
- **Contact point computation.** `castMotion` calls `computeContactPoint()` (from `contact-point.ts`) when building `CollisionInfo`. This uses the support point midpoint approach — a standalone function, not embedded in SAT. See "Contact Point Computation" section below.
- **Sensor overlap tracking uses diffing.** `Map<Sensor, Set<CollisionObject>>` stores current overlaps. Each `stepSensors()` call computes new overlaps, diffs against the previous set, and fires entered/exited signals. Guarantees:
  - No duplicate entered events
  - Exited fires even if the body was destroyed (removed from set during unregister)
  - Deterministic ordering (bodies processed in insertion order)
- **`updatePosition` is called by `Actor.move()` internally.** After the slide loop, the actor re-hashes itself. Users never call this.

### 5.1b Contact Point Computation

**File:** `packages/physics/src/contact-point.ts`

A standalone function for computing an approximate world-space contact point from two colliding shapes. Called by `PhysicsWorld.castMotion()` when building `CollisionInfo` — not embedded in SAT to avoid wasted work on sensor overlap tests.

**Algorithm: Support Point Midpoint**

For each shape, find its "support point" — the furthest point along the collision normal:

| Shape   | Support Point Along Direction `d`                          |
|---------|------------------------------------------------------------|
| Circle  | `center + d * radius`                                      |
| Rect    | Corner: `(sign(d.x) * hw, sign(d.y) * hh)` transformed   |
| Capsule | Endpoint closest to `d` + `d * radius`                     |
| Polygon | Vertex with `max dot(vertex, d)`                           |

Then:
```
supportA = shapeSupport(shapeA, transformA, +normal)   // deepest point of A into B
supportB = shapeSupport(shapeB, transformB, -normal)   // deepest point of B into A
contactPoint = midpoint(supportA, supportB)
```

```typescript
import type { Shape2D } from "./shapes.js";
import type { Matrix2D, Vec2 } from "@quintus/math";

/** Find the support point (furthest point along a direction) for a shape in world space. */
export function shapeSupport(shape: Shape2D, transform: Matrix2D, direction: Vec2): Vec2;

/**
 * Compute an approximate contact point between two colliding shapes.
 * Accurate for circles and vertex-face contacts (the common platformer cases).
 * Approximate for edge-edge (off by at most half the overlap width — fine for effects/debug).
 */
export function computeContactPoint(
  shapeA: Shape2D, transformA: Matrix2D,
  shapeB: Shape2D, transformB: Matrix2D,
  normal: Vec2,
): Vec2;
```

**Why this approach:**
- Zero per-pair dispatch — `shapeSupport()` is generic over all `Shape2D` variants
- Exact for circle-vs-anything and vertex-face contacts (most common in platformers)
- Zero allocations possible (compute in-place with scalars)
- `shapeSupport()` is the standard building block for upgrading to GJK/clipping later if needed

### 5.2 PhysicsPlugin

The entry point. Installs physics into a `Game` instance.

**File:** `packages/physics/src/physics-plugin.ts`

```typescript
import { definePlugin, type Plugin } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { CollisionGroupsConfig } from "./collision-groups.js";
import { CollisionGroups } from "./collision-groups.js";
import { PhysicsWorld } from "./physics-world.js";

export interface PhysicsPluginConfig {
  /** World gravity. Default: Vec2(0, 800). */
  gravity?: Vec2;
  /** Spatial hash cell size in pixels. Default: 64. */
  cellSize?: number;
  /** Named collision groups. Default: { default: { collidesWith: ["default"] } }. */
  collisionGroups?: CollisionGroupsConfig;
}

/**
 * Module-level WeakMap storing PhysicsWorld per Game.
 * Used by CollisionObject to find the world without core changes.
 */
const worldMap = new WeakMap<Game, PhysicsWorld>();

/** Get the PhysicsWorld for a game. Returns null if not installed. */
export function getPhysicsWorld(game: Game): PhysicsWorld | null {
  return worldMap.get(game) ?? null;
}

/** Create the physics plugin. */
export function PhysicsPlugin(config: PhysicsPluginConfig = {}): Plugin {
  return definePlugin({
    name: "physics",
    install(game) {
      const gravity = config.gravity ?? new Vec2(0, 800);
      const groups = new CollisionGroups(config.collisionGroups ?? {
        default: { collidesWith: ["default"] },
      });

      const world = new PhysicsWorld({ gravity, groups, cellSize: config.cellSize });
      worldMap.set(game, world);

      // Hook into postFixedUpdate for sensor detection
      game.postFixedUpdate.connect((dt) => {
        world.stepSensors();
      });
    },
  });
}
```

### Auto-Install Behavior

For the simplest getting-started experience, if a `CollisionObject` enters the tree and no PhysicsPlugin is installed, one is auto-installed with defaults:

```typescript
// In CollisionObject.onReady():
override onReady(): void {
  super.onReady();
  const game = this.game;
  if (game && !game.hasPlugin("physics")) {
    // Auto-install with defaults
    console.warn("PhysicsPlugin auto-installed with defaults. For custom gravity/groups, call game.use(PhysicsPlugin({...})) explicitly.");
    game.use(PhysicsPlugin());
  }
  const world = this._getWorld();
  if (world) {
    world.register(this);
    this._registered = true;
  }
}
```

This means zero-config works:
```typescript
// Physics auto-installs with gravity=(0, 800), default groups
const game = new Game({ width: 800, height: 600 });
game.start(defineScene("main", (scene) => {
  const actor = scene.add(Actor);
  actor.position = new Vec2(400, 100); // Falls with gravity
}));
```

But explicit configuration is recommended for real games:
```typescript
game.use(PhysicsPlugin({
  gravity: new Vec2(0, 600),
  collisionGroups: {
    player: { collidesWith: ["world", "enemies"] },
    world:  { collidesWith: ["player", "enemies"] },
    enemies: { collidesWith: ["world", "player"] },
  },
}));
```

---

## Step 6: CollisionObject + CollisionShape (0.5 day)

### 6.1 CollisionShape

A child node that defines the collision geometry of a physics body.

**File:** `packages/physics/src/collision-shape.ts`

```typescript
import { Node2D, type Node2DProps } from "@quintus/core";
import type { Shape2D } from "./shapes.js";
import type { AABB, Matrix2D } from "@quintus/math";

export interface CollisionShapeProps extends Node2DProps {
  shape?: Shape2D;
  disabled?: boolean;
}

export class CollisionShape extends Node2D {
  /** The collision shape geometry. Must be set before the body enters the tree. */
  shape: Shape2D | null = null;

  /** When true, this shape is ignored during collision detection. */
  disabled = false;

  /**
   * Get the world-space transform for this shape.
   * Uses Node2D's cached globalTransform — no new allocation.
   */
  getWorldTransform(): Matrix2D {
    return this.globalTransform;
  }

  /** Compute the world-space AABB for this shape. */
  getWorldAABB(): AABB | null {
    if (!this.shape || this.disabled) return null;
    return shapeAABB(this.shape, this.globalTransform);
  }
}
```

**Design decisions:**
- **Extends `Node2D`**. The `position` property provides offset from the parent body's origin. E.g., collision box offset 4px down: `position: new Vec2(0, 4)`.
- **Full transform support.** `getWorldTransform()` exposes `globalTransform` — position, rotation, and scale all affect collision geometry. Rotating a CollisionShape node (or any ancestor) rotates its collision shape.
- **`shape` is nullable.** A CollisionShape without a shape is silently ignored.
- **`disabled` for toggling.** Useful for crouching (swap between tall/short shapes) or invincibility frames.
- **Multiple shapes per body.** The body's world AABB is the union of all its shapes' AABBs.

**Usage:**

```typescript
class Player extends Actor {
  private standingShape!: CollisionShape;
  private crouchingShape!: CollisionShape;

  onReady() {
    // Standing collision shape
    this.standingShape = this.addChild(CollisionShape);
    this.standingShape.shape = Shape.rect(14, 24);

    // Crouching collision shape (disabled by default)
    this.crouchingShape = this.addChild(CollisionShape);
    this.crouchingShape.shape = Shape.rect(14, 14);
    this.crouchingShape.position = new Vec2(0, 5);
    this.crouchingShape.disabled = true;
  }

  crouch() {
    this.standingShape.disabled = true;
    this.crouchingShape.disabled = false;
  }
}
```

> **Note:** `Node.game` is guaranteed non-null inside lifecycle methods (`onEnterTree`, `onReady`, `onFixedUpdate`, `onUpdate`) since the node must be in the tree to receive these calls. Code inside these methods can safely use `this.game!` without null checks.

### 6.2 CollisionObject (base class)

Abstract base class shared by `Actor`, `StaticCollider`, and `Sensor`.

**File:** `packages/physics/src/collision-object.ts`

```typescript
import { Node2D } from "@quintus/core";
import type { AABB, Matrix2D } from "@quintus/math";
import type { Shape2D } from "./shapes.js";
import type { CollisionShape } from "./collision-shape.js";
import type { PhysicsWorld } from "./physics-world.js";

/** Discriminant for the three physics body types. */
export type BodyType = "actor" | "static" | "sensor";

export abstract class CollisionObject extends Node2D {
  /** What type of physics body this is. Set by subclasses. */
  abstract readonly bodyType: BodyType;

  /** Collision group name. Must match a group in PhysicsPlugin config. Default: "default". */
  collisionGroup = "default";

  /**
   * Whether this body is currently registered in the PhysicsWorld.
   * Set internally by onReady/onExitTree.
   */
  private _registered = false;

  // === Shape Queries ===

  /** Get all enabled CollisionShape children. */
  getShapes(): CollisionShape[] {
    return this.getChildren(CollisionShape).filter((s) => !s.disabled && s.shape);
  }

  /** Get shape + transform pairs for collision testing. */
  getShapeTransforms(): Array<{ shape: Shape2D; transform: Matrix2D }> {
    return this.getShapes().map((s) => ({
      shape: s.shape!,
      transform: s.getWorldTransform(),
    }));
  }

  /** Compute world-space AABB encompassing all enabled shapes. Null if no shapes. */
  getWorldAABB(): AABB | null {
    const shapes = this.getShapes();
    if (shapes.length === 0) return null;
    let aabb = shapes[0]!.getWorldAABB()!;
    for (let i = 1; i < shapes.length; i++) {
      const other = shapes[i]!.getWorldAABB();
      if (other) aabb = aabb.merge(other);
    }
    return aabb;
  }

  // === PhysicsWorld Registration ===

  /** @internal — uses onReady (not onEnterTree) so CollisionShape children are available. */
  override onReady(): void {
    super.onReady();
    const game = this.game;
    if (game && !game.hasPlugin("physics")) {
      console.warn("PhysicsPlugin auto-installed with defaults. For custom gravity/groups, call game.use(PhysicsPlugin({...})) explicitly.");
      game.use(PhysicsPlugin());
    }
    const world = this._getWorld();
    if (world) {
      world.register(this);
      this._registered = true;
    }
  }

  /** @internal */
  override onExitTree(): void {
    if (this._registered) {
      const world = this._getWorld();
      if (world) world.unregister(this);
      this._registered = false;
    }
    super.onExitTree();
  }

  /** Get the PhysicsWorld from the game's plugin. */
  protected _getWorld(): PhysicsWorld | null {
    const game = this.game;
    return game ? getPhysicsWorld(game) : null;
  }
}
```

**Design decisions:**
- **Abstract class, exported for `instanceof` checks.** Users extend `Actor`/`StaticCollider`/`Sensor`, never `CollisionObject` directly.
- **`bodyType` discriminant.** PhysicsWorld uses this to determine collision response (separate+slide vs. signal-only).
- **Auto-registration in `onReady()`.** Bodies register when ready (not on tree enter), ensuring CollisionShape children are available. Unregister on tree exit. No manual registration.
- **Collision group validated on registration.** `PhysicsWorld.register()` validates against compiled groups.
- **`getShapes()` not cached.** Walks immediate children. Fast enough for 1-3 shapes.

---

## Test Plan

### collision-shape.test.ts
- `getWorldAABB()` correct for rect shape at origin
- `getWorldAABB()` correct with position offset
- `getWorldAABB()` returns null when disabled
- `getWorldAABB()` returns null when shape is null
- Multiple shapes produce merged AABB on parent body

### contact-point.test.ts
- `shapeSupport` returns correct point for rect along +x, +y, diagonal
- `shapeSupport` returns correct point for circle along any direction
- `shapeSupport` respects transform (offset, rotation)
- `computeContactPoint` circle-vs-rect gives exact contact
- `computeContactPoint` rect-vertex-vs-rect-face gives exact contact
- `computeContactPoint` edge-edge gives reasonable midpoint approximation

### physics-world.test.ts
- `castMotion` with no obstacles → null
- `castMotion` with obstacle → correct TOI, travel, normal
- `castMotion` with multiple obstacles → returns closest
- `castMotion` respects collision groups
- `register`/`unregister` adds/removes from spatial hash
- Sensor stepping fires entered/exited at correct times

---

## Completion Checklist

- [x] `PhysicsWorld` registers/unregisters bodies, queries spatial hash
- [x] `castMotion` finds first collision along motion vector
- [x] `PhysicsPlugin` installs correctly, hooks into `postFixedUpdate`
- [x] Auto-install works when no plugin explicitly configured
- [x] `getPhysicsWorld` WeakMap pattern works
- [x] `CollisionShape` computes correct world AABB with offset
- [x] `CollisionObject` auto-registers on tree enter/exit
- [x] Collision group validation throws on invalid names
- [x] `computeContactPoint` + `shapeSupport` implemented and tested
- [x] Replace `CollisionObject`/`CollisionShapeNode` type aliases in `index.ts` with real class exports; update `collision-info.ts` imports and any Subphase 2 tests that pass plain `Node2D` as `CollisionObject`
- [x] All tests pass, `pnpm build` succeeds
