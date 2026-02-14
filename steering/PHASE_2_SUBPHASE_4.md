# Phase 2, Subphase 4: Physics Bodies

> **Steps 7–8** | **Duration:** ~2.5 days
> **Depends on:** Subphase 3 (CollisionObject, CollisionShape, PhysicsWorld, PhysicsPlugin)
> **Produces:** Actor with `move()`, StaticCollider (moving platforms, one-way), Sensor (overlap tracking, entered/exited signals) — all with tests.

**Reference:** [PHASE_2_DESIGN_CORE.md](./PHASE_2_DESIGN_CORE.md) for architecture overview and cross-cutting concerns.

---

## Step 7: Actor + move() (1.5 days)

The workhorse class. Code-controlled movement with collision response.

**File:** `packages/physics/src/actor.ts`

```typescript
import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { CollisionObject, type BodyType } from "./collision-object.js";
import type { CollisionInfo } from "./collision-info.js";

export class Actor extends CollisionObject {
  readonly bodyType: BodyType = "actor";

  // === Movement State ===

  /** Current velocity in pixels/second. Modified by move(). */
  velocity: Vec2 = new Vec2(0, 0);

  /**
   * Gravity in pixels/second² applied during move().
   * Initialized to PhysicsWorld.gravity.y in onReady() (after registration).
   * Set to 0 for zero-gravity actors (e.g., top-down games, flying enemies).
   */
  gravity = 0;

  // In onReady(): this.gravity = this._getWorld()?.gravity.y ?? 0;

  /**
   * Whether move() should apply gravity automatically.
   * When true (default), velocity.y += gravity * dt before collision detection.
   * Set to false for fully manual velocity control.
   */
  applyGravity = true;

  // === Surface Detection Config ===

  /**
   * The "up" direction for floor/ceiling detection.
   * Default: Vec2.UP (0, -1) for standard side-view platformer.
   * Set to Vec2.ZERO for a top-down game (no floor concept).
   */
  upDirection: Vec2 = new Vec2(0, -1);

  /**
   * Maximum angle (radians) between a surface normal and upDirection
   * for the surface to count as "floor". Default: π/4 (45°).
   */
  floorMaxAngle: number = Math.PI / 4;

  /**
   * Maximum number of slide iterations per move() call.
   * Higher = more accurate corner handling. Default: 4.
   */
  maxSlides = 4;

  // === Contact State (updated by move()) ===

  private _onFloor = false;
  private _onWall = false;
  private _onCeiling = false;
  private _floorNormal = new Vec2(0, 0);
  private _wallNormal = new Vec2(0, 0);
  private _floorCollider: CollisionObject | null = null;
  private _slideCollisions: CollisionInfo[] = [];

  /** True if the last move() detected floor contact. */
  isOnFloor(): boolean { return this._onFloor; }

  /** True if the last move() detected wall contact. */
  isOnWall(): boolean { return this._onWall; }

  /** True if the last move() detected ceiling contact. */
  isOnCeiling(): boolean { return this._onCeiling; }

  /** Normal of the floor surface. Zero if not on floor. */
  getFloorNormal(): Vec2 { return this._floorNormal; }

  /** Normal of the wall surface. Zero if not on wall. */
  getWallNormal(): Vec2 { return this._wallNormal; }

  /** All collisions from the last move() call. Only valid until the next move(). */
  getSlideCollisions(): readonly CollisionInfo[] { return this._slideCollisions; }

  // === Signals ===

  /** Emitted when this actor collides with another CollisionObject during move(). */
  readonly collided: Signal<CollisionInfo> = signal<CollisionInfo>();

  // onDestroy(): disconnect custom signals (collided) to prevent memory leaks.

  // === Movement API ===

  /**
   * The primary movement method. Moves this actor by velocity × dt,
   * sliding along surfaces on collision.
   *
   * 1. Applies gravity (if applyGravity is true)
   * 2. Casts collision shape along motion vector
   * 3. On collision: separates, slides along surface, repeats
   * 4. Updates floor/wall/ceiling flags
   * 5. Zeroes velocity component into collision surfaces
   *
   * Call this in onFixedUpdate().
   */
  move(dt: number): void;

  /**
   * Lower-level movement. Moves by an explicit motion vector (not velocity × dt).
   * Returns the first collision, or null if no collision.
   * Does NOT slide — stops at the first collision.
   * Does NOT apply gravity or update contact flags.
   */
  moveAndCollide(motion: Vec2): CollisionInfo | null;
}
```

### Design Decisions

- **`move()` applies gravity automatically.** Reduces boilerplate and eliminates forgetting gravity. Opt out with `applyGravity = false`.
- **`gravity` defaults to world gravity at registration time.** Actors automatically fall in a side-view game. For top-down, set `PhysicsWorld.gravity` to `Vec2.ZERO`.
- **`move()` updates velocity.** After sliding along a wall, velocity component into the wall is zeroed. Prevents velocity accumulating into surfaces.
- **`moveAndCollide()` for advanced use.** Bullets that explode on impact, etc. Gives collision without sliding.
- **`maxSlides = 4` default.** Handles corners, narrow tunnels, multi-body pileups. Most frames use 0 or 1.
- **`upDirection` for flexible orientation.** Side-scrollers: `Vec2.UP`. Top-down: `Vec2.ZERO`.
- **`floorMaxAngle` for slopes.** 45° default. Slopes up to this angle are floors; steeper = walls.
- **`collided` signal.** Emitted for each collision during `move()`.
- **Actors only collide with statics, not other actors.** `castMotion()` skips candidates with `bodyType === "actor"`. Godot allows CharacterBody-to-CharacterBody collision by default, but it causes well-known "sticking together" bugs because resolution is one-directional and depends on `onFixedUpdate` execution order. Our approach: use Sensors or collision groups for actor-vs-actor interaction (e.g., enemies pushing the player = a Sensor + knockback signal). This is simpler, deterministic, and avoids an entire class of ordering bugs.

### The move() Slide Loop

This is the most important algorithm in the physics package.

```
move(dt):
  ┌─── 1. GRAVITY ─────────────────────────────────────────┐
  │  if applyGravity:                                       │
  │    if _onFloor:                                         │
  │      velocity.y = FLOOR_SNAP_GRAVITY  // small constant │
  │      // (e.g. 1 px/s — just enough to re-detect floor  │
  │      //  without accumulating large downward velocity)  │
  │    else:                                                │
  │      velocity.y += gravity * dt                         │
  └─────────────────────────────────────────────────────────┘
  ┌─── 2. INITIAL MOTION ──────────────────────────────────┐
  │  motion = velocity * dt                                 │
  │  _slideCollisions.length = 0  // reuse array            │
  │  totalDisplacement = Vec2(0, 0)                         │
  └─────────────────────────────────────────────────────────┘
  ┌─── 3. SLIDE LOOP (up to maxSlides iterations) ─────────┐
  │  for i in 0..maxSlides:                                 │
  │    if motion.lengthSquared < EPSILON²: break            │
  │                                                         │
  │    collision = world.castMotion(this, motion)           │
  │    // castMotion skips sensors AND other actors          │
  │                                                         │
  │    if no collision:                                     │
  │      totalDisplacement += motion                        │
  │      break                                              │
  │                                                         │
  │    ┌─── DEPENETRATION (toi = 0) ───────────────────┐   │
  │    │  if collision.toi == 0:                        │   │
  │    │    // Already overlapping — push out first     │   │
  │    │    totalDisplacement += normal * collision.    │   │
  │    │                                     depth     │   │
  │    │    // Recompute motion from corrected position │   │
  │    │    continue                                    │   │
  │    └────────────────────────────────────────────────┘   │
  │                                                         │
  │    ┌─── RESOLVE COLLISION ──────────────────────────┐   │
  │    │  // Apply safe margin: stop slightly before    │   │
  │    │  // contact to prevent float-precision embed   │   │
  │    │  safeTravel = collision.travel                 │   │
  │    │              - normal * SAFE_MARGIN            │   │
  │    │  totalDisplacement += safeTravel               │   │
  │    │  _slideCollisions.push(collision)              │   │
  │    │  collided.emit(collision)                      │   │
  │    │                                                │   │
  │    │  // Slide: project remainder onto surface      │   │
  │    │  remainder = collision.remainder               │   │
  │    │              + normal * SAFE_MARGIN            │   │
  │    │  motion = remainder - normal * dot(remainder,  │   │
  │    │                                    normal)     │   │
  │    │                                                │   │
  │    │  // Kill velocity into surface                 │   │
  │    │  velDot = dot(velocity, normal)                │   │
  │    │  if velDot < 0:                                │   │
  │    │    velocity -= normal * velDot                  │   │
  │    └────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────┘
  ┌─── 4. APPLY DISPLACEMENT (batched) ───────────────────┐
  │  position += totalDisplacement                         │
  │  // Single position write → one dirty propagation      │
  └────────────────────────────────────────────────────────┘
  ┌─── 5. UPDATE CONTACT FLAGS ────────────────────────────┐
  │  _onFloor = false; _onWall = false; _onCeiling = false │
  │  _floorCollider = null                                  │
  │  for each collision in _slideCollisions:                │
  │    angle = acos(dot(collision.normal, upDirection))     │
  │    if angle <= floorMaxAngle:                           │
  │      _onFloor = true                                    │
  │      _floorNormal = collision.normal                    │
  │      _floorCollider = collision.other                   │
  │    elif angle >= π - floorMaxAngle:                     │
  │      _onCeiling = true                                  │
  │    else:                                                │
  │      _onWall = true                                     │
  │      _wallNormal = collision.normal  // last wall wins  │
  └─────────────────────────────────────────────────────────┘
  ┌─── 6. MOVING PLATFORM CARRY ───────────────────────────┐
  │  if _floorCollider is StaticCollider                    │
  │     && _floorCollider.constantVelocity != Vec2.ZERO:   │
  │    carry = _floorCollider.constantVelocity * dt         │
  │    carryCollision = world.castMotion(this, carry)       │
  │    if carryCollision:                                   │
  │      position += carryCollision.travel                  │
  │    else:                                                │
  │      position += carry                                  │
  └─────────────────────────────────────────────────────────┘
  ┌─── 7. RE-HASH ─────────────────────────────────────────┐
  │  world.updatePosition(this)                             │
  └─────────────────────────────────────────────────────────┘
```

**SAFE_MARGIN constant:** `0.01` pixels. Prevents float-precision embedding without visible gaps. Godot uses `0.08` as its `safe_margin` default; ours is smaller because we're pixel-art-oriented.

**FLOOR_SNAP_GRAVITY:** A small constant (e.g., `1 px/s`) applied when already on the floor. Avoids accumulating large downward velocity every frame (which signal handlers on `collided` would see as a phantom impulse). Just enough to re-detect the floor via the slide loop.

**Why slide, not bounce?** Sliding projects remaining motion onto the surface tangent. Walking along walls feels natural instead of stopping dead.

**Why up to 4 iterations?** A single slide can push into another surface (e.g., corner). Each iteration resolves one collision.

**Batched displacement:** The slide loop accumulates `totalDisplacement` instead of writing to `position` each iteration. This triggers `_markTransformDirty()` only once at the end, avoiding redundant dirty propagation through child CollisionShapes. The `castMotion` calls use the actor's current position + accumulated displacement.

**Depenetration at toi=0:** If `castMotion` returns `toi = 0`, the shapes already overlap (from float rounding, platform carry, etc.). The loop pushes the actor out by `normal * depth` before continuing. Without this, the slide loop makes zero progress and the actor gets stuck.

**Safe margin:** After computing travel, the actor stops `SAFE_MARGIN` (0.01px) before the contact surface. This prevents float-precision embedding that causes toi=0 on the next frame. The remainder is increased by the same amount so total motion is preserved.

**Transform-aware internally:** The slide loop calls `world.castMotion(this, motion)`, which internally uses `CollisionShape.getWorldTransform()` to pass `(shape, Matrix2D)` pairs to the SAT functions. The actor's public API (`move(dt)`, `moveAndCollide(motion)`, `isOnFloor()`, etc.) is unchanged. During a single `move()` call, only translation changes — rotation and scale are constant for the duration of the motion cast.

**Actor-vs-actor:** `castMotion` skips candidates with `bodyType === "actor"`. Actors pass through each other. Use Sensors for actor-vs-actor game logic (damage zones, push areas, etc.).

**Moving platform carry:** After contact flags are computed (so we know which collider is the floor), if the floor is a StaticCollider with `constantVelocity`, the actor is carried by `platform.constantVelocity * dt`. The carry displacement is collision-tested via `castMotion` to prevent clipping into walls.

**One-way platform handling:** `castMotion` must implement one-way filtering. When the candidate is a StaticCollider with `oneWay = true`, the collision is only counted if the actor's motion opposes the one-way direction and the actor's bottom is above the platform's top. This requires `castMotion` to check `bodyType === "static"` and access one-way properties — either via a type check or an abstract `shouldCollideWith(body, motion)` method on `CollisionObject` that `StaticCollider` overrides.

---

## Step 8: StaticCollider + Sensor (1 day)

### 8.1 StaticCollider

An immovable collision object. Platforms, walls, ground.

**File:** `packages/physics/src/static-collider.ts`

```typescript
import { Vec2 } from "@quintus/math";
import { CollisionObject, type BodyType } from "./collision-object.js";

export class StaticCollider extends CollisionObject {
  readonly bodyType: BodyType = "static";

  /**
   * Velocity for moving platforms.
   * StaticColliders don't move via physics — they're positioned by code.
   * But if this is set, actors standing on this collider inherit the velocity,
   * so they "ride" the platform without sliding off.
   *
   * Default: Vec2.ZERO (truly static).
   */
  constantVelocity: Vec2 = new Vec2(0, 0);

  /**
   * Whether this collider acts as one-way (e.g., jump-through platforms).
   * When true, only collisions from above (in the direction of upDirection)
   * are resolved. The actor can pass through from below.
   * Default: false.
   */
  oneWay = false;

  /**
   * The "up" direction for one-way detection.
   * Only relevant when oneWay is true.
   * Default: Vec2.UP (0, -1) — collisions from above only.
   */
  oneWayDirection: Vec2 = new Vec2(0, -1);
}
```

**Design decisions:**
- **No velocity, no physics sim.** Infinitely heavy. Position manually or via code.
- **`constantVelocity` for moving platforms.** Actor on top is carried. The actor's `move()` adds the platform velocity × dt.
- **One-way platforms.** Actors pass through from below, land on top. Only resolved when motion opposes `oneWayDirection` and actor is above platform.
- **No `onFixedUpdate` override.** StaticColliders just exist in the spatial hash. Users can override for custom behavior (e.g., moving platform code).
- **Platform sync ordering.** If a StaticCollider moves in its `onFixedUpdate`, the spatial hash has its old position until re-hashed. This means collision detection against a moving platform is one frame behind. Acceptable for most games. If precise sync is needed, the user should call `world.updatePosition(this)` after moving the StaticCollider.

### 8.2 Sensor

Overlap detection without collision response.

**File:** `packages/physics/src/sensor.ts`

```typescript
import { type Signal, signal } from "@quintus/core";
import { CollisionObject, type BodyType } from "./collision-object.js";

export class Sensor extends CollisionObject {
  readonly bodyType: BodyType = "sensor";

  /**
   * Whether this sensor detects other bodies overlapping it.
   * When false, entered/exited signals don't fire.
   * Default: true.
   */
  monitoring = true;

  // === Signals ===

  /** Emitted when an Actor or StaticCollider enters this sensor's area. */
  readonly bodyEntered: Signal<CollisionObject> = signal<CollisionObject>();

  /** Emitted when an Actor or StaticCollider exits this sensor's area. */
  readonly bodyExited: Signal<CollisionObject> = signal<CollisionObject>();

  /** Emitted when another Sensor enters this sensor's area. */
  readonly sensorEntered: Signal<Sensor> = signal<Sensor>();

  /** Emitted when another Sensor exits this sensor's area. */
  readonly sensorExited: Signal<Sensor> = signal<Sensor>();

  // onDestroy(): disconnect all custom signals to prevent memory leaks.

  // === Overlap Queries ===

  /** Get all Actors and StaticColliders currently overlapping this sensor. */
  getOverlappingBodies(): CollisionObject[] {
    const world = this._getWorld();
    return world ? world.getOverlappingBodies(this) : [];
  }

  /** Get all other Sensors currently overlapping this sensor. */
  getOverlappingSensors(): Sensor[] {
    const world = this._getWorld();
    // PhysicsWorld.getOverlappingSensors must return Sensor[] (type-safe filter)
    return world ? world.getOverlappingSensors(this) : [];
  }
}
```

**Design decisions:**
- **Signals for enter/exit events.** Type-safe, discoverable, auto-disconnect on destroy.
- **Separate body/sensor signals.** Most game logic only cares about bodies.
- **`monitoring` toggle.** Save CPU for inactive sensors. No `monitorable` flag — all sensors are detectable. Use collision groups to hide a sensor from other sensors if needed.
- **Enter/exit tracking is global.** PhysicsWorld maintains `Map<Sensor, Set<CollisionObject>>`. Diffs each frame.
- **`getOverlappingBodies()` queries current state.** Returns the cached set from the last `stepSensors()` call.

### Sensor Overlap Tracking Algorithm

Run once per `postFixedUpdate` by `PhysicsWorld.stepSensors()`:

```
stepSensors():
  for each sensor in registeredSensors:
    if not sensor.monitoring: continue

    ┌─── COMPUTE CURRENT OVERLAPS ─────────────────────────┐
    │  aabb = sensor.getWorldAABB()                        │
    │  candidates = spatialHash.query(aabb)                │
    │  currentOverlaps = new Set()                         │
    │                                                      │
    │  for each candidate:                                 │
    │    if candidate === sensor: skip                     │
    │    if not groups.shouldCollide(sensor, candidate):   │
    │      skip                                            │
    │    if narrowPhase overlap (SAT):                     │
    │      currentOverlaps.add(candidate)                  │
    └──────────────────────────────────────────────────────┘

    ┌─── DIFF WITH PREVIOUS FRAME ─────────────────────────┐
    │  previousOverlaps = sensorOverlaps.get(sensor)       │
    │                                                      │
    │  // Entered: in current but not previous             │
    │  for each body in currentOverlaps:                   │
    │    if body not in previousOverlaps:                  │
    │      if body is Sensor:                              │
    │        sensor.sensorEntered.emit(body)               │
    │      else:                                           │
    │        sensor.bodyEntered.emit(body)                 │
    │                                                      │
    │  // Exited: in previous but not current              │
    │  for each body in previousOverlaps:                  │
    │    if body not in currentOverlaps:                   │
    │      if body is Sensor:                              │
    │        sensor.sensorExited.emit(body)                │
    │      else:                                           │
    │        sensor.bodyExited.emit(body)                  │
    │                                                      │
    │  sensorOverlaps.set(sensor, currentOverlaps)         │
    └──────────────────────────────────────────────────────┘
```

**On body destroy:** Removed from all sensor overlap sets → triggers exited events. No phantom events.

**On sensor destroy:** Its overlap set is deleted. Other sensors tracking it see it disappear in the next `stepSensors()` call.

**Usage:**

```typescript
class Coin extends Sensor {
  readonly collected = signal<void>();

  onReady() {
    this.addChild(CollisionShape).shape = Shape.circle(8);
    this.collisionGroup = "items";
    this.bodyEntered.connect((body) => {
      if (body.hasTag("player")) {
        this.collected.emit();
        this.destroy();
      }
    });
  }
}

class DamageZone extends Sensor {
  damage = 1;

  onReady() {
    this.addChild(CollisionShape).shape = Shape.rect(32, 32);
    this.bodyEntered.connect((body) => {
      if (body instanceof Actor && body.hasTag("player")) {
        (body as Player).hurt(this.damage);
      }
    });
  }
}
```

---

## Test Plan

### actor.test.ts
- `move()` applies gravity when `applyGravity = true`
- `move()` does not apply gravity when `applyGravity = false`
- `move()` with no collision → position updates by velocity × dt
- `move()` with floor collision → stops on floor, `isOnFloor()` true
- `move()` with wall collision → slides along wall, `isOnWall()` true
- `move()` with ceiling collision → `isOnCeiling()` true
- `move()` velocity zeroed into collision surface
- `moveAndCollide()` returns first collision, no sliding
- `getSlideCollisions()` contains all collisions from last `move()`
- `collided` signal fires for each collision
- Floor detection uses `upDirection` and `floorMaxAngle`
- Slope within `floorMaxAngle` → `isOnFloor()` true, slides along slope
- Slope beyond `floorMaxAngle` → `isOnWall()` true, slides down
- `maxSlides = 1` → stops at first collision, no slide
- Actor gravity defaults to PhysicsWorld gravity (initialized in `onReady`)
- Actor does not collide with other actors (passes through)
- Depenetration: actor overlapping at toi=0 is pushed out, not stuck
- Safe margin: actor stops slightly before contact surface, no embedding
- Gravity snap: on floor, velocity.y stays small (no phantom accumulation)
- Batched displacement: position is written once per `move()`, not per slide iteration

### static-collider.test.ts
- Actor collides with StaticCollider → Actor stops, StaticCollider doesn't move
- StaticCollider with `constantVelocity` → Actor on top is carried
- Moving platform carry is collision-tested (actor not pushed into wall)
- `oneWay = true` → Actor passes through from below, stops from above
- One-way platform: actor on top, walks off edge, can re-land

### sensor.test.ts
- `bodyEntered` fires when Actor overlaps Sensor
- `bodyExited` fires when Actor leaves Sensor
- `sensorEntered` fires when two Sensors overlap
- `sensorExited` fires when Sensors separate
- `monitoring = false` → no signals fire
- `getOverlappingBodies()` returns current overlaps
- `getOverlappingSensors()` returns `Sensor[]` (type-safe)
- Signal fires once per enter (no duplicates on sustained overlap)
- Exited fires when overlapping body is destroyed
- Exited fires when sensor is disabled
- Sensor moves to overlap stationary actor → `bodyEntered` fires
- Multiple bodies enter sensor in same frame → all get `bodyEntered`
- Sensor with no CollisionShape children → no errors, no signals
- Mutual detection: sensor A overlaps B → both fire `sensorEntered`
- Re-enabling `monitoring` while overlapping → `bodyEntered` fires for existing overlaps

---

## Completion Checklist

- [ ] `Actor.move()` applies gravity, slides along surfaces, updates contact flags
- [ ] `Actor.moveAndCollide()` returns first collision without sliding
- [ ] `isOnFloor()`/`isOnWall()`/`isOnCeiling()` work correctly
- [ ] Floor detection uses `upDirection` and `floorMaxAngle`
- [ ] `collided` signal fires for each collision
- [ ] Actor gravity initialized from `PhysicsWorld.gravity.y` in `onReady()`
- [ ] Actors skip other actors in `castMotion` (no actor-vs-actor collision)
- [ ] Safe margin prevents float-precision embedding
- [ ] Depenetration handles toi=0 (overlapping shapes pushed apart)
- [ ] Floor snap gravity prevents phantom velocity accumulation on floor
- [ ] Slide loop batches displacement (single `position` write)
- [ ] `StaticCollider` is immovable, blocks actors
- [ ] `constantVelocity` carries actors on moving platforms (collision-tested)
- [ ] One-way platforms work (pass through below, land above)
- [ ] One-way filtering implemented in `castMotion`
- [ ] `Sensor.bodyEntered`/`bodyExited` fire correctly
- [ ] `Sensor.sensorEntered`/`sensorExited` fire correctly
- [ ] `monitoring` toggle works
- [ ] Custom signals disconnected in `onDestroy()` (Actor + Sensor)
- [ ] No phantom events on destroy
- [ ] All tests pass, `pnpm build` succeeds
