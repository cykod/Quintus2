# 3D API Review — Detailed Design

> **Goal:** Identify pain points, footguns, missing abstractions, and debug gaps in `@quintus/three` and the 3D dungeon example
> **Outcome:** A prioritized backlog of API improvements that make building 3D games with Quintus dramatically easier and less error-prone

## Status

| Phase | Description | Scope | Status |
|-------|-------------|-------|--------|
| 1 | Animation action queue with priority system | Engine | Pending |
| 2 | Grid-world coordinate bridge | Example | Pending |
| 3 | Material & model convenience API | Engine | Pending |
| 4 | ~~Easing & tween integration for 3D~~ | ~~Removed~~ | ~~N/A~~ |
| 5 | Direction constants & facing helpers | Example | Pending |
| 6 | 3D debug tooling (qdbg extensions) | Engine | Pending |
| 7 | Camera shake as first-class feature | Engine | Pending |
| 8 | Fog-of-war as engine primitive | Engine | Pending |
| 9 | Particle burst convenience API | Engine | Pending |
| 10 | Test ergonomics for 3D games | Engine | Pending |

---

## Overview: What Works Well

Before listing problems, it's worth acknowledging what the current API gets right:

- **Node3D as a Node subclass** — clean integration with the Quintus tree, signals, lifecycle
- **Lazy object3d creation** — allows property assignment before Three.js objects exist
- **TileMap3D with InstancedMesh** — efficient rendering, clean grid API
- **GLTFModel animation API** — `play()`, `playOneShot()`, `animationNames` are intuitive
- **BoneAttachment** — declarative bone parenting is a genuinely nice API
- **ThreePlugin auto-detection** — full-3D vs hybrid mode "just works"
- **2D overlay rendering** — HUD/UI compositing over 3D is seamless
- **Camera3D follow system** — smooth follow with offset and smoothing

The problems below are things that the dungeon game had to solve manually that the engine should handle, patterns that are easy to get wrong, and tooling gaps that slow down development.

---

## Phase 1: Animation State Machine Helper

### The Problem

Both `PlayerCharacter` and `Enemy` implement **identical hand-rolled animation state machines**. Each entity tracks:
- Multiple boolean flags (`_moving`, `_turning`, `_attacking`, `_dying`, `_deathAnimating`)
- Elapsed timers and durations for each state
- Start/end positions and rotations for manual lerping
- Multi-phase animation sequences (windup → lunge → return)

This is the single biggest source of complexity in the dungeon game. `player.ts` alone has ~150 lines of animation state machine boilerplate in `onFixedUpdate`.

### Evidence from the Dungeon Code

```
// player.ts — 6 separate animation states, each with timer + lerp
private _moving = false;
private _moveElapsed = 0;
private _turning = false;
private _turnElapsed = 0;
private _attacking = false;
private _attackElapsed = 0;
private _deathAnimating = false;
private _deathElapsed = 0;
private _descending = false;
private _descendElapsed = 0;
```

Each state follows the same pattern: set start/end values → increment elapsed → compute `t = elapsed / duration` → apply easing → lerp position/rotation/scale → check completion → emit signal.

### Proposed Solution

A generic `ActionQueue` that extends `Node` (not `Node3D`) and operates on a target node. It includes a priority system so higher-priority actions (e.g. death) can interrupt lower-priority ones (e.g. patrol), and supports cancellation for scene transitions.

```typescript
// packages/three/src/action-queue.ts
import { Node, signal } from "@quintus/core";
import type { EasingFn } from "@quintus/tween";

interface Action3D {
  duration: number;
  easing?: EasingFn;
  onStart?: () => void;
  onUpdate?: (t: number) => void;  // t is 0..1 eased
  onComplete?: () => void;
}

export class ActionQueue extends Node {
  readonly completed = signal<void>();
  readonly cancelled = signal<void>();
  private _target: Node3D;
  private _queue: Action3D[] = [];
  private _current: Action3D | null = null;
  private _elapsed = 0;
  private _priority = 0;

  constructor(target: Node3D) {
    super();
    this._target = target;
  }

  /** Enqueue an action. Returns this for chaining. */
  then(action: Action3D): this { ... }

  /** Convenience: lerp target position over duration. */
  moveTo(target: THREE.Vector3, duration: number, easing?: EasingFn): this { ... }

  /** Convenience: lerp target rotation.y over duration. */
  rotateTo(targetY: number, duration: number, easing?: EasingFn): this { ... }

  /** Convenience: lerp target scale uniformly. */
  scaleTo(target: number, duration: number, easing?: EasingFn): this { ... }

  /** Run multiple actions in parallel (all start simultaneously). */
  parallel(...actions: Action3D[]): this { ... }

  /** Delay before next action. */
  wait(duration: number): this { ... }

  /** Play a GLTF animation on a target model. */
  playAnim(model: GLTFModel, name: string, loop?: boolean): this { ... }

  /**
   * Play a sequence at a given priority level. If the new priority is ≥ the
   * current priority, the running sequence is cancelled and replaced.
   * Lower-priority plays are ignored while a higher-priority sequence runs.
   */
  play(priority: number, build: (q: this) => void): this { ... }

  /** Cancel the current sequence and clear the queue. Fires `cancelled`. */
  cancel(): void { ... }

  /** Remove all queued actions without cancelling the current one. */
  clear(): void { ... }

  get isRunning(): boolean { ... }

  override onFixedUpdate(dt: number): void { ... }

  /** Auto-cancel on destruction (e.g. scene transitions). */
  override onDestroy(): void {
    this.cancel();
    super.onDestroy();
  }
}
```

The queue operates on its `_target` Node3D rather than on itself, so it doesn't need a 3D transform. Convenience methods like `moveTo()` modify `_target.position`, not the queue's own position.

This replaces ~150 lines per entity with:

```typescript
// Player attack becomes:
const q = this.add(new ActionQueue(this));
q.play(1, q => {
  q.playAnim(this._model, "attack-melee-right")
   .then({ duration: 0.15, onUpdate: t => { /* windup */ } })
   .moveTo(lungePos, 0.1, easeOutCubic)
   .moveTo(startPos, 0.15, easeInCubic)
   .then({ duration: 0, onComplete: () => this.attacked.emit(...) });
});

// Death interrupts any running action (priority 10 > attack priority 1):
q.play(10, q => {
  q.playAnim(this._model, "death")
   .scaleTo(0, 0.3, easeInCubic)
   .then({ duration: 0, onComplete: () => this.destroy() });
});
```

Easing functions are imported directly from `@quintus/tween` — they are already standalone exports with no `Node2D` dependency, so no separate Tween3D system is needed.

### Deliverables

- [ ] Create `packages/three/src/action-queue.ts` with `ActionQueue` class extending `Node`
- [ ] Target-based design: queue holds reference to a `Node3D`, operates on its transform
- [ ] Built-in convenience methods: `moveTo`, `rotateTo`, `scaleTo`, `wait`, `parallel`
- [ ] Priority system: `play(priority, builder)` — higher priority interrupts lower
- [ ] Cancellation: `cancel()` stops current + clears queue, `clear()` removes queued only
- [ ] Auto-cancel in `onDestroy()` for safe scene transitions
- [ ] Integration with `GLTFModel.playOneShot()` — can chain off animation completion
- [ ] Typed easing parameter using `@quintus/tween` easing functions (already standalone)
- [ ] Tests for sequential, parallel, chained, priority, and cancellation
- [ ] Export from `packages/three/src/index.ts`

### Tests

**`packages/three/src/action-queue.test.ts`:**
- Sequential actions execute in order
- `moveTo()` interpolates target position over duration
- `rotateTo()` interpolates target rotation.y
- `parallel()` runs multiple actions simultaneously, completes when all finish
- `completed` signal fires after last action
- `isRunning` returns correct state
- Easing functions modify interpolation curve
- `play(2, ...)` interrupts a running `play(1, ...)` sequence
- `play(1, ...)` is ignored while `play(2, ...)` is running
- `cancel()` stops current action, clears queue, fires `cancelled` signal
- `clear()` removes queued actions but current action continues
- `onDestroy()` auto-cancels running sequences

---

## Phase 2: Grid-World Coordinate Bridge (Example-Level)

> **Scope: Example-level** — lives in `examples/3d-dungeon/`, not in the engine. The actual duplication is ~5 entities with 2 properties each (~10 lines total). Grid conventions vary between games (4-way vs 8-way, axis mappings, hex grids), so a one-size-fits-all engine abstraction would be fragile. If multiple example games converge on the same pattern, this can graduate to `@quintus/prefabs`.

### The Problem

The dungeon game converts between grid coordinates `(gridX, gridZ)` and Three.js world positions. Five entities independently store `gridX`/`gridZ` and manually call `position.set(gridX * TILE_SIZE, 0, gridZ * TILE_SIZE)`.

### Evidence

Entities duplicate grid state:
```typescript
// player.ts
gridX = 0; gridZ = 0; facing = 0;
// enemy.ts
gridX = 0; gridZ = 0; facing = 0;
// coin-item.ts
gridX = 0; gridZ = 0;
// health-potion.ts
gridX = 0; gridZ = 0;
// exit-stairs.ts
gridX = 0; gridZ = 0;
```

### Proposed Solution

A `GridEntity3D` base class in the dungeon example that owns the grid↔world mapping:

```typescript
// examples/3d-dungeon/entities/grid-entity.ts
export class GridEntity3D extends Node3D {
  private _gridX = 0;
  private _gridZ = 0;
  tileSize = 1;

  get gridX(): number { return this._gridX; }
  set gridX(v: number) {
    this._gridX = v;
    this.position.x = v * this.tileSize;
  }

  get gridZ(): number { return this._gridZ; }
  set gridZ(v: number) {
    this._gridZ = v;
    this.position.z = v * this.tileSize;
  }

  /** Move to grid position, syncing world position. */
  setGridPosition(x: number, z: number): void {
    this._gridX = x;
    this._gridZ = z;
    this.position.x = x * this.tileSize;
    this.position.z = z * this.tileSize;
  }

  /** Manhattan distance to another grid entity. */
  gridDistanceTo(other: GridEntity3D): number {
    return Math.abs(this._gridX - other._gridX) + Math.abs(this._gridZ - other._gridZ);
  }
}
```

### Deliverables

- [ ] Create `examples/3d-dungeon/entities/grid-entity.ts` with `GridEntity3D` class
- [ ] Auto-sync grid position ↔ world position on set
- [ ] `setGridPosition()`, `gridDistanceTo()` helpers
- [ ] `tileSize` property for custom grid scales
- [ ] Refactor dungeon entities to extend `GridEntity3D`
- [ ] Tests for bidirectional sync

### Tests

- Setting `gridX` updates `position.x` automatically
- `setGridPosition(3, 5)` sets both grid and world coords
- `gridDistanceTo()` computes Manhattan distance
- Custom `tileSize` scales world positions correctly

---

## Phase 3: Material & Model Convenience API

### The Problem

Working with Three.js materials through the Quintus API requires dropping down to raw Three.js code frequently. The dungeon game has several patterns that are verbose and error-prone:

**1. Model orientation fixup** — GLTF models face +Z; Three.js cameras face -Z. Every loaded model needs manual rotation:
```typescript
// Repeated in player.ts, enemy.ts
if (this._model.loaded) {
  const inner = this._model.object3d.children[0];
  if (inner) inner.rotation.y = Math.PI; // face -Z
}
```

**2. Material cloning for per-instance effects** — Enemy hit-flash must clone all materials to avoid affecting other instances:
```typescript
// enemy.ts — _ensureOwnMaterials()
private _ensureOwnMaterials(): void {
  this._model.object3d.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      if (!child.material._cloned) {
        child.material = child.material.clone();
        child.material._cloned = true;
      }
    }
  });
}
```

**3. Setting emissive color requires traversing the model hierarchy:**
```typescript
this._model.object3d.traverse((child) => {
  if (child instanceof THREE.Mesh) {
    const mat = child.material as THREE.MeshStandardMaterial;
    if (mat.emissive) {
      if (!this._originalEmissives.has(mat)) {
        this._originalEmissives.set(mat, mat.emissive.clone());
      }
      mat.emissive.set(0xff0000);
    }
  }
});
```

### Proposed Solution

Add convenience methods to `GLTFModel`:

```typescript
// Additions to GLTFModel
class GLTFModel extends Node3D {
  /**
   * Y-axis rotation applied to the loaded model's inner root (radians).
   * Most GLTF models face +Z but Three.js cameras face -Z, so the most
   * common fixup is `modelRotation = Math.PI`.
   * Set to 0 (default) for no rotation.
   */
  modelRotation = 0;

  /** Shorthand: flip the model 180° (sets modelRotation = Math.PI). */
  flipModel = false;

  /** Clone all materials so this instance can modify them independently. */
  cloneMaterials(): void { ... }

  /** Set emissive color on all MeshStandardMaterial in the model. */
  setEmissive(color: THREE.ColorRepresentation): void { ... }

  /** Reset emissive to original values (requires prior cloneMaterials). */
  resetEmissive(): void { ... }

  /** Set opacity on all materials. Enables transparency automatically. */
  setOpacity(opacity: number): void { ... }

  /** Get all materials in the model hierarchy. */
  getMaterials(): THREE.Material[] { ... }
}
```

### Deliverables

- [ ] Add `modelRotation` property to `GLTFModel` — applies Y rotation to first child after load
- [ ] Add `flipModel` boolean shorthand (sets `modelRotation = Math.PI`)
- [ ] Add `cloneMaterials()` method — deep-clones all materials for independent modification
- [ ] Add `setEmissive(color)` / `resetEmissive()` convenience methods
- [ ] Add `setOpacity(opacity)` with automatic transparency toggle
- [ ] Add `getMaterials()` for advanced use cases
- [ ] Tests for each method
- [ ] Update dungeon example to use new API (remove ~30 lines of boilerplate)

### Tests

**`packages/three/src/gltf-model.test.ts` (additions):**
- `modelRotation = Math.PI` rotates inner child by PI
- `flipModel = true` is equivalent to `modelRotation = Math.PI`
- `cloneMaterials()` produces independent material instances
- `setEmissive()` changes all MeshStandardMaterial emissive colors
- `resetEmissive()` restores original values
- `setOpacity(0.5)` sets opacity and enables transparency

---

## ~~Phase 4: Easing & Tween Integration for 3D~~ (Removed)

> **Removed.** `@quintus/tween` already exports `Ease` and all 16 easing functions as standalone utilities with no `Node2D` dependency. The inline easing duplication in the dungeon example is a documentation/awareness problem, not an architecture gap. Phase 1's `ActionQueue` accepts `easing?: EasingFn` on all convenience methods, which covers the 3D use case without a separate `Tween3D` system.
>
> **Action items folded into other phases:**
> - Dungeon example should `import { Ease } from "@quintus/tween"` instead of inline formulas (done as part of Phase 1 refactoring)
> - ActionQueue `then()`, `moveTo()`, `rotateTo()`, `scaleTo()` all accept optional `easing` parameter (specified in Phase 1)

---

## Phase 5: Direction Constants & Facing Helpers (Example-Level)

> **Scope: Example-level** — lives in `examples/3d-dungeon/direction.ts`, not in the engine. Direction conventions are game-specific (4-way vs 8-way, axis mappings, hex grids). The actual duplication is 3 files × 3 lines = 9 lines. If multiple example games converge on the same pattern, this can graduate to `@quintus/prefabs`.

### The Problem

Direction constants are **defined independently in 3 files** with identical values:

```typescript
// player.ts, enemy.ts, exit-stairs.ts — all identical
const DIR_DX = [0, 1, 0, -1];
const DIR_DZ = [-1, 0, 1, 0];
const DIR_ANGLE = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
```

### Proposed Solution

A shared utility in the dungeon example:

```typescript
// examples/3d-dungeon/direction.ts
export enum CardinalDirection {
  North = 0,  // -Z in Three.js
  East = 1,   // +X
  South = 2,  // +Z
  West = 3,   // -X
}

export const Direction = {
  dx: [0, 1, 0, -1] as const,
  dz: [-1, 0, 1, 0] as const,
  angle: [0, Math.PI / 2, Math.PI, -Math.PI / 2] as const,

  /** Get the direction from grid delta. */
  fromDelta(dx: number, dz: number): CardinalDirection { ... },

  /** Rotate direction: +1 = clockwise, -1 = counter-clockwise. */
  rotate(dir: CardinalDirection, steps: number): CardinalDirection { ... },

  /** Get opposite direction. */
  opposite(dir: CardinalDirection): CardinalDirection { ... },

  /** Get the Y-axis rotation for a direction in radians. */
  toAngle(dir: CardinalDirection): number { ... },
} as const;
```

### Deliverables

- [ ] Create `examples/3d-dungeon/direction.ts` with `Direction` utility and `CardinalDirection` enum
- [ ] `fromDelta`, `rotate`, `opposite`, `toAngle` helper methods
- [ ] Refactor dungeon entities (player.ts, enemy.ts, exit-stairs.ts) to import from shared module
- [ ] Tests for all direction operations

### Tests

- `fromDelta(0, -1)` returns `North`
- `rotate(North, 1)` returns `East`
- `opposite(North)` returns `South`
- `toAngle(East)` returns `Math.PI / 2`

---

## Phase 6: 3D Debug Tooling (qdbg Extensions)

### The Problem

`qdbg` was built for 2D games. While `tree`, `inspect`, and `step` work for 3D, several critical debugging operations are missing or produce unhelpful output for 3D games:

**1. No 3D position/rotation display** — `inspect` shows the Node properties but not the Three.js transform. Developers need to know where a node *actually is* in 3D space.

**2. No camera inspector** — "Why can't I see my object?" is the #1 3D debugging question. No command shows camera frustum, position, target, or what's in view.

**3. No light inspector** — "Why is my scene dark?" is #2. No command shows light positions, intensities, shadow config, or light range visualization.

**4. No material inspector** — "Why is my model black/pink/invisible?" is #3. No way to query material properties on a node.

**5. No `physics` equivalent for 3D** — The `physics` command shows Actor velocity, contacts, and gravity. There's no equivalent showing Node3D world position, rotation, scale, parent chain, and material state.

**6. No grid-aware commands** — The dungeon game is grid-based. Being able to say `qdbg grid` and see the tile map with entity positions overlaid would be a huge debugging aid.

### Proposed Commands

```bash
# 3D transform inspector (like `physics` but for 3D)
pnpm qdbg transform Player
# → Position: (3, 0, 5)  Rotation: (0, 1.57, 0)  Scale: (1, 1, 1)
# → World Position: (3, 0, 5)  Parent: DungeonLevel
# → Object3D children: 2 (GLTFModel, BoneAttachment)

# Camera state
pnpm qdbg camera
# → Active: Camera3D (fov: 50, near: 0.1, far: 1000)
# → Position: (3, 5, 7.5)  LookAt: (3, 0, 5)
# → Following: PlayerCharacter  Offset: (0, 5, 2.5)

# Light summary
pnpm qdbg lights
# → AmbientLight: intensity=0.15, color=#ffffff
# → DirectionalLight: intensity=0.8, shadows=on, mapSize=2048
# → PointLight ×8: intensity=1.2 (avg), range=4

# Material inspector
pnpm qdbg material Enemy
# → MeshStandardMaterial ×3: color=#5c4a3a, emissive=#000000, opacity=1
# → Textures: 2 loaded, 0 missing

# Grid visualizer (for grid-based games)
pnpm qdbg grid
# →  ##########
# →  #P.......#
# →  #..##.C..#
# →  #..##..G.#    P=Player  G=Guard  C=Coin  E=Exit
# →  #...T....#    T=Trap    .=Floor  #=Wall
# →  #....##..#
# →  #.C..##.E#
# →  ##########

# Scene stats
pnpm qdbg stats
# → Nodes: 47 (23 Node3D, 18 Node2D, 6 Node)
# → Draw calls: 34  Triangles: 12,400
# → Textures: 8 (2.4MB)  Geometries: 12
```

### Deliverables

- [ ] Add `transform` command — shows Node3D world/local position, rotation, scale
- [ ] Add `camera` command — shows active camera state, follow target, frustum params
- [ ] Add `lights` command — lists all lights with intensity, color, shadow config
- [ ] Add `material` command — inspects materials on a named node
- [ ] Add `grid` command — renders tilemap state as ASCII with entity overlay
- [ ] Add `stats` command — Three.js renderer info (draw calls, triangles, textures)
- [ ] Expose Three.js renderer.info via debug bridge

### Tests

Test via snapshot assertions on command output format, using mock scenes with known node configurations.

---

## Phase 7: Camera Shake as First-Class Feature

### The Problem

Camera shake is implemented as a game-level `CameraShake` node that must be manually inserted between the orbit and the camera in the scene tree:

```
PlayerCharacter → CameraOrbit → CameraShake → Camera3D
```

This works, but every 3D game that wants camera shake will reimplement this exact pattern. It should be a built-in feature of `Camera3D`.

### Proposed Solution

Add shake directly to `Camera3D`:

```typescript
class Camera3D extends Node3D {
  // ... existing API ...

  /** Shake the camera with random offset that decays over duration. */
  shake(intensity: number, duration: number): void { ... }

  /** Current shake offset (applied in onUpdate). Read-only. */
  get shakeOffset(): THREE.Vector3 { ... }
}
```

### Deliverables

- [ ] Add `shake(intensity, duration)` to `Camera3D`
- [ ] Apply shake offset in `onUpdate` after follow position is computed
- [ ] Support multiple concurrent shakes (use max intensity)
- [ ] Tests for shake decay, position reset, concurrent shakes
- [ ] Deprecate the standalone `CameraShake` pattern in dungeon example

### Tests

- `shake(0.1, 0.5)` applies random offset that decays to zero
- Position returns to follow target after shake completes
- Multiple simultaneous shakes use max intensity
- Shake works with and without follow target

---

## Phase 8: Fog-of-War as Engine Primitive

### The Problem

The dungeon's `FogOfWar` class directly creates and manages `THREE.Mesh` objects — ~50 lines of raw Three.js geometry, material, and mesh management. It also tracks visited state, manages opacity per tile, and handles disposal. This is all game-logic-free infrastructure that any grid-based 3D game with fog of war would need.

The current implementation uses individual meshes per tile (one draw call each). While this works for the current small levels (8×8 to 12×12), we plan to scale to larger dungeons (30×30+) where per-tile meshes become a significant performance bottleneck. An InstancedMesh-based implementation renders the entire fog layer in a single draw call regardless of grid size.

### Proposed Solution

A `FogOverlay3D` in the engine that uses a single mesh with per-vertex opacity (or InstancedMesh with per-instance color) for efficiency:

```typescript
// packages/three/src/fog-overlay.ts
export class FogOverlay3D extends Node3D {
  tileSize = 1;
  sightRange = 3;
  hiddenOpacity = 1.0;
  visitedOpacity = 0.5;
  height = 1.5;  // Y position of fog plane

  /** Initialize grid dimensions. */
  setSize(width: number, height: number): void;

  /** Mark a tile as wall (no fog rendered). */
  setWall(col: number, row: number): void;

  /** Update visibility from a source position. */
  updateVisibility(sourceCol: number, sourceRow: number): void;

  /** Check if a tile has been visited. */
  isVisited(col: number, row: number): boolean;

  /** Reset all visited state. */
  resetVisited(): void;
}
```

### Deliverables

- [ ] Create `FogOverlay3D` using InstancedMesh for efficient rendering
- [ ] Per-tile opacity via instance color alpha channel
- [ ] Manhattan or Chebyshev distance modes
- [ ] `updateVisibility()` from one or multiple source positions
- [ ] `setWall()` to exclude tiles from fog
- [ ] Tests for visibility rules, visited tracking, wall exclusion
- [ ] Refactor dungeon `FogOfWar` to use engine primitive

### Tests

- Tiles within sight range have opacity 0
- Previously visited tiles outside range have visited opacity
- Never-visited tiles have full opacity
- Wall tiles render no fog
- Multiple visibility sources work correctly
- `resetVisited()` clears all visited state

---

## Phase 9: Particle Burst Convenience API

### The Problem

The dungeon's `effects.ts` defines 4 nearly identical factory functions:

```typescript
export function spawnBloodBurst(parent, x, y, z) { ... }
export function spawnCoinBurst(parent, x, y, z) { ... }
export function spawnDustPuff(parent, x, y, z) { ... }
export function spawnHealBurst(parent, x, y, z) { ... }
```

Each creates a `ParticleEmitter3D`, sets position, calls `burst()`, and relies on `oneShot` for cleanup. This pattern will be repeated in every 3D game.

### Proposed Solution

Add a static convenience method to `ParticleEmitter3D`:

```typescript
class ParticleEmitter3D extends Node3D {
  /** Spawn a one-shot burst at a position, auto-destroying after emission. */
  static burst(
    parent: Node,
    config: ParticleConfig3D,
    position: { x: number; y: number; z: number },
    count: number,
  ): ParticleEmitter3D { ... }
}
```

Usage becomes:

```typescript
ParticleEmitter3D.burst(this, BLOOD_BURST_CONFIG, enemy.position, 20);
```

Down from 6 lines to 1.

### Deliverables

- [ ] Add `ParticleEmitter3D.burst()` static convenience method
- [ ] Accept position as `THREE.Vector3` or `{x, y, z}` plain object
- [ ] Auto-set `oneShot: true`, call `burst(count)`, set position
- [ ] Tests for auto-cleanup, position, and particle count
- [ ] Provide preset configs as named exports (blood, spark, dust, heal) — or document the pattern

### Tests

- `burst()` creates emitter with correct position
- Emitter auto-destroys after particles expire
- Accepts both Vector3 and plain object positions

---

## Phase 10: Test Ergonomics for 3D Games

### The Problem

Testing 3D games requires extensive mocking of Three.js, GLTF loaders, and SkeletonUtils. Every test file in the dungeon example starts with 15+ lines of mock setup:

```typescript
vi.mock("three", () => import("@quintus/three/test-utils/three-mock"));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({ GLTFLoader: class { ... } }));
vi.mock("three/addons/utils/SkeletonUtils.js", () => ({ clone: (s) => { ... } }));
```

The test helper file `__tests__/helpers.ts` duplicates ~50 lines of game setup logic (registering scenes, creating mock levels, resetting state). Additionally, testing GLTF model animations requires understanding that `loaded` must be true, that animations are synchronous in tests, and that the mixer needs manual updates.

### Proposed Solution

**1. Export a pre-built Three.js mock from the package:**
```typescript
// packages/three/src/__test-utils__/index.ts
export { threeMock } from "./three-mock.js";
export { mockGLTFLoader } from "./gltf-mock.js";
export { mockSkeletonUtils } from "./skeleton-mock.js";

// Usage in test files:
// vi.mock("three", () => import("@quintus/three/test-utils"));
```

**2. A `TestGame3D` helper that sets up a complete 3D test environment:**
```typescript
// packages/three/src/__test-utils__/test-game3d.ts
export function createTestGame3D(options?: {
  width?: number;
  height?: number;
  scene?: typeof Scene;
}): { game: Game; scene: Scene; context: ThreeContext } { ... }
```

**3. A `mockGLTFAsset` helper that stubs the asset system for a GLTF model:**
```typescript
export function mockGLTFAsset(game: Game, name: string, options?: {
  animations?: string[];
  bones?: string[];
}): void { ... }
```

**4. A `TestScene3D` builder for game-logic test scaffolding:**

The real test pain extends beyond Three.js mocking — each test file creates a custom Scene subclass with 40+ lines wiring up game systems (TurnManager, DungeonGrid, etc.). A builder pattern reduces this:

```typescript
// packages/three/src/__test-utils__/test-scene3d.ts
export class TestScene3DBuilder {
  /** Add entity types to auto-instantiate in the scene. */
  withEntities(...types: (typeof Node3D)[]): this;

  /** Set grid dimensions for grid-based games. */
  withGrid(width: number, height: number): this;

  /** Build the scene and return game + scene + entities. */
  build(): { game: Game; scene: Scene; entities: Map<string, Node3D> };
}
```

The dungeon example should also provide its own game-specific test helpers showing how to build on the engine-level utilities:

```typescript
// examples/3d-dungeon/__tests__/helpers.ts
export function createDungeonTestScene(options?: {
  gridSize?: number;
  entities?: ("player" | "enemy" | "coin")[];
}): { game: Game; player: PlayerCharacter; grid: DungeonGrid; ... } { ... }
```

### Deliverables

- [ ] Export test utilities from `@quintus/three/test-utils` subpath
- [ ] `createTestGame3D()` helper for one-line 3D game setup
- [ ] `mockGLTFAsset()` for easy GLTF model stubbing with animations and bones
- [ ] `TestScene3DBuilder` for declarative game-logic test scaffolding
- [ ] Document the Three.js mocking pattern in a test guide
- [ ] Ensure all mocks are compatible with Vitest's `vi.mock()`
- [ ] Refactor dungeon `__tests__/helpers.ts` to build on engine test utilities
- [ ] Refactor dungeon tests to use the new helpers (validate ergonomics)

### Tests

- `createTestGame3D()` returns a functional game with ThreePlugin installed
- `mockGLTFAsset()` makes `GLTFModel` load synchronously in tests
- `TestScene3DBuilder` produces a scene with requested entities
- Node3D tree operations work with mocked Three.js

---

## Additional Footguns & Sharp Edges (Not Phased)

These are smaller issues that don't warrant their own phase but should be addressed:

### F1: Node3D under Node2D warning is too quiet

Adding a Node3D as a child of a Node2D silently works but the transform won't cascade properly. The warning is logged once per node ID via `_warnedNode2DIds`, which is easy to miss. Consider making this a hard error or at minimum ensuring the warning includes guidance on what to do instead.

### F2: Transform accessors have lazy-creation trap

The `visible` getter is safe — it checks `_object3d` before accessing Three.js. But the `position`, `rotation`, and `scale` getters trigger lazy `object3d` creation via the `this.object3d` property accessor. This means:

```typescript
const node = new MeshNode();
node.visible = false;       // OK — cached in _visible, no object3d created
console.log(node.visible);  // OK — returns _visible, no object3d created
console.log(node.position); // Creates object3d! Surprising side effect.
console.log(node.rotation); // Same — triggers lazy creation
```

Consider making the `position`, `rotation`, and `scale` getters also return cached `_position`/`_rotation`/`_scale` Vector3 instances when `_object3d` doesn't exist yet, mirroring the `visible` getter pattern.

### F3: Camera3D aspect ratio can drift

`Camera3D` updates `camera.aspect` in `onUpdate()` using `game.width / game.height`, but only for perspective cameras. If the game resizes and the camera hasn't had an `onUpdate` tick yet, the aspect ratio is stale. The ThreeRenderer should handle this during resize.

### F4: TileMap3D rebuild is all-or-nothing

Changing a single tile requires `rebuild()` which recreates ALL InstancedMesh objects. For dynamic games (destructible terrain, doors opening), this is expensive. Consider an incremental `updateTile(col, row)` that modifies a single instance matrix.

### F5: GLTFModel doesn't dispose shared geometry

The comment says "Do NOT dispose geometry, materials, or textures" because of shared resources via SkeletonUtils.clone(). This means GPU resources leak when all instances of a model are destroyed. A reference-counting system would fix this.

### F6: ThreeLayer + ThreeRenderer parent map race

`ThreeRenderer._walkSync` and `ThreeLayer._syncChildren` both maintain parent maps. If a Node3D moves between a ThreeLayer and the main scene, there's potential for stale parent references. The WeakMap helps but doesn't prevent all edge cases.

### F7: No frustum culling control

There's no API to enable/disable frustum culling per node, or to set custom bounding volumes. Three.js handles this automatically for most cases, but games with large instanced meshes or procedural geometry often need manual control.

### F8: PointsNode has no update API

`PointsNode` wraps Three.js `Points` but provides no way to update particle positions after creation. The dungeon's `ParticleEmitter3D` (from `@quintus/particles`) handles this internally, but if someone wants custom point cloud behavior, they must drop to raw Three.js.

---

## Dependency Graph

```
Phase 10 (Test Ergonomics) ← standalone, high impact — do first for velocity
Phase 1 (Action Queue)     ← standalone, highest impact feature
Phase 3 (Material API)     ← standalone
Phase 7 (Camera Shake)     ← standalone, small
Phase 9 (Particle Burst)   ← standalone, small
Phase 6 (Debug Tooling)    ← standalone, high impact for development
Phase 8 (Fog of War)       ← standalone
Phase 2 (Grid Entity)      ← example-level, small
Phase 5 (Directions)       ← example-level, small
Phase 4 (Tween 3D)         ← REMOVED (covered by Phase 1 + existing @quintus/tween)
```

### Recommended Implementation Order

1. **Phase 10** — Test ergonomics (enables proper testing of all subsequent work)
2. **Phase 1** — Action queue with priority system (biggest single improvement, now testable)
3. **Phase 3** — Material/model convenience API (removes raw Three.js boilerplate)
4. **Phase 7** — Camera shake built-in (small, self-contained, proven pattern from 2D)
5. **Phase 9** — Particle burst convenience (small, self-contained)
6. **Phase 5** — Direction constants (example-level, tiny, deduplicates 3 files)
7. **Phase 2** — Grid entity (example-level, deduplicates 5 entities)
8. **Phase 6** — Debug tooling (high value but large scope, benefits from stable API)
9. **Phase 8** — Fog of war (InstancedMesh rewrite for larger levels)

---

## Definition of Done

- [ ] All active phases marked Done in status table (Phase 4 removed)
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes — all existing tests still pass
- [ ] New API surface has full test coverage
- [ ] `pnpm lint` clean
- [ ] Dungeon example refactored to use new APIs where applicable
- [ ] Dungeon inline easing replaced with `import { Ease } from "@quintus/tween"`
- [ ] Footguns F1–F3 addressed (warnings, transform lazy creation, aspect ratio)
- [ ] Engine-level API additions exported from `@quintus/three` index
- [ ] Example-level additions (Phases 2, 5) live in `examples/3d-dungeon/`
