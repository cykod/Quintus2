# Quintus 2.0: AI Integration Architecture

## The Big Idea

Most game engines bolt AI features on as an afterthought — a copilot sidebar, an asset generator, maybe a chatbot NPC system. Quintus 2.0 does something different: **the engine itself is designed to be operated by AI**.

This means an LLM can:

1. **Write** game code that works on the first try (typed API, predictable patterns)
2. **Run** the game in a headless simulation (no browser needed)
3. **Watch** what happens via a state tree and visual snapshots
4. **Iterate** — tweak physics, adjust AI, fix bugs — all in a tight loop
5. **Test** deterministically — same seed, same inputs, same result every time

The key packages:

```
@quintus/test        — Deterministic simulation, input scripting, assertions
@quintus/snapshot    — State serialization, visual capture, diff tools
@quintus/mcp        — MCP server exposing engine as AI-controllable tools
@quintus/headless    — Node.js runtime (no canvas, no browser)
@quintus/ai-prefabs  — LLM-generated component library
```

---

## Part 1: The Deterministic Simulation Engine

### Why Determinism Matters for AI

An LLM writes code for a platformer enemy. Does the enemy work? Without determinism, you'd have to eyeball it. With determinism:

- Same seed + same inputs = same result, every time
- Run 1000 variations in seconds (headless, no rendering)
- Compare frame-by-frame state against expected behavior
- CI can catch regressions: "the Goomba used to die when stomped, now it doesn't"

### Fixed Timestep + Seeded RNG

```typescript
// The game loop splits rendering from logic
class Game {
  // Physics/logic always tick at exactly 60hz
  readonly fixedDeltaTime = 1 / 60;  // 16.667ms

  // Seeded RNG — deterministic across runs
  private _rng: SeededRandom;

  constructor(options: GameOptions) {
    this._rng = new SeededRandom(options.seed ?? Date.now());
  }

  // All game code uses this instead of Math.random()
  get random(): SeededRandom {
    return this._rng;
  }
}

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  // Core: deterministic float 0-1
  next(): number { /* mulberry32 or similar */ }

  // Convenience methods — LLMs use these naturally
  int(min: number, max: number): number;
  float(min: number, max: number): number;
  bool(probability?: number): boolean;
  pick<T>(array: T[]): T;
  shuffle<T>(array: T[]): T[];
  angle(): number;           // 0 to 2π
  direction(): Vec2;         // Random unit vector
  inCircle(radius: number): Vec2;
  inRect(width: number, height: number): Vec2;
  color(): Color;
  weighted<T>(items: Array<{ value: T; weight: number }>): T;

  // Fork: create a child RNG with its own sequence
  // (so subsystems don't interfere with each other's randomness)
  fork(label?: string): SeededRandom;
}

// Usage in game code
class EnemySpawner extends Node {
  update(dt: number) {
    if (this.game.random.bool(0.02)) {  // 2% chance per frame
      const pos = this.game.random.inRect(this.scene.width, 0);
      this.scene.add(Goomba, { position: pos });
    }
  }
}
```

**The `fork()` pattern is critical.** Without it, adding a particle effect changes the RNG sequence for everything else and breaks determinism. Each subsystem gets its own forked RNG:

```typescript
class Scene {
  ready() {
    this.physicsRng = this.game.random.fork('physics');
    this.spawnRng = this.game.random.fork('spawning');
    this.particleRng = this.game.random.fork('particles');
    // Adding/removing particles doesn't affect spawn timing
  }
}
```

---

## Part 2: The AI Testing Framework (`@quintus/test`)

### Input Scripting

The core idea: describe what a player does over time, then run the simulation and inspect the results.

```typescript
import { TestRunner, InputScript, expect } from '@quintus/test';
import { Level1 } from '../scenes/level1';

// An InputScript is a timeline of player actions
const script = InputScript.create()
  .wait(0.5)                        // Wait 500ms
  .press('right', { duration: 2.0 }) // Hold right for 2 seconds
  .press('jump')                     // Tap jump (single frame)
  .wait(0.3)
  .press('right', { duration: 1.0 })
  .press('jump')                     // Jump while moving right
  .wait(0.5)
  .press('attack')                   // Attack
  .waitUntil('player.isOnFloor')     // Wait for condition
  .press('right', { duration: 3.0 });

// Run the simulation
const result = await TestRunner.run({
  scene: Level1,
  seed: 42,
  input: script,
  duration: 10,              // Run for 10 seconds of game time
  captureFrames: true,        // Take visual snapshots
  captureInterval: 0.5,       // Every 500ms of game time
});
```

### State Tree Inspection

After (or during) a test run, the AI can inspect the full state of the game:

```typescript
// The state tree is a serializable snapshot of the entire scene
interface StateSnapshot {
  time: number;               // Game time in seconds
  frame: number;              // Frame number
  seed: number;               // RNG seed used
  rngState: number;           // Current RNG state (for resuming)

  tree: NodeSnapshot;         // The full node tree

  physics: {
    contacts: ContactInfo[];  // Active collisions this frame
    bodies: number;           // Active body count
  };

  performance: {
    nodeCount: number;
    updateTimeMs: number;
    renderTimeMs: number;
    memoryBytes: number;
  };
}

interface NodeSnapshot {
  id: number;
  type: string;               // 'Player', 'Goomba', 'TileMap', etc.
  name: string;
  tags: string[];
  position?: { x: number; y: number };
  velocity?: { x: number; y: number };
  // All @prop values, serialized
  props: Record<string, unknown>;
  // Signal connection count (for debugging leaks)
  signalConnections: number;
  // Children
  children: NodeSnapshot[];
}

// Query the state tree naturally
const playerState = result.stateAt(5.0)                // State at t=5s
  .find(n => n.type === 'Player');                      // Find player node

expect(playerState.position.x).toBeGreaterThan(300);    // Moved right
expect(playerState.props.health).toBe(3);                // Not hurt
expect(playerState.tags).not.toContain('dead');          // Still alive

// Count enemies remaining at t=8s
const enemiesAt8 = result.stateAt(8.0)
  .findAll(n => n.tags.includes('enemy'));
expect(enemiesAt8.length).toBe(2);

// Check that a coin was collected between t=3 and t=5
const coinsAt3 = result.stateAt(3.0).findAll(n => n.type === 'Coin');
const coinsAt5 = result.stateAt(5.0).findAll(n => n.type === 'Coin');
expect(coinsAt5.length).toBeLessThan(coinsAt3.length);
```

### Visual Snapshots

The simulation captures rendered frames at intervals — even in headless mode (via OffscreenCanvas or node-canvas):

```typescript
// Visual assertions
const frame = result.frameAt(5.0);   // PNG buffer at t=5s

// Save for inspection
await frame.save('test-output/player-at-5s.png');

// Visual regression: compare against baseline
await expect(frame).toMatchBaseline('baselines/level1-5s.png', {
  threshold: 0.02,      // 2% pixel difference allowed
  ignoreRegions: [       // Ignore areas with animation/particles
    { x: 0, y: 0, w: 100, h: 30 },  // Score display
  ],
});

// Generate a filmstrip (single image showing progression)
const filmstrip = result.filmstrip({
  times: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  tileWidth: 160,
  tileHeight: 120,
});
await filmstrip.save('test-output/level1-filmstrip.png');

// Generate animated GIF of the entire run
const gif = result.toGif({
  fps: 10,
  width: 320,
  height: 240,
  speed: 2,     // 2x speed
});
await gif.save('test-output/level1-run.gif');
```

### Scenario-Based Testing

Pre-built test scenarios for common game situations:

```typescript
import { scenarios } from '@quintus/test';

// Test that the player can navigate the level
scenarios.canComplete(Level1, {
  seed: 42,
  timeout: 60,     // Must complete within 60s of game time
  strategy: 'explore-right',  // Built-in traversal strategy
});

// Test that an enemy behaves correctly
scenarios.entityBehavior(Goomba, {
  seed: 42,
  setup: (scene) => {
    scene.add(Goomba, { x: 200, y: 100 });
    scene.add(StaticBody, { x: 0, y: 200, width: 400, height: 32 }); // Floor
  },
  expectations: [
    { at: 1.0, expect: (goomba) => goomba.position.x !== 200 },  // Moved
    { at: 1.0, expect: (goomba) => goomba.isOnFloor() },          // On ground
  ],
});

// Test collision behavior
scenarios.collision({
  seed: 42,
  entities: [
    { type: Player, position: { x: 100, y: 100 }, velocity: { x: 100, y: 0 } },
    { type: Goomba, position: { x: 200, y: 100 } },
  ],
  floor: { y: 200, width: 400 },
  expect: {
    contact: true,                    // They should collide
    afterContact: (player, goomba) => {
      // Verify collision response
    },
  },
});

// Test that the player dies from falling
scenarios.fallDeath(Level1, {
  seed: 42,
  setup: (scene) => {
    const player = scene.findByType(Player)[0];
    player.position = { x: 50, y: 100 };
  },
  input: InputScript.create().press('left', { duration: 5.0 }),
  expectDeath: true,
  deathCause: 'fall',
});
```

### The Assertion Library

Game-specific assertions that read naturally:

```typescript
import { expect } from '@quintus/test';

// Spatial assertions
expect(player).toBeAbove(platform);
expect(player).toBeLeftOf(enemy);
expect(player).toBeWithinDistance(coin, 50);
expect(player).toBeOnScreen();
expect(player).toBeOnFloor();

// State assertions
expect(player).toHaveTag('alive');
expect(player).toHaveHealth(3);
expect(player).toBeAnimating('run');
expect(player).toBeFacing('right');

// Scene assertions
expect(scene).toContainEntity(Player);
expect(scene).toHaveEntityCount('enemy', 5);
expect(scene).toHaveNoOrphanedSignals();

// Physics assertions
expect(player).toBeMoving();
expect(player).toBeMovingRight();
expect(player).toHaveVelocityAbove(100);
expect(bullet).toHaveCollidedWith(enemy);

// Timeline assertions
expect(result).toHaveEventBetween(3.0, 5.0, 'coinCollected');
expect(result).entityDestroyedBefore(10.0, 'Goomba');
```

---

## Part 3: The MCP Server (`@quintus/mcp`)

### What This Enables

An LLM (Claude, GPT, etc.) connects to a running or headless Quintus game via MCP. It can:

- Inspect the scene tree
- Modify entities and their properties
- Inject input
- Step the simulation forward
- Capture screenshots
- Read console output / signals
- Hot-reload code changes

This turns the game engine into an **AI-controllable sandbox**.

### MCP Tool Definitions

```typescript
// @quintus/mcp exposes these tools to any MCP-compatible AI client

const tools = {
  // ─── Scene Inspection ───────────────────────────────
  'quintus.getSceneTree': {
    description: 'Get the full node tree of the current scene',
    params: {
      depth: { type: 'number', description: 'Max tree depth (default: all)', optional: true },
      filter: { type: 'string', description: 'Filter by tag or type', optional: true },
    },
    returns: 'NodeSnapshot tree with positions, velocities, tags, props',
  },

  'quintus.getNode': {
    description: 'Get detailed info about a specific node by name or ID',
    params: {
      query: { type: 'string', description: 'Node name, ID, type, or tag' },
    },
    returns: 'Full NodeSnapshot with all props, children, signals',
  },

  'quintus.queryNodes': {
    description: 'Find nodes matching criteria',
    params: {
      type: { type: 'string', optional: true },
      tag: { type: 'string', optional: true },
      near: { type: 'object', description: '{ x, y, radius }', optional: true },
    },
    returns: 'Array of matching NodeSnapshots',
  },

  // ─── Scene Modification ─────────────────────────────
  'quintus.addNode': {
    description: 'Add a new node to the scene',
    params: {
      type: { type: 'string', description: 'Node type (Player, Goomba, Sprite, etc.)' },
      props: { type: 'object', description: 'Position, velocity, and any @prop values' },
      parent: { type: 'string', description: 'Parent node name/ID (default: scene root)', optional: true },
    },
    returns: 'The created NodeSnapshot',
  },

  'quintus.updateNode': {
    description: 'Modify properties of an existing node',
    params: {
      query: { type: 'string', description: 'Node name or ID' },
      props: { type: 'object', description: 'Properties to update' },
    },
  },

  'quintus.removeNode': {
    description: 'Remove a node from the scene',
    params: {
      query: { type: 'string', description: 'Node name or ID' },
    },
  },

  // ─── Simulation Control ─────────────────────────────
  'quintus.step': {
    description: 'Advance the simulation by N frames or N seconds',
    params: {
      frames: { type: 'number', optional: true, description: 'Number of frames to advance' },
      seconds: { type: 'number', optional: true, description: 'Seconds of game time to advance' },
      captureState: { type: 'boolean', optional: true, description: 'Return state snapshot after stepping' },
    },
    returns: 'StateSnapshot after stepping (if captureState=true)',
  },

  'quintus.pause': { description: 'Pause the simulation' },
  'quintus.resume': { description: 'Resume the simulation' },
  'quintus.reset': {
    description: 'Reset the scene to initial state',
    params: {
      scene: { type: 'string', optional: true, description: 'Scene to load (default: current)' },
      seed: { type: 'number', optional: true, description: 'RNG seed for deterministic playback' },
    },
  },

  // ─── Input Injection ────────────────────────────────
  'quintus.pressAction': {
    description: 'Simulate pressing a game action (like pressing a key)',
    params: {
      action: { type: 'string', description: 'Action name (jump, left, right, attack, etc.)' },
      duration: { type: 'number', optional: true, description: 'Hold duration in seconds (default: one frame)' },
    },
  },

  'quintus.releaseAction': {
    description: 'Release a held action',
    params: { action: { type: 'string' } },
  },

  'quintus.runInputScript': {
    description: 'Execute a sequence of timed inputs',
    params: {
      script: {
        type: 'array',
        description: 'Array of { action, type: press|release|wait, duration?, time? }',
      },
      captureFrames: { type: 'boolean', optional: true },
    },
    returns: 'TestResult with state snapshots and optional frame captures',
  },

  // ─── Visual Capture ─────────────────────────────────
  'quintus.screenshot': {
    description: 'Capture the current rendered frame as a PNG image',
    params: {
      width: { type: 'number', optional: true },
      height: { type: 'number', optional: true },
    },
    returns: 'PNG image data (base64)',
  },

  'quintus.filmstrip': {
    description: 'Capture a series of frames over a time range',
    params: {
      duration: { type: 'number', description: 'Total time to capture' },
      interval: { type: 'number', description: 'Time between captures' },
      input: { type: 'array', optional: true, description: 'Input script to execute during capture' },
    },
    returns: 'Array of PNG frames + state snapshots at each point',
  },

  // ─── Code Hot-Reload ────────────────────────────────
  'quintus.hotReload': {
    description: 'Hot-reload a game source file without restarting',
    params: {
      file: { type: 'string', description: 'Path to the TypeScript file to reload' },
      code: { type: 'string', description: 'New file contents' },
    },
    returns: '{ success: boolean, errors?: string[] }',
  },

  'quintus.eval': {
    description: 'Execute TypeScript code in the game context',
    params: {
      code: { type: 'string', description: 'Code to execute (has access to scene, game, etc.)' },
    },
    returns: 'Serialized return value',
  },

  // ─── Signals / Events ──────────────────────────────
  'quintus.watchSignals': {
    description: 'Start watching for signal emissions',
    params: {
      node: { type: 'string', description: 'Node to watch' },
      signals: { type: 'array', description: 'Signal names to watch (or "all")' },
    },
  },

  'quintus.getSignalLog': {
    description: 'Get all captured signal emissions since last call',
    returns: 'Array of { time, node, signal, payload }',
  },

  // ─── Asset Management ──────────────────────────────
  'quintus.listAssets': {
    description: 'List all loaded assets and their types',
    returns: 'Array of { name, type, size }',
  },

  'quintus.listNodeTypes': {
    description: 'List all registered node types and their @prop definitions',
    returns: 'Array of { type, props: { name, type, default }[], signals: string[] }',
  },

  'quintus.listScenes': {
    description: 'List all defined scenes',
    returns: 'Array of { name, description }',
  },

  // ─── Diagnostics ───────────────────────────────────
  'quintus.getPerformance': {
    description: 'Get performance metrics',
    returns: '{ fps, nodeCount, bodyCount, drawCalls, memoryMB }',
  },

  'quintus.getPhysicsDebug': {
    description: 'Get collision shapes, contacts, and spatial hash grid visualization',
    returns: 'Debug overlay data as JSON (or rendered to PNG)',
  },
};
```

### MCP Server Architecture

```
┌─────────────────────┐     MCP Protocol      ┌──────────────────────┐
│                     │    (stdio/SSE/WS)      │                      │
│   AI Client         │◄─────────────────────► │  @quintus/mcp        │
│   (Claude Code,     │                        │  server               │
│    Cursor,          │                        │                      │
│    custom agent)    │                        │  ┌──────────────────┐│
│                     │                        │  │ Tool handlers    ││
└─────────────────────┘                        │  │ (scene tree,     ││
                                               │  │  input, capture) ││
                                               │  └────────┬─────────┘│
                                               │           │          │
                                               │  ┌────────▼─────────┐│
                                               │  │ Game Instance    ││
                                               │  │ (headless or     ││
                                               │  │  browser)        ││
                                               │  └──────────────────┘│
                                               └──────────────────────┘
```

### Two Modes of Operation

**Mode 1: Headless (Node.js)** — For CI, batch testing, AI iteration loops
```bash
# Start MCP server with headless game
npx quintus-mcp --headless --scene Level1 --seed 42

# Or in Claude Code's MCP config:
{
  "mcpServers": {
    "quintus": {
      "command": "npx",
      "args": ["quintus-mcp", "--project", "./my-game", "--headless"]
    }
  }
}
```

**Mode 2: Browser Bridge** — For visual debugging, live interaction
```bash
# Start dev server with MCP bridge
npx quintus dev --mcp

# Opens browser at localhost:5173 with game running
# MCP server on localhost:5174 bridges to the browser via WebSocket
# AI can see the game AND control it
```

### The AI Development Loop

Here's what an AI agent session looks like:

```
Human: "Make a platformer enemy that walks back and forth on platforms
        and turns around at edges"

AI thinks:
  1. I'll write a PatrolEnemy class
  2. Test it in headless mode to verify behavior
  3. Watch the visual output to make sure it looks right

AI calls: quintus.listNodeTypes()
  → Sees Body, AnimatedSprite, CollisionShape, etc.

AI calls: quintus.hotReload({
  file: 'src/entities/patrol-enemy.ts',
  code: `
    export class PatrolEnemy extends Body {
      @prop speed = 60;
      @prop edgeDetection = true;
      private direction = 1;

      ready() {
        this.tag('enemy');
        this.add(AnimatedSprite, { spriteSheet: 'enemies', defaultAnim: 'walk' });
        this.add(CollisionShape, { shape: 'rect', width: 16, height: 16 });
      }

      update(dt: number) {
        // Cast a ray down-forward to detect edges
        if (this.edgeDetection) {
          const edgeCheck = this.scene.physics.raycast(
            { x: this.position.x + (this.direction * 10), y: this.position.y },
            { x: 0, y: 1 },
            32
          );
          if (!edgeCheck.hit) this.direction *= -1;
        }

        if (this.isOnWall()) this.direction *= -1;
        this.velocity.x = this.speed * this.direction;
        this.getChild(AnimatedSprite)!.flipH = this.direction < 0;
        this.moveAndSlide(dt);
      }
    }
  `,
})

AI calls: quintus.reset({ scene: 'test-arena', seed: 42 })

AI calls: quintus.addNode({
  type: 'StaticBody',
  props: { position: { x: 0, y: 200 }, width: 300, height: 32 }
})  // Floor platform

AI calls: quintus.addNode({
  type: 'PatrolEnemy',
  props: { position: { x: 150, y: 180 } }
})

AI calls: quintus.filmstrip({
  duration: 5.0,
  interval: 0.5,
  input: []   // No player input, just watch the enemy
})
  → Receives 10 frames showing the enemy walking to the edge,
    turning around, walking to the other edge, turning around

AI: "The enemy patrols correctly. Let me verify the edge detection
     by testing on a shorter platform."

AI calls: quintus.reset({ seed: 42 })
AI calls: quintus.addNode({
  type: 'StaticBody',
  props: { position: { x: 100, y: 200 }, width: 80, height: 32 }
})  // Short platform

AI calls: quintus.addNode({
  type: 'PatrolEnemy',
  props: { position: { x: 120, y: 180 } }
})

AI calls: quintus.step({ seconds: 10, captureState: true })
  → State shows enemy is still on the platform at t=10
  → Edge detection working

AI: "Here's your PatrolEnemy. It walks back and forth on any platform,
     turning at edges and walls. Tested on both wide and narrow platforms."
```

---

## Part 4: The Headless Runtime (`@quintus/headless`)

### Running Without a Browser

For AI agents, CI pipelines, and batch testing, the game needs to run without a browser:

```typescript
// headless.ts — Node.js entry point
import { HeadlessGame } from '@quintus/headless';
import { Level1 } from './scenes/level1';

const game = new HeadlessGame({
  width: 320,
  height: 240,
  seed: 42,
  fixedDeltaTime: 1 / 60,
});

// Load assets from filesystem (not HTTP)
await game.loadAssets({
  sprites: ['./assets/hero.png'],
  maps: ['./assets/level1.json'],
});

// Run a scene
game.start(Level1);

// Step manually
for (let i = 0; i < 600; i++) {  // 10 seconds at 60fps
  game.step();
}

// Capture screenshot (uses node-canvas or OffscreenCanvas)
const png = await game.screenshot();
fs.writeFileSync('frame.png', png);

// Get state
const state = game.getState();
console.log(state.tree);
```

### What Headless Replaces

| Browser Feature | Headless Replacement |
|----------------|---------------------|
| `<canvas>` | `node-canvas` or `OffscreenCanvas` (from `worker_threads`) |
| `requestAnimationFrame` | Manual `game.step()` calls |
| `Image()` loading | `fs.readFile` + image decoder |
| Web Audio API | Stubbed (or optional `web-audio-api` npm package) |
| Keyboard/Mouse events | Programmatic `game.input.inject()` |
| `performance.now()` | `process.hrtime.bigint()` |
| `fetch()` for assets | `fs.readFile()` |

### Headless Performance

Without rendering overhead, headless mode is fast:

- **60fps game time at ~6000fps real time** (100x faster than real-time)
- A 60-second game test runs in ~0.6 seconds
- 1000 randomized test runs in ~10 minutes
- Ideal for fuzzing, parameter sweeping, and AI training loops

---

## Part 5: The AI-Aware Component Library (`@quintus/ai-prefabs`)

### What Are AI Prefabs?

Pre-built, well-tested, LLM-composable game components. Each one is:

1. **Self-documenting** — TSDoc + examples + behavior description
2. **Self-testing** — Ships with its own test suite
3. **Composable** — Designed to snap together
4. **Parametric** — Expose `@prop` values for easy tweaking

```typescript
/**
 * A character that walks back and forth on platforms.
 *
 * @example
 * // Basic patrol enemy
 * scene.add(PatrolEnemy, { x: 200, y: 100, speed: 40 });
 *
 * @example
 * // Fast enemy that doesn't detect edges (falls off platforms)
 * scene.add(PatrolEnemy, { x: 200, y: 100, speed: 100, detectEdges: false });
 *
 * @example
 * // Enemy with custom sprite and health
 * scene.add(PatrolEnemy, {
 *   x: 200, y: 100,
 *   spriteSheet: 'skeleton',
 *   health: 3,
 *   stompable: true,
 * });
 *
 * @behavior
 * - Walks in one direction at constant speed
 * - Turns around when hitting a wall
 * - Turns around at platform edges (if detectEdges=true)
 * - Can be stomped from above (if stompable=true)
 * - Emits 'died' signal when health reaches 0
 *
 * @tags enemy, stompable (if stompable=true)
 *
 * @signals
 * - died(): Emitted when health reaches 0
 * - hurt(amount: number): Emitted when taking damage
 * - turnedAround(): Emitted when changing direction
 */
export class PatrolEnemy extends Body {
  @prop speed = 40;
  @prop detectEdges = true;
  @prop stompable = true;
  @prop health = 1;
  @prop spriteSheet = 'enemies';
  @prop defaultAnim = 'walk';
  // ...
}
```

### The Prefab Library (Ships with Quintus)

```
@quintus/ai-prefabs/
  ├── characters/
  │   ├── PlatformerPlayer     — WASD/Arrow + jump + attack
  │   ├── TopDownPlayer        — 8-directional movement
  │   ├── PatrolEnemy          — Walks back and forth
  │   ├── FlyingEnemy          — Sine-wave flight pattern
  │   ├── ChasingEnemy         — Follows the player
  │   ├── TurretEnemy          — Stationary, shoots at player
  │   ├── BossEnemy            — Health bar, attack patterns, phases
  │   └── NPC                  — Dialogue-capable, idle animation
  │
  ├── items/
  │   ├── Coin                 — Collectible with score value
  │   ├── HealthPickup         — Restores health
  │   ├── PowerUp              — Temporary ability boost
  │   ├── Key                  — Unlocks doors
  │   ├── Chest                — Opens on interact, drops items
  │   └── Checkpoint           — Save/respawn point
  │
  ├── environment/
  │   ├── MovingPlatform       — Point-to-point or path-following
  │   ├── FallingPlatform      — Falls after standing on it
  │   ├── Spring               — Bounces player upward
  │   ├── Spikes               — Damage on contact
  │   ├── Door                 — Opens with key or trigger
  │   ├── Switch               — Toggles connected objects
  │   ├── Ladder               — Climbable surface
  │   └── Water                — Swimnable area with different physics
  │
  ├── effects/
  │   ├── DamageNumber         — Floating damage text
  │   ├── Explosion            — Animated particle burst
  │   ├── TrailEffect          — Motion trail behind moving entity
  │   └── ScreenShake          — Camera shake effect
  │
  ├── ui/
  │   ├── HealthBar            — Tracks entity health
  │   ├── ScoreDisplay         — Running score counter
  │   ├── DialogueBox          — NPC dialogue with typewriter effect
  │   ├── InventoryGrid        — Grid-based inventory UI
  │   ├── MiniMap              — Top-down map overview
  │   ├── PauseMenu            — Pause with resume/quit
  │   └── GameOverScreen       — Death screen with retry
  │
  └── systems/
      ├── Spawner              — Timed entity spawning
      ├── WaveManager          — Enemy wave orchestration
      ├── CameraZone           — Trigger camera behavior changes
      ├── MusicManager         — Context-aware music switching
      └── SaveSystem           — Save/load game state
```

### How LLMs Use Prefabs

An LLM generating a platformer doesn't need to write collision detection, edge detection, or health systems from scratch. It composes:

```typescript
// LLM prompt: "Make a platformer level with enemies, coins, and a boss"

// LLM generates:
import { Game, Scene, TileMap, Camera, Layer } from 'quintus';
import {
  PlatformerPlayer,
  PatrolEnemy,
  FlyingEnemy,
  BossEnemy,
  Coin,
  HealthPickup,
  MovingPlatform,
  Spikes,
  Checkpoint,
  HealthBar,
  ScoreDisplay,
  Door,
  Key,
  WaveManager,
} from '@quintus/ai-prefabs';

const Level1 = Scene.define('level1', (scene) => {
  const map = scene.add(TileMap, { asset: 'level1.json' });
  const player = scene.add(PlatformerPlayer, {
    position: map.getSpawnPoint('start'),
    maxHealth: 5,
    doubleJump: true,
  });

  // Enemies from map objects
  map.spawnObjects({
    patrol: PatrolEnemy,
    flyer: FlyingEnemy,
    coin: Coin,
    health: HealthPickup,
    spikes: Spikes,
    checkpoint: Checkpoint,
  });

  // Moving platforms
  scene.add(MovingPlatform, {
    from: { x: 300, y: 150 },
    to: { x: 500, y: 150 },
    speed: 40,
  });

  // Boss room trigger
  const door = scene.add(Door, { position: { x: 900, y: 100 }, needsKey: 'boss-key' });
  scene.add(Key, { position: { x: 600, y: 50 }, keyId: 'boss-key' });

  // Boss behind the door
  scene.add(BossEnemy, {
    position: { x: 1100, y: 100 },
    health: 20,
    spriteSheet: 'boss',
    patterns: ['charge', 'jump-slam', 'projectile-spread'],
    phaseThresholds: [0.5],  // Change pattern at 50% health
  });

  // Camera & UI
  scene.add(Camera, { follow: player, bounds: map.bounds, zoom: 2 });
  const ui = scene.add(Layer, { fixed: true, zIndex: 100 });
  ui.add(HealthBar, { player });
  ui.add(ScoreDisplay);
});
```

That's a complete, playable level from composing prefabs. The LLM didn't need to write a single line of physics, collision, or rendering code.

---

## Part 6: The AI Development Workflow

### Workflow 1: "Build Me a Game" (Vibe Coding)

```
User: "Build me a space shooter where I fly a ship and shoot asteroids"

AI Agent:
  1. quintus.listNodeTypes() → understand available components
  2. Generate main.ts, player.ts, asteroid.ts, bullet.ts
  3. quintus.hotReload(each file)
  4. quintus.reset({ scene: 'main', seed: 42 })
  5. quintus.runInputScript([
       { action: 'up', duration: 1 },
       { action: 'shoot', at: 0.5 },
       { action: 'right', duration: 0.5 },
       { action: 'shoot', at: 1.5 },
     ])
  6. quintus.filmstrip({ duration: 3 }) → verify visual result
  7. If something looks wrong → modify code → goto 3
  8. Generate tests for the game
  9. Return game files to user
```

### Workflow 2: "Debug This" (AI Troubleshooting)

```
User: "My enemies are falling through the floor"

AI Agent:
  1. quintus.getSceneTree() → inspect scene structure
  2. quintus.queryNodes({ type: 'PatrolEnemy' }) → check enemy props
  3. quintus.queryNodes({ tag: 'floor' }) → check floor setup
  4. quintus.getPhysicsDebug() → visualize collision shapes
  5. See that enemies have collisionMask but floor has wrong collisionLayer
  6. quintus.eval(`
       scene.findAll('floor').forEach(f => f.collisionLayer = Layers.world);
     `)
  7. quintus.step({ seconds: 2, captureState: true }) → verify fix
  8. quintus.screenshot() → visual confirmation
  9. Explain the issue and provide the code fix
```

### Workflow 3: "Tune This" (Parameter Optimization)

```
User: "The jump feels floaty, make it feel tighter"

AI Agent:
  1. quintus.getNode({ query: 'Player' }) → read current physics props
     → jumpForce: -300, gravity: 600

  2. Run 5 parameter sets in parallel (headless):
     Set A: jumpForce=-400, gravity=800   (snappy)
     Set B: jumpForce=-350, gravity=700   (medium)
     Set C: jumpForce=-450, gravity=900   (very snappy)
     Set D: jumpForce=-380, gravity=850   (tight arc)
     Set E: jumpForce=-420, gravity=1000  (fast fall)

  3. For each set:
     - Reset scene with same seed
     - Run input: jump, wait for land, jump, move right + jump
     - Measure: time-to-peak, total-air-time, horizontal-distance
     - Capture filmstrip

  4. Present comparison:
     "Here are 5 jump feels with their characteristics.
      Set D gives you a tight, responsive arc similar to Celeste.
      Set A is more like classic Mario. Which do you prefer?"

  5. Apply chosen parameters
```

### Workflow 4: "Test Everything" (CI/CD)

```yaml
# .github/workflows/test.yml
- name: Run Quintus Tests
  run: |
    npx vitest run                 # Unit tests
    npx quintus test --headless    # Headless game tests
    npx quintus visual-test        # Visual regression
    npx quintus perf-test          # Performance benchmarks
```

```typescript
// tests/game.test.ts
import { TestRunner, InputScript, expect } from '@quintus/test';

describe('Level 1', () => {
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

    const player = result.finalState.find(n => n.type === 'Player');
    expect(player.props.checkpoint).toBe(1);
  });

  test('all coins are reachable', async () => {
    // Test with an exploration bot
    const result = await TestRunner.run({
      scene: Level1,
      seed: 42,
      input: InputScript.explore({ strategy: 'exhaustive', duration: 120 }),
      duration: 120,
    });

    const initialCoins = result.stateAt(0).findAll(n => n.type === 'Coin').length;
    const finalCoins = result.finalState.findAll(n => n.type === 'Coin').length;
    expect(finalCoins).toBe(0);  // All coins collected
  });

  test('no entities fall through the floor', async () => {
    const result = await TestRunner.run({
      scene: Level1,
      seed: 42,
      duration: 30,
    });

    // Check every frame
    for (const snapshot of result.snapshots) {
      const bodies = snapshot.findAll(n => n.tags.includes('enemy') || n.type === 'Player');
      for (const body of bodies) {
        expect(body.position.y).toBeLessThan(500);  // Below death plane = bug
      }
    }
  });

  test('visual regression', async () => {
    const result = await TestRunner.run({
      scene: Level1,
      seed: 42,
      input: InputScript.create().press('right', { duration: 5 }),
      captureFrames: true,
      captureInterval: 1.0,
    });

    for (const frame of result.frames) {
      await expect(frame).toMatchBaseline(`baselines/level1-${frame.time}s.png`);
    }
  });
});
```

---

## Part 7: Advanced AI Features

### 1. Exploration Bots

Built-in AI that can play the game for testing purposes:

```typescript
import { ExplorationBot } from '@quintus/test';

// A bot that tries to explore every reachable area
const bot = new ExplorationBot({
  strategy: 'breadth-first',    // Tries all directions systematically
  maxRetries: 3,                // Retries paths that killed it
  memoryFrames: 600,            // Remembers 10 seconds of visited positions
});

const result = await TestRunner.run({
  scene: Level1,
  seed: 42,
  input: bot,    // Bot generates input dynamically based on game state
  duration: 120,
});

// What did the bot discover?
console.log(bot.report());
// → Explored 87% of level area
// → Found 15/15 coins
// → Died 3 times (2x spikes, 1x enemy)
// → Unreachable areas: [{ x: 500, y: 50, reason: 'no platform' }]
```

### 2. Property Sweeps

Automatically test ranges of parameter values:

```typescript
import { PropertySweep } from '@quintus/test';

const results = await PropertySweep.run({
  scene: Level1,
  seed: 42,
  target: 'Player',
  property: 'jumpForce',
  range: { from: -200, to: -600, steps: 20 },
  input: InputScript.create()
    .press('right', { duration: 1 })
    .press('jump')
    .wait(2),
  measure: (state) => ({
    maxHeight: state.track('Player', 'position.y', 'min'),    // Highest point
    airTime: state.track('Player', 'isOnFloor', 'falseTime'), // Time in air
    landed: state.final.find('Player')?.props.isOnFloor,
  }),
});

// Results as a table:
// jumpForce | maxHeight | airTime | landed
// -200      | 160       | 0.4s    | true
// -220      | 148       | 0.45s   | true
// ...
// -600      | 12        | 1.2s    | true

results.toCSV('jump-sweep.csv');
results.toChart('jump-sweep.html');  // Interactive chart
```

### 3. Fuzz Testing

Randomized testing to find crashes and edge cases:

```typescript
import { FuzzTester } from '@quintus/test';

const results = await FuzzTester.run({
  scene: Level1,
  runs: 1000,
  duration: 30,          // 30s per run
  seedRange: [0, 9999],  // Different seed each run
  input: 'random',       // Random button mashing
  assertions: [
    (state) => state.findAll(n => n.type === 'Player').length <= 1,  // Max 1 player
    (state) => state.performance.updateTimeMs < 16,                   // No frame drops
    (state) => !state.errors.length,                                  // No exceptions
  ],
});

console.log(results.summary);
// → 1000 runs completed
// → 3 failures:
// →   Seed 4271: Player clipped through wall at (340, 120) at t=12.3s
// →   Seed 7832: NaN in enemy velocity at t=8.1s
// →   Seed 9103: Scene had 0 players at t=15.2s (player destroyed twice)
//
// → Reproduce: npx quintus test --seed 4271 --duration 13
```

### 4. Scene Description Language

A declarative format that LLMs can generate and that maps directly to Quintus scenes:

```yaml
# level1.scene.yaml — AI-readable scene description
scene: level1
description: "A platformer level with three sections: grassland, cave, and castle"
seed: 42

settings:
  gravity: { x: 0, y: 800 }
  camera: { zoom: 2, smoothing: 0.1 }
  music: overworld.ogg

tilemap: level1.json

player:
  type: PlatformerPlayer
  spawn: start          # Named point from tilemap
  maxHealth: 5
  speed: 120
  jumpForce: -350
  doubleJump: true

entities:
  - type: PatrolEnemy
    spawn: enemy-1       # From tilemap objects
    speed: 40
    stompable: true

  - type: FlyingEnemy
    spawn: enemy-2
    amplitude: 30
    frequency: 2

  - type: Coin
    spawn: [coin-1, coin-2, coin-3, coin-4, coin-5]
    value: 10

  - type: MovingPlatform
    from: { x: 300, y: 150 }
    to: { x: 500, y: 150 }
    speed: 40

  - type: Door
    spawn: boss-door
    needsKey: boss-key

  - type: Key
    spawn: key-location
    keyId: boss-key

  - type: BossEnemy
    spawn: boss-arena
    health: 20
    patterns: [charge, jump-slam, projectile-spread]

ui:
  - type: HealthBar
    position: { x: 10, y: 10 }
  - type: ScoreDisplay
    position: { x: 160, y: 10 }
```

```typescript
// Loading a scene description
import { SceneLoader } from '@quintus/test';

const scene = SceneLoader.fromYAML('levels/level1.scene.yaml');
game.start(scene);

// Or the MCP server can load it directly
// quintus.loadSceneDescription(yamlString)
```

### 5. AI-Generated Test Suites

The MCP server can generate tests for existing game code:

```
AI calls: quintus.listNodeTypes()
AI calls: quintus.getSceneTree()  // For Level1

AI generates test suite based on scene structure:

"I can see Level1 has:
  - 1 Player (PlatformerPlayer)
  - 8 PatrolEnemies
  - 15 Coins
  - 3 MovingPlatforms
  - 1 BossEnemy
  - 2 Checkpoints

Here are the tests I'd recommend:

1. Player can reach Checkpoint 1 (basic traversal)
2. Player can reach Checkpoint 2 (requires moving platforms)
3. All 15 coins are collectible
4. PatrolEnemies don't fall through floors
5. PatrolEnemies reverse at platform edges
6. Player can stomp PatrolEnemies
7. Player takes damage from PatrolEnemy side collision
8. MovingPlatforms cycle correctly
9. Boss fight is winnable
10. Boss phases transition at correct health thresholds
11. No entities clip through geometry (fuzz test)
12. Performance stays above 60fps with all entities active
13. Visual regression for key moments"
```

### 6. LLM System Prompt for Quintus Development

Ship a ready-to-use system prompt that any AI coding tool can use:

```markdown
# Quintus 2.0 AI Development Guide

## You are helping build a game with Quintus 2.0, a TypeScript HTML5 game engine.

### Available MCP Tools
You have access to these tools for interacting with the running game:
- quintus.getSceneTree — inspect all entities
- quintus.screenshot — see the current frame
- quintus.step — advance time
- quintus.pressAction — simulate input
- quintus.hotReload — update code live
- ... (full tool list)

### Core Concepts
- Everything is a Node in a tree
- Body = things that move and collide
- Area = things that detect overlaps (triggers, pickups)
- Signals = typed events between nodes
- Tags = grouping for queries

### Development Pattern
1. Write/modify TypeScript files
2. Hot-reload into the running game
3. Inject inputs and step simulation
4. Capture screenshots to verify visuals
5. Check state tree to verify logic
6. Iterate until correct

### Common Patterns
[... examples of player, enemy, item, UI code ...]

### Testing
Always write tests for new game logic using @quintus/test.
Use deterministic seeds for reproducible results.
```

---

## Part 8: Package Summary

| Package | Size | Purpose |
|---------|------|---------|
| `@quintus/test` | ~8KB | TestRunner, InputScript, assertions, scenarios, exploration bots |
| `@quintus/snapshot` | ~4KB | StateSnapshot, filmstrip, GIF export, visual regression |
| `@quintus/mcp` | ~6KB | MCP server, tool definitions, bridge to browser/headless |
| `@quintus/headless` | ~5KB | Node.js runtime, node-canvas rendering, asset loading from filesystem |
| `@quintus/ai-prefabs` | ~15KB | 30+ pre-built game components with full docs and tests |

These are **in addition to** the core engine packages from the Godot-inspired architecture.

### The Full Stack

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Client                               │
│              (Claude Code / Cursor / Custom)                │
└────────────────────────┬────────────────────────────────────┘
                         │ MCP Protocol
┌────────────────────────▼────────────────────────────────────┐
│                   @quintus/mcp                              │
│          Tool handlers + state bridge                       │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│ @quintus/   │  │ @quintus/    │  │ @quintus/    │
│ headless    │  │ test         │  │ snapshot     │
│             │  │              │  │              │
│ Node.js     │  │ InputScript  │  │ State tree   │
│ runtime     │  │ Assertions   │  │ Filmstrip    │
│ No browser  │  │ Scenarios    │  │ Visual diff  │
│ 100x speed  │  │ Fuzz/Sweep   │  │ GIF export   │
└──────┬──────┘  └──────┬───────┘  └──────┬───────┘
       │                │                  │
       └────────────────┼──────────────────┘
                        │
         ┌──────────────▼──────────────┐
         │      Quintus 2.0 Core       │
         │                             │
         │  Node tree + Physics +      │
         │  Rendering + Input +        │
         │  Audio + Scenes             │
         │                             │
         │  @quintus/core              │
         │  @quintus/physics           │
         │  @quintus/sprites           │
         │  @quintus/input             │
         │  @quintus/audio             │
         │  @quintus/tilemap           │
         │  @quintus/ui                │
         │  @quintus/camera            │
         │  @quintus/tween             │
         │  @quintus/three (optional)  │
         └─────────────────────────────┘
```

This architecture means that **every game built with Quintus is automatically AI-testable, AI-debuggable, and AI-modifiable** — not because of special AI features, but because the engine's core design (deterministic simulation, serializable state, injectable input, typed everything) naturally supports it.

The AI doesn't need a special mode. The engine IS the AI's development environment.
