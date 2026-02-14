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
   * Defaults to PhysicsWorld.gravity.y at registration time.
   * Set to 0 for zero-gravity actors (e.g., top-down games, flying enemies).
   */
  gravity = 0;

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
  upDirection: Vec2 = Vec2.UP;

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
  private _floorNormal = Vec2.ZERO;
  private _wallNormal = Vec2.ZERO;
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

  /** All collisions from the last move() call. */
  getSlideCollisions(): readonly CollisionInfo[] { return this._slideCollisions; }

  // === Signals ===

  /** Emitted when this actor collides with another CollisionObject during move(). */
  readonly collided: Signal<CollisionInfo> = signal<CollisionInfo>();

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

### The move() Slide Loop

This is the most important algorithm in the physics package.

```
move(dt):
  ┌─── 1. GRAVITY ─────────────────────────────────────────┐
  │  if applyGravity:                                       │
  │    velocity.y += gravity * dt                           │
  └─────────────────────────────────────────────────────────┘
  ┌─── 2. INITIAL MOTION ──────────────────────────────────┐
  │  motion = velocity * dt                                 │
  │  slideCollisions = []                                   │
  └─────────────────────────────────────────────────────────┘
  ┌─── 3. SLIDE LOOP (up to maxSlides iterations) ─────────┐
  │  for i in 0..maxSlides:                                 │
  │    if motion.lengthSquared < EPSILON²: break            │
  │                                                         │
  │    collision = world.castMotion(this, motion)           │
  │                                                         │
  │    if no collision:                                     │
  │      position += motion                                 │
  │      break                                              │
  │                                                         │
  │    ┌─── RESOLVE COLLISION ──────────────────────────┐   │
  │    │  position += collision.travel                  │   │
  │    │  slideCollisions.push(collision)               │   │
  │    │  collided.emit(collision)                      │   │
  │    │                                                │   │
  │    │  // Slide: project remainder onto surface      │   │
  │    │  remainder = collision.remainder               │   │
  │    │  motion = remainder - normal * dot(remainder,  │   │
  │    │                                    normal)     │   │
  │    │                                                │   │
  │    │  // Kill velocity into surface                 │   │
  │    │  velDot = dot(velocity, normal)                │   │
  │    │  if velDot < 0:                                │   │
  │    │    velocity -= normal * velDot                  │   │
  │    └────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────┘
  ┌─── 4. MOVING PLATFORM CARRY ───────────────────────────┐
  │  If standing on a StaticCollider with constantVelocity: │
  │    position += platform.constantVelocity * dt           │
  └─────────────────────────────────────────────────────────┘
  ┌─── 5. UPDATE CONTACT FLAGS ────────────────────────────┐
  │  _onFloor = false; _onWall = false; _onCeiling = false │
  │  for each collision in slideCollisions:                 │
  │    angle = acos(dot(collision.normal, upDirection))     │
  │    if angle <= floorMaxAngle:                           │
  │      _onFloor = true                                    │
  │      _floorNormal = collision.normal                    │
  │    elif angle >= π - floorMaxAngle:                     │
  │      _onCeiling = true                                  │
  │    else:                                                │
  │      _onWall = true                                     │
  │      _wallNormal = collision.normal                     │
  └─────────────────────────────────────────────────────────┘
  ┌─── 6. RE-HASH ─────────────────────────────────────────┐
  │  world.updatePosition(this)                             │
  └─────────────────────────────────────────────────────────┘
```

**Why slide, not bounce?** Sliding projects remaining motion onto the surface tangent. Walking along walls feels natural instead of stopping dead.

**Why up to 4 iterations?** A single slide can push into another surface (e.g., corner). Each iteration resolves one collision.

**Transform-aware internally:** The slide loop calls `world.castMotion(this, motion)`, which internally uses `CollisionShape.getWorldTransform()` to pass `(shape, Matrix2D)` pairs to the SAT functions. The actor's public API (`move(dt)`, `moveAndCollide(motion)`, `isOnFloor()`, etc.) is unchanged. During a single `move()` call, only translation changes — rotation and scale are constant for the duration of the motion cast.

**Moving platform carry:** After the slide loop, if the actor is on a floor that's a StaticCollider with `constantVelocity`, position is adjusted by platform velocity × dt.

**One-way platform handling:** During `castMotion`, if the candidate is a StaticCollider with `oneWay = true`, the collision is only counted if the actor's motion opposes the one-way direction and the actor's bottom is above the platform's top.

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
  oneWayDirection: Vec2 = Vec2.UP;
}
```

**Design decisions:**
- **No velocity, no physics sim.** Infinitely heavy. Position manually or via code.
- **`constantVelocity` for moving platforms.** Actor on top is carried. The actor's `move()` adds the platform velocity × dt.
- **One-way platforms.** Actors pass through from below, land on top. Only resolved when motion opposes `oneWayDirection` and actor is above platform.
- **No `onFixedUpdate` override.** StaticColliders just exist in the spatial hash. Users can override for custom behavior (e.g., moving platform code).

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

  /**
   * Whether other sensors can detect this sensor.
   * When false, this sensor is invisible to other sensors' entered/exited.
   * Default: true.
   */
  monitorable = true;

  // === Signals ===

  /** Emitted when an Actor or StaticCollider enters this sensor's area. */
  readonly bodyEntered: Signal<CollisionObject> = signal<CollisionObject>();

  /** Emitted when an Actor or StaticCollider exits this sensor's area. */
  readonly bodyExited: Signal<CollisionObject> = signal<CollisionObject>();

  /** Emitted when another Sensor enters this sensor's area. */
  readonly sensorEntered: Signal<Sensor> = signal<Sensor>();

  /** Emitted when another Sensor exits this sensor's area. */
  readonly sensorExited: Signal<Sensor> = signal<Sensor>();

  // === Overlap Queries ===

  /** Get all Actors and StaticColliders currently overlapping this sensor. */
  getOverlappingBodies(): CollisionObject[] {
    const world = this._getWorld();
    return world ? world.getOverlappingBodies(this) : [];
  }

  /** Get all other Sensors currently overlapping this sensor. */
  getOverlappingSensors(): Sensor[] {
    const world = this._getWorld();
    return world ? world.getOverlappingSensors(this) : [];
  }
}
```

**Design decisions:**
- **Signals for enter/exit events.** Type-safe, discoverable, auto-disconnect on destroy.
- **Separate body/sensor signals.** Most game logic only cares about bodies.
- **`monitoring`/`monitorable` toggles.** Save CPU for inactive sensors.
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
- Actor gravity defaults to PhysicsWorld gravity

### static-collider.test.ts
- Actor collides with StaticCollider → Actor stops, StaticCollider doesn't move
- StaticCollider with `constantVelocity` → Actor on top is carried
- `oneWay = true` → Actor passes through from below, stops from above
- One-way platform: actor on top, walks off edge, can re-land

### sensor.test.ts
- `bodyEntered` fires when Actor overlaps Sensor
- `bodyExited` fires when Actor leaves Sensor
- `sensorEntered` fires when two Sensors overlap
- `sensorExited` fires when Sensors separate
- `monitoring = false` → no signals fire
- `monitorable = false` → other sensors don't detect this one
- `getOverlappingBodies()` returns current overlaps
- Signal fires once per enter (no duplicates on sustained overlap)
- Exited fires when overlapping body is destroyed
- Exited fires when sensor is disabled

---

## Completion Checklist

- [ ] `Actor.move()` applies gravity, slides along surfaces, updates contact flags
- [ ] `Actor.moveAndCollide()` returns first collision without sliding
- [ ] `isOnFloor()`/`isOnWall()`/`isOnCeiling()` work correctly
- [ ] Floor detection uses `upDirection` and `floorMaxAngle`
- [ ] `collided` signal fires for each collision
- [ ] `StaticCollider` is immovable, blocks actors
- [ ] `constantVelocity` carries actors on moving platforms
- [ ] One-way platforms work (pass through below, land above)
- [ ] `Sensor.bodyEntered`/`bodyExited` fire correctly
- [ ] `Sensor.sensorEntered`/`sensorExited` fire correctly
- [ ] `monitoring`/`monitorable` toggles work
- [ ] No phantom events on destroy
- [ ] All tests pass, `pnpm build` succeeds
