# 3D Implementation Plan

How Quintus 2.0 extends from a focused 2D engine to support 3D games.

---

## Philosophy

Quintus starts as a 2D engine and adds 3D as a **parallel capability**, not a replacement. The approach mirrors Godot's separation of 2D and 3D: they share the same scene tree, lifecycle, signals, and game loop, but use different transform types and renderers. Three.js handles all 3D rendering — we don't build a 3D renderer from scratch.

The key insight: most of the engine is dimension-agnostic. The game loop, signal system, input handling, scene management, plugin system, audio, tweens, and UI all work identically whether the game is 2D or 3D. Only transforms, rendering, physics, and camera need parallel 3D implementations.

---

## What Already Works for 3D (No Changes Needed)

These core systems are dimension-agnostic by design:

| System | Why it works as-is |
|--------|-------------------|
| `Node` base class | Pure logic node: parent/child tree, lifecycle, signals, tags, pause modes — no spatial concept |
| `Signal<T>` | Typed observer pattern, no spatial assumptions |
| `GameLoop` | Fixed timestep + variable render — renderer-agnostic |
| `Scene` | Node tree factory and manager — doesn't care about dimensions |
| Plugin system | `Plugin.install(game)` — renderers are just plugins |
| `SeededRandom` | Deterministic RNG — universal |
| `@quintus/input` | Action maps, keyboard, mouse, gamepad — same for 2D and 3D games |
| `@quintus/audio` | Web Audio API playback (spatial audio extends naturally) |
| `@quintus/tween` | Tweens animate arbitrary properties — works on Vec3, Quaternion, anything |
| `@quintus/ui` | HUD overlays render in 2D screen space on top of 3D — no change needed |
| `@quintus/headless` | Node.js runtime for simulation — renderer-agnostic |
| `@quintus/test` | Input scripts and assertions — works on any node type |
| `@quintus/mcp` | AI tool integration — queries scene tree regardless of dimension |

This is roughly 60% of the engine by code volume. The 2D-first approach doesn't create technical debt — it creates a solid foundation.

---

## Core Changes Required

### 1. New Math Types in `@quintus/math`

The math package needs 3D equivalents. These are additive — nothing in Vec2 or Matrix2D changes.

```typescript
// New types to add
export class Vec3 {
  constructor(public x: number, public y: number, public z: number) {}

  static readonly ZERO = new Vec3(0, 0, 0);
  static readonly ONE = new Vec3(1, 1, 1);
  static readonly UP = new Vec3(0, 1, 0);
  static readonly FORWARD = new Vec3(0, 0, -1);
  static readonly RIGHT = new Vec3(1, 0, 0);

  add(other: Vec3): Vec3 { ... }
  sub(other: Vec3): Vec3 { ... }
  scale(s: number): Vec3 { ... }
  dot(other: Vec3): number { ... }
  cross(other: Vec3): Vec3 { ... }  // Returns Vec3 (not scalar like Vec2)
  length(): number { ... }
  normalized(): Vec3 { ... }
  lerp(to: Vec3, t: number): Vec3 { ... }
  distanceTo(other: Vec3): number { ... }
}

export class Quaternion {
  constructor(public x: number, public y: number, public z: number, public w: number) {}

  static readonly IDENTITY = new Quaternion(0, 0, 0, 1);

  static fromEuler(x: number, y: number, z: number): Quaternion { ... }
  static fromAxisAngle(axis: Vec3, angle: number): Quaternion { ... }
  static lookRotation(forward: Vec3, up?: Vec3): Quaternion { ... }

  toEuler(): Vec3 { ... }
  multiply(other: Quaternion): Quaternion { ... }
  rotateVec3(v: Vec3): Vec3 { ... }
  slerp(to: Quaternion, t: number): Quaternion { ... }
  inverse(): Quaternion { ... }
}

export class Matrix4 {
  readonly elements: Float64Array; // 16 elements, column-major

  static readonly IDENTITY: Matrix4;

  static compose(position: Vec3, rotation: Quaternion, scale: Vec3): Matrix4 { ... }
  static perspective(fov: number, aspect: number, near: number, far: number): Matrix4 { ... }
  static orthographic(left: number, right: number, bottom: number, top: number, near: number, far: number): Matrix4 { ... }
  static lookAt(eye: Vec3, target: Vec3, up: Vec3): Matrix4 { ... }

  multiply(other: Matrix4): Matrix4 { ... }
  inverse(): Matrix4 { ... }
  transformPoint(v: Vec3): Vec3 { ... }
  decompose(): { position: Vec3; rotation: Quaternion; scale: Vec3 } { ... }
}

export class AABB3 {
  constructor(public min: Vec3, public max: Vec3) {}
  intersects(other: AABB3): boolean { ... }
  contains(point: Vec3): boolean { ... }
  expandToInclude(point: Vec3): AABB3 { ... }
}
```

**Important:** These types are designed to interop with Three.js vectors and quaternions but remain independent — the math package has no Three.js dependency. Conversion happens at the bridge layer:

```typescript
// In @quintus/three — bridge utilities
function toThreeVec3(v: Vec3): THREE.Vector3 { return new THREE.Vector3(v.x, v.y, v.z); }
function fromThreeVec3(v: THREE.Vector3): Vec3 { return new Vec3(v.x, v.y, v.z); }
function toThreeQuat(q: Quaternion): THREE.Quaternion { return new THREE.Quaternion(q.x, q.y, q.z, q.w); }
```

**When to add these:** The math types can be added at any time — they're pure, tested, standalone classes with no effect on existing code. Ideally added in Phase 1 alongside the existing math work, or as a standalone addition before Phase 10.

### 2. `Node3D` in `@quintus/core`

A new class parallel to `Node2D`, extending `Node` with 3D transforms:

```typescript
// packages/core/src/node3d.ts

export interface Node3DProps extends NodeProps {
  position?: Vec3;
  rotation?: Quaternion;  // or euler convenience: { x, y, z } in degrees
  scale?: Vec3;
  visible?: boolean;
}

export class Node3D extends Node {
  // === Transform state (mirrors Node2D patterns) ===
  private _position = new Vec3(0, 0, 0);
  private _rotation = Quaternion.IDENTITY;
  private _scale = new Vec3(1, 1, 1);
  private _localTransformDirty = true;
  private _globalTransformDirty = true;
  private _cachedLocalTransform = Matrix4.IDENTITY;
  private _cachedGlobalTransform = Matrix4.IDENTITY;

  visible = true;

  // === Local Transform ===
  get position(): Vec3 { return this._position; }
  set position(v: Vec3) {
    this._position = v;
    this._markTransformDirty();
  }

  get rotation(): Quaternion { return this._rotation; }
  set rotation(q: Quaternion) {
    this._rotation = q;
    this._markTransformDirty();
  }

  // Euler convenience (degrees) — rotationDegrees in Godot
  get rotationEuler(): Vec3 { return this._rotation.toEuler(); }
  set rotationEuler(euler: Vec3) {
    this._rotation = Quaternion.fromEuler(euler.x, euler.y, euler.z);
    this._markTransformDirty();
  }

  get scale(): Vec3 { return this._scale; }
  set scale(v: Vec3) {
    this._scale = v;
    this._markTransformDirty();
  }

  // === Global Transform (lazy, cached, dirty-flagged — same pattern as Node2D) ===
  get globalTransform(): Matrix4 {
    if (this._globalTransformDirty) {
      const parent = this.parent;
      const parentTransform = parent instanceof Node3D ? parent.globalTransform : Matrix4.IDENTITY;
      this._cachedGlobalTransform = parentTransform.multiply(this.localTransform);
      this._globalTransformDirty = false;
    }
    return this._cachedGlobalTransform;
  }

  get localTransform(): Matrix4 {
    if (this._localTransformDirty) {
      this._cachedLocalTransform = Matrix4.compose(this._position, this._rotation, this._scale);
      this._localTransformDirty = false;
    }
    return this._cachedLocalTransform;
  }

  get globalPosition(): Vec3 {
    return this.globalTransform.decompose().position;
  }

  // === 3D Convenience ===
  lookAt(target: Vec3, up: Vec3 = Vec3.UP): void {
    const dir = target.sub(this.globalPosition).normalized();
    this.rotation = Quaternion.lookRotation(dir, up);
  }

  moveToward(target: Vec3, speed: number, dt: number): void {
    const dir = target.sub(this._position);
    const dist = dir.length();
    if (dist <= speed * dt) {
      this.position = target;
    } else {
      this.position = this._position.add(dir.normalized().scale(speed * dt));
    }
  }

  toLocal(worldPoint: Vec3): Vec3 {
    return this.globalTransform.inverse().transformPoint(worldPoint);
  }

  toGlobal(localPoint: Vec3): Vec3 {
    return this.globalTransform.transformPoint(localPoint);
  }

  // Transform dirty cascade — same pattern as Node2D
  private _markTransformDirty(): void { ... }
  _markGlobalTransformDirty(): void { ... }
}
```

**Key design decision: Node2D and Node3D are siblings, not parent-child.** Both extend `Node`. You cannot mix them in the same branch of the tree (a Node3D child of a Node2D would have no meaningful transform cascade). The scene tree enforces this naturally — a 3D game uses Node3D throughout, a 2D game uses Node2D throughout. Hybrid modes use separate layers (see below).

```
Node (base — pure logic)
├── Node2D (2D transforms: Vec2 position, scalar rotation, Matrix2D)
│   ├── Sprite
│   ├── Body
│   └── TileMap
└── Node3D (3D transforms: Vec3 position, Quaternion rotation, Matrix4)
    ├── MeshNode
    ├── Body3D
    └── Camera3D
```

### 3. Renderer Abstraction in `Game`

Currently `Game` hardcodes `Canvas2DRenderer`. This needs to become pluggable:

```typescript
// packages/core/src/renderer.ts

/** Abstract renderer interface — implemented by Canvas2D, WebGL2, or Three.js */
export interface Renderer {
  render(scene: Scene): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

// Canvas2DRenderer already implements this shape — just add "implements Renderer"
export class Canvas2DRenderer implements Renderer { ... }
```

The `Game` class changes minimally:

```typescript
export class Game {
  // Before: private renderer: Canvas2DRenderer | null = null;
  // After:
  private renderer: Renderer;

  constructor(options: GameOptions) {
    // Default to Canvas2D if no renderer specified
    this.renderer = options.renderer ?? new Canvas2DRenderer(this.canvas, ...);
  }
}
```

**This is the only core change that affects existing 2D code.** It's a non-breaking extraction of an interface that `Canvas2DRenderer` already satisfies.

---

## The Three.js Bridge: `@quintus/three`

This is the main 3D package. It bridges Quintus's scene tree to Three.js rendering. Three.js is a **peer dependency** — not bundled.

### ThreePlugin

Installs Three.js rendering capability into a Game:

```typescript
import { Game } from "@quintus/core";
import { ThreePlugin } from "@quintus/three";

const game = new Game({ width: 800, height: 600 });
game.use(ThreePlugin);
// Now the game can render Node3D trees via Three.js
```

What `ThreePlugin.install()` does:
1. Creates a Three.js `WebGLRenderer` (sharing the same canvas or creating an overlay)
2. Registers a `ThreeRenderer` that implements `Renderer`
3. Syncs the Quintus scene tree to a Three.js scene graph each frame

### Scene Tree Sync

The key architectural challenge: Quintus owns the scene tree (for lifecycle, signals, input, etc.), but Three.js needs its own scene graph for rendering. The `ThreeRenderer` maintains a **mirror**:

```
Quintus Scene Tree          Three.js Scene Graph
─────────────────           ────────────────────
Scene (root)          →     THREE.Scene
├── MeshNode          →     THREE.Mesh
│   └── PointLight    →     THREE.PointLight
├── Camera3D          →     THREE.PerspectiveCamera
└── GLTFModel         →     THREE.Group (loaded model)
```

Each `Node3D` subclass in `@quintus/three` holds a reference to its Three.js counterpart. On each render frame:
1. Walk the Quintus tree
2. For each Node3D, sync its `globalTransform` to the corresponding Three.js object's matrix
3. Call `threeRenderer.render(threeScene, threeCamera)`

This is efficient because:
- Transform sync is O(n) where n = number of 3D nodes (typically <1000)
- Three.js handles the actual GPU work (frustum culling, draw calls, shaders)
- Dirty flags prevent unnecessary matrix recomputation

### Core 3D Node Types

```typescript
// packages/three/src/mesh-node.ts
export class MeshNode extends Node3D {
  private _mesh: THREE.Mesh;

  geometry: "box" | "sphere" | "plane" | "cylinder" | THREE.BufferGeometry;
  material: THREE.Material | { color?: number; metalness?: number; roughness?: number };

  /** @internal Three.js object for sync */
  get threeObject(): THREE.Object3D { return this._mesh; }

  onReady() {
    // Create Three.js mesh from declarative config
    this._mesh = new THREE.Mesh(
      resolveGeometry(this.geometry),
      resolveMaterial(this.material),
    );
  }
}

// packages/three/src/camera3d.ts
export class Camera3D extends Node3D {
  type: "perspective" | "orthographic" = "perspective";
  fov = 75;
  near = 0.1;
  far = 1000;
  follow: Node3D | null = null;
  offset = new Vec3(0, 5, -10);

  private _camera: THREE.Camera;

  onUpdate(dt: number) {
    if (this.follow) {
      const target = this.follow.globalPosition;
      this.position = target.add(this.offset);
      this.lookAt(target);
    }
  }
}

// packages/three/src/gltf-model.ts
export class GLTFModel extends Node3D {
  asset: string = "";
  private _model: THREE.Group | null = null;

  async onReady() {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(this.asset);
    this._model = gltf.scene;
  }
}

// packages/three/src/lights.ts
export class DirectionalLight extends Node3D {
  color = 0xffffff;
  intensity = 1;
  // Three.js sync happens via threeObject
}

export class PointLight extends Node3D {
  color = 0xffffff;
  intensity = 1;
  distance = 0;
  decay = 2;
}

export class AmbientLight extends Node3D {
  color = 0x404040;
  intensity = 1;
}

// packages/three/src/billboard.ts
export class Billboard extends Node3D {
  /** A 2D sprite rendered on a plane that always faces the camera */
  spriteSheet: string = "";
  frame = 0;
  // Uses THREE.SpriteMaterial under the hood
}
```

---

## Three Usage Modes

### Mode 1: 2D Game + 3D Effects

The simplest integration. A normal 2D game with a Three.js layer for effects like volumetric lighting, particle effects, or dynamic backgrounds.

```typescript
import { Game, Scene, TileMap, Player } from "quintus";
import { ThreePlugin, ThreeLayer } from "@quintus/three";

const game = new Game({ width: 800, height: 600 }).use(ThreePlugin);

game.scene("level", (scene) => {
  // Normal 2D gameplay — everything as before
  scene.add(TileMap, { asset: "level1.json" });
  scene.add(Player, { position: new Vec2(100, 400) });

  // 3D effect layer rendered behind the 2D content
  const effects = scene.add(ThreeLayer, { zIndex: -100 });
  effects.setup((threeScene) => {
    threeScene.add(new THREE.AmbientLight(0x404040));
    threeScene.add(createVolumetricFog());
    threeScene.add(createRainParticles());
  });
});

game.start("level");
```

`ThreeLayer` is a special Node2D(!) that renders a Three.js scene at a specific z-index in the 2D render pipeline. It gets composited like any other 2D layer. The 2D game code doesn't change at all.

### Mode 2: Full 3D Game

Quintus manages the scene tree, lifecycle, input, and game loop. Three.js handles all rendering. No 2D rendering pipeline involved.

```typescript
import { Game, Scene, Vec3, Quaternion } from "quintus";
import {
  ThreePlugin, MeshNode, Camera3D, GLTFModel,
  DirectionalLight, AmbientLight
} from "@quintus/three";

const game = new Game({ width: 1280, height: 720 }).use(ThreePlugin);

// === Player class — same patterns as 2D, different transforms ===
class Player extends MeshNode {
  speed = 5;
  jumpForce = 8;
  velocity = new Vec3(0, 0, 0);

  onReady() {
    this.geometry = "capsule";
    this.material = { color: 0xff4444, metalness: 0.3, roughness: 0.7 };
  }

  onUpdate(dt: number) {
    const input = this.game!.input;
    const move = new Vec3(0, 0, 0);

    if (input.isPressed("forward")) move.z += 1;
    if (input.isPressed("back")) move.z -= 1;
    if (input.isPressed("left")) move.x -= 1;
    if (input.isPressed("right")) move.x += 1;

    if (move.length() > 0) {
      const dir = move.normalized().scale(this.speed * dt);
      this.position = this.position.add(dir);
      this.lookAt(this.position.add(move));
    }

    if (input.isJustPressed("jump") && this.isOnFloor()) {
      this.velocity.y = this.jumpForce;
    }

    // Gravity
    this.velocity.y -= 20 * dt;
    this.position = this.position.add(this.velocity.scale(dt));

    // Floor clamp
    if (this.position.y < 0) {
      this.position = new Vec3(this.position.x, 0, this.position.z);
      this.velocity.y = 0;
    }
  }

  isOnFloor(): boolean {
    return this.position.y <= 0.01;
  }
}

game.scene("level", (scene) => {
  // Environment
  scene.add(GLTFModel, { asset: "environment.glb" });

  // Lighting
  scene.add(AmbientLight, { color: 0x404040, intensity: 0.5 });
  scene.add(DirectionalLight, {
    position: new Vec3(5, 10, 5),
    intensity: 1.0,
  });

  // Player
  const player = scene.add(Player, { position: new Vec3(0, 0, 0) });
  player.tag("player");

  // Camera follows player
  scene.add(Camera3D, {
    type: "perspective",
    fov: 60,
    follow: player,
    offset: new Vec3(0, 8, -12),
  });

  // Collectibles — signals work the same as 2D
  for (const pos of coinPositions) {
    const coin = scene.add(MeshNode, {
      geometry: "cylinder",
      material: { color: 0xffdd00, metalness: 0.8 },
      position: pos,
    });
    coin.tag("coin");
    // Rotate coin each frame
    coin.onUpdate = (dt: number) => {
      const euler = coin.rotationEuler;
      coin.rotationEuler = new Vec3(euler.x, euler.y + 90 * dt, euler.z);
    };
  }
});

game.start("level");
```

Notice: the patterns are identical to 2D — `scene.add()`, `onUpdate(dt)`, `tag()`, `signal()`, input queries. The only difference is `Vec3`/`Quaternion` instead of `Vec2`/scalar rotation.

### Mode 3: Hybrid (3D World + 2D HUD / Paper Mario Style)

A 3D scene with a 2D overlay for UI. Uses both rendering pipelines.

```typescript
import { Game, Scene, Vec3 } from "quintus";
import { ThreePlugin, Camera3D, GLTFModel, Billboard } from "@quintus/three";
import { Label, ProgressBar, Container } from "@quintus/ui";

const game = new Game({ width: 1280, height: 720 }).use(ThreePlugin);

game.scene("hybrid", (scene) => {
  // === 3D World Layer ===
  scene.add(GLTFModel, { asset: "town.glb" });

  // 2D sprites in 3D space — always face the camera
  const player = scene.add(Billboard, {
    spriteSheet: "hero",
    position: new Vec3(0, 1, 0),
  });
  player.tag("player");

  const npc = scene.add(Billboard, {
    spriteSheet: "shopkeeper",
    position: new Vec3(5, 1, 3),
  });

  scene.add(Camera3D, {
    type: "orthographic",  // Isometric look
    rotationEuler: new Vec3(-30, 45, 0),
    follow: player,
  });

  // === 2D HUD Overlay (rendered on top of 3D) ===
  const hud = scene.add(Container, { fixed: true, zIndex: 1000 });
  hud.add(Label, {
    text: "HP",
    position: new Vec2(20, 20),
  });
  hud.add(ProgressBar, {
    position: new Vec2(50, 20),
    width: 200,
    value: 1.0,
  });
});

game.start("hybrid");
```

The `ThreeRenderer` renders the 3D scene first, then the `Canvas2DRenderer` composites 2D elements on top using the same canvas (or an overlay canvas).

---

## Package-by-Package Impact

### Packages with No Changes

| Package | Why |
|---------|-----|
| `@quintus/input` | Action maps are dimension-agnostic. Mouse position becomes a ray in 3D (handled by camera) |
| `@quintus/audio` | Works as-is. Spatial audio extends via `PannerNode` using Vec3 positions (additive) |
| `@quintus/tween` | Tweens animate properties. `tween(node).to({ position: new Vec3(...) })` just works |
| `@quintus/ui` | Always renders in 2D screen space, even in 3D games. No changes |
| `@quintus/headless` | Renderer-agnostic. Just runs the game loop + scene tree |
| `@quintus/test` | Tests query the scene tree and simulate input. Works for Node3D |
| `@quintus/snapshot` | Serializes node properties. Add Vec3/Quaternion serializers (additive) |
| `@quintus/mcp` | Queries scene tree. Node3D is still a Node. AI tools work unchanged |
| `@quintus/ai-prefabs` | 2D prefabs stay 2D. New 3D prefabs are additive |
| `@quintus/debug` | FPS counter, node inspector work unchanged. Add 3D collision viz later |

### Packages with Additive Changes

| Package | What changes |
|---------|-------------|
| `@quintus/math` | **Add** Vec3, Quaternion, Matrix4, AABB3, Euler utilities. Existing types untouched |
| `@quintus/core` | **Add** Node3D class, Renderer interface. Existing Node/Node2D/Canvas2DRenderer untouched |
| `@quintus/camera` | **Add** Camera3D (separate from 2D Camera). 2D camera unchanged |
| `@quintus/particles` | **Add** ParticleEmitter3D option. Three.js particles via `THREE.Points`. 2D particles unchanged |

### Packages with New 3D Counterparts

| 2D Package | 3D Equivalent | Notes |
|------------|--------------|-------|
| `@quintus/physics` (Body, StaticBody, Area) | 3D physics via Cannon.js, Rapier, or Ammo.js | Separate `@quintus/physics3d` package, peer dep on physics engine |
| `@quintus/sprites` (Sprite, AnimatedSprite) | MeshNode, GLTFModel, Billboard | In `@quintus/three` |
| `@quintus/tilemap` (TileMap, Tiled import) | N/A or voxel plugin | 2D-specific concept, no direct 3D equivalent |
| `@quintus/camera` (Camera follow, shake, zoom) | Camera3D (perspective, ortho, follow, orbit) | In `@quintus/three` initially |

### New 3D-Only Package

| Package | Purpose |
|---------|---------|
| `@quintus/three` | ThreePlugin, ThreeRenderer, MeshNode, Camera3D, GLTFModel, Billboard, lights, helpers |
| `@quintus/physics3d` (future) | Body3D, StaticBody3D, Area3D, CollisionShape3D — peer dep on physics engine |

---

## 3D Physics (Future)

3D physics is a significantly larger challenge than 2D. Rather than building SAT/broadphase from scratch for 3D, the plan is to bridge to an existing physics engine:

**Top candidates:**
- **Rapier** (Rust→WASM) — fast, deterministic, modern API
- **Cannon-es** — pure JS, easier to bundle, less performant
- **Ammo.js** (Bullet→WASM) — industry standard, large bundle

The bridge follows the same pattern as Three.js — Quintus owns the API, the physics engine is a peer dep:

```typescript
import { Body3D, StaticBody3D, Area3D, CollisionShape3D } from "@quintus/physics3d";

class Player extends Body3D {
  speed = 5;
  jumpForce = 8;

  onReady() {
    // Attach collision shape — same pattern as 2D Body
    this.addChild(CollisionShape3D, { shape: "capsule", radius: 0.5, height: 1.8 });
  }

  onUpdate(dt: number) {
    // moveAndSlide equivalent for 3D
    if (this.game!.input.isPressed("forward")) {
      this.velocity = this.velocity.add(this.forward.scale(this.speed));
    }
    if (this.game!.input.isJustPressed("jump") && this.isOnFloor()) {
      this.velocity.y = this.jumpForce;
    }
    this.moveAndSlide(dt);
  }
}
```

The `moveAndSlide()` API remains the critical platformer/character API — just extended to 3D. This is a separate package and a separate implementation effort, not part of the initial Three.js integration.

---

## Renderer Compositing: How 2D and 3D Co-exist

For hybrid modes, both renderers draw to the same canvas in a defined order:

```
Frame render pipeline:
1. ThreeRenderer clears and draws the 3D scene to the canvas (WebGL)
2. Canvas2DRenderer draws 2D nodes on top (2D context over WebGL canvas, or separate overlay canvas)
3. Repeat
```

Implementation options:
- **Single canvas, context switching:** Use `canvas.getContext("webgl2")` for 3D, then overlay a second canvas for 2D. This is the most common approach and what engines like Phaser use.
- **Shared WebGL canvas:** Render 2D elements via WebGL2 as well (using the Phase 12 WebGL2Renderer). This gives best performance but is more complex.

The recommended approach is **dual canvas** (WebGL for 3D, Canvas2D overlay for 2D). It's simple, works immediately, and the 2D overlay is typically just UI text and bars — performance is not a concern.

---

## What This Means for Current Development

### During Phases 1-9 (2D-focused): No Blockers

The 3D extension requires **no changes** to the current 2D development plan. Build the 2D engine exactly as designed. Specifically:

- **Node base class** — Already designed correctly (no spatial assumptions)
- **Signal system** — Universal
- **Game loop** — Universal (fixed timestep works for 3D too)
- **Input system** — Action maps work for 3D (mouse→ray casting is handled by camera, not input)
- **Plugin system** — Three.js will be a plugin

### One Small Change Worth Making Early

**Extract the `Renderer` interface from `Game`.** Currently `Game` directly constructs `Canvas2DRenderer`. Making it accept an abstract `Renderer` via the constructor (or plugin) is a one-line interface extraction and makes `ThreeRenderer` plug in cleanly later. This could happen during Phase 1 or any time before Phase 10.

```typescript
// This interface extraction is the only proactive change needed:
export interface Renderer {
  render(scene: Scene): void;
  resize?(width: number, height: number): void;
  dispose?(): void;
}
```

### Optional Early Additions to `@quintus/math`

Vec3, Quaternion, and Matrix4 could be added to `@quintus/math` at any point. They're standalone classes with no dependencies on the rest of the engine. Adding them early means they're available for things like 3D audio positioning or camera calculations even before the full Three.js integration.

---

## Timeline

The existing implementation plan allocates Phase 10 (~2 weeks) for Three.js integration. This is realistic for the core bridge (ThreePlugin, MeshNode, Camera3D, GLTFModel, lights, one demo). A more complete 3D story would break down as:

| Work | When | Duration |
|------|------|----------|
| Vec3, Quaternion, Matrix4 in `@quintus/math` | Any time (Phase 1+) | ~3 days |
| Node3D in `@quintus/core` | Phase 10 or earlier | ~2 days |
| Renderer interface extraction | Phase 1 or Phase 10 | ~1 hour |
| `@quintus/three` core (plugin, renderer, mesh, camera, lights) | Phase 10 | ~1.5 weeks |
| GLTF loading, Billboard, advanced materials | Phase 10 | ~3 days |
| 3D example game | Phase 10 | ~2 days |
| `@quintus/physics3d` (Rapier/Cannon bridge) | Post-Phase 12 | ~2-3 weeks |
| 3D AI prefabs | Post-Phase 12 | ~1 week |

---

## Summary

The Quintus 2.0 architecture is well-suited for 3D extension:

1. **~60% of the engine needs no changes** — game loop, signals, scene management, input, audio, UI, testing, headless, MCP
2. **Node3D parallels Node2D** — same patterns, different math types
3. **Three.js handles rendering** — we bridge, not rebuild
4. **One proactive change:** extract `Renderer` interface from `Game` (trivial)
5. **One additive math change:** add Vec3/Quaternion/Matrix4 (standalone, no breakage)
6. **3D physics is the biggest lift** — separate package, bridges to Rapier/Cannon
7. **No 2D code breaks** — everything is additive/parallel
