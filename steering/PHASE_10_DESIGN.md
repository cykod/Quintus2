# Phase 10: Three.js Integration — Detailed Design

> **Goal:** Add optional 3D rendering via Three.js as a peer dependency, enabling 2D games with 3D effects, full 3D games, or hybrid modes — all using the existing Quintus game loop, input, scenes, and plugin system.
> **Outcome:** Developers can `game.use(ThreePlugin())` to get a Three.js renderer, create `Node3D` subclasses with meshes, lights, and cameras, load GLTF models, and mix 2D UI overlays with 3D content. Three.js is a peer dependency — not bundled — so 2D-only games pay zero cost.

---

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Package setup + ThreePlugin + ThreeContext | Done |
| 2 | Node3D + ThreeRenderer (scene graph sync) | Done |
| 3 | MeshNode + Camera3D + Lights | Done |
| 4 | GLTFModel + Billboard + asset integration | Done |
| 5 | ThreeLayer (hybrid 2D+3D compositing) | Done |
| 6 | Example game + integration tests | Done |

---

## Table of Contents

1. [What's Already Built](#1-whats-already-built)
2. [Architecture Overview](#2-architecture-overview)
3. [Design Decision: Three.js Math Types](#3-design-decision-threejs-math-types)
4. [Phase 1: Package Setup + ThreePlugin](#4-phase-1-package-setup--threeplugin)
5. [Phase 2: Node3D + ThreeRenderer](#5-phase-2-node3d--threerenderer)
6. [Phase 3: MeshNode + Camera3D + Lights](#6-phase-3-meshnode--camera3d--lights)
7. [Phase 4: GLTFModel + Billboard + Assets](#7-phase-4-gltfmodel--billboard--assets)
8. [Phase 5: ThreeLayer (Hybrid Mode)](#8-phase-5-threelayer-hybrid-mode)
9. [Phase 6: Example Game + Integration Tests](#9-phase-6-example-game--integration-tests)
10. [Test Plan](#10-test-plan)
11. [Definition of Done](#11-definition-of-done)

---

## 1. What's Already Built

Phase 10 builds on significant 3D-readiness work completed in Phase 1:

| Feature | Location | What It Does |
|---------|----------|--------------|
| `Renderer` interface | `packages/core/src/renderer.ts` | Pluggable renderer: `render()`, `markRenderDirty()`, optional `resize()`, `dispose()` |
| `Game._setRenderer()` | `packages/core/src/game.ts:319` | Plugin API to replace the active renderer at runtime |
| `GameOptions.renderer` | `packages/core/src/game.ts:39` | `Renderer \| null` — custom renderer or headless |
| `game.sceneSwitched` | `packages/core/src/game.ts` | Signal<{ from, to }> — fires on scene transitions |
| `Node` dimension-free | `packages/core/src/node.ts` | Zero math imports — `onDraw` lives on `Node2D` only |
| `Node2D.onDraw()` | `packages/core/src/node2d.ts:124` | Drawing only on 2D nodes, not on base `Node` |
| `Canvas2DRenderer` | `packages/core/src/canvas2d-renderer.ts` | Reference implementation of `Renderer` |
| Plugin pattern | `packages/physics/src/physics-plugin.ts` | WeakMap + accessor + module augmentation |
| Empty `@quintus/three` | `packages/three/src/index.ts` | Scaffolded package with build config |
| `Vec2._onChange` pattern | `packages/math/src/vec2.ts` | Dirty-flag callback on component mutation |

### Renderer Interface (complete)

```typescript
// packages/core/src/renderer.ts
export interface Renderer {
  render(scene: Scene): void;
  markRenderDirty(): void;
  resize?(width: number, height: number): void;
  dispose?(): void;
}
```

### Plugin Installation Pattern

```typescript
// WeakMap for per-game state
const worldMap = new WeakMap<Game, PhysicsWorld>();

// Plugin factory
export function PhysicsPlugin(config = {}): Plugin {
  return definePlugin({
    name: "physics",
    install(game) {
      const world = new PhysicsWorld(config);
      worldMap.set(game, world);
      game.postFixedUpdate.connect(() => world.stepMonitoring());
    },
  });
}

// Module augmentation (augment.ts)
Object.defineProperty(Game.prototype, "physics", {
  get(this: Game) { return getPhysicsWorld(this)!; },
  configurable: true,
});
declare module "@quintus/core" {
  interface Game { get physics(): PhysicsWorld; }
}
```

### Canvas2DRenderer Render Flow

The existing renderer shows the pattern any replacement must follow:

```
render(scene):
  1. Clear canvas
  2. Rebuild render list (collect visible Node2D with overridden onDraw, z-sort)
  3. Get scene.viewTransform (set by Camera)
  4. For each node:
     - Apply globalTransform (or viewTransform * globalTransform)
     - Call node.onDraw(drawContext)
```

**Note:** Canvas2DRenderer only collects Node2D instances with overridden `onDraw`. Bare Node2D without an `onDraw` override are skipped.

---

## 2. Architecture Overview

### Three Usage Modes

```
Mode 1: Full 3D                    Mode 2: 2D + 3D Effects
─────────────────                  ────────────────────────
┌───────────────────┐              ┌───────────────────┐
│  ThreeRenderer    │              │  Canvas2DRenderer │
│  (auto-installed) │              │  (unchanged)      │
│                   │              │                   │
│  Node3D tree      │              │  ┌─────────────┐ │
│  ├── Camera3D     │              │  │ ThreeLayer  │ │
│  ├── MeshNode     │              │  │ (Node2D)    │ │
│  ├── GLTFModel    │              │  │ renders 3D  │ │
│  ├── Lights       │              │  │ behind/over │ │
│  └── Billboard    │              │  └─────────────┘ │
│                   │              │  ├── Player     │ │
│  2D UI overlay    │              │  ├── TileMap    │ │
│  (renderFixed)    │              │  └── HUD        │ │
└───────────────────┘              └───────────────────┘
```

**Mode 1 (Full 3D):** Pass `renderer: null` to skip Canvas2DRenderer creation. ThreePlugin auto-detects this and installs ThreeRenderer on `game.canvas` (no context conflict since no 2D context was acquired). 2D UI nodes with `renderFixed = true` render as a Canvas2D overlay on top.

```typescript
// Full 3D
const game = new Game({ width: 800, height: 600, renderer: null });
game.use(ThreePlugin({ antialias: true, shadows: true }));
game.start(MainScene);
```

**Mode 2 (2D + 3D Effects):** Canvas2DRenderer stays active. ThreePlugin creates a shared offscreen WebGL canvas. `ThreeLayer` (which is a Node2D) renders 3D content via the shared WebGL context and composites it into the 2D canvas via `drawImage()`. Only one WebGL context is used regardless of how many ThreeLayer instances exist.

```typescript
// Hybrid 2D + 3D effects
const game = new Game({ width: 800, height: 600 });
game.use(ThreePlugin()); // Detects Canvas2DRenderer, creates offscreen WebGL
game.start(MainScene);
```

### Plugin Architecture

```
@quintus/three (peer dep: three)
├── ThreePlugin          — Plugin factory, auto-detects mode, installs ThreeContext
├── ThreeContext          — Holds THREE.Scene, THREE.WebGLRenderer
├── ThreeRenderer        — Implements Renderer, syncs Quintus → Three.js
├── Node3D               — Base 3D node (extends Node), lazy THREE.Object3D creation
├── MeshNode             — THREE.Mesh wrapper
├── PointsNode           — THREE.Points wrapper (for particle/star fields)
├── Camera3D             — Perspective/Orthographic camera
├── DirectionalLight     — THREE.DirectionalLight wrapper
├── PointLight           — THREE.PointLight wrapper
├── AmbientLight         — THREE.AmbientLight wrapper
├── GLTFModel            — GLTF/GLB loader node (via asset system)
├── Billboard            — Sprite in 3D space (always faces camera)
├── ThreeLayer           — Node2D hosting a Three.js sub-scene (hybrid mode)
└── augment.ts           — game.three accessor via module augmentation
```

### Scene Tree Examples

**Full 3D game:**
```
Scene (Level1)
├── Camera3D (perspective, follows player)
├── AmbientLight (soft white)
├── DirectionalLight (sun)
├── Ground (MeshNode: PlaneGeometry + texture)
├── Player (Node3D)
│   ├── GLTFModel (character.glb)
│   └── CollisionShape (for @quintus/physics, if needed)
├── Enemy (Node3D)
│   └── GLTFModel (enemy.glb)
├── Crate (MeshNode: BoxGeometry)
└── HUD (Node2D, renderFixed=true)       ← 2D overlay
    ├── HealthBar
    └── ScoreLabel
```

**2D game + 3D background:**
```
Scene (Level1)
├── ThreeLayer (zIndex: -100, renders behind 2D)    ← 3D sub-scene
│   ├── Camera3D (fixed angle)
│   ├── AmbientLight
│   ├── RotatingCube (MeshNode)
│   └── StarField (PointsNode)
├── TileMap (2D level)
├── Player (Actor, 2D physics)
├── Enemies (Actor nodes)
└── HUD (UILayer)
```

### Constraint: Node2D Cannot Be a Child of Node3D

Node2D should never be added as a direct child of Node3D. Neither the ThreeRenderer nor the Canvas2DRenderer can correctly handle this case. For in-world 2D content attached to 3D objects (health bars, labels), use `Billboard`. Node3D emits a runtime warning if a Node2D child is detected.

---

## 3. Design Decision: Three.js Math Types

### The Question

The `PHASE_1_3D_DESIGN.md` documented a `Vec3`/`Quaternion` with the `_onChange` dirty-flag pattern matching `Vec2`. Should we implement Quintus-owned 3D math types, or use Three.js's `THREE.Vector3`/`THREE.Quaternion` directly?

### Decision: Use Three.js Types in Node3D

**Rationale:**

1. **No duplicate math.** Three.js has production-hardened `Vector3`, `Quaternion`, `Euler`, `Matrix4` implementations. Reimplementing them adds ~5KB of code that duplicates Three.js's.

2. **No sync overhead.** If Quintus has its own Vec3 and Three.js has THREE.Vector3, every frame requires copying values between them. With Three.js types directly, there's zero sync cost.

3. **Three.js ecosystem compatibility.** Users working with Three.js expect `THREE.Vector3`. Helpers, examples, and community code all use Three.js types. Wrapping them adds friction.

4. **Three.js handles dirty-flagging internally.** `THREE.Object3D` already has `matrixAutoUpdate` and `matrixWorldNeedsUpdate`. No need for the `_onChange` pattern.

5. **Peer dependency guarantee.** `@quintus/three` has `three` as a peer dep. Every user of Node3D already has Three.js imported.

**What about `@quintus/math` Vec3?** We do NOT add Vec3/Quaternion/Matrix4 to `@quintus/math`. These types would only be useful with Three.js, and having two Vec3 implementations (one in math, one in Three.js) creates confusion. The `@quintus/math` package stays focused on 2D math.

**Trade-off:** Node3D's API uses Three.js types (`THREE.Vector3`) while Node2D uses Quintus types (`Vec2`). This is an intentional asymmetry — 2D is the Quintus-native dimension, 3D is the Three.js-native dimension. Users who adopt 3D already import Three.js and work in its idiom.

**Future implication: `@quintus/physics3d`.** Because Node3D uses Three.js types and lives in `@quintus/three`, a future `@quintus/physics3d` package would need to depend on `@quintus/three` (and transitively require Three.js as a peer dep) even for headless physics simulation. If this becomes a problem, the mitigation path is: add lightweight `Vec3`/`Quaternion`/`Matrix4` to `@quintus/math`, move a "core" Node3D (using Quintus math types) into `@quintus/core`, and have `@quintus/three`'s Node3D subclasses bridge to Three.js objects. The sync cost of copying 3–12 floats per node per frame is negligible relative to GPU draw calls. This refactor is deferred until a concrete need arises — for now, the Three.js-native approach minimizes API surface and implementation effort. Note: the earlier `3D_IMPLEMENTATION_PLAN.md` proposed the independent math types approach; this design intentionally diverges for pragmatic reasons.

### Design Decision: Lazy Object3D Creation

Node3D subclasses use **lazy creation** of their underlying Three.js objects. The `object3d` is not created in the constructor — it's created on first access via a `_createObject3D()` factory method. This enables the standard `add(Class, { props })` API:

```typescript
// This works because props are applied via Object.assign BEFORE object3d is accessed
this.add(AmbientLight, { intensity: 0.4 });
this.add(Camera3D, { fov: 75, near: 0.1, far: 1000 });
this.add(MeshNode, { geometry: customGeo, material: customMat });
```

Flow:
1. `new AmbientLight()` — sets default property values, no Three.js object yet
2. `Object.assign(node, { intensity: 0.4 })` — overrides the `intensity` property
3. ThreeRenderer syncs tree → accesses `node.object3d` (getter) → calls `_createObject3D()` → creates `THREE.AmbientLight(0xffffff, 0.4)` with the correct intensity

```typescript
class Node3D extends Node {
  private _object3d: THREE.Object3D | null = null;

  get object3d(): THREE.Object3D {
    if (!this._object3d) {
      this._object3d = this._createObject3D();
      this._object3d.userData.quintusNodeId = this.id;
    }
    return this._object3d;
  }

  /** Override in subclasses to create the appropriate Three.js object. */
  protected _createObject3D(): THREE.Object3D {
    return new THREE.Object3D();
  }

  // Convenience accessors trigger lazy creation
  get position(): THREE.Vector3 { return this.object3d.position; }
  get rotation(): THREE.Euler { return this.object3d.rotation; }
  get quaternion(): THREE.Quaternion { return this.object3d.quaternion; }
  get scale(): THREE.Vector3 { return this.object3d.scale; }
}
```

Usage feels natural:
```typescript
class Spinner extends Node3D {
  onUpdate(dt: number) {
    this.rotation.y += dt;          // THREE.Euler
    this.position.x += speed * dt;  // THREE.Vector3
  }
}
```

---

## 4. Phase 1: Package Setup + ThreePlugin

### 4.1 Deliverables

- [x]Add `three` as peer dependency to `packages/three/package.json`
- [x]Add `@quintus/core` as workspace dependency
- [x]Create `ThreeContext` class holding Three.js rendering state
- [x]Create `ThreePlugin` factory with auto-detection of full vs hybrid mode
- [x]Create `augment.ts` with `game.three` module augmentation
- [x]Export all public API from `src/index.ts`
- [x]Export `Canvas2DDrawContext` from `@quintus/core` (needed for 2D overlay in Phase 2)
- [x]Add public `get hasRenderer(): boolean` to `Game` (needed for mode auto-detection)
- [x]Verify `pnpm build` succeeds

### 4.2 Package Dependencies

**File:** `packages/three/package.json`

```jsonc
{
  "name": "@quintus/three",
  "peerDependencies": {
    "three": ">=0.160.0"
  },
  "dependencies": {
    "@quintus/core": "workspace:*"
  },
  "devDependencies": {
    "three": "^0.172.0",
    "@types/three": "^0.172.0"
  }
}
```

Three.js is a **peer dependency** — the user provides it. We pin a minimum version (0.160+) for the APIs we use (WebGPURenderer is 0.160+, but we target WebGLRenderer which is stable across versions). Dev dependency pins a specific version for testing.

### 4.3 ThreeContext

**File:** `packages/three/src/three-context.ts`

The `ThreeContext` holds all Three.js rendering state. One instance per Game, stored in a WeakMap.

```typescript
import * as THREE from "three";

export interface ThreePluginConfig {
  /** Enable antialiasing. Default: true. */
  antialias?: boolean;
  /** Pixel ratio. Default: window.devicePixelRatio. */
  pixelRatio?: number;
  /** Background color. Default: null (transparent). */
  background?: THREE.ColorRepresentation | null;
  /** Enable shadow maps. Default: false. */
  shadows?: boolean;
  /** Tone mapping. Default: THREE.NoToneMapping. */
  toneMapping?: THREE.ToneMapping;
}

export class ThreeContext {
  readonly scene: THREE.Scene;
  readonly webglRenderer: THREE.WebGLRenderer;

  /** The currently active 3D camera. Set by Camera3D nodes. */
  activeCamera: THREE.Camera | null = null;

  /** Whether this context is in hybrid mode (offscreen canvas for compositing). */
  readonly hybridMode: boolean;

  private _disposed = false;

  constructor(canvas: HTMLCanvasElement, width: number, height: number, config: ThreePluginConfig = {}, hybridMode = false) {
    this.scene = new THREE.Scene();
    this.hybridMode = hybridMode;

    this.webglRenderer = new THREE.WebGLRenderer({
      canvas,
      antialias: config.antialias ?? true,
      alpha: config.background === null,
      // preserveDrawingBuffer needed only in hybrid mode for drawImage compositing.
      // In full 3D mode, omitting it allows GPU back-buffer optimizations.
      preserveDrawingBuffer: hybridMode,
    });
    this.webglRenderer.setSize(width, height, false);
    this.webglRenderer.setPixelRatio(config.pixelRatio ?? (typeof window !== "undefined" ? window.devicePixelRatio : 1));

    if (config.background != null) {
      this.scene.background = new THREE.Color(config.background);
    }

    if (config.shadows) {
      this.webglRenderer.shadowMap.enabled = true;
      this.webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    if (config.toneMapping) {
      this.webglRenderer.toneMapping = config.toneMapping;
    }
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.webglRenderer.dispose();
  }
}
```

### 4.4 ThreePlugin

**File:** `packages/three/src/three-plugin.ts`

ThreePlugin **auto-detects** the rendering mode based on whether a renderer already exists. Since `Game.renderer` is private, we use the public `game.hasRenderer` getter (added as a core change in Phase 1):

- **Full 3D** (`!game.hasRenderer`): Uses `game.canvas` directly for WebGL (no 2D context was acquired since `renderer: null` skipped Canvas2DRenderer creation). Installs ThreeRenderer automatically.
- **Hybrid** (`game.hasRenderer`): Creates a shared offscreen canvas for WebGL. Canvas2DRenderer stays active. ThreeLayer nodes use the shared WebGL context.

```typescript
import type { Game, Plugin } from "@quintus/core";
import { definePlugin } from "@quintus/core";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ThreeContext, type ThreePluginConfig } from "./three-context.js";
import { ThreeRenderer } from "./three-renderer.js";

const contextMap = new WeakMap<Game, ThreeContext>();

export function getThreeContext(game: Game): ThreeContext | null {
  return contextMap.get(game) ?? null;
}

export function ThreePlugin(config: ThreePluginConfig = {}): Plugin {
  return definePlugin({
    name: "three",
    install(game: Game) {
      const fullMode = !game.hasRenderer;

      let canvas: HTMLCanvasElement;
      if (fullMode) {
        // Full 3D: use game.canvas directly — no 2D context was acquired
        canvas = game.canvas;
      } else {
        // Hybrid: create a shared offscreen canvas for ThreeLayer rendering
        canvas = document.createElement("canvas");
        canvas.width = game.width;
        canvas.height = game.height;
      }

      const ctx = new ThreeContext(canvas, game.width, game.height, config, !fullMode /* hybridMode */);
      contextMap.set(game, ctx);

      if (fullMode) {
        // Install ThreeRenderer as the game's renderer
        const renderer = new ThreeRenderer(ctx);
        game._setRenderer(renderer);
      }

      // Register GLTF/GLB asset loaders
      game.assets.registerLoader("gltf", async (_name: string, path: string) => {
        const loader = new GLTFLoader();
        return loader.loadAsync(path);
      });
      game.assets.registerLoader("glb", async (_name: string, path: string) => {
        const loader = new GLTFLoader();
        return loader.loadAsync(path);
      });

      // Clear Three.js scene on scene transitions to prevent stale objects
      game.sceneSwitched.connect(() => {
        ctx.scene.clear();
        ctx.activeCamera = null;
      });

      // Clean up on game stop
      game.stopped.connect(() => {
        ctx.dispose();
        contextMap.delete(game);
      });
    },
  });
}
```

**Canvas context conflict — resolved.** In full 3D mode, `renderer: null` prevents the Game constructor from creating a Canvas2DRenderer, so no 2D context is ever acquired on `game.canvas`. ThreePlugin safely acquires a WebGL context on the same canvas. In hybrid mode, the WebGL context is on a separate offscreen canvas, so there's no conflict with the 2D canvas.

### 4.5 Module Augmentation

**File:** `packages/three/src/augment.ts`

```typescript
import { Game } from "@quintus/core";
import { getThreeContext } from "./three-plugin.js";
import type { ThreeContext } from "./three-context.js";

Object.defineProperty(Game.prototype, "three", {
  get(this: Game): ThreeContext {
    const ctx = getThreeContext(this);
    if (!ctx) {
      throw new Error(
        "ThreePlugin not installed. Call game.use(ThreePlugin()) before accessing game.three.",
      );
    }
    return ctx;
  },
  configurable: true,
});

declare module "@quintus/core" {
  interface Game {
    /** Three.js context. Requires ThreePlugin to be installed. */
    get three(): ThreeContext;
  }
}
```

### 4.6 Core Change: Add `hasRenderer` to Game

**File:** `packages/core/src/game.ts`

`Game.renderer` is private. ThreePlugin needs to detect whether a renderer is already installed (to choose full-3D vs hybrid mode). Add a public read-only getter:

```typescript
/** Whether a renderer is currently installed. Used by ThreePlugin for mode auto-detection. */
get hasRenderer(): boolean {
  return this.renderer !== null;
}
```

### 4.7 Core Change: Export Canvas2DDrawContext

**File:** `packages/core/src/canvas2d-renderer.ts`

Export `Canvas2DDrawContext` so ThreeRenderer can create one for 2D overlay rendering:

```typescript
// Change from unexported class to exported
export class Canvas2DDrawContext implements DrawContext { ... }
```

### 4.8 Core Change: Add `drawCanvas` to DrawContext

**File:** `packages/core/src/draw-context.ts` (addition)

```typescript
// Add to the DrawContext interface:
/** Draw an HTMLCanvasElement or OffscreenCanvas at the given position. */
drawCanvas?(canvas: HTMLCanvasElement | OffscreenCanvas, x: number, y: number, width?: number, height?: number): void;
```

**File:** `packages/core/src/canvas2d-renderer.ts` (Canvas2DDrawContext addition)

```typescript
drawCanvas(canvas: HTMLCanvasElement | OffscreenCanvas, x: number, y: number, width?: number, height?: number): void {
  if (width != null && height != null) {
    this.ctx.drawImage(canvas, x, y, width, height);
  } else {
    this.ctx.drawImage(canvas, x, y);
  }
}
```

### 4.9 Exports

**File:** `packages/three/src/index.ts`

```typescript
export { ThreeContext, type ThreePluginConfig } from "./three-context.js";
export { ThreePlugin, getThreeContext } from "./three-plugin.js";
// augment.ts is side-effect-only — imported for module augmentation
import "./augment.js";
```

---

## 5. Phase 2: Node3D + ThreeRenderer

### 5.1 Deliverables

- [x]Create `Node3D` base class extending `Node`, with lazy `_createObject3D()` pattern
- [x]Implement `Node3D.serialize()` for debug system compatibility
- [x]Add Node2D-under-Node3D runtime warning
- [x]Create `ThreeRenderer` implementing `Renderer`
- [x]Implement Quintus scene tree → Three.js scene graph synchronization
- [x]Handle `renderFixed` Node2D nodes via a Canvas2D overlay layer
- [x]Write tests for Node3D lifecycle and ThreeRenderer sync

### 5.2 Node3D

**File:** `packages/three/src/node3d.ts`

Node3D extends `Node` (not `Node2D`) — it lives in the 3D branch of the hierarchy. Its Three.js object is created lazily via `_createObject3D()` so that `add(Class, { props })` works correctly.

```typescript
import * as THREE from "three";
import { Node, Node2D } from "@quintus/core";
import type { NodeSnapshot } from "@quintus/core";

export interface Node3DSnapshot extends NodeSnapshot {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; order: string };
  quaternion: { x: number; y: number; z: number; w: number };
  scale: { x: number; y: number; z: number };
  visible: boolean;
}

export class Node3D extends Node {
  /**
   * The underlying Three.js object. Created lazily via _createObject3D()
   * on first access. Subclasses override _createObject3D() to return
   * Mesh, Light, Camera, etc.
   */
  private _object3d: THREE.Object3D | null = null;

  get object3d(): THREE.Object3D {
    if (!this._object3d) {
      this._object3d = this._createObject3D();
      this._object3d.userData.quintusNodeId = this.id;
      this._object3d.visible = this._visible; // sync backing field
    }
    return this._object3d;
  }

  /**
   * Override in subclasses to create the specific Three.js object.
   * Called lazily on first access to `object3d`. At this point, all
   * properties set via add(Class, { props }) have been applied.
   */
  protected _createObject3D(): THREE.Object3D {
    return new THREE.Object3D();
  }

  /**
   * Visible state. Stored as a backing field to avoid triggering
   * lazy object3d creation during Object.assign (which would break
   * the add(Class, { visible: false, intensity: 0.4 }) pattern
   * by creating the Three.js object before all props are applied).
   * Synced to object3d in _createObject3D() and on set.
   */
  private _visible = true;

  get visible(): boolean {
    return this._object3d ? this._object3d.visible : this._visible;
  }
  set visible(v: boolean) {
    this._visible = v;
    if (this._object3d) this._object3d.visible = v;
  }

  // === Transform Accessors ===
  // Delegate to THREE.Object3D — triggers lazy creation on first access

  get position(): THREE.Vector3 {
    return this.object3d.position;
  }

  get rotation(): THREE.Euler {
    return this.object3d.rotation;
  }

  get quaternion(): THREE.Quaternion {
    return this.object3d.quaternion;
  }

  get scale(): THREE.Vector3 {
    return this.object3d.scale;
  }

  // === Convenience ===

  /** Look at a world position. */
  lookAt(x: number, y: number, z: number): void {
    this.object3d.lookAt(x, y, z);
  }

  // === Lifecycle ===

  override onEnterTree(): void {
    // Validate: Node2D should not be a child of Node3D
    for (const child of this.children) {
      if (child instanceof Node2D) {
        console.warn(
          `Node2D "${child.name || child.constructor.name}" is a child of Node3D ` +
          `"${this.name || this.constructor.name}". Node2D cannot render under Node3D. ` +
          `Use Billboard for in-world 2D content.`,
        );
      }
    }
  }

  override onExitTree(): void {
    // Remove from Three.js parent to prevent scene graph leaks
    if (this._object3d?.parent) {
      this._object3d.parent.remove(this._object3d);
    }
  }

  // === Serialization (for debug bridge) ===

  override serialize(): Node3DSnapshot {
    const p = this.object3d.position;
    const r = this.object3d.rotation;
    const q = this.object3d.quaternion;
    const s = this.object3d.scale;
    return {
      ...super.serialize(),
      position: { x: p.x, y: p.y, z: p.z },
      rotation: { x: r.x, y: r.y, z: r.z, order: r.order },
      quaternion: { x: q.x, y: q.y, z: q.z, w: q.w },
      scale: { x: s.x, y: s.y, z: s.z },
      visible: this.object3d.visible,
    };
  }
}
```

### 5.3 ThreeRenderer

**File:** `packages/three/src/three-renderer.ts`

The ThreeRenderer implements the `Renderer` interface. Its job is to sync the Quintus node tree into the Three.js scene graph, then call `webglRenderer.render()`.

```typescript
import * as THREE from "three";
import type { Renderer, Scene, Node, AssetLoader } from "@quintus/core";
import { Node2D, Canvas2DDrawContext } from "@quintus/core";
import type { ThreeContext } from "./three-context.js";
import { Node3D } from "./node3d.js";

export class ThreeRenderer implements Renderer {
  private readonly ctx: ThreeContext;

  /**
   * Maps Quintus Node3D → parent THREE.Object3D in the Three.js scene.
   * Used to detect reparenting and manage the Three.js scene graph.
   */
  private readonly parentMap = new WeakMap<Node3D, THREE.Object3D>();

  /**
   * Optional Canvas2D overlay for renderFixed Node2D nodes (HUD, etc.).
   * Rendered on top of the WebGL canvas.
   */
  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayDrawContext: Canvas2DDrawContext | null = null;

  private _dirty = true;
  private _fallbackCamera: THREE.PerspectiveCamera | null = null;

  constructor(ctx: ThreeContext) {
    this.ctx = ctx;
  }

  markRenderDirty(): void {
    this._dirty = true;
  }

  render(scene: Scene): void {
    // 1. Sync Quintus node tree → Three.js scene graph
    this._walkSync(scene, this.ctx.scene);

    // 2. Determine active camera
    const camera = this.ctx.activeCamera ?? this._getDefaultCamera();

    // 3. Render the Three.js scene
    this.ctx.webglRenderer.render(this.ctx.scene, camera);

    // 4. Render 2D overlay (renderFixed Node2D nodes)
    this._renderOverlay(scene);

    this._dirty = false;
  }

  resize(width: number, height: number): void {
    this.ctx.webglRenderer.setSize(width, height, false);
    if (this.overlayCanvas) {
      this.overlayCanvas.width = width;
      this.overlayCanvas.height = height;
    }
  }

  dispose(): void {
    // Note: ThreeContext disposal is owned by ThreePlugin (via game.stopped signal).
    // ThreeRenderer only cleans up its own overlay canvas.
    if (this.overlayCanvas?.parentElement) {
      this.overlayCanvas.remove();
    }
  }

  // === Internal: Tree Sync ===

  /**
   * Walk the Quintus scene tree and sync Node3D instances into the
   * Three.js scene graph. Handles add and reparent.
   * Removal is handled by Node3D.onExitTree().
   *
   * NOTE: This traverses ALL nodes including non-3D subtrees. In full 3D mode
   * this is acceptable (most nodes are Node3D). If profiling shows this is a
   * bottleneck for scenes with large non-3D subtrees, optimize by maintaining
   * a dirty set of Node3D nodes registered via onEnterTree/onExitTree hooks.
   */
  private _walkSync(node: Node, threeParent: THREE.Object3D): void {
    if (node instanceof Node3D) {
      const prevParent = this.parentMap.get(node);
      if (prevParent !== threeParent) {
        // Add or reparent
        if (prevParent) prevParent.remove(node.object3d);
        threeParent.add(node.object3d);
        this.parentMap.set(node, threeParent);
      }

      // Recurse children — Node3D children attach under this node's object3d
      for (const child of node.children) {
        this._walkSync(child, node.object3d);
      }
    } else {
      // Non-3D node — recurse children under the same Three.js parent
      for (const child of node.children) {
        this._walkSync(child, threeParent);
      }
    }
  }

  private _getDefaultCamera(): THREE.Camera {
    if (!this._fallbackCamera) {
      this._fallbackCamera = new THREE.PerspectiveCamera(
        75,
        this.ctx.webglRenderer.domElement.width / this.ctx.webglRenderer.domElement.height,
        0.1,
        1000,
      );
      this._fallbackCamera.position.set(0, 5, 10);
      this._fallbackCamera.lookAt(0, 0, 0);
    }
    return this._fallbackCamera;
  }

  // === Internal: 2D Overlay ===

  /**
   * Render Node2D nodes with renderFixed=true as a Canvas2D overlay.
   * This enables HUD/UI elements in full-3D mode.
   * Uses an exported Canvas2DDrawContext so nodes get a full DrawContext.
   */
  private _renderOverlay(scene: Scene): void {
    // Collect renderFixed Node2D nodes
    const overlayNodes: Node2D[] = [];
    this._collectOverlayNodes(scene, overlayNodes);

    if (overlayNodes.length === 0) {
      if (this.overlayCanvas) this.overlayCanvas.style.display = "none";
      return;
    }

    // Ensure overlay canvas exists.
    // Both canvases are wrapped in a positioned container div so CSS scaling
    // (fit/fill mode) applied by Game._setupScaling() affects both equally.
    if (!this.overlayCanvas) {
      this.overlayCanvas = document.createElement("canvas");
      const webglCanvas = this.ctx.webglRenderer.domElement;
      this.overlayCanvas.width = webglCanvas.width;
      this.overlayCanvas.height = webglCanvas.height;

      // Wrap both canvases in a positioned container so absolute positioning
      // and any CSS transforms (fit/fill scaling) apply to both.
      let container = webglCanvas.parentElement;
      if (!container?.dataset.threeOverlayContainer) {
        container = document.createElement("div");
        container.dataset.threeOverlayContainer = "1";
        container.style.cssText = "position: relative; width: 100%; height: 100%;";
        webglCanvas.parentElement?.insertBefore(container, webglCanvas);
        container.appendChild(webglCanvas);
      }
      this.overlayCanvas.style.cssText = `
        position: absolute; top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: none;
      `;
      container.appendChild(this.overlayCanvas);
      const ctx2d = this.overlayCanvas.getContext("2d")!;
      // Canvas2DDrawContext is exported from @quintus/core for this purpose
      this.overlayDrawContext = new Canvas2DDrawContext(ctx2d, scene.game.assets);
    }

    this.overlayCanvas.style.display = "";
    const drawCtx = this.overlayDrawContext;
    if (!drawCtx) return;

    const ctx2d = drawCtx.ctx;
    ctx2d.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    // Sort by zIndex and render each overlay node
    overlayNodes.sort((a, b) => a.zIndex - b.zIndex);
    for (const node of overlayNodes) {
      ctx2d.save();
      const t = node.globalTransform;
      ctx2d.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
      if (node.alpha < 1) ctx2d.globalAlpha = node.alpha;
      node.onDraw(drawCtx);
      ctx2d.restore();
    }
  }

  private _warnedNode2DIds = new Set<number>();

  private _collectOverlayNodes(node: Node, list: Node2D[]): void {
    if (node instanceof Node2D && node.visible) {
      if (node.renderFixed) {
        list.push(node);
      } else if (!this._warnedNode2DIds.has(node.id)) {
        // Warn once per node: non-renderFixed Node2D is invisible in full-3D mode
        this._warnedNode2DIds.add(node.id);
        console.warn(
          `Node2D "${node.name || node.constructor.name}" will not render in full-3D mode. ` +
          `Set renderFixed=true for HUD/overlay elements, or use Node3D for 3D content.`,
        );
      }
    }
    for (const child of node.children) {
      this._collectOverlayNodes(child, list);
    }
  }
}
```

### 5.4 Node3D Lifecycle Integration

**Approach: Hybrid.** Addition is renderer-driven (ThreeRenderer walks the tree each frame and syncs). Removal is node-driven (Node3D.onExitTree removes itself from the Three.js parent). This provides:
- Automatic reparenting via the renderer walk
- Immediate cleanup on node removal via `onExitTree`
- No stale references — Node3D doesn't need a reference to ThreeContext

**Scene transitions** are handled by ThreePlugin, which connects to `game.sceneSwitched` and calls `ctx.scene.clear()` + resets `ctx.activeCamera` when the game switches scenes. This prevents stale Three.js objects from accumulating.

### 5.5 Full-3D Mode Usage

```typescript
import { Game, Scene } from "@quintus/core";
import * as THREE from "three";
import { ThreePlugin, Node3D, MeshNode, Camera3D, AmbientLight, DirectionalLight } from "@quintus/three";

class RotatingCube extends MeshNode {
  geometry = new THREE.BoxGeometry(1, 1, 1);
  material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

  onUpdate(dt: number) {
    this.rotation.x += dt;
    this.rotation.y += dt * 0.5;
  }
}

// Full 3D: renderer: null prevents Canvas2DRenderer, ThreePlugin installs ThreeRenderer
const game = new Game({ width: 800, height: 600, renderer: null });
game.use(ThreePlugin({ antialias: true }));

class MainScene extends Scene {
  onReady() {
    this.add(AmbientLight, { intensity: 0.4 });
    this.add(DirectionalLight, { intensity: 0.8 });
    this.add(Camera3D, { fov: 75, near: 0.1, far: 1000 });
    this.add(RotatingCube);
  }
}

game.start(MainScene);
```

---

## 6. Phase 3: MeshNode + Camera3D + Lights

### 6.1 Deliverables

- [x]Create `MeshNode` — Node3D with lazy `THREE.Mesh` creation
- [x]Create `PointsNode` — Node3D with lazy `THREE.Points` creation
- [x]Create `Camera3D` — Node3D with lazy `THREE.PerspectiveCamera` or `THREE.OrthographicCamera`
- [x]Create `DirectionalLight`, `PointLight`, `AmbientLight` — Node3D wrappers with lazy creation
- [x]Camera3D auto-registers as `ThreeContext.activeCamera` when added to tree
- [x]Camera3D updates aspect ratio on game resize
- [x]Light nodes dispose shadow maps in `onDestroy()`
- [x]Write tests for all node types

### 6.2 MeshNode

**File:** `packages/three/src/mesh-node.ts`

MeshNode stores geometry, material, and shadow props as plain properties. The `THREE.Mesh` is created lazily via `_createObject3D()`, so `add(MeshNode, { geometry, material })` works correctly.

```typescript
import * as THREE from "three";
import { Node3D } from "./node3d.js";

export class MeshNode extends Node3D {
  /** Geometry for the mesh. Default: BoxGeometry(1,1,1). */
  geometry?: THREE.BufferGeometry;
  /** Material for the mesh. Default: MeshStandardMaterial({ color: 0xcccccc }). */
  material?: THREE.Material;
  /** Whether this mesh casts shadows. Default: false. */
  castShadow = false;
  /** Whether this mesh receives shadows. Default: false. */
  receiveShadow = false;

  protected override _createObject3D(): THREE.Mesh {
    const geo = this.geometry ?? new THREE.BoxGeometry(1, 1, 1);
    const mat = this.material ?? new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = this.castShadow;
    mesh.receiveShadow = this.receiveShadow;
    return mesh;
  }

  /** The underlying THREE.Mesh (typed convenience accessor). */
  get mesh(): THREE.Mesh {
    return this.object3d as THREE.Mesh;
  }

  override onDestroy(): void {
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      for (const m of this.mesh.material) m.dispose();
    } else {
      this.mesh.material.dispose();
    }
  }
}
```

### 6.3 PointsNode

**File:** `packages/three/src/points-node.ts`

For particle systems, star fields, and other point-based geometry. Uses `THREE.Points` (not `THREE.Mesh`).

```typescript
import * as THREE from "three";
import { Node3D } from "./node3d.js";

export class PointsNode extends Node3D {
  geometry?: THREE.BufferGeometry;
  material?: THREE.PointsMaterial;

  protected override _createObject3D(): THREE.Points {
    const geo = this.geometry ?? new THREE.BufferGeometry();
    const mat = this.material ?? new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });
    return new THREE.Points(geo, mat);
  }

  get points(): THREE.Points {
    return this.object3d as THREE.Points;
  }

  override onDestroy(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
```

### 6.4 Camera3D

**File:** `packages/three/src/camera3d.ts`

Camera3D stores all config as plain properties. The THREE.Camera is created lazily, reading property values at creation time.

```typescript
import * as THREE from "three";
import { Node3D } from "./node3d.js";
import { getThreeContext } from "./three-plugin.js";

export class Camera3D extends Node3D {
  /** Field of view in degrees. Default: 75. */
  fov = 75;
  /** Near clipping plane. Default: 0.1. */
  near = 0.1;
  /** Far clipping plane. Default: 1000. */
  far = 1000;
  /** Use orthographic instead of perspective. Default: false. */
  orthographic = false;
  /** Orthographic frustum size. Default: 10. */
  orthoSize = 10;
  /** Make this the active camera. Default: true. */
  active = true;

  /** Target node to follow (smooth follow). */
  follow: Node3D | null = null;
  /** Follow offset. */
  followOffset = new THREE.Vector3(0, 5, 10);
  /** Follow smoothing (0 = instant, higher = slower). */
  followSmoothing = 5;

  protected override _createObject3D(): THREE.Camera {
    if (this.orthographic) {
      return new THREE.OrthographicCamera(
        -this.orthoSize, this.orthoSize, this.orthoSize, -this.orthoSize,
        this.near, this.far,
      );
    }
    // Aspect ratio updated in onEnterTree when we know game dimensions
    return new THREE.PerspectiveCamera(this.fov, 1, this.near, this.far);
  }

  /** The underlying THREE.Camera (typed convenience accessor). */
  get camera(): THREE.Camera {
    return this.object3d as THREE.Camera;
  }

  override onEnterTree(): void {
    super.onEnterTree();
    // Set aspect ratio from game dimensions
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const game = this.gameOrNull;
      if (game) {
        this.camera.aspect = game.width / game.height;
        this.camera.updateProjectionMatrix();
      }
    }
    if (this.active) {
      this._registerAsActive();
    }
  }

  override onUpdate(dt: number): void {
    // Update aspect ratio on resize (set once in onEnterTree but needs
    // updating if window/canvas dimensions change at runtime)
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const game = this.gameOrNull;
      if (game) {
        const aspect = game.width / game.height;
        if (Math.abs(this.camera.aspect - aspect) > 0.001) {
          this.camera.aspect = aspect;
          this.camera.updateProjectionMatrix();
        }
      }
    }

    if (this.follow) {
      const target = this.follow.object3d.position;
      const desired = target.clone().add(this.followOffset);
      this.position.lerp(desired, 1 - Math.exp(-this.followSmoothing * dt));
      this.object3d.lookAt(target);
    }
  }

  private _registerAsActive(): void {
    const ctx = this.gameOrNull ? getThreeContext(this.game) : null;
    if (ctx) {
      ctx.activeCamera = this.camera;
    }
  }
}
```

### 6.5 Light Nodes

**File:** `packages/three/src/lights.ts`

Light nodes store color and intensity as plain properties for `add(Class, { props })` compatibility. The Three.js light object is created lazily.

```typescript
import * as THREE from "three";
import { Node3D } from "./node3d.js";

export class AmbientLight extends Node3D {
  color: THREE.ColorRepresentation = 0xffffff;
  intensity = 0.5;

  protected override _createObject3D(): THREE.AmbientLight {
    return new THREE.AmbientLight(this.color, this.intensity);
  }

  get light(): THREE.AmbientLight {
    return this.object3d as THREE.AmbientLight;
  }
}

export class DirectionalLight extends Node3D {
  color: THREE.ColorRepresentation = 0xffffff;
  intensity = 1;
  castShadow = false;
  shadowMapSize = 1024;

  protected override _createObject3D(): THREE.DirectionalLight {
    const light = new THREE.DirectionalLight(this.color, this.intensity);
    if (this.castShadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(this.shadowMapSize, this.shadowMapSize);
    }
    return light;
  }

  get light(): THREE.DirectionalLight {
    return this.object3d as THREE.DirectionalLight;
  }

  override onDestroy(): void {
    // Dispose shadow map render target if shadows were enabled
    this.light.shadow?.map?.dispose();
  }
}

export class PointLight extends Node3D {
  color: THREE.ColorRepresentation = 0xffffff;
  intensity = 1;
  distance = 0;
  decay = 2;
  castShadow = false;

  protected override _createObject3D(): THREE.PointLight {
    const light = new THREE.PointLight(this.color, this.intensity, this.distance, this.decay);
    if (this.castShadow) {
      light.castShadow = true;
    }
    return light;
  }

  get light(): THREE.PointLight {
    return this.object3d as THREE.PointLight;
  }

  override onDestroy(): void {
    this.light.shadow?.map?.dispose();
  }
}
```

---

## 7. Phase 4: GLTFModel + Billboard + Assets

### 7.1 Deliverables

- [x]Create `GLTFModel` — GLTF/GLB node loading from the asset system
- [x]GLTFModel uses `SkeletonUtils.clone()` for correct skinned mesh cloning
- [x]GLTFModel `onDestroy()` recursively disposes all GPU resources (geometry, material, textures)
- [x]Create `Billboard` — sprite in 3D space, always faces camera
- [x]Billboard `onDestroy()` disposes both material and texture
- [x]GLTF asset loaders registered by ThreePlugin (done in Phase 1)
- [x]Write tests for GLTF loading (mock) and Billboard orientation

### 7.2 GLTFModel

**File:** `packages/three/src/gltf-model.ts`

GLTFModel loads models from the **asset system**. Models must be preloaded via `game.assets.load()` before the scene starts. `onReady()` is synchronous — it reads the pre-loaded GLTF data from the asset cache.

```typescript
import * as THREE from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { Node3D } from "./node3d.js";

export class GLTFModel extends Node3D {
  /**
   * Asset name — the key returned by nameFromPath(). AssetLoader strips the
   * directory prefix and file extension, so "models/character.glb" becomes "character".
   * Use the stripped name: `src: "character"` (not the full path).
   */
  src = "";
  /** Auto-play the first animation. Default: false. */
  autoplay = false;
  /** Scale multiplier applied to the loaded model. Default: 1. */
  modelScale = 1;
  /** Cast shadows on all child meshes. Default: false. */
  castShadow = false;
  /** Receive shadows on all child meshes. Default: false. */
  receiveShadow = false;

  private _mixer: THREE.AnimationMixer | null = null;
  private _animations: Map<string, THREE.AnimationClip> = new Map();
  private _currentAction: THREE.AnimationAction | null = null;
  private _loaded = false;

  get loaded(): boolean {
    return this._loaded;
  }

  /** Available animation names after loading. */
  get animationNames(): string[] {
    return Array.from(this._animations.keys());
  }

  /** Play a named animation. */
  play(name: string, loop = true): void {
    const clip = this._animations.get(name);
    if (!clip || !this._mixer) return;

    if (this._currentAction) {
      this._currentAction.fadeOut(0.3);
    }

    const action = this._mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.reset().fadeIn(0.3).play();
    this._currentAction = action;
  }

  /** Stop all animations. */
  stop(): void {
    this._mixer?.stopAllAction();
    this._currentAction = null;
  }

  override onReady(): void {
    if (!this.src) return;

    // Get pre-loaded GLTF from asset system.
    // AssetLoader.nameFromPath() strips directory and extension:
    //   "models/character.glb" → stored as "character"
    // So this.src should be the stripped name (e.g., "character").
    const gltf = this.game.assets.get<GLTF>(this.src);
    if (!gltf) {
      console.warn(
        `GLTFModel: asset "${this.src}" not found. ` +
        `Ensure asset was preloaded and src uses the stripped name ` +
        `(e.g., "character" for "models/character.glb").`,
      );
      return;
    }
    this._applyModel(gltf);
  }

  override onUpdate(dt: number): void {
    this._mixer?.update(dt);
  }

  override onDestroy(): void {
    if (this._mixer) {
      this._mixer.stopAllAction();
    }
    // Dispose all GPU resources from the loaded model to prevent memory leaks.
    // THREE.Scene.clear() only removes children — it does NOT dispose resources.
    this._disposeRecursive(this.object3d);
  }

  /** Recursively traverse and dispose all geometries, materials, and textures. */
  private _disposeRecursive(obj: THREE.Object3D): void {
    for (const child of [...obj.children]) {
      this._disposeRecursive(child);
    }
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        // Dispose all texture maps on the material
        for (const value of Object.values(mat)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        mat.dispose();
      }
    }
  }

  private _applyModel(gltf: GLTF): void {
    // Use SkeletonUtils.clone so skinned meshes correctly clone skeleton + bone
    // bindings. For non-skinned models this works identically to scene.clone().
    // Note: materials are shared across clones by default. If per-instance material
    // changes are needed (e.g., damage tint), users must call material.clone()
    // on the specific meshes they want to modify.
    const model = SkeletonUtils.clone(gltf.scene);
    if (this.modelScale !== 1) {
      model.scale.setScalar(this.modelScale);
    }
    this.object3d.add(model);

    // Set up shadow casting
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = this.castShadow;
        child.receiveShadow = this.receiveShadow;
      }
    });

    // Set up animations
    if (gltf.animations.length > 0) {
      this._mixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) {
        this._animations.set(clip.name, clip);
      }
      if (this.autoplay && gltf.animations.length > 0) {
        this.play(gltf.animations[0]!.name);
      }
    }

    this._loaded = true;
  }
}
```

**Usage pattern:**
```typescript
class Level1 extends Scene {
  async onReady() {
    // Preload assets before building the scene
    await this.game.assets.load({
      glb: ["models/character.glb", "models/enemy.glb"],
      images: ["tiles.png"],
    });

    // GLTFModel reads from the asset cache synchronously.
    // AssetLoader strips directory + extension: "models/character.glb" → "character"
    const player = this.add(GLTFModel, { src: "character", autoplay: true });
    const enemy = this.add(GLTFModel, { src: "enemy" });
  }
}
```

### 7.3 Billboard

**File:** `packages/three/src/billboard.ts`

A Billboard renders a 2D sprite texture in 3D space, always facing the camera. Useful for health bars, damage numbers, enemy sprites in 2.5D games.

```typescript
import * as THREE from "three";
import { Node3D } from "./node3d.js";
import { getThreeContext } from "./three-plugin.js";

export interface BillboardProps {
  /** Texture asset name or URL. */
  texture?: string;
  /** Width in world units. Default: 1. */
  width?: number;
  /** Height in world units. Default: 1. */
  height?: number;
  /** Only rotate on Y axis (cylindrical billboard). Default: false (spherical). */
  axisLock?: boolean;
  /** Opacity. Default: 1. */
  opacity?: number;
}

export class Billboard extends Node3D {
  width = 1;
  height = 1;
  axisLock = false;
  opacity = 1;

  protected override _createObject3D(): THREE.Sprite {
    const material = new THREE.SpriteMaterial({
      transparent: true,
      opacity: this.opacity,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(this.width, this.height, 1);
    return sprite;
  }

  get sprite(): THREE.Sprite {
    return this.object3d as THREE.Sprite;
  }

  /** Set the texture from a loaded image or URL. */
  setTexture(texture: THREE.Texture): void {
    (this.sprite.material as THREE.SpriteMaterial).map = texture;
    (this.sprite.material as THREE.SpriteMaterial).needsUpdate = true;
  }

  override onUpdate(_dt: number): void {
    if (this.axisLock) {
      // Cylindrical billboard: only rotate on Y axis to face camera
      const ctx = this.gameOrNull ? getThreeContext(this.game) : null;
      const camera = ctx?.activeCamera;
      if (camera) {
        const pos = this.object3d.position;
        const camPos = camera.position;
        this.object3d.rotation.y = Math.atan2(camPos.x - pos.x, camPos.z - pos.z);
      }
    }
    // Spherical billboard is handled automatically by THREE.Sprite
  }

  override onDestroy(): void {
    const mat = this.sprite.material as THREE.SpriteMaterial;
    mat.map?.dispose(); // dispose texture if one was set via setTexture()
    mat.dispose();
  }
}
```

### 7.4 GLTF Asset Loader Registration

GLTF/GLB loaders are registered by ThreePlugin during `install()` (see Phase 1). The asset manifest uses **string arrays** matching the existing `AssetManifest` format:

```typescript
// Correct manifest format — string arrays, not named maps
await game.assets.load({
  glb: ["models/character.glb", "models/enemy.glb"],
  images: ["tiles.png"],
});

// Asset names are derived from paths via nameFromPath(), which strips
// the directory prefix and file extension:
// "models/character.glb" → "character"
// "models/enemy.glb" → "enemy"
const gltf = game.assets.get<GLTF>("character");
```

---

## 8. Phase 5: ThreeLayer (Hybrid Mode)

### 8.1 Deliverables

- [x]Create `ThreeLayer` — Node2D that hosts a Three.js sub-scene
- [x]ThreeLayer renders via the shared WebGLRenderer (one WebGL context for all layers)
- [x]Support `zIndex` to control whether 3D renders behind or in front of 2D content
- [x]Node3D children of ThreeLayer are rendered in its local Three.js scene
- [x]Composite via `drawCanvas()` on the DrawContext
- [x]Write tests for ThreeLayer compositing

### 8.2 ThreeLayer Design

**File:** `packages/three/src/three-layer.ts`

ThreeLayer is a Node2D that hosts its own Three.js scene. It's used in Mode 2 (2D game + 3D effects) where the Canvas2DRenderer remains the primary renderer.

**Key design:** All ThreeLayer instances share the **single WebGLRenderer** from ThreeContext (created as an offscreen canvas in hybrid mode). Each layer renders to the shared canvas during its `onDraw()` call, then composites it onto the 2D canvas via `drawCanvas()`. This avoids creating multiple WebGL contexts (browsers limit to 8-16 per page).

**Multiple ThreeLayers caveat:** Each ThreeLayer performs a full WebGL render pass (setClearColor + clear + render) on the shared renderer, then composites via `drawImage`. The Canvas2DRenderer's z-sort ensures layers are drawn in zIndex order. However, each layer resets WebGL state (clear color, viewport size), so ordering is critical. Performance scales linearly with the number of ThreeLayers — 2 layers = 2 full render passes + 2 compositing operations. Keep the number of ThreeLayers low (1-2 per scene).

```
Canvas2DRenderer output:
┌──────────────────────┐
│  ThreeLayer          │  zIndex: -100 (behind)
│  ┌────────────────┐  │
│  │ shared WebGL   │  │  ← renders to shared canvas, then drawImage
│  │ (offscreen)    │  │
│  └────────────────┘  │
│──────────────────────│
│  2D game content     │  zIndex: 0
│  ├── TileMap         │
│  ├── Player (Actor)  │
│  └── Enemies         │
│──────────────────────│
│  HUD (UILayer)       │  zIndex: 100 (on top)
└──────────────────────┘
```

```typescript
import * as THREE from "three";
import { Node2D } from "@quintus/core";
import type { DrawContext, Node } from "@quintus/core";
import { getThreeContext } from "./three-plugin.js";
import { Node3D } from "./node3d.js";

export class ThreeLayer extends Node2D {
  /** The Three.js scene for this layer's 3D content. */
  readonly threeScene: THREE.Scene;

  /** The camera for this layer. Set by a child Camera3D or manually. */
  camera: THREE.Camera | null = null;

  private _width: number;
  private _height: number;
  private _clearColor: THREE.Color;
  private _clearAlpha: number;
  /** Cached last setSize values to avoid calling setSize every frame. */
  private _lastSetW = 0;
  private _lastSetH = 0;

  constructor() {
    super();
    this.threeScene = new THREE.Scene();
    this._width = 0;  // 0 = auto from game
    this._height = 0;
    this._clearColor = new THREE.Color(0x000000);
    this._clearAlpha = 0;
  }

  override onUpdate(_dt: number): void {
    this._syncChildren();
  }

  /**
   * onDraw is called by the Canvas2DRenderer.
   * We render the Three.js scene to the shared WebGL canvas,
   * then composite it onto the 2D canvas via drawCanvas().
   */
  override onDraw(ctx: DrawContext): void {
    const threeCtx = this.gameOrNull ? getThreeContext(this.game) : null;
    if (!threeCtx) return;

    const camera = this.camera ?? this._findChildCamera();
    if (!camera) return;

    const renderer = threeCtx.webglRenderer;
    const w = this._width || this.game.width;
    const h = this._height || this.game.height;

    // Only call setSize when dimensions actually change (setSize is not trivial —
    // it updates canvas dimensions and the WebGL viewport).
    if (w !== this._lastSetW || h !== this._lastSetH) {
      renderer.setSize(w, h, false);
      this._lastSetW = w;
      this._lastSetH = h;
    }
    renderer.setClearColor(this._clearColor, this._clearAlpha);
    renderer.clear();
    renderer.render(this.threeScene, camera);

    // Composite the WebGL canvas onto the 2D canvas
    ctx.drawCanvas?.(renderer.domElement, 0, 0);
  }

  override onDestroy(): void {
    this.threeScene.clear();
  }

  /** Walk children and add Node3D instances to the Three.js scene. */
  private _syncChildren(): void {
    for (const child of this.children) {
      this._syncNode(child, this.threeScene);
    }
  }

  private _syncNode(node: Node, parent: THREE.Object3D): void {
    if (node instanceof Node3D) {
      if (node.object3d.parent !== parent) {
        parent.add(node.object3d);
      }
      for (const child of node.children) {
        this._syncNode(child, node.object3d);
      }
    } else {
      for (const child of node.children) {
        this._syncNode(child, parent);
      }
    }
  }

  private _findChildCamera(): THREE.Camera | null {
    for (const child of this.children) {
      if (child instanceof Node3D && child.object3d instanceof THREE.Camera) {
        return child.object3d;
      }
    }
    return null;
  }
}
```

### 8.3 ThreeLayer Usage Example

```typescript
import { Game, Scene, Actor } from "@quintus/core";
import { ThreePlugin, ThreeLayer, MeshNode, Camera3D, AmbientLight } from "@quintus/three";

class Level1 extends Scene {
  onReady() {
    // 3D background layer
    const bg = this.add(ThreeLayer, { zIndex: -100 });
    bg.add(Camera3D, { fov: 60 });
    bg.add(AmbientLight, { intensity: 0.6 });
    const cube = bg.add(RotatingCube);

    // 2D game content (normal Quintus 2D)
    const map = this.add(TileMap);
    map.asset = "level1.json";

    const player = this.add(Player);
    player.position = new Vec2(100, 400);

    // HUD
    this.add(HealthBar, { renderFixed: true, zIndex: 100 });
  }
}

const game = new Game({ width: 800, height: 600 });
game.use(ThreePlugin());  // Hybrid mode: Canvas2DRenderer stays, offscreen WebGL created
game.start(Level1);
```

---

## 9. Phase 6: Example Game + Integration Tests

### 9.1 Deliverables

- [x]Create `examples/3d-cube/` — minimal 3D rotating cube example
- [x]Create `examples/3d-platformer/` — hybrid 2D game + 3D background
- [x]Write integration tests (headless mocking for Three.js)
- [x]Verify `pnpm build` succeeds for `@quintus/three`
- [x]Verify `pnpm lint` passes
- [x]Document the Three.js integration in code comments

### 9.2 Example: 3D Rotating Cube

**File:** `examples/3d-cube/main.ts`

Minimal demo showing full-3D mode:

```typescript
import { Game, Scene } from "@quintus/core";
import * as THREE from "three";
import {
  ThreePlugin,
  MeshNode,
  Camera3D,
  AmbientLight,
  DirectionalLight,
} from "@quintus/three";

class RotatingCube extends MeshNode {
  geometry = new THREE.BoxGeometry(1, 1, 1);
  material = new THREE.MeshStandardMaterial({ color: 0x44aa88 });

  onUpdate(dt: number) {
    this.rotation.x += dt * 0.5;
    this.rotation.y += dt * 0.7;
  }
}

class MainScene extends Scene {
  onReady() {
    const cam = this.add(Camera3D, { fov: 75 });
    cam.position.set(0, 2, 5);
    cam.lookAt(0, 0, 0);

    this.add(AmbientLight, { intensity: 0.4 });
    const sun = this.add(DirectionalLight, { intensity: 0.8 });
    sun.position.set(5, 10, 5);

    this.add(RotatingCube);
  }
}

// Full 3D: renderer: null + ThreePlugin auto-installs ThreeRenderer
const game = new Game({ width: 800, height: 600, renderer: null });
game.use(ThreePlugin({ antialias: true, background: 0x1a1a2e }));
game.start(MainScene);
```

### 9.3 Example: Hybrid 2D + 3D

**File:** `examples/3d-hybrid/main.ts`

Shows a 2D platformer with a 3D background effect:

```typescript
import { Game, Scene, Node2D } from "@quintus/core";
import type { DrawContext } from "@quintus/core";
import { Vec2, Color } from "@quintus/math";
import * as THREE from "three";
import { ThreePlugin, ThreeLayer, PointsNode, Camera3D, AmbientLight } from "@quintus/three";

class StarField extends PointsNode {
  geometry = (() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(3000);
    for (let i = 0; i < 3000; i += 3) {
      positions[i] = (Math.random() - 0.5) * 100;
      positions[i + 1] = (Math.random() - 0.5) * 100;
      positions[i + 2] = (Math.random() - 0.5) * 100;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  })();
  material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });

  onUpdate(dt: number) {
    this.rotation.y += dt * 0.05;
  }
}

// Simple 2D node for demonstration
class SimpleLabel extends Node2D {
  onDraw(ctx: DrawContext) {
    ctx.text("2D Overlay on 3D Background", new Vec2(-150, 0), {
      color: new Color(1, 1, 1),
      size: 20,
    });
  }
}

class HybridScene extends Scene {
  onReady() {
    // 3D background
    const bg = this.add(ThreeLayer);
    bg.zIndex = -100;
    const cam = bg.add(Camera3D, { fov: 60 });
    cam.position.set(0, 0, 30);
    bg.add(AmbientLight, { intensity: 1 });
    bg.add(StarField);

    // 2D game content
    const label = this.add(SimpleLabel);
    label.position = new Vec2(400, 300);
  }
}

// Hybrid: Canvas2DRenderer stays, ThreePlugin creates offscreen WebGL
const game = new Game({ width: 800, height: 600 });
game.use(ThreePlugin());
game.start(HybridScene);
```

### 9.4 Vite Configuration

The 3D examples need to be added to the Vite dev server:

**File:** `examples/vite.config.ts` (addition)

```typescript
// Add 3D example entry points alongside existing 2D examples
input: {
  // ... existing entries ...
  '3d-cube': resolve(__dirname, '3d-cube/index.html'),
  '3d-hybrid': resolve(__dirname, '3d-hybrid/index.html'),
},
```

---

## 10. Test Plan

### Testing Strategy

Three.js requires WebGL, which isn't available in jsdom/Node.js. Tests use two strategies:

1. **Unit tests with Three.js mocks** — Test Node3D lifecycle, tree sync logic, and serialization without rendering
2. **Integration tests via Playwright** — Visual tests that verify actual WebGL rendering (Phase 6 stretch goal)

### Phase 1 Tests

**File:** `packages/three/src/three-plugin.test.ts`

| Test | What It Verifies |
|------|------------------|
| `ThreePlugin installs (full mode)` | With `renderer: null`, ThreeRenderer is auto-installed |
| `ThreePlugin installs (hybrid mode)` | With existing renderer, renderer is NOT replaced |
| `ThreePlugin provides game.three accessor` | Module augmentation works |
| `game.three throws without install` | Clear error message |
| `ThreeContext creates scene` | THREE.Scene created |
| `dispose is idempotent` | Double `ctx.dispose()` doesn't throw |
| `scene cleared on sceneSwitched` | `game.sceneSwitched` clears THREE.Scene and activeCamera |
| `GLTF asset loaders registered` | `game.assets` has "gltf" and "glb" loaders |

### Phase 2 Tests

**File:** `packages/three/src/node3d.test.ts`

| Test | What It Verifies |
|------|------------------|
| `Node3D lazy object3d creation` | `object3d` not created until first access |
| `Node3D position delegates` | `node.position.set(1,2,3)` modifies object3d |
| `Node3D rotation delegates` | `node.rotation.y = 1` modifies object3d |
| `Node3D serialize() includes 3D data` | Position, rotation, quaternion, scale in snapshot |
| `Node3D visible syncs` | `node.visible = false` sets object3d.visible |
| `Node3D warns on Node2D child` | Console warning when Node2D added under Node3D |
| `Node3D onExitTree removes from parent` | object3d removed from Three.js parent |

**File:** `packages/three/src/three-renderer.test.ts`

| Test | What It Verifies |
|------|------------------|
| `sync adds Node3D to Three.js scene` | Node3D in tree → object3d in THREE.Scene |
| `sync removes Node3D on destroy` | destroy() → object3d removed from THREE.Scene |
| `sync handles reparenting` | Moving Node3D between parents updates Three.js parent |
| `non-3D nodes are transparent` | Plain Node in tree doesn't break sync |
| `nested Node3D hierarchy` | Parent-child Node3D → parent-child object3d |
| `markRenderDirty sets flag` | Flag toggled correctly |
| `overlay renders renderFixed Node2D` | renderFixed nodes rendered via Canvas2DDrawContext |
| `dispose only cleans up overlay` | ThreeRenderer.dispose() doesn't double-dispose ctx |

### Phase 3 Tests

**File:** `packages/three/src/mesh-node.test.ts`

| Test | What It Verifies |
|------|------------------|
| `MeshNode creates mesh lazily` | THREE.Mesh created on first object3d access |
| `MeshNode uses provided geometry/material` | Custom props applied before creation |
| `add(MeshNode, { geometry }) works` | Props via Object.assign create correct mesh |
| `dispose cleans up GPU resources` | geometry.dispose() and material.dispose() called |
| `shadow props` | castShadow/receiveShadow set correctly |

**File:** `packages/three/src/camera3d.test.ts`

| Test | What It Verifies |
|------|------------------|
| `Camera3D creates perspective camera` | Default is PerspectiveCamera |
| `Camera3D creates orthographic camera` | `orthographic: true` option |
| `add(Camera3D, { fov: 90 }) uses correct fov` | Lazy creation reads current props |
| `active camera registers` | `threeContext.activeCamera` set on enterTree |
| `follow target` | Camera lerps toward follow target position |
| `aspect ratio from game` | PerspectiveCamera.aspect matches game width/height |

**File:** `packages/three/src/lights.test.ts`

| Test | What It Verifies |
|------|------------------|
| `add(AmbientLight, { intensity: 0.4 })` | Lazy creation uses correct intensity |
| `DirectionalLight with shadows` | Shadow map configured when castShadow=true |
| `PointLight with distance/decay` | Properties passed through |

### Phase 4 Tests

**File:** `packages/three/src/gltf-model.test.ts`

| Test | What It Verifies |
|------|------------------|
| `GLTFModel loads from asset system` | Reads pre-loaded GLTF from game.assets |
| `GLTFModel warns if asset missing` | Console warning with helpful message |
| `GLTFModel clones scene` | Multiple instances don't share the same scene |
| `animationNames populated` | Animation clips registered after load |
| `play/stop animations` | AnimationMixer actions created and controlled |
| `modelScale applied` | Loaded model scaled correctly |

**File:** `packages/three/src/billboard.test.ts`

| Test | What It Verifies |
|------|------------------|
| `Billboard creates sprite lazily` | THREE.Sprite with material |
| `axisLock rotates on Y only` | Cylindrical billboard behavior |
| `setTexture updates material` | Texture assignment works |
| `dispose cleans up material` | Material disposed on destroy |

### Phase 5 Tests

**File:** `packages/three/src/three-layer.test.ts`

| Test | What It Verifies |
|------|------------------|
| `ThreeLayer uses shared WebGLRenderer` | No new WebGL context created |
| `ThreeLayer syncs Node3D children` | Children added to Three.js sub-scene |
| `ThreeLayer disposes its scene` | threeScene.clear() called on destroy |
| `ThreeLayer finds child Camera3D` | Auto-detects camera from children |
| `Multiple ThreeLayers share context` | Single WebGL context used by all |

### Error Path Tests

**File:** `packages/three/src/error-paths.test.ts`

These tests cover failure modes and edge cases not covered by the happy-path tests above:

| Test | What It Verifies |
|------|------------------|
| `ThreePlugin double-install is idempotent` | Second `game.use(ThreePlugin())` does not create a second context or overwrite the first |
| `Camera3D destroyed while active` | Destroying the active Camera3D sets `ctx.activeCamera = null`, renderer falls back to default |
| `GLTFModel with wrong src shows warning` | Helpful console warning when `game.assets.get()` returns null |
| `_createObject3D throw is contained` | A subclass that throws in `_createObject3D` does not crash the renderer |
| `game.stop() during render` | No errors if game is stopped mid-frame |
| `Node2D without renderFixed in 3D scene warns` | ThreeRenderer emits console warning (once per node) |
| `GLTFModel.onDestroy disposes recursively` | All geometries, materials, textures disposed (spy on dispose calls) |
| `Light shadow map disposed on destroy` | DirectionalLight/PointLight shadow render targets cleaned up |
| `Billboard texture disposed on destroy` | SpriteMaterial and its map texture both disposed |
| `Camera3D aspect updates on resize` | Aspect ratio corrected after game dimensions change |

### Mock Strategy

For tests that need Three.js without WebGL (most unit tests), use a minimal mock:

**File:** `packages/three/src/__mocks__/three-mock.ts`

```typescript
// Minimal Three.js mocks for testing without WebGL
export class Object3D {
  position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x=x; this.y=y; this.z=z; }, clone() { return {...this}; }, add(v) { this.x+=v.x; this.y+=v.y; this.z+=v.z; return this; }, lerp(t, a) {} };
  rotation = { x: 0, y: 0, z: 0, order: "XYZ" };
  quaternion = { x: 0, y: 0, z: 0, w: 1 };
  scale = { x: 1, y: 1, z: 1, set(x,y,z) { this.x=x; this.y=y; this.z=z; }, setScalar(s) { this.x=s; this.y=s; this.z=s; } };
  visible = true;
  parent: Object3D | null = null;
  children: Object3D[] = [];
  userData: Record<string, unknown> = {};
  add(child: Object3D) { this.children.push(child); child.parent = this; }
  remove(child: Object3D) { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1); child.parent = null; }
  lookAt() {}
  traverse(fn: (o: Object3D) => void) { fn(this); for (const c of this.children) c.traverse(fn); }
}
// ... additional mocks as needed
```

Alternatively, use `vitest.mock("three")` with auto-mocking for simpler cases.

---

## 11. Definition of Done

### All Phases Complete

- [x]`@quintus/three` package compiles with `pnpm build`
- [x]`pnpm test` passes for all `@quintus/three` tests
- [x]`pnpm lint` clean
- [x]`three` is a peer dependency (NOT bundled)
- [x]Zero impact on 2D-only games (no Three.js code loaded unless imported)
- [x]`Canvas2DDrawContext` exported from `@quintus/core`
- [x]`drawCanvas()` added to `DrawContext` interface
- [x]`game.hasRenderer` public getter added to `Game`

### Feature Checklist

- [x]`ThreePlugin` installs, auto-detects full vs hybrid mode, and provides `game.three` accessor
- [x]`ThreeRenderer` implements `Renderer` and syncs Quintus → Three.js scene graph
- [x]`Node3D` extends `Node` with lazy `_createObject3D()` pattern and serialize()
- [x]`MeshNode` renders THREE.Mesh with geometry + material
- [x]`PointsNode` renders THREE.Points for particle effects
- [x]`Camera3D` supports perspective and orthographic modes with follow
- [x]`AmbientLight`, `DirectionalLight`, `PointLight` all functional
- [x]`GLTFModel` loads .glb/.gltf from the asset system, plays animations, disposes GPU resources on destroy
- [x]`Billboard` renders sprites in 3D space, always faces camera, disposes material + texture on destroy
- [x]`ThreeLayer` composites 3D content within a 2D Canvas2DRenderer game (shared WebGL context)
- [x]2D UI overlay works in full-3D mode (`renderFixed` Node2D nodes via Canvas2DDrawContext)
- [x]Scene transitions clear Three.js scene via `game.sceneSwitched` signal
- [x]Node2D-under-Node3D validated with runtime warning
- [x]Non-renderFixed Node2D in full-3D scene emits console warning
- [x]Two example games run in browser via `pnpm dev`

### Size Budget

- `@quintus/three` package: **<5KB gzipped** (Three.js itself is a peer dep, not counted)
- Three.js peer dep: ~600KB (user's responsibility)

### What's NOT In Scope (But Planned for Follow-Up)

- **3D raycasting / picking** — screen-to-world ray conversion for clicking 3D objects (`THREE.Raycaster` + `setFromCamera`). Essential for interactive 3D games. Planned as a `Camera3D.raycastFromScreen(screenX, screenY)` convenience method or a `ThreeContext.raycast()` helper in a follow-up. Users can access `THREE.Raycaster` directly via `game.three.scene` in the meantime.
- **Post-processing** — `EffectComposer` integration for bloom, SSAO, etc. Requires a separate render target.
- **Fog, skybox, environment maps** — configurable directly via `game.three.scene.fog = new THREE.Fog(...)`.

### What's NOT In Scope

- WebGPU renderer (Three.js has experimental WebGPU support, but it's not stable enough)
- 3D physics (Rapier, Cannon.js, Ammo.js) — users compose their own
- 3D audio (positional audio with Three.js AudioListener) — could be a separate plugin
- Node3D in `@quintus/core` — stays in `@quintus/three` since it requires Three.js types (see math types trade-off in Section 3)
- Custom Vec3/Quaternion in `@quintus/math` — Three.js types used directly (revisit if `@quintus/physics3d` is built)
