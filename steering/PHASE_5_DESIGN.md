# Phase 5: Audio, Tween & UI — Detailed Design

> **Goal:** Sound effects, music, code-driven animations, and basic UI widgets. After this phase, you have a full-featured 2D game engine capable of polished, complete games.
> **Duration:** ~2 weeks
> **Outcome:** Three new packages (`@quintus/tween`, `@quintus/audio`, `@quintus/ui`) ship as valid ESM/CJS bundles. A platformer demo plays sound effects, animates UI transitions, and displays a HUD with health bar and score. All tests pass.

---

## Table of Contents

1. [Core Changes](#1-core-changes)
   - [Game.postUpdate Signal](#11-gamepostupdate-signal)
   - [Node2D.alpha](#12-node2dalpha)
   - [Node2D.renderFixed](#13-node2drenderfixed)
   - [Canvas2DRenderer Updates](#14-canvas2drenderer-updates)
   - [AssetLoader.registerLoader](#15-assetloaderregisterloader)
2. [Package: @quintus/tween](#2-package-quintustween)
   - [Tween Class](#21-tween-class)
   - [Property Interpolation](#22-property-interpolation)
   - [Easing Functions](#23-easing-functions)
   - [TweenSystem (Internal)](#24-tweensystem-internal)
   - [TweenPlugin & Node Augmentation](#25-tweenplugin--node-augmentation)
   - [File Structure](#26-file-structure)
3. [Package: @quintus/audio](#3-package-quintusaudio)
   - [AudioSystem](#31-audiosystem)
   - [AudioPlayer Node](#32-audioplayer-node)
   - [Audio Bus](#33-audio-bus)
   - [Autoplay Gate](#34-autoplay-gate)
   - [AudioPlugin](#35-audioplugin)
   - [File Structure](#36-file-structure)
4. [Package: @quintus/ui](#4-package-quintusui)
   - [UINode Base Class](#41-uinode-base-class)
   - [Pointer Event Handling](#42-pointer-event-handling)
   - [Label](#43-label)
   - [Button](#44-button)
   - [ProgressBar](#45-progressbar)
   - [Panel](#46-panel)
   - [Container](#47-container)
   - [Layer](#48-layer)
   - [File Structure](#49-file-structure)
5. [Cross-Cutting Concerns](#5-cross-cutting-concerns)
   - [Dependency Direction](#51-dependency-direction)
   - [Performance](#52-performance)
   - [Determinism](#53-determinism)
   - [Error Handling](#54-error-handling)
6. [Test Plan](#6-test-plan)
7. [Demo: Platformer with Audio, Tweens & HUD](#7-demo-platformer-with-audio-tweens--hud)
8. [Definition of Done](#8-definition-of-done)
9. [Execution Order](#9-execution-order)

---

## 1. Core Changes

Phase 5 requires five small, additive changes to `@quintus/core`. All are backward-compatible.

### 1.1 Game.postUpdate Signal

**File:** `packages/core/src/game.ts`

Add a `postUpdate` signal that fires after all nodes' `onUpdate()` but before rendering. The tween system uses this to apply property changes each frame.

```typescript
// New signal declaration (alongside existing signals)
readonly postUpdate: Signal<number> = signal<number>();

// Updated _update method
private _update(dt: number): void {
    this._currentScene?._walkUpdate(dt);
    this.postUpdate.emit(dt);  // ← new
}
```

**Why a signal instead of a lifecycle hook?** Tweens are managed centrally by TweenSystem, not per-node. A signal on Game lets the TweenSystem update all active tweens in one pass, after all node logic has run but before rendering. This ensures tween property changes are visible in the current frame.

**Game loop order after this change:**
```
preFrame → fixedUpdate(dt) [0..N] → postFixedUpdate(dt) → update(dt) → postUpdate(dt) → render → cleanup
```

### 1.2 Node2D.alpha

**File:** `packages/core/src/node2d.ts`

Add a per-node opacity property. Default `1` (fully opaque). The renderer applies it via `globalAlpha` before drawing.

```typescript
export class Node2D extends Node {
    // ... existing properties ...

    /** Node opacity (0 = transparent, 1 = opaque). Applied by the renderer. */
    alpha = 1;
}
```

**Why on Node2D, not a DrawContext concern?** Every visual node needs opacity for fade effects. Having it as a first-class property on Node2D enables tweening (`node.tween().to({ alpha: 0 }, 0.3)`) without nodes needing custom `setAlpha()` calls in their `onDraw()`.

**Non-cascading for MVP.** A parent with `alpha = 0.5` does NOT make children render at half opacity. Each node's alpha is independent. Cascading alpha (computing `effectiveAlpha = parent.alpha × node.alpha`) can be added later via a `globalAlpha` computed property similar to `globalTransform`. For Phase 5, independent alpha covers the common cases (fading individual nodes, UI element transparency).

**Serialization:** Add `alpha` to `Node2DSnapshot`:

```typescript
override serialize(): Node2DSnapshot {
    return {
        ...super.serialize(),
        // ... existing fields ...
        alpha: this.alpha,  // ← new
    };
}
```

### 1.3 Node2D.renderFixed

**File:** `packages/core/src/node2d.ts`

Add a flag that tells the renderer to skip the camera's `viewTransform` for this node, rendering it in screen space instead of world space.

```typescript
export class Node2D extends Node {
    // ... existing properties ...

    /**
     * When true, this node renders in screen space (ignores camera viewTransform).
     * Used by UI nodes for fixed HUD elements. Default: false.
     */
    renderFixed = false;
}
```

**Why on Node2D?** This is a generic rendering concern, not UI-specific. Any node might need screen-space rendering (HUD elements, screen-space effects, debug overlays). Keeping it on Node2D avoids the renderer needing to know about `UINode` or `Layer` types.

### 1.4 Canvas2DRenderer Updates

**File:** `packages/core/src/canvas2d-renderer.ts`

Update the render loop to apply `alpha` and check `renderFixed`:

```typescript
for (const node of this.renderList) {
    ctx.save();

    // Per-node opacity
    if (node.alpha < 1) {
        this.ctx.globalAlpha = node.alpha;
    }

    // Transform: fixed nodes skip viewTransform
    if (node.renderFixed || !hasView) {
        const t = node.globalTransform;
        ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
    } else {
        const t = vt.multiply(node.globalTransform);
        ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
    }

    try {
        node.onDraw(this.drawContext);
    } catch (_err) {
        // Lifecycle error handling done by scene
    }

    ctx.restore();
}
```

**`ctx.save()` / `ctx.restore()`** already bracket each node, so `globalAlpha` is properly scoped — no alpha leak between nodes.

**Performance:** One extra boolean check (`node.renderFixed`) and one conditional per node. Negligible overhead.

### 1.5 AssetLoader.registerLoader

**File:** `packages/core/src/asset-loader.ts`

Add a generic loader registration method so plugins can extend supported asset types without modifying core.

```typescript
export type LoaderFn = (name: string, path: string) => Promise<unknown>;

export class AssetLoader {
    // ... existing code ...

    private _customLoaders = new Map<string, LoaderFn>();

    /**
     * Register a custom loader for a new asset type.
     * Plugins use this to add support for audio, fonts, etc.
     *
     * @param type Asset type key (e.g. "audio", "font").
     * @param loader Async function that loads a single asset by name and path.
     *
     * @example
     * ```typescript
     * game.assets.registerLoader("audio", async (name, path) => {
     *     const response = await fetch(path);
     *     const buffer = await response.arrayBuffer();
     *     return await audioContext.decodeAudioData(buffer);
     * });
     * ```
     */
    registerLoader(type: string, loader: LoaderFn): void {
        this._customLoaders.set(type, loader);
    }

    /**
     * Load assets. Now accepts custom types registered via registerLoader().
     *
     * @example
     * ```typescript
     * await game.assets.load({
     *     images: ["hero.png", "tiles.png"],
     *     json: ["level1.json"],
     *     audio: ["jump.ogg", "music.mp3"],  // ← custom type
     * });
     * ```
     */
    async load(manifest: Record<string, string[]>): Promise<void>;
}
```

**Design decision — generic extension over audio-specific:** Rather than adding `audio` knowledge to the core AssetLoader, we add a generic extension point. This keeps core audio-agnostic and allows any plugin to register new asset types (fonts, shaders, Tiled TMX files, etc.).

---

## 2. Package: `@quintus/tween`

Size budget: **~3KB gzipped**

Dependencies: `@quintus/core`, `@quintus/math`

### 2.1 Tween Class

The primary user-facing API. Created via `node.tween()`, returns a chainable builder.

```typescript
import { type Signal, signal } from "@quintus/core";

export type EasingFn = (t: number) => number;

export class Tween {
    /** The node this tween is animating. */
    readonly target: Node;

    // === Builder Methods (chainable) ===

    /**
     * Interpolate target properties to the given values over a duration.
     *
     * @param properties Target values. Supports:
     *   - Flat numbers: `{ rotation: Math.PI }`
     *   - Vec2 sub-properties: `{ position: { y: 100 } }`
     *   - Objects with lerp(): `{ tint: Color.RED }` (whole-object interpolation)
     * @param duration Duration in seconds.
     * @param easing Easing function. Default: Ease.linear.
     */
    to(properties: TweenTarget, duration: number, easing?: EasingFn): this;

    /**
     * Make the next .to() run in parallel with the previous step.
     * Without this, steps are sequential by default.
     *
     * @example
     * ```typescript
     * node.tween()
     *   .to({ alpha: 0 }, 0.3)           // Step A
     *   .parallel()
     *   .to({ position: { y: -20 } }, 0.3) // Runs alongside A
     * ```
     */
    parallel(): this;

    /**
     * Readability marker. Sequential is the default, so this is a no-op.
     * Useful after .parallel() blocks for clarity.
     */
    then(): this;

    /**
     * Wait for a duration before the next step.
     * @param duration Delay in seconds.
     */
    delay(duration: number): this;

    /**
     * Call a function at this point in the tween sequence.
     */
    callback(fn: () => void): this;

    /**
     * Repeat the entire tween sequence.
     * @param count Number of additional plays. Infinity = loop forever.
     *   Default: Infinity.
     */
    repeat(count?: number): this;

    /**
     * Convenience: connect a handler to the completed signal.
     * Equivalent to `tween.completed.connect(fn)`.
     */
    onComplete(fn: () => void): this;

    // === Control ===

    /** Stop and remove this tween. */
    kill(): void;

    /** Pause this tween. */
    pause(): void;

    /** Resume a paused tween. */
    resume(): void;

    // === State ===

    readonly running: boolean;
    readonly paused: boolean;
    readonly elapsed: number;

    // === Signals ===

    /** Emitted when the tween finishes (after all repeats). */
    readonly completed: Signal<void> = signal<void>();

    /** Emitted at the start of each repeat iteration (payload = iteration index). */
    readonly looped: Signal<number> = signal<number>();
}

/**
 * Target property values for .to(). Supports:
 * - Numeric values: `{ rotation: 3.14, alpha: 0 }`
 * - Nested sub-properties: `{ position: { x: 100, y: 200 } }`
 * - Objects with lerp(): `{ tint: Color.RED }`
 */
export type TweenTarget = Record<string, number | Record<string, number> | Lerpable>;

/** Any object with a lerp method (Color, Vec2, etc.). */
export interface Lerpable {
    lerp(other: this, t: number): this;
}
```

**Design decisions:**

- **Sequential by default.** Consecutive `.to()` calls wait for the previous to finish. Use `.parallel()` to run alongside. This matches Godot 4's tween API and reads naturally top-to-bottom.

- **`.then()` is a no-op.** It exists for readability when mixing sequential and parallel steps. The API works identically with or without it.

- **`.repeat()` defaults to Infinity.** Calling `.repeat()` with no args means "loop forever" — the most common use case. `.repeat(2)` means "play 2 additional times" (3 total).

- **Tween is bound to a node.** Created via `node.tween()`, the tween auto-kills when the node is destroyed. This prevents dangling tweens animating dead nodes.

- **Tweens don't start until the next frame.** The builder pattern means the tween is being configured during the current frame. Actual playback begins on the next `postUpdate` signal. This avoids partial-frame issues where a tween starts mid-configuration.

### 2.2 Property Interpolation

The tween system interpolates properties on the target node. Three modes based on the value type:

**Mode 1: Numeric interpolation**
```typescript
// { rotation: Math.PI } → node.rotation = lerp(start, Math.PI, easedT)
node.tween().to({ rotation: Math.PI }, 0.5);
node.tween().to({ alpha: 0 }, 0.3);
```

**Mode 2: Sub-property interpolation (for mutable objects like Vec2)**
```typescript
// { position: { y: 100 } } → node.position.y = lerp(startY, 100, easedT)
node.tween().to({ position: { y: 100 } }, 0.3);
node.tween().to({ scale: { x: 2, y: 2 } }, 0.5);
```

Vec2's `y` setter triggers `_onChange`, which marks the node's transform as dirty. Sub-property interpolation works correctly with the dirty-flagging system.

**Mode 3: Object-level lerp (for immutable objects like Color)**
```typescript
// { tint: Color.RED } → node.tint = startTint.lerp(Color.RED, easedT)
node.tween().to({ tint: Color.RED }, 0.3);
```

When both the current value and target value have a `lerp` method, the tween uses whole-object interpolation and reassigns the result. This handles Color (immutable, has `lerp`) and also works with Vec2 if the user passes a full Vec2 target instead of sub-properties.

**Detection logic at tween start:**

```
For each property in .to() target:
  let endVal = targetValues[property]
  let startVal = target[property]

  if typeof endVal === 'number':
    → Mode 1: numeric interpolation

  else if endVal has a .lerp method:
    → Mode 3: object-level lerp (capture startVal, reassign each frame)

  else if typeof endVal === 'object':
    → Mode 2: sub-property interpolation (recurse into sub-keys)
```

**Start values are captured** when the tween step begins playing (not when `.to()` is called). This allows chained sequential tweens to pick up where the previous left off.

### 2.3 Easing Functions

**File:** `packages/tween/src/easing.ts`

All easing functions take `t` in `[0, 1]` and return a value (usually in `[0, 1]`, but elastic/back may overshoot).

```typescript
export const Ease = {
    // Linear
    linear: (t: number) => t,

    // Quadratic
    quadIn: (t: number) => t * t,
    quadOut: (t: number) => t * (2 - t),
    quadInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

    // Cubic
    cubicIn: (t: number) => t * t * t,
    cubicOut: (t: number) => (--t) * t * t + 1,
    cubicInOut: (t: number) =>
        t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

    // Sine
    sineIn: (t: number) => 1 - Math.cos(t * Math.PI / 2),
    sineOut: (t: number) => Math.sin(t * Math.PI / 2),
    sineInOut: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,

    // Exponential
    expoIn: (t: number) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
    expoOut: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),

    // Elastic
    elasticOut: (t: number) => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1
            : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },

    // Bounce
    bounceOut: (t: number) => {
        const n1 = 7.5625, d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },

    // Back (overshoots)
    backOut: (t: number) => {
        const c1 = 1.70158, c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
} as const;
```

**16 easing functions** cover the vast majority of game animation needs. Additional easings can be added later or users can pass custom `EasingFn` functions.

All easing functions are **pure** — no state, no randomness, deterministic.

### 2.4 TweenSystem (Internal)

The TweenSystem is the internal engine that tracks and updates all active tweens. It's not exported — users interact with Tween instances.

```typescript
/** @internal */
class TweenSystem {
    private tweens: Tween[] = [];

    /** Create a new tween targeting a node. */
    create(target: Node): Tween {
        const tween = new Tween(target, this);
        this.tweens.push(tween);
        return tween;
    }

    /** Advance all active tweens. Called from postUpdate signal. */
    update(dt: number): void {
        for (let i = this.tweens.length - 1; i >= 0; i--) {
            const tween = this.tweens[i];

            // Remove killed or orphaned tweens
            if (tween.isKilled || tween.target.isDestroyed) {
                this.tweens.splice(i, 1);
                continue;
            }

            if (tween.paused) continue;

            tween._tick(dt);

            // Remove completed tweens
            if (tween.isComplete) {
                this.tweens.splice(i, 1);
            }
        }
    }

    /** Kill all tweens targeting a specific node. */
    killTweensOf(node: Node): void {
        for (const t of this.tweens) {
            if (t.target === node) t.kill();
        }
    }

    /** Kill all active tweens. */
    killAll(): void {
        for (const t of this.tweens) t.kill();
        this.tweens.length = 0;
    }
}
```

**Internal Tween Model:**

A tween is a sequence of **groups**. Each group contains one or more **steps** that run in parallel. Groups execute sequentially.

```
Tween = [Group0, Group1, Group2, ...]
Group = [Step, Step, ...]  ← steps within a group run in parallel

Step types:
  - PropertyStep: interpolate target properties over duration with easing
  - DelayStep: wait for a duration
  - CallbackStep: call a function (instant)
```

**How `.parallel()` works:**

```typescript
node.tween()
    .to(A, 0.3)          // Group 0: [PropertyStep(A)]
    .to(B, 0.3)          // Group 1: [PropertyStep(B)]   ← sequential (new group)
    .parallel()
    .to(C, 0.3)          // Group 1: [PropertyStep(B), PropertyStep(C)]  ← parallel (same group)
    .delay(0.5)          // Group 2: [DelayStep(0.5)]
    .callback(fn)        // Group 3: [CallbackStep(fn)]
```

A group is complete when ALL its steps are complete. Then the next group begins.

### 2.5 TweenPlugin & Node Augmentation

**File:** `packages/tween/src/tween-plugin.ts`

```typescript
import { definePlugin, type Game } from "@quintus/core";

const systemMap = new WeakMap<Game, TweenSystem>();

export function getTweenSystem(game: Game): TweenSystem | null {
    return systemMap.get(game) ?? null;
}

export function TweenPlugin(): Plugin {
    return definePlugin({
        name: "tween",
        install(game: Game) {
            const system = new TweenSystem();
            systemMap.set(game, system);

            // Update all tweens after node logic, before rendering
            game.postUpdate.connect((dt) => system.update(dt));

            // Cleanup on game stop
            game.stopped.connect(() => {
                system.killAll();
                systemMap.delete(game);
            });
        },
    });
}
```

**File:** `packages/tween/src/augment.ts`

```typescript
import { Node } from "@quintus/core";
import { getTweenSystem } from "./tween-plugin.js";
import type { Tween } from "./tween.js";

// Runtime: add tween() method to Node.prototype
Object.defineProperty(Node.prototype, "tween", {
    value: function (this: Node): Tween {
        const game = this.game;
        if (!game) {
            throw new Error(
                "Cannot create tween: node is not in a scene tree.",
            );
        }
        const system = getTweenSystem(game);
        if (!system) {
            throw new Error(
                "TweenPlugin not installed. Call game.use(TweenPlugin()) before using node.tween().",
            );
        }
        return system.create(this);
    },
    configurable: true,
    writable: true,
});

// Runtime: add killTweens() method
Object.defineProperty(Node.prototype, "killTweens", {
    value: function (this: Node): void {
        const game = this.game;
        if (!game) return;
        const system = getTweenSystem(game);
        system?.killTweensOf(this);
    },
    configurable: true,
    writable: true,
});

// TypeScript: merge into Node's type
declare module "@quintus/core" {
    interface Node {
        /** Create a new tween targeting this node. Requires TweenPlugin. */
        tween(): Tween;
        /** Kill all active tweens on this node. */
        killTweens(): void;
    }
}
```

### 2.6 File Structure

```
packages/tween/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts            # Exports + side-effect import of augment
    ├── tween.ts            # Tween class (builder + playback)
    ├── tween-system.ts     # TweenSystem (internal manager)
    ├── tween-plugin.ts     # TweenPlugin + WeakMap + getTweenSystem
    ├── augment.ts          # Node.prototype.tween() + module augmentation
    ├── easing.ts           # Ease.* functions
    │
    ├── tween.test.ts       # Tween: builder, playback, kill, repeat
    ├── easing.test.ts      # Easing: all functions produce expected curves
    └── integration.test.ts # Tween + Game + Node: end-to-end
```

Size budget: **~3KB gzipped**. Dependencies: `@quintus/core`, `@quintus/math`.

---

## 3. Package: `@quintus/audio`

Size budget: **~3KB gzipped**

Dependencies: `@quintus/core`

### 3.1 AudioSystem

The centralized audio manager exposed as `game.audio`. Provides both a fire-and-forget API for quick sound effects and access to audio configuration.

```typescript
import { type Signal, signal } from "@quintus/core";

export interface PlayOptions {
    /** Volume (0–1). Default: 1. */
    volume?: number;
    /** Loop the sound. Default: false. */
    loop?: boolean;
    /** Audio bus category. Default: "sfx". */
    bus?: "music" | "sfx" | "ui";
    /** Playback rate. Default: 1. */
    rate?: number;
}

export interface AudioHandle {
    /** Stop this specific playback. */
    stop(): void;
    /** Whether this playback is still active. */
    readonly playing: boolean;
}

export class AudioSystem {
    // === Quick Play API ===

    /**
     * Play a sound effect by asset name. Fire-and-forget.
     *
     * @param name Asset name (loaded via game.assets.load({ audio: [...] })).
     * @param options Volume, loop, bus, rate.
     * @returns A handle to stop the playback.
     *
     * @example
     * ```typescript
     * this.game.audio.play("jump");
     * this.game.audio.play("coin", { volume: 0.5 });
     * ```
     */
    play(name: string, options?: PlayOptions): AudioHandle;

    /**
     * Stop all currently playing sounds.
     */
    stopAll(): void;

    // === Volume Control ===

    /** Master volume (0–1). Affects all audio. Default: 1. */
    masterVolume: number;

    /**
     * Set volume for a specific bus category.
     * @param bus Bus name: "music", "sfx", or "ui".
     * @param volume Volume (0–1).
     */
    setBusVolume(bus: string, volume: number): void;

    /**
     * Get volume for a specific bus category.
     */
    getBusVolume(bus: string): number;

    // === State ===

    /**
     * Whether the audio system is ready (AudioContext resumed after user interaction).
     * Before this is true, play() calls are queued and execute on first interaction.
     */
    readonly ready: boolean;

    /** Emitted when the audio system becomes ready after the autoplay gate. */
    readonly onReady: Signal<void> = signal<void>();

    // === Internal ===

    /** @internal The Web Audio API AudioContext. null in headless mode. */
    readonly context: AudioContext | null;
}
```

**Design decisions:**

- **Two-tier API.** `game.audio.play("jump")` covers 80% of game audio needs (one-shot sound effects). For music, looping, and advanced control, use `AudioPlayer` node (§3.2). No need for a node just to play a jump sound.

- **AudioHandle for optional control.** `play()` returns a lightweight handle so the caller can stop the sound if needed. Most callers will ignore the return value.

- **Three default buses: "music", "sfx", "ui".** Each has an independent volume that multiplies with `masterVolume`. Effective volume = `masterVolume × busVolume × playVolume`. Implemented via Web Audio API GainNodes in a simple routing graph.

### 3.2 AudioPlayer Node

For music, looping audio, and advanced control, `AudioPlayer` is a full scene tree node. It extends `Node` (not `Node2D`) — audio has no visual position or transform.

```typescript
import { Node, type Signal, signal } from "@quintus/core";

export class AudioPlayer extends Node {
    /** Asset name of the audio file to play. */
    stream = "";

    /** Volume (0–1). Default: 1. */
    volume = 1;

    /** Loop playback. Default: false. */
    loop = false;

    /** Start playing when the node enters the tree. Default: false. */
    autoplay = false;

    /** Audio bus category. Default: "music". */
    bus: "music" | "sfx" | "ui" = "music";

    /** Playback rate. Default: 1. */
    rate = 1;

    // === Control ===

    play(): void;
    stop(): void;
    pause(): void;
    resume(): void;

    // === State ===

    readonly playing: boolean;
    readonly paused: boolean;

    /** Current playback position in seconds. */
    readonly currentTime: number;

    /** Total duration in seconds. */
    readonly duration: number;

    // === Signals ===

    /** Emitted when playback finishes (non-looping) or is stopped. */
    readonly finished: Signal<void> = signal<void>();

    // === Lifecycle ===

    onReady(): void {
        if (this.autoplay) this.play();
    }

    onDestroy(): void {
        this.stop();
    }
}
```

**Design decisions:**

- **Extends Node, not Node2D.** Audio playback has no visual representation. No position, rotation, or rendering. The AudioPlayer participates in the scene tree for lifecycle management (auto-stop on destroy, auto-play on ready) but has no spatial meaning.

- **`bus` defaults to "music".** AudioPlayer is primarily used for background music and ambient audio. Sound effects use the quick `game.audio.play()` API instead.

- **Auto-stop on destroy.** When an AudioPlayer is destroyed (scene switch, explicit destroy), its playback stops automatically. No dangling audio after scene transitions.

- **Spatial audio deferred.** Positional/3D audio is not included in Phase 5. It would require `AudioPlayer` to extend `Node2D` and use Web Audio API panner nodes. This can be added in Phase 10 alongside Three.js, or as a separate `SpatialAudioPlayer` node.

### 3.3 Audio Bus

The bus system is a simple volume routing graph implemented with Web Audio API GainNodes.

```
                        ┌─ sfxGain ──────┐
AudioBufferSource ─────►│                 ├──► masterGain ──► destination
                        ├─ musicGain ────┤
                        ├─ uiGain ───────┘
                        └─────────────────
```

**Implementation:**

```typescript
class AudioBus {
    private master: GainNode;
    private buses: Map<string, GainNode>;

    constructor(context: AudioContext) {
        this.master = context.createGain();
        this.master.connect(context.destination);

        this.buses = new Map();
        for (const name of ["music", "sfx", "ui"]) {
            const gain = context.createGain();
            gain.connect(this.master);
            this.buses.set(name, gain);
        }
    }

    getOutput(bus: string): GainNode {
        return this.buses.get(bus) ?? this.buses.get("sfx")!;
    }

    setVolume(bus: string, volume: number): void {
        const node = this.buses.get(bus);
        if (node) node.gain.value = clamp(volume, 0, 1);
    }

    set masterVolume(v: number) {
        this.master.gain.value = clamp(v, 0, 1);
    }
}
```

**Custom buses:** For MVP, only three buses (music, sfx, ui). Custom bus creation can be added later. If a play call specifies an unknown bus, it falls back to "sfx".

### 3.4 Autoplay Gate

Browsers block audio playback until the user interacts with the page. The AudioPlugin handles this automatically.

```typescript
class AutoplayGate {
    private _ready = false;
    private _queue: Array<() => void> = [];
    readonly onReady: Signal<void> = signal<void>();

    constructor(private context: AudioContext, canvas: HTMLCanvasElement) {
        if (context.state === "running") {
            this._ready = true;
        } else {
            const resume = () => {
                context.resume().then(() => {
                    this._ready = true;
                    this.onReady.emit();
                    // Flush queued play commands
                    for (const fn of this._queue) fn();
                    this._queue.length = 0;
                });
                // Clean up listeners
                for (const event of events) {
                    canvas.removeEventListener(event, resume);
                    document.removeEventListener(event, resume);
                }
            };

            const events = ["pointerdown", "keydown", "touchstart"] as const;
            for (const event of events) {
                canvas.addEventListener(event, resume, { once: true });
                document.addEventListener(event, resume, { once: true });
            }
        }
    }

    get ready(): boolean { return this._ready; }

    /**
     * Execute a function now if ready, or queue it for when the gate opens.
     */
    whenReady(fn: () => void): void {
        if (this._ready) fn();
        else this._queue.push(fn);
    }
}
```

**Design decisions:**

- **Listen on both canvas and document.** Some browsers require the interaction to be on the specific element, others accept any document interaction. Listening on both covers all browsers.

- **Queue play commands.** If `game.audio.play("music")` is called before user interaction (e.g., in `onReady()`), the command is queued and executes automatically when the gate opens. This is transparent to game code — no special handling needed.

- **`{ once: true }`** on event listeners ensures cleanup after the first interaction.

### 3.5 AudioPlugin

```typescript
import { definePlugin, type Game } from "@quintus/core";

const audioMap = new WeakMap<Game, AudioSystem>();

export function getAudio(game: Game): AudioSystem | null {
    return audioMap.get(game) ?? null;
}

export function AudioPlugin(): Plugin {
    return definePlugin({
        name: "audio",
        install(game: Game) {
            // Create AudioContext (or null for headless)
            let context: AudioContext | null = null;
            try {
                context = new AudioContext();
            } catch {
                // Headless or unsupported environment — use no-op system
            }

            const system = new AudioSystem(context, game);
            audioMap.set(game, system);

            // Register audio asset loader
            if (context) {
                game.assets.registerLoader("audio", async (name, path) => {
                    const response = await fetch(path);
                    const buffer = await response.arrayBuffer();
                    return await context!.decodeAudioData(buffer);
                });
            } else {
                // Headless: no-op loader stores null for each audio asset
                game.assets.registerLoader("audio", async () => null);
            }

            // Cleanup on game stop
            game.stopped.connect(() => {
                system.stopAll();
                context?.close();
                audioMap.delete(game);
            });
        },
    });
}
```

**File:** `packages/audio/src/augment.ts`

```typescript
import { Game } from "@quintus/core";
import type { AudioSystem } from "./audio-system.js";
import { getAudio } from "./audio-plugin.js";

Object.defineProperty(Game.prototype, "audio", {
    get(this: Game): AudioSystem {
        const audio = getAudio(this);
        if (!audio) {
            throw new Error(
                "AudioPlugin not installed. Call game.use(AudioPlugin()) before accessing game.audio.",
            );
        }
        return audio;
    },
    configurable: true,
});

declare module "@quintus/core" {
    interface Game {
        /** Audio system. Requires AudioPlugin to be installed. */
        get audio(): AudioSystem;
    }
}
```

### 3.6 File Structure

```
packages/audio/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts             # Exports + side-effect import of augment
    ├── audio-system.ts      # AudioSystem class (play, volume, stopAll)
    ├── audio-player.ts      # AudioPlayer node
    ├── audio-bus.ts         # AudioBus (GainNode routing)
    ├── autoplay-gate.ts     # AutoplayGate (browser interaction handling)
    ├── audio-plugin.ts      # AudioPlugin + WeakMap + getAudio
    ├── augment.ts           # Game.prototype.audio + module augmentation
    │
    ├── audio-system.test.ts # AudioSystem: play, stop, volume, bus routing
    ├── audio-player.test.ts # AudioPlayer: lifecycle, autoplay, stop on destroy
    └── audio-bus.test.ts    # AudioBus: volume routing, fallback
```

Size budget: **~3KB gzipped**. Dependencies: `@quintus/core`.

**Note on testing:** Web Audio API is not available in jsdom. Tests will mock `AudioContext` and `AudioBuffer` to verify correct API calls, state management, and signal emission without actual audio playback.

---

## 4. Package: `@quintus/ui`

Size budget: **~5KB gzipped**

Dependencies: `@quintus/core`, `@quintus/math`

Optional peer dependency: `@quintus/input` (for InputReceiver-style keyboard focus on buttons; not required for pointer/mouse interaction)

### 4.1 UINode Base Class

Base class for all UI widgets. Extends `Node2D` with screen-space rendering, sizing, and pointer event infrastructure.

```typescript
import { Node2D, type DrawContext } from "@quintus/core";
import { Vec2 } from "@quintus/math";

export class UINode extends Node2D {
    /** Widget width in pixels. */
    width = 0;

    /** Widget height in pixels. */
    height = 0;

    /** Whether this widget receives pointer events. Default: true. */
    interactive = true;

    constructor() {
        super();
        // UI nodes render in screen space by default
        this.renderFixed = true;
    }

    /** Get the size as a Vec2. */
    get size(): Vec2 {
        return new Vec2(this.width, this.height);
    }

    /** Set the size from a Vec2. */
    set size(v: Vec2) {
        this.width = v.x;
        this.height = v.y;
    }

    /**
     * Test if a screen-space point is inside this widget's bounds.
     * @param screenX X coordinate in screen pixels.
     * @param screenY Y coordinate in screen pixels.
     */
    containsPoint(screenX: number, screenY: number): boolean {
        const gp = this.globalPosition;
        return (
            screenX >= gp.x &&
            screenX <= gp.x + this.width &&
            screenY >= gp.y &&
            screenY <= gp.y + this.height
        );
    }

    // === Pointer Event Hooks (override in subclasses) ===
    /** @internal */ _onPointerDown(_x: number, _y: number): void {}
    /** @internal */ _onPointerUp(_x: number, _y: number): void {}
    /** @internal */ _onPointerMove(_x: number, _y: number): void {}
    /** @internal */ _onPointerEnter(): void {}
    /** @internal */ _onPointerExit(): void {}
}
```

**Design decisions:**

- **`renderFixed = true` by default.** UI elements render in screen space. Users who want world-space UI (health bars above enemies) should use Node2D directly with `onDraw()`, not UINode.

- **`width`/`height` instead of inherited size.** Node2D doesn't have size — it has transform (position, rotation, scale). UI widgets need explicit dimensions for layout, hit-testing, and rendering. These are separate from `scale`.

- **`containsPoint` uses globalPosition.** For fixed UI, globalPosition is in screen space (since renderFixed skips viewTransform). The hit test is a simple AABB check: point inside `[globalPosition, globalPosition + size]`.

### 4.2 Pointer Event Handling

Centralized pointer dispatch for all UINodes. Uses a WeakMap keyed by Game to support multiple game instances.

```typescript
const pointerState = new WeakMap<Game, PointerDispatcher>();

class PointerDispatcher {
    private nodes = new Set<UINode>();
    private hovered: UINode | null = null;
    private cleanup: (() => void) | null = null;

    register(node: UINode, game: Game): void {
        this.nodes.add(node);
        if (!this.cleanup) {
            this._setupListeners(game);
        }
    }

    unregister(node: UINode): void {
        this.nodes.delete(node);
        if (this.hovered === node) this.hovered = null;
        if (this.nodes.size === 0) {
            this.cleanup?.();
            this.cleanup = null;
        }
    }

    private _setupListeners(game: Game): void {
        const canvas = game.canvas;

        const toLocal = (e: PointerEvent): { x: number; y: number } => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (e.clientX - rect.left) * (game.width / rect.width),
                y: (e.clientY - rect.top) * (game.height / rect.height),
            };
        };

        const findTarget = (x: number, y: number): UINode | null => {
            // Walk in reverse z-order (highest zIndex first = topmost)
            let best: UINode | null = null;
            let bestZ = -Infinity;
            for (const node of this.nodes) {
                if (!node.interactive || !node.visible) continue;
                if (node.zIndex >= bestZ && node.containsPoint(x, y)) {
                    best = node;
                    bestZ = node.zIndex;
                }
            }
            return best;
        };

        const onDown = (e: PointerEvent) => {
            const { x, y } = toLocal(e);
            findTarget(x, y)?._onPointerDown(x, y);
        };

        const onUp = (e: PointerEvent) => {
            const { x, y } = toLocal(e);
            findTarget(x, y)?._onPointerUp(x, y);
        };

        const onMove = (e: PointerEvent) => {
            const { x, y } = toLocal(e);
            const target = findTarget(x, y);

            // Hover enter/exit
            if (target !== this.hovered) {
                this.hovered?._onPointerExit();
                target?._onPointerEnter();
                this.hovered = target;
            }
            target?._onPointerMove(x, y);
        };

        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointerup", onUp);
        canvas.addEventListener("pointermove", onMove);

        this.cleanup = () => {
            canvas.removeEventListener("pointerdown", onDown);
            canvas.removeEventListener("pointerup", onUp);
            canvas.removeEventListener("pointermove", onMove);
        };
    }
}
```

UINode hooks into this in its lifecycle:

```typescript
// In UINode
onEnterTree(): void {
    const game = this.game;
    if (game) {
        let dispatcher = pointerState.get(game);
        if (!dispatcher) {
            dispatcher = new PointerDispatcher();
            pointerState.set(game, dispatcher);
        }
        dispatcher.register(this, game);
    }
}

onExitTree(): void {
    const game = this.game;
    if (game) {
        pointerState.get(game)?.unregister(this);
    }
}
```

**Design decisions:**

- **Centralized dispatch, not per-widget listeners.** One set of canvas event listeners handles all UINodes. This is efficient (3 listeners total, not 3 per widget) and enables proper z-order dispatch (topmost widget receives events first).

- **Coordinate conversion.** Screen coordinates are computed by mapping the pointer position from the canvas's CSS layout to the game's logical resolution. This handles CSS scaling (`scale: "fit"`) correctly.

- **Topmost-first dispatch.** Only the highest-zIndex widget under the pointer receives the event. No event bubbling — if a button is on top of a panel, only the button fires.

- **No UIPlugin required.** The PointerDispatcher is lazily created when the first UINode enters the tree. No explicit `game.use()` call needed. This keeps UI simple — just add UINode children to your scene.

### 4.3 Label

Text rendering widget.

```typescript
import { type Signal, signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { UINode } from "./ui-node.js";

export interface ShadowStyle {
    offset: Vec2;
    color: Color;
}

export class Label extends UINode {
    /** Text content. */
    text = "";

    /** Font family. Default: "sans-serif". */
    font = "sans-serif";

    /** Font size in pixels. Default: 16. */
    fontSize = 16;

    /** Text color. Default: white. */
    color: Color = Color.WHITE;

    /** Text alignment within the label bounds. Default: "left". */
    align: "left" | "center" | "right" = "left";

    /** Vertical alignment. Default: "top". */
    baseline: "top" | "middle" | "bottom" = "top";

    /** Optional text shadow. */
    shadow: ShadowStyle | null = null;

    // Non-interactive by default (it's just text)
    interactive = false;

    onDraw(ctx: DrawContext): void {
        if (!this.text) return;

        // Shadow
        if (this.shadow) {
            ctx.text(this.text, this.shadow.offset, {
                font: this.font,
                size: this.fontSize,
                color: this.shadow.color,
                align: this.align,
                baseline: this.baseline,
            });
        }

        // Main text
        ctx.text(this.text, Vec2.ZERO, {
            font: this.font,
            size: this.fontSize,
            color: this.color,
            align: this.align,
            baseline: this.baseline,
        });
    }
}
```

### 4.4 Button

Clickable widget with hover/pressed visual states.

```typescript
import { type Signal, signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { UINode } from "./ui-node.js";

export class Button extends UINode {
    /** Button label text. */
    text = "";

    /** Font family. Default: "sans-serif". */
    font = "sans-serif";

    /** Font size in pixels. Default: 16. */
    fontSize = 16;

    /** Text color. Default: white. */
    textColor: Color = Color.WHITE;

    /** Background color (normal state). Default: dark gray. */
    backgroundColor: Color = Color.fromHex("#333333");

    /** Background color on hover. Default: medium gray. */
    hoverColor: Color = Color.fromHex("#555555");

    /** Background color when pressed. Default: dark. */
    pressedColor: Color = Color.fromHex("#222222");

    /** Border color. null = no border. */
    borderColor: Color | null = null;

    /** Border width in pixels. Default: 0. */
    borderWidth = 0;

    /** Corner radius for rounded buttons. Default: 0. */
    cornerRadius = 0;

    /** Padding inside the button. Default: 8. */
    padding = 8;

    // === State ===
    private _hovered = false;
    private _pressed = false;

    get hovered(): boolean { return this._hovered; }
    get pressed(): boolean { return this._pressed; }

    // === Signals ===

    /** Emitted when the button is clicked (pointer down + up within bounds). */
    readonly onPressed: Signal<void> = signal<void>();

    /** Emitted when hover state changes. */
    readonly onHoverChanged: Signal<boolean> = signal<boolean>();

    // === Pointer Handlers ===

    _onPointerDown(): void {
        this._pressed = true;
    }

    _onPointerUp(x: number, y: number): void {
        if (this._pressed && this.containsPoint(x, y)) {
            this.onPressed.emit();
        }
        this._pressed = false;
    }

    _onPointerEnter(): void {
        this._hovered = true;
        this.onHoverChanged.emit(true);
    }

    _onPointerExit(): void {
        this._hovered = false;
        this._pressed = false;
        this.onHoverChanged.emit(false);
    }

    // === Rendering ===

    onDraw(ctx: DrawContext): void {
        // Background
        const bgColor = this._pressed
            ? this.pressedColor
            : this._hovered
                ? this.hoverColor
                : this.backgroundColor;

        ctx.rect(Vec2.ZERO, this.size, { fill: bgColor });

        // Border
        if (this.borderColor && this.borderWidth > 0) {
            ctx.rect(Vec2.ZERO, this.size, {
                stroke: this.borderColor,
                strokeWidth: this.borderWidth,
            });
        }

        // Text (centered in button)
        if (this.text) {
            const textPos = new Vec2(this.width / 2, this.height / 2);
            ctx.text(this.text, textPos, {
                font: this.font,
                size: this.fontSize,
                color: this.textColor,
                align: "center",
                baseline: "middle",
            });
        }
    }
}
```

**Design decision — click = down + up within bounds.** A button fires `onPressed` only when the pointer goes down AND comes back up within the button's bounds. If the user presses down on the button but drags away before releasing, the click doesn't fire. This is standard button behavior across all UI frameworks.

### 4.5 ProgressBar

Fillable bar for health, loading, XP, etc.

```typescript
import { type Signal, signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { UINode } from "./ui-node.js";

export class ProgressBar extends UINode {
    /** Current value (clamped to 0–maxValue). Default: 0. */
    private _value = 0;

    /** Maximum value. Default: 100. */
    maxValue = 100;

    /** Fill color. Default: green. */
    fillColor: Color = Color.fromHex("#4caf50");

    /** Background color (empty portion). Default: dark gray. */
    backgroundColor: Color = Color.fromHex("#333333");

    /** Border color. null = no border. */
    borderColor: Color | null = null;

    /** Border width. Default: 0. */
    borderWidth = 0;

    /** Fill direction. Default: "left-to-right". */
    direction: "left-to-right" | "right-to-left" | "bottom-to-top" | "top-to-bottom" =
        "left-to-right";

    // Non-interactive by default
    interactive = false;

    // === Signals ===

    /** Emitted when the value changes. Payload is the new value. */
    readonly valueChanged: Signal<number> = signal<number>();

    // === Value ===

    get value(): number {
        return this._value;
    }

    set value(v: number) {
        const clamped = Math.max(0, Math.min(v, this.maxValue));
        if (clamped === this._value) return;
        this._value = clamped;
        this.valueChanged.emit(clamped);
    }

    /** Value as a 0–1 ratio. */
    get ratio(): number {
        return this.maxValue > 0 ? this._value / this.maxValue : 0;
    }

    // === Rendering ===

    onDraw(ctx: DrawContext): void {
        // Background
        ctx.rect(Vec2.ZERO, this.size, { fill: this.backgroundColor });

        // Fill
        const r = this.ratio;
        if (r > 0) {
            let fillPos: Vec2;
            let fillSize: Vec2;

            switch (this.direction) {
                case "left-to-right":
                    fillPos = Vec2.ZERO;
                    fillSize = new Vec2(this.width * r, this.height);
                    break;
                case "right-to-left":
                    fillPos = new Vec2(this.width * (1 - r), 0);
                    fillSize = new Vec2(this.width * r, this.height);
                    break;
                case "bottom-to-top":
                    fillPos = new Vec2(0, this.height * (1 - r));
                    fillSize = new Vec2(this.width, this.height * r);
                    break;
                case "top-to-bottom":
                    fillPos = Vec2.ZERO;
                    fillSize = new Vec2(this.width, this.height * r);
                    break;
            }

            ctx.rect(fillPos, fillSize, { fill: this.fillColor });
        }

        // Border
        if (this.borderColor && this.borderWidth > 0) {
            ctx.rect(Vec2.ZERO, this.size, {
                stroke: this.borderColor,
                strokeWidth: this.borderWidth,
            });
        }
    }
}
```

### 4.6 Panel

Background panel for grouping UI elements.

```typescript
import { Color, Vec2 } from "@quintus/math";
import { UINode } from "./ui-node.js";
import type { DrawContext } from "@quintus/core";

export class Panel extends UINode {
    /** Background color. Default: semi-transparent black. */
    backgroundColor: Color = Color.fromHex("#000000").withAlpha(0.7);

    /** Border color. null = no border. */
    borderColor: Color | null = null;

    /** Border width. Default: 0. */
    borderWidth = 0;

    // Non-interactive by default (children may be interactive)
    interactive = false;

    onDraw(ctx: DrawContext): void {
        ctx.rect(Vec2.ZERO, this.size, { fill: this.backgroundColor });

        if (this.borderColor && this.borderWidth > 0) {
            ctx.rect(Vec2.ZERO, this.size, {
                stroke: this.borderColor,
                strokeWidth: this.borderWidth,
            });
        }
    }
}
```

### 4.7 Container

Layout container that auto-positions children in a stack (vertical or horizontal).

```typescript
import { Vec2 } from "@quintus/math";
import { UINode } from "./ui-node.js";

export class Container extends UINode {
    /** Stack direction. Default: "vertical". */
    direction: "vertical" | "horizontal" = "vertical";

    /** Gap between children in pixels. Default: 4. */
    gap = 4;

    /** Padding inside the container. Default: 0. */
    padding = 0;

    /** Alignment of children within the container. Default: "start". */
    align: "start" | "center" | "end" = "start";

    // Non-interactive (children may be interactive)
    interactive = false;

    /**
     * Re-layout all UINode children. Called automatically on update.
     */
    layout(): void {
        let offset = this.padding;

        for (const child of this.children) {
            if (!(child instanceof UINode)) continue;
            if (!child.visible) continue;

            if (this.direction === "vertical") {
                // Position child vertically
                let x = this.padding;
                if (this.align === "center") {
                    x = (this.width - child.width) / 2;
                } else if (this.align === "end") {
                    x = this.width - child.width - this.padding;
                }
                child.position.x = x;
                child.position.y = offset;
                offset += child.height + this.gap;
            } else {
                // Position child horizontally
                let y = this.padding;
                if (this.align === "center") {
                    y = (this.height - child.height) / 2;
                } else if (this.align === "end") {
                    y = this.height - child.height - this.padding;
                }
                child.position.x = offset;
                child.position.y = y;
                offset += child.width + this.gap;
            }
        }
    }

    onUpdate(_dt: number): void {
        this.layout();
    }
}
```

**Design decisions:**

- **Simple stacking, not flexbox.** Container does one thing: stack children vertically or horizontally with a gap. This covers HUDs, menus, and simple layouts. Complex CSS-like layout is out of scope for Phase 5.

- **Auto-layout on update.** Container re-positions children every frame. This is slightly wasteful but ensures layout stays correct when children change size or visibility. For a typical HUD with 5-10 widgets, the cost is negligible.

- **Children must be UINode.** Non-UINode children (e.g., plain Node2D) are skipped during layout. They can still be children of the Container but won't be auto-positioned.

### 4.8 Layer

A grouping node that controls rendering behavior for its children. Used for fixed HUD layers and (future) parallax backgrounds.

```typescript
import { Node2D } from "@quintus/core";

export class Layer extends Node2D {
    /**
     * When true, this layer and all children render in screen space
     * (ignore camera viewTransform). Used for HUD/UI layers.
     */
    get fixed(): boolean {
        return this.renderFixed;
    }

    set fixed(v: boolean) {
        this.renderFixed = v;
        // Propagate to existing children
        this._propagateRenderFixed(v);
    }

    override addChild(node: Node): this;
    override addChild<T extends Node>(NodeClass: NodeConstructor<T>): T;
    override addChild(nodeOrClass: Node | NodeConstructor<Node>): Node | this {
        const result = super.addChild(nodeOrClass as Node);
        // Propagate renderFixed to new child
        const child = typeof nodeOrClass === "function" ? result : nodeOrClass;
        if (child instanceof Node2D) {
            this._propagateRenderFixed(this.renderFixed);
        }
        return result;
    }

    private _propagateRenderFixed(value: boolean): void {
        for (const child of this.children) {
            if (child instanceof Node2D) {
                child.renderFixed = value;
                // Recurse for nested layers
                if (child instanceof Layer) continue; // Nested layers manage their own
                this._propagateRenderFixedRecursive(child, value);
            }
        }
    }

    private _propagateRenderFixedRecursive(node: Node2D, value: boolean): void {
        for (const child of node.children) {
            if (child instanceof Node2D) {
                child.renderFixed = value;
                if (!(child instanceof Layer)) {
                    this._propagateRenderFixedRecursive(child, value);
                }
            }
        }
    }
}
```

**Usage:**

```typescript
class HUDScene extends Scene {
    onReady() {
        // World-space content (affected by camera)
        const player = this.add(Player);
        const camera = this.add(Camera);

        // Fixed HUD layer (screen space)
        const hud = this.add(Layer);
        hud.fixed = true;
        hud.zIndex = 100;

        const healthBar = hud.addChild(ProgressBar);
        healthBar.position.x = 10;
        healthBar.position.y = 10;
        healthBar.width = 100;
        healthBar.height = 12;
    }
}
```

**Design decisions:**

- **Layer is a thin wrapper.** It's just a Node2D that propagates `renderFixed` to children. Minimal code, clear purpose.

- **Nested Layer stops propagation.** If a Layer is nested inside another Layer, the inner Layer manages its own `renderFixed`. This allows a fixed HUD layer containing a world-space mini-map layer.

- **Parallax deferred.** The `parallax` feature (Layer scrolls at a fraction of camera speed) is not included in Phase 5. It requires modifying the renderer to apply a per-layer viewTransform, which is more complex. Deferred to Phase 12 polish.

### 4.9 File Structure

```
packages/ui/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts              # Public exports
    ├── ui-node.ts            # UINode base class
    ├── pointer-dispatch.ts   # PointerDispatcher (centralized pointer events)
    ├── label.ts              # Label widget
    ├── button.ts             # Button widget
    ├── progress-bar.ts       # ProgressBar widget
    ├── panel.ts              # Panel widget
    ├── container.ts          # Container layout widget
    ├── layer.ts              # Layer node
    │
    ├── ui-node.test.ts       # UINode: containsPoint, renderFixed, size
    ├── label.test.ts         # Label: text rendering, shadow, alignment
    ├── button.test.ts        # Button: click detection, hover/pressed states, signals
    ├── progress-bar.test.ts  # ProgressBar: value clamping, ratio, direction, signal
    ├── container.test.ts     # Container: layout, gap, padding, alignment, direction
    ├── layer.test.ts         # Layer: renderFixed propagation, nested layers
    └── integration.test.ts   # Full UI: HUD with multiple widgets
```

Size budget: **~5KB gzipped**. Dependencies: `@quintus/core`, `@quintus/math`.

---

## 5. Cross-Cutting Concerns

### 5.1 Dependency Direction

```
@quintus/math       (no dependencies)
     ↑
@quintus/core       (depends on math)
     ↑
     ├── @quintus/tween   (depends on core, math)
     ├── @quintus/audio   (depends on core)
     └── @quintus/ui      (depends on core, math)
```

- No Phase 5 package depends on any other Phase 5 package. Tween, Audio, and UI are fully independent.
- No Phase 5 package depends on `@quintus/physics`, `@quintus/sprites`, `@quintus/input`, `@quintus/tilemap`, or `@quintus/camera`.
- The tween package works with any Node property. It doesn't need to know about Sprite, Actor, or any specific node type.
- Audio is self-contained — it manages Web Audio API internally.
- UI depends only on core (for Node2D, DrawContext, signals) and math (for Vec2, Color).

### 5.2 Performance

**Tween system:**
- TweenSystem iterates all active tweens once per frame. For a typical game with 10–30 active tweens, this is ~30 property reads + writes. Negligible.
- Property interpolation uses direct assignment (`target[key] = value`), not Object.defineProperty or Proxy. Zero overhead beyond the assignment itself.
- Start values are captured once per tween step, not re-read each frame.

**Audio system:**
- Web Audio API handles all mixing natively — no per-frame JavaScript processing.
- `play()` creates an AudioBufferSourceNode, connects it to the appropriate bus GainNode, and starts it. The browser handles playback on a separate thread.
- Fire-and-forget sounds self-clean via the `onended` event on AudioBufferSourceNode.

**UI rendering:**
- UI widgets draw 1–3 shapes each (background, fill, text). A full HUD with 10 widgets adds ~30 draw calls — negligible alongside game content.
- Container layout runs once per frame but only iterates direct UINode children. For 5–10 children, this is ~20 Vec2 assignments.
- PointerDispatcher iterates all UINodes on pointer events (not every frame). For 10 widgets, this is ~10 AABB checks per click. Negligible.

**Allocation targets:**
- Tween: Zero per-frame allocations during steady-state playback (start values pre-captured, no intermediate objects).
- Audio: Zero per-frame allocations (Web Audio API nodes persist for playback duration).
- UI: Container.layout creates Vec2 temporaries for positioning. Could be optimized to mutate in-place, but for <20 children the GC pressure is negligible.

### 5.3 Determinism

- **Tween interpolation is deterministic.** Easing functions are pure math. Given the same `dt` sequence, tweens produce identical results.
- **Tweens update in `postUpdate` (variable dt).** This means tween progress depends on frame timing, NOT the fixed timestep. For visual animations, this is correct — tweens look smooth at any frame rate. For gameplay-critical animations, users should use `onFixedUpdate` with manual interpolation instead.
- **Audio playback is non-deterministic.** Sound timing depends on the audio thread, browser scheduling, and the autoplay gate. Audio tests verify state and API calls, not timing.
- **Audio in headless mode.** When `AudioContext` is unavailable, AudioSystem uses a no-op implementation. All methods work (return handles, track state) but produce no sound. This allows headless game tests to exercise audio code paths.
- **UI pointer events are non-deterministic** (depend on user interaction). UI tests use simulated pointer events dispatched programmatically.

### 5.4 Error Handling

**Tween:**
- `node.tween()` on a node not in a scene tree: throws `"Cannot create tween: node is not in a scene tree."`
- `node.tween()` without TweenPlugin: throws `"TweenPlugin not installed. Call game.use(TweenPlugin()) before using node.tween()."`
- `.to()` targeting a non-existent property: silently skips (property would be `undefined`). No error — this allows tweening optional properties.
- `.to()` with duration ≤ 0: instant snap to target values (no interpolation).

**Audio:**
- `game.audio.play("missing")` with unloaded asset: warns `"Audio asset 'missing' not found. Load it via game.assets.load({ audio: ['missing.ogg'] })."` and returns a no-op handle. Does NOT throw — missing audio should never crash a game.
- `AudioPlugin` in headless environment (no AudioContext): silently uses no-op implementation. Logs once: `"AudioContext not available. Audio will be silent."`
- `AudioPlayer.stream` set to empty string: no-op on play(). No error.

**UI:**
- Button without width/height: renders as 0×0 (invisible, no clicks). No error.
- Container with no UINode children: no-op layout. Non-UINode children are skipped silently.
- Pointer events on a destroyed UINode: dispatcher skips destroyed nodes automatically.

---

## 6. Test Plan

### @quintus/tween Tests

| Category | Tests | Details |
|----------|-------|---------|
| **Builder API** | Sequential steps | Two `.to()` calls: second starts after first completes |
| | Parallel steps | `.parallel().to()`: both steps run simultaneously |
| | Delay | `.delay(0.5)`: no property change during delay |
| | Callback | `.callback(fn)`: function called at correct point in sequence |
| | Mixed chain | Sequential + parallel + delay + callback in one tween |
| **Property interpolation** | Numeric | `{ rotation: Math.PI }`: interpolates from start to end |
| | Vec2 sub-property | `{ position: { y: 100 } }`: only y changes, x unchanged |
| | Vec2 full object | `{ position: new Vec2(100, 200) }`: uses Vec2.lerp |
| | Color (lerp) | `{ tint: Color.RED }`: uses Color.lerp for whole-object interpolation |
| | Multiple properties | `{ alpha: 0, rotation: 3 }`: both interpolate correctly |
| **Easing** | All easing functions | Correct values at t=0, t=0.5, t=1 |
| | Boundary conditions | easing(0) = 0, easing(1) = 1 (for non-overshoot easings) |
| | Custom easing | User-provided easing function works |
| **Control** | Kill | `tween.kill()` stops immediately, no more updates |
| | Pause/resume | Paused tween doesn't advance, resumes from correct position |
| | Node destroy kills tweens | Tween auto-killed when target node is destroyed |
| **Repeat** | Fixed count | `.repeat(2)`: plays 3 times total |
| | Infinite | `.repeat()`: keeps playing, looped signal emits |
| | Repeat with parallel | Parallel steps repeat correctly together |
| **Signals** | completed | Fires when tween finishes (after all repeats) |
| | looped | Fires at start of each repeat iteration |
| | onComplete | Convenience method equivalent to completed.connect |
| **Integration** | Tween + Game.step() | Tween advances correctly with manual stepping |
| | Multiple tweens | Multiple active tweens on different nodes |
| | Tween on same property | Second tween on same property overrides first |

### @quintus/audio Tests

| Category | Tests | Details |
|----------|-------|---------|
| **AudioSystem** | play() | Creates AudioBufferSourceNode, connects to bus, starts |
| | play() missing asset | Warns and returns no-op handle |
| | stopAll() | Stops all active sounds |
| | AudioHandle.stop() | Stops individual sound |
| | Volume | masterVolume affects all, busVolume affects category |
| **AudioPlayer** | Lifecycle | autoplay starts on ready, stop on destroy |
| | play/stop/pause/resume | Correct state transitions |
| | finished signal | Fires when non-looping playback ends |
| | Loop | Looping playback doesn't fire finished |
| **AudioBus** | Routing | Sounds route through correct bus GainNode |
| | Volume cascade | Effective volume = master × bus × individual |
| | Unknown bus fallback | Unknown bus name falls back to "sfx" |
| **AutoplayGate** | Queuing | play() before interaction queues correctly |
| | Flush | First interaction flushes all queued commands |
| | Already ready | play() after interaction executes immediately |
| **Headless** | No-op system | All methods work, no errors, no sound |
| | Asset loading | Audio assets "load" without AudioContext |

### @quintus/ui Tests

| Category | Tests | Details |
|----------|-------|---------|
| **UINode** | renderFixed | Default true for UINode, false for Node2D |
| | containsPoint | Hit test correct for various positions and sizes |
| | size getter/setter | Vec2 size maps to width/height |
| **Label** | Text rendering | onDraw calls ctx.text with correct params |
| | Shadow | Shadow renders at offset with shadow color |
| | Alignment | left/center/right alignment passed to DrawContext |
| | Empty text | No draw calls when text is empty |
| **Button** | Click detection | onPressed fires on pointerdown + pointerup within bounds |
| | Drag away | No onPressed when pointer leaves before release |
| | Hover state | hovered changes on pointer enter/exit |
| | Pressed state | pressed visual state on pointerdown |
| | Disabled | interactive=false: no pointer events |
| **ProgressBar** | Value clamping | Value clamped to [0, maxValue] |
| | Ratio | Correct 0–1 ratio for various values |
| | Fill direction | left-to-right, right-to-left, bottom-to-top, top-to-bottom |
| | valueChanged signal | Fires on value change, not on same value |
| | Zero maxValue | ratio=0 when maxValue=0 (no division by zero) |
| **Panel** | Background | Draws rect with backgroundColor |
| | Border | Draws border when borderColor set |
| **Container** | Vertical layout | Children stacked vertically with gap |
| | Horizontal layout | Children stacked horizontally with gap |
| | Padding | Offset from container edges |
| | Alignment | start/center/end cross-axis alignment |
| | Hidden children | Invisible children skipped in layout |
| | Non-UINode children | Non-UINode children skipped silently |
| **Layer** | Fixed propagation | Children inherit renderFixed from Layer |
| | Nested layers | Inner layer manages its own renderFixed |
| | Dynamic children | Children added after fixed=true get renderFixed |
| **Pointer dispatch** | Topmost target | Highest zIndex widget receives events |
| | Coordinate mapping | Correct screen→game coordinate conversion |
| | Enter/exit | Hover tracking fires enter/exit correctly |
| | Cleanup | Listeners removed when all UINodes removed |
| **Integration** | HUD layout | Panel + ProgressBar + Label composed correctly |
| | Button in Container | Button receives clicks when inside Container |

---

## 7. Demo: Platformer with Audio, Tweens & HUD

Extends the Phase 4 scrolling platformer with sound effects, animations, and a HUD.

### What's New

| Feature | How It's Used |
|---------|---------------|
| **Sound effects** | Jump sound, coin collect sound, landing sound via `game.audio.play()` |
| **Background music** | Looping music via `AudioPlayer` node |
| **Coin animation** | Coins float up and down with a tween loop |
| **Collect effect** | Coin fades out + scales up on collect via tween |
| **Score display** | Label in fixed HUD layer showing coin count |
| **Health bar** | ProgressBar in fixed HUD layer |
| **Hit flash** | Player alpha flashes on damage via tween |
| **Pause menu** | Panel + Button overlay when paused |

### Demo Code

```typescript
import { Game, Scene, Node2D, type DrawContext } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Actor, CollisionShape, PhysicsPlugin, Sensor, Shape } from "@quintus/physics";
import { InputPlugin } from "@quintus/input";
import { Camera } from "@quintus/camera";
import { TileMap } from "@quintus/tilemap";
import { TweenPlugin, Ease } from "@quintus/tween";
import { AudioPlugin, AudioPlayer } from "@quintus/audio";
import { Label, ProgressBar, Panel, Button, Layer } from "@quintus/ui";

const game = new Game({ width: 320, height: 240, pixelArt: true });

game.use(PhysicsPlugin({
    gravity: new Vec2(0, 800),
    collisionGroups: {
        player: { collidesWith: ["world", "coins"] },
        world: { collidesWith: ["player"] },
        coins: { collidesWith: ["player"] },
    },
}));
game.use(InputPlugin({
    bindings: {
        left: ["ArrowLeft", "KeyA"],
        right: ["ArrowRight", "KeyD"],
        jump: ["ArrowUp", "Space"],
        pause: ["Escape", "KeyP"],
    },
}));
game.use(TweenPlugin());
game.use(AudioPlugin());

// === Player ===
class Player extends Actor {
    speed = 120;
    jumpForce = -280;
    health = 3;
    maxHealth = 3;
    collisionGroup = "player";

    onReady() {
        super.onReady();
        this.addChild(CollisionShape).shape = Shape.rect(12, 16);
        this.tag("player");
    }

    onFixedUpdate(dt: number) {
        const input = this.game!.input;
        this.velocity.x = 0;
        if (input.isPressed("left")) this.velocity.x = -this.speed;
        if (input.isPressed("right")) this.velocity.x = this.speed;

        if (input.isJustPressed("jump") && this.isOnFloor()) {
            this.velocity.y = this.jumpForce;
            this.game!.audio.play("jump", { volume: 0.6 });
        }

        this.move(dt);
    }

    takeDamage() {
        this.health--;
        // Flash effect: alpha blinks 3 times
        this.tween()
            .to({ alpha: 0.2 }, 0.1)
            .to({ alpha: 1 }, 0.1)
            .repeat(2);
        this.game!.audio.play("hit");
    }

    onDraw(ctx: DrawContext) {
        ctx.rect(new Vec2(-6, -8), new Vec2(12, 16), {
            fill: Color.fromHex("#4fc3f7"),
        });
    }
}

// === Coin with float animation ===
class Coin extends Sensor {
    collisionGroup = "coins";

    onReady() {
        super.onReady();
        this.addChild(CollisionShape).shape = Shape.circle(6);

        // Gentle float animation
        this.tween()
            .to({ position: { y: this.position.y - 4 } }, 0.8, Ease.sineInOut)
            .to({ position: { y: this.position.y } }, 0.8, Ease.sineInOut)
            .repeat();

        this.bodyEntered.connect((body) => {
            if (body.hasTag("player")) {
                this.game!.audio.play("coin");
                // Collect effect: scale up + fade out, then destroy
                this.killTweens();
                this.tween()
                    .to({ scale: { x: 2, y: 2 } }, 0.2, Ease.backOut)
                    .parallel()
                    .to({ alpha: 0 }, 0.2)
                    .onComplete(() => this.destroy());
            }
        });
    }

    onDraw(ctx: DrawContext) {
        ctx.circle(Vec2.ZERO, 6, { fill: Color.fromHex("#ffd54f") });
    }
}

// === Main Scene ===
class Level1 extends Scene {
    onReady() {
        // Background music
        const music = this.add(AudioPlayer);
        music.stream = "music";
        music.loop = true;
        music.bus = "music";
        music.volume = 0.3;
        music.autoplay = true;

        // Tilemap
        const map = this.add(TileMap);
        map.asset = "level1";
        map.generateCollision({ layer: "ground", allSolid: true, collisionGroup: "world" });
        map.spawnObjects("entities", { Coin });

        // Player
        const player = this.add(Player);
        player.position = map.getSpawnPoint("player_start");

        // Camera
        const camera = this.add(Camera);
        camera.follow = player;
        camera.smoothing = 0.1;
        camera.zoom = 2;
        camera.bounds = map.bounds;

        // === Fixed HUD Layer ===
        const hud = this.add(Layer);
        hud.fixed = true;
        hud.zIndex = 100;

        // Health bar
        const healthBar = hud.addChild(ProgressBar);
        healthBar.position = new Vec2(10, 10);
        healthBar.width = 60;
        healthBar.height = 8;
        healthBar.maxValue = player.maxHealth;
        healthBar.value = player.health;
        healthBar.fillColor = Color.fromHex("#ef5350");
        healthBar.backgroundColor = Color.fromHex("#333333");

        // Score label
        const scoreLabel = hud.addChild(Label);
        scoreLabel.position = new Vec2(10, 22);
        scoreLabel.text = "Coins: 0";
        scoreLabel.fontSize = 8;
        scoreLabel.color = Color.WHITE;
        scoreLabel.shadow = {
            offset: new Vec2(1, 1),
            color: Color.fromHex("#000000"),
        };
    }
}

game.assets.load({
    images: ["tiles.png"],
    json: ["level1.json"],
    audio: ["jump.ogg", "coin.ogg", "hit.ogg", "music.mp3"],
}).then(() => {
    game.start(Level1);
});
```

### What This Demo Exercises

| System | How It's Used |
|--------|---------------|
| **Tween** | Coin float loop, collect scale+fade, player damage flash |
| **Easing** | `sineInOut` for float, `backOut` for collect pop |
| **Audio play** | `game.audio.play("jump")` for one-shot SFX |
| **AudioPlayer** | Background music node with loop + autoplay |
| **Audio bus** | Music on "music" bus, SFX on "sfx" bus |
| **Label** | Score display with text shadow |
| **ProgressBar** | Health bar with fill color |
| **Layer** | Fixed HUD layer ignoring camera viewTransform |
| **killTweens** | Cancel float tween before playing collect tween |

---

## 8. Definition of Done

All of these must be true before Phase 5 is complete:

### Core Changes
- [ ] `Game.postUpdate` signal added, fires after `_walkUpdate` before render
- [ ] `Node2D.alpha` property added, default 1
- [ ] `Node2D.renderFixed` property added, default false
- [ ] Canvas2DRenderer applies `alpha` via `globalAlpha`
- [ ] Canvas2DRenderer skips `viewTransform` when `renderFixed` is true
- [ ] `AssetLoader.registerLoader()` method added for custom asset types
- [ ] Existing Phase 1–4 tests still pass (backward compatible)

### @quintus/tween
- [ ] `@quintus/tween` builds and exports as ESM + CJS + `.d.ts`
- [ ] `node.tween()` creates a tween targeting the node (requires TweenPlugin)
- [ ] `.to()` interpolates numeric properties correctly
- [ ] `.to()` interpolates Vec2 sub-properties (position.x, position.y) correctly
- [ ] `.to()` uses object-level lerp for Color and Vec2 whole-object targets
- [ ] Sequential `.to()` calls execute in order
- [ ] `.parallel()` makes the next `.to()` run alongside the previous
- [ ] `.delay()` pauses the sequence for the specified duration
- [ ] `.callback()` calls the function at the correct point
- [ ] `.repeat()` loops the tween the specified number of times
- [ ] `.repeat()` with no args loops forever
- [ ] `.kill()` immediately stops the tween
- [ ] `.pause()` / `.resume()` work correctly
- [ ] Tweens auto-kill when target node is destroyed
- [ ] `node.killTweens()` kills all tweens on a node
- [ ] `completed` signal fires when tween finishes
- [ ] All 16 easing functions return correct values at t=0, 0.5, 1
- [ ] All tween tests pass

### @quintus/audio
- [ ] `@quintus/audio` builds and exports as ESM + CJS + `.d.ts`
- [ ] `game.audio.play(name)` plays a loaded audio asset
- [ ] `game.audio.play()` returns an AudioHandle for stopping
- [ ] `game.audio.stopAll()` stops all active sounds
- [ ] `masterVolume` and bus volume control work
- [ ] AudioPlayer node: play, stop, pause, resume lifecycle
- [ ] AudioPlayer: autoplay on ready, auto-stop on destroy
- [ ] AudioPlayer: `finished` signal fires for non-looping playback
- [ ] AudioPlayer: looping works correctly
- [ ] Autoplay gate: play commands queue before user interaction
- [ ] Autoplay gate: queued commands flush on first interaction
- [ ] Headless mode: no-op audio system, no errors
- [ ] Missing audio asset: warns (no throw), returns no-op handle
- [ ] All audio tests pass

### @quintus/ui
- [ ] `@quintus/ui` builds and exports as ESM + CJS + `.d.ts`
- [ ] UINode has `renderFixed = true` by default
- [ ] UINode.containsPoint hit-testing works correctly
- [ ] Label renders text with font, size, color, alignment
- [ ] Label renders text shadow when configured
- [ ] Button emits `onPressed` on click (pointerdown + pointerup within bounds)
- [ ] Button shows hover/pressed visual states
- [ ] Button does NOT fire when pointer leaves before release
- [ ] ProgressBar displays fill based on value/maxValue ratio
- [ ] ProgressBar clamps value to [0, maxValue]
- [ ] ProgressBar.valueChanged signal fires on value change
- [ ] ProgressBar supports all four fill directions
- [ ] Panel renders background and optional border
- [ ] Container: vertical layout with gap and padding
- [ ] Container: horizontal layout with gap and padding
- [ ] Container: alignment (start, center, end)
- [ ] Layer: `fixed = true` propagates `renderFixed` to children
- [ ] Layer: nested layers manage their own renderFixed
- [ ] Pointer dispatch: topmost widget receives events
- [ ] Pointer dispatch: correct coordinate mapping from CSS to game resolution
- [ ] All UI tests pass

### Demo
- [ ] Platformer plays jump/coin/hit sound effects
- [ ] Background music loops via AudioPlayer
- [ ] Coins animate (float loop, collect scale+fade)
- [ ] Player flashes on damage via tween
- [ ] HUD displays health bar and score in screen space
- [ ] HUD stays fixed while camera scrolls

### Quality
- [ ] All tests pass, Biome lint clean, `pnpm build` succeeds
- [ ] Combined tween + audio + ui bundle under 11KB gzipped
- [ ] No regressions in Phase 1–4 tests

---

## 9. Execution Order

Build bottom-up. Each step produces testable output. Tween first (no external deps, enables animation tests), then Audio (self-contained), then UI (most complex, benefits from tween for animations).

```
Days 1–3: Core changes + Tween
───────────────────────────────────────
Step 1: Core changes                                          (0.5 day)
        → Game.postUpdate signal
        → Node2D.alpha + Node2D.renderFixed
        → Canvas2DRenderer updates
        → AssetLoader.registerLoader
        → Existing tests still pass

Step 2: Easing functions                                      (0.5 day)
        → All 16 easing functions implemented + tested

Step 3: Tween class + TweenSystem                            (1 day)
        → Property interpolation (numeric, Vec2 sub, object lerp)
        → Sequential/parallel groups, delay, callback
        → Kill, pause/resume, repeat, signals

Step 4: TweenPlugin + Node augmentation                      (0.5 day)
        → node.tween(), node.killTweens() work
        → Integration test: tween + Game.step()

Days 4–5: Audio
───────────────────────────────────────
Step 5: AudioBus + AutoplayGate                              (0.5 day)
        → GainNode routing, volume control
        → Autoplay queue + flush on interaction

Step 6: AudioSystem + AudioPlugin                            (0.5 day)
        → game.audio.play(), stopAll(), volume control
        → Asset loader registration for audio files
        → Headless no-op mode

Step 7: AudioPlayer node                                     (0.5 day)
        → play/stop/pause/resume, autoplay, loop
        → finished signal, auto-stop on destroy

Days 6–8: UI
───────────────────────────────────────
Step 8: UINode + PointerDispatcher                           (0.5 day)
        → Base class with renderFixed, containsPoint
        → Centralized pointer event handling

Step 9: Label + Panel                                        (0.5 day)
        → Text rendering with shadow, alignment
        → Background panel with border

Step 10: Button                                              (0.5 day)
         → Click detection, hover/pressed states, onPressed signal

Step 11: ProgressBar + Container                             (0.5 day)
         → Fill bar with directions, value clamping
         → Vertical/horizontal layout with gap, padding, alignment

Step 12: Layer                                               (0.5 day)
         → renderFixed propagation, nested layer handling

Days 9–10: Integration + Demo
───────────────────────────────────────
Step 13: Integration tests                                   (0.5 day)
         → Tween + Audio + UI together in a scene
         → HUD + game objects + camera + tweens

Step 14: Platformer demo with audio, tweens, and HUD         (1 day)
         → Extend Phase 4 demo with all Phase 5 features
         → Sound effects, music, coin animations, health bar, score

Step 15: Polish                                              (0.5 day)
         → Edge cases, size verification, cleanup
         → All Definition of Done items checked off
```

**Total: ~10 working days (~2 weeks)**

### Parallelism Notes

- Steps 2–4 (tween), Steps 5–7 (audio), and Steps 8–12 (UI) have no code dependencies on each other. They can be developed in parallel after Step 1 (core changes).
- Step 13 (integration) requires all three packages.
- Step 14 (demo) requires integration to be working.
