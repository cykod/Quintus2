# Pool Reset Improvements — Detailed Design

> **Goal:** Eliminate the pool-reset footguns so that `NodePool` Just Works with subclass `override` declarations, signals, and collision groups — no manual workarounds required.
> **Outcome:** A pooled `Actor` subclass with `override collisionGroup = "player_bullets"` survives acquire/release cycles without the user restoring those properties in `reset()`. The shooter example's boilerplate workarounds are deleted.

---

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Class defaults snapshot in NodePool | Done |
| 2 | Slide-loop re-entrancy guard | Done |
| 3 | Update shooter example + tests | Done |

---

## Issues Addressed

Issues discovered while building the top-down shooter example. These are
engine-level pitfalls that affect any game using these features.

---

## 1. `_poolReset()` Resets Class Overrides

**Severity: Critical**

When a pooled node is acquired via `NodePool.acquire()`, `_poolReset()` runs
before `reset()`. The engine's `_poolReset()` chain resets properties to their
*base class defaults*, not to the values from `override` declarations:

| Property         | Class override        | After `_poolReset()`   |
|------------------|-----------------------|------------------------|
| `collisionGroup` | `"player_bullets"`    | `"default"`            |
| `solid`          | `true`                | `false`                |
| `applyGravity`   | `false`               | `true`                 |
| `upDirection`    | `new Vec2(0, 0)`      | `(0, -1)`              |
| `gravity`        | `0`                   | `0` (then world value) |

The user's `reset()` method must explicitly restore every property that
`_poolReset()` clobbers:

```typescript
// In your Poolable.reset():
reset(): void {
    // Restore properties that _poolReset() overrides
    this.collisionGroup = "player_bullets";
    this.solid = false;
    this.applyGravity = false;
    this.upDirection._set(0, 0);

    // Reset user state
    this.speed = 400;
    this._elapsed = 0;
    // ...
}
```

**Root cause**: `CollisionObject._poolReset()` hardcodes
`collisionGroup = "default"`, and `Actor._poolReset()` resets `solid`,
`applyGravity`, and `upDirection` to platformer-style defaults. These are
engine-internal resets that don't know about subclass overrides.

**Recommendation**: Consider having `_poolReset()` read from a prototype
snapshot or skip resetting properties that are declared as `override` in the
subclass.

---

## 2. Signal Listeners Disconnected on Pool Release

**Severity: Critical**

`Actor._poolReset()` calls `this.collided.disconnectAll()`. This removes ALL
handlers, including user-connected handlers from `onReady()`.

If you use a guard flag to connect signals only once:

```typescript
// BAD: Handler disconnected by _poolReset(), flag stays true
private _connected = false;

override onReady() {
    super.onReady();
    if (!this._connected) {
        this._connected = true;
        this.collided.connect(handler); // Only runs once per object lifetime
    }
}
```

After pool release and re-acquire, `_poolReset()` removes the handler but
`_connected` remains `true`. The fix: reset the flag in `reset()`:

```typescript
reset(): void {
    this._connected = false; // Allow handler to reconnect in next onReady()
}
```

Or simply always connect in `onReady()` without a guard (since
`disconnectAll()` clears previous connections):

```typescript
override onReady() {
    super.onReady();
    this.collided.connect(handler); // Safe: _poolReset already cleared old one
}
```

---

## 3. "default" Collision Group Collides With Everything

**Severity: Medium**

When `_poolReset()` sets `collisionGroup = "default"` and the game hasn't
configured a "default" group, the engine auto-creates one with mask = all bits:

```typescript
// collision-groups.ts constructor:
if (!this.maskMap.has("default")) {
    this.maskMap.set("default", (1 << bit) - 1); // all bits
}
```

This means pooled nodes with forgotten `reset()` will collide with
*everything* — player, enemies, walls, other bullets. The bullet won't pass
through things as expected; it'll interact with all collision groups.

---

## 4. PhysicsWorld Connects to `collided` Signal on Registration

**Severity: Informational**

When an Actor is registered in the PhysicsWorld (during `onReady()`), the world
automatically connects a handler to the actor's `collided` signal. This handler
dispatches `onContact()` callbacks.

This means every Actor's `collided` signal has at least one listener (the
physics world's handler) even if no user code connects to it. This handler
checks `body.collisionGroup` against registered contact pairs.

---

## 5. Sprite Rotation Convention

**Severity: Medium**

The engine uses standard Canvas2D rotation where:
- `rotation = 0` means the sprite is drawn as-is (no rotation)
- Positive rotation is clockwise in screen coordinates
- `Math.atan2(dy, dx)` returns the angle from the positive X axis

For top-down sprites that face **right** in their source image, `atan2` works
directly without any offset. For sprites that face **up** in their source
image, you'd need to subtract `PI/2`.

The Kenney top-down character sprites face **right** by default. Using
`rotation = atan2(dy, dx)` is correct without any `+PI/2` adjustment.

---

## 6. `StaticCollider` Is Invisible by Default

**Severity: Low**

`StaticCollider` provides collision but has no visual representation.
If you create interior walls or cover objects, they will be invisible
unless you extend `StaticCollider` and add an `onDraw()` method:

```typescript
class CoverWall extends StaticCollider {
    coverWidth = 60;
    coverHeight = 16;

    onDraw(ctx: DrawContext): void {
        ctx.rect(
            new Vec2(-this.coverWidth / 2, -this.coverHeight / 2),
            new Vec2(this.coverWidth, this.coverHeight),
            { fill: COVER_COLOR },
        );
    }
}
```

---

## 7. `Actor.move()` Re-entrancy During `onCollided`

**Severity: Medium**

`Actor.move()` fires `onCollided()` mid-slide-loop. If the collision handler
removes the node from the tree (e.g., pool release), `move()` continues
executing on a detached node. The engine guards debug logging with
`this.gameOrNull`, but user code inside the slide loop remainder may still
access stale state.

For pooled bullets: set a `_recycled` flag and check it at the top of
`onFixedUpdate()` to bail early:

```typescript
override onFixedUpdate(dt: number) {
    if (this._recycled || !this.gameOrNull) return;
    // ... rest of update
}
```

---

## Summary of Required `reset()` Properties for Top-Down Actors

For any `Actor` subclass used with `NodePool` in a top-down game, `reset()`
must restore:

```typescript
reset(): void {
    this.collisionGroup = "my_group";    // _poolReset sets "default"
    this.solid = true/false;             // _poolReset sets false
    this.applyGravity = false;           // _poolReset sets true
    this.upDirection._set(0, 0);         // _poolReset sets (0, -1)
    // + any signal guard flags
    // + any user state
}
```

---
---

# Implementation Plan

The plan addresses Issues 1–3 and 7 with engine-level fixes so users don't
need manual workarounds. Issues 4–6 are informational/cosmetic and need no
code changes (just documentation).

## Root Cause Analysis

TypeScript `override` property declarations are instance-level assignments
that run once in the constructor:

```typescript
class PlayerBullet extends Actor {
    override collisionGroup = "player_bullets"; // runs in constructor
    override applyGravity = false;              // runs in constructor
}
```

After construction, the instance has the correct values. But `_poolReset()`
hardcodes base-class defaults without knowing about the subclass:

```typescript
// CollisionObject._poolReset() — line 159
this.collisionGroup = "default";    // clobbers "player_bullets"

// Actor._poolReset() — line 151
this.applyGravity = true;           // clobbers false
this.upDirection._set(0, -1);       // clobbers (0, 0)
```

Since `_poolReset()` runs on reuse (not first construction), and JavaScript
has no way to replay just the property initializers, the engine needs another
mechanism to know what the class originally declared.

---

## Phase 1: Class Defaults Snapshot in NodePool

**Fixes:** Issues 1, 2, 3

### 1.1 Strategy

`NodePool` captures a snapshot of "class-declarative" property values from the
first factory-created instance. On acquire, it applies this snapshot **after**
`_poolReset()` but **before** `reset()`. This restores override values without
any user effort.

```
acquire() flow:
  1. _poolReset()            ← reset to base defaults (unchanged)
  2. _applyClassDefaults()   ← NEW: restore class override values from snapshot
  3. reset()                 ← user resets only their own runtime state
```

The user's `reset()` no longer needs to restore `collisionGroup`,
`applyGravity`, `upDirection`, etc. — the pool handles it automatically.

### 1.2 Snapshot Mechanism

The snapshot captures every property that any `_poolReset()` in the chain
hardcodes. These properties are split into two categories: scalars (copied
by value) and Vec2s (copied component-wise).

File: `packages/core/src/pool.ts`

```typescript
/**
 * Properties that _poolReset() hardcodes to base-class defaults.
 * The NodePool snapshots these from a fresh instance and restores
 * them on acquire, so subclass `override` declarations survive.
 */
interface ClassDefaultsSnapshot {
    // CollisionObject properties
    collisionGroup: string;
    monitoring: boolean;
    // Actor properties (only present for Actor subclasses)
    solid?: boolean;
    applyGravity?: boolean;
    gravity?: number;
    upDirectionX?: number;
    upDirectionY?: number;
    floorMaxAngle?: number;
    maxSlides?: number;
    // StaticCollider properties (only present for StaticCollider subclasses)
    oneWay?: boolean;
    oneWayDirectionX?: number;
    oneWayDirectionY?: number;
}
```

Capture function (uses duck typing — no physics imports needed in core):

```typescript
function _captureClassDefaults(node: Node): ClassDefaultsSnapshot | null {
    // Only relevant for collision objects (have collisionGroup property)
    if (!("collisionGroup" in node)) return null;

    const snapshot: ClassDefaultsSnapshot = {
        collisionGroup: (node as { collisionGroup: string }).collisionGroup,
        monitoring: (node as { monitoring: boolean }).monitoring,
    };

    // Actor properties
    if ("solid" in node) {
        snapshot.solid = (node as { solid: boolean }).solid;
        snapshot.applyGravity = (node as { applyGravity: boolean }).applyGravity;
        snapshot.gravity = (node as { gravity: number }).gravity;
        snapshot.floorMaxAngle = (node as { floorMaxAngle: number }).floorMaxAngle;
        snapshot.maxSlides = (node as { maxSlides: number }).maxSlides;
        const up = (node as { upDirection: { x: number; y: number } }).upDirection;
        snapshot.upDirectionX = up.x;
        snapshot.upDirectionY = up.y;
    }

    // StaticCollider properties
    if ("oneWay" in node) {
        snapshot.oneWay = (node as { oneWay: boolean }).oneWay;
        const dir = (node as { oneWayDirection: { x: number; y: number } })
            .oneWayDirection;
        snapshot.oneWayDirectionX = dir.x;
        snapshot.oneWayDirectionY = dir.y;
    }

    return snapshot;
}
```

Restore function:

```typescript
function _applyClassDefaults(
    node: Node,
    snapshot: ClassDefaultsSnapshot,
): void {
    const n = node as Record<string, unknown>;
    n.collisionGroup = snapshot.collisionGroup;
    n.monitoring = snapshot.monitoring;

    if (snapshot.solid !== undefined) {
        n.solid = snapshot.solid;
        n.applyGravity = snapshot.applyGravity;
        n.gravity = snapshot.gravity;
        n.floorMaxAngle = snapshot.floorMaxAngle;
        n.maxSlides = snapshot.maxSlides;
        const up = n.upDirection as { _set(x: number, y: number): void };
        up._set(snapshot.upDirectionX!, snapshot.upDirectionY!);
    }

    if (snapshot.oneWay !== undefined) {
        n.oneWay = snapshot.oneWay;
        const dir = n.oneWayDirection as { _set(x: number, y: number): void };
        dir._set(snapshot.oneWayDirectionX!, snapshot.oneWayDirectionY!);
    }
}
```

### 1.3 Changes to NodePool

File: `packages/core/src/pool.ts`

```typescript
export class NodePool<T extends Node & Poolable> {
    private readonly _pool: T[] = [];
    private readonly _factory: () => T;
    private readonly _maxSize: number;
    private readonly _classDefaults: ClassDefaultsSnapshot | null;

    constructor(NodeClass: NodeConstructor<T>, maxSize = 64) {
        this._factory = () => new NodeClass();
        this._maxSize = maxSize;

        // Create an exemplar instance and snapshot its class-level defaults.
        // This captures override declarations before any _poolReset() runs.
        const exemplar = this._factory();
        this._classDefaults = _captureClassDefaults(exemplar);
        // Don't waste the exemplar — seed the pool with it.
        this._pool.push(exemplar);
    }

    acquire(): T {
        const node = this._pool.pop();
        if (node) {
            (node as unknown as { _poolReset(): void })._poolReset();
            // Restore class-level override values that _poolReset() clobbered
            if (this._classDefaults) {
                _applyClassDefaults(node, this._classDefaults);
            }
            node.reset();
            return node;
        }
        return this._factory();
    }

    // release(), prefill(), clear() — unchanged
}
```

### 1.4 Signal Reconnection (Issue 2)

No engine code change needed. The existing behavior is actually correct:

1. `_poolReset()` calls `disconnectAll()` on all signals ← good, prevents stale handlers
2. `onReady()` re-runs after pool acquire + `scene.add()` ← good, reconnects handlers

The problem is only the **guard-flag antipattern** in user code. Since
`disconnectAll()` already clears previous connections, connecting in
`onReady()` without a guard is safe and correct:

```typescript
// CORRECT: No guard needed. _poolReset() already cleared old handlers.
override onReady() {
    super.onReady();
    this.collided.connect((info) => { /* ... */ });
}
```

The shooter example currently uses `_collisionConnected` guard flags. Phase 3
removes them.

### 1.5 "default" Collision Group (Issue 3)

With the snapshot restoring the correct `collisionGroup` after `_poolReset()`,
pooled nodes never accidentally land in the "default" group. Issue 3 becomes
a non-issue for pooled nodes.

For completeness, the auto-created "default" group's mask should be changed
from "collides with everything" to "collides with nothing" (mask = 0). This
makes forgotten collision groups fail-safe (silent miss) rather than
fail-dangerous (phantom collisions with everything):

File: `packages/physics/src/collision-groups.ts:54`

```typescript
// Before: default collides with everything (dangerous)
if (!this.maskMap.has("default")) {
    this.maskMap.set("default", (1 << bit) - 1);
}

// After: default collides with nothing (safe)
if (!this.maskMap.has("default")) {
    this.maskMap.set("default", 0);
}
```

**Risk:** This is a behavior change. Any existing game that relies on the
"default" group colliding with things will break. However, no shipped example
uses the "default" group intentionally — they all configure explicit groups.
Add a console warning when a body in the "default" group is registered:

```typescript
// In PhysicsWorld.registerBody():
if (body.collisionGroup === "default") {
    console.warn(
        `[Physics] ${body.name} has collisionGroup "default". ` +
        `Set an explicit group or it won't collide with anything.`
    );
}
```

### 1.6 Deliverables

- [x] Add `ClassDefaultsSnapshot` interface to `packages/core/src/pool.ts`
- [x] Add `_captureClassDefaults()` function to `packages/core/src/pool.ts`
- [x] Add `_applyClassDefaults()` function to `packages/core/src/pool.ts`
- [x] Update `NodePool` constructor to capture snapshot from exemplar
- [x] Update `NodePool.acquire()` to apply snapshot between `_poolReset()` and `reset()`
- [x] Change "default" collision group mask from all-bits to 0 in `collision-groups.ts:54`
- [x] Add console warning in `PhysicsWorld.registerBody()` for "default" group

### 1.7 Tests

**Unit:** `packages/core/src/pool.test.ts`

- `_captureClassDefaults()` captures `collisionGroup` from a CollisionObject subclass
- `_captureClassDefaults()` captures `solid`, `applyGravity`, `upDirection` from an Actor subclass
- `_captureClassDefaults()` returns null for a plain Node (no collision properties)
- `_applyClassDefaults()` restores all scalar properties
- `_applyClassDefaults()` restores Vec2 properties component-wise (upDirection, oneWayDirection)
- `NodePool.acquire()` on reused Actor preserves override `collisionGroup`
- `NodePool.acquire()` on reused Actor preserves override `applyGravity = false`
- `NodePool.acquire()` on reused Actor preserves override `upDirection = (0, 0)`
- `NodePool.acquire()` on reused Actor preserves override `solid = true`
- Properties changed during gameplay are restored to class defaults on reacquire
  (e.g., if code sets `collisionGroup = "special"`, reacquire restores to class override)
- Exemplar created in constructor is pooled and reusable (pool.available starts at 1)

**Integration:** `packages/physics/src/pool-integration.test.ts` (extend existing)

- Pooled Actor with `override collisionGroup = "custom"`: acquire → release → acquire → group is "custom"
- Pooled Actor with `override applyGravity = false`: gravity not applied after reacquire
- Pooled Sensor with `override monitoring = true`: monitoring preserved through pool cycle

**Collision groups:** `packages/physics/src/collision-groups.test.ts`

- Unconfigured "default" group has mask = 0 (collides with nothing)
- Console warning fires when registering a body with `collisionGroup = "default"`

---

## Phase 2: Slide-Loop Re-entrancy Guard

**Fixes:** Issue 7

### 2.1 Problem

`Actor.move()` iterates a slide loop that calls `onCollided()` on each
contact. If the collision handler removes the node from the tree (e.g., via
`pool.release()`), the slide loop continues executing on a detached node.

Current workaround: users set a `_recycled` flag and check it manually.

### 2.2 Solution

Add a tree-attachment check inside the `move()` slide loop. If the node
leaves the tree mid-slide (detected via `this._isInsideTree`), break out
immediately:

File: `packages/physics/src/actor.ts` — inside `move()` slide loop

```typescript
// Inside the slide loop, after onCollided() fires:
if (!this._isInsideTree) break; // Node was removed during collision callback
```

This is a single-line addition. The `_isInsideTree` flag is already maintained
by the Node base class and set to `false` by `removeSelf()` /
`_exitTreeRecursive()`.

### 2.3 Deliverables

- [x] Add `_isInsideTree` check after `onCollided()` in `Actor.move()` slide loop
- [x] Add `_isInsideTree` check after `onCollided()` in `Actor.moveAndCollide()` if applicable
- [x] Remove `_recycled` flag workaround from shooter example (Phase 3)

### 2.4 Tests

**Unit:** `packages/physics/src/actor.test.ts`

- Actor removed from tree during `onCollided` — `move()` exits cleanly without error
- Actor removed during slide iteration 2 of 4 — only 2 slides execute
- Actor NOT removed during `onCollided` — full slide loop completes (no regression)

---

## Phase 3: Update Shooter Example + Tests

**Fixes:** Remove all workaround code from the shooter example.

### 3.1 Changes to `PlayerBullet` and `EnemyBullet`

File: `examples/top-down-shooter/entities/bullet.tsx`

Before (current workaround):
```typescript
export class PlayerBullet extends Actor implements Poolable {
    override collisionGroup = "player_bullets";
    override applyGravity = false;
    override upDirection = new Vec2(0, 0);

    private _recycled = false;
    private _collisionConnected = false;

    override onReady() {
        super.onReady();
        this._recycled = false;
        if (!this._collisionConnected) {         // guard flag
            this._collisionConnected = true;
            this.collided.connect((info) => { /* ... */ });
        }
    }

    override onFixedUpdate(dt: number) {
        if (this._recycled || !this.gameOrNull) return;  // manual re-entrancy guard
        // ...
    }

    reset(): void {
        this.collisionGroup = "player_bullets";  // workaround for Issue 1
        this.applyGravity = false;               // workaround for Issue 1
        this.upDirection._set(0, 0);             // workaround for Issue 1
        this._collisionConnected = false;        // workaround for Issue 2
        this._recycled = false;
        // ... user state ...
    }
}
```

After (clean):
```typescript
export class PlayerBullet extends Actor implements Poolable {
    override collisionGroup = "player_bullets";
    override applyGravity = false;
    override upDirection = new Vec2(0, 0);

    speed = 400;
    damage = 25;
    private _lifetime = BULLET_LIFETIME;
    private _elapsed = 0;

    override onReady() {
        super.onReady();
        // No guard flag needed — _poolReset() already cleared old handlers
        this.collided.connect((info: CollisionInfo) => {
            if (info.collider.hasTag("enemy")) {
                (info.collider as BaseEnemy).takeDamage(this.damage);
            }
            this._recycle();
        });
    }

    override onFixedUpdate(dt: number) {
        // No _recycled check needed — move() exits cleanly if node is removed
        this._elapsed += dt;
        if (this._elapsed >= this._lifetime) {
            this._recycle();
            return;
        }
        this.velocity.x = Math.cos(this.rotation) * this.speed;
        this.velocity.y = Math.sin(this.rotation) * this.speed;
        this.move(dt);
    }

    reset(): void {
        // Only user state — class overrides are restored automatically by NodePool
        this.speed = 400;
        this.damage = 25;
        this._lifetime = BULLET_LIFETIME;
        this._elapsed = 0;
    }
}
```

### 3.2 Changes to `BaseEnemy`

File: `examples/top-down-shooter/entities/base-enemy.tsx`

Remove from `reset()`:
```typescript
// DELETE these lines — NodePool handles them now:
this.collisionGroup = "enemies";
this.solid = true;
this.applyGravity = false;
this.upDirection._set(0, 0);
```

Keep only user state:
```typescript
reset(): void {
    this._health = this.maxHealth;
    this._playerRef = null;
    this._bulletManager = null;
    this._onDied = null;
}
```

### 3.3 Deliverables

- [x] Remove `_collisionConnected` guard flag from `PlayerBullet`
- [x] Remove `_collisionConnected` guard flag from `EnemyBullet`
- [x] Remove `_recycled` flag from `PlayerBullet` and `EnemyBullet`
- [x] Remove override-restoration lines from `PlayerBullet.reset()`
- [x] Remove override-restoration lines from `EnemyBullet.reset()`
- [x] Remove override-restoration lines from `BaseEnemy.reset()`
- [x] Connect collision signals in `onReady()` without guards
- [x] Verify shooter runs correctly via `pnpm dev` + manual play
- [x] Run existing tests: `pnpm test`

### 3.4 Tests

Extend existing shooter tests (or add new ones):

- Bullet acquires from pool with correct `collisionGroup` (no "default")
- Bullet acquires from pool with `applyGravity = false`
- Enemy acquires from pool with `solid = true` and correct group
- Bullet collision handler fires after pool reuse (signal reconnected)
- Bullet removed mid-slide-loop — no crash, no stale state

---

## Definition of Done

- [x] All phases marked Done in status table
- [x] `pnpm build` succeeds with no errors
- [x] `pnpm test` passes — all existing tests still pass (zero regressions)
- [x] `pnpm lint` clean
- [x] Shooter example runs with zero manual property restoration in `reset()`
- [x] No `_collisionConnected` or `_recycled` workaround flags in example code
- [x] Pooled Actor subclass with `override collisionGroup = "custom"` preserves group through pool cycles (verified by test)
