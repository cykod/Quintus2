# AI Debug Protocol: Interactive Game Testing for Claude Code

> **This document is the detailed design for Phase 8 of the Implementation Plan.**
> It depends on Phase 3 (Input) being complete — the debug bridge uses `game.input.inject()` for input injection rather than raw DOM events.

## The Problem

Debugging the platformer demo required opening a browser, eyeballing behavior, and reasoning backward from visual glitches to code issues. Claude Code had no way to see the running game, step through frames, inject inputs, or inspect state. This is exactly the kind of tight feedback loop the AI Integration Architecture envisions — but none of it exists yet.

## The Solution

A three-layer system that makes every Quintus game interactively debuggable from Claude Code:

1. **Engine debug API** — serialization, screenshots, event log, input injection (in `@quintus/core`)
2. **Browser debug bridge** — `window.__quintusDebug` + auto-pause on `?debug` query param
3. **Claude Code skill** — `/debug-game` launches Playwright, returns screenshots + scene tree + event log

The critical insight: **the engine should start paused by default when `?debug` is in the URL**. This means any example or game automatically becomes a step-through-able, inspectable test environment — no code changes needed in the game itself.

---

## Layer 1: Engine Debug API

### 1a. Node Serialization (`Node.serialize()`)

Add a `serialize()` method to `Node` that walks the tree and produces a plain JSON snapshot. This is the foundation for everything — scene tree inspection, state diffing, test assertions.

**File: `packages/core/src/node.ts`**

```typescript
export interface NodeSnapshot {
  id: number;
  type: string;          // constructor.name: "Player", "StaticCollider", etc.
  name: string;
  tags: string[];
  children: NodeSnapshot[];
}

class Node {
  serialize(): NodeSnapshot {
    return {
      id: this.id,
      type: this.constructor.name,
      name: this.name,
      tags: [...this.tags],
      children: this.children.map(c => c.serialize()),
    };
  }
}
```

**File: `packages/core/src/node2d.ts`** — override to add spatial data:

```typescript
export interface Node2DSnapshot extends NodeSnapshot {
  position: { x: number; y: number };
  rotation: number;
  scale: { x: number; y: number };
  globalPosition: { x: number; y: number };
  visible: boolean;
  zIndex: number;
}

class Node2D extends Node {
  override serialize(): Node2DSnapshot {
    return {
      ...super.serialize(),
      position: { x: this.position.x, y: this.position.y },
      rotation: this.rotation,
      scale: { x: this.scale.x, y: this.scale.y },
      globalPosition: { x: this.globalPosition.x, y: this.globalPosition.y },
      visible: this.visible,
      zIndex: this.zIndex,
    };
  }
}
```

**File: `packages/physics/src/actor.ts`** — override to add physics state:

```typescript
export interface ActorSnapshot extends Node2DSnapshot {
  velocity: { x: number; y: number };
  gravity: number;
  isOnFloor: boolean;
  isOnWall: boolean;
  isOnCeiling: boolean;
  collisionGroup: string;
  bodyType: "actor";
}
```

Similarly for `StaticCollider` (add `oneWay`, `constantVelocity`) and `Sensor` (add `monitoring`, overlap counts).

**Design rule:** `serialize()` is always overridable. Game-specific classes can add their own data:

```typescript
class Player extends Actor {
  health = 5;
  score = 0;

  override serialize() {
    return { ...super.serialize(), health: this.health, score: this.score };
  }
}
```

### 1b. Screenshot Capture (`Game.screenshot()`)

Trivial — the canvas already exists and renders each frame.

**File: `packages/core/src/Game.ts`**

```typescript
class Game {
  /** Capture the current canvas as a PNG data URL. */
  screenshot(): string {
    return this.canvas.toDataURL("image/png");
  }
}
```

For Playwright integration, we won't even need this — Playwright captures the page directly. But it's useful for headless mode (Phase 7) and for the browser console.

### 1c. Debug Mode on Game

Add a `debug` flag and auto-pause-on-start behavior, controlled by a query parameter.

**File: `packages/core/src/Game.ts`**

```typescript
export interface GameOptions {
  // ... existing options ...
  /** Start in debug mode (paused, bridge exposed). Default: auto-detect from ?debug URL param. */
  debug?: boolean;
}

class Game {
  readonly debug: boolean;

  constructor(options: GameOptions) {
    // Auto-detect debug mode from URL query parameter
    this.debug = options.debug ?? this._detectDebugMode();
    // ... rest of constructor ...
  }

  start(SceneClass: SceneConstructor): void {
    this._loadScene(SceneClass);

    if (this.debug) {
      // Load the scene and render one frame, but don't start the loop.
      // This gives a screenshot-able initial state without any simulation.
      this._render();
      this._installDebugBridge();
    } else {
      this.loop.start();
    }

    this.started.emit();
  }

  private _detectDebugMode(): boolean {
    try {
      return new URL(window.location.href).searchParams.has("debug");
    } catch {
      return false; // Not in browser (headless/test)
    }
  }

  private _installDebugBridge(): void {
    // See Layer 2 below
  }
}
```

**Behavior when `?debug` is present:**
1. Scene loads and `onReady()` fires for all nodes
2. One render pass happens (so the initial frame is visible)
3. The game loop does NOT start — the game is frozen at frame 0
4. `window.__quintusDebug` is installed (including the event log)
5. External tools (Playwright, devtools) can step/inspect/screenshot

**When `?debug` is absent:** Everything works exactly as before. Zero overhead.

### 1d. Input Injection via `@quintus/input`

Since this plan depends on Phase 3 being complete, the debug bridge injects input through the proper input system rather than raw DOM events:

```typescript
// In the debug bridge
press(action: string) {
  game.input.inject(action, true);   // Press action
}

release(action: string) {
  game.input.inject(action, false);  // Release action
}
```

The bridge works with **action names** (`"jump"`, `"left"`, `"right"`, `"attack"`) rather than raw key names. This is cleaner — the AI doesn't need to know the key bindings, just the logical actions. The debug bridge also exposes `listActions()` so the AI can discover what actions are available.

---

## Layer 2: Browser Debug Bridge (`window.__quintusDebug`)

When `game.debug` is true, install a global object that external tools can call.

**File: `packages/core/src/debug-bridge.ts`** (new file, ~150 lines)

```typescript
export interface DebugBridge {
  /** Is the game loop currently running? */
  readonly paused: boolean;

  /** Current frame number. */
  readonly frame: number;

  /** Elapsed game time in seconds. */
  readonly elapsed: number;

  /** Pause the game loop (no-op if already paused). */
  pause(): void;

  /** Resume the game loop. */
  resume(): void;

  /**
   * Advance N fixed timesteps (default 1). Game must be paused.
   * Returns the scene tree after stepping.
   */
  step(frames?: number): NodeSnapshot;

  /** Get the current scene tree as JSON. */
  tree(): NodeSnapshot;

  /** Get a flat list of all nodes matching a query (by type name, tag, or node name). */
  query(q: string): NodeSnapshot[];

  /** Get detailed info about a single node by name or id. */
  inspect(nameOrId: string | number): NodeSnapshot | null;

  /** Capture the canvas as a data URL. */
  screenshot(): string;

  /** List all registered input actions. */
  listActions(): string[];

  /** Inject an input action press. Held until release() is called. */
  press(action: string): void;

  /** Release a previously pressed input action. */
  release(action: string): void;

  /** Release all held actions. */
  releaseAll(): void;

  /**
   * Press an action, step N frames, release, return tree.
   * Convenience for "hold right for 30 frames".
   */
  pressAndStep(action: string, frames: number): NodeSnapshot;

  /**
   * Execute a sequence of input actions over time.
   * Returns array of tree snapshots, one per sequence entry.
   */
  run(script: DebugAction[]): NodeSnapshot[];

  // === Event Log ===

  /**
   * Get all events since last call (drains the buffer).
   * Pass a filter to narrow results.
   */
  events(filter?: EventFilter): DebugEvent[];

  /**
   * Get all events without draining. Useful for reviewing history.
   */
  peekEvents(filter?: EventFilter): DebugEvent[];

  /** Clear the event log. */
  clearEvents(): void;

  /** Log a custom event from game code or the console. */
  log(category: string, message: string, data?: Record<string, unknown>): void;
}

type DebugAction =
  | { press: string; frames: number }   // Hold action for N frames
  | { wait: number }                     // Advance N frames with no input
  | { release: string };                 // Release a held action
```

**Installation** happens inside `Game._installDebugBridge()`:

```typescript
private _installDebugBridge(): void {
  const game = this;
  const heldActions = new Set<string>();

  (window as any).__quintusDebug = {
    get paused() { return !game.running; },
    get frame() { return game.fixedFrame; },
    get elapsed() { return game.elapsed; },

    pause() { game.pause(); },
    resume() { game.resume(); },

    step(frames = 1) {
      for (let i = 0; i < frames; i++) game.step();
      return game.currentScene?.serialize() ?? null;
    },

    tree() {
      return game.currentScene?.serialize() ?? null;
    },

    screenshot() {
      return game.screenshot();
    },

    listActions() {
      return game.input.getActionNames();
    },

    press(action: string) {
      heldActions.add(action);
      game.input.inject(action, true);
    },

    release(action: string) {
      heldActions.delete(action);
      game.input.inject(action, false);
    },

    releaseAll() {
      for (const action of heldActions) {
        game.input.inject(action, false);
      }
      heldActions.clear();
    },

    pressAndStep(action: string, frames: number) {
      this.press(action);
      const result = this.step(frames);
      this.release(action);
      return result;
    },

    events(filter?: EventFilter) {
      return game.debugLog.drain(filter);
    },

    peekEvents(filter?: EventFilter) {
      return game.debugLog.peek(filter);
    },

    clearEvents() {
      game.debugLog.clear();
    },

    log(category: string, message: string, data?: Record<string, unknown>) {
      game.debugLog.write({ category, message, data });
    },

    // ... run() implementation
  };
}
```

### Why `window.__quintusDebug` and Not a Plugin?

The bridge must be available to external tools (Playwright `page.evaluate`, browser devtools, future extensions). A plugin would be internal only. The bridge is the public surface; it delegates to `game.step()`, `game.pause()`, `node.serialize()`, `game.debugLog` — all proper engine APIs.

---

## Layer 3: Claude Code Skill (`/debug-game`)

A skill that launches a game in Playwright and provides an interactive debugging loop.

### Invocation

```
/debug-game examples/platformer-demo.html
```

Or if the dev server is already running:

```
/debug-game http://localhost:3050/platformer-demo.html
```

### Skill Flow

```
1. Start vite dev server on :3050 (if not already running)
2. Launch Playwright (headless Chromium)
3. Navigate to http://localhost:3050/{page}?debug
   → Engine auto-pauses, bridge is installed
4. Render initial frame
5. Take Playwright screenshot → return to Claude as image
6. Evaluate: window.__quintusDebug.tree() → return scene tree JSON
7. Evaluate: window.__quintusDebug.listActions() → show available actions
8. Evaluate: window.__quintusDebug.events() → show onReady events from scene load
9. Enter interactive mode — Claude can now issue commands:

   step(N)           → __quintusDebug.step(N), screenshot, return both
   press(action, N)  → __quintusDebug.pressAndStep(action, N), screenshot
   tree()            → __quintusDebug.tree()
   inspect(query)    → __quintusDebug.inspect(query)
   screenshot()      → Playwright page.screenshot()
   events()          → __quintusDebug.events() (drains log since last call)
   events(filter)    → __quintusDebug.events({category: "collision"})
   log(cat, msg)     → __quintusDebug.log(cat, msg)
   run(script)       → __quintusDebug.run(script), return final screenshot + trees + events
   resume()          → __quintusDebug.resume() (start real-time play)
   pause()           → __quintusDebug.pause()
   eval(code)        → page.evaluate(code) (escape hatch)
```

### What Claude Sees

After `/debug-game examples/platformer-demo.html`:

```
[Screenshot: initial frame showing player, platforms, coins against dark background]

Scene tree (frame 0, t=0.000s):
  DemoScene
  ├── DrawableStatic "ground" (200, 280) 400×20 [world]
  ├── DrawableStatic "platform" (100, 220) 80×12 [world]
  ├── DrawableStatic "platform" (250, 180) 80×12 [world]
  ├── DrawableStatic "platform" (150, 120) 80×12 [world]
  ├── DrawableStatic "wall-L" (10, 200) 20×160 [world]
  ├── DrawableStatic "wall-R" (390, 200) 20×160 [world]
  ├── Coin (100, 200) [coins]
  ├── Coin (250, 160) [coins]
  ├── Coin (150, 100) [coins]
  └── Player (200, 100) vel=(0,0) onFloor=false [player]

Actions: left, right, jump, attack

Events during scene load:
  [f:0 t:0.000] lifecycle  DemoScene.onReady
  [f:0 t:0.000] lifecycle  DrawableStatic#3.onReady          "ground"
  [f:0 t:0.000] lifecycle  Player#12.onReady                 tags=[player]
  [f:0 t:0.000] lifecycle  Coin#15.onReady                   (100, 200)
  [f:0 t:0.000] lifecycle  Coin#16.onReady                   (250, 160)
  [f:0 t:0.000] lifecycle  Coin#17.onReady                   (150, 100)
  [f:0 t:0.000] physics    Player#12 registered              group=player
  [f:0 t:0.000] physics    Coin#15 registered                group=coins

Game paused at frame 0. Use step(N), press(action, N), tree(), events().
```

Claude steps forward and sees events accumulate:

```
> step(60)

[Screenshot: player has fallen onto the ground]

Player at (200, 268) vel=(0, 0) onFloor=true  [frame 60, t=1.000s]

Events (frames 1-60):
  [f:1  t:0.017] physics   Player#12 collision               normal=(0,-1) with=DrawableStatic#3 "ground"
  [f:1  t:0.017] physics   Player#12 floor_contact            entered
```

```
> press("right", 30)

[Screenshot: player has moved right]

Player at (275, 268) vel=(150, 0) onFloor=true  [frame 90, t=1.500s]

Events (frames 61-90):
  [f:61 t:1.017] input     right                             pressed
  [f:90 t:1.500] input     right                             released
```

```
> press("jump", 1); step(30)

[Screenshot: player is mid-jump]

Player at (275, 180) vel=(0, -180) onFloor=false  [frame 121, t=2.017s]

Events (frames 91-121):
  [f:91 t:1.517] input     jump                              pressed
  [f:91 t:1.517] physics   Player#12 floor_contact            exited
  [f:92 t:1.533] input     jump                              released
```

The event log lets Claude understand **why** things happened, not just **what** the current state is. "Player left the floor on frame 91 because jump was pressed" — that's causal reasoning an LLM can follow.

### Skill Implementation

The skill is a shell script that:
1. Checks if port 3050 is in use; if not, starts `pnpm dev` in background
2. Runs a Playwright script that opens the page with `?debug`
3. Enters a command loop, evaluating JS via `page.evaluate()`
4. Returns results (screenshots as temp files, tree as JSON text, events as formatted text)

Since the existing `playwright-cli` skill already handles browser automation, the `/debug-game` skill can build on that infrastructure or be a standalone Playwright script.

**File: `.claude/skills/debug-game.md`** — the skill prompt instructs Claude to:
- Use Playwright to navigate to the URL with `?debug` appended
- After each step/press command, take a screenshot AND get the tree AND drain events
- Format the tree compactly (single line per node, indent for hierarchy)
- Format events in the `[f:N t:Xs] category message` format
- Always show the Player node's position/velocity/onFloor prominently
- Support the commands listed above

---

## The Event Log (`DebugLog`)

### Why an Event Log?

Screenshots and scene tree snapshots show you **what** is happening right now. But debugging often requires understanding **what happened** — the sequence of events that led to the current state. An LLM debugging a "player falls through the floor" bug needs to see:

- When did the player's `isOnFloor` change?
- Were there any collisions that frame?
- Did `onReady` fire for the floor's CollisionShape?
- Was a signal emitted that destroyed the floor?

Without an event log, the AI has to binary-search with screenshots. With one, it can read causality directly.

### Design

The event log is a **ring buffer** of structured events that lives on `Game`. It captures engine events automatically when debug mode is active, and game code can write to it for custom events.

**File: `packages/core/src/debug-log.ts`** (new file, ~100 lines)

```typescript
export interface DebugEvent {
  /** Frame number when the event occurred. */
  frame: number;
  /** Game time in seconds. */
  time: number;
  /** Event category for filtering. */
  category: string;
  /** Human-readable message (also LLM-readable). */
  message: string;
  /** Optional structured data. */
  data?: Record<string, unknown>;
}

export interface EventFilter {
  /** Filter by category (exact match or comma-separated list). */
  category?: string;
  /** Filter by frame range. */
  fromFrame?: number;
  toFrame?: number;
  /** Filter by time range. */
  fromTime?: number;
  toTime?: number;
  /** Search message text (case-insensitive substring match). */
  search?: string;
  /** Max number of events to return. */
  limit?: number;
}

export class DebugLog {
  private buffer: DebugEvent[] = [];
  private drainIndex = 0;
  readonly maxSize: number;

  constructor(maxSize = 10_000) {
    this.maxSize = maxSize;
  }

  /** Write an event to the log. */
  write(event: Omit<DebugEvent, "frame" | "time">, frame: number, time: number): void {
    if (this.buffer.length >= this.maxSize) {
      // Ring buffer: drop oldest events
      this.buffer.shift();
      if (this.drainIndex > 0) this.drainIndex--;
    }
    this.buffer.push({ ...event, frame, time });
  }

  /**
   * Get events since last drain and advance the drain cursor.
   * This is the primary API for the CLI — "what happened since I last checked?"
   */
  drain(filter?: EventFilter): DebugEvent[] {
    const events = this.buffer.slice(this.drainIndex);
    this.drainIndex = this.buffer.length;
    return filter ? this._filter(events, filter) : events;
  }

  /** Get events without advancing the cursor. For reviewing full history. */
  peek(filter?: EventFilter): DebugEvent[] {
    return filter ? this._filter(this.buffer, filter) : [...this.buffer];
  }

  /** Clear all events and reset the drain cursor. */
  clear(): void {
    this.buffer = [];
    this.drainIndex = 0;
  }

  private _filter(events: DebugEvent[], filter: EventFilter): DebugEvent[] {
    let result = events;

    if (filter.category) {
      const cats = new Set(filter.category.split(",").map(c => c.trim()));
      result = result.filter(e => cats.has(e.category));
    }
    if (filter.fromFrame !== undefined) {
      result = result.filter(e => e.frame >= filter.fromFrame!);
    }
    if (filter.toFrame !== undefined) {
      result = result.filter(e => e.frame <= filter.toFrame!);
    }
    if (filter.fromTime !== undefined) {
      result = result.filter(e => e.time >= filter.fromTime!);
    }
    if (filter.toTime !== undefined) {
      result = result.filter(e => e.time <= filter.toTime!);
    }
    if (filter.search) {
      const s = filter.search.toLowerCase();
      result = result.filter(e => e.message.toLowerCase().includes(s));
    }
    if (filter.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }
}
```

### Event Categories

The engine automatically logs events in these categories when `game.debug` is true:

| Category | Events | Example Message |
|----------|--------|-----------------|
| `lifecycle` | `onReady`, `onDestroy`, `onEnterTree`, `onExitTree` | `Player#12.onReady tags=[player]` |
| `physics` | Body registered/unregistered, collision, floor/wall/ceiling contact changes | `Player#12 collision normal=(0,-1) with=StaticCollider#3` |
| `physics` | Sensor enter/exit | `Coin#15 bodyEntered Player#12` |
| `input` | Action pressed/released (in debug mode) | `jump pressed` |
| `signal` | Signal emissions (opt-in, see below) | `Player#12.died emitted` |
| `audio` | Sound play/stop/loop (when `@quintus/audio` is present) | `play "jump.ogg" volume=0.8` |
| `scene` | Scene switch, scene ready, scene destroyed | `scene switch DemoScene → Level2` |
| `error` | Lifecycle errors caught by the error handler | `Error in Goomba#8 onUpdate: TypeError...` |
| `game` | Custom events written by game code | `spawned enemy type=Goomba pos=(300,100)` |

### Auto-Instrumentation: How Events Get Logged

The engine hooks into existing lifecycle and signal infrastructure. No changes to game code needed — the debug log observes what's already happening:

**Lifecycle events** — instrumented in `Node._enterTreeRecursive()`, `Node._processDestroy()`, and Scene update traversal:

```typescript
// In Node._enterTreeRecursive(node):
if (this.game?.debug) {
  this.game.debugLog.write(
    { category: "lifecycle", message: `${node.constructor.name}#${node.id}.onReady` },
    this.game.fixedFrame,
    this.game.elapsed,
  );
}
```

**Physics events** — instrumented in Actor.move() collision handling and Sensor overlap detection:

```typescript
// In Actor.move(), after collision:
if (this.game?.debug) {
  this.game.debugLog.write({
    category: "physics",
    message: `${this.constructor.name}#${this.id} collision normal=(${n.x},${n.y}) with=${other.constructor.name}#${other.id}`,
    data: { normal: { x: n.x, y: n.y }, depth: info.depth },
  }, this.game.fixedFrame, this.game.elapsed);
}

// In Actor.move(), when floor contact changes:
if (this.game?.debug && wasOnFloor !== this.isOnFloor()) {
  this.game.debugLog.write({
    category: "physics",
    message: `${this.constructor.name}#${this.id} floor_contact ${this.isOnFloor() ? "entered" : "exited"}`,
  }, this.game.fixedFrame, this.game.elapsed);
}
```

**Sensor events** — instrumented in `Sensor.bodyEntered` / `bodyExited` signal handlers:

```typescript
// In PhysicsWorld.stepSensors():
if (game.debug) {
  game.debugLog.write({
    category: "physics",
    message: `${sensor.constructor.name}#${sensor.id} bodyEntered ${body.constructor.name}#${body.id}`,
  }, game.fixedFrame, game.elapsed);
}
```

**Input events** — instrumented in the debug bridge press/release methods (already shown above), and also in `InputManager` when actions fire during normal play in debug mode.

**Audio events** — instrumented in `@quintus/audio` when `game.debug` is true:

```typescript
// In AudioPlayer or game.audio.play():
if (this.game?.debug) {
  this.game.debugLog.write({
    category: "audio",
    message: `play "${name}" volume=${volume}`,
    data: { name, volume, loop },
  }, this.game.fixedFrame, this.game.elapsed);
}
```

### Opt-In Signal Watching

By default, signal emissions are NOT logged (too noisy). Game code or the debug bridge can opt into watching specific signals:

```typescript
// From game code:
if (this.game?.debug) {
  this.game.debugLog.watchSignal(this.died, "Player.died");
  this.game.debugLog.watchSignal(this.hurt, "Player.hurt");
}

// From the debug bridge / CLI:
window.__quintusDebug.watchSignal("Player", "died");
window.__quintusDebug.watchSignal("Player", "hurt");
```

This connects a listener that logs emissions:

```
[f:240 t:4.000] signal    Player#12.hurt emitted             data={amount: 1}
[f:500 t:8.333] signal    Player#12.died emitted
```

### Game Code Custom Events

Game code can write its own events to the log for debugging. These show up alongside engine events and are filterable by the `game` category:

```typescript
class EnemySpawner extends Node {
  onFixedUpdate(dt: number) {
    if (shouldSpawn) {
      const enemy = this.scene.add(Goomba);
      enemy.position = spawnPoint;

      // Log it so the debug CLI can see spawning patterns
      this.game?.debugLog?.write({
        category: "game",
        message: `spawned ${enemy.constructor.name}#${enemy.id} at (${spawnPoint.x}, ${spawnPoint.y})`,
        data: { type: "Goomba", position: { x: spawnPoint.x, y: spawnPoint.y } },
      }, this.game.fixedFrame, this.game.elapsed);
    }
  }
}
```

Convenience method on `Game`:

```typescript
class Game {
  /** Log a custom debug event. No-op when debug mode is off. */
  log(message: string, data?: Record<string, unknown>): void {
    if (!this.debug) return;
    this.debugLog.write(
      { category: "game", message, data },
      this.fixedFrame,
      this.elapsed,
    );
  }
}
```

Usage: `this.game?.log("player collected coin", { coinId: coin.id, score: this.score });`

### CLI Output Format

Events are formatted as a single scannable line each. The format is designed to be readable by both humans and LLMs:

```
[f:FRAME t:TIMEs] CATEGORY  MESSAGE                          DATA
```

Examples:
```
[f:0   t:0.000] lifecycle  DemoScene.onReady
[f:0   t:0.000] lifecycle  Player#12.onReady                 tags=[player]
[f:0   t:0.000] physics    Player#12 registered              group=player
[f:1   t:0.017] physics    Player#12 collision               normal=(0,-1) with=DrawableStatic#3
[f:1   t:0.017] physics    Player#12 floor_contact            entered
[f:61  t:1.017] input      right                             pressed
[f:90  t:1.500] input      right                             released
[f:91  t:1.517] input      jump                              pressed
[f:91  t:1.517] physics    Player#12 floor_contact            exited
[f:120 t:2.000] physics    Coin#15 bodyEntered Player#12
[f:120 t:2.000] lifecycle  Coin#15.onDestroy
[f:120 t:2.000] game       player collected coin              coinId=15 score=1
[f:120 t:2.000] audio      play "coin.ogg"                   volume=1
```

Key design choices for scannability:
- **Fixed-width frame/time prefix** — easy to visually scan chronologically
- **Category as a word** — filterable with `events({category: "physics"})`
- **Node identity** — always `ClassName#id` so you can track specific entities
- **Data inline** — key=value pairs after the message, no nested JSON in the display format
- **One line per event** — no multi-line messages, keeps the log scannable

### DebugLog Lifecycle

- `DebugLog` is always instantiated on `Game`, but only receives events when `game.debug` is true
- The auto-instrumentation hooks are guarded by `if (this.game?.debug)` checks — zero overhead in production
- Ring buffer holds 10,000 events by default (~1MB). At 60fps with moderate event frequency, this covers several minutes of gameplay
- `drain()` returns events since the last drain, making the skill's polling loop simple: "step, drain, display"

---

## Auto-Pause Design Details

### Query Parameter: `?debug`

When any Quintus game loads with `?debug` in the URL:

1. `Game` constructor detects it via `URLSearchParams`
2. `Game.start()` loads the scene, renders one frame, but does NOT start the loop
3. Debug bridge is installed on `window.__quintusDebug`
4. A small visual indicator appears (e.g., "PAUSED [frame N]" overlay) so it's obvious in a browser

**Additional query params:**
- `?debug` — pause at frame 0
- `?debug&seed=42` — pause + override the RNG seed (overrides `GameOptions.seed`)
- `?debug&step=60` — auto-step 60 frames then pause (useful for "jump to frame 60")

The seed override is important for reproducibility. If Claude finds a bug at frame 300 with seed 42, anyone can reproduce it: `?debug&seed=42&step=300`.

### No-Debug Path: Zero Impact

When `?debug` is absent:
- `game.debug === false`
- `window.__quintusDebug` is not installed
- `game.debugLog` exists but receives no events (all `if (game.debug)` guards short-circuit)
- `Node.serialize()` still exists (it's just a method) but is never called
- No performance impact — serialize/screenshot/event logging aren't in the hot path
- The game runs exactly as before

---

## Implementation Steps

> **Prerequisite:** Phase 3 (Sprites & Input) must be complete. The debug bridge depends on `game.input.inject()` and `game.input.getActionNames()`.

### Step 1: Node.serialize() + snapshot types (~100 lines)
- Add `NodeSnapshot` interface and `serialize()` to `Node`
- Override in `Node2D` with position/rotation/scale/visible
- Override in `Actor` with velocity/gravity/isOnFloor/isOnWall/isOnCeiling
- Override in `StaticCollider` with oneWay/constantVelocity
- Override in `Sensor` with monitoring/overlap counts
- Tests: verify serialize() output for a scene with mixed node types

### Step 2: DebugLog (~100 lines)
- New file: `packages/core/src/debug-log.ts`
- `DebugLog` class with ring buffer, `write()`, `drain()`, `peek()`, `clear()`, `watchSignal()`
- `EventFilter` interface and filter implementation
- Add `debugLog: DebugLog` property to `Game`
- Tests: write/drain/peek/filter, ring buffer overflow, drain cursor behavior

### Step 3: Game.screenshot() + Game.debug flag (~40 lines)
- Add `debug` option to `GameOptions`
- Add `_detectDebugMode()` query param detection
- Add `screenshot()` method
- Modify `start()` to render-once-then-pause when `debug=true`
- Tests: verify debug mode pauses, non-debug mode runs normally

### Step 4: Debug bridge (~150 lines)
- New file: `packages/core/src/debug-bridge.ts`
- `installDebugBridge(game)` function
- Implements: pause/resume/step/tree/screenshot/listActions/press/release/pressAndStep/run
- Implements: events/peekEvents/clearEvents/log/watchSignal
- Called from `Game.start()` when `debug=true`
- Tests: verify step advances frames, press injects actions, tree returns snapshot, events drain correctly

### Step 5: Auto-instrumentation hooks (~80 lines)
- Add `if (game.debug)` event logging to:
  - `Node._enterTreeRecursive()` — lifecycle events
  - `Node._processDestroy()` — lifecycle events
  - `Actor.move()` — collision events, floor/wall/ceiling contact changes
  - `PhysicsWorld.stepSensors()` — sensor enter/exit events
  - `Scene._switchScene()` — scene transition events
  - `Game._handleLifecycleError()` — error events
- Tests: verify events appear in log after stepping through a scene with collisions

### Step 6: Visual indicator for debug mode (~20 lines)
- When debug mode is active, render a "PAUSED [frame N]" overlay on the canvas
- Updates on each step so you can see progress
- Disappears on resume()

### Step 7: Seed + step query params (~30 lines)
- Parse `?seed=N` to override `GameOptions.seed`
- Parse `?step=N` to auto-advance N frames after scene load
- Tests: verify seed override produces deterministic results

### Step 8: Pretty-print tree format (~40 lines)
- A compact text formatter for `NodeSnapshot` trees
- Used by the skill to display readable scene state
- e.g., `├── Player (200, 268) vel=(0,0) onFloor=true [player]`

### Step 9: Pretty-print event format (~30 lines)
- Format `DebugEvent[]` as the scannable `[f:N t:Xs] category message` lines
- Used by the skill to display event log
- Handles column alignment for readability

### Step 10: Claude Code skill definition
- Write `.claude/skills/debug-game.md`
- Skill uses Playwright to launch game with `?debug`
- Defines the interactive command vocabulary
- After each command: take screenshot + drain events + format tree
- Formats output for Claude's visual + text understanding

---

## What This Enables

### Immediate (once built)
- Claude can debug any Quintus game interactively via `/debug-game`
- Bug reports become reproducible: "frame 120, seed 42, player at (300, -50)"
- Game behavior can be verified step-by-step without eyeballing
- Event log provides causal reasoning: "player died because collision at frame 91, then floor_contact exited, then fell below death plane"

### Builds Toward (future phases)
- **`@quintus/test` (Phase 7):** `InputScript` is a programmatic version of `run()`. `NodeSnapshot` IS the snapshot format — already defined. Event log assertions enable testing event sequences.
- **`@quintus/snapshot` (Phase 7):** State serialization reuses `serialize()`. Filmstrip capture reuses `screenshot()`.
- **`@quintus/headless` (Phase 7):** Same `game.step()` + `serialize()` + `debugLog` API, but with node-canvas instead of Playwright.

The debug bridge and event log are foundational APIs that the headless runtime and test framework build directly on top of.

---

## File Summary

| File | Lines | What |
|------|-------|------|
| `packages/core/src/node.ts` | +20 | `serialize()`, `NodeSnapshot` |
| `packages/core/src/node2d.ts` | +20 | `serialize()` override, `Node2DSnapshot` |
| `packages/physics/src/actor.ts` | +40 | `serialize()` override + collision/contact event logging |
| `packages/physics/src/static-collider.ts` | +15 | `serialize()` override |
| `packages/physics/src/sensor.ts` | +15 | `serialize()` override |
| `packages/core/src/debug-log.ts` | ~100 | `DebugLog`, `DebugEvent`, `EventFilter`, ring buffer |
| `packages/core/src/debug-bridge.ts` | ~150 | `installDebugBridge()`, bridge API, event log exposure |
| `packages/core/src/Game.ts` | +40 | `debug`, `debugLog`, `screenshot()`, `log()`, auto-pause |
| `packages/core/src/snapshot-types.ts` | ~30 | Shared snapshot interfaces |
| `packages/core/src/debug-format.ts` | ~70 | Pretty-print tree + event formatters |
| `.claude/skills/debug-game.md` | ~80 | Skill definition |
| Auto-instrumentation hooks (across files) | ~80 | `if (game.debug)` logging calls |
| Tests | ~200 | serialize, debug log, debug mode, bridge, formatting |
| **Total** | **~860** | |

This is a focused addition (~860 lines including tests) that solves the immediate debugging problem, provides causal event tracing for LLM reasoning, and lays the foundation for the testing and headless infrastructure in Phase 7.
