# Breakout Implementation Issues & Engine Lessons

This document records the bugs encountered during the Breakout example game implementation (Phase 9, Part 2) and proposes engine-level improvements to prevent them in the future.

---

## Bug 1: Spatial Hash Not Updated After Position Change (Critical)

### Symptom

Every collision in the game was broken. The ball passed through all 50 bricks, through the paddle, and only bounced off walls. Using `qdbg` to query the spatial hash revealed **all 50 bricks were registered at position (0,0)**, not at their actual grid positions.

### Root Cause

Setting `position` after `this.add()` does not update the spatial hash. The registration sequence is:

```
this.add(Brick)                     // 1. Creates Brick node
  _addChildNode(brick)              // 2. Adds to scene tree
    _enterTreeRecursive(brick)      // 3. Enters tree, calls onReady()
      CollisionObject.onReady()     // 4. Calls world.register(this)
        PhysicsWorld.register()     // 5. Gets AABB at current position -> (0,0)
          hash.insert(brick, aabb)  // 6. Stored in cell grid around (0,0)

brick.position = new Vec2(x, y)    // 7. Position changes, but hash is NOT updated
```

The position setter (`node2d.ts:44`) only calls `_markTransformDirty()`, which invalidates the transform cache but does **not** notify the physics world. The spatial hash still thinks the brick is at (0,0).

For `Actor` nodes (ball, paddle), this eventually self-corrects because `Actor.move()` calls `world.updatePosition(this)` every frame. But `StaticCollider` nodes (bricks, walls) have **no `move()` method** and never update their hash position after registration. They are permanently stuck wherever they were when `onReady()` fired.

### The Fix Applied

Pass `position` via the `add()` props parameter, which applies properties **before** the node enters the tree:

```typescript
// BEFORE (broken) — position set after registration
const brick = this.add(Brick);
brick.position = new Vec2(x, y);     // Too late, hash already recorded (0,0)

// AFTER (working) — position set before registration
const brick = this.add(Brick, {
  brickType: type,
  colorName: color,
  position: new Vec2(x, y),          // Applied by Object.assign before _addChildNode
});
```

In `Node.add()` (`node.ts:119-120`):
```typescript
const node = new nodeOrClass();
if (props) Object.assign(node, props);  // props applied HERE
this._addChildNode(node);               // tree entry (and onReady) happens HERE
```

### Why This Is a Footgun

This is the most dangerous kind of bug: the code **looks correct** and works for most node types, but silently fails for physics bodies. There is no error, no warning, and no visible feedback that the spatial hash is stale. The failure mode is that collisions simply don't happen, which is extremely difficult to diagnose without directly inspecting the spatial hash.

The pattern `const x = scene.add(Foo); x.position = ...;` is the most natural way to write scene setup code. It works perfectly for rendering (the sprite appears at the right position) but breaks physics silently. An LLM generating game code will write this pattern every time unless specifically told otherwise.

---

## Bug 2: Paddle Not Marked Solid (Medium)

### Symptom

Even after fixing the spatial hash issue, the ball still passed through the paddle.

### Root Cause

`Paddle` extends `Actor`, but never set `this.solid = true`. In `PhysicsWorld.castMotion()` (`physics-world.ts:308`), non-solid actors are skipped as collision candidates:

```typescript
if (candidate.bodyType === "actor" && !(candidate as Actor).solid) continue;
```

This is intentional design — actors are non-solid by default so they can overlap each other (e.g., enemies, projectiles). But for Breakout, the paddle must be solid so the ball bounces off it.

### The Fix Applied

```typescript
// paddle.tsx
override onReady() {
  super.onReady();
  this.collisionGroup = "paddle";
  this.solid = true;  // Required for ball to detect paddle as collision candidate
  // ...
}
```

### Why This Is Easy to Miss

The `solid` property defaults to `false` for Actors. The API name is clear, but there's no warning when a collision group config says `ball collides with paddle` yet the paddle is non-solid. The collision group configuration and the `solid` flag are two independent systems that must agree.

---

## Bug 3: Property Initialization Order (Low)

### Symptom

All bricks had health=1 and points=10 regardless of their configured type. "Hard" bricks (health=2, points=20) and "tough" bricks (health=3, points=30) behaved identically to normal bricks.

### Root Cause

Same pattern as Bug 1, but for non-position properties:

```typescript
const brick = this.add(Brick);  // onReady() fires, reads brickType="normal" (default)
brick.brickType = "hard";       // Too late — health/points already set from "normal"
```

### The Fix Applied

Pass `brickType` and `colorName` in the `add()` props parameter.

---

## Proposed Engine Improvements

### 1. Auto-Rehash on Position Change (Recommended)

**The core issue**: Setting `position` on a registered `CollisionObject` does not update the spatial hash. This should happen automatically.

**Proposed approach**: Override the position setter in `CollisionObject` to call `updatePosition()` when the node is registered:

```typescript
// collision-object.ts
override set position(v: Vec2) {
  super.position = v;
  if (this._registered) {
    const world = this._getWorld();
    if (world) world.updatePosition(this);
  }
}
```

Or better, hook into the `Vec2._onChange` callback that `Node2D` already sets up:

```typescript
// collision-object.ts — in onReady() or _registerInWorld()
const origOnChange = this._position._onChange;
this._position._onChange = () => {
  origOnChange?.();
  if (this._registered) {
    const world = this._getWorld();
    if (world) world.updatePosition(this);
  }
};
```

**Trade-off**: This adds a spatial hash update on every position write. For actors that use `move()` (which already calls `updatePosition`), this would be redundant work. The overhead is low (spatial hash `update()` early-exits if cells haven't changed) but not zero.

**Mitigation**: Only enable auto-rehash for `StaticCollider` and `Sensor`, since `Actor.move()` already handles it. Or add a dirty flag that defers the rehash to the next physics step.

### 2. Deferred Registration (Alternative)

Instead of registering immediately in `onReady()`, defer registration to the next physics step. This would allow position to be set between `add()` and the first physics tick:

```typescript
// collision-object.ts
override onReady(): void {
  super.onReady();
  this._pendingRegistration = true;  // Don't register yet
}

// Called by PhysicsWorld at start of each step
_flushPendingRegistration(): void {
  if (this._pendingRegistration) {
    this._registerInWorld();
    this._pendingRegistration = false;
  }
}
```

**Trade-off**: Introduces a one-frame delay before collision bodies become active. This could cause objects to overlap for a single frame, which may be acceptable or may cause issues with fast-moving objects.

### 3. Warn on Position Change After Registration Without Rehash

Add a development-only warning when a registered `CollisionObject`'s position changes without a subsequent `updatePosition()` call within the same frame:

```typescript
// collision-object.ts (dev mode only)
private _positionDirtySinceLastHash = false;

// In position onChange callback:
this._positionDirtySinceLastHash = true;

// In PhysicsWorld step end:
for (const body of registeredBodies) {
  if (body._positionDirtySinceLastHash && body.bodyType !== "actor") {
    console.warn(
      `${body.constructor.name} position changed without spatial hash update. ` +
      `Pass position in add() props or call world.updatePosition() explicitly.`
    );
  }
}
```

This catches the bug at development time without changing runtime behavior.

### 4. Warn When Collision Groups Disagree With Solid Flag

When collision group config says `A collides with B`, but `B` is a non-solid Actor, emit a development warning:

```typescript
// physics-world.ts — in castMotion() or register()
if (candidate.bodyType === "actor" && !candidate.solid) {
  if (shouldCollide(body.collisionGroup, candidate.collisionGroup)) {
    console.warn(
      `${body.collisionGroup} is configured to collide with ${candidate.collisionGroup}, ` +
      `but ${candidate.constructor.name} is a non-solid Actor. Set solid=true or remove from collision config.`
    );
  }
}
```

### Recommendation

**Option 1 (auto-rehash) is the strongest fix.** It eliminates the entire class of bugs. The position setter should keep the spatial hash in sync, just as `_markTransformDirty()` keeps the transform cache in sync. Users should never need to think about the spatial hash — it's an internal optimization detail that should be invisible.

**Option 3 (dev warning) should be added regardless**, as a safety net for any edge cases that auto-rehash doesn't cover.

---

## Files Modified in the Fix

| File | Change |
|------|--------|
| `examples/breakout/scenes/breakout-level.tsx` | Pass `position`, `brickType`, `colorName`, `velocity`, `powerUpType` via `add()` props instead of setting after |
| `examples/breakout/entities/paddle.tsx` | Set `this.solid = true` in `onReady()` |
| `examples/breakout/entities/ball.tsx` | Launch at ~20 degrees from vertical instead of straight up |
| `examples/breakout/__tests__/ball.test.ts` | Updated launch test to expect angled velocity |
