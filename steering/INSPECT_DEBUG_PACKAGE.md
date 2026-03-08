# @quintus/debug Package — Detailed Design

> **Goal:** Extract debug logic from the `bin/qdbg` bash script into a testable TypeScript package, making debug commands available programmatically and closing feature gaps.
> **Outcome:** A thin `bin/qdbg` shell script that delegates to `@quintus/debug` for all logic; comprehensive test coverage; debug commands usable from headless tests and Node.js scripts.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Relocate formatters & add debug commands | **Done** |
| 2 | Higher-level bridge commands (track, jump-analysis, move-to, nearby) | **Done** |
| 3 | Programmatic CLI runner (Node.js API) | **Done** |
| 4 | Thin out `bin/qdbg` to pure shell delegation | **Done** |
| 5 | Visual debug overlays (FPS, collision viz, inspector) | Pending |

---

## Current State Analysis

### What lives where today

| Location | Contents | Problem |
|----------|----------|---------|
| `packages/core/src/debug-bridge.ts` | `DebugBridge` interface + `installDebugBridge()` (375 lines) | Tightly coupled to `Game` — correct location |
| `packages/core/src/debug-format.ts` | `formatTree()`, `formatEvents()` (150 lines) | Only used by debug bridge window globals — should live in debug package |
| `packages/core/src/debug-log.ts` | `DebugLog` ring buffer (106 lines) | Used by `Game.debugLog` — correct location |
| `bin/qdbg` | 870 lines of bash with ~500 lines of embedded JavaScript | JS logic is untestable, duplicates formatting, and can't be used programmatically |
| `packages/debug/` | Empty placeholder (`export {}`) | Ready to be populated |

### Embedded JS that should be TypeScript

These `qdbg` commands contain significant JavaScript logic embedded as bash strings. This logic is **untestable, untyped, and unreusable**:

| Command | Lines | Logic that should be extracted |
|---------|-------|-------------------------------|
| `cmd_layout()` | 260–294 | Spatial tree walk with physics annotations — a `formatLayout()` formatter |
| `cmd_physics()` | 329–370 | Physics state display with 2D/3D support — a `formatPhysics()` formatter |
| `cmd_track()` | 552–579 | Frame-by-frame position/velocity table — a `track()` bridge command + `formatTrack()` |
| `cmd_jump_analysis()` | 582–651 | Full jump arc measurement — a `jumpAnalysis()` bridge command + `formatJumpAnalysis()` |
| `cmd_move_to()` | 653–711 | Hold-until-threshold movement — a `moveTo()` bridge command |
| `cmd_nearby()` | 713–768 | Proximity search with distance sort — a `nearby()` bridge command + `formatNearby()` |
| `cmd_inspect()` | 296–306 | JSON stringify with fallback — trivial, but should use formatter |
| `cmd_query()` | 308–327 | Query result formatting — a `formatQueryResults()` formatter |

### What the bash script should remain responsible for

- Argument parsing and dispatch
- `playwright-cli` session management (`qeval`, `qblock`, `qrun`)
- Dev server auto-detection and startup (`cmd_connect`)
- Screenshot file I/O (requires `page.locator`)
- Help text display

---

## Phase 1: Relocate Formatters & Add Debug Commands

Move existing formatters from `packages/core` to `packages/debug` and add new formatters for the logic currently embedded in qdbg.

### 1.1 Move `debug-format.ts` to `packages/debug`

- [ ] Move `packages/core/src/debug-format.ts` → `packages/debug/src/formatters.ts`
- [ ] Re-export from `packages/core/src/debug-format.ts` for backwards compatibility (the bridge imports it)
- [ ] Add `@quintus/core` as a dependency of `@quintus/debug` (for `NodeSnapshot`, `DebugEvent` types)
- [ ] Update `packages/debug/package.json` with dependencies, description, and tsup config
- [ ] Verify `pnpm build` succeeds
- [ ] Move `packages/core/src/debug-format.test.ts` → `packages/debug/src/formatters.test.ts`

### 1.2 Add `formatLayout()` formatter

Extract the `cmd_layout()` JS from qdbg into a typed function:

```typescript
// packages/debug/src/formatters.ts

export interface LayoutOptions {
  /** Show velocity vectors (default: true) */
  showVelocity?: boolean;
  /** Show collision groups (default: true) */
  showGroups?: boolean;
}

/**
 * Format a node tree as a spatial layout with physics annotations.
 * Shows position, velocity, floor/wall/ceiling state, collision groups, and shapes.
 */
export function formatLayout(snapshot: NodeSnapshot, options?: LayoutOptions): string;
```

- [ ] Implement `formatLayout()` in `packages/debug/src/formatters.ts`
- [ ] Add tests in `packages/debug/src/formatters.test.ts`
- [ ] Install on `window.__quintusFormatters.formatLayout` in the bridge

### 1.3 Add `formatPhysics()` formatter

Extract `cmd_physics()` JS:

```typescript
/**
 * Format a single node's physics state as a human-readable multi-line summary.
 * Handles 2D and 3D positions, rotation, velocity, gravity, floor/wall/ceiling.
 */
export function formatPhysics(snapshot: NodeSnapshot): string;
```

- [ ] Implement `formatPhysics()` in `packages/debug/src/formatters.ts`
- [ ] Add tests (2D node, 3D node, actor with contacts, non-physics node)
- [ ] Install on `window.__quintusFormatters.formatPhysics`

### 1.4 Add `formatQueryResults()` formatter

Extract `cmd_query()` JS:

```typescript
/**
 * Format query results as one-line-per-node summaries with position and tags.
 */
export function formatQueryResults(snapshots: NodeSnapshot[]): string;
```

- [ ] Implement `formatQueryResults()` in `packages/debug/src/formatters.ts`
- [ ] Add tests
- [ ] Install on `window.__quintusFormatters.formatQueryResults`

### 1.5 Update `DebugFormatters` interface

```typescript
// packages/core/src/debug-bridge.ts — update the interface
export interface DebugFormatters {
  formatTree: typeof formatTree;
  formatEvents: typeof formatEvents;
  formatLayout: typeof formatLayout;
  formatPhysics: typeof formatPhysics;
  formatQueryResults: typeof formatQueryResults;
  formatTrack: typeof formatTrack;         // Phase 2
  formatJumpAnalysis: typeof formatJumpAnalysis; // Phase 2
  formatNearby: typeof formatNearby;       // Phase 2
}
```

- [ ] Update `DebugFormatters` interface with new formatters
- [ ] Update `installDebugBridge()` to assign all formatters to `window.__quintusFormatters`

### Tests for Phase 1

**Unit:** `packages/debug/src/formatters.test.ts`
- `formatLayout()` renders indented spatial tree with positions
- `formatLayout()` shows velocity, floor/wall/ceiling flags
- `formatLayout()` handles 3D positions (x, y, z)
- `formatLayout()` handles nodes without position (skips them)
- `formatPhysics()` renders 2D actor with all fields
- `formatPhysics()` renders 3D node with rotation
- `formatPhysics()` renders non-physics node gracefully
- `formatQueryResults()` renders empty array as "No matches"
- `formatQueryResults()` renders nodes with tags and positions
- Existing `formatTree()` and `formatEvents()` tests pass unchanged

---

## Phase 2: Higher-Level Bridge Commands

Add `track()`, `jumpAnalysis()`, `moveTo()`, and `nearby()` as first-class bridge methods, moving the logic out of bash-embedded JS.

### 2.1 Add `track()` to DebugBridge

```typescript
export interface TrackResult {
  frames: TrackFrame[];
}

export interface TrackFrame {
  frame: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  isOnFloor: boolean;
  isOnWall: boolean;
  isOnCeiling: boolean;
}

// On DebugBridge interface:
track(nameOrId: string | number, frames?: number): TrackResult;
```

The `track()` method steps N frames (default 30), inspecting the target each frame and collecting position/velocity/contact state.

```typescript
export function formatTrack(result: TrackResult): string;
```

- [ ] Add `TrackResult` and `TrackFrame` types in `packages/debug/src/types.ts`
- [ ] Implement `track()` on the bridge in `packages/core/src/debug-bridge.ts`
- [ ] Implement `formatTrack()` in `packages/debug/src/formatters.ts`
- [ ] Add bridge tests for `track()`
- [ ] Add formatter tests for `formatTrack()`
- [ ] Install `formatTrack` on `window.__quintusFormatters`

### 2.2 Add `jumpAnalysis()` to DebugBridge

```typescript
export interface JumpAnalysisResult {
  nodeName: string;
  startY: number;
  jumpVy: number;
  gravity: number;
  /** Measured values */
  measured: {
    jumpHeight: number;
    apexFrame: number;
    airTimeFrames: number;
    airTimeSec: number;
    landed: boolean;
    landFrame: number;
  };
  /** Theoretical values based on physics params */
  theoretical: {
    height: number;
    airFrames: number;
    efficiency: number; // measured / theoretical as percentage
  };
}

// On DebugBridge interface:
jumpAnalysis(nameOrId: string | number): JumpAnalysisResult;
```

```typescript
export function formatJumpAnalysis(result: JumpAnalysisResult): string;
```

- [ ] Add `JumpAnalysisResult` type in `packages/debug/src/types.ts`
- [ ] Implement `jumpAnalysis()` on the bridge in `packages/core/src/debug-bridge.ts`
- [ ] Implement `formatJumpAnalysis()` in `packages/debug/src/formatters.ts`
- [ ] Add bridge tests for `jumpAnalysis()`
- [ ] Add formatter tests for `formatJumpAnalysis()`
- [ ] Install `formatJumpAnalysis` on `window.__quintusFormatters`

### 2.3 Add `moveTo()` to DebugBridge

```typescript
export interface MoveToResult {
  reached: boolean;
  frames: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  isOnFloor: boolean;
}

export interface MoveToOptions {
  /** Actions to hold during movement (e.g. ["move_right"]) */
  actions: string[];
  /** Target x threshold, or null to ignore */
  targetX: number | null;
  /** Target y threshold, or null to ignore */
  targetY: number | null;
  /** Maximum frames before giving up (default: 600) */
  maxFrames?: number;
}

// On DebugBridge interface:
moveTo(nameOrId: string | number, options: MoveToOptions): MoveToResult;
```

- [ ] Add `MoveToResult` and `MoveToOptions` types in `packages/debug/src/types.ts`
- [ ] Implement `moveTo()` on the bridge in `packages/core/src/debug-bridge.ts`
- [ ] Add bridge tests for `moveTo()`
- [ ] Verify direction detection works (target left of start vs right of start)

### 2.4 Add `nearby()` to DebugBridge

```typescript
export interface NearbyResult {
  center: { x: number; y: number };
  radius: number;
  nodes: NearbyNode[];
}

export interface NearbyNode {
  type: string;
  name: string;
  position: { x: number; y: number; z?: number };
  distance: number;
  delta: { x: number; y: number; z?: number };
  collisionGroup?: string;
  shape?: string;
  bodyType?: string;
  tags: string[];
}

// On DebugBridge interface:
nearby(nameOrId: string | number, radius?: number): NearbyResult;
```

```typescript
export function formatNearby(result: NearbyResult): string;
```

- [ ] Add `NearbyResult` and `NearbyNode` types in `packages/debug/src/types.ts`
- [ ] Implement `nearby()` on the bridge in `packages/core/src/debug-bridge.ts`
- [ ] Implement `formatNearby()` in `packages/debug/src/formatters.ts`
- [ ] Add bridge tests for `nearby()`
- [ ] Add formatter tests for `formatNearby()`
- [ ] Install `formatNearby` on `window.__quintusFormatters`

### 2.5 Update `DebugBridge` interface

```typescript
// Updated interface in packages/core/src/debug-bridge.ts
export interface DebugBridge {
  // ... existing methods ...

  /** Step N frames, tracking a node's state each frame. */
  track(nameOrId: string | number, frames?: number): TrackResult;

  /** Perform a full jump analysis — tap jump, measure arc, report metrics. */
  jumpAnalysis(nameOrId: string | number): JumpAnalysisResult;

  /** Hold actions until a node reaches a position threshold. */
  moveTo(nameOrId: string | number, options: MoveToOptions): MoveToResult;

  /** Find all nodes within a radius of a target node. */
  nearby(nameOrId: string | number, radius?: number): NearbyResult;
}
```

- [ ] Add all four methods to the `DebugBridge` interface
- [ ] Implement all four in `installDebugBridge()`
- [ ] Export result types from `packages/core/src/index.ts`

### Tests for Phase 2

**Unit:** `packages/core/src/debug-bridge.test.ts` (extend existing)
- `track()` returns correct frame count and positions
- `track()` handles node destruction mid-track
- `jumpAnalysis()` measures jump height and air time
- `jumpAnalysis()` errors if node not on floor
- `moveTo()` reaches target and releases actions
- `moveTo()` stops at maxFrames limit
- `moveTo()` handles negative direction (moving left)
- `nearby()` finds nodes within radius sorted by distance
- `nearby()` returns empty for isolated nodes

**Unit:** `packages/debug/src/formatters.test.ts` (extend)
- `formatTrack()` renders aligned table with headers
- `formatTrack()` handles early termination (node lost)
- `formatJumpAnalysis()` renders measured vs theoretical sections
- `formatNearby()` renders sorted list with distances and deltas

---

## Phase 3: Programmatic CLI Runner (Node.js API)

Create a Node.js-side API that can execute debug commands without bash, enabling use from headless tests and scripts.

### 3.1 Command executor

```typescript
// packages/debug/src/commands.ts

import type { DebugBridge, DebugFormatters } from "@quintus/core";

export interface CommandResult {
  ok: boolean;
  output: string;
}

/**
 * Execute a debug command against a bridge instance.
 * This is the same logic qdbg uses, but as a typed TypeScript function.
 *
 * @example
 * const bridge = window.__quintusDebug!;
 * const formatters = window.__quintusFormatters!;
 * const result = executeCommand(bridge, formatters, "tree");
 * console.log(result.output);
 */
export function executeCommand(
  bridge: DebugBridge,
  formatters: DebugFormatters,
  command: string,
  args?: string[],
): CommandResult;
```

This function maps command names to bridge calls + formatter output, providing a single entry point that both `qdbg` and programmatic callers can use.

**Supported commands:**
- `status` → `{ frame, elapsed, paused }`
- `tree` → `formatTree(bridge.tree())`
- `layout` → `formatLayout(bridge.tree())`
- `inspect <name>` → `JSON.stringify(bridge.inspect(name))`
- `query <q>` → `formatQueryResults(bridge.query(q))`
- `physics <name>` → `formatPhysics(bridge.inspect(name))`
- `step [N]` → `bridge.step(N)`
- `pause` / `resume` → `bridge.pause()` / `bridge.resume()`
- `actions` → `bridge.listActions()`
- `press <action>` → `bridge.press(action)`
- `release <action>` → `bridge.release(action)`
- `release-all` → `bridge.releaseAll()`
- `tap <action> [N]` → `bridge.pressAndStep(action, N)`
- `click <x> <y>` → `bridge.click(x, y)`
- `click-button <name>` → `bridge.clickButton(name)`
- `track <name> [N]` → `formatTrack(bridge.track(name, N))`
- `jump-analysis <name>` → `formatJumpAnalysis(bridge.jumpAnalysis(name))`
- `move-to <name> <actions> <x> <y>` → `bridge.moveTo(...)`
- `nearby <name> [R]` → `formatNearby(bridge.nearby(name, R))`
- `scene <name>` → `bridge.switchScene(name)`
- `scenes` → `bridge.listScenes()`
- `destroy <q>` → `bridge.destroy(q)`
- `events [flags]` → `formatEvents(bridge.events(filter))`
- `peek [flags]` → `formatEvents(bridge.peekEvents(filter))`
- `clear-events` → `bridge.clearEvents()`
- `run <json>` → `bridge.run(JSON.parse(json))`
- `eval <code>` → direct eval (only in browser context)
- `mouse <x> <y>` → `bridge.setMousePosition(x, y)`
- `mouse-get` → `bridge.getMousePosition()`

- [ ] Implement `executeCommand()` in `packages/debug/src/commands.ts`
- [ ] Export from `packages/debug/src/index.ts`
- [ ] Comprehensive tests in `packages/debug/src/commands.test.ts`

### 3.2 Headless debug helper

```typescript
// packages/debug/src/headless-debug.ts

import type { HeadlessGame } from "@quintus/headless";

/**
 * Attach debug commands to a HeadlessGame instance.
 * Returns a function that executes commands as strings (same syntax as qdbg).
 *
 * @example
 * const game = new HeadlessGame(options);
 * const dbg = attachDebug(game);
 * console.log(dbg("tree"));
 * console.log(dbg("physics Player"));
 * dbg("tap jump 1");
 * dbg("step 30");
 * console.log(dbg("physics Player"));
 */
export function attachDebug(game: HeadlessGame): (command: string) => string;
```

This bridges the gap between `HeadlessGame` (used in tests) and the debug command system. Today, headless tests can only use the raw `Game` API. With `attachDebug()`, test authors can use the same high-level commands as qdbg.

- [ ] Add `@quintus/headless` as an optional peer dependency
- [ ] Implement `attachDebug()` in `packages/debug/src/headless-debug.ts`
- [ ] Add tests using `HeadlessGame` + `attachDebug()`
- [ ] Export from `packages/debug/src/index.ts`

### Tests for Phase 3

**Unit:** `packages/debug/src/commands.test.ts`
- `executeCommand("tree")` calls `bridge.tree()` and formats result
- `executeCommand("step", ["10"])` calls `bridge.step(10)`
- `executeCommand("physics", ["Player"])` calls `bridge.inspect("Player")` and formats
- `executeCommand("events", ["--category=physics"])` parses filter flags
- `executeCommand("move-to", ["Player", "move_right", "250", "-"])` parses correctly
- Unknown command returns `{ ok: false }`

**Integration:** `packages/debug/src/headless-debug.test.ts`
- `attachDebug()` returns a working command function
- Can execute `tree`, `step`, `inspect` against a live headless game
- `track` returns tabular output from headless game

---

## Phase 4: Thin Out `bin/qdbg`

Rewrite the qdbg bash script to be a thin dispatcher. All logic moves to browser-side `executeCommand()`.

### 4.1 New qdbg architecture

```
bin/qdbg (bash)
  │
  ├── Argument parsing (bash)
  ├── connect/disconnect (bash — playwright-cli session management)
  ├── screenshot (bash — playwright-cli page access for file I/O)
  │
  └── All other commands:
        qblock "
          var result = window.__quintusDebug.executeCommand('${cmd}', ${argsJson});
          return result.output;
        "
```

The key insight: install `executeCommand` on the window alongside the bridge, then qdbg only needs to serialize command + args as a string and get back the formatted output.

### 4.2 Install command executor on window

```typescript
// In installDebugBridge():
window.__quintusExecute = (command: string, ...args: string[]) => {
  const bridge = window.__quintusDebug!;
  const formatters = window.__quintusFormatters!;
  return executeCommand(bridge, formatters, command, args);
};
```

### 4.3 Simplified qdbg commands

Before (current `cmd_physics`, 40 lines of embedded JS):
```bash
cmd_physics() {
  local target="${1:?Usage: qdbg physics <name>}"
  need_bridge
  qblock "
    var d = window.__quintusDebug;
    var snap = d.inspect('${target}');
    if (!snap) return 'Node not found: ${target}';
    var lines = [];
    # ... 30 more lines of JS ...
    return lines.join('\n');
  "
}
```

After (1 line of logic):
```bash
cmd_physics() {
  local target="${1:?Usage: qdbg physics <name>}"
  need_bridge
  qblock "return window.__quintusExecute('physics', '${target}').output;"
}
```

- [ ] Add `window.__quintusExecute` to the bridge installation
- [ ] Rewrite all qdbg command functions to use `__quintusExecute`
- [ ] Keep `cmd_connect`, `cmd_disconnect`, `cmd_screenshot` as bash (they need playwright-cli)
- [ ] Keep `cmd_eval` as bash (it's the escape hatch)
- [ ] Verify all commands still work via manual testing
- [ ] Update help text if any command signatures changed

### 4.4 Expected line count reduction

| Component | Before | After |
|-----------|--------|-------|
| `bin/qdbg` | ~870 lines | ~250 lines |
| `packages/debug/src/formatters.ts` | — | ~300 lines |
| `packages/debug/src/commands.ts` | — | ~200 lines |
| `packages/debug/src/types.ts` | — | ~80 lines |
| Bridge additions | — | ~100 lines |

The bash script shrinks by ~70%, and the extracted code gains full test coverage.

### Tests for Phase 4

**Integration (manual):** Run through the full qdbg workflow against the platformer:
- `connect platformer` → verify bridge detection
- `tree` → verify formatted output
- `physics Player` → verify physics display
- `step 30` → verify advancement
- `tap jump 1` → verify input injection
- `track Player 10` → verify tabular output
- `jump-analysis Player` → verify analysis output
- `move-to Player move_right 200 -` → verify movement
- `nearby Player 100` → verify proximity display
- `events --category=physics` → verify event filtering
- `screenshot` → verify PNG capture
- `disconnect` → verify cleanup

---

## Phase 5: Visual Debug Overlays

This phase implements the original vision for `@quintus/debug`: runtime visual tools. These are **separate from the CLI debugger** — they render directly onto the game canvas.

### 5.1 FPS Counter

```typescript
// packages/debug/src/fps-counter.ts

export class FPSCounter extends Node {
  /** Current frames per second. */
  readonly fps: number;

  /** Position on screen (default: top-left). */
  anchor: "top-left" | "top-right" | "bottom-left" | "bottom-right";

  /** Show frame time in ms alongside FPS. */
  showFrameTime: boolean;
}
```

- [ ] Implement `FPSCounter` as a `Node` that renders a text overlay
- [ ] Add to scene tree manually or via `game.showFPS()`
- [ ] Tests for FPS calculation accuracy

### 5.2 Collision Visualization

```typescript
// packages/debug/src/collision-viz.ts

export class CollisionViz extends Node {
  /** Show collision shapes as colored wireframes. */
  showShapes: boolean;
  /** Show velocity vectors as arrows. */
  showVelocity: boolean;
  /** Show contact normals on collision. */
  showContacts: boolean;
  /** Highlight sensors vs actors vs static colliders with different colors. */
  colorByType: boolean;
}
```

- [ ] Implement `CollisionViz` that renders wireframes over physics bodies
- [ ] Color-code by body type (Actor=green, StaticCollider=blue, Sensor=yellow)
- [ ] Show velocity arrows scaled to magnitude
- [ ] Tests with mock renderer

### 5.3 Node Inspector Overlay

```typescript
// packages/debug/src/inspector.ts

export class Inspector extends Node {
  /** Currently selected node (click to select). */
  selectedNode: Node | null;
  /** Show property panel for selected node. */
  showProperties: boolean;
  /** Highlight selected node's collision shape. */
  highlightSelected: boolean;
}
```

- [ ] Implement `Inspector` with click-to-select behavior
- [ ] Render property panel showing position, velocity, tags, etc.
- [ ] Highlight selection with bounding box

### Tests for Phase 5

These are primarily visual features. Tests focus on:
- FPS counter calculation (mock performance.now)
- Collision viz correctly reads physics state
- Inspector selection logic

---

## Package Structure

```
packages/debug/
├── package.json
├── tsup.config.ts
├── src/
│   ├── index.ts              # Re-exports everything
│   ├── types.ts              # TrackResult, JumpAnalysisResult, MoveToResult, NearbyResult, etc.
│   ├── formatters.ts         # formatTree, formatEvents, formatLayout, formatPhysics, formatTrack, etc.
│   ├── formatters.test.ts
│   ├── commands.ts           # executeCommand() — maps command strings to bridge calls
│   ├── commands.test.ts
│   ├── headless-debug.ts     # attachDebug() for HeadlessGame
│   ├── headless-debug.test.ts
│   ├── fps-counter.ts        # FPSCounter node (Phase 5)
│   ├── collision-viz.ts      # CollisionViz node (Phase 5)
│   └── inspector.ts          # Inspector node (Phase 5)
```

### Dependencies

```json
{
  "dependencies": {
    "@quintus/core": "workspace:*"
  },
  "peerDependencies": {
    "@quintus/headless": "workspace:*"
  },
  "peerDependenciesMeta": {
    "@quintus/headless": { "optional": true }
  }
}
```

---

## Migration Path

### Backwards Compatibility

1. **`packages/core/src/debug-format.ts`** — Keep as a thin re-export of `@quintus/debug/formatters` so existing imports don't break
2. **`window.__quintusDebug`** — Interface only grows (new methods), never breaks
3. **`window.__quintusFormatters`** — Same: only adds new formatters
4. **`bin/qdbg` CLI** — All existing commands keep their exact syntax and output format
5. **`DebugBridge` type** — Exported from both `@quintus/core` and `@quintus/debug`

### What does NOT change

- The `?debug` URL parameter detection in `Game`
- The `DebugLog` class staying in `@quintus/core`
- The `installDebugBridge()` function staying in `@quintus/core`
- The `serialize()` method on nodes
- The `NodeSnapshot` type
- The `playwright-cli` dependency (stays external, managed by qdbg bash)

---

## Feature Gaps Identified

Beyond the extraction work, these gaps exist in the current debug system:

| Gap | Description | Phase |
|-----|-------------|-------|
| No programmatic access | Debug commands only usable via bash CLI | Phase 3 |
| Untestable formatting | 500+ lines of JS in bash strings have zero test coverage | Phases 1-2 |
| No headless debugging | Can't use debug commands in `HeadlessGame` tests | Phase 3 |
| No visual overlays | FPS counter, collision viz, inspector mentioned but unbuilt | Phase 5 |
| No state diffing | No way to diff two snapshots and see what changed | Future |
| No watch mode | No way to continuously monitor a value across frames | Future |
| No performance profiling | No frame time breakdown (physics, render, scripts) | Future |
| No recording/playback | Can't record a debug session and replay it | Future |

---

## Definition of Done

- [ ] All phases marked Done in status table
- [ ] `packages/debug/src/` contains all formatters, commands, and types
- [ ] `bin/qdbg` is under 300 lines of bash
- [ ] All extracted logic has unit tests
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes with no warnings
- [ ] `pnpm lint` clean
- [ ] Manual qdbg workflow test passes against platformer example
- [ ] `attachDebug()` works with HeadlessGame in a test
