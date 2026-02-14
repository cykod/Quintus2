# Quintus 2.0 Implementation Plan

> A complete rewrite of the Quintus HTML5 game engine for the AI/LLM era.
> This plan synthesizes the design from three architecture documents:
> - [MODERNIZATION_RESEARCH.md](./MODERNIZATION_RESEARCH.md) — landscape analysis, gap identification, initial proposal
> - [GODOT_INSPIRED_ARCHITECTURE.md](./GODOT_INSPIRED_ARCHITECTURE.md) — Node/Scene Tree architecture, physics bodies, signals
> - [AI_INTEGRATION_ARCHITECTURE.md](./AI_INTEGRATION_ARCHITECTURE.md) — deterministic simulation, MCP server, headless runtime, AI testing

---

## Guiding Principles

1. **Clean-room rewrite** — The old code (`old/`) is reference only. Zero code carries forward.
2. **TypeScript-strict from day one** — Every file is `.ts`. `strict: true`. No `any` escape hatches.
3. **Test-first development** — Every module ships with Vitest tests. Target >90% coverage.
4. **Working software at each phase** — Each phase ends with a runnable demo game that exercises the new code.
5. **Tiny by default** — Core must stay under 15KB gzipped. Every byte is earned.
6. **LLM-first API design** — Predictable, typed, declarative, well-documented. If an LLM can't guess the API, redesign it.
7. **Deterministic by default** — Seeded RNG, fixed timestep, serializable state. AI-testability is not optional.

---

## Architecture Summary

**Core model:** Godot-inspired Node/Scene Tree (not ECS)

```
Game
 └── Scene (active)
      ├── TileMap
      ├── Player (Actor)
      │    ├── AnimatedSprite
      │    └── CollisionShape
      ├── Enemy (Actor)
      │    ├── AnimatedSprite
      │    └── CollisionShape
      ├── Coin (Sensor)
      │    └── CollisionShape
      ├── Camera
      └── Layer (UI, fixed)
           ├── HealthBar
           └── ScoreDisplay
```

**Key abstractions:**
- `Node` — base class, pure logic, parent/child tree
- `Node2D` — adds 2D transform (position, rotation, scale) with cascade
- `Actor` — movement + collision (maps to Godot: CharacterBody2D / `move`)
- `StaticCollider` — immovable collision
- `Sensor` — overlap detection (triggers, pickups)
- `Sprite` / `AnimatedSprite` — visual rendering
- `Signal<T>` — typed, discoverable events between nodes
- `Scene` — reusable node tree definition (class-based)
- `Game` — top-level container, game loop, asset loading

**Package layout (monorepo):**
```
packages/
  core/          @quintus/core        ~10KB — Node, Node2D, Scene, Game, signals, game loop, seeded RNG
  math/          @quintus/math        ~3KB  — Vec2, Matrix2D, Color, Rect, AABB, math utils
  physics/       @quintus/physics     ~10KB — Actor, StaticCollider, RigidBody, Sensor, CollisionShape, SAT, spatial hash
  sprites/       @quintus/sprites     ~5KB  — Sprite, AnimatedSprite, sprite sheets
  tilemap/       @quintus/tilemap     ~5KB  — TileMap, Tiled JSON/TMX import, tile collision
  input/         @quintus/input       ~4KB  — Input actions, keyboard, mouse, touch, gamepad
  audio/         @quintus/audio       ~3KB  — AudioPlayer node, Web Audio API wrapper
  ui/            @quintus/ui          ~5KB  — UINode, Label, Button, Container, ProgressBar
  tween/         @quintus/tween       ~3KB  — Tween builder, easing functions
  camera/        @quintus/camera      ~3KB  — Camera node, follow, shake, zoom, bounds
  particles/     @quintus/particles   ~4KB  — ParticleEmitter
  three/         @quintus/three       ~5KB  — ThreeLayer, MeshNode, Camera3D (Three.js peer dep)
  debug/         @quintus/debug       ~4KB  — FPS counter, node inspector, collision viz
  headless/      @quintus/headless    ~5KB  — Node.js runtime, no browser
  test/          @quintus/test        ~8KB  — TestRunner, InputScript, assertions, scenarios
  snapshot/      @quintus/snapshot    ~4KB  — State serialization, filmstrip, visual diff
  mcp/           @quintus/mcp         ~6KB  — MCP server for AI tool integration
  ai-prefabs/    @quintus/ai-prefabs  ~15KB — 30+ pre-built game components
  quintus/       quintus              ~40KB — Meta-package (core + physics + sprites + tilemap + input + audio + ui + tween + camera)
```

---

## Phase 0: Project Bootstrap

**Goal:** Monorepo infrastructure, CI, empty packages, developer tooling.

**Duration:** ~3 days

### Deliverables

| Task | Details |
|------|---------|
| **Monorepo setup** | pnpm workspace with `packages/` directory |
| **TypeScript config** | Shared `tsconfig.base.json` with `strict: true`, per-package `tsconfig.json` extending it |
| **Build system** | tsup per package (outputs ESM + CJS + `.d.ts`). Root `pnpm build` builds all. |
| **Test framework** | Vitest with jsdom environment, shared config, coverage reporting |
| **Linting** | Biome (replaces ESLint + Prettier) with shared config |
| **CI pipeline** | GitHub Actions: lint → build → test → coverage on every PR |
| **Package scaffolding** | Create empty `src/index.ts` + `package.json` + `tsconfig.json` + `tsup.config.ts` for every package |
| **Dev environment** | Vite dev server in `examples/` directory for running example games |
| **Documentation setup** | TypeDoc config for API doc generation |
| **Git hygiene** | Move old code to `old/`, `.gitignore`, branch strategy |

### File Structure After Phase 0
```
quintus/
├── packages/
│   ├── core/
│   │   ├── src/index.ts          # export {}
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── math/
│   │   └── ...
│   └── ... (all packages scaffolded)
├── examples/
│   └── vite.config.ts
├── old/                           # Legacy code (reference only)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.config.ts
├── biome.json
├── package.json                   # Root scripts: build, test, lint, dev
└── .github/workflows/ci.yml
```

### Definition of Done
- `pnpm install` succeeds
- `pnpm build` compiles all packages (empty but valid)
- `pnpm test` runs (0 tests, 0 failures)
- `pnpm lint` passes
- CI pipeline runs green
- `pnpm dev` starts Vite dev server

---

## Phase 1: Core Engine

**Goal:** The fundamental building blocks — nodes, game loop, math, events, signals. After this phase, you can create a tree of nodes that update and render each frame.

**Duration:** ~2 weeks

### Package: `@quintus/math`

| Class/Function | Purpose | Test Coverage |
|----------------|---------|---------------|
| `Vec2` | Mutable 2D vector with full operator set | add, sub, scale, normalize, dot, cross, distance, lerp, angle, rotate |
| `Matrix2D` | 3x3 affine transform matrix | identity, translate, rotate, scale, multiply, invert, transformPoint |
| `Rect` | Axis-aligned rectangle | contains, overlaps, intersection, union, expand |
| `Color` | RGBA color with named constants | fromHex, fromHSL, lerp, multiply, constants (RED, WHITE, etc.) |
| `AABB` | Axis-aligned bounding box | fromRect, fromPoints, overlaps, merge, contains |
| `clamp`, `lerp`, `remap`, `DEG2RAD`, `RAD2DEG` | Math utilities | — |
| `SeededRandom` | Deterministic PRNG (mulberry32) | next, int, float, bool, pick, shuffle, fork |

### Package: `@quintus/core`

| Class | Purpose | Key Methods/Properties |
|-------|---------|----------------------|
| `Node` | Base tree node, pure logic | `addChild()`, `removeChild()`, `find()`, `findAll()`, `get<T>(Type)`, `getAll<T>(Type)`, `tag()`, `hasTag()`, `destroy()` |
| `Node.lifecycle` | Lifecycle hooks | `onReady()`, `onUpdate(dt)`, `onFixedUpdate(dt)`, `onDestroy()` |
| `Node.pausing` | Pause behavior | `paused: boolean`, `pauseMode: 'inherit' | 'independent'` |
| `Node2D` | 2D transform node | `position`, `rotation`, `scale`, `globalPosition`, `globalTransform`, `zIndex`, `visible`, `tint` |
| `Signal<T>` | Typed event emitter | `emit(payload)`, `connect(handler)`, `disconnect()`, `once()`, `disconnectAll()` |
| `signal<T>()` | Signal factory | Creates typed signal instances on class declarations |
| `Game` | Top-level engine | `start(SceneClass)`, `scene(name, SceneClass)`, `load(manifest)`, `random`, `input` |
| `Game.loop` | Game loop | Fixed timestep accumulator (60hz physics), variable render, `requestAnimationFrame` |
| `Scene` | Class-based node tree | Extend `Scene`, override `onReady()` to build tree, scene transitions |
| `AssetLoader` | Async resource loading | `load(manifest)`, `onProgress` signal, `onComplete` signal, image/JSON/audio loading |
| `DrawContext` | Renderer abstraction | `line()`, `rect()`, `circle()`, `polygon()`, `text()`, `sprite()` — wraps Canvas2D |
| `Canvas2DRenderer` | Default renderer | Tree traversal, transform cascade, z-sorting, draw calls |
| `PluginSystem` | Plugin registration | `game.use(plugin)`, `definePlugin()`, plugin metadata |

### Node Lifecycle Order (per frame)

```
1. Input polling
2. onFixedUpdate(dt) — 0+ times per frame (accumulator-based, 1/60s step)
   a. For each node (depth-first): onFixedUpdate(dt)
3. onUpdate(dt) — once per frame (variable dt)
   a. For each node (depth-first): onUpdate(dt)
4. Render
   a. Clear canvas
   b. For each node (z-sorted): onDraw(ctx) via renderer
5. Cleanup destroyed nodes
```

### Key Design Decisions

- **Transform cascade:** `Node2D.globalTransform` = parent's globalTransform × local transform. Computed lazily, cached, dirty-flagged.
- **Signals are properties:** Declared as `readonly died = signal<void>()` on class body. TypeScript ensures type safety.
- **Game loop:** Semi-fixed timestep. Physics at 60hz via accumulator. Render at display rate. `game.random` is a `SeededRandom` instance forked per subsystem.
- **Renderer:** Canvas2D only in Phase 1. Abstract `DrawContext` interface allows WebGL2 later.
- **Asset loading:** `fetch()` + `async/await`. Images via `createImageBitmap()`. JSON parsed. Audio via `AudioContext.decodeAudioData()`. All async, all typed.
- **Vec2 is mutable:** Direct mutation (`this.position.x += speed * dt`) for performance and simplicity. Vec2Pool available for engine-internal optimizations.

### Example After Phase 1

```typescript
import { Game, Node2D, Scene, signal } from '@quintus/core';
import { Vec2, Color } from '@quintus/math';

class Ball extends Node2D {
  velocity = new Vec2(200, 150);
  radius = 10;

  onUpdate(dt: number) {
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Bounce off walls
    if (this.position.x < this.radius || this.position.x > 800 - this.radius) {
      this.velocity.x = -this.velocity.x;
    }
    if (this.position.y < this.radius || this.position.y > 600 - this.radius) {
      this.velocity.y = -this.velocity.y;
    }
  }

  onDraw(ctx: DrawContext) {
    ctx.circle(Vec2.ZERO, this.radius, { fill: Color.RED });
  }
}

const game = new Game({ width: 800, height: 600 });

class MainScene extends Scene {
  onReady() {
    this.add(Ball, { position: new Vec2(400, 300) });
  }
}

game.start(MainScene);
```

### Tests Required
- Math: Vec2 operations (mutable), Matrix2D transforms, SeededRandom determinism, Rect/AABB overlap
- Node: Tree manipulation (add/remove/find), tag system, lifecycle ordering, destroy cleanup
- Signal: connect/disconnect, typed payloads, once(), auto-cleanup on destroy
- Game loop: Fixed timestep accumulator accuracy, frame timing
- Scene: class-based define/load/transition, node tree construction
- Renderer: Transform cascade correctness, z-ordering, visibility culling

### 3D-Readiness (post Phase 1)
- `Renderer` interface extracted (`packages/core/src/renderer.ts`) with `render()`, `markRenderDirty()`, optional `resize()` and `dispose()`
- `Canvas2DRenderer implements Renderer`
- `Game` accepts pluggable renderer via `GameOptions.renderer` (custom, `null` for headless, or default Canvas2D)
- `Game._setRenderer()` allows plugins (e.g. ThreePlugin) to swap renderers at runtime
- `Game.stop()` calls `renderer.dispose?.()`
- `onDraw` moved from `Node` to `Node2D` — `Node` has zero math/rendering imports
- These changes prevent rework when `Node3D` and `ThreeRenderer` arrive in Phase 10

### Definition of Done
- Bouncing ball example runs in browser
- All math utilities tested with >95% coverage
- Node tree correctly cascades transforms
- Signals work with type safety
- Game loop maintains stable 60fps fixed timestep
- `SeededRandom` produces identical sequences for same seed
- `pnpm build` produces valid ESM/CJS bundles under 15KB combined (core + math)

---

## Phase 2: Physics & Collision

**Goal:** Godot-style physics bodies (`Actor`, `StaticCollider`, `Sensor`), collision detection (SAT + spatial hash), and the crucial `move()` API.

**Duration:** ~2 weeks

### Package: `@quintus/physics`

| Class | Maps to (Godot) | Purpose |
|-------|-----------------|---------|
| `Actor` | `CharacterBody2D` | Code-controlled movement, collision response via `move()` |
| `StaticCollider` | `StaticBody2D` | Immovable collision (platforms, walls). Optional `constantVelocity` for moving platforms |
| `RigidBody` | `RigidBody2D` | Full physics sim (mass, forces, torque). Optional — most games don't need it |
| `Sensor` | `Area2D` | Overlap detection only. Signals: `entered`, `exited`. Filter by type in handler if needed: `if (other instanceof Actor) { ... }` |
| `CollisionShape` | `CollisionShape2D` | Child of any body/sensor. Shapes: `rect`, `circle`, `capsule`, `polygon` |
| `PhysicsWorld` | Physics server | Spatial hash grid, broad phase, narrow phase (SAT), collision dispatch |
| `CollisionGroups` | Collision groups | Pre-defined named group system for filtering what collides with what |

### The `move` Algorithm

This is the single most important API. It must:
1. Apply `velocity × dt` to get desired motion vector
2. Cast collision shape along motion vector (continuous detection)
3. On collision: separate, project velocity onto surface tangent (slide)
4. Repeat for remaining motion (up to 4 iterations for corners)
5. Update `isOnFloor()` / `isOnWall()` / `isOnCeiling()` flags
6. Zero out velocity component into collision surface

```typescript
class Actor extends Node2D {
  velocity: Vec2;
  gravity: number;           // Inherited from PhysicsWorld or overridden
  collisionGroup: string;    // Pre-defined group name, validated against config

  move(dt: number): void;
  moveAndCollide(motion: Vec2): CollisionInfo | null;

  isOnFloor(): boolean;
  isOnWall(): boolean;
  isOnCeiling(): boolean;
  getSlideCollisions(): CollisionInfo[];
}
```

### Collision Detection Pipeline

```
Per onFixedUpdate:
  1. Broad phase: Spatial hash grid (cell size = 2× largest collider)
     - Bodies register in grid cells based on AABB
     - Only test pairs in same/adjacent cells

  2. Narrow phase: SAT (Separating Axis Theorem)
     - Rect vs Rect: 4 axes
     - Circle vs Rect: 5 axes (4 + center-to-nearest-point)
     - Circle vs Circle: 1 axis
     - Polygon vs Polygon: N+M axes
     - Returns: CollisionInfo { normal, depth, point, obj }

  3. Dispatch:
     - Actor vs StaticCollider → separate + slide
     - Actor vs Actor → both receive hit events
     - Sensor vs Actor → entered/exited signals (no separation)
     - Sensor vs Sensor → entered/exited signals
```

### Collision Groups Config

Groups must be declared in game config and validated at registration time. Invalid group names throw errors. Groups compile to bitmasks internally for performance. Undefined group names throw at registration time.

```typescript
const game = new Game({
  physics: {
    gravity: { x: 0, y: 800 },
    collisionGroups: {
      player: { collidesWith: ['world', 'enemies', 'items'] },
      enemies: { collidesWith: ['world', 'player'] },
      world: { collidesWith: ['player', 'enemies'] },
      items: { collidesWith: ['player'] },
      projectiles: { collidesWith: ['player', 'enemies'] },
    },
  },
});

class Player extends Actor {
  collisionGroup = 'player';  // Validated against config, throws if undefined
}
```

### Tests Required
- SAT: All shape pair combinations, edge cases (touching, contained, near-miss)
- Spatial hash: Insertion, removal, movement, cross-cell queries
- `move`: Floor detection, wall sliding, corner handling, slope handling
- `Actor`: Gravity integration, velocity clamping, collision response
- `StaticCollider`: Immovable, moving platform carries rider
- `Sensor`: Enter/exit signals fire correctly, no phantom events on destroy
- Collision groups: Group filtering works, group changes take effect immediately, invalid group names throw errors
- Integration: Stack of boxes, player on moving platform, bullet through thin wall (tunneling prevention)

### Demo: Simple Platformer Movement
```typescript
class Player extends Actor {
  speed = 200;
  jumpForce = -400;

  onUpdate(dt: number) {
    this.velocity.x = 0;
    if (this.game.input.isPressed('left'))  this.velocity.x = -this.speed;
    if (this.game.input.isPressed('right')) this.velocity.x = this.speed;

    if (this.game.input.isJustPressed('jump') && this.isOnFloor()) {
      this.velocity.y = this.jumpForce;
    }

    this.move(dt);
  }
}
```

### Definition of Done
- Player character runs and jumps on platforms with correct physics
- `move` handles floors, walls, ceilings, and slopes
- Spatial hash performs well with 1000+ static colliders
- Sensor triggers fire enter/exit signals correctly
- Collision groups filter correctly
- No tunneling through thin walls at normal velocities
- All physics tests pass with deterministic results (same seed = same outcome)

---

## Phase 3: Sprites & Input

**Goal:** Sprite sheets, frame animation, and the Godot-style input action system. After this phase, you can build a visually animated platformer with keyboard/gamepad controls.

**Duration:** ~2 weeks

### Package: `@quintus/sprites`

| Class | Purpose |
|-------|---------|
| `Sprite` | Static sprite rendering (single texture or sprite sheet frame) |
| `AnimatedSprite` | Frame-based animation with named animations, fps control, looping |
| `SpriteSheet` | Sprite sheet definition (texture + frame grid + animation map) |
| `SpriteSheetLoader` | Loads `.sprites.json` companion files alongside PNGs |

**Sprite Sheet JSON Format:**
```json
{
  "texture": "hero.png",
  "frameWidth": 16,
  "frameHeight": 24,
  "animations": {
    "idle":  { "frames": [0, 1], "fps": 4, "loop": true },
    "run":   { "frames": [2, 3, 4, 5], "fps": 12, "loop": true },
    "jump":  { "frames": [6], "loop": false },
    "fall":  { "frames": [7], "loop": false }
  }
}
```

**AnimatedSprite API:**
```typescript
class AnimatedSprite extends Node2D {
  spriteSheet: string;
  currentAnim: string;
  frame: number;
  playing: boolean;
  speed: number;           // Playback speed multiplier
  flipH: boolean;
  flipV: boolean;

  readonly animationFinished = signal<string>();

  play(name: string, restart?: boolean): void;
  stop(): void;
  pause(): void;
}
```

### Package: `@quintus/input`

| Feature | Details |
|---------|---------|
| **Action map** | Named actions → multiple bindings (`jump: ['Space', 'ArrowUp', 'gamepad:a']`) |
| **Query methods** | `isPressed(action)`, `isJustPressed(action)`, `isJustReleased(action)` |
| **Analog input** | `getAxis(negAction, posAction)` returns -1 to 1 (keyboard snaps, gamepad analog) |
| **Gamepad** | Standard Gamepad API mapping, dead zones, multiple gamepads |
| **Touch** | Virtual buttons and joystick overlays for mobile |
| **Input propagation** | Godot-style: `onInput(event)` propagates leaf-to-root, `event.consume()` stops propagation |
| **Input injection** | `game.input.inject(action, pressed)` for testing and AI control |

**Configuration:**
```typescript
const game = new Game({
  input: {
    actions: {
      left:   ['ArrowLeft', 'KeyA', 'gamepad:dpad-left', 'gamepad:left-stick-left'],
      right:  ['ArrowRight', 'KeyD', 'gamepad:dpad-right', 'gamepad:left-stick-right'],
      jump:   ['Space', 'ArrowUp', 'KeyW', 'gamepad:a'],
      attack: ['KeyZ', 'KeyJ', 'gamepad:x'],
    },
    deadZone: 0.15,
  },
});
```

### Tests Required
- SpriteSheet: Frame calculation from grid, animation lookup
- AnimatedSprite: Play/stop/pause, fps timing, `animationFinished` signal, `flipH`/`flipV`
- Input actions: Keyboard binding, `isPressed`/`isJustPressed`/`isJustReleased` timing
- Input injection: Programmatic input works identically to real input
- Gamepad: Axis mapping, dead zone filtering
- Input propagation: Consume stops propagation, correct ordering

### Definition of Done
- Animated player character runs, jumps, and plays correct animations
- Input action map works for keyboard and gamepad
- `isJustPressed` fires exactly once per press
- `input.inject()` can drive the game programmatically
- Sprite sheets load from JSON companion files
- All sprite/input tests pass

---

## Phase 4: Tilemap & Camera

**Goal:** Tiled map support and camera system. After this phase, you can build a scrolling platformer level designed in the Tiled editor.

**Duration:** ~1.5 weeks

### Package: `@quintus/tilemap`

| Feature | Details |
|---------|---------|
| **Tiled JSON import** | Parse Tiled JSON export format (layers, tilesets, objects, properties) |
| **Tile layers** | Render tile grid, support multiple layers, flip/rotate flags |
| **Tile collision** | Generate `StaticCollider` + `CollisionShape` from tile layer (auto-merge adjacent solid tiles into larger shapes) |
| **Object layers** | Spawn entities from Tiled object layer with custom properties |
| **Spawn points** | Named points for player start, enemy positions, etc. |

**TileMap API:**
```typescript
class TileMap extends Node2D {
  asset: string;                          // Tiled JSON path
  tileSet: string;                        // Tile sheet name

  readonly bounds: Rect;                  // Level bounds

  getSpawnPoint(name: string): Vec2;
  getObjects(layerName: string): TileObject[];
  spawnObjects(mapping: Record<string, NodeConstructor>): void;
  getTileAt(x: number, y: number, layer?: string): number;
  setTileAt(x: number, y: number, tileId: number, layer?: string): void;
}
```

### Package: `@quintus/camera`

| Feature | Details |
|---------|---------|
| **Follow** | Smooth camera follow with lerp/smoothing |
| **Bounds** | Clamp camera to level bounds (no seeing outside the map) |
| **Zoom** | Pixel-art friendly integer zoom (2x, 3x, 4x) |
| **Shake** | Camera shake effect (duration, intensity, decay) |
| **Dead zone** | Optional dead zone where target can move without camera moving |

**Camera API:**
```typescript
class Camera extends Node {
  follow: Node2D | null;
  smoothing: number;        // 0 = instant, 1 = very slow
  zoom: number;             // 1 = 100%, 2 = 200%
  bounds: Rect | null;      // Clamp to level bounds
  offset: Vec2;             // Offset from follow target
  deadZone: Rect | null;    // Dead zone rect

  shake(intensity: number, duration: number): void;

  // Coordinate conversion
  screenToWorld(screenPos: Vec2): Vec2;
  worldToScreen(worldPos: Vec2): Vec2;
}
```

### Tests Required
- TileMap: Parse Tiled JSON, render tile grid, object layer spawning
- Tile collision: Auto-merge solid tiles, correct collision shapes
- Camera: Follow smoothing, bounds clamping, shake decay, zoom scaling
- Coordinate conversion: screen<>world with zoom and offset

### Definition of Done
- Load a Tiled JSON map and render it
- Auto-generate collision from tile layer
- Spawn enemies/items from object layer
- Camera follows player with smoothing
- Camera stays within map bounds
- Pixel-art zoom works crisply at 2x/3x
- Scrolling platformer level is playable

---

## Phase 5: Audio, Tween & UI

**Goal:** Sound effects, music, code-driven animations, and basic UI widgets. After this phase, you have a full-featured 2D game engine.

**Duration:** ~2 weeks

### Package: `@quintus/audio`

| Feature | Details |
|---------|---------|
| Simple audio API | `this.game.audio.play('jump')` for quick sound effects |
| Spatial audio | `this.game.audio.play('jump', { position: this.globalPosition })` for positional audio |
| `AudioPlayer` node | Optional node for music, looping, and advanced spatial audio |
| Audio bus | Simple volume control per category (music, sfx, ui) |
| Format support | `.ogg`, `.mp3`, `.wav` via Web Audio API `decodeAudioData` |
| User interaction gate | Handle browser autoplay policy (resume AudioContext on first interaction) |

The simple case should be simple:
```typescript
// Quick sound effect — no node needed
this.game.audio.play('jump');

// Spatial/positional audio
this.game.audio.play('jump', { position: this.globalPosition });

// For music, looping, or advanced use cases, use AudioPlayer node
const music = this.add(AudioPlayer, { stream: 'music/level1.ogg', loop: true, autoplay: true });
music.volume = 0.5;
```

Note: The audio API is designed to extend to 3D spatial audio via the @quintus/three plugin.

### Package: `@quintus/tween`

Godot 4.x-style tween API — chainable, code-driven animations using `.to()` object syntax:

```typescript
node.tween()
  .to({ position: { y: 100 } }, 0.3, Ease.quadOut)
  .then()                    // Sequential
  .to({ tint: { a: 0 } }, 0.3)
  .parallel()                // Parallel with previous
  .to({ scale: { x: 2 } }, 0.3)
  .delay(0.5)
  .callback(fn)
  .repeat(count)             // Infinity for forever
  .onComplete(fn)
  .kill()
```

**Easing functions:** `linear`, `quadIn/Out/InOut`, `cubicIn/Out/InOut`, `sineIn/Out/InOut`, `elasticOut`, `bounceOut`, `backOut`

### Package: `@quintus/ui`

| Widget | Purpose |
|--------|---------|
| `UINode` | Base for UI elements (rect-based layout, ignores camera transform) |
| `Label` | Text rendering with font, color, shadow, alignment |
| `Button` | Clickable/tappable with hover/pressed states, `onPressed` signal |
| `Container` | Layout container (vertical/horizontal stack) |
| `ProgressBar` | Fillable bar (health, loading) |
| `Panel` | Background panel with optional border |
| `Layer` | Rendering layer: `fixed: true` for HUD, `parallax` for backgrounds |

### Tests Required
- Audio: Play/stop/volume, loop behavior, autoplay policy handling, simple API and AudioPlayer node
- Tween: `.to()` object interpolation, chaining (then/parallel), easing curves, repeat, kill, onComplete
- UI: Label rendering, Button click detection, Container layout, ProgressBar fill

### Definition of Done
- Sound effects play on game events (jump, coin collect) via `game.audio.play()`
- Background music loops with volume control via AudioPlayer node
- Tweens animate sprites (flash on hit, float up coins, screen transitions)
- HUD displays health bar and score
- Pause menu with buttons works
- All audio/tween/UI tests pass

---

## Phase 6: The `quintus` Meta-Package & First Complete Game

**Goal:** Bundle the "batteries included" meta-package and build the first complete example game (platformer) that exercises every system.

**Duration:** ~1.5 weeks

### Package: `quintus`

The default import that includes everything a typical game needs:

```typescript
// quintus/src/index.ts
export * from '@quintus/core';
export * from '@quintus/math';
export * from '@quintus/physics';
export * from '@quintus/sprites';
export * from '@quintus/tilemap';
export * from '@quintus/input';
export * from '@quintus/audio';
export * from '@quintus/ui';
export * from '@quintus/tween';
export * from '@quintus/camera';
```

**Size budget:** ~40KB gzipped for the full meta-package.

### Example Game: Complete Platformer

Port the spirit of the old `examples/platformer_full/` to the new architecture:

- Player with run/jump/double-jump animations
- Multiple enemy types (patrol, flying)
- Coins and health pickups
- Tiled map with multiple layers
- Camera follow with bounds
- HUD (health bar, score, coin counter)
- Sound effects and music
- Death and victory scenes
- At least 2 levels with scene transitions

This game serves as:
1. **Integration test** — exercises every package working together
2. **API validation** — if the platformer is awkward to write, the API needs fixing
3. **Documentation** — the best documentation is a working example
4. **LLM benchmark** — can an LLM read this code and extend it?

### Definition of Done
- Complete platformer game runs in browser
- `import { Game, Actor, Sprite, ... } from 'quintus'` works
- Bundle size under 40KB gzipped
- Game demonstrates all Phase 1-5 features
- Code is well-commented and serves as documentation
- An LLM (Claude/GPT) can read the platformer code and add a new enemy type

---

## Phase 7: Deterministic Simulation & Testing Framework

**Goal:** The AI-critical infrastructure — headless runtime, deterministic replay, input scripting, state snapshots.

**Duration:** ~2 weeks

### Package: `@quintus/headless`

| Feature | Details |
|---------|---------|
| `HeadlessGame` | `Game` subclass that runs without DOM/Canvas |
| Canvas replacement | `node-canvas` or `OffscreenCanvas` for rendering in Node.js |
| Asset loading | Load from filesystem (`fs.readFile`) instead of `fetch` |
| Audio stubbing | No-op audio (or optional `web-audio-api` package) |
| Manual stepping | `game.step()` instead of `requestAnimationFrame` |
| Performance | ~100x realtime (60s game = ~0.6s wall clock) |

### Package: `@quintus/test`

| Feature | Details |
|---------|---------|
| `TestRunner` | Run scenes headlessly with input scripts, capture results |
| `InputScript` | Timeline of player actions: `.press()`, `.release()`, `.wait()`, `.waitUntil()` |
| Game assertions | `expect(player).toBeOnFloor()`, `.toHaveHealth(3)`, `.toBeMovingRight()` |
| Scene assertions | `expect(scene).toHaveEntityCount('enemy', 5)`, `.toContainEntity(Player)` |
| Scenarios | Pre-built test patterns: `canComplete()`, `entityBehavior()`, `collision()` |
| Deterministic replay | Same seed + same inputs = same state, guaranteed |

### Package: `@quintus/snapshot`

| Feature | Details |
|---------|---------|
| `StateSnapshot` | Serializable snapshot of entire scene tree (nodes, positions, velocities, props, tags) |
| `stateAt(time)` | Query state at any point during a test run |
| `filmstrip()` | Generate a grid of screenshots at intervals |
| `toGif()` | Generate animated GIF of a test run |
| Visual regression | Compare screenshots against baselines with configurable threshold |

### Key Integration: Determinism Guarantees

The entire engine must be deterministic when given the same seed:
- `game.random` — seeded PRNG (from Phase 1)
- `game.random.fork(label)` — per-subsystem RNG isolation
- Fixed timestep — always 1/60s per physics step (from Phase 1)
- No `Date.now()` or `Math.random()` in engine code
- Input injection replays identically

### Tests Required
- Headless: Game runs without browser, produces correct state
- Determinism: Same seed + same inputs → identical state after N frames (run 100x, compare)
- InputScript: Press timing, hold duration, waitUntil conditions
- StateSnapshot: Serialize/deserialize round-trip, query by type/tag
- Filmstrip: Captures at correct intervals, images are valid PNGs
- Visual regression: Detects pixel differences above threshold

### Definition of Done
- Platformer game runs headlessly in Node.js
- `TestRunner` can drive the game with scripted inputs
- Running the same test 100 times with the same seed produces identical results
- State snapshots capture the full node tree
- Filmstrip/GIF generation works
- `npx vitest` runs headless game tests in CI
- Test run completes in <5 seconds for a 60-second game simulation

---

## Phase 8: MCP Server

**Goal:** Expose the running game as an AI-controllable tool via the Model Context Protocol. An LLM can inspect, modify, and test games through MCP.

**Duration:** ~2 weeks

### Package: `@quintus/mcp`

**MCP Tools to implement:**

| Category | Tools |
|----------|-------|
| **Scene Inspection** | `quintus.getSceneTree`, `quintus.getNode`, `quintus.queryNodes` |
| **Scene Modification** | `quintus.addNode`, `quintus.updateNode`, `quintus.removeNode` |
| **Simulation Control** | `quintus.step`, `quintus.pause`, `quintus.resume`, `quintus.reset` |
| **Input Injection** | `quintus.pressAction`, `quintus.releaseAction`, `quintus.runInputScript` |
| **Visual Capture** | `quintus.screenshot`, `quintus.filmstrip` |
| **Code Hot-Reload** | `quintus.hotReload`, `quintus.eval` |
| **Signals/Events** | `quintus.watchSignals`, `quintus.getSignalLog` |
| **Discovery** | `quintus.listAssets`, `quintus.listNodeTypes`, `quintus.listScenes` |
| **Diagnostics** | `quintus.getPerformance`, `quintus.getPhysicsDebug` |

**Two operating modes:**

1. **Headless mode** — MCP server wraps a `HeadlessGame` instance. For CI, AI agents, batch testing.
   ```bash
   npx quintus-mcp --headless --project ./my-game --scene Level1 --seed 42
   ```

2. **Browser bridge mode** — MCP server connects to a running Vite dev server via WebSocket. AI sees the game AND controls it.
   ```bash
   npx quintus dev --mcp
   ```

**MCP server architecture:**
```
AI Client (Claude Code, Cursor, etc.)
    │ MCP Protocol (stdio)
    ▼
@quintus/mcp server
    │
    ├── Headless: @quintus/headless game instance
    │   └── @quintus/test for input scripting
    │   └── @quintus/snapshot for state capture
    │
    └── Browser: WebSocket bridge to Vite dev server
        └── Injects commands into running browser game
```

### Tests Required
- Each MCP tool: Correct response format, error handling
- Scene tree inspection: Accurate node tree, props, tags
- Input injection: Actions applied correctly, timing preserved
- Screenshot: Valid PNG output, correct dimensions
- State serialization: Full round-trip fidelity
- Hot-reload: Code changes take effect without restart

### Definition of Done
- MCP server starts and registers all tools
- Claude Code can connect and inspect a running game
- AI can add/remove/modify entities
- AI can step simulation and capture screenshots
- AI can run input scripts and get state snapshots
- Hot-reload works (modify a file → changes visible in game)
- Works in both headless and browser bridge modes

---

## Phase 9: AI Prefabs & Example Games

**Goal:** Build the pre-built component library and 5+ example games that serve as both demonstrations and integration tests.

**Duration:** ~3 weeks

### Package: `@quintus/ai-prefabs`

Pre-built, well-tested, LLM-composable game components. Each has:
- Full TSDoc with `@example` blocks
- `@behavior` annotation describing what it does
- Complete test suite
- `static schema` for customizable parameters

**Component library:**

| Category | Prefabs |
|----------|---------|
| **Characters** | `PlatformerPlayer`, `TopDownPlayer`, `PatrolEnemy`, `FlyingEnemy`, `ChasingEnemy`, `TurretEnemy`, `BossEnemy`, `NPC` |
| **Items** | `Coin`, `HealthPickup`, `PowerUp`, `Key`, `Chest`, `Checkpoint` |
| **Environment** | `MovingPlatform`, `FallingPlatform`, `Spring`, `Spikes`, `Door`, `Switch`, `Ladder`, `Water` |
| **Effects** | `DamageNumber`, `Explosion`, `TrailEffect`, `ScreenShake` |
| **UI** | `HealthBar`, `ScoreDisplay`, `DialogueBox`, `InventoryGrid`, `MiniMap`, `PauseMenu`, `GameOverScreen` |
| **Systems** | `Spawner`, `WaveManager`, `CameraZone`, `MusicManager`, `SaveSystem` |

**Schema pattern for prefabs:**
```typescript
class PlatformerPlayer extends Actor {
  static schema = {
    speed: { type: 'number', default: 200 },
    jumpForce: { type: 'number', default: -400 },
    maxHealth: { type: 'number', default: 3 },
  };

  speed = 200;
  jumpForce = -400;
  maxHealth = 3;
}
```

### Example Games

| Game | Demonstrates | Complexity |
|------|-------------|------------|
| **Bouncing Ball** | Core loop, Node2D, custom draw | Minimal |
| **Breakout** | Physics, collision, input, scoring | Simple |
| **Platformer** | Full engine (sprites, tilemap, camera, audio, UI) | Medium |
| **Top-Down RPG** | Tilemap, NPC dialogue, inventory, save system | Medium |
| **Space Shooter** | Particles, wave spawning, scrolling, power-ups | Medium |
| **Tower Defense** | Path following, UI, strategy patterns | Medium |
| **Puzzle Game** | Grid-based logic, tween animations, UI | Simple |

Each example game is also an integration test:
```typescript
// tests/examples/platformer.test.ts
import { TestRunner, InputScript } from '@quintus/test';
import { Level1 } from '../../examples/platformer/scenes/level1';

test('player can reach the first checkpoint', async () => {
  const result = await TestRunner.run({
    scene: Level1,
    seed: 42,
    input: InputScript.create()
      .press('right', { duration: 3 })
      .press('jump')
      .press('right', { duration: 2 }),
    duration: 10,
  });

  const player = result.finalState.get(Player);
  expect(player.props.checkpoint).toBe(1);
});
```

### Definition of Done
- All 30+ prefabs implemented with tests
- 5+ example games run and are playable
- Each example game has at least 3 automated tests
- An LLM can compose prefabs to create a new game scene
- AI prefabs have complete TSDoc with examples
- `@quintus/ai-prefabs` is under 15KB gzipped

---

## Phase 10: Three.js Integration

**Goal:** Optional 3D rendering via Three.js as a peer dependency. 2D games with 3D effects, full 3D games, or hybrid modes.

**Duration:** ~2 weeks

### Package: `@quintus/three`

| Feature | Details |
|---------|---------|
| `ThreePlugin` | Plugin that adds Three.js rendering capability to Game |
| `ThreeLayer` | Node that hosts a Three.js Scene, renders behind/over 2D content |
| `MeshNode` | Node wrapping a Three.js Mesh (geometry + material) |
| `Camera3D` | Perspective or orthographic 3D camera |
| `GLTFModel` | Load and display GLTF/GLB 3D models |
| `Billboard` | 2D sprite rendered in 3D space (always faces camera) |
| `DirectionalLight`, `PointLight`, `AmbientLight` | Lighting nodes |

**Three usage modes:**
1. **2D game + 3D effects** — Normal 2D game with a ThreeLayer for background effects
2. **Full 3D game** — Quintus game loop + input + scenes, Three.js rendering
3. **Hybrid** — 3D world with 2D HUD overlay (Paper Mario style)

### Definition of Done
- Three.js renders behind/over 2D content
- GLTF model loading works
- 3D camera follows a player
- 2D UI overlay on 3D scene works
- Three.js is a peer dependency (not bundled)
- One 3D example game demonstrates the integration

---

## Phase 11: Particles & Debug Tools

**Goal:** Particle system for visual effects and developer tools for debugging.

**Duration:** ~1.5 weeks

### Package: `@quintus/particles`

| Feature | Details |
|---------|---------|
| `ParticleEmitter` | Node that spawns and manages particles |
| Particle properties | lifetime, velocity range, gravity, color gradient, size curve, rotation, alpha fade |
| Emission modes | Continuous (rate), burst (count), one-shot |
| Textures | Textured or primitive (circle/rect) particles |
| Performance | Object pool, batch rendering, GPU-friendly |

### Package: `@quintus/debug`

| Feature | Details |
|---------|---------|
| FPS counter | Overlay showing FPS, frame time, node count |
| Node inspector | Click to select node, show properties, signals, children |
| Collision viz | Draw collision shapes, spatial hash grid, contact points |
| Physics debug | Velocity vectors, body type coloring, floor/wall detection indicators |
| Console | In-game console for running commands |

### Definition of Done
- Particle effects (explosion, rain, dust) look good
- Emitter supports continuous and burst modes
- Object pooling prevents GC spikes
- Debug overlay toggles with a hotkey
- Collision shapes render accurately
- Node inspector shows live property values

---

## Phase 12: Developer Experience & Polish

**Goal:** `npm create quintus` scaffolding, documentation site, LLM system prompt, performance optimization, WebGL2 renderer option.

**Duration:** ~2 weeks

### Deliverables

| Task | Details |
|------|---------|
| **`create-quintus`** | `npm create quintus my-game` interactive scaffolding (game type, features, TypeScript config) |
| **Vite plugin** | `@quintus/vite-plugin` for HMR, asset pipeline, sprite sheet auto-detection |
| **Documentation site** | TypeDoc API docs + Starlight guide site with tutorials |
| **LLM documentation** | `docs/llm/SYSTEM_PROMPT.md`, `API_CHEATSHEET.md`, `EXAMPLES.md` — ready-to-use context for AI coding |
| **WebGL2 renderer** | Optional `WebGL2Renderer` implementing `DrawContext` for batched sprite rendering |
| **Performance** | Benchmark suite, profiling, optimize hot paths (spatial hash, transform cascade, render loop) |
| **Tree-shaking** | Verify that importing only `@quintus/core` + `@quintus/physics` doesn't pull in UI/audio/etc. |
| **Bundle analysis** | Verify size budgets for each package |

### Performance Benchmarks

| Benchmark | Target |
|-----------|--------|
| 10,000 static sprites render | 60fps |
| 1,000 moving bodies with collision | 60fps |
| 100 animated sprites | 60fps |
| Scene with 200×100 tile map | 60fps |
| Headless: 60s game simulation | <1 second |
| Entity spawn/destroy (1000/frame) | <2ms |
| `move` per actor | <0.1ms |

### Definition of Done
- `npm create quintus my-game` produces a working project
- Documentation site is deployable
- LLM system prompt produces good results when used with Claude/GPT
- WebGL2 renderer works as drop-in replacement
- All size budgets met
- All performance benchmarks met
- Tree-shaking verified

---

## Dependency Graph

Build order is determined by package dependencies:

```
Phase 0: [project infrastructure]
    │
Phase 1: math ──► core
    │              │
Phase 2:           ├──► physics
    │              │
Phase 3:           ├──► sprites
    │              ├──► input
    │              │
Phase 4:           ├──► tilemap (depends on: physics for tile collision)
    │              ├──► camera
    │              │
Phase 5:           ├──► audio
    │              ├──► tween
    │              ├──► ui
    │              │
Phase 6:           └──► quintus (meta-package, depends on all above)
    │
Phase 7: headless ──► test ──► snapshot
    │
Phase 8: mcp (depends on: headless, test, snapshot)
    │
Phase 9: ai-prefabs (depends on: quintus meta-package)
    │
Phase 10: three (depends on: core, peer dep on three.js)
    │
Phase 11: particles, debug (depends on: core, sprites)
    │
Phase 12: create-quintus, vite-plugin, docs, WebGL2 renderer
```

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| `move` is hard to get right | High — broken physics ruins the engine | Study Godot source (MIT), extensive test suite, edge case fuzzing |
| Bundle size creep | Medium — loses competitive advantage | Size budgets per package, CI size check, tree-shaking verification |
| Canvas2D performance ceiling | Medium — limits entity count | WebGL2 renderer as Phase 12 escape valve, spatial culling in Phase 1 |
| Headless canvas fidelity | Medium — visual tests may differ | Use `node-canvas` with same font/rendering, tolerance thresholds |
| Three.js API churn | Low — Three.js is stable | Pin peer dep version range, minimal surface area in bridge |
| MCP protocol changes | Low — MCP is maturing | Abstract tool definitions, versioned protocol support |
| Scope creep in AI prefabs | Medium — 30+ components is a lot | Strict scope per prefab, ship MVP then iterate, accept community PRs |

---

## Success Criteria

The engine is "done" when:

1. **A developer can `npm create quintus my-game`** and have a running game in <2 minutes
2. **An LLM can build a complete platformer** from a natural language prompt using the MCP server
3. **The full meta-package is under 40KB gzipped** with tree-shaking working
4. **All example games have automated tests** that run headlessly in CI
5. **The API is predictable enough** that an LLM can guess the right method 90% of the time
6. **Every system is deterministic** — same seed, same inputs, same result, every time
7. **The documentation includes an LLM system prompt** that any AI coding tool can use

---

## Timeline Summary

| Phase | Duration | Cumulative | Key Milestone |
|-------|----------|------------|---------------|
| 0: Bootstrap | 3 days | 3 days | Monorepo builds |
| 1: Core Engine | 2 weeks | 2.5 weeks | Bouncing ball demo |
| 2: Physics | 2 weeks | 4.5 weeks | Player runs & jumps |
| 3: Sprites & Input | 2 weeks | 6.5 weeks | Animated platformer character |
| 4: Tilemap & Camera | 1.5 weeks | 8 weeks | Scrolling level |
| 5: Audio, Tween, UI | 2 weeks | 10 weeks | Full-featured engine |
| 6: Meta-package & Platformer | 1.5 weeks | 11.5 weeks | Complete example game |
| 7: Deterministic Testing | 2 weeks | 13.5 weeks | Headless game tests in CI |
| 8: MCP Server | 2 weeks | 15.5 weeks | AI can control the game |
| 9: AI Prefabs & Examples | 3 weeks | 18.5 weeks | 30+ prefabs, 5+ games |
| 10: Three.js Integration | 2 weeks | 20.5 weeks | 3D rendering works (Renderer interface already extracted in Phase 1) |
| 11: Particles & Debug | 1.5 weeks | 22 weeks | Visual effects & dev tools |
| 12: DX & Polish | 2 weeks | 24 weeks | `npm create quintus` works |

**Total estimated duration: ~24 weeks (6 months)**

Note: Phases 10-11 can run in parallel with Phase 9. Phase 12 items can be started earlier as the API stabilizes. A solo developer working full-time might complete the core (Phases 0-6) in ~3 months, with the AI infrastructure (Phases 7-8) adding another month.
