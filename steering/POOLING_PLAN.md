# Object Pooling System — Detailed Design

> **Goal:** Eliminate GC pressure in hot paths by introducing a two-tier pooling system: (1) frame-scoped temporary pools for Vec2/AABB/Matrix2D/SATResult in the physics pipeline, and (2) a node pool for reusing Actor/Sensor/Node2D instances across spawn/destroy cycles.
> **Outcome:** A bullet-hell game spawning/destroying 100+ projectiles per second runs with zero mid-game GC pauses. Physics hot paths allocate zero garbage per frame.

---

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Physics pipeline temporary pools | Done |
| 2 | Node pool (acquire/release lifecycle) | Done |
| 3 | Integration & benchmarks | Done |

---

## Table of Contents

1. [Problem Analysis](#1-problem-analysis)
2. [Design Principles](#2-design-principles)
3. [Phase 1: Physics Pipeline Temporary Pools](#3-phase-1-physics-pipeline-temporary-pools)
4. [Phase 2: Node Pool](#4-phase-2-node-pool)
5. [Phase 3: Integration & Benchmarks](#5-phase-3-integration--benchmarks)
6. [Definition of Done](#6-definition-of-done)

---

## 1. Problem Analysis

### 1.1 Where Garbage Comes From

The engine creates short-lived objects in two distinct patterns:

**Pattern A — Frame temporaries (hundreds/frame):** Objects created and discarded within a single physics step. These are the biggest source of GC pressure in any game, not just bullet-hell.

| Hot path | File | Objects created per call |
|----------|------|------------------------|
| `Actor.move()` slide loop | `packages/physics/src/actor.ts:307-308` | 2 `Vec2` per iteration, up to `maxSlides`(4) iterations = 8 Vec2 |
| `Actor.move()` contact reset | `packages/physics/src/actor.ts:399-400` | 2 `Vec2` (floor/wall normal reset) |
| `PhysicsWorld.castMotion()` swept AABB | `packages/physics/src/physics-world.ts:278-286` | 4 `Vec2` + 1 `AABB` |
| `PhysicsWorld.castMotion()` offset AABB | `packages/physics/src/physics-world.ts:267-270` | 2 `Vec2` + 1 `AABB` |
| `PhysicsWorld.castMotion()` result | `packages/physics/src/physics-world.ts:343-344` | 2 `Vec2` (travel + remainder) |
| `PhysicsWorld._translateTransform()` | `packages/physics/src/physics-world.ts:1013` | 1 `Matrix2D` per call |
| `findShapePairTOI()` | `packages/physics/src/physics-world.ts:67-78` | 1 `Vec2` (negated normal) + 1 `Matrix2D` (hit transform) |
| `findTOI()` binary search | `packages/physics/src/sat.ts:518` | 1 `Matrix2D` per iteration (8 iterations default) |
| SAT `testOverlap()` results | `packages/physics/src/sat.ts:109-117` | 1 `Vec2` per result (normal), 1 `SATResult` object |
| `sweptAABB()` results | `packages/physics/src/sat.ts:618-628` | 1-2 `Vec2` (normal) |
| `generalSAT()` vertices | `packages/physics/src/sat.ts:458-460` | 4-8 `{x,y}` objects per shape + axes array |
| `PhysicsWorld.stepMonitoring()` | `packages/physics/src/physics-world.ts:468` | 1 `Set<CollisionObject>` per monitored body per frame |
| `PhysicsWorld._stepOverlapCallbacks()` | `packages/physics/src/physics-world.ts:549` | 1 `Map` per registration per frame |
| Raycast | `packages/physics/src/physics-world.ts:928-934` | 4 `Vec2` + 1 `AABB` + 1 `Vec2` per hit |
| `queryPoint()` / `queryCircle()` | `packages/physics/src/physics-world.ts:725-728` | 2 `Vec2` + 1 `AABB` + 1 `Matrix2D` |

**Worst case per frame** (20 moving actors, 4 collisions each): ~500+ Vec2, ~80+ Matrix2D, ~40+ AABB allocations.

**Pattern B — Spawn/destroy churn (tens/second):** Nodes created via `new`, added to the tree, destroyed via `destroy()`, then GC'd. In a bullet-hell game spawning 60 bullets/second, each bullet is an Actor with children (CollisionShape), signals, and physics registration.

| Scenario | Nodes created/destroyed per second |
|----------|-----------------------------------|
| Bullet-hell (player + enemies) | 100-200 Actor + 100-200 CollisionShape |
| Particle effects (non-pooled) | 50-500 Node2D |
| Breakout (ball + brick destroy) | 1-10 |

### 1.2 Existing Pool

`packages/math/src/vec2-pool.ts` already implements a frame-scoped `Vec2Pool` with `begin()/end()` semantics. It is **not currently used** anywhere in the physics pipeline — it was built as infrastructure but never wired in. The design below extends this pattern.

---

## 2. Design Principles

1. **Opt-in, not magic.** Pools are explicit — you call `pool.acquire()` / `pool.release()`. No hidden lifecycle changes.
2. **Zero-overhead when unused.** If you don't import or use pools, the engine behaves identically to today.
3. **Temporary pools are internal.** Frame-scoped pools in the physics pipeline are an implementation detail. Users never see them.
4. **Node pools are user-facing.** The `NodePool<T>` class is a public API for games that need it.
5. **Correct first, fast second.** A pooled node must behave identically to a freshly constructed one. If we can't guarantee that, don't pool it.
6. **Deterministic.** Pooled nodes get fresh IDs on acquire (not reused IDs). Pool ordering is deterministic.

---

## 3. Phase 1: Physics Pipeline Temporary Pools

### 3.1 Strategy

Extend the existing `Vec2Pool` pattern to eliminate all per-frame temporary allocations in the physics pipeline. The key insight: all temporaries in `castMotion()`, `testOverlap()`, `findTOI()`, and `Actor.move()` are consumed within the same call stack and never escape.

Two sub-strategies:

**A. Inline scalar math** — Replace `new Vec2(x, y)` with raw `x, y` scalars where the Vec2 is only used for `.x` / `.y` access. This is the highest-impact, lowest-risk change.

**B. Pool remaining allocations** — For cases where a Vec2/AABB/Matrix2D must exist as an object (passed to a function expecting that type), use frame-scoped pools.

### 3.2 Deliverables

#### 3.2.1 Inline Scalars in `Actor.move()`

- [ ] Replace `new Vec2(motionX, motionY)` on line 307 with passing `motionX, motionY` as separate args to `castMotion()` — requires signature change or overload
- [ ] Replace `new Vec2(totalDx, totalDy)` offset on line 308 with scalar pair
- [ ] Replace `new Vec2(0, 0)` floor/wall normal resets (lines 399-400) with `_floorNormal._set(0, 0)` / `_wallNormal._set(0, 0)` — reuse existing mutable Vec2
- [ ] Replace `new Vec2(carryX, carryY)` on line 464 with scalar pair

**Key change: `castMotion()` signature evolution**

Current:
```typescript
castMotion(body: CollisionObject, motion: Vec2, bodyOffset?: Vec2): CollisionInfo | null
```

Proposed: keep the public signature the same but add an internal fast-path:
```typescript
// Public API (unchanged)
castMotion(body: CollisionObject, motion: Vec2, bodyOffset?: Vec2): CollisionInfo | null

// Internal fast-path used by Actor.move()
_castMotionScalar(
  body: CollisionObject,
  motionX: number, motionY: number,
  offsetX?: number, offsetY?: number
): CollisionInfo | null
```

This avoids breaking the public API while eliminating allocations in the hottest call site.

#### 3.2.2 Inline Scalars in `castMotion()`

- [ ] Replace swept AABB `Vec2` construction (lines 278-286) with inline min/max scalars passed directly to `SpatialHash.queryRect(minX, minY, maxX, maxY)` — requires adding a scalar overload to `SpatialHash.query()`
- [ ] Replace `new Vec2(travel.x, travel.y)` / `new Vec2(remainder.x, remainder.y)` result construction — these *must* escape as part of `CollisionInfo`, so keep as `Vec2` but allocate once at return

#### 3.2.3 Add Scalar Query to SpatialHash

File: `packages/physics/src/spatial-hash.ts`

- [ ] Add `queryRect(minX: number, minY: number, maxX: number, maxY: number): Set<T>` overload that skips AABB construction

```typescript
queryRect(minX: number, minY: number, maxX: number, maxY: number): Set<T> {
    const result = new Set<T>();
    const x0 = Math.floor(minX / this.cellSize);
    const y0 = Math.floor(minY / this.cellSize);
    const x1 = Math.floor(maxX / this.cellSize);
    const y1 = Math.floor(maxY / this.cellSize);
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const cell = this.cells.get(this._key(x, y));
            if (cell) for (const item of cell) result.add(item);
        }
    }
    return result;
}
```

#### 3.2.4 Reuse `Set` in `stepMonitoring()`

- [ ] Replace `new Set<CollisionObject>()` per monitored body per frame (line 468) with a reusable set that's cleared between iterations
- [ ] Replace `new Map()` in `_stepOverlapCallbacks()` (line 549) with a reusable map

```typescript
// Add to PhysicsWorld as a reusable scratch set/map
private readonly _scratchOverlapSet = new Set<CollisionObject>();
private readonly _scratchOverlapMap = new Map<string, [CollisionObject, CollisionObject]>();
```

The `_stepBodyMonitoring()` loop currently creates `currentOverlaps = new Set()` per monitored body, then immediately replaces the stored set. Instead:

```typescript
// Before: creates new Set per body per frame
const currentOverlaps = new Set<CollisionObject>();
// ... fill currentOverlaps ...
this.monitoredOverlaps.set(monitor, currentOverlaps);

// After: swap pattern — reuse the old set object
const prevOverlaps = this.monitoredOverlaps.get(monitor)!;
// Build current overlaps into a scratch set
this._scratchOverlapSet.clear();
// ... fill _scratchOverlapSet ...
// Diff and fire events using prevOverlaps vs _scratchOverlapSet
// Then swap: clear prev, copy current into it
prevOverlaps.clear();
for (const body of this._scratchOverlapSet) prevOverlaps.add(body);
```

#### 3.2.5 Reduce SAT Allocations

File: `packages/physics/src/sat.ts`

- [ ] Change `SATResult.normal` from `Vec2` to `{ nx: number; ny: number }` internally, only constructing a `Vec2` at the `CollisionInfo` boundary where it escapes to user code
- [ ] Replace `getWorldVertices()` object array with a flat `Float64Array` scratch buffer

```typescript
// Internal SAT result — no Vec2 allocation
interface SATResultInternal {
    overlapping: boolean;
    nx: number;
    ny: number;
    depth: number;
}
```

The public `SATResult` type stays the same for external consumers. The internal functions (`rectVsRect`, `circleVsCircle`, etc.) return the internal type. The `Vec2` is only constructed when building the final `CollisionInfo`.

- [ ] Replace vertex arrays in `generalSAT()` with a pre-allocated scratch buffer (max 8 vertices per shape × 2 shapes = 16 entries × 2 floats = 32 floats)

```typescript
// Module-level scratch buffers (never escape)
const VERT_BUF_A = new Float64Array(16); // 8 vertices × 2
const VERT_BUF_B = new Float64Array(16);
const AXES_BUF = new Float64Array(64);   // up to 32 axes × 2
let vertCountA = 0, vertCountB = 0, axesCount = 0;
```

#### 3.2.6 Pool `Matrix2D` in `findTOI()`

File: `packages/physics/src/sat.ts`

- [ ] The `txAtTime(t)` closure creates a new `Matrix2D` per binary search iteration (up to 8). Replace with a single mutable scratch matrix.

```typescript
// Scratch matrix for binary search — rewritten each iteration
const _scratchMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

// In findTOI():
const updateScratch = (t: number) => {
    _scratchMatrix.a = bodyTransform.a;
    _scratchMatrix.b = bodyTransform.b;
    _scratchMatrix.c = bodyTransform.c;
    _scratchMatrix.d = bodyTransform.d;
    _scratchMatrix.e = bodyTransform.e + motion.x * t;
    _scratchMatrix.f = bodyTransform.f + motion.y * t;
};
```

Since `testOverlap()` only reads `.a-.f` fields, a plain object satisfying the same interface works. The `Matrix2D` class methods (`isTranslationOnly()`, `multiply()`) would need to accept a structural type or we add the method check inline.

**Simpler approach:** Make `testOverlap()` accept `{ a, b, c, d, e, f }` (a `Matrix2DLike` interface) instead of requiring `Matrix2D`. Then the scratch object works directly.

```typescript
// packages/math/src/matrix2d.ts — add interface
export interface Matrix2DLike {
    readonly a: number; readonly b: number;
    readonly c: number; readonly d: number;
    readonly e: number; readonly f: number;
}

// Matrix2D already satisfies this interface
```

- [ ] Add `Matrix2DLike` interface to `@quintus/math`
- [ ] Update `testOverlap()` and `findTOI()` to accept `Matrix2DLike` instead of `Matrix2D`
- [ ] Use mutable scratch object in `findTOI()` binary search loop

### 3.3 Allocation Reduction Summary

| Hot path | Before (allocs/call) | After | Saving |
|----------|---------------------|-------|--------|
| `Actor.move()` (4 slides) | 10 Vec2 | 2 Vec2 (contact normal resets eliminated, motion/offset scalar) | ~80% |
| `castMotion()` | 4 Vec2 + 1 AABB | 2 Vec2 (travel + remainder in result only) | ~70% |
| `findShapePairTOI()` | 1 Vec2 + 1 Matrix2D | 0 (scalar normal, scratch matrix) | 100% |
| `findTOI()` (8 iters) | 8 Matrix2D | 0 (scratch matrix) | 100% |
| SAT `testOverlap()` | 1 Vec2 + 1 result obj | 0 (scalar normals) | 100% |
| `stepMonitoring()` | N Sets + M Maps | 0 (reuse scratch) | 100% |

### 3.4 Tests

**Unit:** `packages/physics/src/physics-world.test.ts`
- All existing physics tests must pass unchanged (behavior-preserving refactor)
- Add test: `castMotion` returns correct results after scalar refactor
- Add test: `stepMonitoring` correctly tracks enter/exit after Set reuse refactor

**Unit:** `packages/physics/src/sat.test.ts`
- All existing SAT tests must pass unchanged
- Add test: `testOverlap` with `Matrix2DLike` plain object produces same results as `Matrix2D`

**Benchmark:** `packages/physics/src/bench/` (new directory, not part of CI)
- Microbenchmark: 1000 `castMotion()` calls, measure allocations via `--expose-gc` + `process.memoryUsage()`
- Before/after comparison

---

## 4. Phase 2: Node Pool

### 4.1 Strategy

Provide a `NodePool<T extends Node>` class that maintains a free list of previously-destroyed nodes. When a node is "released" back to the pool, it is removed from the scene tree but NOT garbage collected. When "acquired" from the pool, it is reset to a clean state and given a fresh ID.

### 4.2 The `Poolable` Contract

Not all nodes are safe to pool. A node is poolable if:

1. Its constructor takes zero arguments (the engine calls `new T()` to pre-fill the pool)
2. It implements a `reset()` method that restores all state to post-construction defaults
3. It does not rely on constructor-time side effects that can't be replayed

We enforce this with an interface:

```typescript
// packages/core/src/pool.ts

export interface Poolable {
    /** Reset this node to a clean, just-constructed state. Called by NodePool on acquire. */
    reset(): void;
}
```

The base `Node` class does NOT implement `Poolable` by default. The user opts in per class:

```typescript
class Bullet extends Actor implements Poolable {
    damage = 10;
    piercing = false;

    reset(): void {
        this.damage = 10;
        this.piercing = false;
        this.velocity._set(0, 0);
        // Actor/Node2D/Node base reset is handled by NodePool
    }
}
```

### 4.3 `NodePool<T>` Class

File: `packages/core/src/pool.ts`

```typescript
import { Node, type NodeConstructor } from "./node.js";

export interface Poolable {
    reset(): void;
}

type PoolableNode = Node & Poolable;
type PoolableConstructor<T extends PoolableNode> = NodeConstructor<T> & { new(): T };

export class NodePool<T extends PoolableNode> {
    private readonly _free: T[] = [];
    private readonly _ctor: PoolableConstructor<T>;
    private readonly _maxSize: number;

    constructor(ctor: PoolableConstructor<T>, options?: { prefill?: number; maxSize?: number }) {
        this._ctor = ctor;
        this._maxSize = options?.maxSize ?? 256;

        // Pre-fill pool
        const prefill = options?.prefill ?? 0;
        for (let i = 0; i < prefill; i++) {
            this._free.push(new ctor());
        }
    }

    /** Get a node from the pool (or create a new one). NOT added to any tree. */
    acquire(): T {
        const node = this._free.pop() ?? new this._ctor();
        _resetNodeBase(node);   // Reset Node/Node2D/CollisionObject/Actor base state
        node.reset();           // Reset user subclass state
        return node;
    }

    /** Return a node to the pool. Removes from tree if still attached. */
    release(node: T): void {
        if (this._free.length >= this._maxSize) {
            // Pool full — just let it GC
            node.destroy();
            return;
        }

        // Remove from tree without triggering destroy()
        if (node.parent) {
            node.removeSelf();
        }

        // Disconnect all signal handlers to prevent stale references
        _disconnectAllSignals(node);

        this._free.push(node);
    }

    /** Current number of available (free) nodes. */
    get available(): number {
        return this._free.length;
    }

    /** Total pool capacity. */
    get maxSize(): number {
        return this._maxSize;
    }

    /** Destroy all pooled nodes and empty the pool. */
    clear(): void {
        this._free.length = 0;
    }
}
```

### 4.4 Base Reset Function

The `_resetNodeBase()` function handles resetting all engine-internal state. This is critical — if the user forgets to reset a field, the pool is still safe because the base state is always clean.

```typescript
// packages/core/src/pool.ts

/** @internal Reset Node base class state for pooling. */
function _resetNodeBase(node: Node): void {
    // Fresh ID for determinism
    node._poolResetId();

    // Lifecycle flags
    node._poolResetLifecycle();

    // Clear tags
    node._poolClearTags();

    // Reset name to class name
    node.name = node.constructor.name;

    // Pause mode
    node.pauseMode = "inherit";

    // If Node2D, reset transform
    if (node instanceof Node2D) {
        _resetNode2DBase(node);
    }
}

function _resetNode2DBase(node: Node2D): void {
    node.position._set(0, 0);
    node.rotation = 0;
    node.scale._set(1, 1);
    node.zIndex = 0;
    node.visible = true;
    node.alpha = 1;
    node.renderFixed = false;
    node.ySortChildren = false;
}
```

This requires adding a few `@internal` methods to `Node`:

```typescript
// In Node class — packages/core/src/node.ts

/** @internal Called by NodePool to assign a fresh ID. */
_poolResetId(): void {
    (this as { id: number }).id = nextNodeId++;
}

/** @internal Called by NodePool to reset lifecycle flags. */
_poolResetLifecycle(): void {
    this._isReady = false;
    this._isInsideTree = false;
    this._isDestroyed = false;
    this._pendingDestroy = false;
}

/** @internal Called by NodePool to clear tags. */
_poolClearTags(): void {
    this._tags.clear();
}
```

For Actor, CollisionObject, and Sensor, additional reset is needed:

```typescript
// In CollisionObject — packages/physics/src/collision-object.ts

/** @internal Called by NodePool reset chain. */
_poolResetCollision(): void {
    this.collisionGroup = "default";
    this.monitoring = false;
    this._registered = false;
    this.bodyEntered.disconnectAll();
    this.bodyExited.disconnectAll();
}
```

```typescript
// In Actor — packages/physics/src/actor.ts

/** @internal Called by NodePool reset chain. */
_poolResetActor(): void {
    this._poolResetCollision();
    this.solid = false;
    this.velocity._set(0, 0);
    this.gravity = 0;
    this.applyGravity = true;
    this.upDirection = new Vec2(0, -1);
    this.floorMaxAngle = Math.PI / 4;
    this.maxSlides = 4;
    this._onFloor = false;
    this._onWall = false;
    this._onCeiling = false;
    this._floorNormal._set(0, 0);
    this._wallNormal._set(0, 0);
    this._floorCollider = null;
    this._slideCollisions.length = 0;
    this.collided.disconnectAll();
}
```

**Design decision:** Rather than having `_resetNodeBase()` check `instanceof` for every possible subclass (fragile, doesn't scale), use a **reset chain** pattern:

```typescript
// Each class level implements _poolReset() calling super._poolReset()
// Node._poolReset() → resets Node fields
// Node2D._poolReset() → super._poolReset() + resets Node2D fields
// CollisionObject._poolReset() → super._poolReset() + resets collision fields
// Actor._poolReset() → super._poolReset() + resets actor fields
```

Add to each class in the hierarchy:

```typescript
// Node
/** @internal Reset all engine state for pool reuse. Override and call super. */
_poolReset(): void {
    this._poolResetId();
    this._poolResetLifecycle();
    this._poolClearTags();
    this.name = this.constructor.name;
    this.pauseMode = "inherit";
    // Disconnect built-in signals
    this.treeEntered.disconnectAll();
    this.treeExited.disconnectAll();
    this.readySignal.disconnectAll();
    this.destroying.disconnectAll();
}
```

```typescript
// Node2D
override _poolReset(): void {
    super._poolReset();
    this.position._set(0, 0);
    this.rotation = 0;
    this.scale._set(1, 1);
    this.zIndex = 0;
    this.visible = true;
    this.alpha = 1;
    this.renderFixed = false;
    this.ySortChildren = false;
    this._localTransformDirty = true;
    this._globalTransformDirty = true;
}
```

```typescript
// CollisionObject
override _poolReset(): void {
    super._poolReset();
    this.collisionGroup = "default";
    this.monitoring = false;
    // _registered will be set in onReady when re-added to tree
    this._registered = false;
    this.bodyEntered.disconnectAll();
    this.bodyExited.disconnectAll();
}
```

```typescript
// Actor
override _poolReset(): void {
    super._poolReset();
    this.solid = false;
    this.velocity._set(0, 0);
    this.gravity = 0;
    this.applyGravity = true;
    this.upDirection = new Vec2(0, -1);
    this.floorMaxAngle = Math.PI / 4;
    this.maxSlides = 4;
    this._onFloor = false;
    this._onWall = false;
    this._onCeiling = false;
    this._floorNormal._set(0, 0);
    this._wallNormal._set(0, 0);
    this._floorCollider = null;
    this._slideCollisions.length = 0;
    this.collided.disconnectAll();
}
```

```typescript
// Sensor
override _poolReset(): void {
    super._poolReset();
    this.monitoring = true;  // Sensors default to monitoring=true
    this.sensorEntered.disconnectAll();
    this.sensorExited.disconnectAll();
}
```

Then `NodePool.acquire()` simply calls:

```typescript
acquire(): T {
    const node = this._free.pop() ?? new this._ctor();
    node._poolReset();  // Chain resets all engine state up the hierarchy
    node.reset();        // User resets subclass state
    return node;
}
```

### 4.5 Lifecycle Integration

When a pooled node is acquired and added to a tree, the normal lifecycle applies:

```
acquire() → _poolReset() + reset()
  → parent.add(node)
    → _enterTreeRecursive()
      → onEnterTree()
      → build() (if first ready — but _isReady was reset to false, so build() runs again)
      → onReady()
```

**Critical detail:** Since `_isReady` is reset to `false`, the node goes through `build()` + `onReady()` again on re-entry. This is correct — `onReady()` is where physics registration, signal wiring, etc. happen.

**Child nodes:** When a node is released, its children are NOT automatically pooled. If a Bullet has a CollisionShape child, the user has two options:

1. **Simple:** Let the CollisionShape be rebuilt via `build()` on next acquire (wasteful but correct)
2. **Advanced:** Pool the bullet with its shape child attached — override `reset()` to reset children too

For option 2, `_poolReset()` does NOT clear `_children`. Children from `build()` are preserved across pool cycles, but their state is reset. This means `build()` won't re-run (children already exist) BUT `_isReady = false` means `onReady()` will re-fire, which re-registers physics, etc.

**Actually**, let's think about this more carefully. The `_enterTreeRecursive` code at `node.ts:199` checks `if (!node._isReady)` to decide whether to call `build()`. Since we reset `_isReady = false`, `build()` will be called again on the **parent** node. But if the parent still has children from the previous cycle, `build()` returns its declarative children which get added as duplicates.

**Solution:** On `_poolReset()`, detach and clear all children. The user's `build()` method will re-create them on next tree entry. This is the safest approach.

```typescript
// In Node._poolReset()
_poolReset(): void {
    // ... other resets ...

    // Detach all children (don't destroy — they may be pooled separately)
    for (const child of [...this._children]) {
        child._parent = null;
        child._isInsideTree = false;
    }
    this._children.length = 0;
}
```

### 4.6 Usage Example

```typescript
import { NodePool } from "@quintus/core";

class Bullet extends Actor implements Poolable {
    speed = 500;
    damage = 10;
    direction = new Vec2(1, 0);

    build() {
        return <CollisionShape shape={{ type: "circle", radius: 4 }} />;
    }

    reset(): void {
        this.speed = 500;
        this.damage = 10;
        this.direction._set(1, 0);
    }

    onFixedUpdate(dt: number) {
        this.velocity._set(this.direction.x * this.speed, this.direction.y * this.speed);
        this.move(dt);
    }
}

class BulletManager extends Node {
    private pool = new NodePool(Bullet, { prefill: 50, maxSize: 200 });

    spawnBullet(pos: Vec2, dir: Vec2, damage: number) {
        const bullet = this.pool.acquire();
        bullet.position = pos;
        bullet.direction = dir;
        bullet.damage = damage;
        bullet.collisionGroup = "player_bullets";
        this.add(bullet);
    }

    recycleBullet(bullet: Bullet) {
        this.pool.release(bullet);
    }
}
```

### 4.7 `release()` vs `destroy()` — How the User Chooses

The user must explicitly call `pool.release(node)` instead of `node.destroy()`. This is intentional — pooling is opt-in and the caller controls when it happens.

For convenience, we could add a pattern where destroy auto-releases:

```typescript
class Bullet extends Actor implements Poolable {
    _pool?: NodePool<Bullet>;

    reset() { /* ... */ }

    override onDestroy() {
        // Instead of GC, return to pool
        if (this._pool) {
            // Cancel the normal destroy — we're pooling instead
            // ... but this is tricky because onDestroy is called mid-_processDestroy
        }
    }
}
```

**This is too risky.** Intercepting mid-destroy breaks assumptions. Instead, users simply call `pool.release()` instead of `destroy()`. Clear, explicit, no magic.

### 4.8 Deliverables

- [ ] Add `Poolable` interface to `packages/core/src/pool.ts`
- [ ] Add `NodePool<T>` class to `packages/core/src/pool.ts`
- [ ] Add `_poolReset()` method to `Node` class
- [ ] Add `_poolReset()` override to `Node2D` class
- [ ] Add `_poolReset()` override to `CollisionObject` class (in `@quintus/physics`)
- [ ] Add `_poolReset()` override to `Actor` class
- [ ] Add `_poolReset()` override to `Sensor` class
- [ ] Add `_poolReset()` override to `StaticCollider` class
- [ ] Export `NodePool`, `Poolable` from `@quintus/core` index
- [ ] Re-export pool types from `quintus` meta-package

### 4.9 Tests

**Unit:** `packages/core/src/pool.test.ts`

- `NodePool.acquire()` returns a fresh instance when pool is empty
- `NodePool.acquire()` reuses a released instance
- `NodePool.acquire()` assigns a fresh ID each time
- `NodePool.acquire()` resets all Node base state (lifecycle flags, tags, signals, children)
- `NodePool.acquire()` calls user `reset()` method
- `NodePool.release()` removes node from tree
- `NodePool.release()` disconnects all signals
- `NodePool.release()` drops node when pool is at maxSize
- `NodePool.prefill` creates instances eagerly
- Released + re-acquired node goes through full lifecycle (onEnterTree, build, onReady) when re-added
- Released + re-acquired node re-registers in physics world

**Integration:** `packages/physics/src/pool-integration.test.ts`

- Pool an Actor: acquire, add to scene, move(), release, acquire again → physics works correctly
- Pool a Sensor: acquire, add to scene, detect overlaps, release, acquire → signals fire correctly
- Pool 100 Actors rapidly in a loop — no stale state leaks between cycles
- Pooled Actor with `build()` children correctly rebuilds CollisionShape on reuse

**Determinism:** `packages/core/src/pool-determinism.test.ts`

- Two runs with identical pool usage produce identical snapshots (fresh IDs, same lifecycle order)

---

## 5. Phase 3: Integration & Benchmarks

### 5.1 Top-Down Shooter Example

A top-down twin-stick shooter using the **Kenney Top-Down Shooter** asset pack. This is the pooling stress-test: hundreds of bullets on screen at once, enemies spawning in waves, everything recycled through `NodePool`.

#### 5.1.1 Assets

Source: `~/Downloads/kenney_top-down-shooter/` (CC0, public domain)

Copy into `examples/top-down-shooter/public/assets/`:

| Asset | Source | Usage |
|-------|--------|-------|
| `spritesheet_characters.png` + `.xml` | `Spritesheet/` | All character sprites (player, enemies, zombies) |
| `tilesheet_complete.png` | `Tilesheet/` | Floor/wall tiles for arena |
| `weapon_gun.png` | `PNG/` | Pistol pickup sprite |
| `weapon_machine.png` | `PNG/` | Machine gun pickup sprite |
| `weapon_silencer.png` | `PNG/` | Silencer pickup sprite |

**Character sprites** (from the spritesheet XML — each is ~49x43px, facing **up** by default):

| Character | Stand | Gun | Machine | Reload | Silencer |
|-----------|-------|-----|---------|--------|----------|
| Hitman (player) | `hitman1_stand` | `hitman1_gun` | `hitman1_machine` | `hitman1_reload` | `hitman1_silencer` |
| Zombie (enemy) | `zoimbie1_stand` | `zoimbie1_gun` | `zoimbie1_machine` | — | — |
| Robot (enemy) | `robot1_stand` | `robot1_gun` | `robot1_machine` | — | — |
| Soldier (enemy) | `soldier1_stand` | `soldier1_gun` | `soldier1_machine` | — | — |
| Survivor (ally/NPC) | `survivor1_stand` | `survivor1_gun` | — | — | — |

**Important sprite detail:** All character sprites face **up** (toward top of screen). The engine rotates them to face the aim direction. Set sprite anchor to center. Rotation 0 = facing up.

#### 5.1.2 Game Design

**Genre:** Top-down twin-stick shooter (think Hotline Miami / Enter the Gungeon lite)

**Core loop:** Survive waves of enemies in an arena. Kill enemies, pick up weapons, rack up score.

**Controls — independent movement and aim:**

| Action | Keyboard + Mouse | Gamepad |
|--------|-----------------|---------|
| Move | WASD | Left stick |
| Aim direction | Mouse cursor position (relative to player) | Right stick |
| Fire | Left mouse button / Space | Right trigger (RT) |
| Reload | R | X button |
| Switch weapon | 1/2/3 or scroll wheel | D-pad left/right |
| Pause | Escape | Start |

**Input action map:**
```typescript
const inputMap = {
    move_up:    { keys: ["w", "ArrowUp"],     gamepad: { axis: "leftY", threshold: -0.3 } },
    move_down:  { keys: ["s", "ArrowDown"],   gamepad: { axis: "leftY", threshold: 0.3 } },
    move_left:  { keys: ["a", "ArrowLeft"],   gamepad: { axis: "leftX", threshold: -0.3 } },
    move_right: { keys: ["d", "ArrowRight"],  gamepad: { axis: "leftX", threshold: 0.3 } },
    fire:       { keys: ["Space"],            mouse: "left",  gamepad: "rightTrigger" },
    reload:     { keys: ["r"],                gamepad: "x" },
    pause:      { keys: ["Escape"],           gamepad: "start" },
};
```

**Aiming:**
- **Keyboard+mouse:** Player character rotates to face the mouse cursor. `rotation = Math.atan2(mouseWorld.y - pos.y, mouseWorld.x - pos.x) + Math.PI/2` (the `+PI/2` compensates for sprites facing up at rotation=0).
- **Gamepad:** Right stick direction sets aim. `rotation = Math.atan2(rightStickY, rightStickX) + Math.PI/2`. If right stick is neutral, keep last aim direction.

#### 5.1.3 Scene Tree

```
Scene (ArenaScene)
├── TileMap (arena floor + walls)
├── PickupManager (Node)
│   ├── WeaponPickup (Sensor) [pooled]
│   └── ...
├── Player (Actor)
│   └── CollisionShape (circle r=12)
├── EnemyManager (Node)
│   ├── Zombie (Actor) [pooled]
│   │   └── CollisionShape (circle r=12)
│   ├── Robot (Actor) [pooled]
│   │   └── CollisionShape (circle r=12)
│   └── ...
├── BulletManager (Node)
│   ├── PlayerBullet (Actor) [pooled]
│   │   └── CollisionShape (circle r=3)
│   ├── EnemyBullet (Actor) [pooled]
│   │   └── CollisionShape (circle r=3)
│   └── ...
├── EffectsLayer (Node)
│   ├── MuzzleFlash (Node2D) [pooled]
│   └── ...
└── HUD (UILayer)
    ├── ScoreLabel
    ├── WaveLabel
    ├── AmmoLabel
    ├── HealthBar
    └── PoolStatsLabel (debug: shows pool available/total)
```

#### 5.1.4 Pooled Node Types

| Pool | Class | Prefill | Max | Spawn rate |
|------|-------|---------|-----|------------|
| `playerBulletPool` | `PlayerBullet` | 100 | 300 | ~10-20/sec (machine gun) |
| `enemyBulletPool` | `EnemyBullet` | 50 | 200 | ~5-15/sec per shooting enemy |
| `zombiePool` | `Zombie` | 20 | 50 | Wave-based, 5-20 per wave |
| `robotPool` | `Robot` | 10 | 30 | Wave-based, 2-10 per wave |
| `soldierPool` | `Soldier` | 10 | 30 | Wave-based, 2-10 per wave |
| `muzzleFlashPool` | `MuzzleFlash` | 30 | 60 | 1 per bullet fired |
| `pickupPool` | `WeaponPickup` | 5 | 15 | 1 per enemy killed (chance) |

**Target:** 200+ active pooled nodes simultaneously during intense waves. 100+ bullets on screen. All recycled, zero GC churn.

#### 5.1.5 Weapon System

| Weapon | Fire rate | Damage | Bullet speed | Ammo | Spread |
|--------|-----------|--------|-------------|------|--------|
| Pistol | 3/sec | 25 | 600 px/s | Infinite | 0 |
| Machine Gun | 10/sec | 10 | 800 px/s | 60 (reload: 2s) | 5 deg |
| Silencer | 5/sec | 20 | 700 px/s | 30 (reload: 1.5s) | 2 deg |

Bullets are Actors with `applyGravity = false` (top-down, no gravity). They move in a straight line at their speed, rotated to their fire direction. On collision with a wall or enemy, they are released back to the pool.

```typescript
class PlayerBullet extends Actor implements Poolable {
    speed = 600;
    damage = 25;
    lifetime = 2; // seconds before auto-recycle
    _elapsed = 0;

    build() {
        return <CollisionShape shape={{ type: "circle", radius: 3 }} />;
    }

    reset(): void {
        this.speed = 600;
        this.damage = 25;
        this.lifetime = 2;
        this._elapsed = 0;
    }

    onReady() {
        super.onReady();
        this.applyGravity = false;
        this.collisionGroup = "player_bullets";
    }

    onFixedUpdate(dt: number) {
        // Move in facing direction (rotation 0 = up)
        const dir = Vec2.fromAngle(this.rotation - Math.PI / 2);
        this.velocity._set(dir.x * this.speed, dir.y * this.speed);
        this.move(dt);

        this._elapsed += dt;
        if (this._elapsed >= this.lifetime) {
            bulletManager.recycle(this);
        }
    }

    onCollided() {
        bulletManager.recycle(this);
    }
}
```

#### 5.1.6 Enemy AI

**Zombie:** Chases player, melee only. No bullets. Spawns in hordes.
- Movement: `moveToward(player.globalPosition, speed, dt)` — top-down, uses `move()` with `applyGravity=false`
- Rotation: faces player (`lookAt(player.globalPosition)`)
- On contact with player: deals damage, brief knockback

**Robot:** Ranged enemy. Strafes and shoots.
- Movement: keeps distance from player (150-250px), strafes laterally
- Fires `EnemyBullet` from pool every 1-2 seconds
- Rotation: always faces player

**Soldier:** Tougher ranged enemy. Takes cover behind walls.
- Movement: advances toward player, stops behind nearest wall tile
- Fires burst of 3 `EnemyBullet` every 2-3 seconds
- Rotation: faces player

All enemies use top-down physics: `applyGravity = false`, `upDirection = Vec2.ZERO`.

#### 5.1.7 Arena / TileMap

Build a simple hand-crafted arena using the Kenney tilesheet. No Tiled editor needed — define the map programmatically or with a small inline JSON:

- Outer walls (StaticCollider) form a rectangular arena ~800x600
- Interior walls/cover pieces for tactical gameplay
- Floor tiles for visual variety (concrete, grass, dirt patterns from tilesheet)

#### 5.1.8 Deliverables

- [ ] Copy Kenney assets to `examples/top-down-shooter/public/assets/`
- [ ] Create `examples/top-down-shooter/index.html` + Vite config
- [ ] Implement `Player` class with twin-stick controls (keyboard+mouse and gamepad)
- [ ] Implement aim system: rotation toward mouse cursor or right stick direction
- [ ] Implement weapon system with pistol, machine gun, silencer
- [ ] Implement `PlayerBullet` and `EnemyBullet` (pooled Actors, `applyGravity=false`)
- [ ] Implement `BulletManager` with `NodePool<PlayerBullet>` and `NodePool<EnemyBullet>`
- [ ] Implement `Zombie`, `Robot`, `Soldier` enemy types (pooled)
- [ ] Implement `EnemyManager` with wave spawning and `NodePool` per enemy type
- [ ] Implement `MuzzleFlash` effect (pooled Node2D, short tween, auto-recycle)
- [ ] Implement `WeaponPickup` sensor (pooled, dropped by enemies)
- [ ] Build arena with tilesheet walls and floor
- [ ] Add HUD: score, wave number, ammo count, health bar, pool stats debug overlay
- [ ] Title screen + game over screen (scene transitions)
- [ ] Add 3+ sound effects (gunshot, enemy death, pickup, wave start)
- [ ] Vitest config: `examples/top-down-shooter/vitest.config.ts`
- [ ] Runs at stable 60fps with 200+ active nodes and 100+ bullets

### 5.2 Benchmark Script

- [ ] Create `benchmarks/pooling/` with a headless benchmark script
- [ ] Measures: allocations/frame, GC pause frequency, frame time consistency
- [ ] Compares: with pooling vs without pooling
- [ ] Outputs CSV for analysis

### 5.3 Tests

**Integration:** `examples/top-down-shooter/src/top-down-shooter.test.ts`

- Game runs for 10 seconds of simulated time with no crashes
- Player moves with injected input, bullets spawn and recycle correctly
- Enemy waves spawn, enemies path toward player, die on bullet contact
- Pool stats show reuse (available count fluctuates, total allocations bounded)
- Gamepad aim: injected right-stick input rotates player correctly
- Mouse aim: injected mouse position rotates player correctly
- Weapon switching works (pistol → machine gun → silencer)
- Bullet-wall collision releases bullet back to pool
- Enemy death releases enemy back to pool and may spawn weapon pickup

---

## 6. Definition of Done

- [ ] All phases marked Done in status table
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes — all existing tests still pass (zero regressions)
- [ ] `pnpm lint` clean
- [ ] Top-down shooter example runs at stable 60fps via `pnpm dev`
- [ ] Physics pipeline creates zero Vec2/AABB/Matrix2D garbage per frame (verified by benchmark)
- [ ] NodePool correctly reuses nodes across acquire/release cycles (verified by tests)
- [ ] NodePool produces deterministic results (verified by determinism test)
