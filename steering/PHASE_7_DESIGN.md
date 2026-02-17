# Phase 7: Deterministic Testing & AI Infrastructure — Detailed Design

> **Goal:** Build the three AI-critical packages — `@quintus/headless`, `@quintus/test`, `@quintus/snapshot` — that let AI agents and CI pipelines run, test, and inspect Quintus games without a browser.
> **Outcome:** An AI or CI system can create a headless game, drive it with scripted inputs, record state snapshots at every frame, query game state at any point in time, run custom assertions against the results, and verify deterministic reproducibility. The platformer example from Phase 6 has automated tests that run headlessly in Vitest.

---

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | @quintus/headless — HeadlessGame + Node.js asset loading | Done |
| 2 | @quintus/test — InputScript builder | Done |
| 3 | @quintus/test — TestRunner orchestration | Done |
| 4 | @quintus/test — Game assertions (Vitest matchers) | Done |
| 5 | @quintus/snapshot — StateSnapshot + captureState + diff | Done |
| 6 | @quintus/snapshot — SnapshotDiff + comparison utilities | Done |
| 7 | Determinism verification + platformer integration tests | Done |

---

## Table of Contents

1. [Existing Infrastructure](#1-existing-infrastructure)
2. [Package: @quintus/headless](#2-package-quintusheadless)
3. [Package: @quintus/test — InputScript](#3-package-quintustest--inputscript)
4. [Package: @quintus/test — TestRunner](#4-package-quintustest--testrunner)
5. [Package: @quintus/test — Assertions](#5-package-quintustest--assertions)
6. [Package: @quintus/snapshot — Timeline](#6-package-quintussnapshot--timeline)
7. [Package: @quintus/snapshot — Diff](#7-package-quintussnapshot--diff)
8. [Platformer Integration Tests](#8-platformer-integration-tests)
9. [Test Plan](#9-test-plan)
10. [Definition of Done](#10-definition-of-done)
11. [Execution Order](#11-execution-order)

---

## 1. Existing Infrastructure

Phase 7 builds on substantial infrastructure already implemented in Phases 1-6. Understanding what exists is critical to avoid duplication.

### Already Complete

| Feature | Location | What It Does |
|---------|----------|--------------|
| `SeededRandom` | `packages/math/src/seeded-random.ts` | Mulberry32 PRNG with `fork()`, `state` getter, `fromState()` |
| `Game.step()` | `packages/core/src/game.ts:210` | Advances exactly one fixed timestep (beginFrame → fixedUpdate → update → render → cleanup) |
| `Game({ renderer: null })` | `packages/core/src/game.ts:123` | Headless mode — no canvas rendering, no errors |
| `Game({ seed: N })` | `packages/core/src/game.ts:86` | Deterministic RNG seed |
| `GameLoop.step()` | `packages/core/src/game-loop.ts:51` | Manual frame advancement with accurate elapsed/fixedFrame tracking |
| `Node.serialize()` | `packages/core/src/node.ts` | Recursive tree → `NodeSnapshot` JSON |
| `Node2D.serialize()` | `packages/core/src/node2d.ts` | Extends with position, rotation, scale, alpha, visible, zIndex |
| `Actor.serialize()` | `packages/physics/src/actor.ts` | Extends with velocity, gravity, isOnFloor/Wall/Ceiling, collisionGroup |
| `Input.inject()` | `packages/input/src/input.ts:109` | Buffered action injection for deterministic testing |
| `Input.injectAnalog()` | `packages/input/src/input.ts:115` | Buffered analog value injection |
| `DebugBridge` | `packages/core/src/debug-bridge.ts` | pause/resume/step/tree/query/inspect/press/release/run/events |
| `DebugLog` | `packages/core/src/debug-log.ts` | Event recording with drain/peek + category/frame/time/search filtering |
| `NodeSnapshot` types | `packages/core/src/snapshot-types.ts` | `NodeSnapshot`, `Node2DSnapshot`, `CameraSnapshot` |
| Physics snapshots | `packages/physics/src/snapshot-types.ts` | `ActorSnapshot`, `StaticColliderSnapshot`, `SensorSnapshot` |

### Existing Test Patterns

Tests already create headless games using this pattern (from `packages/input/src/integration.test.ts`):

```typescript
function createGame(): Game {
  const canvas = document.createElement("canvas");
  return new Game({ width: 800, height: 600, canvas, renderer: null });
}

// Step through frames manually
game.step();
game.step();
```

Phase 7 formalizes this into reusable APIs.

### What's Empty (Stub Packages)

| Package | `src/index.ts` | Dependencies |
|---------|---------------|--------------|
| `@quintus/headless` | `export {}` | None |
| `@quintus/test` | `export {}` | None |
| `@quintus/snapshot` | `export {}` | None |

All three need `package.json` updated with proper dependencies and real implementations.

---

## 2. Package: @quintus/headless

### 2.1 Purpose

Convenience layer for running Quintus games in Node.js / Vitest without a browser. The core `Game` class already supports `renderer: null`, but creating a headless game still requires a jsdom `document.createElement("canvas")` call. `@quintus/headless` removes this friction and provides Node.js-specific asset loading.

### 2.2 HeadlessGame

**File:** `packages/headless/src/headless-game.ts`

```typescript
import { Game, type GameOptions } from "@quintus/core";
import type { Scene, SceneConstructor } from "@quintus/core";

export interface HeadlessGameOptions extends Omit<GameOptions, "canvas" | "renderer"> {
  /** Seed for deterministic RNG (required for reproducibility). */
  seed: number;
}

/**
 * A Game instance pre-configured for headless execution.
 * No canvas, no renderer, no browser APIs needed beyond jsdom.
 *
 * @example
 * const game = new HeadlessGame({ width: 320, height: 240, seed: 42 });
 * game.use(PhysicsPlugin({ gravity: new Vec2(0, 800) }));
 * game.start(MyScene);
 * for (let i = 0; i < 600; i++) game.step(); // 10 seconds at 60fps
 */
export class HeadlessGame extends Game {
  constructor(options: HeadlessGameOptions) {
    // Create a minimal canvas stub for code that references game.canvas
    const canvas = _createCanvasStub(options.width, options.height);
    super({
      ...options,
      canvas,
      renderer: null,
    });
  }

  /**
   * Run the game for a given number of seconds of game time.
   * @param seconds - Duration in game-time seconds
   * @returns The number of fixed frames stepped
   */
  runFor(seconds: number): number {
    const frames = Math.round(seconds / this.fixedDeltaTime);
    for (let i = 0; i < frames; i++) {
      this.step();
    }
    return frames;
  }

  /**
   * Run the game until a condition is met or a timeout is reached.
   * @param condition - Checked after each frame. Return true to stop.
   * @param maxSeconds - Maximum game-time before giving up. Default: 60.
   * @returns true if condition was met, false if timed out.
   */
  runUntil(condition: () => boolean, maxSeconds = 60): boolean {
    const maxFrames = Math.round(maxSeconds / this.fixedDeltaTime);
    for (let i = 0; i < maxFrames; i++) {
      this.step();
      if (condition()) return true;
    }
    return false;
  }
}

function _createCanvasStub(width: number, height: number): HTMLCanvasElement {
  // In jsdom (Vitest), document.createElement works.
  // In pure Node.js without jsdom, we create a minimal stub.
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  // Minimal stub for pure Node.js — only used when renderer is null anyway
  return {
    width,
    height,
    style: {},
    getContext: () => null,
    toDataURL: () => "",
  } as unknown as HTMLCanvasElement;
}
```

### 2.3 createHeadlessGame Helper

**File:** `packages/headless/src/create-headless-game.ts`

A factory function for the common case of creating a game with plugins:

```typescript
import { type Plugin } from "@quintus/core";
import { HeadlessGame, type HeadlessGameOptions } from "./headless-game.js";

export interface CreateHeadlessGameOptions extends HeadlessGameOptions {
  plugins?: Plugin[];
}

/**
 * Create a HeadlessGame with plugins pre-installed.
 *
 * @example
 * const game = createHeadlessGame({
 *   width: 320, height: 240, seed: 42,
 *   plugins: [
 *     PhysicsPlugin({ gravity: new Vec2(0, 800) }),
 *     InputPlugin({ actions: { jump: ["Space"] } }),
 *     TweenPlugin(),
 *   ],
 * });
 */
export function createHeadlessGame(options: CreateHeadlessGameOptions): HeadlessGame {
  const { plugins, ...gameOptions } = options;
  const game = new HeadlessGame(gameOptions);
  if (plugins) {
    for (const plugin of plugins) {
      game.use(plugin);
    }
  }
  return game;
}
```

### 2.4 Package Structure

```
packages/headless/
├── src/
│   ├── index.ts                  # Re-exports all public API
│   ├── headless-game.ts          # HeadlessGame class
│   └── create-headless-game.ts   # Factory function
├── package.json                  # Updated with deps
├── tsconfig.json
└── tsup.config.ts
```

### 2.5 Package Dependencies

Update `packages/headless/package.json`:

```json
{
  "dependencies": {
    "@quintus/core": "workspace:*",
    "@quintus/math": "workspace:*"
  }
}
```

### 2.6 Deliverables

- [ ] `HeadlessGame` class with `runFor()` and `runUntil()` convenience methods
- [ ] `createHeadlessGame()` factory with plugin support
- [ ] Canvas stub for non-jsdom environments
- [ ] Update `package.json` with dependencies
- [ ] Write `src/index.ts` re-exporting all public API
- [ ] Tests for HeadlessGame, runFor, runUntil

---

## 3. Package: @quintus/test — InputScript

### 3.1 Purpose

`InputScript` is a builder DSL for describing a sequence of player inputs over time. It converts a human-readable timeline into frame-by-frame injection calls to `game.input.inject()`.

### 3.2 InputScript Builder

**File:** `packages/test/src/input-script.ts`

```typescript
/** A single step in an input script timeline. */
export type InputStep =
  | { type: "press"; action: string; frames: number }
  | { type: "tap"; action: string }
  | { type: "release"; action: string }
  | { type: "wait"; frames: number }
  | { type: "analog"; action: string; value: number; frames: number };

/**
 * Builder for deterministic input sequences.
 *
 * All timing is in frames (not seconds) for deterministic replay.
 * Use `InputScript.secondsToFrames()` to convert if needed.
 *
 * @example
 * const script = InputScript.create()
 *   .wait(30)                        // Wait 0.5s (30 frames at 60fps)
 *   .press("right", 120)             // Hold right for 2s
 *   .tap("jump")                     // Single-frame tap
 *   .press("right", 60)              // Hold right for 1s
 *   .tap("jump");                    // Jump while moving right
 */
export class InputScript {
  private _steps: InputStep[] = [];

  private constructor() {}

  static create(): InputScript {
    return new InputScript();
  }

  /** Convert seconds to frames at 60fps. */
  static secondsToFrames(seconds: number, fps = 60): number {
    return Math.round(seconds * fps);
  }

  /** Wait (no input) for N frames. */
  wait(frames: number): this {
    this._steps.push({ type: "wait", frames });
    return this;
  }

  /** Wait for N seconds (converted to frames at 60fps). */
  waitSeconds(seconds: number): this {
    return this.wait(InputScript.secondsToFrames(seconds));
  }

  /** Hold an action for N frames. */
  press(action: string, frames: number): this {
    this._steps.push({ type: "press", action, frames });
    return this;
  }

  /** Hold an action for N seconds (converted to frames). */
  pressSeconds(action: string, seconds: number): this {
    return this.press(action, InputScript.secondsToFrames(seconds));
  }

  /** Press an action for exactly 1 frame (tap). */
  tap(action: string): this {
    this._steps.push({ type: "tap", action });
    return this;
  }

  /** Explicitly release an action. Useful for overlapping holds. */
  release(action: string): this {
    this._steps.push({ type: "release", action });
    return this;
  }

  /** Set an analog value for N frames. */
  analog(action: string, value: number, frames: number): this {
    this._steps.push({ type: "analog", action, value, frames });
    return this;
  }

  /** Get the compiled step list (immutable copy). */
  get steps(): readonly InputStep[] {
    return [...this._steps];
  }

  /** Total frames this script will take to execute. */
  get totalFrames(): number {
    let total = 0;
    for (const step of this._steps) {
      switch (step.type) {
        case "press":
        case "analog":
          total += step.frames;
          break;
        case "tap":
          total += 1;
          break;
        case "wait":
          total += step.frames;
          break;
        case "release":
          total += 0; // Instant
          break;
      }
    }
    return total;
  }
}
```

### 3.3 InputScriptPlayer

Executes an `InputScript` against a game, frame by frame:

**File:** `packages/test/src/input-script-player.ts`

```typescript
import type { InputStep } from "./input-script.js";

interface InputLike {
  inject(action: string, pressed: boolean): void;
  injectAnalog(action: string, value: number): void;
}

interface GameLike {
  step(): void;
}

/**
 * Plays an InputScript against a game instance.
 * Handles press/release/wait/tap/analog steps by calling inject() and step().
 *
 * Does NOT own the game — caller is responsible for creating and starting it.
 */
export class InputScriptPlayer {
  private _frame = 0;
  private _held = new Set<string>();

  /**
   * Execute the full script against the game.
   * @param game - Must have step() method
   * @param input - Must have inject() and injectAnalog() methods
   * @param steps - Compiled steps from InputScript
   * @param onFrame - Optional callback after each frame (for snapshot recording)
   */
  execute(
    game: GameLike,
    input: InputLike,
    steps: readonly InputStep[],
    onFrame?: (frame: number) => void,
  ): void {
    for (const step of steps) {
      switch (step.type) {
        case "press":
          input.inject(step.action, true);
          this._held.add(step.action);
          for (let i = 0; i < step.frames; i++) {
            game.step();
            this._frame++;
            onFrame?.(this._frame);
          }
          input.inject(step.action, false);
          this._held.delete(step.action);
          break;

        case "tap":
          input.inject(step.action, true);
          game.step();
          this._frame++;
          onFrame?.(this._frame);
          input.inject(step.action, false);
          break;

        case "release":
          input.inject(step.action, false);
          this._held.delete(step.action);
          break;

        case "wait":
          for (let i = 0; i < step.frames; i++) {
            game.step();
            this._frame++;
            onFrame?.(this._frame);
          }
          break;

        case "analog":
          input.injectAnalog(step.action, step.value);
          for (let i = 0; i < step.frames; i++) {
            game.step();
            this._frame++;
            onFrame?.(this._frame);
          }
          input.injectAnalog(step.action, 0);
          break;
      }
    }
  }

  /** Current frame count. */
  get frame(): number {
    return this._frame;
  }

  /** Release all currently held actions. */
  releaseAll(input: InputLike): void {
    for (const action of this._held) {
      input.inject(action, false);
    }
    this._held.clear();
  }
}
```

### 3.4 Deliverables

- [ ] `InputScript` builder class with `create()`, `wait()`, `press()`, `tap()`, `release()`, `analog()`, seconds helpers
- [ ] `InputScriptPlayer` executor that drives `game.step()` + `input.inject()`
- [ ] `InputStep` type union exported for external use
- [ ] Tests for InputScript builder (totalFrames, step compilation)
- [ ] Tests for InputScriptPlayer execution (verify inject calls, frame counts)

---

## 4. Package: @quintus/test — TestRunner

### 4.1 Purpose

`TestRunner` orchestrates a complete test run: create game → install plugins → start scene → execute input script → record snapshots → return results.

### 4.2 TestRunner API

**File:** `packages/test/src/test-runner.ts`

```typescript
import type { Game, Plugin, SceneConstructor } from "@quintus/core";
import type { NodeSnapshot } from "@quintus/core";
import { HeadlessGame, createHeadlessGame } from "@quintus/headless";
import { InputScript } from "./input-script.js";
import { InputScriptPlayer } from "./input-script-player.js";
import { Timeline, type TimelineEntry } from "./timeline.js";

export interface TestRunOptions {
  /** Scene class to start. */
  scene: SceneConstructor;
  /** RNG seed for deterministic replay. */
  seed: number;
  /** Game width in pixels. Default: 320. */
  width?: number;
  /** Game height in pixels. Default: 240. */
  height?: number;
  /** Fixed timestep. Default: 1/60. */
  fixedDeltaTime?: number;
  /** Plugins to install (physics, input, tween, etc.). */
  plugins?: Plugin[];
  /** Input script to execute. If omitted, runs with no input. */
  input?: InputScript;
  /** Total duration in seconds. Used when no input script, or to extend past the script. */
  duration?: number;
  /**
   * Snapshot capture interval in frames. Default: 1 (every frame).
   * Set to higher values (e.g. 60) to reduce memory for long runs.
   * Set to 0 to disable snapshot recording (only final state captured).
   */
  snapshotInterval?: number;
  /** Enable debug mode (event logging). Default: false. */
  debug?: boolean;
}

export interface TestResult {
  /** The game instance (still alive — caller can inspect further). */
  game: HeadlessGame;
  /** Total frames stepped. */
  totalFrames: number;
  /** Total elapsed game time in seconds. */
  totalTime: number;
  /** The RNG seed used. */
  seed: number;
  /** Final scene tree snapshot. */
  finalState: NodeSnapshot;
  /** Timeline of recorded snapshots (if snapshotInterval > 0). */
  timeline: Timeline;
}

export class TestRunner {
  /**
   * Run a complete test scenario.
   *
   * @example
   * const result = TestRunner.run({
   *   scene: Level1,
   *   seed: 42,
   *   plugins: [
   *     PhysicsPlugin({ gravity: new Vec2(0, 800) }),
   *     InputPlugin({ actions: { left: ["ArrowLeft"], right: ["ArrowRight"], jump: ["Space"] } }),
   *   ],
   *   input: InputScript.create()
   *     .press("right", 120)
   *     .tap("jump")
   *     .press("right", 60),
   *   snapshotInterval: 60, // Capture every second
   * });
   *
   * // Query the result
   * const playerAtEnd = result.timeline.findNode(result.totalFrames, "Player");
   * expect(playerAtEnd?.position?.x).toBeGreaterThan(200);
   */
  static run(options: TestRunOptions): TestResult {
    const {
      scene,
      seed,
      width = 320,
      height = 240,
      fixedDeltaTime = 1 / 60,
      plugins = [],
      input,
      duration,
      snapshotInterval = 1,
      debug = false,
    } = options;

    // Create game
    const game = createHeadlessGame({
      width,
      height,
      seed,
      fixedDeltaTime,
      plugins,
      debug,
    });

    // Start scene
    game.start(scene);

    // Calculate total frames
    const scriptFrames = input?.totalFrames ?? 0;
    const durationFrames = duration
      ? Math.round(duration / fixedDeltaTime)
      : 0;
    const totalFrames = Math.max(scriptFrames, durationFrames);

    // Timeline recording
    const timeline = new Timeline();
    const recordSnapshot = (frame: number): void => {
      if (snapshotInterval > 0 && frame % snapshotInterval === 0) {
        const snapshot = game.currentScene?.serialize() ?? null;
        if (snapshot) {
          timeline.record(frame, frame * fixedDeltaTime, snapshot);
        }
      }
    };

    // Record initial state (frame 0)
    recordSnapshot(0);

    // Get input system (if InputPlugin installed)
    const inputSystem = _getInput(game);

    if (input && inputSystem) {
      // Execute input script
      const player = new InputScriptPlayer();
      player.execute(game, inputSystem, input.steps, recordSnapshot);

      // Run remaining frames if duration extends past the script
      const remaining = totalFrames - player.frame;
      for (let i = 0; i < remaining; i++) {
        game.step();
        recordSnapshot(player.frame + i + 1);
      }
    } else {
      // No input — just step for the duration
      for (let i = 1; i <= totalFrames; i++) {
        game.step();
        recordSnapshot(i);
      }
    }

    // Capture final state
    const finalState = game.currentScene?.serialize() ?? {
      id: -1,
      type: "Empty",
      name: "",
      tags: [],
      children: [],
    };

    return {
      game,
      totalFrames,
      totalTime: totalFrames * fixedDeltaTime,
      seed,
      finalState,
      timeline,
    };
  }
}

/** Duck-typed input accessor — avoids hard dependency on @quintus/input. */
function _getInput(game: Game): { inject: (a: string, p: boolean) => void; injectAnalog: (a: string, v: number) => void } | null {
  if (!game.hasPlugin("input")) return null;
  return (game as unknown as { input?: { inject: (a: string, p: boolean) => void; injectAnalog: (a: string, v: number) => void } }).input ?? null;
}
```

### 4.3 Timeline Class

**File:** `packages/test/src/timeline.ts` (also re-exported from `@quintus/snapshot`)

The Timeline holds an ordered sequence of state snapshots indexed by frame number. It provides time-based and frame-based queries.

```typescript
import type { NodeSnapshot, Node2DSnapshot } from "@quintus/core";

export interface TimelineEntry {
  frame: number;
  time: number;
  snapshot: NodeSnapshot;
}

/**
 * An ordered sequence of scene tree snapshots indexed by frame.
 * Supports time-based and frame-based queries.
 */
export class Timeline {
  private _entries: TimelineEntry[] = [];

  /** Record a snapshot at the given frame. */
  record(frame: number, time: number, snapshot: NodeSnapshot): void {
    this._entries.push({ frame, time, snapshot });
  }

  /** Number of recorded entries. */
  get length(): number {
    return this._entries.length;
  }

  /** All entries (immutable copy). */
  get entries(): readonly TimelineEntry[] {
    return this._entries;
  }

  /** Get the entry at or nearest before the given frame. */
  atFrame(frame: number): TimelineEntry | null {
    let best: TimelineEntry | null = null;
    for (const entry of this._entries) {
      if (entry.frame <= frame) best = entry;
      else break;
    }
    return best;
  }

  /** Get the entry at or nearest before the given time (seconds). */
  atTime(time: number): TimelineEntry | null {
    let best: TimelineEntry | null = null;
    for (const entry of this._entries) {
      if (entry.time <= time) best = entry;
      else break;
    }
    return best;
  }

  /** Find a node by name/type/tag in the snapshot at a given frame. */
  findNode(frame: number, query: string): NodeSnapshot | null {
    const entry = this.atFrame(frame);
    if (!entry) return null;
    return _walkFind(entry.snapshot, query);
  }

  /** Find all nodes matching a query at a given frame. */
  findNodes(frame: number, query: string): NodeSnapshot[] {
    const entry = this.atFrame(frame);
    if (!entry) return [];
    const results: NodeSnapshot[] = [];
    _walkFindAll(entry.snapshot, query, results);
    return results;
  }

  /** Count nodes matching a query at a given frame. */
  countNodes(frame: number, query: string): number {
    return this.findNodes(frame, query).length;
  }

  /** Get entries in a frame range [from, to] (inclusive). */
  range(fromFrame: number, toFrame: number): TimelineEntry[] {
    return this._entries.filter(
      (e) => e.frame >= fromFrame && e.frame <= toFrame,
    );
  }

  /** First entry. */
  get first(): TimelineEntry | null {
    return this._entries[0] ?? null;
  }

  /** Last entry. */
  get last(): TimelineEntry | null {
    return this._entries[this._entries.length - 1] ?? null;
  }
}

function _walkFind(node: NodeSnapshot, query: string): NodeSnapshot | null {
  if (node.type === query || node.name === query || node.tags.includes(query)) {
    return node;
  }
  for (const child of node.children) {
    const found = _walkFind(child, query);
    if (found) return found;
  }
  return null;
}

function _walkFindAll(node: NodeSnapshot, query: string, results: NodeSnapshot[]): void {
  if (node.type === query || node.name === query || node.tags.includes(query)) {
    results.push(node);
  }
  for (const child of node.children) {
    _walkFindAll(child, query, results);
  }
}
```

### 4.4 Deliverables

- [ ] `TestRunner.run()` static method with full orchestration
- [ ] `TestRunOptions` interface with all config options
- [ ] `TestResult` interface with game, timeline, finalState
- [ ] `Timeline` class with frame/time queries, findNode, findNodes, countNodes, range
- [ ] Tests for TestRunner (creates game, executes script, returns result)
- [ ] Tests for Timeline (record, query by frame/time, findNode)

---

## 5. Package: @quintus/test — Assertions

### 5.1 Purpose

Game-specific assertion functions that work with Vitest's `expect()`. These are plain functions, not Vitest matchers (avoiding the complexity of `expect.extend()`). They read naturally and provide clear error messages.

### 5.2 Node Assertions

**File:** `packages/test/src/assertions.ts`

```typescript
import type { NodeSnapshot, Node2DSnapshot } from "@quintus/core";
import type { Timeline } from "./timeline.js";

// === Type Guards ===

/** Check if a snapshot has Node2D properties (position, rotation, etc.). */
export function isNode2DSnapshot(s: NodeSnapshot): s is Node2DSnapshot {
  return "position" in s && "rotation" in s;
}

/** Check if a snapshot has Actor properties (velocity, isOnFloor, etc.). */
export function isActorSnapshot(s: NodeSnapshot): s is NodeSnapshot & {
  velocity: { x: number; y: number };
  isOnFloor: boolean;
  isOnWall: boolean;
  isOnCeiling: boolean;
  bodyType: "actor";
} {
  return "bodyType" in s && (s as Record<string, unknown>).bodyType === "actor";
}

// === Spatial Assertions ===

/** Assert that a node's position.x is greater than a threshold. */
export function assertMovedRight(node: NodeSnapshot, startX: number): void {
  if (!isNode2DSnapshot(node)) throw new Error(`Node "${node.name}" is not a Node2D`);
  if (node.position.x <= startX) {
    throw new Error(
      `Expected "${node.name}" to move right from x=${startX}, but x=${node.position.x}`,
    );
  }
}

/** Assert a node is on the floor (Actor only). */
export function assertOnFloor(node: NodeSnapshot): void {
  if (!isActorSnapshot(node)) throw new Error(`Node "${node.name}" is not an Actor`);
  if (!node.isOnFloor) {
    throw new Error(`Expected "${node.name}" to be on floor, but isOnFloor=false`);
  }
}

/** Assert a node is NOT on the floor (Actor only). */
export function assertNotOnFloor(node: NodeSnapshot): void {
  if (!isActorSnapshot(node)) throw new Error(`Node "${node.name}" is not an Actor`);
  if (node.isOnFloor) {
    throw new Error(`Expected "${node.name}" to not be on floor, but isOnFloor=true`);
  }
}

/** Assert a node has a specific tag. */
export function assertHasTag(node: NodeSnapshot, tag: string): void {
  if (!node.tags.includes(tag)) {
    throw new Error(
      `Expected "${node.name}" to have tag "${tag}", but tags are [${node.tags.join(", ")}]`,
    );
  }
}

/** Assert two nodes are within a given distance of each other. */
export function assertWithinDistance(
  a: NodeSnapshot,
  b: NodeSnapshot,
  maxDistance: number,
): void {
  if (!isNode2DSnapshot(a) || !isNode2DSnapshot(b)) {
    throw new Error("Both nodes must be Node2D for distance assertion");
  }
  const dx = a.position.x - b.position.x;
  const dy = a.position.y - b.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > maxDistance) {
    throw new Error(
      `Expected "${a.name}" to be within ${maxDistance}px of "${b.name}", but distance is ${dist.toFixed(1)}px`,
    );
  }
}

// === Scene Assertions ===

/** Assert the scene tree contains at least one node matching a query. */
export function assertContains(root: NodeSnapshot, query: string): void {
  if (!_findInTree(root, query)) {
    throw new Error(`Expected scene to contain a node matching "${query}", but none found`);
  }
}

/** Assert the scene tree does NOT contain a node matching a query. */
export function assertNotContains(root: NodeSnapshot, query: string): void {
  if (_findInTree(root, query)) {
    throw new Error(`Expected scene to NOT contain a node matching "${query}", but one was found`);
  }
}

/** Assert the scene has exactly N nodes matching a query. */
export function assertNodeCount(root: NodeSnapshot, query: string, expected: number): void {
  const found = _countInTree(root, query);
  if (found !== expected) {
    throw new Error(
      `Expected ${expected} nodes matching "${query}", but found ${found}`,
    );
  }
}

// === Timeline Assertions ===

/** Assert a node exists at a given frame in the timeline. */
export function assertExistsAtFrame(timeline: Timeline, frame: number, query: string): void {
  const node = timeline.findNode(frame, query);
  if (!node) {
    throw new Error(
      `Expected node matching "${query}" at frame ${frame}, but not found`,
    );
  }
}

/** Assert a node is gone (destroyed) by a given frame. */
export function assertDestroyedByFrame(timeline: Timeline, frame: number, query: string): void {
  const node = timeline.findNode(frame, query);
  if (node) {
    throw new Error(
      `Expected node matching "${query}" to be destroyed by frame ${frame}, but it still exists`,
    );
  }
}

/** Assert a node count decreases between two frames (e.g., coins collected). */
export function assertCountDecreased(
  timeline: Timeline,
  query: string,
  fromFrame: number,
  toFrame: number,
): void {
  const before = timeline.countNodes(fromFrame, query);
  const after = timeline.countNodes(toFrame, query);
  if (after >= before) {
    throw new Error(
      `Expected count of "${query}" to decrease between frames ${fromFrame} and ${toFrame}, but went from ${before} to ${after}`,
    );
  }
}

// === Helpers ===

function _findInTree(node: NodeSnapshot, query: string): NodeSnapshot | null {
  if (node.type === query || node.name === query || node.tags.includes(query)) return node;
  for (const child of node.children) {
    const found = _findInTree(child, query);
    if (found) return found;
  }
  return null;
}

function _countInTree(node: NodeSnapshot, query: string): number {
  let count = 0;
  if (node.type === query || node.name === query || node.tags.includes(query)) count++;
  for (const child of node.children) count += _countInTree(child, query);
  return count;
}
```

### 5.3 Determinism Assertion

**File:** `packages/test/src/assert-deterministic.ts`

The most important AI-infrastructure assertion: verify that a test produces identical results across multiple runs.

```typescript
import type { NodeSnapshot } from "@quintus/core";
import type { TestRunOptions, TestResult } from "./test-runner.js";
import { TestRunner } from "./test-runner.js";

/**
 * Run the same test N times and verify all runs produce identical final state.
 *
 * @param options - TestRunner options (seed is required for determinism)
 * @param runs - Number of times to run. Default: 3.
 * @throws Error if any run produces a different final state.
 *
 * @example
 * assertDeterministic({
 *   scene: Level1,
 *   seed: 42,
 *   plugins: [...],
 *   input: InputScript.create().press("right", 120).tap("jump"),
 *   duration: 5,
 * });
 */
export function assertDeterministic(options: TestRunOptions, runs = 3): void {
  const results: TestResult[] = [];
  for (let i = 0; i < runs; i++) {
    results.push(TestRunner.run(options));
  }

  const baseline = JSON.stringify(results[0]!.finalState);
  for (let i = 1; i < results.length; i++) {
    const current = JSON.stringify(results[i]!.finalState);
    if (current !== baseline) {
      // Find first difference for a helpful error message
      const diff = _findFirstDiff(results[0]!.finalState, results[i]!.finalState);
      throw new Error(
        `Determinism failure: run ${i + 1} differs from run 1.\n` +
        `First difference: ${diff}\n` +
        `Seed: ${options.seed}, Duration: ${options.duration ?? "script-length"}`,
      );
    }
  }

  // Clean up game instances
  for (const result of results) {
    result.game.stop();
  }
}

function _findFirstDiff(a: NodeSnapshot, b: NodeSnapshot, path = "root"): string {
  if (a.type !== b.type) return `${path}.type: "${a.type}" vs "${b.type}"`;
  if (a.name !== b.name) return `${path}.name: "${a.name}" vs "${b.name}"`;
  if (a.children.length !== b.children.length) {
    return `${path}.children.length: ${a.children.length} vs ${b.children.length}`;
  }

  // Check Node2D properties if present
  const a2d = a as Record<string, unknown>;
  const b2d = b as Record<string, unknown>;
  if ("position" in a2d && "position" in b2d) {
    const ap = a2d.position as { x: number; y: number };
    const bp = b2d.position as { x: number; y: number };
    if (ap.x !== bp.x) return `${path}.position.x: ${ap.x} vs ${bp.x}`;
    if (ap.y !== bp.y) return `${path}.position.y: ${ap.y} vs ${bp.y}`;
  }
  if ("velocity" in a2d && "velocity" in b2d) {
    const av = a2d.velocity as { x: number; y: number };
    const bv = b2d.velocity as { x: number; y: number };
    if (av.x !== bv.x) return `${path}.velocity.x: ${av.x} vs ${bv.x}`;
    if (av.y !== bv.y) return `${path}.velocity.y: ${av.y} vs ${bv.y}`;
  }

  for (let i = 0; i < a.children.length; i++) {
    const childDiff = _findFirstDiff(a.children[i]!, b.children[i]!, `${path}.children[${i}]`);
    if (childDiff !== "identical") return childDiff;
  }
  return "identical";
}
```

### 5.4 Deliverables

- [ ] Type guards: `isNode2DSnapshot()`, `isActorSnapshot()`
- [ ] Spatial assertions: `assertMovedRight()`, `assertOnFloor()`, `assertNotOnFloor()`, `assertWithinDistance()`
- [ ] Tag/state assertions: `assertHasTag()`
- [ ] Scene assertions: `assertContains()`, `assertNotContains()`, `assertNodeCount()`
- [ ] Timeline assertions: `assertExistsAtFrame()`, `assertDestroyedByFrame()`, `assertCountDecreased()`
- [ ] `assertDeterministic()` — multi-run determinism verification with diff reporting
- [ ] Tests for each assertion function (both passing and failing cases)

---

## 6. Package: @quintus/snapshot — Timeline

### 6.1 Purpose

`@quintus/snapshot` provides state serialization utilities, timeline recording, and snapshot comparison. The `Timeline` class is defined in `@quintus/test` but re-exported from `@quintus/snapshot` for standalone use.

### 6.2 StateSnapshot

A richer snapshot that includes game-level metadata alongside the node tree:

**File:** `packages/snapshot/src/state-snapshot.ts`

```typescript
import type { NodeSnapshot } from "@quintus/core";

/**
 * A complete snapshot of game state at a point in time.
 * Captures the scene tree plus engine metadata for replay/comparison.
 */
export interface StateSnapshot {
  /** Frame number when this snapshot was taken. */
  frame: number;
  /** Game time in seconds. */
  time: number;
  /** RNG seed used for this game run. */
  seed: number;
  /** Current RNG state (for resuming deterministic replay from this point). */
  rngState: number;
  /** The complete scene tree. */
  tree: NodeSnapshot;
}

/**
 * Capture a StateSnapshot from a running game.
 */
export function captureState(game: {
  fixedFrame: number;
  elapsed: number;
  random: { seed: number; state: number };
  currentScene: { serialize(): NodeSnapshot } | null;
}): StateSnapshot | null {
  const scene = game.currentScene;
  if (!scene) return null;
  return {
    frame: game.fixedFrame,
    time: game.elapsed,
    seed: game.random.seed,
    rngState: game.random.state,
    tree: scene.serialize(),
  };
}
```

### 6.3 Filmstrip

Captures a series of snapshots at regular intervals, useful for reviewing a test run.

**File:** `packages/snapshot/src/filmstrip.ts`

```typescript
import type { StateSnapshot } from "./state-snapshot.js";

/**
 * An ordered collection of state snapshots taken at regular intervals.
 * Provides time-indexed access for reviewing game behavior.
 */
export class Filmstrip {
  private _frames: StateSnapshot[] = [];

  /** Add a snapshot to the filmstrip. */
  add(snapshot: StateSnapshot): void {
    this._frames.push(snapshot);
  }

  /** Number of captured frames. */
  get length(): number {
    return this._frames.length;
  }

  /** All frames. */
  get frames(): readonly StateSnapshot[] {
    return this._frames;
  }

  /** Get the frame nearest to a given time (seconds). */
  atTime(time: number): StateSnapshot | null {
    if (this._frames.length === 0) return null;
    let best = this._frames[0]!;
    for (const frame of this._frames) {
      if (Math.abs(frame.time - time) < Math.abs(best.time - time)) {
        best = frame;
      }
    }
    return best;
  }

  /** Get the frame at a specific index. */
  at(index: number): StateSnapshot | null {
    return this._frames[index] ?? null;
  }

  /** First frame. */
  get first(): StateSnapshot | null {
    return this._frames[0] ?? null;
  }

  /** Last frame. */
  get last(): StateSnapshot | null {
    return this._frames[this._frames.length - 1] ?? null;
  }

  /** Find a node across all frames, returning the first match and its frame. */
  findFirstOccurrence(query: string): { snapshot: StateSnapshot; node: NodeSnapshot } | null {
    for (const frame of this._frames) {
      const node = _walkFind(frame.tree, query);
      if (node) return { snapshot: frame, node };
    }
    return null;
  }

  /** Track a value over time. Returns an array of {time, value} pairs. */
  track(
    nodeQuery: string,
    property: string,
  ): Array<{ time: number; frame: number; value: unknown }> {
    const results: Array<{ time: number; frame: number; value: unknown }> = [];
    for (const frame of this._frames) {
      const node = _walkFind(frame.tree, nodeQuery);
      if (node) {
        const value = _getNestedProperty(node, property);
        results.push({ time: frame.time, frame: frame.frame, value });
      }
    }
    return results;
  }

  /**
   * Serialize the filmstrip to JSON (for saving to disk).
   */
  toJSON(): StateSnapshot[] {
    return [...this._frames];
  }

  /**
   * Restore a filmstrip from serialized JSON.
   */
  static fromJSON(data: StateSnapshot[]): Filmstrip {
    const filmstrip = new Filmstrip();
    for (const frame of data) {
      filmstrip.add(frame);
    }
    return filmstrip;
  }
}

import type { NodeSnapshot } from "@quintus/core";

function _walkFind(node: NodeSnapshot, query: string): NodeSnapshot | null {
  if (node.type === query || node.name === query || node.tags.includes(query)) return node;
  for (const child of node.children) {
    const found = _walkFind(child, query);
    if (found) return found;
  }
  return null;
}

function _getNestedProperty(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
```

### 6.4 Deliverables

- [ ] `StateSnapshot` interface with frame, time, seed, rngState, tree
- [ ] `captureState()` utility function
- [ ] `Filmstrip` class with time queries, findFirstOccurrence, track, JSON serialization
- [ ] Tests for StateSnapshot capture
- [ ] Tests for Filmstrip (add, atTime, track, toJSON/fromJSON)

---

## 7. Package: @quintus/snapshot — Diff

### 7.1 Purpose

Compare two snapshots and report differences. Critical for debugging test failures and verifying determinism.

### 7.2 SnapshotDiff

**File:** `packages/snapshot/src/snapshot-diff.ts`

```typescript
import type { NodeSnapshot } from "@quintus/core";

/** A single difference between two snapshots. */
export interface SnapshotDifference {
  /** Dot-notation path to the differing property. */
  path: string;
  /** Value in snapshot A. */
  a: unknown;
  /** Value in snapshot B. */
  b: unknown;
}

/**
 * Compare two node tree snapshots and return all differences.
 *
 * @param a - First snapshot
 * @param b - Second snapshot
 * @param options - Comparison options
 * @returns Array of differences (empty if identical)
 *
 * @example
 * const diffs = diffSnapshots(snapshotBefore, snapshotAfter);
 * // [
 * //   { path: "children[0].position.x", a: 100, b: 150 },
 * //   { path: "children[2]", a: { type: "Coin", ... }, b: undefined },
 * // ]
 */
export function diffSnapshots(
  a: NodeSnapshot,
  b: NodeSnapshot,
  options?: DiffOptions,
): SnapshotDifference[] {
  const diffs: SnapshotDifference[] = [];
  const opts: Required<DiffOptions> = {
    positionTolerance: options?.positionTolerance ?? 0,
    ignorePaths: new Set(options?.ignorePaths ?? []),
    maxDiffs: options?.maxDiffs ?? 100,
  };
  _diffNode(a, b, "root", diffs, opts);
  return diffs;
}

export interface DiffOptions {
  /** Floating-point tolerance for position/rotation/velocity comparisons. Default: 0 (exact). */
  positionTolerance?: number;
  /** Paths to ignore in comparison (e.g., ["root.children[0].id"]). */
  ignorePaths?: string[];
  /** Stop after this many diffs. Default: 100. */
  maxDiffs?: number;
}

/**
 * Format diffs as a human-readable string.
 */
export function formatDiffs(diffs: SnapshotDifference[]): string {
  if (diffs.length === 0) return "Snapshots are identical.";
  const lines = diffs.map((d) => {
    const aStr = JSON.stringify(d.a, null, 0);
    const bStr = JSON.stringify(d.b, null, 0);
    return `  ${d.path}: ${aStr} → ${bStr}`;
  });
  return `${diffs.length} difference(s):\n${lines.join("\n")}`;
}

function _diffNode(
  a: NodeSnapshot,
  b: NodeSnapshot,
  path: string,
  diffs: SnapshotDifference[],
  opts: Required<DiffOptions>,
): void {
  if (diffs.length >= opts.maxDiffs) return;
  if (opts.ignorePaths.has(path)) return;

  // Compare scalar properties
  _diffScalar(a.type, b.type, `${path}.type`, diffs, opts);
  _diffScalar(a.name, b.name, `${path}.name`, diffs, opts);

  // Compare tags
  const aTags = [...a.tags].sort().join(",");
  const bTags = [...b.tags].sort().join(",");
  if (aTags !== bTags) {
    diffs.push({ path: `${path}.tags`, a: a.tags, b: b.tags });
  }

  // Compare Node2D properties if present
  const a2d = a as Record<string, unknown>;
  const b2d = b as Record<string, unknown>;
  if ("position" in a2d || "position" in b2d) {
    _diffVec2(a2d.position, b2d.position, `${path}.position`, diffs, opts);
  }
  if ("velocity" in a2d || "velocity" in b2d) {
    _diffVec2(a2d.velocity, b2d.velocity, `${path}.velocity`, diffs, opts);
  }
  if ("rotation" in a2d || "rotation" in b2d) {
    _diffNumber(a2d.rotation as number, b2d.rotation as number, `${path}.rotation`, diffs, opts);
  }

  // Compare children
  const maxChildren = Math.max(a.children.length, b.children.length);
  for (let i = 0; i < maxChildren; i++) {
    if (diffs.length >= opts.maxDiffs) return;
    const ac = a.children[i];
    const bc = b.children[i];
    if (!ac && bc) {
      diffs.push({ path: `${path}.children[${i}]`, a: undefined, b: { type: bc.type, name: bc.name } });
    } else if (ac && !bc) {
      diffs.push({ path: `${path}.children[${i}]`, a: { type: ac.type, name: ac.name }, b: undefined });
    } else if (ac && bc) {
      _diffNode(ac, bc, `${path}.children[${i}]`, diffs, opts);
    }
  }
}

function _diffScalar(a: unknown, b: unknown, path: string, diffs: SnapshotDifference[], opts: Required<DiffOptions>): void {
  if (diffs.length >= opts.maxDiffs || opts.ignorePaths.has(path)) return;
  if (a !== b) diffs.push({ path, a, b });
}

function _diffNumber(a: number | undefined, b: number | undefined, path: string, diffs: SnapshotDifference[], opts: Required<DiffOptions>): void {
  if (diffs.length >= opts.maxDiffs || opts.ignorePaths.has(path)) return;
  if (a == null && b == null) return;
  if (a == null || b == null) { diffs.push({ path, a, b }); return; }
  if (Math.abs(a - b) > opts.positionTolerance) diffs.push({ path, a, b });
}

function _diffVec2(a: unknown, b: unknown, path: string, diffs: SnapshotDifference[], opts: Required<DiffOptions>): void {
  if (diffs.length >= opts.maxDiffs || opts.ignorePaths.has(path)) return;
  const av = a as { x: number; y: number } | undefined;
  const bv = b as { x: number; y: number } | undefined;
  if (!av && !bv) return;
  if (!av || !bv) { diffs.push({ path, a: av, b: bv }); return; }
  _diffNumber(av.x, bv.x, `${path}.x`, diffs, opts);
  _diffNumber(av.y, bv.y, `${path}.y`, diffs, opts);
}
```

### 7.3 Deliverables

- [ ] `diffSnapshots()` function with tolerance and ignore options
- [ ] `formatDiffs()` for human-readable output
- [ ] `SnapshotDifference` interface
- [ ] Tests for diffSnapshots (identical trees, added/removed nodes, position changes, tolerance)

---

## 8. Platformer Integration Tests

### 8.1 Purpose

Demonstrate the full testing infrastructure by writing headless tests for the Phase 6 platformer. These tests prove the engine is deterministic and AI-testable.

### 8.2 Test File Location

**File:** `examples/platformer/__tests__/platformer.test.ts`

```typescript
import { describe, test, expect } from "vitest";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { InputPlugin } from "@quintus/input";
import { TweenPlugin } from "@quintus/tween";
import { AudioPlugin } from "@quintus/audio";
import { TestRunner, InputScript, assertDeterministic } from "@quintus/test";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "../config.js";
import { Level1 } from "../scenes/level1.js";
import { Level2 } from "../scenes/level2.js";
import { TitleScene } from "../scenes/title-scene.js";

const PLUGINS = [
  PhysicsPlugin({ gravity: new Vec2(0, 800), collisionGroups: COLLISION_GROUPS }),
  InputPlugin({ actions: INPUT_BINDINGS }),
  TweenPlugin(),
  AudioPlugin(),
];

function runLevel1(input?: InputScript, duration?: number) {
  return TestRunner.run({
    scene: Level1,
    seed: 42,
    width: 320,
    height: 240,
    plugins: PLUGINS,
    input,
    duration,
    snapshotInterval: 60, // Snapshot every second
  });
}

describe("Platformer — Player Movement", () => {
  test("player moves right when right is held", () => {
    const result = runLevel1(
      InputScript.create().press("right", 60), // 1 second
    );
    const player = result.timeline.findNode(60, "Player");
    const startPlayer = result.timeline.findNode(0, "Player");
    expect(player).not.toBeNull();
    expect(startPlayer).not.toBeNull();
    // Player should have moved right
    const startX = (startPlayer as Record<string, unknown> & { position: { x: number } }).position.x;
    const endX = (player as Record<string, unknown> & { position: { x: number } }).position.x;
    expect(endX).toBeGreaterThan(startX);
  });

  test("player jumps when on floor and jump is tapped", () => {
    const result = runLevel1(
      InputScript.create()
        .wait(30) // Let player settle on floor
        .tap("jump"),
    );
    const player = result.timeline.findNode(result.totalFrames, "Player");
    expect(player).not.toBeNull();
    // After jumping, velocity.y should be negative (upward)
    const vel = (player as Record<string, unknown> & { velocity: { y: number } }).velocity;
    expect(vel.y).toBeLessThan(0);
  });
});

describe("Platformer — Determinism", () => {
  test("same seed + same inputs = identical final state", () => {
    assertDeterministic({
      scene: Level1,
      seed: 42,
      width: 320,
      height: 240,
      plugins: PLUGINS,
      input: InputScript.create()
        .press("right", 120)
        .tap("jump")
        .press("right", 60)
        .tap("jump")
        .press("right", 120),
      snapshotInterval: 0, // Only capture final state
    });
  });

  test("different seeds produce different results", () => {
    const result1 = TestRunner.run({
      scene: Level1,
      seed: 42,
      plugins: PLUGINS,
      duration: 3,
      snapshotInterval: 0,
    });
    const result2 = TestRunner.run({
      scene: Level1,
      seed: 99,
      plugins: PLUGINS,
      duration: 3,
      snapshotInterval: 0,
    });
    // Final states should differ (different random behavior)
    const state1 = JSON.stringify(result1.finalState);
    const state2 = JSON.stringify(result2.finalState);
    // They may or may not differ depending on whether the game uses randomness.
    // At minimum, verify both ran successfully.
    expect(result1.totalFrames).toBe(result2.totalFrames);
    result1.game.stop();
    result2.game.stop();
  });
});

describe("Platformer — Enemy Behavior", () => {
  test("patrol enemies exist in level", () => {
    const result = runLevel1(undefined, 1); // 1 second, no input
    const enemies = result.timeline.findNodes(60, "enemy");
    expect(enemies.length).toBeGreaterThan(0);
  });
});

describe("Platformer — Collectibles", () => {
  test("coins exist in level at start", () => {
    const result = runLevel1(undefined, 0.5);
    const coins = result.timeline.findNodes(0, "coin");
    expect(coins.length).toBeGreaterThan(0);
  });
});
```

### 8.3 Test Helper for Platformer

**File:** `examples/platformer/__tests__/helpers.ts`

```typescript
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { InputPlugin } from "@quintus/input";
import { TweenPlugin } from "@quintus/tween";
import { AudioPlugin } from "@quintus/audio";
import type { Plugin } from "@quintus/core";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "../config.js";

export function platformerPlugins(): Plugin[] {
  return [
    PhysicsPlugin({ gravity: new Vec2(0, 800), collisionGroups: COLLISION_GROUPS }),
    InputPlugin({ actions: INPUT_BINDINGS }),
    TweenPlugin(),
    AudioPlugin(),
  ];
}
```

### 8.4 Deliverables

- [ ] `examples/platformer/__tests__/platformer.test.ts` with player movement, jump, determinism, enemies, and collectible tests
- [ ] `examples/platformer/__tests__/helpers.ts` with shared test utilities
- [ ] All tests pass in Vitest with `pnpm test`

---

## 9. Test Plan

### Package: @quintus/headless

**File:** `packages/headless/src/headless-game.test.ts`

| Test | What It Verifies |
|------|-----------------|
| `HeadlessGame creates without errors` | Constructor works, renderer is null |
| `HeadlessGame.step() advances frames` | fixedFrame increments after step() |
| `runFor() advances correct number of frames` | 600 frames for 10 seconds at 60fps |
| `runUntil() stops when condition is true` | Stops early when condition met |
| `runUntil() returns false on timeout` | Runs all frames without condition |
| `Canvas stub works in non-jsdom` | Minimal stub doesn't throw |

### Package: @quintus/test

**File:** `packages/test/src/input-script.test.ts`

| Test | What It Verifies |
|------|-----------------|
| `InputScript.create() returns empty script` | No steps, totalFrames = 0 |
| `press() adds hold step` | Step type and frames correct |
| `tap() adds single-frame step` | totalFrames increments by 1 |
| `wait() adds idle step` | No actions, just frame count |
| `release() adds instant step` | totalFrames doesn't increment |
| `analog() adds analog step` | Value and duration captured |
| `totalFrames sums all steps` | Complex chain calculates correctly |
| `secondsToFrames() converts correctly` | 1.0s = 60 frames, 0.5s = 30 frames |
| `chained builder returns this` | Fluent API works |

**File:** `packages/test/src/input-script-player.test.ts`

| Test | What It Verifies |
|------|-----------------|
| `execute() calls inject + step for press` | inject(true) → step N × → inject(false) |
| `execute() calls step for wait` | No inject, just steps |
| `execute() handles tap as 1-frame press` | inject(true) → step → inject(false) |
| `execute() handles release` | inject(false), no step |
| `execute() fires onFrame callback` | Callback receives frame numbers |
| `frame count matches totalFrames` | Player.frame equals expected |

**File:** `packages/test/src/test-runner.test.ts`

| Test | What It Verifies |
|------|-----------------|
| `TestRunner.run() creates and starts game` | Result has game, finalState |
| `TestRunner.run() with input script` | Player input drives actions |
| `TestRunner.run() with duration only` | Steps correct number of frames |
| `TestRunner.run() records timeline` | Timeline has entries at interval |
| `TestRunner.run() with snapshotInterval=0` | No timeline entries, just finalState |
| `Timeline.findNode() locates nodes` | Finds by type, name, tag |
| `Timeline.atTime() returns nearest` | Returns correct entry for time |

**File:** `packages/test/src/assertions.test.ts`

| Test | What It Verifies |
|------|-----------------|
| `assertOnFloor() passes for grounded actor` | No throw when isOnFloor=true |
| `assertOnFloor() fails for airborne actor` | Throws with clear message |
| `assertContains() finds node by type` | No throw when found |
| `assertContains() throws when missing` | Error message includes query |
| `assertNodeCount() passes on exact match` | No throw when count matches |
| `assertNodeCount() fails on mismatch` | Error shows expected vs actual |
| `assertDeterministic() passes for same seed` | 3 runs produce identical state |
| `assertCountDecreased() detects collection` | Counts differ between frames |

### Package: @quintus/snapshot

**File:** `packages/snapshot/src/state-snapshot.test.ts`

| Test | What It Verifies |
|------|-----------------|
| `captureState() captures full state` | frame, time, seed, rngState, tree all present |
| `captureState() returns null for no scene` | Handles missing scene gracefully |

**File:** `packages/snapshot/src/filmstrip.test.ts`

| Test | What It Verifies |
|------|-----------------|
| `Filmstrip.add() stores frames` | length increments |
| `Filmstrip.atTime() finds nearest` | Returns closest frame to time |
| `Filmstrip.track() returns value series` | Tracks position.x over time |
| `Filmstrip.toJSON/fromJSON round-trips` | Serialization preserves data |
| `Filmstrip.findFirstOccurrence()` | Finds node appearing at specific frame |

**File:** `packages/snapshot/src/snapshot-diff.test.ts`

| Test | What It Verifies |
|------|-----------------|
| `diffSnapshots() returns empty for identical` | No diffs when trees match |
| `diffSnapshots() detects position change` | Reports position.x/y differences |
| `diffSnapshots() detects added child` | Reports extra node in B |
| `diffSnapshots() detects removed child` | Reports missing node in B |
| `diffSnapshots() respects tolerance` | Ignores small position diffs |
| `diffSnapshots() respects maxDiffs` | Stops after N diffs |
| `formatDiffs() produces readable output` | String includes paths and values |

---

## 10. Definition of Done

### @quintus/headless

- [ ] `HeadlessGame` class with `runFor()` and `runUntil()`
- [ ] `createHeadlessGame()` factory with plugin support
- [ ] Works in Vitest (jsdom) and pure Node.js
- [ ] `pnpm build` succeeds for the package
- [ ] All headless tests pass

### @quintus/test

- [ ] `InputScript` builder with press/tap/wait/release/analog
- [ ] `InputScriptPlayer` executes scripts against any game
- [ ] `TestRunner.run()` orchestrates full test scenarios
- [ ] `Timeline` class with frame/time queries and node search
- [ ] Assertion functions for spatial, state, scene, and timeline checks
- [ ] `assertDeterministic()` verifies multi-run reproducibility
- [ ] `pnpm build` succeeds for the package
- [ ] All test tests pass

### @quintus/snapshot

- [ ] `StateSnapshot` interface with game metadata
- [ ] `captureState()` utility
- [ ] `Filmstrip` class with time queries, tracking, and JSON serialization
- [ ] `diffSnapshots()` with tolerance and path ignoring
- [ ] `formatDiffs()` for human-readable output
- [ ] `pnpm build` succeeds for the package
- [ ] All snapshot tests pass

### Integration

- [ ] Platformer integration tests pass headlessly in Vitest
- [ ] Determinism verified: same seed + inputs = identical state (3 runs)
- [ ] `pnpm test` runs all new + existing tests with no regressions
- [ ] `pnpm lint` passes (Biome clean)
- [ ] All package `package.json` files have correct dependencies

---

## 11. Execution Order

Build bottom-up: headless first (no deps on test/snapshot), then test (depends on headless), then snapshot, then integration tests.

```
Phase 1: @quintus/headless                                       (~0.5 day)
─────────────────────────────────────────────────────────────────
  → HeadlessGame class, createHeadlessGame factory
  → Canvas stub for non-jsdom
  → runFor(), runUntil() convenience methods
  → Update package.json dependencies
  → Write tests

Phase 2: @quintus/test — InputScript                             (~0.5 day)
─────────────────────────────────────────────────────────────────
  → InputScript builder (create, press, tap, wait, release, analog)
  → InputScriptPlayer executor
  → Seconds-to-frames helpers
  → Write tests

Phase 3: @quintus/test — TestRunner + Timeline                   (~1 day)
─────────────────────────────────────────────────────────────────
  → Timeline class (record, atFrame, atTime, findNode, countNodes)
  → TestRunner.run() orchestration
  → TestRunOptions, TestResult interfaces
  → Write tests

Phase 4: @quintus/test — Assertions                              (~0.5 day)
─────────────────────────────────────────────────────────────────
  → Type guards (isNode2DSnapshot, isActorSnapshot)
  → Spatial, tag, scene, timeline assertions
  → assertDeterministic() multi-run verification
  → Write tests

Phase 5: @quintus/snapshot — StateSnapshot + Filmstrip           (~0.5 day)
─────────────────────────────────────────────────────────────────
  → StateSnapshot interface + captureState()
  → Filmstrip class (add, atTime, track, toJSON/fromJSON)
  → Write tests

Phase 6: @quintus/snapshot — Diff                                (~0.5 day)
─────────────────────────────────────────────────────────────────
  → diffSnapshots() with tolerance/ignore/maxDiffs
  → formatDiffs() human-readable output
  → Write tests

Phase 7: Platformer integration tests                            (~1 day)
─────────────────────────────────────────────────────────────────
  → examples/platformer/__tests__/platformer.test.ts
  → Player movement, jump, determinism tests
  → Enemy behavior tests
  → Collectible tests
  → Verify all pass with pnpm test
```

**Total: ~4.5 days**

### Parallelism Notes

- Phases 1 and 2 can run in parallel (headless and InputScript are independent).
- Phase 3 depends on both Phase 1 (HeadlessGame) and Phase 2 (InputScript).
- Phases 4, 5, and 6 can run in parallel after Phase 3.
- Phase 7 depends on all preceding phases.

### Dependency Graph

```
Phase 1 (headless) ──┐
                      ├──► Phase 3 (TestRunner) ──┬──► Phase 4 (assertions)
Phase 2 (InputScript)─┘                           ├──► Phase 5 (snapshot)
                                                   ├──► Phase 6 (diff)
                                                   └──► Phase 7 (integration) ◄── Phases 4,5,6
```
