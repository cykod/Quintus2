# Particle Systems — Detailed Design

> **Goal:** Ship `@quintus/particles` with a high-performance, deterministic particle emitter that works in both Canvas2D and Three.js rendering modes, and is trivially configurable by LLMs via a declarative preset/recipe system.
> **Outcome:** A `ParticleEmitter` node (2D) and `ParticleEmitter3D` node (3D) that can express fire, rain, sparks, blood spatter, explosions, smoke, and more. All particle behavior is driven by typed configuration objects with semantic property names. A library of built-in presets ships as starting points. Headless/deterministic simulation works out of the box. 95%+ test coverage.

---

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Core particle simulation (CPU) | Done |
| 2 | Canvas2D rendering | Done |
| 3 | Emitter node & game integration | Done |
| 4 | Property curves & color gradients | Done |
| 5 | Preset library & LLM-friendly API | Done |
| 6 | Three.js 3D particles | Done |
| 7 | Tests & demo | Pending |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1: Core Particle Simulation](#2-phase-1-core-particle-simulation)
3. [Phase 2: Canvas2D Rendering](#3-phase-2-canvas2d-rendering)
4. [Phase 3: Emitter Node & Game Integration](#4-phase-3-emitter-node--game-integration)
5. [Phase 4: Property Curves & Color Gradients](#5-phase-4-property-curves--color-gradients)
6. [Phase 5: Preset Library & LLM-Friendly API](#6-phase-5-preset-library--llm-friendly-api)
7. [Phase 6: Three.js 3D Particles](#7-phase-6-threejs-3d-particles)
8. [Phase 7: Tests & Demo](#8-phase-7-tests--demo)
9. [Cross-Cutting Concerns](#9-cross-cutting-concerns)
10. [Definition of Done](#10-definition-of-done)

---

## 1. Architecture Overview

### Design Philosophy

Particle systems are a classic performance bottleneck. The key insight: **individual particles are NOT nodes in the scene tree.** A `ParticleEmitter` is a single Node2D (or Node3D) that internally manages a flat, struct-of-arrays (SoA) particle pool. This avoids:

- Node creation/destruction overhead (no `onEnterTree`/`onExitTree` per particle)
- Scene tree traversal cost (1 node, not 500)
- Transform cascade computation (particles use world-space positions directly)

```
Scene Tree                     Internal (not in tree)
─────────                      ──────────────────────
ParticleEmitter (Node2D)  ──→  ParticlePool (SoA arrays)
  └── onDraw() renders         ├── x[]  y[]  vx[]  vy[]
      all particles in         ├── life[]  age[]  size[]
      a single batch           ├── r[]  g[]  b[]  a[]
                               └── rotation[]  angularVel[]
```

### LLM-Friendly Configuration

The API is designed so that an LLM can:
1. **Read a config and predict what it looks like** — every property has a clear physical meaning
2. **Modify configs confidently** — ranges use `[min, max]` tuples, not magic numbers
3. **Start from presets** — `fire()`, `rain()`, `sparks()` etc. return complete configs
4. **Override selectively** — spread a preset and tweak specific fields

```typescript
// An LLM can read this and know exactly what it produces:
const config: ParticleConfig = {
  // Emission
  maxParticles: 200,
  emissionRate: 50,              // particles per second
  emissionShape: "circle",       // spawn area shape
  emissionRadius: 10,            // spawn area size

  // Motion
  initialSpeed: [80, 120],       // random range
  initialAngle: [-90, -90],      // degrees, straight up (negative = up in screen coords)
  gravityY: 100,                   // pixels/sec² (positive = down in screen coords)
  drag: 0.02,                    // exponential velocity damping coefficient

  // Appearance
  shape: "circle",               // "circle" | "rect" | "texture"
  size: [3, 6],                  // random range (pixels)
  sizeOverLife: [1, 0],          // scale multiplier: born at 1×, dies at 0×
  colorStart: "#ff6600",         // orange
  colorEnd: "#ff000000",         // red, fading to transparent
  blendMode: "additive",         // "normal" | "additive"

  // Lifetime
  lifetime: [0.5, 1.5],         // seconds, random range
};
```

Every property name is self-documenting. Ranges are always `[min, max]` tuples. Angles are in degrees (not radians) because LLMs and humans think in degrees. Colors accept hex strings (coerced via `Color.fromHex()`).

---

## 2. Phase 1: Core Particle Simulation

### Particle Pool (Struct of Arrays)

**File:** `packages/particles/src/particle-pool.ts`

The pool uses parallel typed arrays for cache-friendly iteration. No objects allocated per particle.

```typescript
export class ParticlePool {
  readonly capacity: number;

  // Position & velocity
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;

  // Lifecycle
  readonly life: Float32Array;      // total lifetime (seconds)
  readonly age: Float32Array;       // current age (seconds)

  // Appearance
  readonly size: Float32Array;      // base size (pixels or units)
  readonly rotation: Float32Array;
  readonly angularVelocity: Float32Array;

  // Color (0-1 range)
  readonly r: Float32Array;
  readonly g: Float32Array;
  readonly b: Float32Array;
  readonly a: Float32Array;

  // Color end (for lerping over lifetime)
  readonly rEnd: Float32Array;
  readonly gEnd: Float32Array;
  readonly bEnd: Float32Array;
  readonly aEnd: Float32Array;

  // Size curve
  readonly sizeStart: Float32Array;
  readonly sizeEnd: Float32Array;

  // Bookkeeping
  alive: number;                    // count of active particles

  constructor(capacity: number);
  spawn(index: number): void;       // initialize slot
  kill(index: number): void;        // swap-remove with last alive
  reset(): void;                    // kill all
}
```

- [x] Implement `ParticlePool` with typed arrays
- [x] `spawn()` initializes a slot at `alive` index, increments `alive`
- [x] `kill()` swap-removes dead particle with last alive particle, decrements `alive`
- [x] `reset()` sets `alive = 0`
- [x] Unit tests for spawn/kill/swap-remove correctness

**Why SoA over AoS?** Updating all particle positions is a tight loop over `x[]`, `y[]`, `vx[]`, `vy[]`. SoA keeps each property contiguous in memory, maximizing L1 cache hits. A 500-particle update touches ~8KB of contiguous data vs scattered 64-byte objects.

### Particle Simulator

**File:** `packages/particles/src/particle-simulator.ts`

Pure simulation logic, separated from rendering and scene tree concerns. This enables headless testing.

```typescript
export class ParticleSimulator {
  readonly pool: ParticlePool;
  private _emissionAccumulator = 0;

  constructor(capacity: number);

  /** Emit new particles based on config and dt */
  emit(config: ParticleConfig, dt: number, emitterX: number, emitterY: number, rng: SeededRandom): void;

  /** Emit a fixed number of particles immediately (burst mode) */
  burst(config: ParticleConfig, count: number, emitterX: number, emitterY: number, rng: SeededRandom): void;

  /**
   * Update all alive particles: motion, aging, death.
   * emitterDX/DY are the emitter's frame-to-frame position delta,
   * used to offset particles when simulationSpace is "local".
   */
  update(config: ParticleConfig, dt: number, rng: SeededRandom, emitterDX?: number, emitterDY?: number): void;
}
```

**`update()` loop (hot path):**

```typescript
update(config: ParticleConfig, dt: number, rng: SeededRandom, emitterDX = 0, emitterDY = 0): void {
  const { x, y, vx, vy, age, life, rotation, angularVelocity, alive } = this.pool;
  const gx = config.gravityX ?? 0;
  const gy = config.gravityY ?? 0;
  // Frame-rate-independent exponential decay: same result regardless of dt
  const dragFactor = Math.exp(-(config.drag ?? 0) * dt);
  const turbulence = config.turbulence ?? 0;
  const isLocal = config.simulationSpace === "local";

  let i = 0;
  while (i < this.pool.alive) {
    age[i] += dt;
    if (age[i] >= life[i]) {
      this.pool.kill(i);  // swap-remove, don't increment i
      continue;
    }
    // Local space: offset particles by emitter movement delta
    if (isLocal) {
      x[i] += emitterDX;
      y[i] += emitterDY;
    }
    // Velocity integration (exponential drag for determinism across timesteps)
    vx[i] = vx[i] * dragFactor + gx * dt;
    vy[i] = vy[i] * dragFactor + gy * dt;
    // Turbulence (random jitter, requires RNG for determinism)
    if (turbulence > 0) {
      vx[i] += rng.float(-turbulence, turbulence) * dt;
      vy[i] += rng.float(-turbulence, turbulence) * dt;
    }
    // Position integration
    x[i] += vx[i] * dt;
    y[i] += vy[i] * dt;
    // Rotation
    rotation[i] += angularVelocity[i] * dt;
    i++;
  }
}
```

- [x] Implement `ParticleSimulator` with `emit()`, `burst()`, `update()`
- [x] Emission rate accumulator (fractional particle carryover between frames)
- [x] Cap emissions per frame to `maxParticles * 0.25` to prevent spawn storms after lag spikes
- [x] Reset emission accumulator when config reference changes (detect via identity check)
- [x] Emission shape spawning: point, circle, rect, line, ring
- [x] Initial velocity from angle range + speed range
- [x] Gravity, drag integration (exponential decay: `Math.exp(-drag * dt)`)
- [x] Turbulence via RNG in update loop (requires `rng` parameter)
- [x] Local-space simulation via emitter position delta
- [x] Particle death via age >= life, swap-remove
- [x] Unit tests for each emission shape
- [x] Unit tests for gravity, drag (verify frame-rate independence), lifetime, turbulence

### ParticleConfig Type

**File:** `packages/particles/src/particle-config.ts`

```typescript
/** Range type: either a fixed value or [min, max] for random sampling */
export type Range = number | [min: number, max: number];

/** Emission area shape */
export type EmissionShape = "point" | "circle" | "rect" | "line" | "ring";

/** Particle render shape */
export type ParticleShape = "circle" | "rect" | "texture" | "triangle";

/** Blend mode */
export type BlendMode = "normal" | "additive";

export interface ParticleConfig {
  // --- Emission ---
  /** Maximum simultaneous particles. Default: 100 */
  maxParticles?: number;
  /** Particles emitted per second (continuous mode). Default: 10 */
  emissionRate?: number;
  /** Shape of the emission area. Default: "point" */
  emissionShape?: EmissionShape;
  /** Radius for "circle" and "ring" emission shapes. Default: 0 */
  emissionRadius?: number;
  /** Width for "rect" emission shape. Default: 0 */
  emissionWidth?: number;
  /** Height for "rect" emission shape. Default: 0 */
  emissionHeight?: number;
  /** Length for "line" emission shape. Default: 0 */
  emissionLength?: number;
  /** Angle of "line" emission shape in degrees. Default: 0 */
  emissionLineAngle?: number;

  // --- Motion ---
  /** Initial speed in pixels/sec (or units/sec for 3D). Default: 100 */
  initialSpeed?: Range;
  /**
   * Direction of emission in degrees.
   * 0 = right, 90 = down, -90 = up, 180 = left.
   * A range like [-100, -80] creates a spread.
   * Default: [-90, -90] (straight up)
   */
  initialAngle?: Range;
  /** Gravity X acceleration in pixels/sec². Default: 0 */
  gravityX?: number;
  /** Gravity Y acceleration in pixels/sec². Default: 0 */
  gravityY?: number;
  /**
   * Exponential velocity damping coefficient (0 = none, higher = faster decay).
   * Applied as Math.exp(-drag * dt) for frame-rate-independent behavior.
   * Default: 0
   */
  drag?: number;
  /**
   * Random velocity jitter added each frame (pixels/sec²).
   * Applied via RNG in update() for deterministic results.
   * Default: 0
   */
  turbulence?: number;

  // --- Appearance ---
  /** Render shape. Default: "circle" */
  shape?: ParticleShape;
  /** Particle size in pixels. Default: 4 */
  size?: Range;
  /** Size multiplier over lifetime: [startScale, endScale]. Default: [1, 1] */
  sizeOverLife?: [start: number, end: number];
  /** Start color (hex string or Color). Default: "#ffffff" */
  colorStart?: string | Color;
  /** End color (hex string or Color). Lerped over lifetime. Default: same as colorStart */
  colorEnd?: string | Color;
  /** Blend mode. Default: "normal" */
  blendMode?: BlendMode;
  /** Texture asset name (when shape is "texture"). Default: undefined */
  texture?: string;

  // --- Rotation ---
  /** Initial rotation in degrees. Default: 0 */
  initialRotation?: Range;
  /** Angular velocity in degrees/sec. Default: 0 */
  angularVelocity?: Range;

  // --- Lifetime ---
  /** Particle lifetime in seconds. Default: 1 */
  lifetime?: Range;

  // --- Advanced ---
  /** Whether to simulate in local space (moves with emitter) or world space. Default: "world" */
  simulationSpace?: "local" | "world";
  /** Custom property curves (Phase 4). */
  curves?: PropertyCurves;
}
```

- [x] Define `ParticleConfig` interface with all properties
- [x] Define `Range` type and `resolveRange(range: Range, rng: SeededRandom): number` utility
- [x] Define `EmissionShape`, `ParticleShape`, `BlendMode` types
- [x] `applyDefaults(config: Partial<ParticleConfig>): Required<ParticleConfig>` with sensible defaults
- [x] Color coercion: accept hex strings, convert to Color internally
- [x] Angle conversion: accept degrees, convert to radians internally

---

## 3. Phase 2: Canvas2D Rendering

**File:** `packages/particles/src/particle-renderer-2d.ts`

Batch-render all alive particles in a single `onDraw()` call. No per-particle `save()/restore()` — use direct `fillRect()` / `arc()` calls with manual transforms.

```typescript
export class ParticleRenderer2D {
  /** Render all alive particles to the Canvas2D context */
  render(
    pool: ParticlePool,
    config: ResolvedParticleConfig,
    ctx: CanvasRenderingContext2D,
    assets: AssetLoader | null,
  ): void;
}
```

**Rendering strategy by shape:**

| Shape | Method | Notes |
|-------|--------|-------|
| `circle` | `arc()` + `fill()` | Single path per color batch |
| `rect` | `fillRect()` | Fastest Canvas2D primitive |
| `triangle` | `moveTo/lineTo` + `fill()` | 3-vertex path |
| `texture` | `drawImage()` | Source from asset loader |

**Color interpolation during render:**

Rather than store per-frame interpolated colors (expensive writes), compute color at render time from `age/life` ratio:

```typescript
// Hot render loop for circle particles
// Optimization: uniform-color fast path (no per-particle fillStyle changes)
const uniformColor = config._uniformColor; // pre-computed at config resolution time
if (uniformColor) {
  ctx.fillStyle = uniformColor;
}

// Reusable color string buffer to avoid per-particle string allocation
let prevR = -1, prevG = -1, prevB = -1, prevA = -1;

for (let i = 0; i < pool.alive; i++) {
  const t = pool.age[i] / pool.life[i]; // 0..1 normalized life progress

  // Lerp size
  const sizeScale = config.sizeOverLife[0] + (config.sizeOverLife[1] - config.sizeOverLife[0]) * t;
  const s = pool.size[i] * sizeScale;

  // Only update fillStyle when color actually changes (skip for uniform-color case)
  if (!uniformColor) {
    const cr = (pool.r[i] + (pool.rEnd[i] - pool.r[i]) * t) * 255 | 0;
    const cg = (pool.g[i] + (pool.gEnd[i] - pool.g[i]) * t) * 255 | 0;
    const cb = (pool.b[i] + (pool.bEnd[i] - pool.b[i]) * t) * 255 | 0;
    const ca = pool.a[i] + (pool.aEnd[i] - pool.a[i]) * t;
    if (cr !== prevR || cg !== prevG || cb !== prevB || ca !== prevA) {
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${ca})`;
      prevR = cr; prevG = cg; prevB = cb; prevA = ca;
    }
  }

  ctx.beginPath();
  ctx.arc(pool.x[i], pool.y[i], s * 0.5, 0, TAU);
  ctx.fill();
}
```

**Blend mode support:**

```typescript
if (config.blendMode === "additive") {
  ctx.globalCompositeOperation = "lighter";
} else {
  ctx.globalCompositeOperation = "source-over";
}
```

**Optimization: `fillStyle` batching.** If `colorStart === colorEnd` (no color change over life), all particles share the same `fillStyle`. Set it once, batch all draws. Check this at emitter setup time, not per frame.

- [x] Implement `ParticleRenderer2D` with shape-specific rendering
- [x] Color lerp over lifetime in render loop
- [x] Size lerp over lifetime in render loop
- [x] Additive blend mode via `globalCompositeOperation`
- [x] Texture particle rendering via `drawImage()`
- [x] Rotation support for rect and texture particles
- [x] Optimization: detect uniform-color case, batch `fillStyle`
- [x] Unit tests verifying render calls (mock canvas context)

---

## 4. Phase 3: Emitter Node & Game Integration

### ParticleEmitter (Node2D)

**File:** `packages/particles/src/particle-emitter.ts`

The primary user-facing class. A single Node2D that owns a simulator and renderer.

```typescript
export class ParticleEmitter extends Node2D {
  /** Particle configuration. Can be changed at runtime. */
  config: ParticleConfig;

  /** Whether the emitter is actively emitting. Default: true */
  emitting = true;

  /** If true, destroy self when done emitting and all particles dead. Default: false */
  oneShot = false;

  /** Read-only: number of currently alive particles */
  get aliveCount(): number;

  /** Read-only: true when all particles are dead and emitting is false */
  get isFinished(): boolean;

  // Signals
  readonly finished: Signal<void>;  // emitted when oneShot completes

  /** Emit a burst of particles immediately */
  burst(count?: number): void;

  /** Restart the emitter (kills existing particles, resets) */
  restart(): void;

  // Internal
  private _simulator: ParticleSimulator;
  private _renderer2d: ParticleRenderer2D;

  private _prevPosition = new Vec2(0, 0);

  onFixedUpdate(dt: number): void {
    const pos = this.globalPosition;
    if (this.emitting) {
      this._simulator.emit(this._config, dt, pos.x, pos.y, this.game.random);
    }
    // Pass emitter position delta for simulationSpace: "local" support
    const dx = pos.x - this._prevPosition.x;
    const dy = pos.y - this._prevPosition.y;
    this._simulator.update(this._config, dt, this.game.random, dx, dy);
    this._prevPosition.set(pos.x, pos.y);

    if (this.oneShot && !this.emitting && this._simulator.pool.alive === 0) {
      this.finished.emit();
      this.destroy();
    }
  }

  onDraw(ctx: DrawContext): void {
    // Access the underlying CanvasRenderingContext2D (public property on Canvas2DDrawContext)
    this._renderer2d.render(this._simulator.pool, this._resolvedConfig, (ctx as Canvas2DDrawContext).ctx, this.game.assets);
  }
}
```

**Scene tree usage:**

```typescript
// Add to scene
const fire = new ParticleEmitter(Particles.fire());
fire.position = new Vec2(200, 300);
scene.add(fire);

// One-shot burst (e.g., explosion on enemy death)
const explosion = new ParticleEmitter({
  ...Particles.explosion(),
  oneShot: true,
});
explosion.position = enemy.globalPosition;
scene.add(explosion);  // auto-destroys when done
```

**JSX support:**

```tsx
class Torch extends Node2D {
  override build() {
    return (
      <ParticleEmitter config={Particles.fire()} position={[0, -8]} />
    );
  }
}
```

### ParticlePlugin

**File:** `packages/particles/src/particle-plugin.ts`

Register the particle system with the game. Lightweight — mainly ensures proper cleanup and provides `game.particles` convenience namespace.

```typescript
export function ParticlePlugin(): Plugin {
  return {
    name: "particles",
    install(game: Game) {
      // Module augmentation gives game.particles namespace
      // No per-frame system needed — emitters self-update via onFixedUpdate
    },
  };
}

// Module augmentation
declare module "@quintus/core" {
  interface Game {
    /** Create a one-shot particle burst at a position */
    emitParticles(config: ParticleConfig, position: Vec2, count?: number): ParticleEmitter;
  }
}
```

The `game.emitParticles()` convenience creates a one-shot emitter, adds it to the current scene, and returns it. This is the fastest way to fire-and-forget particle effects.

- [x] Implement `ParticleEmitter` extending Node2D
- [x] Wire simulator to `onFixedUpdate()` (pass `rng` and emitter delta to `update()`)
- [x] Wire renderer to `onDraw()` (cast `DrawContext` to `Canvas2DDrawContext` for raw access)
- [x] Support `simulationSpace: "local"` (offset particles by emitter position delta each frame)
- [x] `oneShot` mode with auto-destroy
- [x] `burst()` method for immediate particle spawning
- [x] `restart()` method (resets emission accumulator)
- [x] `finished` signal
- [x] `ParticlePlugin` with `game.emitParticles()` convenience (use `augment.ts` pattern)
- [x] JSX prop coercion for `config` (plain object → resolved config)
- [x] Integration test: add emitter to scene, step frames, verify particles spawn and die

**Draw order:** `ParticleEmitter` draws at its position in the scene tree. For layered effects (e.g., rain in front of everything, fire behind a character), use separate `Layer` nodes. Note: `ySortChildren` sorts by emitter Y, not individual particle Y — this is expected since particles are not scene tree nodes.

---

## 5. Phase 4: Property Curves & Color Gradients

### Curve Type

**File:** `packages/particles/src/curve.ts`

A minimal keyframe curve for property-over-lifetime animation. More expressive than `[start, end]` linear lerp, but still declarative and LLM-readable.

```typescript
/** A keyframe on a curve. time is 0..1 (normalized lifetime) */
export interface CurveKey {
  time: number;   // 0..1
  value: number;
}

/**
 * Piecewise-linear curve evaluated over particle lifetime.
 * Compact declaration: just an array of [time, value] pairs.
 */
export type Curve = CurveKey[] | number;  // number = constant

/** Evaluate a curve at normalized time t (0..1) */
export function evaluateCurve(curve: Curve, t: number): number;
```

**LLM-friendly declaration:**

```typescript
// Constant value
sizeOverLife: 5

// Linear ramp (same as [start, end] shorthand)
sizeOverLife: [{ time: 0, value: 1 }, { time: 1, value: 0 }]

// Complex curve: grow, hold, shrink
sizeOverLife: [
  { time: 0,   value: 0 },    // born invisible
  { time: 0.1, value: 1 },    // quickly grow to full size
  { time: 0.7, value: 1 },    // hold full size
  { time: 1,   value: 0 },    // fade out at end
]
```

### Color Gradient

**File:** `packages/particles/src/gradient.ts`

```typescript
export interface GradientStop {
  time: number;   // 0..1
  color: string | Color;
}

/** Multi-stop color gradient over particle lifetime */
export type ColorGradient = GradientStop[];

/** Evaluate gradient at normalized time t */
export function evaluateGradient(gradient: ColorGradient, t: number): Color;
```

**Usage:**

```typescript
// Fire: yellow → orange → red → transparent black
colorOverLife: [
  { time: 0,   color: "#ffff00" },
  { time: 0.3, color: "#ff6600" },
  { time: 0.7, color: "#ff0000" },
  { time: 1,   color: "#00000000" },
]
```

### PropertyCurves in Config

Extend `ParticleConfig` with optional curve overrides:

```typescript
export interface PropertyCurves {
  /** Size multiplier over lifetime */
  size?: Curve;
  /** Alpha multiplier over lifetime */
  alpha?: Curve;
  /** Speed multiplier over lifetime */
  speed?: Curve;
  /** Color over lifetime (overrides colorStart/colorEnd) */
  color?: ColorGradient;
}
```

**Precedence rules** (per-field, not all-or-nothing):
- `curves.size` → overrides `sizeOverLife`. If `curves.size` is `undefined`, `sizeOverLife` is used.
- `curves.color` → overrides `colorStart`/`colorEnd`. If `curves.color` is `undefined`, `colorStart`/`colorEnd` is used.
- `curves.alpha` → overrides the alpha channel from `colorEnd`. If `curves.alpha` is `undefined`, alpha is interpolated from `colorStart`/`colorEnd` as normal.
- `curves.speed` → multiplier on velocity magnitude. If `undefined`, no speed curve is applied.

- [x] Implement `Curve` type and `evaluateCurve()`
- [x] Implement `ColorGradient` type and `evaluateGradient()`
- [x] Add `PropertyCurves` to `ParticleConfig`
- [x] Update render loop to use curves when present
- [ ] Optimize: pre-compute LUT for curves with many keys
- [x] Unit tests for curve evaluation (linear interp, edge cases, clamping)
- [x] Unit tests for gradient evaluation

---

## 6. Phase 5: Preset Library & LLM-Friendly API

### Presets Namespace

**File:** `packages/particles/src/presets.ts`

Each preset is a function returning a complete `ParticleConfig`. Functions (not constants) so each call gets a fresh object safe to mutate.

```typescript
export const Particles = {
  /** 🔥 Upward flames, yellow→orange→red→transparent */
  fire(overrides?: Partial<ParticleConfig>): ParticleConfig;

  /** 💨 Soft gray puffs, rising and expanding */
  smoke(overrides?: Partial<ParticleConfig>): ParticleConfig;

  /** ✨ Short-lived bright dots flying outward */
  sparks(overrides?: Partial<ParticleConfig>): ParticleConfig;

  /** 💥 Radial burst, fast outward, quick fade */
  explosion(overrides?: Partial<ParticleConfig>): ParticleConfig;

  /** 🩸 Directional splatter with gravity */
  blood(overrides?: Partial<ParticleConfig>): ParticleConfig;

  /** 🌧️ Downward streaks across a wide area */
  rain(overrides?: Partial<ParticleConfig>): ParticleConfig;

  /** ❄️ Slow, drifting, slightly random */
  snow(overrides?: Partial<ParticleConfig>): ParticleConfig;

  /** ⭐ Radial sparkle, size pulses, slow drift */
  magic(overrides?: Partial<ParticleConfig>): ParticleConfig;

  /** 💀 Dark wisps rising from a surface */
  poison(overrides?: Partial<ParticleConfig>): ParticleConfig;

  /** ⚡ Very fast, short-lived, branching lines */
  electric(overrides?: Partial<ParticleConfig>): ParticleConfig;

  /** 🫧 Slow, rising, slightly transparent circles */
  bubbles(overrides?: Partial<ParticleConfig>): ParticleConfig;

  /** 🍂 Slow falling with rotation and horizontal drift */
  leaves(overrides?: Partial<ParticleConfig>): ParticleConfig;

  /** 💫 Trail behind a moving object */
  trail(overrides?: Partial<ParticleConfig>): ParticleConfig;

  /** 🔨 Small chunks flying from an impact point */
  debris(overrides?: Partial<ParticleConfig>): ParticleConfig;

  /** 🌟 Collect/pickup sparkle effect */
  collect(overrides?: Partial<ParticleConfig>): ParticleConfig;
};
```

**Example preset implementation:**

```typescript
fire(overrides?: Partial<ParticleConfig>): ParticleConfig {
  return {
    maxParticles: 150,
    emissionRate: 40,
    emissionShape: "circle",
    emissionRadius: 5,

    initialSpeed: [60, 100],
    initialAngle: [-100, -80],      // mostly upward with slight spread
    gravityY: -20,                  // slight updraft
    drag: 0.01,
    turbulence: 15,

    shape: "circle",
    size: [3, 7],
    sizeOverLife: [1, 0],

    colorStart: "#ffcc00",
    colorEnd: "#ff000000",          // red, fully transparent
    blendMode: "additive",

    lifetime: [0.3, 0.8],

    ...overrides,
  };
},
```

**Override pattern for LLMs:**

```typescript
// LLM: "make blue fire"
const blueFire = Particles.fire({ colorStart: "#4488ff", colorEnd: "#0022ff00" });

// LLM: "make it bigger and slower"
const bigFire = Particles.fire({
  size: [8, 14],
  initialSpeed: [30, 50],
  lifetime: [0.5, 1.2],
});
```

**Note on override safety:** All config properties are flat (no nested objects). `gravity` is split into `gravityX`/`gravityY` specifically so that `{ ...preset, ...overrides }` spread works correctly — an LLM can override `gravityX` without losing `gravityY`. This is intentional: flat configs are both LLM-friendly and spread-safe.

### Preset Documentation Comments

Every preset includes a JSDoc comment that describes the visual effect in plain English. This is critical for LLM consumption — the LLM reads the type signature + comment to understand what each preset looks like without running it.

- [x] Implement all 15 presets in `Particles` namespace
- [x] Each preset returns a complete config (no undefined fields)
- [x] Each preset accepts optional `overrides` spread
- [x] JSDoc on every preset describing the visual effect
- [x] Export `Particles` from package index
- [x] Tests verifying each preset produces valid configs
- [x] Tests verifying override merging works correctly

### Preset Viewer Example

**Path:** `examples/preset-viewer/`

An interactive gallery that displays all 15 presets side by side for visual review and tuning. Each preset runs in its own labeled cell on a grid. A dark background makes additive-blend effects pop.

```
Scene (PresetViewer)
├── Background (Node2D)                 // dark fill (#111)
├── PresetGrid (Node2D)                 // 5×3 grid of cells
│   ├── PresetCell "fire"
│   │   ├── Label ("fire")
│   │   └── ParticleEmitter (Particles.fire())
│   ├── PresetCell "smoke"
│   │   ├── Label ("smoke")
│   │   └── ParticleEmitter (Particles.smoke())
│   ├── ... (all 15 presets)
│   └── PresetCell "collect"
│       ├── Label ("collect")
│       └── ParticleEmitter (Particles.collect())
├── FocusView (Node2D)                  // click a cell → show preset solo, full size
│   ├── ParticleEmitter (active preset)
│   └── ConfigOverlay (Label)           // shows the ParticleConfig as JSON text
└── HUD (Layer)
    ├── Label ("Click a preset to focus • ESC to return to grid • R to restart")
    ├── FPSLabel
    └── AliveCountLabel                 // total particles across all emitters
```

**Interaction:**

| Input | Action |
|-------|--------|
| Click cell | Focus that preset: hide grid, show emitter centered at large scale |
| ESC | Return to grid view |
| R | Restart all emitters (kills particles, resets accumulators) |
| Left/Right arrows | In focus view, cycle through presets |
| Space | In focus view, toggle emitting on/off |
| B | In focus view, trigger a burst of 50 particles |

**Grid layout:** 5 columns × 3 rows, 160×160px cells with 20px gutter. Canvas size 960×540. Each cell positions its emitter at cell center. Continuous emitters run normally; burst-only presets (explosion, collect, debris) auto-burst every 2 seconds so the effect stays visible.

**Focus view:** When a preset is clicked, the grid hides and a single emitter renders at canvas center. A semi-transparent overlay in the corner shows the preset's `ParticleConfig` as formatted JSON — useful for LLMs and developers reading the config while seeing the visual result. Arrow keys cycle presets without returning to the grid.

**Auto-burst for one-shot presets:** Presets like `explosion`, `collect`, and `debris` are designed for burst use. In the grid, these cells run a 2-second timer that calls `emitter.burst()` automatically. In focus view, they burst on entry and can be re-triggered with Space or B.

- [x] Create `examples/particles/` directory (renamed from preset-viewer)
- [x] PresetCell component: label + centered emitter in a fixed-size region
- [x] 5×3 grid layout showing all 15 presets simultaneously
- [x] Click-to-focus: isolate one preset at full canvas size
- [x] Config JSON overlay in focus view
- [x] Keyboard navigation (arrows to cycle, ESC to return, R to restart)
- [x] Auto-burst timer for one-shot presets (explosion, collect, debris)
- [x] FPS and total alive-particle count in HUD
- [x] Dark background for additive blend visibility
- [x] Add to example index

---

## 7. Phase 6: Three.js 3D Particles

### ParticleEmitter3D (Node3D)

**File:** `packages/particles/src/particle-emitter-3d.ts`

Uses Three.js `Points` or `InstancedMesh` for GPU-accelerated 3D particles.

```typescript
export class ParticleEmitter3D extends Node3D {
  config: ParticleConfig3D;
  emitting = true;
  oneShot = false;

  private _simulator: ParticleSimulator3D;
  private _geometry: THREE.BufferGeometry;
  private _material: THREE.PointsMaterial | THREE.ShaderMaterial;
  private _points: THREE.Points;

  protected override _createObject3D(): THREE.Object3D {
    this._geometry = new THREE.BufferGeometry();
    // Pre-allocate attribute buffers
    this._geometry.setAttribute("position", new THREE.Float32BufferAttribute(
      new Float32Array(this.config.maxParticles * 3), 3
    ));
    this._geometry.setAttribute("color", new THREE.Float32BufferAttribute(
      new Float32Array(this.config.maxParticles * 4), 4
    ));
    this._geometry.setAttribute("size", new THREE.Float32BufferAttribute(
      new Float32Array(this.config.maxParticles), 1
    ));

    this._material = new THREE.PointsMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      alphaTest: 0.01,              // discard fully transparent fragments for correct sorting
      sizeAttenuation: true,
      blending: this.config.blendMode === "additive"
        ? THREE.AdditiveBlending
        : THREE.NormalBlending,
    });

    this._points = new THREE.Points(this._geometry, this._material);
    return this._points;
  }
}
```

### ParticleConfig3D

Extends the 2D config with 3D-specific fields:

```typescript
export interface ParticleConfig3D extends ParticleConfig {
  /** Gravity Z acceleration in units/sec². Default: 0 */
  gravityZ?: number;
  /** Initial velocity direction as spherical sector (degrees) */
  initialPhi?: Range;      // azimuthal angle (horizontal spread)
  initialTheta?: Range;    // polar angle (vertical spread)
  /** Emission shape extends to 3D */
  emissionShape?: EmissionShape | "sphere" | "hemisphere" | "box";
  /** Box emission dimensions */
  emissionBox?: { width: number; height: number; depth: number };
  /** Whether particles face the camera (billboarding). Default: true */
  billboard?: boolean;
  /** Particle texture (applied to point sprite or instanced quad) */
  texture?: string;
  /** Use InstancedMesh instead of Points (for complex particle shapes). Default: false */
  useInstancing?: boolean;
}
```

### ParticleSimulator3D

**File:** `packages/particles/src/particle-simulator-3d.ts`

Extends the 2D simulator with a z-axis:

```typescript
export class ParticleSimulator3D extends ParticleSimulator {
  override readonly pool: ParticlePool3D;  // adds z[], vz[] arrays

  override emit(config: ParticleConfig3D, dt: number, emitterX: number, emitterY: number, rng: SeededRandom, emitterZ?: number): void;
  override burst(config: ParticleConfig3D, count: number, emitterX: number, emitterY: number, rng: SeededRandom, emitterZ?: number): void;
  override update(config: ParticleConfig3D, dt: number, rng: SeededRandom, emitterDX?: number, emitterDY?: number, emitterDZ?: number): void;

  /** Sync alive particles into Three.js buffer attributes */
  syncBuffers(geometry: THREE.BufferGeometry): void;
}
```

**Buffer sync (called before render):**

```typescript
syncBuffers(geometry: THREE.BufferGeometry): void {
  const posAttr = geometry.getAttribute("position") as THREE.Float32BufferAttribute;
  const colorAttr = geometry.getAttribute("color") as THREE.Float32BufferAttribute;
  const sizeAttr = geometry.getAttribute("size") as THREE.Float32BufferAttribute;

  for (let i = 0; i < this.pool.alive; i++) {
    const t = this.pool.age[i] / this.pool.life[i];
    posAttr.setXYZ(i, this.pool.x[i], this.pool.y[i], this.pool.z[i]);
    // Lerp color
    colorAttr.setXYZW(i,
      this.pool.r[i] + (this.pool.rEnd[i] - this.pool.r[i]) * t,
      this.pool.g[i] + (this.pool.gEnd[i] - this.pool.g[i]) * t,
      this.pool.b[i] + (this.pool.bEnd[i] - this.pool.b[i]) * t,
      this.pool.a[i] + (this.pool.aEnd[i] - this.pool.a[i]) * t,
    );
    sizeAttr.setX(i, this.pool.size[i] * evaluateSize(t));
  }

  // Only draw alive particles
  geometry.setDrawRange(0, this.pool.alive);
  posAttr.needsUpdate = true;
  colorAttr.needsUpdate = true;
  sizeAttr.needsUpdate = true;
}
```

- [x] Implement `ParticlePool3D extends ParticlePool` adding only `z[]` and `vz[]` arrays
- [x] Implement `ParticleSimulator3D extends ParticleSimulator` overriding `_spawnParticle()`/`update()` for z-axis
- [x] Implement `ParticleEmitter3D` extending Node3D
- [x] Three.js Points-based rendering with buffer attribute sync
- [x] ShaderMaterial for per-particle RGBA (vertex + fragment shaders)
- [ ] Optional InstancedMesh mode for textured quads (deferred)
- [x] Additive blending support
- [x] 3D emission shapes: sphere, hemisphere, box
- [x] Subpath export `@quintus/particles/three` with optional peer deps
- [x] 3D presets: `Particles3D.fire()`, `Particles3D.sparks()`, etc. (6 presets)

---

## 8. Phase 7: Tests & Demo

### Test Plan

**Unit tests:** `packages/particles/src/__tests__/`

| Test file | What it covers |
|-----------|----------------|
| `particle-pool.test.ts` | Spawn, kill, swap-remove, capacity limits, reset |
| `particle-simulator.test.ts` | Emission rate, burst, gravity, drag, lifetime, emission shapes |
| `particle-config.test.ts` | Default application, range resolution, color coercion, angle conversion |
| `curve.test.ts` | Curve evaluation, interpolation, edge cases, constants |
| `gradient.test.ts` | Color gradient evaluation, multi-stop interpolation |
| `presets.test.ts` | All presets return valid configs, overrides work, no undefined fields |
| `particle-emitter.test.ts` | Node2D integration, onFixedUpdate/onDraw cycle, oneShot, burst, finished signal |

**Integration tests:** `packages/particles/src/__tests__/integration.test.ts`

- Add ParticleEmitter to a HeadlessGame scene, run 60 frames, verify particles spawned and some died
- One-shot emitter auto-destroys after particles expire
- Deterministic: same seed → same particle positions after N frames
- Burst at specific position → all particles near that position at frame 0
- Verify `simulationSpace: "local"` tracks emitter movement

**Deterministic test:**

```typescript
test("particle simulation is deterministic", () => {
  const config = Particles.fire();
  const run = (seed: number) => {
    const sim = new ParticleSimulator(100);
    const rng = new SeededRandom(seed);
    for (let i = 0; i < 60; i++) sim.emit(config, 1/60, 0, 0, rng);
    for (let i = 0; i < 60; i++) sim.update(config, 1/60);
    return Array.from(sim.pool.x.subarray(0, sim.pool.alive));
  };
  expect(run(42)).toEqual(run(42));
});
```

### Demo: Particle Showcase

**Path:** `examples/particles/`

A simple showcase scene with interactive particle effects:

```
Scene (ParticleShowcase)
├── Background (Node2D)
├── FireDemo (Node2D)
│   └── ParticleEmitter (fire preset)
├── RainDemo (Node2D)
│   └── ParticleEmitter (rain preset, full screen width)
├── ExplosionSpawner (Node2D)          // click to spawn one-shot explosions
├── SparkTrail (Actor)                 // WASD-controlled, trails sparks
│   └── ParticleEmitter (trail preset)
└── HUD (Layer)
    ├── Label ("Click for explosions, WASD to move")
    └── FPSLabel
```

- [ ] Create `examples/particles/` directory with showcase scene
- [ ] Fire torch (continuous emitter)
- [ ] Rain (wide emission rect, downward)
- [ ] Click-to-explode (one-shot burst)
- [ ] Moving trail (emitter follows Actor)
- [ ] FPS counter showing performance with 500+ simultaneous particles
- [ ] Add to example index

---

## 9. Cross-Cutting Concerns

### Performance Budget

| Scenario | Target | Strategy |
|----------|--------|----------|
| 500 2D particles | < 1ms update, < 2ms render | SoA pool, batch rendering |
| 2000 2D particles | < 4ms update, < 8ms render | Avoid per-particle allocations |
| 500 3D particles | < 1ms update, < 0.5ms render | GPU Points, buffer attribute upload |
| 5000 3D particles | < 4ms update, < 1ms render | Points + size attenuation |

**Zero-allocation hot path:** The update and render loops must not allocate objects. All state lives in pre-allocated typed arrays. Canvas2D `fillStyle` strings are deduplicated — only set when color changes from previous particle. Uniform-color configs (colorStart === colorEnd) use a single pre-computed fillStyle for all particles.

**Fillrate awareness:** Additive blend particles with large sizes can tank framerate on fill-rate-limited hardware. The presets use conservative sizes. Document this for LLMs: "for mobile, keep `maxParticles` under 200 and `size` under 10".

### Determinism

- All randomness flows through `game.random` (SeededRandom)
- Simulation runs in `onFixedUpdate` (fixed timestep), not `onUpdate`
- Emission accumulator carries over fractional particles deterministically
- Same seed + same config + same frame count = identical particle state
- `ParticleSimulator` is usable in headless mode without a renderer

### Dependency Direction

```
@quintus/particles
├── depends on: @quintus/core (Node2D, signals, plugin, DrawContext)
├── depends on: @quintus/math (Vec2, Color, SeededRandom)
├── optional peer: @quintus/three (for ParticleEmitter3D)
└── no dependency on: physics, sprites, tilemap, input, audio, ui, tween
```

### Error Handling

- Invalid config values (negative lifetime, maxParticles = 0) → warn + clamp to sensible minimum
- Texture not loaded → fall back to circle shape with warning
- Pool overflow → silently skip new emissions (never crash)

### Serialization

`ParticleEmitter` serializes its config and emitting state (not individual particles). On restore, the emitter starts fresh — particle state is ephemeral visual decoration, not game state.

```typescript
interface ParticleEmitterSnapshot extends Node2DSnapshot {
  config: ParticleConfig;
  emitting: boolean;
  oneShot: boolean;
}
```

---

## 10. Definition of Done

- [ ] All 7 phases marked Done in status table
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes — 95%+ coverage on `@quintus/particles`
- [ ] `pnpm lint` clean
- [ ] Particle showcase demo runs at 60fps with 500+ particles
- [ ] Deterministic test passes (same seed = same result)
- [ ] All 15 presets produce visually distinct, recognizable effects
- [ ] `ParticleEmitter` works in JSX `build()` pattern
- [ ] `ParticleEmitter3D` renders in Three.js scene
- [ ] `game.emitParticles()` convenience works for one-shot effects
- [ ] Package exports from `packages/particles/src/index.ts`
- [ ] Meta-package `quintus` re-exports particle types

---

## File Structure

```
packages/particles/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts
    ├── particle-pool.ts
    ├── particle-pool-3d.ts
    ├── particle-simulator.ts
    ├── particle-simulator-3d.ts
    ├── particle-config.ts
    ├── particle-renderer-2d.ts
    ├── particle-emitter.ts
    ├── particle-emitter-3d.ts
    ├── particle-plugin.ts
    ├── curve.ts
    ├── gradient.ts
    ├── presets.ts
    ├── presets-3d.ts
    └── __tests__/
        ├── particle-pool.test.ts
        ├── particle-simulator.test.ts
        ├── particle-config.test.ts
        ├── curve.test.ts
        ├── gradient.test.ts
        ├── presets.test.ts
        ├── particle-emitter.test.ts
        └── integration.test.ts
```

---

## Execution Order

1. **Phase 1** (Core simulation) — pure logic, no rendering dependencies, fully testable in isolation
2. **Phase 2** (Canvas2D rendering) — depends on Phase 1, requires mock canvas for testing
3. **Phase 3** (Emitter node) — depends on Phases 1+2, integrates with scene tree
4. **Phase 4** (Curves & gradients) — extends Phase 1+2, adds expressiveness
5. **Phase 5** (Presets) — depends on all above, wraps everything in LLM-friendly API
6. **Phase 6** (Three.js 3D) — can start after Phase 1 (shares simulator concept), but rendering needs Phase 2 patterns
7. **Phase 7** (Tests & demo) — final integration, depends on all above
