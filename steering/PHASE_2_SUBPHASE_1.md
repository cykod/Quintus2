# Phase 2, Subphase 1: Core Changes & Foundation Types

> **Steps 1–2** | **Duration:** ~2 days
> **Depends on:** Phase 1 complete (Node, Node2D, Signal, Game, GameLoop)
> **Produces:** `postFixedUpdate` hook on Game, generic props, Shape2D types, CollisionInfo, CollisionGroups class — all with tests.

**Reference:** [PHASE_2_DESIGN_CORE.md](./PHASE_2_DESIGN_CORE.md) for architecture overview and cross-cutting concerns.

---

## Step 1: Required Core Changes

Two small additions to `@quintus/core`.

### 1.1 `postFixedUpdate` Signal on Game

**File:** `packages/core/src/game.ts`

```typescript
// Add signal declaration alongside existing signals
readonly postFixedUpdate: Signal<number> = signal<number>();

// Emit after each fixed update step
private _fixedUpdate(dt: number): void {
  this._currentScene?._walkFixedUpdate(dt);
  this.postFixedUpdate.emit(dt); // ← Physics hooks in here
}
```

This is a general-purpose hook. Any system that needs to run after all nodes have processed their fixed update can use it. Physics uses it for sensor overlap detection.

### 1.2 Props Parameter Removed from `addChild` / `Scene.add`

The props bag on `addChild(Class, props?)` was a type-safety hole: `addChild` only applied `NodeProps` while `Scene.add` applied `Node2DProps`, and extending to physics-specific props would require `Record<string, unknown>` escape hatches that violate `strict: true` / `noExplicitAny`.

**Decision: Props parameter removed entirely.** Both methods now only accept `(node)` or `(Class)`:

```typescript
// Node.addChild — no props parameter
addChild(node: Node): this;
addChild<T extends Node>(NodeClass: NodeConstructor<T>): T;

// Scene.add — same, synonym for addChild
add(node: Node): this;
add<T extends Node>(NodeClass: NodeConstructor<T>): T;
```

Users set properties via direct assignment (always fully type-safe):
```typescript
const shape = this.addChild(CollisionShape);
shape.shape = Shape.rect(14, 24);
shape.position = new Vec2(0, 4);

const collider = scene.add(StaticCollider);
collider.position = new Vec2(0, 500);
collider.collisionGroup = "world";
```

The `applyNodeProps` and `applyNode2DProps` functions have been deleted.

### Step 1 Verification

- All existing `@quintus/core` tests still pass
- `postFixedUpdate` signal fires after `_walkFixedUpdate` (add a test)
- Props parameter removed from `addChild` and `Scene.add`
- Build succeeds: `pnpm build --filter=@quintus/core`

---

## Step 2: Foundation Types

All in `packages/physics/src/`.

### 2.1 Shape2D

Shape definitions for collision detection. Shapes are value objects — immutable once created.

**File:** `packages/physics/src/shapes.ts`

```typescript
import { AABB, Matrix2D, Vec2 } from "@quintus/math";

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
      const a = points[i]!;
      const b = points[(i + 1) % points.length]!;
      const c = points[(i + 2) % points.length]!;
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (cross !== 0) {
        if (sign === 0) sign = Math.sign(cross);
        else if (Math.sign(cross) !== sign) {
          throw new Error("Polygon must be convex. Concave shapes should be decomposed into multiple convex CollisionShape children.");
        }
      }
    }
    return { type: "polygon", points: Object.freeze([...points]) };
  },
} as const;
```

**Design decisions:**
- **Shapes are immutable.** Once created, a shape's dimensions don't change. Simplifies caching (AABB, normals, etc.).
- **Centered on origin.** A `Shape.rect(16, 24)` extends from (-8, -12) to (8, 12) relative to its CollisionShape node's position. Matches Godot's convention.
- **`Shape` factory over constructors.** `Shape.rect(16, 24)` is more discoverable than `new RectShape(16, 24)`.
- **Convex polygons only.** Concave collision is handled by decomposing into multiple convex CollisionShape children.
- **Capsule included from the start.** Best shape for character controllers (rounded bottom for smooth slope traversal).

#### AABB Computation from Shapes

Zero-allocation inline math for the hot path. Only the 2 `Vec2`s for the final AABB are allocated (unavoidable — they form the return value).

```typescript
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
        return new AABB(
          new Vec2(tx - hw, ty - hh),
          new Vec2(tx + hw, ty + hh),
        );
      }
      case "polygon": {
        // Inline min/max loop — no map(), no intermediate Vec2 arrays
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
      // No transformPoint() calls — direct matrix element math
      const hw = shape.width / 2;
      const hh = shape.height / 2;
      const extentX = Math.abs(a) * hw + Math.abs(c) * hh;
      const extentY = Math.abs(b) * hw + Math.abs(d) * hh;
      return new AABB(
        new Vec2(tx - extentX, ty - extentY),
        new Vec2(tx + extentX, ty + extentY),
      );
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
      // Top center = transform * (0, -halfSeg) = (c * -halfSeg + tx, d * -halfSeg + ty)
      const topX = c * -halfSeg + tx;
      const topY = d * -halfSeg + ty;
      // Bottom center = transform * (0, +halfSeg) = (c * halfSeg + tx, d * halfSeg + ty)
      const botX = c * halfSeg + tx;
      const botY = d * halfSeg + ty;
      // Inline scale for radius — conservative approximation for non-uniform scale
      const sx = Math.sqrt(a * a + b * b);
      const sy = Math.sqrt(c * c + d * d);
      const effectiveRadius = Math.max(sx, sy) * shape.radius;
      return new AABB(
        new Vec2(
          Math.min(topX, botX) - effectiveRadius,
          Math.min(topY, botY) - effectiveRadius,
        ),
        new Vec2(
          Math.max(topX, botX) + effectiveRadius,
          Math.max(topY, botY) + effectiveRadius,
        ),
      );
    }
    case "polygon": {
      // Inline min/max loop — no map(), no intermediate Vec2 arrays
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
```

**Transform-aware collision:** CollisionShape passes its full world transform (position + rotation + scale) to the collision system. Shapes are defined in local space and transformed at collision time. When the transform is translation-only (the common case in platformers), the fast path avoids any overhead from the transform-based API.

### 2.2 CollisionInfo

The result of a collision test. Returned by `moveAndCollide()` and stored in slide collision arrays.

**File:** `packages/physics/src/collision-info.ts`

```typescript
import type { Vec2 } from "@quintus/math";
import type { CollisionObject } from "./collision-object.js";
import type { CollisionShape } from "./collision-shape.js";

export interface CollisionInfo {
  /** The other object involved in the collision. */
  readonly collider: CollisionObject;

  /** The specific CollisionShape on the other object that was hit. */
  readonly colliderShape: CollisionShape;

  /** Collision normal pointing away from the collider (into the moving body). */
  readonly normal: Vec2;

  /** Penetration depth along the normal. */
  readonly depth: number;

  /** World-space point of contact (approximate — center of contact region). */
  readonly point: Vec2;

  /** The portion of the requested motion that was traveled before collision. */
  readonly travel: Vec2;

  /** The portion of the requested motion that remains after collision. */
  readonly remainder: Vec2;
}
```

**Design decisions:**
- **`collider` is a `CollisionObject`**, not a generic `Node`. Type-safe access to physics properties.
- **`travel` + `remainder` = original motion vector.** Makes slide calculation straightforward.
- **`normal` points into the moving body.** Actor hits floor → normal is `(0, -1)`. Matches Godot convention.
- **`point` is approximate.** Exact contact manifolds aren't needed for a 2D platformer engine.

### 2.3 Collision Groups

Named collision groups that compile to bitmasks for fast filtering.

**File:** `packages/physics/src/collision-groups.ts`

```typescript
/** Configuration for a single collision group. */
export interface GroupConfig {
  /** Names of groups this group collides with. */
  readonly collidesWith: readonly string[];
}

/** Full collision groups configuration. */
export interface CollisionGroupsConfig {
  readonly [groupName: string]: GroupConfig;
}

/**
 * Compiled collision groups. Maps group names to bitmasks for O(1) collision checks.
 * Created from CollisionGroupsConfig at plugin install time.
 */
export class CollisionGroups {
  private readonly layerMap: Map<string, number>;  // group name → bit index
  private readonly maskMap: Map<string, number>;   // group name → collision bitmask

  constructor(config: CollisionGroupsConfig);

  /** Get the layer bitmask for a group (what it IS). */
  getLayer(group: string): number;

  /** Get the collision mask for a group (what it SEES). */
  getMask(group: string): number;

  /** Check if group A should collide with group B. */
  shouldCollide(groupA: string, groupB: string): boolean;

  /** Validate that a group name exists. Throws if not. */
  validate(group: string): void;

  /** The default group name for bodies without an explicit group. */
  static readonly DEFAULT = "default";
}
```

**Compilation algorithm:**

```typescript
constructor(config: CollisionGroupsConfig) {
  // Assign bit indices (max 32 groups — fits in a 32-bit integer)
  let bit = 0;
  this.layerMap = new Map();
  for (const name of Object.keys(config)) {
    this.layerMap.set(name, 1 << bit);
    bit++;
  }
  // Always include "default" group
  if (!this.layerMap.has("default")) {
    this.layerMap.set("default", 1 << bit);
    bit++;
  }
  if (bit > 32) {
    throw new Error(`Too many collision groups (${bit}). Maximum is 32.`);
  }

  // Compile collision masks
  this.maskMap = new Map();
  for (const [name, cfg] of Object.entries(config)) {
    let mask = 0;
    for (const target of cfg.collidesWith) {
      const targetBit = this.layerMap.get(target);
      if (targetBit === undefined) {
        throw new Error(
          `Collision group "${name}" references unknown group "${target}".`
        );
      }
      mask |= targetBit;
    }
    this.maskMap.set(name, mask);
  }
  // Default group collides with everything
  if (!this.maskMap.has("default")) {
    this.maskMap.set("default", (1 << bit) - 1);
  }
}

shouldCollide(groupA: string, groupB: string): boolean {
  const layerB = this.layerMap.get(groupB) ?? 0;
  const maskA = this.maskMap.get(groupA) ?? 0;
  return (maskA & layerB) !== 0;
}
```

**Design decisions:**
- **Named strings, not raw bitmasks.** `collisionGroup = "player"` is far more LLM-friendly than `collisionLayer = 1 << 2`.
- **Validated at registration.** Typos like `"plyer"` throw immediately. Fail-fast.
- **`"default"` group as fallback.** Bodies without an explicit group collide with everything. Zero-config works.
- **Max 32 groups.** Single 32-bit integer for O(1) checks.
- **Collision is directional.** A colliding with B doesn't imply B collides with A.

**Usage:**

```typescript
game.use(PhysicsPlugin({
  gravity: new Vec2(0, 800),
  collisionGroups: {
    player:      { collidesWith: ["world", "enemies", "items"] },
    enemies:     { collidesWith: ["world", "player"] },
    world:       { collidesWith: ["player", "enemies"] },
    items:       { collidesWith: ["player"] },
    projectiles: { collidesWith: ["enemies", "world"] },
  },
}));
```

---

## Test Plan

### shapes.test.ts
- `Shape.rect()` returns correct type and dimensions
- `Shape.circle()` returns correct type and radius
- `Shape.capsule()` returns correct type, radius, height
- `Shape.polygon()` validates convexity and minimum vertex count
- `shapeAABB()` correct for each shape type at various positions

### collision-groups.test.ts
- Compiles named groups to bitmasks
- `shouldCollide()` returns true for configured pairs
- `shouldCollide()` returns false for unconfigured pairs
- Asymmetric collision works (A→B but not B→A)
- `"default"` group collides with everything
- Throws on too many groups (>32)
- Throws on reference to unknown group
- `validate()` throws for unknown group names

---

## Completion Checklist

- [ ] `postFixedUpdate` signal added to Game, fires after `_walkFixedUpdate`
- [ ] Props parameter removed from `addChild` and `Scene.add`; `applyNodeProps`/`applyNode2DProps` deleted
- [ ] All existing `@quintus/core` tests still pass
- [ ] `shapes.ts` implemented with Shape factory and `shapeAABB`
- [ ] `collision-info.ts` interface defined
- [ ] `collision-groups.ts` compiles groups, validates, `shouldCollide` works
- [ ] All new tests pass
- [ ] `pnpm build` succeeds for both `@quintus/core` and `@quintus/physics`
