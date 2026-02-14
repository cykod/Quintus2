# Phase 1: Core Engine — Detailed Design

> **Goal:** The fundamental building blocks — nodes, game loop, math, signals, rendering. After this phase, you can create a tree of nodes that update and render each frame.
> **Duration:** ~2 weeks
> **Outcome:** A bouncing ball demo runs in the browser. All math/core tests pass. `@quintus/math` + `@quintus/core` ship as valid ESM/CJS bundles under 15KB combined gzipped.

---

## Table of Contents

1. [Package: @quintus/math](#1-package-quintusmath)
   - [Vec2](#11-vec2)
   - [Matrix2D](#12-matrix2d)
   - [Rect](#13-rect)
   - [AABB](#14-aabb)
   - [Color](#15-color)
   - [SeededRandom](#16-seededrandom)
   - [Math Utilities](#17-math-utilities)
   - [File Structure](#18-file-structure)
2. [Package: @quintus/core](#2-package-quintuscore)
   - [Signal System](#21-signal-system)
   - [Node](#22-node)
   - [Node2D](#23-node2d)
   - [Scene](#24-scene)
   - [Game](#25-game)
   - [Game Loop](#26-game-loop)
   - [DrawContext & Canvas2DRenderer](#27-drawcontext--canvas2drenderer)
   - [AssetLoader](#28-assetloader)
   - [Plugin System](#29-plugin-system)
   - [File Structure](#210-file-structure)
3. [Cross-Cutting Concerns](#3-cross-cutting-concerns)
   - [Dependency Direction](#31-dependency-direction)
   - [Error Handling](#32-error-handling)
   - [Performance Considerations](#33-performance-considerations)
4. [Test Plan](#4-test-plan)
5. [Demo: Bouncing Ball](#5-demo-bouncing-ball)
6. [Definition of Done](#6-definition-of-done)
7. [Execution Order](#7-execution-order)

---

## 1. Package: `@quintus/math`

Size budget: **~3KB gzipped**

This package has zero dependencies. It provides the mathematical primitives used by every other package.

### 1.1 Vec2

A mutable 2D vector. Fields `x` and `y` can be assigned directly. Methods like `add()`, `sub()`, `scale()` return new `Vec2` instances for chaining/functional style, while direct field mutation like `this.position.x += 5` works naturally via the Proxy-based dirty-flagging in Node2D.

**File:** `packages/math/src/vec2.ts`

```typescript
export class Vec2 {
  x: number;
  y: number;

  constructor(x: number, y: number);

  // === Static Constants ===
  static readonly ZERO: Vec2;    // (0, 0)
  static readonly ONE: Vec2;     // (1, 1)
  static readonly UP: Vec2;      // (0, -1)  — screen-space up
  static readonly DOWN: Vec2;    // (0, 1)
  static readonly LEFT: Vec2;    // (-1, 0)
  static readonly RIGHT: Vec2;   // (1, 0)

  // === Arithmetic (return new Vec2 for chaining) ===
  add(v: Vec2): Vec2;
  sub(v: Vec2): Vec2;
  mul(v: Vec2): Vec2;             // Component-wise multiply
  div(v: Vec2): Vec2;             // Component-wise divide
  scale(scalar: number): Vec2;
  negate(): Vec2;                  // (-x, -y)

  // === Geometry ===
  dot(v: Vec2): number;
  cross(v: Vec2): number;         // 2D cross product (scalar z-component)
  length(): number;
  lengthSquared(): number;
  normalize(): Vec2;               // Unit vector (returns ZERO if length is 0)
  withLength(len: number): Vec2;   // Resize to specific length

  // === Distance ===
  distanceTo(v: Vec2): number;
  distanceSquaredTo(v: Vec2): number;

  // === Rotation ===
  angle(): number;                 // Angle from positive x-axis (radians)
  angleTo(v: Vec2): number;       // Angle between two vectors
  rotate(angle: number): Vec2;    // Rotate around origin

  // === Interpolation ===
  lerp(v: Vec2, t: number): Vec2;
  moveToward(target: Vec2, maxDelta: number): Vec2;

  // === Comparison ===
  equals(v: Vec2): boolean;
  approxEquals(v: Vec2, epsilon?: number): boolean;

  // === Utility ===
  abs(): Vec2;
  floor(): Vec2;
  ceil(): Vec2;
  round(): Vec2;
  clamp(min: Vec2, max: Vec2): Vec2;
  clone(): Vec2;
  toString(): string;              // "Vec2(x, y)"
  toArray(): [number, number];

  // === Static Factories ===
  static from(obj: { x: number; y: number }): Vec2;
  static fromAngle(angle: number): Vec2;  // Unit vector from angle
}
```

**Design decisions:**
- **Mutable:** `x` and `y` are plain mutable fields. Mutable vectors are the standard in game engines (Godot, Unity, Phaser). Game code naturally mutates position every frame. Direct mutation like `this.position.x += 5` is the most intuitive API.
- **Screen-space coordinates:** `UP` is `(0, -1)` because canvas y-axis points down. This matches Godot's 2D convention.
- **Safe normalize:** `Vec2.ZERO.normalize()` returns `Vec2.ZERO` instead of `NaN`. Game code often normalizes velocity that may be zero.
- **Methods return new instances for chaining:** `add()`, `sub()`, `scale()`, etc. return new `Vec2` for functional-style chaining. But the main win is that `position.x += 5` just works via the Proxy-based dirty-flagging in Node2D.
- **Engine-internal pooling:** `Vec2Pool` (see below) is available for engine hot paths that create many temporary Vec2 instances per frame (physics resolution, transform cascade, collision detection), avoiding allocation in those critical paths.

#### Vec2Pool

**File:** `packages/math/src/vec2-pool.ts`

Object pool for engine-internal hot paths that create many temporary Vec2 instances per frame. This avoids allocation in performance-critical code like physics resolution and transform cascades. `Vec2Pool` is an `@internal` escape hatch for engine code only.

```typescript
/**
 * @internal Engine-only. Not exported from the public API.
 *
 * Object pool for temporary Vec2 values in hot paths.
 * Avoids allocation in performance-critical code like physics resolution,
 * transform cascades, and collision detection.
 *
 * Usage pattern:
 *   const pool = new Vec2Pool(64);
 *   pool.begin();         // Start of frame / hot section
 *   const tmp = pool.get(x, y);  // Borrow a temporary
 *   // ... use tmp for intermediate calculations ...
 *   pool.end();           // All borrowed temporaries are "freed"
 *
 * Temporaries MUST NOT escape the begin/end scope (don't store them).
 */
export class Vec2Pool {
  private readonly pool: Array<{ x: number; y: number }>;
  private cursor: number = 0;

  constructor(capacity?: number);  // Default: 64

  /** Mark the start of a pooled section. Resets the cursor. */
  begin(): void;

  /** Get a temporary mutable {x, y} from the pool. */
  get(x: number, y: number): { x: number; y: number };

  /** Mark the end of a pooled section. Debug mode warns if pool was exhausted. */
  end(): void;

  /** Convert a pooled temporary to a Vec2 (for returning to user code). */
  toVec2(tmp: { x: number; y: number }): Vec2;
}
```

**Design decisions:**
- **Not exported from `@quintus/math` public API.** Exported only from an internal entry point (`packages/math/src/internal.ts`) used by `@quintus/core` and `@quintus/physics`.
- **begin/end scope:** The pool uses a simple cursor that resets on `begin()`. Temporaries are only valid within the current scope — storing them is a bug. Debug builds can detect this.
- **Avoiding allocation in hot paths:** Even though Vec2 is mutable, engine-internal code like physics resolution and transform cascades create many short-lived temporaries. The pool avoids allocating new Vec2 instances in these hot paths, reducing GC pressure on mobile.
- **Why now, not Phase 12:** Phase 2's `move()` involves velocity addition, gravity, multiple AABB checks, slide vector calculation, and position correction per body per frame. Without pooling, 50 bodies create thousands of temporary Vec2 objects per frame, causing GC pauses on mobile.

### 1.2 Matrix2D

A 3x3 affine transformation matrix stored as 6 numbers (the bottom row is always `[0, 0, 1]`). Used internally for the transform cascade — most user code won't touch this directly.

**File:** `packages/math/src/matrix2d.ts`

```typescript
/**
 * 3x3 affine transform matrix (2D):
 * | a  c  e |
 * | b  d  f |
 * | 0  0  1 |
 *
 * Maps directly to Canvas2D's setTransform(a, b, c, d, e, f).
 */
export class Matrix2D {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;  // translateX
  readonly f: number;  // translateY

  constructor(a: number, b: number, c: number, d: number, e: number, f: number);

  // === Static Constants ===
  static readonly IDENTITY: Matrix2D;

  // === Static Factories ===
  static translate(x: number, y: number): Matrix2D;
  static rotate(angle: number): Matrix2D;
  static scale(sx: number, sy: number): Matrix2D;

  /**
   * Compose a full TRS transform. This is the primary factory for Node2D.
   * Order: translate × rotate × scale (applied right-to-left: scale first, then rotate, then translate)
   */
  static compose(position: Vec2, rotation: number, scale: Vec2): Matrix2D;

  // === Operations ===
  multiply(other: Matrix2D): Matrix2D;      // this × other
  premultiply(other: Matrix2D): Matrix2D;    // other × this

  // === Transform Points ===
  transformPoint(p: Vec2): Vec2;             // Apply full transform (translate + rotate + scale)
  transformVector(v: Vec2): Vec2;            // Apply rotation + scale only (no translate)
  inverseTransformPoint(p: Vec2): Vec2;      // World → local

  // === Decomposition ===
  decompose(): { position: Vec2; rotation: number; scale: Vec2 };
  getTranslation(): Vec2;
  getRotation(): number;
  getScale(): Vec2;

  // === Inverse ===
  inverse(): Matrix2D;
  determinant(): number;

  // === Comparison ===
  equals(m: Matrix2D): boolean;
  approxEquals(m: Matrix2D, epsilon?: number): boolean;

  // === Utility ===
  toArray(): [number, number, number, number, number, number];
  toString(): string;
}
```

**Design decisions:**
- **Column layout matches Canvas2D:** The `a, b, c, d, e, f` naming directly maps to `CanvasRenderingContext2D.setTransform(a, b, c, d, e, f)`, eliminating any translation at render time.
- **Compose is the hot path:** `Matrix2D.compose()` is called every frame for every dirty `Node2D`. It should inline the trigonometry directly rather than building 3 matrices and multiplying.
- **Immutable:** Unlike Vec2, Matrix2D remains immutable (returns new matrices). The transform cache in Node2D avoids redundant allocations.

### 1.3 Rect

An axis-aligned rectangle defined by position and size. Used for bounds, culling, dead zones, and UI layout.

**File:** `packages/math/src/rect.ts`

```typescript
export class Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;

  constructor(x: number, y: number, width: number, height: number);

  // === Computed Properties ===
  get left(): number;
  get right(): number;
  get top(): number;
  get bottom(): number;
  get center(): Vec2;
  get size(): Vec2;
  get topLeft(): Vec2;
  get topRight(): Vec2;
  get bottomLeft(): Vec2;
  get bottomRight(): Vec2;

  // === Queries ===
  contains(point: Vec2): boolean;
  containsRect(other: Rect): boolean;
  intersects(other: Rect): boolean;

  // === Operations ===
  intersection(other: Rect): Rect | null;   // Overlapping area, or null
  union(other: Rect): Rect;                  // Bounding rect of both
  expand(amount: number): Rect;              // Grow by amount on all sides
  expandToInclude(point: Vec2): Rect;

  // === Utility ===
  equals(other: Rect): boolean;
  clone(): Rect;
  toString(): string;

  // === Static Factories ===
  static fromCenter(center: Vec2, size: Vec2): Rect;
  static fromPoints(p1: Vec2, p2: Vec2): Rect;       // Min/max corners
  static fromMinMax(min: Vec2, max: Vec2): Rect;
}
```

### 1.4 AABB

Axis-aligned bounding box in min/max form. Primarily used by the physics spatial hash (Phase 2), but defined here for math completeness.

**File:** `packages/math/src/aabb.ts`

```typescript
export class AABB {
  readonly min: Vec2;
  readonly max: Vec2;

  constructor(min: Vec2, max: Vec2);

  // === Computed ===
  get center(): Vec2;
  get size(): Vec2;
  get width(): number;
  get height(): number;

  // === Queries ===
  contains(point: Vec2): boolean;
  overlaps(other: AABB): boolean;
  containsAABB(other: AABB): boolean;

  // === Operations ===
  merge(other: AABB): AABB;                 // Union of two AABBs
  expand(amount: number): AABB;

  // === Conversion ===
  toRect(): Rect;

  // === Static Factories ===
  static fromRect(rect: Rect): AABB;
  static fromPoints(points: Vec2[]): AABB;
  static fromCenterSize(center: Vec2, size: Vec2): AABB;
}
```

### 1.5 Color

RGBA color with components in the 0–1 range. Used for tinting, drawing, and UI styling.

**File:** `packages/math/src/color.ts`

```typescript
export class Color {
  readonly r: number;  // 0–1
  readonly g: number;  // 0–1
  readonly b: number;  // 0–1
  readonly a: number;  // 0–1, default 1

  constructor(r: number, g: number, b: number, a?: number);

  // === Named Constants ===
  static readonly WHITE: Color;
  static readonly BLACK: Color;
  static readonly RED: Color;
  static readonly GREEN: Color;
  static readonly BLUE: Color;
  static readonly YELLOW: Color;
  static readonly CYAN: Color;
  static readonly MAGENTA: Color;
  static readonly TRANSPARENT: Color;   // (0, 0, 0, 0)

  // === Operations ===
  lerp(other: Color, t: number): Color;
  multiply(other: Color): Color;         // Component-wise (for tinting)
  withAlpha(a: number): Color;

  // === Conversion ===
  toHex(): string;                       // "#RRGGBB" or "#RRGGBBAA"
  toCSS(): string;                       // "rgba(R, G, B, A)" with 0-255 range
  toArray(): [number, number, number, number];

  // === Comparison ===
  equals(other: Color): boolean;

  // === Static Factories ===
  static fromHex(hex: string): Color;       // "#RGB", "#RRGGBB", "#RRGGBBAA"
  static fromHSL(h: number, s: number, l: number, a?: number): Color;
  static fromBytes(r: number, g: number, b: number, a?: number): Color;  // 0-255
}
```

**Design decisions:**
- **0–1 range:** Matches WebGL conventions and makes `lerp` / `multiply` natural. The `toCSS()` method converts to 0–255 internally.
- **`multiply()` for tinting:** When a parent's `tint` is `Color(1, 0.5, 0.5, 1)` and a child's is `Color(1, 1, 1, 0.8)`, the effective tint is `parent.multiply(child)` = `Color(1, 0.5, 0.5, 0.8)`.

### 1.6 SeededRandom

Deterministic pseudo-random number generator using the mulberry32 algorithm. Critical for AI testing and reproducible simulations.

**File:** `packages/math/src/seeded-random.ts`

```typescript
export class SeededRandom {
  private state: number;

  constructor(seed: number);

  // === Core ===
  /** Returns a float in [0, 1). Advances the state. */
  next(): number;

  // === Convenience ===
  /** Random integer in [min, max] (inclusive). */
  int(min: number, max: number): number;

  /** Random float in [min, max). */
  float(min: number, max: number): number;

  /** Returns true with the given probability (default 0.5). */
  bool(probability?: number): boolean;

  /** Pick a random element from an array. */
  pick<T>(array: readonly T[]): T;

  /** Return a shuffled copy (Fisher-Yates). Does NOT mutate the input. */
  shuffle<T>(array: readonly T[]): T[];

  /** Random angle in [0, 2*PI). */
  angle(): number;

  /** Random unit vector (direction). */
  direction(): Vec2;

  /** Random point inside a circle of given radius, centered at origin. */
  inCircle(radius: number): Vec2;

  /** Random point inside a rectangle of given size, starting at origin. */
  inRect(width: number, height: number): Vec2;

  /** Random color (full alpha). */
  color(): Color;

  /** Weighted random selection. */
  weighted<T>(items: ReadonlyArray<{ value: T; weight: number }>): T;

  /**
   * Fork: create a child RNG with its own independent sequence.
   * The child's seed is derived deterministically from the parent's state + label hash.
   * This ensures subsystems don't interfere with each other's sequences.
   */
  fork(label?: string): SeededRandom;

  /** The original seed value passed to the constructor (immutable). */
  readonly seed: number;

  /** Get the current internal state (for serialization/restore). */
  get state(): number;

  /** Restore an RNG from a previously serialized state. */
  static fromState(state: number): SeededRandom;
}
```

**Implementation: mulberry32**

```typescript
// The core PRNG algorithm — fast, small, good distribution
private advance(): number {
  let t = (this.state += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
```

**Design decisions:**
- **`fork()` is essential:** Without forking, adding a particle effect changes the RNG sequence for enemy spawning, breaking reproducibility. Each subsystem gets its own forked RNG.
- **Label hashing in fork:** `fork('physics')` and `fork('particles')` produce different child seeds even when called from the same parent state. This uses a simple string hash combined with the parent state.
- **Immutable-ish:** The RNG is inherently stateful (that's how PRNGs work), but the fork mechanism isolates subsystems.
- **`shuffle()` returns a copy:** No mutation surprise. Uses Fisher-Yates on a cloned array.

### 1.7 Math Utilities

Standalone utility functions that don't belong to a class.

**File:** `packages/math/src/utils.ts`

```typescript
/** Degrees to radians conversion factor. */
export const DEG2RAD: number;  // Math.PI / 180

/** Radians to degrees conversion factor. */
export const RAD2DEG: number;  // 180 / Math.PI

/** Clamp value between min and max. */
export function clamp(value: number, min: number, max: number): number;

/** Linear interpolation between a and b. */
export function lerp(a: number, b: number, t: number): number;

/** Inverse lerp: returns t such that lerp(a, b, t) === value. */
export function inverseLerp(a: number, b: number, value: number): number;

/** Remap value from [inMin, inMax] to [outMin, outMax]. */
export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number;

/** Wrap value to [min, max) range (like modulo but handles negatives). */
export function wrap(value: number, min: number, max: number): number;

/** Check if two floats are approximately equal. */
export function approxEqual(a: number, b: number, epsilon?: number): boolean;

/** Snap value to nearest multiple of step. */
export function snap(value: number, step: number): number;

/** Default epsilon for floating-point comparisons. */
export const EPSILON: number;  // 1e-6
```

### 1.8 File Structure

```
packages/math/
├── src/
│   ├── index.ts            # Re-exports public API
│   ├── internal.ts         # Re-exports engine-internal utilities (Vec2Pool)
│   ├── vec2.ts
│   ├── vec2.test.ts
│   ├── vec2-pool.ts
│   ├── vec2-pool.test.ts
│   ├── matrix2d.ts
│   ├── matrix2d.test.ts
│   ├── rect.ts
│   ├── rect.test.ts
│   ├── aabb.ts
│   ├── aabb.test.ts
│   ├── color.ts
│   ├── color.test.ts
│   ├── seeded-random.ts
│   ├── seeded-random.test.ts
│   ├── utils.ts
│   └── utils.test.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**`packages/math/src/index.ts`:**
```typescript
export { Vec2 } from "./vec2.js";
export { Matrix2D } from "./matrix2d.js";
export { Rect } from "./rect.js";
export { AABB } from "./aabb.js";
export { Color } from "./color.js";
export { SeededRandom } from "./seeded-random.js";
export {
  DEG2RAD,
  RAD2DEG,
  EPSILON,
  clamp,
  lerp,
  inverseLerp,
  remap,
  wrap,
  approxEqual,
  snap,
} from "./utils.js";
```

**`packages/math/src/internal.ts`** (engine-internal, not for end users):
```typescript
export { Vec2Pool } from "./vec2-pool.js";
```

The `internal.ts` entry point is exported from `package.json` via an `"./internal"` export map entry. This allows `@quintus/core` and `@quintus/physics` to import engine internals without exposing them to end users:
```json
{
  "exports": {
    ".": { "import": "./dist/index.js", "require": "./dist/index.cjs" },
    "./internal": { "import": "./dist/internal.js", "require": "./dist/internal.cjs" }
  }
}
```

**`packages/math/package.json` dependencies:** none (pure math, zero deps).

---

## 2. Package: `@quintus/core`

Size budget: **~10KB gzipped**

Depends on: `@quintus/math`

This is the heart of the engine. It provides the node tree, scene system, game loop, signal system, renderer, asset loading, and plugin infrastructure.

### 2.1 Signal System

Typed, discoverable event emitter inspired by Godot's signals. Signals are declared as class properties, making them visible to TypeScript, IDEs, and LLMs.

**File:** `packages/core/src/signal.ts`

```typescript
/** Callback type for signal handlers. */
export type SignalHandler<T> = (payload: T) => void;

/** Connection handle returned by connect(). Call disconnect() to remove. */
export interface SignalConnection {
  disconnect(): void;
  readonly connected: boolean;
}

/**
 * Typed signal — the core communication primitive.
 * Declared as class properties: `readonly died = signal<void>();`
 */
export class Signal<T = void> {
  /** Emit this signal with the given payload. All connected handlers fire synchronously. */
  emit(payload: T): void;
  // For void signals: emit() with no args
  // Implementation overloads:
  //   emit(): void  (when T is void)
  //   emit(payload: T): void

  /** Connect a handler. Returns a SignalConnection for disconnection. */
  connect(handler: SignalHandler<T>): SignalConnection;

  /** Connect a handler that fires once, then auto-disconnects. */
  once(handler: SignalHandler<T>): SignalConnection;

  /** Disconnect a specific handler. */
  disconnect(handler: SignalHandler<T>): void;

  /** Remove all handlers. Called automatically when the owning node is destroyed. */
  disconnectAll(): void;

  /** Number of connected handlers (useful for debugging). */
  get listenerCount(): number;

  /** Whether any handlers are connected. */
  get hasListeners(): boolean;
}

/**
 * Factory function for creating signals. Used in class declarations:
 *   readonly died = signal<void>();
 *   readonly healthChanged = signal<{ current: number; max: number }>();
 */
export function signal<T = void>(): Signal<T>;
```

**Implementation details:**
- Handlers are stored in an array (not Set — preserves insertion order, allows duplicate detection).
- `emit()` iterates a snapshot of the handler array. A `dirty` flag tracks whether any handler was disconnected during emission, avoiding O(n²) `includes()` checks in the common case.
- `once()` wraps the handler to auto-disconnect after first call.
- When a `Node` is destroyed, all signals on it call `disconnectAll()`. This prevents dangling references.
- Signals are **synchronous** — `emit()` calls all handlers before returning. No microtask/nextTick deferral.

**Emission safety:**

```typescript
private emitting = false;
private dirtyDuringEmit = false;
private disconnectedDuringEmit: Set<SignalHandler<T>> | null = null;

emit(payload: T): void {
  // Snapshot handlers to prevent issues if a handler connects/disconnects others
  const snapshot = [...this.handlers];
  this.emitting = true;
  this.dirtyDuringEmit = false;

  for (const handler of snapshot) {
    // If nothing was disconnected during this emission, skip the check entirely (O(1))
    if (!this.dirtyDuringEmit || !this.disconnectedDuringEmit?.has(handler)) {
      handler(payload);
    }
  }

  this.emitting = false;
  this.disconnectedDuringEmit = null;
}

disconnect(handler: SignalHandler<T>): void {
  const idx = this.handlers.indexOf(handler);
  if (idx === -1) return;
  this.handlers.splice(idx, 1);

  // Track disconnections during emission for O(1) lookup
  if (this.emitting) {
    this.dirtyDuringEmit = true;
    (this.disconnectedDuringEmit ??= new Set()).add(handler);
  }
}
```

**Performance:** In the common case (no disconnections during emit), the emit loop is a simple array iteration with no per-handler checks — O(n). When handlers disconnect during emission, the `Set` lookup is O(1) per handler, keeping the worst case at O(n).

### 2.2 Node

The base class for everything in the scene tree. Pure logic — no transform, no rendering. Manages parent/child relationships, lifecycle, tags, and signals.

**File:** `packages/core/src/node.ts`

```typescript
/** Controls whether this node updates when the scene is paused. */
export type PauseMode = "inherit" | "independent";

/**
 * Type for node constructors. Supports both zero-arg and multi-arg constructors.
 */
export interface NodeConstructor<T extends Node = Node, Args extends unknown[] = []> {
  new (...args: Args): T;
}

/**
 * Props type for the addChild/add class+props overload.
 * Only allows user-settable properties — excludes internal state, methods, and readonly fields.
 */
export type NodeProps = {
  name?: string;
  pauseMode?: PauseMode;
};

export class Node {
  // === Identity ===
  /** Display name (non-unique, used for find-by-name). */
  name: string;

  /** Unique numeric ID assigned at creation. Monotonically increasing. */
  readonly id: number;

  // === Tree ===
  readonly parent: Node | null;
  readonly children: ReadonlyArray<Node>;

  // === Lifecycle State ===
  /** Whether onReady() has been called. */
  readonly isReady: boolean;

  /** Whether this node is inside an active scene tree. */
  readonly isInsideTree: boolean;

  /** Whether destroy() has been called. */
  readonly isDestroyed: boolean;

  // === Pause Mode ===
  /**
   * Controls update behavior when the scene is paused:
   * - 'inherit': follows parent, stops when scene is paused (default)
   * - 'independent': always updates regardless of pause state
   */
  pauseMode: PauseMode;

  // === Tags ===
  tag(...tags: string[]): this;
  untag(...tags: string[]): this;
  hasTag(tag: string): boolean;
  readonly tags: ReadonlySet<string>;

  // === Tree Manipulation ===
  /**
   * Add a child node. Three overloads:
   * 1. addChild(existingNode) — reparent an existing node
   * 2. addChild(NodeClass, props?) — construct a zero-arg node and apply props
   * 3. addChild(NodeClass, args...) — construct a node with constructor arguments
   */
  addChild(node: Node): this;
  addChild<T extends Node>(NodeClass: NodeConstructor<T>, props?: NodeProps & Node2DProps): T;
  addChild<T extends Node, Args extends unknown[]>(NodeClass: NodeConstructor<T, Args>, ...args: Args): T;

  /** Remove a child from this node. The child is NOT destroyed — just detached. */
  removeChild(node: Node): void;

  /** Remove this node from its parent. */
  removeSelf(): void;

  // === Tree Queries ===
  /** Find first descendant by name (depth-first). */
  find(name: string): Node | null;

  /** Find all descendants matching a tag. */
  findAll(tag: string): Node[];

  /** Get first child of a specific type. */
  getChild<T extends Node>(type: NodeConstructor<T>): T | null;

  /** Get all children of a specific type (immediate children only). */
  getChildren<T extends Node>(type: NodeConstructor<T>): T[];

  /** Get first descendant of a specific type (recursive). */
  findByType<T extends Node>(type: NodeConstructor<T>): T | null;

  /** Get all descendants of a specific type (recursive). */
  findAllByType<T extends Node>(type: NodeConstructor<T>): T[];

  // === Scene/Game Access ===
  /** The root Scene this node belongs to. Null if not in a tree. */
  get scene(): Scene | null;

  /** The Game instance. Shorthand for scene.game. Null if not in a tree. */
  get game(): Game | null;

  // === Lifecycle Methods (override in subclasses) ===
  /**
   * Called once after this node AND all its children have entered the tree.
   * Use for initialization that requires access to children, scene, or game.
   */
  onReady(): void {}

  /**
   * Called every time this node enters a scene tree (including re-parenting).
   * Use for setup that depends on the current scene/game reference.
   * Unlike onReady(), this fires on every tree entry, not just the first.
   */
  onEnterTree(): void {}

  /**
   * Called every time this node exits a scene tree (including re-parenting).
   * Use for cleanup of scene-specific state (spatial index removal, etc.).
   */
  onExitTree(): void {}

  /**
   * Called every frame with variable delta time.
   * Use for: animation, camera, input-driven logic, interpolation.
   */
  onUpdate(dt: number): void {}

  /**
   * Called at fixed intervals (1/60s by default).
   * Use for: physics, movement, deterministic logic.
   * May run 0, 1, or multiple times per frame depending on frame rate.
   */
  onFixedUpdate(dt: number): void {}

  /**
   * Called when this node is removed from the tree or destroyed.
   * Use for cleanup. Signals are auto-disconnected after this.
   */
  onDestroy(): void {}

  // === Destruction ===
  /**
   * Mark this node for destruction. It will be removed from the tree
   * at the end of the current frame (deferred destruction).
   * All children are also destroyed recursively.
   */
  destroy(): void;

  // === Built-in Signals ===
  /** Emitted when this node enters the scene tree. */
  readonly treeEntered: Signal<void>;

  /** Emitted when this node exits the scene tree. */
  readonly treeExited: Signal<void>;

  /** Emitted after onReady() completes. */
  readonly ready: Signal<void>;

  /** Emitted just before onDestroy() is called. */
  readonly destroying: Signal<void>;
}
```

**Lifecycle ordering (when `addChild` is called):**

```
1. Node is added to parent.children
2. node.parent is set
3. node.isInsideTree becomes true
4. node.onEnterTree() is called
5. node.treeEntered emits
6. For each child (depth-first): steps 2-5
7. node.onReady() is called (bottom-up: deepest children first, then parent)
   — only on first entry; skipped if node.isReady is already true
8. node.ready emits
9. node.isReady becomes true
```

**Lifecycle ordering (when node is removed / reparented):**

```
1. node.onExitTree() is called
2. node.treeExited emits
3. For each child (depth-first): steps 1-2
4. Node is removed from parent.children
5. node.parent is set to null
6. node.isInsideTree becomes false
```

**Lifecycle ordering (when node is destroyed):**

```
1. node.destroy() is called → sets isDestroyed flag, adds to destruction queue
2. At end of frame (cleanup phase):
   a. node.destroying signal emits
   b. For each child (depth-first): destroy recursively
   c. node.onDestroy() is called
   d. node.onExitTree() is called
   e. node.treeExited emits
   f. Node is removed from parent.children
   g. node.parent is set to null
   h. node.isInsideTree becomes false
   i. All signals on node call disconnectAll()  ← LAST: ensures treeExited handlers fire
```

**Pause mode resolution:**

```typescript
/** Resolve whether this node should process this frame. */
private shouldProcess(scenePaused: boolean): boolean {
  if (this.resolvePauseMode() === "independent") return true;
  return !scenePaused;
}

/** Walk up the tree to resolve 'inherit' → concrete mode. */
private resolvePauseMode(): PauseMode {
  if (this.pauseMode !== "inherit") return this.pauseMode;
  if (this.parent) return this.parent.resolvePauseMode();
  return "inherit"; // Root defaults to normal processing (pauses when scene pauses)
}
```

**Unique ID generation:**

```typescript
let nextNodeId = 0;

class Node {
  readonly id = nextNodeId++;
  // ...
}
```

### 2.3 Node2D

Extends `Node` with 2D spatial transform. Every visible game object is a `Node2D` (or subclass).

**File:** `packages/core/src/node2d.ts`

```typescript
import type { Vec2, Matrix2D, Color } from "@quintus/math";

/**
 * Props type for Node2D construction via addChild/add class+props overload.
 * Extends NodeProps with spatial and rendering properties.
 */
export interface Node2DProps extends NodeProps {
  position?: Vec2;
  rotation?: number;
  scale?: Vec2;
  zIndex?: number;
  visible?: boolean;
  tint?: Color;
  selfTint?: Color;
}

export class Node2D extends Node {
  // === Local Transform ===
  /** Position relative to parent. Mutable — assigning position.x marks transform dirty via Proxy. */
  get position(): Vec2;
  set position(v: Vec2);

  /** Rotation in radians, relative to parent. */
  get rotation(): number;
  set rotation(r: number);

  /** Scale relative to parent. Default: (1, 1). */
  get scale(): Vec2;
  set scale(v: Vec2);

  // === Global Transform (computed, read-only in most cases) ===
  /** Position in world/scene space. */
  get globalPosition(): Vec2;
  set globalPosition(v: Vec2);  // Sets local position to achieve desired global

  /** Rotation in world/scene space. */
  get globalRotation(): number;

  /** Scale in world/scene space. */
  get globalScale(): Vec2;

  /** The full affine transform in world space. Cached, dirty-flagged. */
  get globalTransform(): Matrix2D;

  /** The local transform matrix (position × rotation × scale). */
  get localTransform(): Matrix2D;

  // === Rendering ===
  /** Draw order. Higher zIndex renders on top. Default: 0. */
  zIndex: number;

  /** Whether this node and its children are visible. Default: true. */
  visible: boolean;

  /**
   * Whether this node has visual content to render.
   * Set to true in subclasses that override onDraw(). The renderer uses this
   * to skip logic-only nodes instead of fragile prototype comparison.
   * Default: false.
   */
  protected hasVisualContent: boolean;

  /**
   * Color tint applied to this node AND its children (inherited).
   * Default: Color.WHITE (no tint). Use for flash effects, alpha fade, etc.
   * Tinting is implemented via offscreen canvas compositing in Canvas2D mode.
   */
  get tint(): Color;
  set tint(c: Color);

  /**
   * Color tint applied to this node only (NOT inherited by children).
   * Default: Color.WHITE.
   */
  get selfTint(): Color;
  set selfTint(c: Color);

  /**
   * The effective tint color (this node's tint × all ancestor tints).
   * Cached with dirty flag — only recomputed when tint changes on this node or ancestors.
   */
  get effectiveTint(): Color;

  // === Custom Drawing ===
  /**
   * Override to draw custom graphics. Called by the renderer each frame.
   * The DrawContext is pre-transformed to this node's local space —
   * draw at (0,0) and transforms are handled automatically.
   * Subclasses that override this should also set `hasVisualContent = true`.
   */
  onDraw(ctx: DrawContext): void {}

  // === Convenience ===
  /** Rotate to face a world-space target. */
  lookAt(target: Vec2): void;

  /** Move toward a target by up to maxDelta units. */
  moveToward(target: Vec2, speed: number, dt: number): void;

  /** Convert a point from world space to this node's local space. */
  toLocal(worldPoint: Vec2): Vec2;

  /** Convert a point from this node's local space to world space. */
  toGlobal(localPoint: Vec2): Vec2;
}
```

**Transform cascade algorithm:**

The transform cascade is the performance-critical inner loop. It uses a dirty flag pattern with Proxy-based mutation detection for Vec2 fields:

```typescript
class Node2D extends Node {
  // --- Transform state ---
  private _position = new Vec2(0, 0);
  private _positionProxy: Vec2;  // Proxy wrapping _position
  private _rotation = 0;
  private _scale = new Vec2(1, 1);
  private _scaleProxy: Vec2;  // Proxy wrapping _scale
  private _localTransformDirty = true;
  private _globalTransformDirty = true;
  private _cachedLocalTransform = Matrix2D.IDENTITY;
  private _cachedGlobalTransform = Matrix2D.IDENTITY;

  // --- Tint state (dirty-flag cached, same pattern as transform) ---
  private _tint = Color.WHITE;
  private _selfTint = Color.WHITE;
  private _tintDirty = true;
  private _cachedEffectiveTint = Color.WHITE;

  // --- Visual content flag ---
  protected hasVisualContent = false;

  constructor() {
    super();
    // Create Proxy wrappers that trap x/y assignment to mark transform dirty
    this._positionProxy = this.createVec2Proxy(this._position);
    this._scaleProxy = this.createVec2Proxy(this._scale);
  }

  /**
   * Create a Proxy around a Vec2 that marks transforms dirty on x/y assignment.
   * The Proxy traps `position.x = 5` and marks the transform dirty, so
   * `this.position.x += speed * dt` works naturally while still triggering
   * transform cache invalidation.
   */
  private createVec2Proxy(target: Vec2): Vec2 {
    return new Proxy(target, {
      set: (obj, prop, value) => {
        if (prop === "x" || prop === "y") {
          if ((obj as Record<string, number>)[prop] !== value) {
            (obj as Record<string, number>)[prop] = value;
            this.markTransformDirty();
          }
          return true;
        }
        (obj as Record<string, unknown>)[prop as string] = value;
        return true;
      },
    });
  }

  get position(): Vec2 { return this._positionProxy; }
  set position(v: Vec2) {
    if (this._position.x === v.x && this._position.y === v.y) return;
    this._position.x = v.x;
    this._position.y = v.y;
    this.markTransformDirty();
  }

  get rotation(): number { return this._rotation; }
  set rotation(r: number) {
    if (this._rotation === r) return;
    this._rotation = r;
    this.markTransformDirty();
  }

  get scale(): Vec2 { return this._scaleProxy; }
  set scale(v: Vec2) {
    if (this._scale.x === v.x && this._scale.y === v.y) return;
    this._scale.x = v.x;
    this._scale.y = v.y;
    this.markTransformDirty();
  }

  get tint(): Color { return this._tint; }
  set tint(c: Color) {
    if (this._tint === c) return;
    this._tint = c;
    this.markTintDirty();
  }

  get selfTint(): Color { return this._selfTint; }
  set selfTint(c: Color) {
    if (this._selfTint === c) return;
    this._selfTint = c;
    this._tintDirty = true;  // Only self — don't propagate to children
  }

  get effectiveTint(): Color {
    if (this._tintDirty) {
      const parentTint = this.parent instanceof Node2D
        ? this.parent.effectiveTint
        : Color.WHITE;
      this._cachedEffectiveTint = parentTint.multiply(this._tint).multiply(this._selfTint);
      this._tintDirty = false;
    }
    return this._cachedEffectiveTint;
  }

  get localTransform(): Matrix2D {
    if (this._localTransformDirty) {
      this._cachedLocalTransform = Matrix2D.compose(this._position, this._rotation, this._scale);
      this._localTransformDirty = false;
    }
    return this._cachedLocalTransform;
  }

  get globalTransform(): Matrix2D {
    if (this._globalTransformDirty) {
      const parentTransform =
        this.parent instanceof Node2D
          ? this.parent.globalTransform
          : Matrix2D.IDENTITY;
      this._cachedGlobalTransform = parentTransform.multiply(this.localTransform);
      this._globalTransformDirty = false;
    }
    return this._cachedGlobalTransform;
  }

  private markTransformDirty(): void {
    this._localTransformDirty = true;
    this._globalTransformDirty = true;
    for (const child of this.children) {
      if (child instanceof Node2D) {
        child.markGlobalTransformDirty();
      }
    }
  }

  private markGlobalTransformDirty(): void {
    if (this._globalTransformDirty) return;  // Already dirty — stop propagation
    this._globalTransformDirty = true;
    for (const child of this.children) {
      if (child instanceof Node2D) {
        child.markGlobalTransformDirty();
      }
    }
  }

  private markTintDirty(): void {
    if (this._tintDirty) return;  // Already dirty — stop propagation
    this._tintDirty = true;
    for (const child of this.children) {
      if (child instanceof Node2D) {
        child.markTintDirty();
      }
    }
  }
}
```

**Design decisions:**
- **Proxy-based dirty-flagging for mutable Vec2:** The `position` getter returns a Proxy that traps `set` on `x`/`y` to mark transforms dirty. This means `this.position.x += speed * dt` works naturally while still triggering transform cache invalidation. The `position` setter still works for full replacement: `this.position = new Vec2(100, 200)`.
- **Lazy computation:** `globalTransform` and `effectiveTint` are only recomputed when accessed AND dirty. Nodes that aren't queried or rendered this frame skip the computation entirely.
- **Early-exit on dirty propagation:** If a child is already dirty, its subtree must also be dirty, so propagation stops. Same pattern for both transform and tint.
- **Tint caching:** `effectiveTint` uses the same dirty-flag pattern as `globalTransform`. Setting `tint` propagates dirty down to all Node2D descendants. Setting `selfTint` only dirties self (it does not inherit).
- **`hasVisualContent` flag:** Explicitly opt-in flag replaces fragile prototype comparison for `onDraw()` override detection. Subclasses set `hasVisualContent = true` when they have visual content.
- **`globalPosition` setter:** Setting `globalPosition` is a convenience that computes the local position needed to achieve the desired world position: `this.position = parent.globalTransform.inverse().transformPoint(desiredGlobal)`.

### 2.4 Scene

A scene is a root-level node tree that represents a game state (main menu, level 1, game over, etc.). Scenes are defined as classes that extend `Scene` and managed by the `Game`.

**File:** `packages/core/src/scene.ts`

```typescript
export class Scene extends Node {
  /** The Game instance that owns this scene. */
  readonly game: Game;

  /** Scene name (set via game.scene() registration or class name). */
  readonly name: string;

  /** Whether this scene is paused (stops onUpdate/onFixedUpdate for 'inherit' nodes). */
  paused: boolean;

  // === Entity Spawning (convenience wrappers around addChild) ===

  /**
   * Add a node to the scene. Primary spawning API.
   * Overloads match Node.addChild().
   */
  add(node: Node): this;
  add<T extends Node>(NodeClass: NodeConstructor<T>, props?: NodeProps & Node2DProps): T;
  add<T extends Node, Args extends unknown[]>(NodeClass: NodeConstructor<T, Args>, ...args: Args): T;

  // === Scene-Wide Queries ===

  /** Find all nodes with a given tag, anywhere in the tree. */
  findAll(tag: string): Node[];

  /** Find all nodes of a specific type, anywhere in the tree. */
  findAllByType<T extends Node>(type: NodeConstructor<T>): T[];

  /** Get first node of a specific type in the tree. Returns null if not found. */
  get<T extends Node>(type: NodeConstructor<T>): T | null;

  /** Get all nodes of a specific type in the tree. */
  getAll<T extends Node>(type: NodeConstructor<T>): T[];

  /** Count nodes with a given tag. */
  count(tag: string): number;

  // === Scene Transitions ===

  /**
   * Switch to another scene. The current scene is destroyed,
   * the new scene is created and its onReady() runs.
   */
  switchTo(sceneNameOrClass: string | SceneConstructor): void;

  // === Signals ===
  readonly sceneReady: Signal<void>;
  readonly sceneDestroyed: Signal<void>;
}

/**
 * Constructor type for Scene subclasses.
 */
export interface SceneConstructor {
  new (): Scene;
}
```

**`add()` implementation:**

```typescript
add<T extends Node>(
  nodeOrClass: Node | NodeConstructor<T>,
  propsOrFirstArg?: NodeProps & Node2DProps,
  ...rest: unknown[]
): T | this {
  if (typeof nodeOrClass === "function") {
    // Construct from class
    const node = new (nodeOrClass as NodeConstructor<T>)(...(rest.length ? [propsOrFirstArg, ...rest] : []));
    // Apply props only for the zero-arg + props overload (no rest args, plain object)
    if (propsOrFirstArg && rest.length === 0) {
      this.applyProps(node, propsOrFirstArg);
    }
    this.addChild(node);
    return node;
  }
  // Add existing node
  this.addChild(nodeOrClass);
  return this;
}

/**
 * Apply typed props to a node. Only assigns known, safe properties.
 * Does NOT use Object.assign to prevent overwriting internal state.
 */
private applyProps(node: Node, props: NodeProps & Node2DProps): void {
  if (props.name !== undefined) node.name = props.name;
  if (props.pauseMode !== undefined) node.pauseMode = props.pauseMode;
  if (node instanceof Node2D) {
    if (props.position !== undefined) node.position = props.position;
    if (props.rotation !== undefined) node.rotation = props.rotation;
    if (props.scale !== undefined) node.scale = props.scale;
    if (props.zIndex !== undefined) node.zIndex = props.zIndex;
    if (props.visible !== undefined) node.visible = props.visible;
    if (props.tint !== undefined) node.tint = props.tint;
    if (props.selfTint !== undefined) node.selfTint = props.selfTint;
  }
}
```

**Design note:** `applyProps()` explicitly assigns each known property instead of using `Object.assign(node, props)`. This prevents users from accidentally overwriting internal state like `isReady`, `parent`, `children`, or `_cachedGlobalTransform` via `Partial<T>`. The `NodeProps` and `Node2DProps` interfaces whitelist only the properties that are safe to set from outside.

**Design note on `get<T>()` and `getAll<T>()`:** These are convenience aliases for `findByType` and `findAllByType` on the Scene root. They provide a cleaner API for the common pattern of finding nodes by type in the scene tree: `scene.get(Player)` instead of `scene.findByType(Player)`.

**Scene lifecycle:**

```
1. game.start(MainScene)  or  scene.switchTo(OtherScene)
2. Old scene destroyed (if any): onDestroy() on all nodes, tree cleaned up
3. New Scene subclass instance created, game reference set
4. scene.onReady() called — user code adds nodes in onReady()
5. onReady() called on all child nodes (bottom-up)
6. Scene enters the game loop
```

### 2.5 Game

The top-level engine container. Creates the canvas, manages scenes, runs the game loop, holds global state.

**File:** `packages/core/src/game.ts`

```typescript
export interface GameOptions {
  /** Canvas width in pixels. */
  width: number;

  /** Canvas height in pixels. */
  height: number;

  /** How to fit the canvas to the page. Default: "fit". */
  scale?: "fit" | "fixed";

  /** Enable pixel-art rendering (disables image smoothing). Default: false. */
  pixelArt?: boolean;

  /** Canvas background color. Default: "#000000". */
  backgroundColor?: string;

  /** Target canvas element ID or HTMLCanvasElement. Default: auto-create. */
  canvas?: string | HTMLCanvasElement;

  /** RNG seed for deterministic simulation. Default: Date.now(). */
  seed?: number;
}

export class Game {
  // === Config ===
  readonly width: number;
  readonly height: number;
  readonly canvas: HTMLCanvasElement;
  readonly pixelArt: boolean;

  // === State ===
  /** The currently active scene. */
  get currentScene(): Scene | null;

  /** Whether the game loop is running. */
  get running(): boolean;

  /** Deterministic random number generator. */
  readonly random: SeededRandom;

  /** Asset loader. */
  readonly assets: AssetLoader;

  /** Time elapsed since game started (in seconds). */
  get elapsed(): number;

  /** Total number of fixed updates (physics frames) that have run. */
  get fixedFrame(): number;

  /** Fixed delta time (1/60 by default). */
  readonly fixedDeltaTime: number;

  constructor(options: GameOptions);

  // === Scene Management ===

  /** Register a named scene class. */
  scene(name: string, SceneClass: SceneConstructor): this;

  /** Start the game loop with the given scene. Accepts a scene name or a Scene class. */
  start(sceneNameOrClass: string | SceneConstructor): void;

  // === Game Loop Control ===

  /** Pause the game loop (stops all updates). */
  pause(): void;

  /** Resume a paused game loop. */
  resume(): void;

  /**
   * Advance the game by one fixed timestep. For headless/testing use.
   * Does not use requestAnimationFrame — synchronous.
   *
   * @param variableDt - Optional delta time for onUpdate(). Defaults to fixedDeltaTime.
   *   Pass a different value to test code that distinguishes between
   *   onFixedUpdate (always receives fixedDeltaTime) and onUpdate (receives this value).
   */
  step(variableDt?: number): void;

  /** Stop the game loop entirely. */
  stop(): void;

  // === Plugins ===

  /** Install a plugin. */
  use(plugin: Plugin): this;

  // === Signals ===
  readonly started: Signal<void>;
  readonly stopped: Signal<void>;
  readonly sceneSwitched: Signal<{ from: string | null; to: string }>;

  /**
   * Emitted when a user lifecycle method (onReady, onUpdate, onFixedUpdate, onDraw)
   * throws an error. The error is caught to keep the game loop alive.
   * If no handlers are connected, the error is logged with console.error.
   */
  readonly onError: Signal<{ node: Node; lifecycle: string; error: unknown }>;
}
```

**Canvas initialization:**

```typescript
constructor(options: GameOptions) {
  this.width = options.width;
  this.height = options.height;
  this.pixelArt = options.pixelArt ?? false;

  // Resolve or create canvas
  if (typeof options.canvas === "string") {
    this.canvas = document.getElementById(options.canvas) as HTMLCanvasElement;
  } else if (options.canvas instanceof HTMLCanvasElement) {
    this.canvas = options.canvas;
  } else {
    this.canvas = document.createElement("canvas");
    document.body.appendChild(this.canvas);
  }
  this.canvas.width = this.width;
  this.canvas.height = this.height;

  // Pixel-art: disable smoothing
  if (this.pixelArt) {
    this.canvas.style.imageRendering = "pixelated";
  }

  // RNG
  this.random = new SeededRandom(options.seed ?? Date.now());

  // Renderer
  this.renderer = new Canvas2DRenderer(this.canvas, this);

  // ...
}
```

### 2.6 Game Loop

Semi-fixed timestep game loop. Physics runs at a fixed 60hz (accumulator-based). Rendering runs at display refresh rate.

**File:** `packages/core/src/game-loop.ts`

```typescript
export interface GameLoopConfig {
  /** Fixed timestep in seconds. Default: 1/60. */
  fixedDeltaTime: number;

  /** Maximum accumulated time before dropping frames (prevents spiral of death). Default: 0.25s. */
  maxAccumulator: number;
}

export class GameLoop {
  private accumulator: number = 0;
  private lastTimestamp: number = 0;
  private rafId: number = 0;
  private running: boolean = false;

  /** Total elapsed time in seconds. */
  elapsed: number = 0;

  /** Total fixed frames processed. */
  fixedFrame: number = 0;

  constructor(
    private readonly config: GameLoopConfig,
    private readonly callbacks: {
      fixedUpdate: (dt: number) => void;
      update: (dt: number) => void;
      render: () => void;
      cleanup: () => void;
    },
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  /**
   * Manual step (for headless / testing). Advances exactly one fixed timestep.
   * @param variableDt - Optional delta time for onUpdate(). Defaults to fixedDeltaTime.
   *   Allows tests to distinguish between onFixedUpdate (always fixed dt) and onUpdate
   *   (variable frame dt). In real gameplay, onUpdate() receives actual elapsed time.
   */
  step(variableDt?: number): void {
    const fixedDt = this.config.fixedDeltaTime;
    this.callbacks.fixedUpdate(fixedDt);
    this.fixedFrame++;
    this.elapsed += fixedDt;
    this.callbacks.update(variableDt ?? fixedDt);
    this.callbacks.render();
    this.callbacks.cleanup();
  }

  private tick(timestamp: number): void {
    if (!this.running) return;

    // Calculate frame delta
    const rawDt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    // Clamp to prevent spiral of death (e.g., tab was backgrounded)
    const frameDt = Math.min(rawDt, this.config.maxAccumulator);

    this.accumulator += frameDt;
    this.elapsed += frameDt;

    // Fixed timestep updates (may run 0, 1, or multiple times)
    const fixedDt = this.config.fixedDeltaTime;
    while (this.accumulator >= fixedDt) {
      this.callbacks.fixedUpdate(fixedDt);
      this.fixedFrame++;
      this.accumulator -= fixedDt;
    }

    // Variable update (once per frame)
    this.callbacks.update(frameDt);

    // Render
    this.callbacks.render();

    // Cleanup destroyed nodes
    this.callbacks.cleanup();

    // Schedule next frame
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }
}
```

**Frame structure in detail:**

```
┌─────────────────────────────────────────────────────┐
│ requestAnimationFrame callback                       │
├─────────────────────────────────────────────────────┤
│ 1. Calculate dt = (now - lastTimestamp) / 1000       │
│ 2. Clamp dt to maxAccumulator (0.25s)                │
│ 3. accumulator += dt                                 │
│                                                       │
│ 4. While accumulator >= fixedDt (1/60):              │
│    a. Walk tree: node.onFixedUpdate(fixedDt)         │
│       (depth-first, respecting pauseMode)            │
│       (errors caught → game.onError signal)          │
│    b. accumulator -= fixedDt                         │
│    c. fixedFrame++                                   │
│                                                       │
│ 5. Walk tree: node.onUpdate(dt)                      │
│    (depth-first, respecting pauseMode)               │
│    (errors caught → game.onError signal)             │
│                                                       │
│ 6. Render:                                           │
│    a. renderer.clear(backgroundColor)                │
│    b. Collect all visible Node2D instances           │
│    c. Sort by zIndex                                 │
│    d. For each: apply globalTransform, call onDraw() │
│                                                       │
│ 7. Cleanup:                                          │
│    a. Process destruction queue                      │
│    b. Remove destroyed nodes from tree               │
│    c. Call onDestroy() lifecycle                      │
│    d. Disconnect all signals on destroyed nodes      │
│                                                       │
│ 8. requestAnimationFrame(tick)                        │
└─────────────────────────────────────────────────────┘
```

**Design decisions:**
- **Accumulator-based fixed timestep:** Ensures physics runs at exactly 60hz regardless of display refresh rate. At 120fps, onFixedUpdate runs ~every other frame. At 30fps, onFixedUpdate runs ~twice per frame.
- **Max accumulator cap (0.25s):** Prevents "spiral of death" — if the game lags badly (e.g., tab backgrounded for 10 seconds), we don't try to simulate 600 fixed steps.
- **Deferred destruction:** `node.destroy()` marks for destruction; actual removal happens at end of frame. This prevents iterator invalidation during tree traversal.
- **`step()` for testing:** Advances exactly one fixed step + one frame. No `requestAnimationFrame` involvement — fully synchronous. This is how `@quintus/headless` will drive the game loop.

**Tree traversal for update:**

```typescript
private processFixedUpdate(dt: number): void {
  const scene = this.game.currentScene;
  if (!scene) return;
  this.walkFixedUpdate(scene, dt, scene.paused);
}

private processUpdate(dt: number): void {
  const scene = this.game.currentScene;
  if (!scene) return;
  this.walkUpdate(scene, dt, scene.paused);
}

private walkFixedUpdate(node: Node, dt: number, scenePaused: boolean): void {
  if (node.isDestroyed) return;
  if (!node.shouldProcess(scenePaused)) return;
  node.onFixedUpdate(dt);
  for (const child of node.children) {
    this.walkFixedUpdate(child, dt, scenePaused);
  }
}

private walkUpdate(node: Node, dt: number, scenePaused: boolean): void {
  if (node.isDestroyed) return;
  if (!node.shouldProcess(scenePaused)) return;
  node.onUpdate(dt);
  for (const child of node.children) {
    this.walkUpdate(child, dt, scenePaused);
  }
}
```

**Design note:** `onUpdate()` and `onFixedUpdate()` are public methods (not `protected`) so the engine can call them directly without `any` casts. This matches Godot's virtual method pattern — subclasses override them, the engine calls them. TypeScript's `protected` would prevent the engine from calling lifecycle methods on arbitrary `Node` instances without type-unsafe workarounds.

### 2.7 DrawContext & Canvas2DRenderer

Abstract rendering interface (`DrawContext`) with a Canvas2D implementation. The abstraction allows future WebGL2 or headless renderers.

**File:** `packages/core/src/draw-context.ts`

```typescript
import type { Vec2, Color, Rect } from "@quintus/math";

export interface LineStyle {
  width?: number;       // Default: 1
  color?: Color;        // Default: Color.WHITE
}

export interface ShapeStyle {
  fill?: Color;         // If set, fill the shape
  stroke?: Color;       // If set, stroke the outline
  strokeWidth?: number; // Default: 1
}

export interface TextStyle {
  font?: string;        // Default: "sans-serif"
  size?: number;        // Default: 16
  color?: Color;        // Default: Color.WHITE
  align?: "left" | "center" | "right";   // Default: "left"
  baseline?: "top" | "middle" | "bottom"; // Default: "top"
}

export interface SpriteDrawOptions {
  /** Source rectangle within the texture (for sprite sheets). */
  sourceRect?: Rect;
  /** Destination size. Default: source size. */
  width?: number;
  height?: number;
  /** Flip horizontally. */
  flipH?: boolean;
  /** Flip vertically. */
  flipV?: boolean;
}

/**
 * Abstract drawing interface. All coordinates are in local space —
 * the renderer applies the node's globalTransform before calling these.
 */
export interface DrawContext {
  // === Primitives ===
  line(from: Vec2, to: Vec2, style?: LineStyle): void;
  rect(pos: Vec2, size: Vec2, style?: ShapeStyle): void;
  circle(center: Vec2, radius: number, style?: ShapeStyle): void;
  polygon(points: Vec2[], style?: ShapeStyle): void;

  // === Text ===
  text(text: string, pos: Vec2, style?: TextStyle): void;
  measureText(text: string, style?: TextStyle): Vec2;

  // === Images ===
  image(name: string, pos: Vec2, options?: SpriteDrawOptions): void;

  // === State ===
  save(): void;
  restore(): void;
  setAlpha(alpha: number): void;
}
```

**File:** `packages/core/src/canvas2d-renderer.ts`

```typescript
/**
 * Canvas2D implementation of the rendering pipeline.
 * Handles: transform cascade, z-sorting, visibility culling, draw dispatch.
 */
export class Canvas2DRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly drawContext: Canvas2DDrawContext;

  constructor(canvas: HTMLCanvasElement, game: Game);

  /** Clear the canvas and render the entire scene tree. */
  render(scene: Scene): void;
}
```

**Render algorithm:**

```typescript
// Pre-allocated render list — reused between frames to avoid GC pressure
private renderList: Node2D[] = [];
private renderListDirty = true;

// Offscreen canvas for color tinting (lazy-created)
private tintCanvas: HTMLCanvasElement | null = null;
private tintCtx: CanvasRenderingContext2D | null = null;

/** Mark render list as needing rebuild (called when nodes are added/removed, visibility or zIndex changes). */
markRenderDirty(): void {
  this.renderListDirty = true;
}

render(scene: Scene): void {
  const ctx = this.ctx;

  // 1. Clear
  ctx.clearRect(0, 0, this.game.width, this.game.height);
  if (this.game.backgroundColor) {
    ctx.fillStyle = this.game.backgroundColor;
    ctx.fillRect(0, 0, this.game.width, this.game.height);
  }

  // 2. Rebuild render list only when dirty (nodes added/removed, visibility/zIndex changed)
  if (this.renderListDirty) {
    this.renderList.length = 0;  // Clear without re-allocating
    this.collectVisible(scene, this.renderList);
    this.renderList.sort((a, b) => a.zIndex - b.zIndex);  // Stable sort preserves tree order
    this.renderListDirty = false;
  }

  // 3. Draw each node
  for (const node of this.renderList) {
    ctx.save();

    // Apply global transform
    const t = node.globalTransform;
    ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);

    // Apply tint (uses dirty-flag cached effectiveTint from Node2D)
    const tint = node.effectiveTint;
    ctx.globalAlpha = tint.a;

    // Apply color tint via offscreen canvas compositing (if not white)
    const hasTint = tint.r < 1 || tint.g < 1 || tint.b < 1;
    if (hasTint) {
      this.drawWithTint(node, tint);
    } else {
      node.onDraw(this.drawContext);
    }

    ctx.restore();
  }
}

private collectVisible(node: Node, list: Node2D[]): void {
  if (node instanceof Node2D) {
    if (!node.visible) return;  // Invisible — skip self and children
    if (node.hasVisualContent) {
      list.push(node);
    }
  }
  for (const child of node.children) {
    this.collectVisible(child, list);
  }
}
```

**Color tinting via offscreen canvas compositing:**

Canvas2D doesn't support native color tinting, but we implement it using an offscreen canvas with `globalCompositeOperation: 'source-atop'`:

```typescript
/**
 * Draw a node's content with color tinting applied.
 * Uses an offscreen canvas technique:
 * 1. Draw the node's content to a temporary canvas
 * 2. Fill the temporary canvas with the tint color using 'source-atop' compositing
 * 3. Draw the tinted result to the main canvas
 */
private drawWithTint(node: Node2D, tint: Color): void {
  // Lazy-create offscreen canvas
  if (!this.tintCanvas) {
    this.tintCanvas = document.createElement("canvas");
    this.tintCtx = this.tintCanvas.getContext("2d")!;
  }

  // Size offscreen canvas to game dimensions (reused between frames)
  const tc = this.tintCanvas;
  const tctx = this.tintCtx!;
  if (tc.width !== this.game.width || tc.height !== this.game.height) {
    tc.width = this.game.width;
    tc.height = this.game.height;
  }

  // Clear and draw node content to offscreen canvas
  tctx.clearRect(0, 0, tc.width, tc.height);
  tctx.save();
  const t = node.globalTransform;
  tctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
  node.onDraw(new Canvas2DDrawContext(tctx, this.assets));
  tctx.restore();

  // Apply tint color using source-atop compositing
  tctx.globalCompositeOperation = "source-atop";
  tctx.fillStyle = tint.toCSS();
  tctx.fillRect(0, 0, tc.width, tc.height);
  tctx.globalCompositeOperation = "source-over";

  // Draw tinted result to main canvas (reset transform first)
  this.ctx.save();
  this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  this.ctx.drawImage(tc, 0, 0);
  this.ctx.restore();
}
```

**Design notes:**
- **Pre-allocated render list:** The `renderList` array is reused between frames with `.length = 0` instead of allocating new arrays. It is only re-collected and re-sorted when `renderListDirty` is true (set when nodes are added/removed, visibility or zIndex changes).
- **`hasVisualContent` flag:** Uses the explicit opt-in boolean instead of fragile prototype comparison. Subclasses set `hasVisualContent = true` when they override `onDraw()`.
- **`effectiveTint` cache:** Uses the dirty-flag cached value from Node2D instead of walking to the tree root on every render. No per-frame tree walks for tint resolution.
- **Offscreen canvas tinting:** The tint canvas is lazy-created and reused. Only nodes with non-white tint pay the cost. This provides working color tinting in Canvas2D mode for damage flashes, death fades, and enemy color variants without waiting for a WebGL renderer.

**Canvas2DDrawContext implementation (wraps `CanvasRenderingContext2D`):**

```typescript
class Canvas2DDrawContext implements DrawContext {
  constructor(private readonly ctx: CanvasRenderingContext2D, private readonly assets: AssetLoader) {}

  line(from: Vec2, to: Vec2, style?: LineStyle): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = (style?.color ?? Color.WHITE).toCSS();
    ctx.lineWidth = style?.width ?? 1;
    ctx.stroke();
  }

  rect(pos: Vec2, size: Vec2, style?: ShapeStyle): void {
    const ctx = this.ctx;
    if (style?.fill) {
      ctx.fillStyle = style.fill.toCSS();
      ctx.fillRect(pos.x, pos.y, size.x, size.y);
    }
    if (style?.stroke) {
      ctx.strokeStyle = style.stroke.toCSS();
      ctx.lineWidth = style?.strokeWidth ?? 1;
      ctx.strokeRect(pos.x, pos.y, size.x, size.y);
    }
  }

  circle(center: Vec2, radius: number, style?: ShapeStyle): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    if (style?.fill) {
      ctx.fillStyle = style.fill.toCSS();
      ctx.fill();
    }
    if (style?.stroke) {
      ctx.strokeStyle = style.stroke.toCSS();
      ctx.lineWidth = style?.strokeWidth ?? 1;
      ctx.stroke();
    }
  }

  polygon(points: Vec2[], style?: ShapeStyle): void {
    if (points.length < 2) return;
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.closePath();
    if (style?.fill) {
      ctx.fillStyle = style.fill.toCSS();
      ctx.fill();
    }
    if (style?.stroke) {
      ctx.strokeStyle = style.stroke.toCSS();
      ctx.lineWidth = style?.strokeWidth ?? 1;
      ctx.stroke();
    }
  }

  text(text: string, pos: Vec2, style?: TextStyle): void {
    const ctx = this.ctx;
    const size = style?.size ?? 16;
    const font = style?.font ?? "sans-serif";
    ctx.font = `${size}px ${font}`;
    ctx.fillStyle = (style?.color ?? Color.WHITE).toCSS();
    ctx.textAlign = style?.align ?? "left";
    ctx.textBaseline = style?.baseline ?? "top";
    ctx.fillText(text, pos.x, pos.y);
  }

  measureText(text: string, style?: TextStyle): Vec2 {
    const ctx = this.ctx;
    const size = style?.size ?? 16;
    const font = style?.font ?? "sans-serif";
    ctx.font = `${size}px ${font}`;
    const metrics = ctx.measureText(text);
    return new Vec2(metrics.width, size);
  }

  image(name: string, pos: Vec2, options?: SpriteDrawOptions): void {
    const img = this.assets.getImage(name);
    if (!img) return;

    const ctx = this.ctx;
    const src = options?.sourceRect;
    const flipH = options?.flipH ?? false;
    const flipV = options?.flipV ?? false;
    const dw = options?.width ?? (src ? src.width : img.width);
    const dh = options?.height ?? (src ? src.height : img.height);

    ctx.save();
    if (flipH || flipV) {
      ctx.translate(flipH ? pos.x + dw : pos.x, flipV ? pos.y + dh : pos.y);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      if (flipH) pos = new Vec2(0, pos.y);
      if (flipV) pos = new Vec2(pos.x, 0);
      if (flipH && flipV) pos = Vec2.ZERO;
    }

    if (src) {
      ctx.drawImage(img, src.x, src.y, src.width, src.height, pos.x, pos.y, dw, dh);
    } else {
      ctx.drawImage(img, pos.x, pos.y, dw, dh);
    }
    ctx.restore();
  }

  save(): void { this.ctx.save(); }
  restore(): void { this.ctx.restore(); }
  setAlpha(alpha: number): void { this.ctx.globalAlpha = alpha; }
}
```

### 2.8 AssetLoader

Async resource loading with progress tracking. Phase 1 supports images and JSON. Audio loading is added in Phase 5.

**File:** `packages/core/src/asset-loader.ts`

```typescript
export interface AssetManifest {
  /** Image paths to load. */
  images?: string[];

  /** JSON paths to load. */
  json?: string[];
}

export class AssetLoader {
  /** Fires during loading with progress info. */
  readonly progress: Signal<{ loaded: number; total: number; asset: string }>;

  /** Fires when all assets are loaded (including any that failed). */
  readonly complete: Signal<void>;

  /** Fires when an individual asset fails to load. */
  readonly error: Signal<{ asset: string; error: Error }>;

  /** Load all assets in a manifest. Returns a promise that resolves when all have settled. */
  async load(manifest: AssetManifest): Promise<void>;

  /** Retry loading a specific failed asset. */
  async retry(name: string): Promise<void>;

  /** Get a loaded image by its path/name. Returns null if not loaded. */
  getImage(name: string): ImageBitmap | null;

  /** Get a loaded JSON object by its path/name. Returns null if not loaded. */
  getJSON<T = unknown>(name: string): T | null;

  /** Check if a specific asset is loaded. */
  isLoaded(name: string): boolean;

  /** Check if all assets are loaded. */
  get allLoaded(): boolean;

  /** Get list of assets that failed to load. */
  get failedAssets(): string[];
}
```

**Implementation details:**
- **Images:** Use `fetch()` + `createImageBitmap()` for off-main-thread decoding.
- **JSON:** Use `fetch()` + `.json()`.
- **Name resolution:** Assets are accessed by their filename without extension: `"hero.png"` → `getImage("hero")`. If there's ambiguity, use the full path.
- **Base URL:** Configurable, defaults to `""` (same origin).
- **Concurrent loading:** All assets load in parallel via `Promise.allSettled()`. Individual failures emit the `error` signal but do not prevent other assets from loading.
- **Error handling:** Each fetch checks `response.ok` before processing. Failed assets are tracked and can be retried.

```typescript
async load(manifest: AssetManifest): Promise<void> {
  const entries: Array<{ type: "image" | "json"; path: string }> = [];

  for (const path of manifest.images ?? []) {
    entries.push({ type: "image", path });
  }
  for (const path of manifest.json ?? []) {
    entries.push({ type: "json", path });
  }

  const total = entries.length;
  let loaded = 0;

  await Promise.allSettled(
    entries.map(async (entry) => {
      try {
        const response = await fetch(entry.path);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (entry.type === "image") {
          const blob = await response.blob();
          const bitmap = await createImageBitmap(blob);
          this.images.set(this.nameFromPath(entry.path), bitmap);
        } else {
          const data = await response.json();
          this.jsonData.set(this.nameFromPath(entry.path), data);
        }

        loaded++;
        this.progress.emit({ loaded, total, asset: entry.path });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.failed.add(entry.path);
        this.error.emit({ asset: entry.path, error });
      }
    }),
  );

  this.complete.emit();
}
```

### 2.9 Plugin System

Minimal plugin infrastructure for extending the engine. Plugins can add new node types, inject into the game lifecycle, and augment the Game class.

**File:** `packages/core/src/plugin.ts`

```typescript
export interface Plugin {
  /** Unique plugin name. */
  readonly name: string;

  /** Called when the plugin is installed via game.use(). */
  install(game: Game): void;
}

/**
 * Define a plugin. Convenience wrapper that ensures correct typing.
 */
export function definePlugin(plugin: Plugin): Plugin;
```

**Usage on Game:**

```typescript
class Game {
  private plugins = new Map<string, Plugin>();

  use(plugin: Plugin): this {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin "${plugin.name}" is already installed.`);
      return this;
    }
    this.plugins.set(plugin.name, plugin);
    plugin.install(this);
    return this;
  }

  /** Check if a plugin is installed. */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }
}
```

**Design decisions:**
- **Keep it simple in Phase 1.** The plugin API is intentionally minimal — just `install(game)`. Richer metadata (`version`, `requires`, `llm.examples`) is added in later phases when the AI-integration story solidifies.
- **Plugins are installed before `start()`.** This ensures all plugins are available during scene setup.

### 2.10 File Structure

```
packages/core/
├── src/
│   ├── index.ts                # Re-exports all public API
│   ├── signal.ts
│   ├── signal.test.ts
│   ├── node.ts
│   ├── node.test.ts
│   ├── node2d.ts
│   ├── node2d.test.ts
│   ├── scene.ts
│   ├── scene.test.ts
│   ├── game.ts
│   ├── game.test.ts
│   ├── game-loop.ts
│   ├── game-loop.test.ts
│   ├── draw-context.ts          # Interface only (no test needed)
│   ├── canvas2d-renderer.ts
│   ├── canvas2d-renderer.test.ts
│   ├── asset-loader.ts
│   ├── asset-loader.test.ts
│   ├── plugin.ts
│   └── plugin.test.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**`packages/core/src/index.ts`:**
```typescript
// Signal system
export { Signal, signal } from "./signal.js";
export type { SignalHandler, SignalConnection } from "./signal.js";

// Node tree
export { Node } from "./node.js";
export type { PauseMode, NodeConstructor, NodeProps } from "./node.js";
export { Node2D } from "./node2d.js";
export type { Node2DProps } from "./node2d.js";

// Scene
export { Scene } from "./scene.js";
export type { SceneConstructor } from "./scene.js";

// Game
export { Game } from "./game.js";
export type { GameOptions } from "./game.js";

// Game loop
export { GameLoop } from "./game-loop.js";

// Rendering
export type { DrawContext, LineStyle, ShapeStyle, TextStyle, SpriteDrawOptions } from "./draw-context.js";
export { Canvas2DRenderer } from "./canvas2d-renderer.js";

// Assets
export { AssetLoader } from "./asset-loader.js";
export type { AssetManifest } from "./asset-loader.js";

// Plugins
export { definePlugin } from "./plugin.js";
export type { Plugin } from "./plugin.js";
```

**`packages/core/package.json` dependencies:**

```json
{
  "dependencies": {
    "@quintus/math": "workspace:*"
  }
}
```

---

## 3. Cross-Cutting Concerns

### 3.1 Dependency Direction

```
@quintus/math ← @quintus/core
```

- `@quintus/math` has zero dependencies. Pure math, importable by anything.
- `@quintus/core` depends on `@quintus/math` for `Vec2`, `Matrix2D`, `Color`, `SeededRandom`.
- No circular dependencies. No dependency on DOM in `@quintus/math`.

### 3.2 Error Handling

The engine uses defensive programming with clear error messages:

```typescript
// Bad: silent failure
getChild<T>(type: NodeConstructor<T>): T | null {
  return this.children.find(c => c instanceof type) as T ?? null;
}

// Good: clear error when appropriate, null when expected
getChild<T>(type: NodeConstructor<T>): T | null {
  // Null is fine — caller may be checking for optional children
  return (this.children.find(c => c instanceof type) as T) ?? null;
}

// For methods where failure is a bug:
addChild(node: Node): this {
  if (node.parent) {
    throw new Error(
      `Cannot add "${node.name}" to "${this.name}": node already has a parent "${node.parent.name}". ` +
      `Call removeSelf() first.`
    );
  }
  if (node === this) {
    throw new Error(`Cannot add a node to itself.`);
  }
  // ...
}
```

**Principles:**
- Return `null` for queries that naturally may not find anything (`find()`, `getChild()`).
- Throw descriptive errors for programmer mistakes (adding a node that already has a parent, circular parenting).
- User lifecycle errors (`onReady()`, `onUpdate()`, `onFixedUpdate()`, `onDraw()`) are caught to keep the game loop alive — a single buggy node should not crash the entire game. Errors are surfaced via `game.onError` signal. If no `onError` handlers are connected, the error is logged with `console.error` including the node name, id, and lifecycle phase.

```typescript
// Error handling in lifecycle dispatch:
try {
  node.onUpdate(dt);
} catch (err) {
  if (this.game.onError.hasListeners) {
    this.game.onError.emit({ node, lifecycle: "onUpdate", error: err });
  } else {
    console.error(
      `Error in ${node.constructor.name}#${node.id} "${node.name}" during onUpdate():`,
      err,
    );
  }
}
```

### 3.3 Performance Considerations

**Hot paths** (called every frame for every node):
1. `globalTransform` getter — dirty-flag caching keeps this fast
2. `shouldProcess()` — quick boolean check
3. `onDraw()` dispatch — virtual method call

**Object allocation strategy:**
- `Vec2` is mutable, which allows direct field mutation without allocation. Engine-internal hot paths use `Vec2Pool` (see §1.1) to avoid allocating temporary instances. This is critical for Phase 2's physics resolution (`move()`) which creates many temporaries per body per frame.
- The render list is pre-allocated and reused between frames. It is only re-collected and re-sorted when `renderListDirty` is set (nodes added/removed, visibility or zIndex changed).

**Key optimizations included in Phase 1:**
- Dirty-flag transform cascade (described in §2.3)
- Proxy-based Vec2 mutation detection for automatic dirty-flagging (described in §2.3)
- Dirty-flag tint cascade (described in §2.3) — avoids per-frame tree walks for color resolution
- Early exit on invisible nodes (skip entire subtree)
- `hasVisualContent` flag avoids adding logic-only nodes to render list
- Stable sort for z-ordering preserves tree insertion order for same-zIndex nodes
- Pre-allocated render list with dirty-flag invalidation
- Signal emission uses O(n) dirty-flag pattern instead of O(n²) `includes()` check
- `Vec2Pool` for engine-internal hot paths to reduce GC pressure

---

## 4. Test Plan

All tests use Vitest. Tests live alongside source files.

### 4.1 `@quintus/math` Tests

**`vec2.test.ts`** (~40 tests):
- Construction: `new Vec2(3, 4)`, `Vec2.ZERO`, `Vec2.ONE`, `Vec2.from({x, y})`
- Arithmetic: `add`, `sub`, `mul`, `div`, `scale`, `negate` with various inputs
- Geometry: `dot`, `cross`, `length`, `lengthSquared`, `normalize` (including zero vector)
- Distance: `distanceTo`, `distanceSquaredTo`
- Rotation: `angle`, `angleTo`, `rotate` (90deg, 180deg, arbitrary)
- Interpolation: `lerp` at t=0, t=1, t=0.5, out-of-range
- Comparison: `equals`, `approxEquals` with epsilon edge cases
- Utility: `abs`, `floor`, `ceil`, `round`, `clamp`, `toArray`, `toString`
- Mutability: verify that `x` and `y` can be assigned directly
- Static factories: `fromAngle` produces correct unit vectors

**`matrix2d.test.ts`** (~30 tests):
- Identity: `Matrix2D.IDENTITY` transforms points unchanged
- Translate: `Matrix2D.translate(x, y)` offsets points correctly
- Rotate: 90deg, 180deg, 270deg, arbitrary angles
- Scale: uniform and non-uniform
- Compose: `Matrix2D.compose(pos, rot, scale)` matches sequential T×R×S
- Multiply: `A.multiply(B)` matches manual computation
- Transform point: various transforms applied to points
- Inverse: `M.multiply(M.inverse())` equals identity
- Decompose: round-trips through `compose` → `decompose` → `compose`
- Canvas2D compat: values map correctly to `setTransform(a, b, c, d, e, f)`

**`rect.test.ts`** (~20 tests):
- Construction, computed properties (left, right, top, bottom, center)
- Contains point (inside, edge, outside)
- Intersects rect (overlapping, touching, disjoint)
- Intersection (overlap area, null on disjoint)
- Union of two rects
- Expand and expandToInclude
- Static factories: `fromCenter`, `fromPoints`, `fromMinMax`

**`aabb.test.ts`** (~15 tests):
- Contains point, overlaps AABB, containsAABB
- Merge two AABBs
- Convert to/from Rect
- fromPoints with various point sets

**`color.test.ts`** (~20 tests):
- Named constants (RED, GREEN, BLUE, WHITE, BLACK, TRANSPARENT)
- `fromHex`: 3-char, 6-char, 8-char hex strings
- `fromHSL`: primary colors, edge cases
- `fromBytes`: 0-255 range
- `toHex`, `toCSS` output format
- `lerp` between colors at various t values
- `multiply` for tinting
- `withAlpha`
- Immutability

**`vec2-pool.test.ts`** (~10 tests):
- `get()` returns mutable `{x, y}` with correct values
- `begin()`/`end()` resets cursor — temporaries are reused
- `toVec2()` converts to a `Vec2`
- Pool wraps around gracefully (or warns in debug mode) when exhausted
- Multiple `begin()`/`end()` scopes work correctly
- Pool avoids allocation in hot paths as intended

**`seeded-random.test.ts`** (~25 tests):
- **Determinism**: Same seed → same sequence (run 100 values, compare)
- **Different seeds**: Different seeds → different sequences
- `int`: Range correctness (min/max inclusive), distribution sanity check
- `float`: Range correctness
- `bool`: Respects probability parameter
- `pick`: Returns elements from array
- `shuffle`: Returns permutation of input, doesn't mutate input
- **Fork**: Forked RNG produces different sequence than parent
- **Fork isolation**: Consuming values from one fork doesn't affect another
- **Fork determinism**: Same seed + same fork labels → same child sequences
- `angle`, `direction`, `inCircle`, `inRect`: Range correctness
- `seed` property returns original constructor seed
- `state` property returns current mutable state
- `SeededRandom.fromState()` restores sequence correctly

**`utils.test.ts`** (~15 tests):
- `clamp`: within range, below min, above max
- `lerp`: at 0, 0.5, 1, extrapolation
- `inverseLerp` and `remap`: basic cases
- `wrap`: positive, negative, and edge values
- `approxEqual`: within epsilon, outside epsilon, exact match
- `snap`: various step sizes
- Constants: `DEG2RAD * 180 === PI`, `RAD2DEG * PI === 180`

### 4.2 `@quintus/core` Tests

**`signal.test.ts`** (~30 tests):
- `connect` + `emit`: handler receives payload
- Multiple handlers: all fire in connection order
- `disconnect`: specific handler removed, others remain
- `disconnectAll`: all handlers removed
- `once`: fires exactly once, then auto-disconnects
- Typed payloads: complex objects pass through correctly
- `void` signals: `emit()` with no args
- `listenerCount`, `hasListeners`: accurate counts
- **Emission safety**: connect during emit — new handler is not called in current emission
- **Emission safety**: disconnect during emit — disconnected handler is skipped (O(1) check)
- **Emission safety**: disconnect during emit with no disconnections — no overhead (dirty flag fast path)
- Disconnect a handler that was already disconnected (no error)
- Signal on destroyed node: handlers are cleaned up

**`node.test.ts`** (~50 tests):
- **Tree manipulation:**
  - `addChild` adds to children array, sets parent
  - `addChild(Class, props)` constructs and applies only whitelisted properties
  - `addChild(Class, props)` does NOT assign internal state (isReady, parent, etc.)
  - `addChild(Class, ...args)` passes constructor arguments
  - `removeChild` removes from children, clears parent
  - `removeSelf` calls parent.removeChild
  - Cannot add node to itself (throws)
  - Cannot add node that already has a parent (throws)
  - Adding multiple children preserves order
- **Lifecycle ordering:**
  - `onReady()` called after node enters tree
  - `onReady()` called bottom-up (children before parents)
  - `onReady()` called only once, even if reparented
  - `onEnterTree()` called every time node enters a tree
  - `onExitTree()` called every time node exits a tree
  - `onEnterTree()` fires on reparenting (removed from A, added to B)
  - `isReady`, `isInsideTree` flags set correctly
  - `onDestroy()` called when node is destroyed
  - Children destroyed when parent destroyed
- **Destruction ordering:**
  - `treeExited` fires BEFORE `disconnectAll()` during destruction
  - `treeExited` handlers receive the signal during destruction
  - `onExitTree()` called during destruction
  - `destroying` signal fires before `onDestroy()` callback
- **Tags:**
  - `tag()`, `hasTag()`, `untag()`
  - `findAll(tag)` returns correct nodes
  - Multiple tags on one node
- **Queries:**
  - `find(name)` searches depth-first
  - `getChild(Type)` returns first matching child
  - `getChildren(Type)` returns all matching children
  - `findByType(Type)` recursive search
  - `findAllByType(Type)` recursive search
- **Pause mode:**
  - 'inherit' follows parent, stops when scene is paused
  - 'independent' always updates regardless of pause state
- **Signals:**
  - `treeEntered` fires when added to tree
  - `treeExited` fires when removed
  - `ready` signal fires after onReady()
  - `destroying` fires before onDestroy()
- **Deferred destruction:**
  - `destroy()` marks but doesn't immediately remove
  - `isDestroyed` flag set immediately
  - Actual removal happens in cleanup phase

**`node2d.test.ts`** (~35 tests):
- **Local transform:**
  - Position, rotation, scale getters/setters
  - `localTransform` matches `Matrix2D.compose(pos, rot, scale)`
- **Mutable Vec2 with Proxy dirty-flagging:**
  - `position.x += 5` marks transform dirty
  - `position.y = 10` marks transform dirty
  - Full replacement `position = new Vec2(...)` marks transform dirty
  - Setting same value does not dirty
- **Global transform cascade:**
  - Child inherits parent transform
  - Moving parent updates child globalPosition
  - Rotating parent rotates child around parent
  - Scaling parent scales child
  - Nested transforms (grandchild)
- **Dirty flag behavior:**
  - Setting position (via field or full replacement) marks transform dirty
  - Querying globalTransform recomputes only when dirty
  - Dirtying parent dirties all descendants
- **Global position setter:**
  - Setting globalPosition computes correct local position
- **Coordinate conversion:**
  - `toLocal(worldPoint)` inverts transform correctly
  - `toGlobal(localPoint)` applies transform correctly
- **Visibility:**
  - `visible = false` on parent hides children
- **Tint (dirty-flag cached):**
  - Default is Color.WHITE (no tint)
  - `effectiveTint` inherits parent tint
  - Changing parent tint dirties child effectiveTint
  - `selfTint` only affects self, not children
  - Nested tint multiplication is correct
  - Tint cache is not recomputed when not dirty
- **hasVisualContent:**
  - Default is false
  - Subclass with `hasVisualContent = true` is collected by renderer

**`scene.test.ts`** (~15 tests):
- `add(NodeClass, props)` creates and adds node with typed props
- `add(NodeClass, ...args)` creates with constructor arguments
- `findAll(tag)` searches entire tree
- `findAllByType(Type)` searches entire tree
- `get(Type)` returns first node of type in tree
- `getAll(Type)` returns all nodes of type in tree
- `count(tag)` returns correct count
- `switchTo(SceneClass)` destroys current scene and loads new one
- `paused` flag prevents update of 'inherit' nodes
- Scene subclass onReady() is called and can add nodes

**`game.test.ts`** (~25 tests):
- Constructor creates canvas with correct dimensions
- `scene()` registers named scene classes
- `start()` loads and runs a scene (by name or class)
- `step()` advances one fixed timestep (for testing)
- `step(variableDt)` passes different dt to onUpdate vs onFixedUpdate
- `pause()` / `resume()` control the loop
- `random` is a SeededRandom instance
- `use(plugin)` installs plugins, calls `install(game)`
- `hasPlugin()` returns correct value
- Double-install warns but doesn't crash
- Signals: `started`, `stopped`, `sceneSwitched` fire at correct times
- `onError` signal fires when user lifecycle method throws
- `onError` not connected: errors logged to console.error
- `pixelArt: true` disables image smoothing on canvas

**`game-loop.test.ts`** (~18 tests):
- `step()` calls fixedUpdate + update + render + cleanup in order
- `step()` passes fixedDeltaTime to both fixedUpdate and update by default
- `step(variableDt)` passes variableDt to update, fixedDeltaTime to fixedUpdate
- Multiple `step()` calls accumulate elapsed time correctly
- `fixedFrame` increments on each fixed step
- `start()` / `stop()` toggle the loop
- Accumulator: at 30fps, fixedUpdate runs ~2x per frame
- Max accumulator prevents spiral of death
- Callbacks receive correct dt values

**`canvas2d-renderer.test.ts`** (~15 tests):
- Nodes with `visible = false` are not drawn
- z-ordering: higher zIndex renders after lower
- Same zIndex: tree order preserved (stable sort)
- Transform is applied before onDraw()
- Invisible parent skips entire subtree
- `hasVisualContent = false` nodes are not in render list
- `hasVisualContent = true` nodes are in render list
- Render list is reused between frames (not re-allocated)
- Render list is re-sorted when `renderListDirty` is set
- Color tinting via offscreen canvas compositing

**`asset-loader.test.ts`** (~15 tests):
- Load images (mock fetch + createImageBitmap)
- Load JSON
- `progress` signal fires with correct counts
- `complete` signal fires after all settled (including failures)
- `error` signal fires per failed asset with asset path and Error
- Failed fetch (404) emits error, does not reject the load promise
- `getImage()` returns loaded image, null for unknown
- `getJSON()` returns parsed data
- `isLoaded()` correctness
- `failedAssets` lists failed paths
- `retry()` re-attempts a failed asset

**`plugin.test.ts`** (~5 tests):
- `definePlugin` returns the plugin object
- `game.use(plugin)` calls `install(game)`
- `hasPlugin` returns true after install
- Double install logs warning
- Plugin install receives game instance

### 4.3 Test Environment Notes

- **Math tests:** `environment: "node"` (no DOM needed). Use `// @vitest-environment node` directive at the top of each math test file.
- **Core tests:** `environment: "jsdom"` (needs `HTMLCanvasElement`, `document`).
- **Canvas2D context:** jsdom's `getContext('2d')` returns `null` by default. Add the `canvas` npm package (`pnpm add -D canvas --filter @quintus/core`) which provides a real `CanvasRenderingContext2D` in Node.js. This is needed for both `Canvas2DRenderer` and `Game` constructor tests.
- **`createImageBitmap`:** Does not exist in jsdom. Add a vitest setup file (`packages/core/src/test-setup.ts`) that stubs `globalThis.createImageBitmap` for `AssetLoader` tests.
- **`performance.now()`:** Available in Node.js but may behave differently in jsdom. The `GameLoop` tests that use `step()` don't need `requestAnimationFrame` (synchronous), so this is not a concern for testing.
- **Recommendation:** Verify Canvas2D draw call sequences via spies in Phase 1. Add pixel-level tests in Phase 7 with `@quintus/snapshot`.

---

## 5. Demo: Bouncing Ball

The Phase 1 demo — a minimal working game that proves the core engine works.

**File:** `examples/main.ts`

```typescript
import { Game, Node2D, Scene } from "@quintus/core";
import { Vec2, Color } from "@quintus/math";
import type { DrawContext } from "@quintus/core";

class Ball extends Node2D {
  override hasVisualContent = true;
  velocity = new Vec2(200, 150);
  radius = 10;
  color = Color.RED;

  onFixedUpdate(dt: number): void {
    // Move (direct mutation — no allocation)
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Bounce off walls
    const game = this.scene?.game;
    if (!game) return;
    if (this.position.x - this.radius < 0 || this.position.x + this.radius > game.width) {
      this.velocity.x = -this.velocity.x;
      // Clamp inside bounds
      this.position.x = Math.max(this.radius, Math.min(game.width - this.radius, this.position.x));
    }
    if (this.position.y - this.radius < 0 || this.position.y + this.radius > game.height) {
      this.velocity.y = -this.velocity.y;
      this.position.y = Math.max(this.radius, Math.min(game.height - this.radius, this.position.y));
    }
  }

  onDraw(ctx: DrawContext): void {
    ctx.circle(Vec2.ZERO, this.radius, { fill: this.color });
  }
}

class FPSDisplay extends Node2D {
  override hasVisualContent = true;
  private frames = 0;
  private timer = 0;
  private fps = 0;

  onUpdate(dt: number): void {
    this.frames++;
    this.timer += dt;
    if (this.timer >= 1) {
      this.fps = this.frames;
      this.frames = 0;
      this.timer -= 1;
    }
  }

  onDraw(ctx: DrawContext): void {
    ctx.text(`FPS: ${this.fps}`, Vec2.ZERO, {
      size: 14,
      color: Color.WHITE,
    });
  }
}

class MainScene extends Scene {
  onReady(): void {
    const game = this.game;

    // Spawn multiple balls with random velocities
    for (let i = 0; i < 20; i++) {
      const ball = this.add(Ball, {
        position: new Vec2(
          game.random.float(50, 750),
          game.random.float(50, 550),
        ),
      });
      ball.velocity = game.random.direction().scale(game.random.float(100, 300));
      ball.radius = game.random.float(5, 15);
      ball.color = game.random.color();
    }

    // FPS counter in corner
    this.add(FPSDisplay, { position: new Vec2(10, 10) });
  }
}

// Create game
const game = new Game({
  width: 800,
  height: 600,
  canvas: "game",
  backgroundColor: "#1a1a2e",
  seed: 42,
});

// Start with class-based scene
game.start(MainScene);
```

**What this demo validates:**
1. Game creates a canvas and starts the loop
2. Node2D transform works (position updates each frame via direct mutation)
3. `onFixedUpdate()` runs at consistent timing
4. `onDraw()` is called by the renderer
5. `DrawContext.circle()` and `DrawContext.text()` work
6. `SeededRandom` produces consistent results (seed: 42)
7. Class-based scene with `onReady()` adds nodes correctly
8. Multiple nodes update and render independently
9. Game loop maintains stable frame rate

---

## 6. Definition of Done

Phase 1 is complete when **all** of the following are true:

### Math Package
- [ ] `Vec2` — all operations tested, mutable fields verified
- [ ] `Vec2Pool` — begin/end scope, get/toVec2, cursor reset, capacity handling
- [ ] `Matrix2D` — compose/decompose round-trips, transform points, inverse
- [ ] `Rect` — contains, intersects, intersection, union
- [ ] `AABB` — overlaps, merge, convert to/from Rect
- [ ] `Color` — named constants, hex/HSL/bytes conversion, lerp, multiply
- [ ] `SeededRandom` — determinism (100 runs same seed = same sequence), fork isolation, `seed`/`state`/`fromState`
- [ ] Math utils — clamp, lerp, remap, wrap, approxEqual, snap
- [ ] Test coverage >95% on `@quintus/math`
- [ ] Package builds to valid ESM/CJS under 3KB gzipped (public API); internal entry point separate

### Core Package
- [ ] `Signal<T>` — connect, emit (O(n) dirty-flag), disconnect, once, disconnectAll, emission safety
- [ ] `Node` — tree manipulation, lifecycle (onReady/onEnterTree/onExitTree/onUpdate/onFixedUpdate/onDestroy), tags, queries, pauseMode
- [ ] `Node2D` — transform cascade with dirty flags (Proxy-based Vec2 mutation detection), tint cascade with dirty flags, globalTransform, visibility, hasVisualContent
- [ ] `Scene` — class-based, add (typed props), findAll, get/getAll, switchTo, pause
- [ ] `Game` — constructor, scene management (class-based), start/pause/resume/stop/step(variableDt?), plugins, onError signal
- [ ] `GameLoop` — fixed timestep accumulator, variable render, spiral-of-death prevention, step(variableDt?)
- [ ] `Canvas2DRenderer` — clear, z-sort (cached render list), transform application, visibility culling, draw dispatch, offscreen canvas tinting
- [ ] `DrawContext` — line, rect, circle, polygon, text, image
- [ ] `AssetLoader` — load images/JSON, progress/complete/error signals, getImage/getJSON, failedAssets, retry
- [ ] `Plugin` — definePlugin, game.use, install callback
- [ ] Test coverage >90% on `@quintus/core`
- [ ] Package builds to valid ESM/CJS under 10KB gzipped

### Integration
- [ ] Bouncing ball demo runs in browser via `pnpm dev`
- [ ] 20 balls bounce with random colors and speeds (seed: 42)
- [ ] FPS counter displays in corner
- [ ] Game loop maintains 60fps on modern hardware
- [ ] `pnpm build` compiles both packages with no errors
- [ ] `pnpm test` — all tests pass
- [ ] `pnpm lint` — no errors
- [ ] Combined gzipped size of `@quintus/math` + `@quintus/core` < 15KB

---

## 7. Execution Order

Recommended order for implementing Phase 1:

### Week 1: Math + Core Foundations

1. **`@quintus/math` — all classes and tests**
   - Start with `Vec2` (everything depends on it)
   - Then `Vec2Pool` (engine-internal, `internal.ts` entry point)
   - Then `Matrix2D` (needed for transforms)
   - Then `Color`, `Rect`, `AABB`
   - Then `SeededRandom` (with `seed`, `state`, `fromState()`)
   - Then `utils.ts`
   - Write tests alongside each class

2. **`@quintus/core` — Signal system**
   - `signal.ts` + `signal.test.ts`
   - O(n) emission with dirty flag (not O(n²) `includes()` check)
   - This is standalone (no deps beyond math)

3. **`@quintus/core` — Node base class**
   - `node.ts` + `node.test.ts`
   - Tree manipulation, lifecycle (onReady/onEnterTree/onExitTree/onDestroy), tags, queries
   - Typed props (`NodeProps`) — no `Object.assign` with `Partial<T>`
   - `NodeConstructor` supports constructor arguments
   - Destruction lifecycle: `treeExited` before `disconnectAll()`
   - Uses Signal for built-in events

4. **`@quintus/core` — Node2D**
   - `node2d.ts` + `node2d.test.ts`
   - Transform cascade with dirty flags (Proxy-based Vec2 mutation detection)
   - Tint cascade with dirty flags (`effectiveTint`)
   - `hasVisualContent` flag (replaces prototype comparison)
   - `Node2DProps` typed props interface
   - Depends on Vec2, Matrix2D, Color, Node

### Week 2: Game Loop + Rendering + Integration

5. **`@quintus/core` — Scene**
   - `scene.ts` + `scene.test.ts`
   - Class-based scenes (extends Scene, setup in onReady)
   - Typed `add()` overloads (NodeProps, constructor args)
   - `get<T>()` and `getAll<T>()` convenience queries
   - No `callGroup` — use `findAllByType()` instead

6. **`@quintus/core` — GameLoop**
   - `game-loop.ts` + `game-loop.test.ts`
   - Fixed timestep accumulator, step(variableDt?), start/stop

7. **`@quintus/core` — DrawContext + Canvas2DRenderer**
   - `draw-context.ts` (interface)
   - `canvas2d-renderer.ts` + `canvas2d-renderer.test.ts`
   - Pre-allocated render list with dirty-flag invalidation
   - `hasVisualContent` check for render list inclusion
   - Offscreen canvas color tinting via `source-atop` compositing
   - Uses cached `effectiveTint` from Node2D

8. **`@quintus/core` — AssetLoader**
   - `asset-loader.ts` + `asset-loader.test.ts`
   - Image/JSON loading with progress/complete/error signals
   - `Promise.allSettled()`, `response.ok` check, per-asset error handling
   - `failedAssets`, `retry()` for recovery

9. **`@quintus/core` — Game + Plugin**
   - `game.ts` + `game.test.ts`
   - `plugin.ts` + `plugin.test.ts`
   - `onError` signal for user lifecycle error handling
   - `step(variableDt?)` for headless testing
   - Ties everything together

10. **Integration: Bouncing Ball Demo**
    - Update `examples/main.ts` with the bouncing ball demo
    - Verify `hasVisualContent = true` on drawable nodes
    - Verify in browser
    - Run all tests, verify coverage, verify bundle sizes

11. **Polish**
    - Ensure all exports are correct in `index.ts` and `internal.ts` files
    - Verify `pnpm build && pnpm test && pnpm lint` all pass
    - Check bundle sizes with `gzip -c dist/index.js | wc -c`
    - Update examples `index.html` if needed
    - Add `canvas` npm package as devDependency for core tests
