# Fix Collision Events & Actor-to-Actor Collisions

> **Goal:** Enable actor-to-actor collision/overlap detection and provide convenient `game.physics.onContact()` / `game.physics.onOverlap()` APIs for the Phase 6 platformer.
> **Scope:** Backward-compatible changes to `@quintus/physics` only.
> **Status:** Partially implemented — see Section 6 for what's done vs. remaining.

---

## 1. Problem Diagnosis

### What Exists

| Feature | Status | Location |
|---------|--------|----------|
| Actor → StaticCollider collision | Working | `castMotion()` in PhysicsWorld |
| Actor `collided` signal | Working | Fires during `move()` slide loop |
| Sensor `bodyEntered`/`bodyExited` | Working | `stepSensors()` in PhysicsWorld |
| Sensor `sensorEntered`/`sensorExited` | Working | `stepSensors()` in PhysicsWorld |
| Sensor `monitoring` toggle | Working | Controls overlap detection |
| Collision groups | Working | Filters both castMotion and sensor overlaps |

### What's Missing

**1. No actor-to-actor collision detection.**
`castMotion()` explicitly skips actors (`if (candidate.bodyType === "actor") continue;`), so actors pass through each other. The `collided` signal never fires for actor-actor contact, and no overlap events exist for actors.

**2. No `bodyEntered`/`bodyExited` on Actor or StaticCollider.**
These signals only exist on Sensor. To detect actor-actor overlap (e.g., player touching enemy), users must attach a child Sensor to every actor — verbose, error-prone, and inconsistent with Godot-inspired design goals.

**3. No `game.physics` accessor.**
Unlike `game.input` and `game.audio`, there's no `game.physics` convenience accessor.

**4. No centralized collision/overlap API.**
The Phase 6 platformer needs scene-level orchestration for player-enemy stomp logic, player-coin collection, etc.

### Two Kinds of Collision Events

The engine needs to distinguish between two fundamentally different events:

| | **Contact** (physical collision) | **Overlap** (area detection) |
|---|---|---|
| What happens | Bodies touch, physics pushes them apart | Bodies share the same space |
| Bodies overlap? | No — resolved before next frame | Yes — that's the whole point |
| Data available | Normal, impact velocity, contact point | Just enter/exit + who |
| Use case | Stomp detection, bounce, wall slide | Pickups, triggers, zones, damage areas |
| Current mechanism | `Actor.collided` signal (fires during `move()`) | `bodyEntered`/`bodyExited` (monitoring system) |

**Key insight:** When actor-to-actor physical blocking is added (Section 2.4), `move()` detects the contact and pushes bodies apart — they never actually overlap. So `bodyEntered` never fires. The platformer's stomp detection needs the *contact* event, not the overlap event.

---

## 2. Design

### Four changes, in priority order:

### 2.1 Generalize Overlap Monitoring from Sensor to CollisionObject

Move `bodyEntered`/`bodyExited` signals from Sensor to CollisionObject base class. Add a `monitoring` property that controls whether the body participates in overlap detection.

**Defaults:**
- `Actor`: `monitoring = false` (opt-in for overlap detection)
- `StaticCollider`: `monitoring = false` (typically don't need overlap events)
- `Sensor`: `monitoring = true` (backward compatible)

### 2.2 Virtual Methods + Signals (Dual Pattern)

Physics events use the same dual pattern as lifecycle events (`onReady`, `onUpdate`, etc.):

- **Override** the virtual method when the body handles its own event (simple, common case)
- **Connect** to the signal when external code needs to observe (scene orchestration, multiple listeners)

The virtual method emits the signal by default, so both patterns work together:

```typescript
// CollisionObject base class
abstract class CollisionObject extends Node2D {
  readonly bodyEntered: Signal<CollisionObject> = signal<CollisionObject>();
  readonly bodyExited: Signal<CollisionObject> = signal<CollisionObject>();

  /** Override for self-handling. Default emits the signal. */
  onBodyEntered(body: CollisionObject): void {
    this.bodyEntered.emit(body);
  }

  /** Override for self-handling. Default emits the signal. */
  onBodyExited(body: CollisionObject): void {
    this.bodyExited.emit(body);
  }
}
```

**Self-handling pattern (override):**
```typescript
class Coin extends Sensor {
  onBodyEntered(body: CollisionObject) {
    super.onBodyEntered(body); // still emits signal for external listeners
    if (body.hasTag("player")) {
      this.collected.emit();
      this.destroy();
    }
  }
}

class Lava extends StaticCollider {
  override monitoring = true;

  onBodyEntered(body: CollisionObject) {
    super.onBodyEntered(body);
    if (body instanceof Actor) body.takeDamage();
  }
}
```

**External observation pattern (signal):**
```typescript
// Scene-level logic — Coin class doesn't know about scoring
coin.bodyEntered.connect((body) => {
  if (body.hasTag("player")) {
    score += 10;
    hud.update();
  }
});
```

**Rule of thumb:** Override when the body handles its own event. Connect when something else needs to observe.

### 2.3 Add `game.physics` Accessor + `onOverlap()` / `onContact()` APIs

Follow the existing pattern from `@quintus/input` (WeakMap + `Object.defineProperty` + module augmentation).

```typescript
// augment.ts
declare module "@quintus/core" {
  interface Game {
    get physics(): PhysicsWorld;
  }
}
```

Add two centralized APIs to PhysicsWorld:

#### `onOverlap()` — bodies sharing the same space

```typescript
class PhysicsWorld {
  /**
   * Register a callback that fires when bodies in groupA first overlap bodies in groupB.
   * Built on top of the monitoring system — automatically enables monitoring on target bodies.
   * Returns a dispose function.
   */
  onOverlap(
    groupA: string,
    groupB: string,
    onEnter: (bodyA: CollisionObject, bodyB: CollisionObject) => void,
    onExit?: (bodyA: CollisionObject, bodyB: CollisionObject) => void,
  ): () => void;
}
```

**Semantics:**
- Fires `onEnter` on the first frame of overlap, `onExit` when overlap ends
- Automatically sets `monitoring = true` on bodies in target groups (opt-in is for the per-body API; the global API implies you want detection)
- Built on top of `_stepBodyMonitoring()` — shares the same spatial hash broad-phase and respects collision groups
- Returns a dispose function for cleanup

**Usage:**
```typescript
// Player-coin collection (overlap — coins don't block the player)
game.physics.onOverlap("player", "coins", (player, coin) => {
  score += 10;
  coin.destroy();
});
```

#### `onContact()` — physical collisions (bodies pushed apart)

```typescript
class PhysicsWorld {
  /**
   * Register a callback that fires when bodies in groupA physically collide
   * with bodies in groupB during move(). Provides collision info (normal, etc).
   * Returns a dispose function.
   */
  onContact(
    groupA: string,
    groupB: string,
    callback: (bodyA: CollisionObject, bodyB: CollisionObject, info: CollisionInfo) => void,
  ): () => void;
}
```

**Semantics:**
- Fires when `castMotion()` detects a collision during `move()` — bodies are pushed apart, never overlap
- Provides CollisionInfo (normal, contact point, travel, depth) for game logic
- Built on top of the existing `collided` signal infrastructure — listens to collided events and filters by group
- Returns a dispose function for cleanup

**Usage:**
```typescript
// Player-enemy stomp vs damage (contact — physics pushes them apart)
game.physics.onContact("player", "enemies", (player, enemy, info) => {
  if (info.normal.y < 0) {
    // Player landed on enemy from above
    (enemy as PatrolEnemy).stomp();
    (player as Player).velocity.y = -200;
  } else {
    (player as Player).takeDamage();
  }
});
```

**Why two APIs instead of one:**

| | `onOverlap()` | `onContact()` |
|---|---|---|
| Bodies overlap? | Yes | No — pushed apart by physics |
| Has exit callback? | Yes (`onExit` parameter) | No — contact is instantaneous |
| Collision data? | No — just who entered/exited | Yes — normal, point, depth |
| Requires `move()`? | No — works for any body type | Yes — only fires during `move()` |
| Use case | Pickups, triggers, zones | Stomp, bounce, damage on impact |

### 2.4 Actor-to-Actor Physical Collision (`solid` property)

Add a `solid` property to Actor that makes it a physical obstacle for other actors' `move()`. When an actor's `castMotion()` encounters a solid actor, it collides and slides against it — exactly like hitting a StaticCollider.

```typescript
class Actor extends CollisionObject {
  /**
   * When true, other actors' move() treats this actor as a physical obstacle.
   * Their castMotion() will detect this actor, slide against it, and fire onCollided.
   * Default: false (actors pass through each other).
   */
  solid = false;
}
```

**How it works:**

Currently `castMotion()` has `if (candidate.bodyType === "actor") continue;`. Change to:

```typescript
if (candidate.bodyType === "actor" && !(candidate as Actor).solid) continue;
```

That's it. Everything else follows from existing infrastructure:
- `move()` slide loop detects the solid actor → player stops at surface
- `onCollided` / `collided` fires with CollisionInfo (normal, contact point, depth)
- `onContact()` API matches on groups and fires callbacks
- Collision groups control directionality (who detects whom)

**Directionality via collision groups (no engine opinion):**

The game configures which actors detect which other actors:

```typescript
// Platformer: player detects enemies, enemies ignore player
PhysicsPlugin({
  groups: new CollisionGroups({
    player:  { collidesWith: ["world", "enemies"] },
    enemies: { collidesWith: ["world"] },           // no "player"
    world:   { collidesWith: ["player", "enemies"] },
  }),
})
```

Result:
- Player's `move()` hits solid enemy → `onCollided` fires → stomp or damage
- Enemy's `move()` ignores player → enemy walks through player

```typescript
// Arena game: all actors block each other
PhysicsPlugin({
  groups: new CollisionGroups({
    fighters: { collidesWith: ["world", "fighters"] },
    world:    { collidesWith: ["fighters"] },
  }),
})
```

Result: all fighters physically collide with each other.

**Stomp example (complete flow):**

```typescript
class PatrolEnemy extends Actor {
  solid = true;  // Player's move() will detect me
  collisionGroup = "enemies";
}

// Scene-level orchestration via onContact():
game.physics.onContact("player", "enemies", (player, enemy, info) => {
  if (info.normal.y < 0) {
    // Player hit enemy from above — normal points up into player
    (enemy as PatrolEnemy).stomp();
    (player as Player).velocity.y = -200; // bounce
  } else {
    (player as Player).takeDamage();
  }
});

// Or self-handling via virtual method:
class Player extends Actor {
  onCollided(info: CollisionInfo) {
    super.onCollided(info); // emit signal for external listeners
    if (info.collider.hasTag("enemy")) {
      if (info.normal.y < 0) {
        (info.collider as PatrolEnemy).stomp();
        this.velocity.y = -200;
      } else {
        this.takeDamage();
      }
    }
  }
}
```

**What happens frame-by-frame (stomp):**

1. Player falls toward enemy at velocity `(0, 400)`
2. `castMotion()` finds solid enemy, returns collision at TOI=0.5 with normal `(0, -1)`
3. Player is placed at enemy's top surface (safe margin above)
4. `onCollided(info)` fires → game destroys enemy, sets `velocity.y = -200`
5. Slide loop: remainder projected onto surface = ~0, loop ends
6. Next frame: player moves upward at -200, enemy is gone

**What happens (side collision / damage):**

1. Player walks into enemy at velocity `(200, 0)`
2. `castMotion()` finds solid enemy, collision with normal `(-1, 0)` (pointing left into player)
3. Player stops at enemy's left surface
4. `onCollided(info)` fires → game applies damage + knockback `velocity.x = -150`
5. Slide loop: remainder slides vertically (negligible for horizontal motion)
6. Next frame: player bounces away from enemy

#### Phased Rollout

**Phase A (with Phase 6 platformer): Basic solid actors**
- Add `solid = false` property to Actor
- Update `castMotion()` to include solid actors as collision candidates
- Existing `move()` slide loop, `onCollided`, `collided` signal, and `onContact()` all work automatically
- Collision groups control directionality — no new mechanism needed
- One-sided: the solid actor is passive (not pushed). Only the moving actor responds.

**Phase B (future): Pushable actors**
- Add `pushable = false` property to Actor
- When a moving actor hits a pushable solid actor, both actors move:
  - Moving actor: slides as normal
  - Pushed actor: displaced along collision normal, proportional to `mass` ratio
- Requires `mass` property on Actor (default: 1)
- Use case: push-block puzzles, NPC shove, hockey puck
- Both actors' `onCollided` fires (the pusher and the pushed)

**Phase C (future): Advanced resolution**
- Mutual collision: two solid actors both calling `move()` in the same frame
  - Order-dependent (same as Godot's CharacterBody2D) — acceptable for most games
  - If needed: split-step resolution (both compute motion, then resolve overlaps)
- Continuous collision detection for fast-moving actors (tunneling prevention)
- Collision layers as bitmasks for per-body control (beyond named groups)

---

## 3. Implementation Details

### 3.1 CollisionObject Changes

**File:** `packages/physics/src/collision-object.ts`

- Add `monitoring = false` property (done)
- Add `bodyEntered` and `bodyExited` signals (done)
- Rename `_onBodyEntered` → `onBodyEntered` (public virtual method)
- Rename `_onBodyExited` → `onBodyExited` (public virtual method)
- Default implementations emit signals (done, just rename)
- Remove `_monitoring` getter — use `monitoring` directly
- Add `getOverlappingBodies()` method (done)
- `onDestroy()` disconnects signals (done)

### 3.2 Sensor Changes

**File:** `packages/physics/src/sensor.ts`

- `monitoring = true` override (done)
- Keep `sensorEntered`/`sensorExited` (sensor-specific)
- Override `onBodyEntered`/`onBodyExited`:
  - **Always** call `super.onBodyEntered(body)` to emit `bodyEntered` signal
  - **Additionally** emit `sensorEntered` when the other body is a sensor
  - Fix current bug: Sensor's `_onBodyEntered` uses either/or — `bodyEntered` is swallowed for sensor-to-sensor overlaps
- Add `onSensorEntered` / `onSensorExited` virtual methods (same dual pattern)

```typescript
class Sensor extends CollisionObject {
  override onBodyEntered(body: CollisionObject): void {
    super.onBodyEntered(body); // always emit bodyEntered
    if (body.bodyType === "sensor") {
      this.onSensorEntered(body as Sensor);
    }
  }

  /** Override for sensor-specific self-handling. Default emits sensorEntered signal. */
  onSensorEntered(sensor: Sensor): void {
    this.sensorEntered.emit(sensor);
  }
}
```

### 3.3 PhysicsWorld Changes

**File:** `packages/physics/src/physics-world.ts`

**Overlap monitoring (existing, minor changes):**
- `monitoredOverlaps` map (done)
- `stepMonitoring()` (done, rename `_onBodyEntered` calls to `onBodyEntered`)
- Call `body.onBodyEntered()` / `body.onBodyExited()` instead of `body._onBodyEntered()` / `body._onBodyExited()`

**`onOverlap()` — built on monitoring system:**
- When `onOverlap(groupA, groupB, ...)` is registered, auto-set `monitoring = true` on all current bodies in both groups
- Also track the registration so newly-registered bodies in those groups get `monitoring = true` automatically
- Listen to `onBodyEntered`/`onBodyExited` on monitored bodies and filter by group to fire callbacks
- Implementation: maintain a list of `{ groupA, groupB, onEnter, onExit?, overlaps: Set<string> }` registrations
- In `_stepBodyMonitoring()`, after computing enter/exit diffs, also check registered `onOverlap` callbacks
- Returns dispose function that removes the registration

**`onContact()` — built on collided signal:**
- When `onContact(groupA, groupB, cb)` is registered, store `{ groupA, groupB, callback }`
- In the physics step (after `move()` calls), the system needs to match `collided` events against registered callbacks
- Implementation approach: PhysicsWorld maintains a `contactCallbacks` list. When an Actor emits `collided`, the PhysicsWorld checks if the actor's group and the collider's group match any registration, and fires the callback
- Wire this up in `register()`: when an Actor is registered, connect its `collided` signal to PhysicsWorld's contact dispatcher
- Returns dispose function

**Group index (done):**
- `groupIndex` map populated in `register()`, cleaned in `unregister()`

**Fix monitoring toggle:**
- Remove O(n) scan in `_stepBodyMonitoring()` that checks all bodies each frame
- Instead: when `onOverlap()` is registered, explicitly set `monitoring = true` on target bodies
- When `monitoring` is toggled off on a body, clear its overlap set and fire exit events (prevent stale data)

### 3.4 Actor Changes

**File:** `packages/physics/src/actor.ts`

- `getOverlappingBodies()` convenience method (done — inherited from CollisionObject)
- Add `solid = false` property
- `onCollided` virtual method (new) + keep existing `collided` signal:

```typescript
class Actor extends CollisionObject {
  /** When true, other actors' move() treats this as a physical obstacle. Default: false. */
  solid = false;

  /** Override for self-handling of physics contacts. Default emits collided signal. */
  onCollided(info: CollisionInfo): void {
    this.collided.emit(info);
  }
}
```

- Update `move()` to call `this.onCollided(collision)` instead of `this.collided.emit(collision)`

### 3.5 castMotion Changes (Actor-to-Actor)

**File:** `packages/physics/src/physics-world.ts`

Single-line change in `castMotion()`:

```typescript
// Before:
if (candidate.bodyType === "actor") continue;

// After:
if (candidate.bodyType === "actor" && !(candidate as Actor).solid) continue;
```

Add import for `Actor` (or use type guard). No other changes — the existing collision resolution, slide loop, contact point computation, and CollisionInfo all work for actor targets.

### 3.6 Augment File

**File:** `packages/physics/src/augment.ts` (done)

- Follow `@quintus/input` pattern exactly
- `Object.defineProperty(Game.prototype, "physics", { get() { ... } })`
- Module augmentation: `declare module "@quintus/core" { interface Game { get physics(): PhysicsWorld; } }`

**File:** `packages/physics/src/index.ts`

- Add `import "./augment.js";` at top (done)

---

## 4. Event Summary

After implementation, the full event model:

### Virtual Methods (override for self-handling)

| Method | On | Fires when | Data |
|--------|----|-----------|----- |
| `onBodyEntered(body)` | CollisionObject | Another body overlaps this one | The other body |
| `onBodyExited(body)` | CollisionObject | Overlap with another body ends | The other body |
| `onSensorEntered(sensor)` | Sensor | Another sensor overlaps this one | The other sensor |
| `onSensorExited(sensor)` | Sensor | Overlap with another sensor ends | The other sensor |
| `onCollided(info)` | Actor | Physical contact during `move()` | CollisionInfo (normal, point, depth) |

### Signals (connect for external observation)

| Signal | On | Fires when |
|--------|----|-----------|
| `bodyEntered` | CollisionObject | Another body overlaps (emitted by `onBodyEntered`) |
| `bodyExited` | CollisionObject | Overlap ends (emitted by `onBodyExited`) |
| `sensorEntered` | Sensor | Another sensor overlaps (emitted by `onSensorEntered`) |
| `sensorExited` | Sensor | Overlap ends (emitted by `onSensorExited`) |
| `collided` | Actor | Physical contact (emitted by `onCollided`) |

### Global APIs (scene-level orchestration)

| API | Fires when | Data | Exit callback? |
|-----|-----------|------|---------------|
| `game.physics.onOverlap(grpA, grpB, onEnter, onExit?)` | Bodies share space | Just who | Yes (optional) |
| `game.physics.onContact(grpA, grpB, cb)` | Physical collision during `move()` | CollisionInfo | No (instantaneous) |

---

## 5. Backward Compatibility

All changes are backward compatible:

| Existing Code | Impact |
|---------------|--------|
| `sensor.bodyEntered.connect(...)` | Still works — signal now inherited from CollisionObject, emitted by `onBodyEntered` |
| `sensor.monitoring = false` | Still works — property now on CollisionObject base |
| `sensor.getOverlappingBodies()` | Still works — now also available on any CollisionObject |
| Existing sensor tests | Pass unchanged — overlap tracking behavior identical |
| `actor.collided.connect(...)` | Still works — emitted by `onCollided` virtual method |
| `castMotion()` with existing actors | No change — `solid` defaults to `false`, so actors still pass through each other unless explicitly opted in |

**Renamed internals (non-breaking):**
- `_onBodyEntered` → `onBodyEntered` (was `@internal`, now public virtual)
- `_onBodyExited` → `onBodyExited` (was `@internal`, now public virtual)
- `stepSensors()` → `stepMonitoring()` (old name kept as deprecated wrapper)

---

## 6. Implementation Status

| Item | Status |
|------|--------|
| `monitoring` on CollisionObject | Done |
| `bodyEntered`/`bodyExited` signals on CollisionObject | Done |
| `monitoredOverlaps` + `stepMonitoring()` in PhysicsWorld | Done |
| `groupIndex` in PhysicsWorld | Done |
| `game.physics` accessor (augment.ts) | Done |
| Rename `_onBodyEntered` → `onBodyEntered` (public virtual) | TODO |
| Rename `_onBodyExited` → `onBodyExited` (public virtual) | TODO |
| Add `onCollided` virtual method on Actor | TODO |
| Fix Sensor `onBodyEntered` to always emit `bodyEntered` | TODO |
| Add `onSensorEntered`/`onSensorExited` virtual methods on Sensor | TODO |
| Add `solid = false` property to Actor | TODO |
| Update `castMotion()` to include solid actors | TODO |
| Replace `onCollision()` with `onOverlap()` (built on monitoring) | TODO |
| Add `onContact()` API (built on `collided` signal) | TODO |
| Fix monitoring toggle stale overlap bug | TODO |
| Remove O(n) monitoring scan (use explicit enable in `onOverlap`) | TODO |
| Tests for new APIs | TODO |

---

## 7. Test Plan

### New Tests

**In `collision-object.test.ts` (or existing test files):**
- `onBodyEntered` virtual method is called and emits `bodyEntered` signal
- `onBodyExited` virtual method is called and emits `bodyExited` signal
- Overriding `onBodyEntered` without calling `super` suppresses signal
- Overriding `onBodyEntered` with `super` fires both override and signal

**In `actor.test.ts`:**
- Actor with `monitoring = true` receives `onBodyEntered` when overlapping another actor
- Actor with `monitoring = true` receives `onBodyExited` when overlap ends
- Actor with `monitoring = false` (default) does NOT receive overlap events
- `getOverlappingBodies()` returns current overlaps for monitored actor
- `onCollided` virtual method fires and emits `collided` signal during `move()`
- Solid actor: non-solid actor's `move()` ignores it (passes through)
- Solid actor: another actor's `move()` collides with it (stops at surface)
- Solid actor: `onCollided` fires with correct normal (top = stomp, side = wall)
- Solid actor: collision groups control directionality (A detects B but not B→A)
- Solid actor: default `solid = false` preserves existing pass-through behavior
- Solid actor: enemy destroyed in `onCollided` callback — player continues movement through empty space

**In `sensor.test.ts`:**
- Sensor `onBodyEntered` emits BOTH `bodyEntered` AND `sensorEntered` for sensor-to-sensor overlaps
- Sensor `onBodyEntered` emits only `bodyEntered` for non-sensor overlaps
- `onSensorEntered` virtual method works for self-handling

**In `integration.test.ts`:**
- `onOverlap("player", "coins", cb)` fires callback when player overlaps coin
- `onOverlap()` fires once per overlap (no duplicates on sustained overlap)
- `onOverlap()` exit callback fires when overlap ends
- `onOverlap()` auto-enables monitoring on target bodies
- `onOverlap()` dispose function stops callbacks
- `onOverlap()` respects collision groups
- `onContact("player", "enemies", cb)` fires callback when player hits solid enemy during `move()`
- `onContact()` provides correct normal for stomp-vs-side detection
- `onContact()` fires for actor-to-actor and actor-to-static contacts
- `onContact()` dispose function stops callbacks
- `game.physics` accessor works after PhysicsPlugin installed
- `game.physics` throws before PhysicsPlugin installed
- Toggling `monitoring` at runtime clears stale overlaps
- Body destruction during callback doesn't crash

### Existing Tests

All existing Sensor and Actor tests pass unchanged. Verify with `pnpm test`.
