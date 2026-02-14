# Phase 2: Physics & Collision — Core Design

> **Goal:** Collision detection and response — the engine can detect overlaps, resolve collisions, and slide actors along surfaces. After this phase, a character can run, jump, and land on platforms.
> **Duration:** ~2 weeks
> **Outcome:** A simple platformer demo runs with correct physics. Player runs, jumps, lands on platforms, slides along walls, and collects coins (sensors). All physics tests pass deterministically. `@quintus/physics` ships as a valid ESM/CJS bundle.

---

## Subphase Documents

| Document | Contents | Steps | Duration |
|----------|----------|-------|----------|
| [PHASE_2_SUBPHASE_1.md](./PHASE_2_SUBPHASE_1.md) | Core changes + foundation types (Shape2D, CollisionInfo, CollisionGroups) | 1–2 | 2 days |
| [PHASE_2_SUBPHASE_2.md](./PHASE_2_SUBPHASE_2.md) | Collision detection (SpatialHash, SAT, swept collision) | 3–4 | 3 days |
| [PHASE_2_SUBPHASE_3.md](./PHASE_2_SUBPHASE_3.md) | Physics infrastructure (CollisionShape, CollisionObject, PhysicsWorld, PhysicsPlugin) | 5–6 | 1.5 days |
| [PHASE_2_SUBPHASE_4.md](./PHASE_2_SUBPHASE_4.md) | Physics bodies (Actor + move(), StaticCollider, Sensor + overlap tracking) | 7–8 | 2.5 days |
| [PHASE_2_SUBPHASE_5.md](./PHASE_2_SUBPHASE_5.md) | Integration tests + demo | 9 | 1 day |

---

## Architecture Overview

### How Physics Integrates with the Engine

Physics is a **plugin** — `@quintus/core` has zero knowledge of collision detection. The `@quintus/physics` package exports a `PhysicsPlugin` that hooks into the game loop, plus the node classes (`Actor`, `StaticCollider`, `Sensor`, `CollisionShape`) that users extend.

```
┌─────────────────────────────────────────────────┐
│  Game                                           │
│  ├── PhysicsPlugin (installed via game.use())   │
│  │   └── PhysicsWorld                           │
│  │       ├── SpatialHash (broad phase)          │
│  │       ├── SAT (narrow phase)                 │
│  │       └── CollisionGroups (bitmask config)   │
│  └── Scene                                      │
│      ├── Actor (Player)                         │
│      │   └── CollisionShape (rect 14×24)        │
│      ├── StaticCollider (Platform)              │
│      │   └── CollisionShape (rect 200×16)       │
│      └── Sensor (Coin)                          │
│          └── CollisionShape (circle r=8)        │
└─────────────────────────────────────────────────┘
```

### Class Hierarchy

```
Node2D (from @quintus/core)
├── CollisionShape         — shape geometry child node
└── CollisionObject        — abstract base (collision group, registration)
    ├── Actor              — code-controlled movement, move(), slide
    ├── StaticCollider     — immovable, moving platforms, one-way
    └── Sensor             — overlap detection, entered/exited signals
```

### Key Design Choices

1. **PhysicsWorld is NOT a node.** It's a plain class owned by the plugin. Stores the spatial hash, collision group config, and orchestrates collision detection. Avoids polluting the scene tree.

2. **Physics bodies find the world via a module-level WeakMap.** `WeakMap<Game, PhysicsWorld>` — avoids adding `getPlugin()` to the `Game` class.

3. **`Actor.move()` is imperative, not automatic.** The user calls `this.move(dt)` in their `onFixedUpdate`. The engine does not auto-move actors.

4. **Sensor overlap detection is global, not per-sensor.** After all nodes' `onFixedUpdate` runs, `PhysicsWorld` runs a single sensor overlap pass. Consistent behavior regardless of tree ordering.

### Frame Sequence with Physics

```
┌─────────────────────────── One Frame ───────────────────────────┐
│                                                                 │
│  ┌── Fixed Update (may run 0, 1, or N times) ──┐               │
│  │  1. Scene._walkFixedUpdate(dt)               │               │
│  │     → Each node's onFixedUpdate(dt)          │               │
│  │     → Actors call this.move(dt) here         │               │
│  │       → move() queries PhysicsWorld          │               │
│  │       → SAT collision, slide, repeat         │               │
│  │                                              │               │
│  │  2. Game.postFixedUpdate.emit(dt)            │               │
│  │     → PhysicsWorld.stepSensors()             │               │
│  │       → Broad phase: spatial hash query      │               │
│  │       → Narrow phase: SAT overlap test       │               │
│  │       → Fire entered/exited signals          │               │
│  └──────────────────────────────────────────────┘               │
│                                                                 │
│  3. Scene._walkUpdate(dt)         (once per frame)              │
│  4. Renderer.render(scene)        (once per frame)              │
│  5. Scene._processDestroyQueue()  (once per frame)              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Why `move()` runs in `onFixedUpdate`:** Physics must run at a fixed timestep for determinism. Variable frame rates would cause different collision results.

**Why sensor detection runs after all fixed updates:** If sensor detection ran per-sensor in each sensor's `onFixedUpdate`, the results would depend on tree ordering. Running it globally guarantees consistent results.

**Note:** `postFixedUpdate` fires once per fixed step, not once per frame. When the frame rate is low and multiple fixed steps run per frame, `postFixedUpdate` fires after each one. This is correct — sensor detection must run each physics step to avoid missed overlaps.

---

## File Structure

```
packages/physics/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts                   # Public exports
    ├── shapes.ts                  # Shape2D types + Shape factory + shapeAABB
    ├── collision-info.ts          # CollisionInfo interface
    ├── collision-groups.ts        # CollisionGroups class + config type
    ├── collision-shape.ts         # CollisionShape node
    ├── collision-object.ts        # CollisionObject base class
    ├── actor.ts                   # Actor class (move, moveAndCollide)
    ├── static-collider.ts         # StaticCollider class
    ├── sensor.ts                  # Sensor class
    ├── spatial-hash.ts            # SpatialHash grid
    ├── sat.ts                     # SAT overlap tests (all shape pairs)
    ├── physics-world.ts           # PhysicsWorld orchestrator
    ├── physics-plugin.ts          # PhysicsPlugin + getPhysicsWorld
    │
    ├── shapes.test.ts             # Shape factory, AABB computation
    ├── collision-groups.test.ts   # Bitmask compilation, validation, shouldCollide
    ├── collision-shape.test.ts    # Shape node, world AABB, disabled toggle
    ├── spatial-hash.test.ts       # Insert, remove, update, query, queryPairs
    ├── sat.test.ts                # All shape pairs, edge cases
    ├── actor.test.ts              # move(), moveAndCollide(), contact flags
    ├── static-collider.test.ts    # Immovable, moving platforms, one-way
    ├── sensor.test.ts             # entered/exited signals, monitoring toggle
    ├── physics-world.test.ts      # castMotion, sensor stepping
    └── integration.test.ts        # Multi-body scenarios
```

Size budget: **~8KB gzipped**. Dependencies: `@quintus/core`, `@quintus/math` (workspace deps in `package.json`).

**Important notes:**
- **PhysicsWorld is per-Game, not per-Scene.** When scenes switch, bodies auto-unregister from the PhysicsWorld via their `onExitTree` lifecycle method. The new scene's bodies register on entry. No manual cleanup needed.
- **`"default"` collision group behavior:** When the `"default"` group is NOT explicitly defined in the config, it auto-collides with everything (mask = all bits). When `"default"` IS explicitly defined, it uses the user's `collidesWith` list — the auto-collide-with-everything behavior is overridden.

---

## Cross-Cutting Concerns

### Determinism

Physics must be deterministic: same inputs → same outputs, always.

- **Fixed timestep only.** `move()` must be called from `onFixedUpdate`, never from `onUpdate`. Variable dt would produce different collision results.
- **No `Math.random()`.** If physics needs randomness (it shouldn't), use `game.random` (SeededRandom).
- **Consistent ordering.** Bodies are processed in registration order (which mirrors tree insertion order). The spatial hash returns candidates in a deterministic order. SAT is pure math with no ordering dependencies.
- **Floating point consistency.** All calculations use the same operations in the same order. No platform-dependent optimizations that could change results.
- **Rotation is constant during motion cast.** During a single `move()` call, only translation changes. Rotation and scale remain constant for the duration of the swept collision test — no angular interpolation needed.
- **`EPSILON = 1e-6` for comparisons.** Avoids floating-point edge cases where shapes are "touching but not overlapping." Shared constant from `@quintus/math`.

### Performance

**Budget:** 50 dynamic actors + 1000 static colliders at 60fps on a mid-range mobile device.

**Hot paths and mitigations:**
1. **`castMotion` (called per slide per actor per fixedUpdate)**
   - Broad phase eliminates >95% of pairs via spatial hash
   - Rect-vs-rect uses analytical swept AABB (no binary search) when both shapes are unrotated
   - `Vec2Pool` for temporary vectors in SAT calculations
   - `Matrix2D.isTranslationOnly()` fast-path check: unrotated shapes (the common case in platformers) pay no penalty for the transform-based API — they use the same fast AABB/circle math as before
2. **`stepSensors` (called once per fixedUpdate)**
   - Sensors with no nearby bodies are skipped (spatial hash returns empty)
   - Only diffs are computed, not full overlap lists
   - `Set` operations for efficient entered/exited diffing
3. **`SpatialHash.update` (called per moved body per fixedUpdate)**
   - Early exit if body's cell occupancy hasn't changed
   - Static bodies never call update

**Transform-aware collision:** All collision detection operates on `(shape, transform: Matrix2D)` pairs. Shapes define local geometry; the transform encodes position, rotation, and scale. This matches Godot's approach. When both shapes are unrotated (common in platformers), fast paths avoid the cost of full transformed SAT. Transforms come from Node2D's cached `globalTransform` — no new allocations in the hot path.

**Rotation during swept collision:** Rotation is constant during a single `move()` cast — only translation interpolates. No angular velocity is applied during a single `move()` call.

**Vec2Pool usage:** All SAT functions and the slide loop use `Vec2Pool` for temporary vectors. A module-level pool is created with capacity 128:

```typescript
// sat.ts
import { Vec2Pool } from "@quintus/math/internal";
const pool = new Vec2Pool(128);

export function testOverlap(...): SATResult | null {
  pool.begin();
  try {
    // ... use pool.get(x, y) for temporaries ...
  } finally {
    pool.end();
  }
}
```

**Allocation targets:** Zero per-frame allocations in the steady state (no new collisions, no shape changes). `CollisionInfo` objects are allocated only when collisions occur (unavoidable — they escape to user code via signals).

### Error Handling

- **Missing PhysicsPlugin:** If `move()` is called without a PhysicsPlugin installed, auto-install fires (see Subphase 3). If that fails, throw: `"PhysicsPlugin not installed. Call game.use(PhysicsPlugin()) before adding physics bodies."`
- **Invalid collision group:** `PhysicsWorld.register()` calls `groups.validate(body.collisionGroup)`. Throws immediately: `"Unknown collision group 'plyer'. Available groups: player, enemies, world."`
- **Missing collision shape:** An Actor with no CollisionShape children is allowed (it just won't collide). No error — useful for actors that haven't finished setup yet.
- **Shape not set:** A CollisionShape with `shape = null` is silently skipped during collision. No error.
- **Destroyed body in collision callback:** If a body is destroyed inside a `collided` signal handler, it's marked for deferred destruction (existing behavior from core). Remaining slide iterations still complete.

---

## Definition of Done

All of these must be true before Phase 2 is complete:

- [ ] `@quintus/physics` builds and exports as ESM + CJS + `.d.ts`
- [ ] Player character runs, jumps, and lands on platforms with correct physics
- [ ] `move()` handles floors, walls, ceilings, and slopes (up to `floorMaxAngle`)
- [ ] `moveAndCollide()` returns correct collision info
- [ ] `isOnFloor()` / `isOnWall()` / `isOnCeiling()` report correctly after `move()`
- [ ] Spatial hash performs well with 1000+ static colliders (benchmark test passes)
- [ ] SAT correctly handles all shape pairs: rect×rect, circle×circle, rect×circle, capsule×rect, capsule×circle, capsule×capsule, polygon×polygon
- [ ] Sensor `bodyEntered` / `bodyExited` signals fire correctly
- [ ] Sensor `sensorEntered` / `sensorExited` signals fire correctly
- [ ] No phantom enter/exit events on destroy
- [ ] Collision groups filter correctly — validated at registration, bitmask-compiled
- [ ] One-way platforms work (pass through from below, land from above)
- [ ] Moving platforms carry actors via `constantVelocity`
- [ ] No tunneling through thin walls at normal velocities (≤1000 px/s)
- [ ] All physics tests pass deterministically (same seed + same inputs = same result)
- [ ] `postFixedUpdate` signal added to Game in `@quintus/core`
- [ ] Props parameter removed from `addChild`/`Scene.add`; properties set via direct assignment
- [ ] Demo: platformer movement scene runs in browser
- [ ] All tests pass, Biome lint clean, `pnpm build` succeeds

---

## Execution Order

Build dependencies bottom-up. Each step produces testable output.

```
Week 1: Foundations (Subphases 1–2)
─────────────────────────────────────
Step 1: Core changes (1 day)                     → Subphase 1
Step 2: Types & data structures (1 day)          → Subphase 1
Step 3: Spatial hash (1 day)                     → Subphase 2
Step 4: SAT + swept collision (2 days)           → Subphase 2

Week 2: Bodies & Integration (Subphases 3–5)
─────────────────────────────────────
Step 5: PhysicsWorld + PhysicsPlugin (1 day)     → Subphase 3
Step 6: CollisionObject + CollisionShape (0.5d)  → Subphase 3
Step 7: Actor + move() (1.5 days)                → Subphase 4
Step 8: StaticCollider + Sensor (1 day)          → Subphase 4
Step 9: Integration tests + demo (1 day)         → Subphase 5
```
