# Quintus Modernization Research: Rebuilding for the Modern Era

## Executive Summary

Quintus was ahead of its time — a tiny (~20KB gzipped), plugin-based, component-driven 2D game engine with zero dependencies and a jQuery-inspired API. 14 years later, the HTML5 game engine landscape has matured enormously, but there's a genuine gap: no engine combines **tiny footprint + TypeScript-native + plugin extensibility + 2D/3D hybrid + LLM-friendliness** in one coherent package. A modernized Quintus could own that niche.

This document covers the current landscape, what Quintus does well, what needs to change, and a concrete architectural proposal for **Quintus 2.0**.

---

## Part 1: The Current Quintus Architecture

### What Quintus Has (7,389 lines across 10 modules)

| Module | Lines | Purpose |
|--------|-------|---------|
| `quintus.js` | 2,292 | Core: class system, events, assets, game loop |
| `quintus_scenes.js` | 1,172 | Stage management, SAT collision, grid partitioning |
| `quintus_input.js` | 986 | Keyboard, gamepad, touch-to-stage coordinate mapping |
| `quintus_sprites.js` | 770 | Sprite class, sprite sheets, collision points |
| `quintus_ui.js` | 668 | Container, Button, Text, Panel widgets |
| `quintus_2d.js` | 550 | Physics, viewport/camera, TileLayer, Repeater |
| `quintus_anim.js` | 287 | Frame animation, tweens |
| `quintus_tmx.js` | 272 | Tiled map format import |
| `quintus_touch.js` | 224 | Touch events, click detection |
| `quintus_audio.js` | 168 | Web Audio API + HTML5 Audio |

### What Quintus Gets Right (Keep These)

1. **Plugin architecture** — `Q.include("Sprites, Scenes, Input, 2D")` is elegant. Modules are self-contained functions that extend Q. No circular dependencies.

2. **Component system** — `sprite.add('2d, platformerControls')` for runtime composition. Components can extend entity methods, hook into events, and be added/removed dynamically.

3. **Event-driven architecture** — Everything is `Q.Evented`. Namespaced events (`hit.sprite`, `bump.top`) are powerful and readable.

4. **Tiny footprint** — 20KB gzipped with everything included. No dependencies.

5. **Simple mental model** — Scene defines a level → Stage runs it → Sprites live in stages → Components add behavior. Easy to teach, easy for LLMs to reason about.

6. **Bitmask collision types** — `Q.SPRITE_ENEMY | Q.SPRITE_ACTIVE` for fast collision filtering.

7. **Grid-based spatial partitioning** — Practical collision optimization without complexity.

### What Quintus Needs to Change

1. **No TypeScript** — JavaScript with Resig's Simple Inheritance pattern. No types, no IDE support, no LLM-friendly signatures.

2. **Canvas 2D only** — No WebGL, no WebGPU, no 3D. Modern engines need at least WebGL2 fallback.

3. **No ECS option** — The component system is good but not a true Entity-Component-System. No query system, no system update ordering.

4. **Grunt build system** — Dead technology. Need Vite/esbuild.

5. **No tree-shaking** — Concatenation-based build. Modern engines let you import only what you use.

6. **Global Q object pattern** — While charming, it prevents multiple engine instances and doesn't work with ES modules.

7. **No testing story** — Jasmine specs exist but are minimal (36 tests). Modern engines need comprehensive test suites.

8. **Asset loading is dated** — No async/await, no streaming, no lazy loading patterns.

9. **No 3D support** — Even basic sprite-in-3D-world capabilities are missing.

10. **No modern input** — No pointer lock, no gamepad mapping profiles, no gesture recognition.

---

## Part 2: The Current HTML5 Game Engine Landscape

### The Big Players

| Engine | Size (gzip) | TypeScript | Architecture | 3D | Stars | Best For |
|--------|-------------|------------|-------------|-----|-------|----------|
| **Phaser 3/4** | 335KB | v4 native | Scene Graph | No | 37.8K | Full-featured 2D |
| **PixiJS v8** | 80-150KB | Partial → v8 | Renderer only | No | 46.6K | 2D rendering |
| **Excalibur.js** | 143KB | Native | ECS hybrid | No | ~9K | TS-first 2D |
| **Babylon.js** | 350-500KB | Native | Scene Graph | Yes | 24K | 3D games |
| **KAPLAY** | 961KB | Native | Simple OOP | No | 1.1K | Game jams |
| **LittleJS** | 15-20KB | No | Minimal OOP | 2.5D | 2K | Size-constrained |
| **Three.js** | ~200KB | Native | Scene Graph | Yes | 80K+ | 3D rendering |
| **melonJS** | ~150KB | Partial | Scene Graph | No | 5K | 2D tile games |

### The Gap in the Market

Looking at this landscape, there is no engine that is:

- **Tiny** (under 50KB gzipped for core)
- **TypeScript-native** with full type safety
- **Plugin-based** with tree-shakeable modules
- **2D-first with optional 3D** (via Three.js integration)
- **ECS-capable** but not ECS-mandatory
- **LLM-optimized** in API design
- **Test-friendly** with comprehensive examples

**LittleJS** is tiny but has no TypeScript and no plugin system.
**Excalibur.js** has TypeScript + ECS but is 143KB and 2D-only.
**Phaser** is mature but large (335KB) and not truly modular.
**PixiJS** is a renderer, not an engine.
**Three.js** is 3D rendering, not a game engine.

**Quintus 2.0 can fill this gap.**

### Key Technology Shifts Since Original Quintus

1. **WebGPU is production-ready** — All major browsers ship it as of 2025. Three.js has zero-config WebGPU since r171.

2. **TypeScript won** — Every serious engine is either TypeScript-native or adding it. LLMs generate dramatically better code with type information.

3. **ES Modules are standard** — Tree-shaking, dynamic imports, and `import` syntax are universal. No more concatenation builds.

4. **Vite is the build tool** — 10-20ms HMR, native TypeScript support, esbuild for pre-bundling. Vite + Vitest is the modern stack.

5. **ECS is mainstream for games** — Data-oriented design with entities, components, and systems. Better cache performance, better composition, better for LLMs to reason about.

6. **WebGPU compute shaders** — Physics, particles, and effects can run on GPU. This was science fiction when Quintus was built.

7. **Asset pipelines are sophisticated** — Lazy loading, predictive streaming, service workers, IndexedDB caching, HTTP/2 parallelism.

---

## Part 3: LLM-Friendliness — A First-Class Design Goal

This is where Quintus 2.0 can differentiate. No engine today is explicitly designed for LLM code generation. Here's what that means:

### What Makes an Engine LLM-Friendly

**1. Predictable, Consistent TypeScript APIs**
```typescript
// GOOD: LLMs can predict the pattern
world.spawn(Player, { x: 100, y: 200 });
world.spawn(Enemy, { x: 300, y: 200, health: 3 });
world.spawn(Coin, { x: 500, y: 150 });

// BAD: Inconsistent patterns confuse LLMs
stage.insert(new Q.Player());           // new + constructor
Q.stageScene("level1");                 // global function
stage.collisionLayer(new Q.TileLayer()) // different method
```

**2. Strong Types as Documentation**
```typescript
// Types tell LLMs exactly what's valid
interface SpriteProps {
  x: number;
  y: number;
  width?: number;
  height?: number;
  velocity?: Vec2;
  collisionMask?: CollisionGroup;
  sprite?: string;        // sprite sheet name
  frame?: number;         // current frame
  animations?: AnimationMap;
}
```

**3. Declarative Over Imperative**
```typescript
// GOOD: Declarative — LLMs excel at structure
const level = scene({
  entities: [
    player({ x: 100, y: 200, controls: 'platformer' }),
    tilemap({ asset: 'level1.json', sheet: 'tiles' }),
    enemy({ x: 300, y: 200, ai: 'patrol', waypoints: [...] }),
  ],
  camera: { follow: 'player', bounds: true },
  physics: { gravity: { x: 0, y: 980 } },
});

// BAD: Imperative — LLMs must track state mentally
const stage = new Stage();
const p = new Player();
stage.insert(p);
const layer = new TileLayer(...);
stage.collisionLayer(layer);
stage.add("viewport").follow(p);
```

**4. Error Messages That Guide Solutions**
```typescript
// GOOD
throw new QuintusError(
  `Component "physics2d" requires "transform" component. ` +
  `Add it first: entity.add('transform', 'physics2d')`
);

// BAD
throw new Error("Missing dependency");
```

**5. Convention Over Configuration**
```typescript
// GOOD: Sensible defaults, override what you need
const game = new Quintus({
  // Just works with defaults for everything
  canvas: '#game', // or auto-creates one
});

// Components have sensible defaults
entity.add('physics2d'); // gravity, friction etc all have defaults
```

**6. Self-Documenting Component Registry**
```typescript
// LLMs can query what's available
Q.components.list();
// → ['transform', 'sprite', 'physics2d', 'platformer',
//    'patrol-ai', 'health', 'animation', ...]

Q.components.describe('physics2d');
// → { requires: ['transform'],
//     provides: ['velocity', 'acceleration', 'applyForce'],
//     events: ['collision', 'trigger-enter', 'trigger-exit'] }
```

**7. Plugin Metadata for Discovery**
```typescript
// Plugins describe themselves
const ParticlePlugin = definePlugin({
  name: 'particles',
  version: '1.0.0',
  description: 'GPU-accelerated particle system',
  components: ['emitter', 'particle-force'],
  systems: [ParticleUpdateSystem, ParticleRenderSystem],
  requires: ['core', 'renderer'],
});
```

**8. Example-Rich API with Inline Documentation**
```typescript
/**
 * Spawn an entity with components.
 *
 * @example
 * // Simple sprite
 * world.spawn('player', { x: 100, y: 200 });
 *
 * @example
 * // With components
 * world.spawn('player', { x: 100, y: 200 })
 *   .add('physics2d', { gravity: 980 })
 *   .add('platformer', { jumpForce: -400 })
 *   .add('health', { max: 3 });
 */
```

---

## Part 4: Architectural Proposal for Quintus 2.0

### Core Principles

1. **Tiny core, rich plugins** — Core under 15KB gzipped. Everything else is opt-in.
2. **TypeScript-native** — Written in TypeScript, ships TypeScript. No `.d.ts` afterthoughts.
3. **ES Modules + tree-shaking** — Import only what you use.
4. **Hybrid ECS** — Use simple API for simple games, drop to ECS for complex ones.
5. **2D-first, 3D-capable** — Canvas2D/WebGL2 for 2D, Three.js integration for 3D.
6. **LLM-optimized API** — Predictable, typed, declarative, well-documented.
7. **Test-everything culture** — Vitest, >90% coverage, example games as integration tests.

### Package Structure (Monorepo)

```
@quintus/core          ~8KB   — Engine, ECS, events, game loop
@quintus/math          ~3KB   — Vec2, Vec3, Matrix, AABB, math utils
@quintus/renderer-2d   ~10KB  — Canvas2D + WebGL2 sprite rendering
@quintus/renderer-3d   ~5KB   — Three.js bridge (Three.js is peer dep)
@quintus/sprites       ~5KB   — Sprite sheets, animations, sprite components
@quintus/physics       ~8KB   — 2D physics (velocity, gravity, collision response)
@quintus/collision     ~6KB   — SAT, AABB, grid spatial hash, collision groups
@quintus/input         ~5KB   — Keyboard, mouse, touch, gamepad with mapping
@quintus/audio         ~4KB   — Web Audio API with spatial audio support
@quintus/ui            ~6KB   — UI components (buttons, text, containers, menus)
@quintus/tilemap       ~5KB   — Tiled JSON/TMX import, tile layers, autotiling
@quintus/particles     ~4KB   — GPU-accelerated particle system
@quintus/tween         ~3KB   — Easing, tweens, timeline animations
@quintus/camera        ~3KB   — Viewport, follow, shake, zoom, split-screen
@quintus/prefab        ~2KB   — Entity prefab/template system
@quintus/debug         ~4KB   — FPS counter, entity inspector, collision viz
@quintus/scene         ~4KB   — Scene management, transitions, loading screens

quintus                ~15KB  — Meta-package: core + renderer-2d + sprites +
                               physics + collision + input (the "batteries
                               included" default)
```

**Total "batteries included"**: ~50KB gzipped
**Minimal (core + renderer-2d)**: ~18KB gzipped
**With Three.js 3D**: ~55KB + Three.js peer dependency

### The Hybrid ECS Architecture

The key insight: **simple games shouldn't need to understand ECS, but complex games should have access to it.**

```typescript
// ============================================
// SIMPLE API (for beginners and quick prototypes)
// ============================================

import { Game, Sprite } from 'quintus';

const game = new Game({ width: 800, height: 600 });

// Define a sprite class (familiar pattern from Quintus 1.0)
class Player extends Sprite {
  speed = 200;

  setup() {
    this.add('physics2d', 'platformer');
    this.play('idle');
  }

  update(dt: number) {
    if (this.input.isDown('right')) {
      this.velocity.x = this.speed;
      this.play('run');
    }
  }

  onCollide(other: Entity, hit: CollisionInfo) {
    if (other.is('enemy')) {
      if (hit.fromAbove) other.destroy();
      else this.hurt(1);
    }
  }
}

// Define and run a scene
game.scene('level1', (world) => {
  world.spawn(Player, { x: 100, y: 200, sprite: 'hero' });
  world.spawn(TileMap, { asset: 'level1.json' });
  world.camera.follow('player');
});

game.start('level1');


// ============================================
// ECS API (for complex games and advanced users)
// ============================================

import { Game, World, System, Component, Query } from '@quintus/core';
import { Transform, Velocity, Sprite } from '@quintus/sprites';
import { Collider } from '@quintus/collision';

// Define components as plain data
const Health = Component.define('health', {
  current: 100,
  max: 100,
  invulnerable: false,
  invulnerableTimer: 0,
});

const Patrol = Component.define('patrol', {
  waypoints: [] as Vec2[],
  currentIndex: 0,
  speed: 50,
  waitTime: 1.0,
  waiting: false,
});

// Define systems as update functions
class PatrolSystem extends System {
  query = new Query([Transform, Patrol, Velocity]);

  update(dt: number) {
    for (const entity of this.query) {
      const [transform, patrol, velocity] = entity.get(Transform, Patrol, Velocity);
      const target = patrol.waypoints[patrol.currentIndex];
      const dir = target.sub(transform.position).normalize();
      velocity.value = dir.scale(patrol.speed);

      if (transform.position.distanceTo(target) < 5) {
        patrol.currentIndex = (patrol.currentIndex + 1) % patrol.waypoints.length;
      }
    }
  }
}

// Build game with explicit systems
const game = new Game({
  systems: [PatrolSystem, PhysicsSystem, CollisionSystem, RenderSystem],
});
```

### Renderer Architecture

```typescript
// Abstract renderer interface — implementations are swappable
interface Renderer {
  init(canvas: HTMLCanvasElement): void;
  beginFrame(): void;
  endFrame(): void;
  drawSprite(sprite: SpriteData, transform: TransformData): void;
  drawTilemap(tilemap: TilemapData, viewport: Rect): void;
  drawText(text: string, style: TextStyle, transform: TransformData): void;
  drawShape(shape: Shape, style: ShapeStyle, transform: TransformData): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

// Implementations
class Canvas2DRenderer implements Renderer { ... }  // Default, always works
class WebGL2Renderer implements Renderer { ... }    // Fast, WebGL2 batched
class WebGPURenderer implements Renderer { ... }    // Future, compute shaders

// Three.js bridge — not a renderer replacement, but an integration
class ThreeJSBridge {
  scene: THREE.Scene;
  camera: THREE.Camera;

  // Sync Quintus entities → Three.js objects
  syncEntity(entity: Entity, object3d: THREE.Object3D): void;

  // Render 2D Quintus UI on top of 3D scene
  overlayRenderer: Canvas2DRenderer;
}
```

### Three.js Integration Design

```typescript
import { Game } from 'quintus';
import { ThreePlugin, ThreeSprite, ThreeScene } from '@quintus/renderer-3d';
import * as THREE from 'three';

const game = new Game()
  .use(ThreePlugin);

// Option 1: 2D game with 3D effects
game.scene('level1', (world) => {
  // Regular 2D gameplay
  world.spawn(Player, { x: 100, y: 200 });

  // 3D background layer
  world.spawn(ThreeScene, {
    setup: (scene: THREE.Scene) => {
      scene.add(new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 600),
        new THREE.MeshStandardMaterial({ map: bgTexture })
      ));
      // Particle effects, lighting, etc.
    }
  });
});

// Option 2: Full 3D game using Quintus ECS + Three.js rendering
game.scene('3d-level', (world) => {
  world.spawn(ThreeSprite, {
    geometry: new THREE.BoxGeometry(1, 1, 1),
    material: new THREE.MeshStandardMaterial({ color: 0xff0000 }),
    position: { x: 0, y: 0, z: 0 },
    components: ['physics3d', 'player-controller'],
  });
});

// Option 3: Hybrid — 3D world, 2D HUD
game.scene('hybrid', (world) => {
  const scene3d = world.spawn(ThreeScene, { camera: 'perspective' });
  // ... 3D entities ...

  // 2D overlay stage
  world.overlay((ui) => {
    ui.spawn(HealthBar, { x: 20, y: 20 });
    ui.spawn(ScoreText, { x: 400, y: 20 });
  });
});
```

### Plugin System Design

```typescript
import { definePlugin, PluginContext } from '@quintus/core';

// Plugins are self-describing and type-safe
export const ParticlePlugin = definePlugin({
  name: 'particles',
  version: '1.0.0',
  description: 'GPU-accelerated 2D particle system with emitters and forces',

  // Declare dependencies
  requires: ['core', 'renderer-2d'],
  optional: ['physics'],

  // Register components
  components: {
    emitter: EmitterComponent,
    particleForce: ParticleForceComponent,
  },

  // Register systems
  systems: [
    { system: ParticleUpdateSystem, after: 'physics', before: 'render' },
    { system: ParticleRenderSystem, phase: 'render' },
  ],

  // Register assets
  assets: {
    loaders: {
      '.particles': ParticleConfigLoader,
    },
  },

  // Plugin setup
  setup(ctx: PluginContext) {
    // Add methods to Game or World
    ctx.extendWorld({
      emitParticles(config: ParticleConfig, position: Vec2) {
        // ...
      }
    });
  },

  // LLM metadata — helps AI understand what this plugin does
  llm: {
    examples: [
      {
        description: 'Fire explosion effect',
        code: `world.emitParticles('explosion', { x: 100, y: 200 });`,
      },
      {
        description: 'Continuous rain effect',
        code: `world.spawn(Emitter, {
          texture: 'raindrop',
          rate: 100,
          lifetime: { min: 0.5, max: 1.5 },
          velocity: { x: [-10, 10], y: [200, 400] },
          gravity: { x: 0, y: 500 },
        });`,
      },
    ],
    tags: ['visual', 'effects', 'particles', 'emitter'],
  },
});
```

### Testing Architecture

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',           // DOM for canvas tests
    coverage: { provider: 'v8' },   // Fast native coverage
    include: ['**/*.test.ts'],
    benchmark: { include: ['**/*.bench.ts'] },
  },
});

// Example: Component test
import { describe, it, expect } from 'vitest';
import { World, Entity } from '@quintus/core';
import { Transform, Velocity } from '@quintus/sprites';
import { Physics2D, PhysicsSystem } from '@quintus/physics';

describe('Physics2D System', () => {
  it('applies gravity to entities with velocity', () => {
    const world = new World();
    world.addSystem(new PhysicsSystem({ gravity: { x: 0, y: 980 } }));

    const entity = world.spawn({
      transform: { x: 100, y: 100 },
      velocity: { x: 0, y: 0 },
      physics2d: {},
    });

    world.step(1/60);

    const vel = entity.get(Velocity);
    expect(vel.y).toBeCloseTo(980 / 60, 1);
  });

  it('resolves collisions between entities', () => {
    const world = new World();
    const collisions: CollisionEvent[] = [];

    world.on('collision', (e) => collisions.push(e));

    const a = world.spawn({
      transform: { x: 100, y: 100 },
      collider: { width: 32, height: 32 },
    });

    const b = world.spawn({
      transform: { x: 110, y: 100 },
      collider: { width: 32, height: 32 },
    });

    world.step(1/60);

    expect(collisions).toHaveLength(1);
    expect(collisions[0].entities).toContain(a);
    expect(collisions[0].entities).toContain(b);
  });
});

// Example: Integration test (example game as test)
import { describe, it, expect } from 'vitest';
import { loadExample } from '@quintus/test-utils';

describe('Platformer Example', () => {
  it('player can complete level 1', async () => {
    const game = await loadExample('platformer');
    const player = game.world.find('player');

    // Simulate input
    game.input.press('right', 2.0); // Hold right for 2 seconds
    game.input.tap('jump');          // Jump

    await game.advanceTime(3.0);

    expect(player.get(Transform).x).toBeGreaterThan(200);
    expect(game.scene.name).toBe('level1'); // Still alive
  });
});

// Example: Benchmark test
import { bench, describe } from 'vitest';
import { World } from '@quintus/core';

describe('ECS Performance', () => {
  bench('spawn 10,000 entities', () => {
    const world = new World();
    for (let i = 0; i < 10_000; i++) {
      world.spawn({ transform: { x: i, y: 0 }, velocity: { x: 1, y: 0 } });
    }
  });

  bench('iterate 10,000 entities', () => {
    // pre-populated world
    world.step(1/60);
  });
});
```

### Example Game: Platformer (Shows Simple API)

```typescript
// examples/platformer/main.ts
import { Game, Sprite, TileMap, Scene } from 'quintus';
import { PlatformerControls } from 'quintus/components';

class Player extends Sprite<{ jumps: number; maxJumps: number }> {
  defaults = { sprite: 'hero', jumps: 0, maxJumps: 2 };

  setup() {
    this.add('physics2d', 'animation');
    this.add('platformer', { jumpForce: -500, moveSpeed: 200 });
  }

  onCollide(other: Entity, info: CollisionInfo) {
    if (other.has('coin')) {
      other.destroy();
      this.game.score += 10;
      this.game.audio.play('coin');
    }
    if (other.has('enemy')) {
      if (info.fromAbove) {
        other.destroy();
        this.velocity.y = -300; // Bounce
        this.game.audio.play('stomp');
      } else {
        this.hurt(1);
      }
    }
    if (other.has('goal')) {
      this.game.scene('victory');
    }
  }
}

class Goomba extends Sprite {
  defaults = { sprite: 'goomba', direction: 1 };

  setup() {
    this.add('physics2d', 'animation');
    this.add('patrol', { speed: 50 });
    this.tag('enemy');
  }
}

class Coin extends Sprite {
  defaults = { sprite: 'coin' };

  setup() {
    this.add('animation');
    this.play('spin');
    this.tag('coin');
  }
}

// Game setup
const game = new Game({
  width: 800,
  height: 600,
  scale: 'fit',
  pixelArt: true,
});

game.load({
  sprites: ['hero.png', 'goomba.png', 'coin.png', 'tiles.png'],
  maps: ['level1.json'],
  audio: ['coin.wav', 'stomp.wav', 'music.mp3'],
});

game.scene('level1', (world) => {
  const map = world.spawn(TileMap, { asset: 'level1.json' });
  const player = world.spawn(Player, { x: 64, y: 200 });

  // Spawn enemies and coins from map object layer
  map.spawnObjects({
    goomba: Goomba,
    coin: Coin,
  });

  world.camera.follow(player, { lerp: 0.1, bounds: map.bounds });
});

game.scene('victory', (world) => {
  world.ui.text('You Win!', { x: 400, y: 250, size: 48, align: 'center' });
  world.ui.button('Play Again', { x: 400, y: 350 }, () => {
    game.scene('level1');
  });
});

game.start('level1');
```

### Example: LLM-Generated Plugin

This is what an LLM should be able to produce with good documentation:

```typescript
// A weather system plugin generated by an LLM
import { definePlugin, Component, System, Query } from '@quintus/core';
import { Transform } from '@quintus/sprites';
import { Emitter } from '@quintus/particles';

const Weather = Component.define('weather', {
  type: 'clear' as 'clear' | 'rain' | 'snow' | 'storm',
  intensity: 0.5,
  windX: 0,
  windY: 0,
});

class WeatherSystem extends System {
  priority = 50; // Run before rendering

  private emitter?: Entity;
  private currentWeather = 'clear';

  update(dt: number) {
    const weather = this.world.singleton(Weather);
    if (!weather) return;

    if (weather.type !== this.currentWeather) {
      this.emitter?.destroy();
      this.currentWeather = weather.type;

      switch (weather.type) {
        case 'rain':
          this.emitter = this.world.spawn(Emitter, {
            x: 0, y: -50,
            width: this.world.camera.width,
            rate: 200 * weather.intensity,
            texture: 'raindrop',
            lifetime: { min: 0.5, max: 1.0 },
            velocity: {
              x: [weather.windX - 20, weather.windX + 20],
              y: [300, 500],
            },
            alpha: { start: 0.6, end: 0.1 },
            size: { start: 2, end: 1 },
          });
          break;
        case 'snow':
          this.emitter = this.world.spawn(Emitter, {
            x: 0, y: -50,
            width: this.world.camera.width,
            rate: 50 * weather.intensity,
            texture: 'snowflake',
            lifetime: { min: 2, max: 5 },
            velocity: {
              x: [weather.windX - 30, weather.windX + 30],
              y: [20, 60],
            },
            rotation: { min: 0, max: 360, speed: [-90, 90] },
            alpha: { start: 0.8, end: 0 },
            size: { start: 4, end: 2 },
          });
          break;
      }
    }
  }
}

export const WeatherPlugin = definePlugin({
  name: 'weather',
  version: '1.0.0',
  description: 'Dynamic weather effects (rain, snow, storm)',
  requires: ['core', 'particles'],
  components: { weather: Weather },
  systems: [{ system: WeatherSystem, before: 'render' }],
  setup(ctx) {
    ctx.extendWorld({
      setWeather(type: string, intensity = 0.5) {
        let w = this.singleton(Weather);
        if (!w) w = this.spawn({ weather: {} }).get(Weather);
        w.type = type as any;
        w.intensity = intensity;
      },
    });
  },
});
```

---

## Part 5: Development Tooling & Build System

### Monorepo Setup

```
quintus/
├── packages/
│   ├── core/           # @quintus/core
│   ├── math/           # @quintus/math
│   ├── renderer-2d/    # @quintus/renderer-2d
│   ├── renderer-3d/    # @quintus/renderer-3d
│   ├── sprites/        # @quintus/sprites
│   ├── physics/        # @quintus/physics
│   ├── collision/      # @quintus/collision
│   ├── input/          # @quintus/input
│   ├── audio/          # @quintus/audio
│   ├── ui/             # @quintus/ui
│   ├── tilemap/        # @quintus/tilemap
│   ├── particles/      # @quintus/particles
│   ├── tween/          # @quintus/tween
│   ├── camera/         # @quintus/camera
│   ├── prefab/         # @quintus/prefab
│   ├── debug/          # @quintus/debug
│   ├── scene/          # @quintus/scene
│   └── quintus/        # Meta-package
├── examples/
│   ├── platformer/       # Classic platformer
│   ├── top-down-rpg/     # Zelda-like
│   ├── space-shooter/    # Vertical scrolling shooter
│   ├── breakout/         # Arcade classic
│   ├── puzzle/           # Match-3 or Tetris
│   ├── tower-defense/    # Strategy
│   ├── racing/           # 2D top-down racing
│   ├── fighting/         # 2D fighter
│   ├── 3d-platformer/    # Three.js 3D game
│   ├── 3d-fps/           # Three.js first-person
│   ├── hybrid-2d-3d/     # Mixed rendering
│   └── multiplayer/      # WebSocket multiplayer
├── plugins/
│   ├── weather/          # Weather effects
│   ├── dialogue/         # RPG dialogue system
│   ├── inventory/        # Item/inventory system
│   ├── pathfinding/      # A* pathfinding
│   ├── state-machine/    # FSM for AI/game states
│   ├── save-system/      # Save/load game state
│   └── networking/       # WebSocket/WebRTC
├── tools/
│   ├── create-quintus/   # `npm create quintus` scaffolding
│   ├── quintus-vite/     # Vite plugin for Quintus
│   └── quintus-cli/      # Dev tools CLI
├── docs/
│   ├── guide/            # Tutorial guide
│   ├── api/              # Generated API docs (TypeDoc)
│   └── llm/              # LLM-specific documentation
│       ├── SYSTEM_PROMPT.md   # System prompt for LLM game dev
│       ├── API_CHEATSHEET.md  # Quick reference
│       └── EXAMPLES.md        # Curated examples for context
├── vitest.config.ts
├── tsconfig.json
├── pnpm-workspace.yaml
└── package.json
```

### Build Toolchain

- **Package manager**: pnpm (fast, disk-efficient, good monorepo support)
- **Build**: tsup (esbuild-based, outputs ESM + CJS + types)
- **Dev server**: Vite (for examples and development)
- **Test**: Vitest (fast, TypeScript-native, benchmarks built-in)
- **Docs**: TypeDoc (generates from TypeScript)
- **Lint**: Biome (fast Rust-based linter + formatter, replaces ESLint + Prettier)
- **CI**: GitHub Actions

### `npm create quintus` Scaffolding

```bash
$ npm create quintus my-game

? What kind of game?
  ❯ 2D Platformer
    2D Top-Down
    2D Puzzle
    3D (Three.js)
    Empty Project

? Include these features?
  ◉ Physics
  ◉ Animations
  ◉ Audio
  ◉ Tilemap support
  ◯ Particles
  ◯ UI system
  ◯ Three.js 3D

Creating my-game/...
  ✓ Package configured (quintus + selected plugins)
  ✓ Vite dev server configured
  ✓ Example scene created
  ✓ TypeScript configured
  ✓ Vitest configured

  $ cd my-game
  $ npm run dev
```

---

## Part 6: Migration Path from Quintus 1.0

### What Maps Directly

| Quintus 1.0 | Quintus 2.0 | Notes |
|-------------|-------------|-------|
| `Q.include("Sprites, Scenes")` | `import { Sprite, Scene } from 'quintus'` | ES modules |
| `Q.Sprite.extend("Player", {...})` | `class Player extends Sprite {...}` | TypeScript classes |
| `sprite.add('2d, platformerControls')` | `this.add('physics2d', 'platformer')` | Same concept, typed |
| `sprite.on('hit.sprite', fn)` | `this.onCollide(other, info)` | Typed callbacks |
| `Q.scene("level1", fn)` | `game.scene('level1', fn)` | Instance method |
| `Q.stageScene("level1")` | `game.start('level1')` | Clearer naming |
| `stage.insert(new Q.Player())` | `world.spawn(Player, props)` | Factory method |
| `Q.load([...], callback)` | `game.load({...})` | Structured, async |
| `this.p.x`, `this.p.y` | `this.x`, `this.y` or `this.position.x` | Direct properties |
| `Q.sheet("tiles", ...)` | Automatic from asset manifest | Convention-based |

### Compatibility Layer (Optional Plugin)

```typescript
// @quintus/compat — for migrating existing Quintus 1.0 games
import { enableCompat } from '@quintus/compat';

const Q = enableCompat(new Game());

// Now works like Quintus 1.0
Q.include("Sprites, Scenes, 2D");
Q.Sprite.extend("Player", {
  init: function(p) { ... },
  step: function(dt) { ... }
});
```

---

## Part 7: Competitive Positioning

### Where Quintus 2.0 Fits

```
                    Simple ◄─────────────────────► Complex

  Tiny    ┌─────────────────────────────────────────────┐
  (<50KB) │  LittleJS          Quintus 2.0              │
          │  (15KB, JS)        (15-50KB, TS, 2D+3D)     │
          ├─────────────────────────────────────────────┤
  Medium  │  KAPLAY            Excalibur.js    Phaser   │
  (50-    │  (beginner)        (ECS, TS)       (mature) │
  350KB)  │                                             │
          ├─────────────────────────────────────────────┤
  Large   │                    Babylon.js               │
  (>350KB)│                    (3D, TS)                 │
          └─────────────────────────────────────────────┘
                              2D only ◄────► 2D + 3D
```

### Quintus 2.0's Unique Value Proposition

1. **Smallest TypeScript game engine** — 15KB core, 50KB full
2. **Only tiny engine with Three.js integration** — 2D + 3D in one framework
3. **Most LLM-friendly** — Designed from the ground up for AI code generation
4. **True plugin ecosystem** — Self-describing, typed, discoverable plugins
5. **Graduated complexity** — Simple Sprite API → Full ECS, grow with your needs
6. **Best testing story** — Every feature tested, examples are integration tests
7. **Modern tooling** — Vite, Vitest, TypeScript, ES Modules, tree-shaking

---

## Part 8: Suggested Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
- [ ] Monorepo setup (pnpm, tsup, Vitest, Biome)
- [ ] `@quintus/core` — Game loop, ECS, events, plugin system
- [ ] `@quintus/math` — Vec2, Matrix, AABB
- [ ] `@quintus/renderer-2d` — Canvas2D renderer
- [ ] First example: bouncing ball (validates core loop)
- [ ] CI/CD pipeline with automated tests

### Phase 2: Game Essentials (Weeks 5-8)
- [ ] `@quintus/sprites` — Sprite sheets, animations
- [ ] `@quintus/collision` — SAT, AABB, spatial hash
- [ ] `@quintus/physics` — 2D physics (velocity, gravity, collision response)
- [ ] `@quintus/input` — Keyboard, mouse, touch, gamepad
- [ ] `@quintus/camera` — Viewport, follow, shake
- [ ] Second example: Breakout (validates physics + input)
- [ ] Third example: Platformer (validates all core systems)

### Phase 3: Content Systems (Weeks 9-12)
- [ ] `@quintus/tilemap` — Tiled JSON import, tile layers
- [ ] `@quintus/audio` — Web Audio API, sound effects, music
- [ ] `@quintus/tween` — Tweens, easing, timelines
- [ ] `@quintus/ui` — Buttons, text, containers, menus
- [ ] `@quintus/particles` — Particle emitters
- [ ] `@quintus/scene` — Scene management, transitions
- [ ] Fourth example: Top-down RPG (validates tilemaps, scenes, UI)
- [ ] Fifth example: Space shooter (validates particles, audio)

### Phase 4: 3D Integration (Weeks 13-16)
- [ ] `@quintus/renderer-3d` — Three.js bridge
- [ ] 3D entity components (mesh, light, camera)
- [ ] 2D-on-3D overlay system
- [ ] Sixth example: 3D platformer
- [ ] Seventh example: Hybrid 2D/3D game

### Phase 5: Polish & Ecosystem (Weeks 17-20)
- [ ] `@quintus/debug` — Inspector, FPS, collision viz
- [ ] `@quintus/prefab` — Entity templates
- [ ] `create-quintus` scaffolding tool
- [ ] LLM documentation (system prompts, cheatsheets)
- [ ] 5+ more example games
- [ ] 5+ LLM-authored plugins (weather, dialogue, inventory, pathfinding, state-machine)
- [ ] WebGL2 renderer option
- [ ] Performance benchmarks
- [ ] Public launch

---

## Part 9: Key Technical Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Language | TypeScript (strict mode) | Type safety, LLM-friendly, IDE support |
| Module format | ESM only (CJS via tsup) | Tree-shaking, modern standard |
| Build tool | tsup (esbuild) | Fast, zero-config, ESM+CJS+types |
| Dev server | Vite | Fast HMR, native TS, standard |
| Test runner | Vitest | Fast, TS-native, benchmarks |
| Package manager | pnpm | Fast, monorepo support, disk-efficient |
| Linter | Biome | Fast (Rust), replaces ESLint+Prettier |
| Docs | TypeDoc + Starlight | Generated API + guide site |
| CI | GitHub Actions | Standard, free for OSS |
| Renderer default | Canvas2D | Universal, fast for 2D, simple |
| Renderer advanced | WebGL2 (opt-in) | Batched sprites, shaders |
| 3D | Three.js peer dep | Industry standard, huge ecosystem |
| Physics | Custom (simple) | Tiny, sufficient for most 2D games |
| Collision | SAT + spatial hash | Proven in Quintus 1.0, works well |
| ECS storage | Sparse array | Simple, fast enough, debuggable |
| Asset loading | Fetch + async/await | Modern, progressive, cacheable |
| Audio | Web Audio API | Universal, spatial audio capable |

---

## Appendix: Key Resources

### Engines to Study
- [Excalibur.js source](https://github.com/excaliburjs/Excalibur) — Best TypeScript ECS reference
- [LittleJS source](https://github.com/KilledByAPixel/LittleJS) — Best tiny engine reference
- [Phaser v4 source](https://github.com/phaserjs/phaser) — Best mature engine reference
- [bitECS](https://github.com/NateTheGreatt/bitECS) — Minimal ECS implementation reference

### Three.js Integration References
- [react-three-fiber](https://github.com/pmndrs/react-three-fiber) — Declarative Three.js patterns
- [Threlte](https://threlte.xyz/) — Svelte Three.js patterns
- [Three.js examples](https://threejs.org/examples/) — What's possible

### Modern Web Game Dev
- [WebGPU Fundamentals](https://webgpufundamentals.org/)
- [Game Programming Patterns](https://gameprogrammingpatterns.com/) — Bob Nystrom
- [ECS FAQ](https://github.com/SanderMertens/ecs-faq) — Comprehensive ECS reference
