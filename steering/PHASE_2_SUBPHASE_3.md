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
   * 4. For each candidate: find time of impact via binary search + SAT
   *    - Uses shape transforms (Matrix2D) from CollisionShape.getWorldTransform()
   *    - During sweep, only translation interpolates; rotation/scale are constant
   * 5. Return earliest collision
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
- **`castMotion` is the hot path.** Every `Actor.move()` call invokes this 1-4 times (once per slide iteration). It must be fast. Uses analytical swept AABB for rect-vs-rect, binary search TOI for other pairs (see Subphase 2).
- **Sensor overlap tracking uses diffing.** `Map<Sensor, Set<CollisionObject>>` stores current overlaps. Each `stepSensors()` call computes new overlaps, diffs against the previous set, and fires entered/exited signals. Guarantees:
  - No duplicate entered events
  - Exited fires even if the body was destroyed (removed from set during unregister)
  - Deterministic ordering (bodies processed in insertion order)
- **`updatePosition` is called by `Actor.move()` internally.** After the slide loop, the actor re-hashes itself. Users never call this.

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
// In CollisionObject.onEnterTree():
override onEnterTree(): void {
  super.onEnterTree();
  const game = this.game;
  if (game && !getPhysicsWorld(game)) {
    // Auto-install with defaults
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
  onReady() {
    // Standing collision shape
    const standing = this.addChild(CollisionShape);
    standing.shape = Shape.rect(14, 24);
    standing.name = "standing";

    // Crouching collision shape (disabled by default)
    const crouching = this.addChild(CollisionShape);
    crouching.shape = Shape.rect(14, 14);
    crouching.position = new Vec2(0, 5);
    crouching.disabled = true;
    crouching.name = "crouching";
  }

  crouch() {
    this.find("standing")!.disabled = true;
    this.find("crouching")!.disabled = false;
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
   * Set internally by onEnterTree/onExitTree.
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

  /** @internal */
  override onEnterTree(): void {
    super.onEnterTree();
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
- **Auto-registration.** Bodies register on tree enter, unregister on tree exit. No manual registration.
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

### physics-world.test.ts
- `castMotion` with no obstacles → null
- `castMotion` with obstacle → correct TOI, travel, normal
- `castMotion` with multiple obstacles → returns closest
- `castMotion` respects collision groups
- `register`/`unregister` adds/removes from spatial hash
- Sensor stepping fires entered/exited at correct times

---

## Completion Checklist

- [ ] `PhysicsWorld` registers/unregisters bodies, queries spatial hash
- [ ] `castMotion` finds first collision along motion vector
- [ ] `PhysicsPlugin` installs correctly, hooks into `postFixedUpdate`
- [ ] Auto-install works when no plugin explicitly configured
- [ ] `getPhysicsWorld` WeakMap pattern works
- [ ] `CollisionShape` computes correct world AABB with offset
- [ ] `CollisionObject` auto-registers on tree enter/exit
- [ ] Collision group validation throws on invalid names
- [ ] All tests pass, `pnpm build` succeeds
