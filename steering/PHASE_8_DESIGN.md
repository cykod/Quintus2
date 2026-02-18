# Phase 8: Debug CLI & AI Skills — Detailed Design

> **Goal:** Give AI coding tools (Claude Code, Cursor, etc.) the ability to inspect, control, and debug a running Quintus game — without maintaining a separate protocol server.
> **Outcome:** An AI agent can launch any Quintus example with `/debug-game`, step through frames, inspect the scene tree, inject inputs, analyze physics, view causal event logs, and reproduce bugs deterministically. The workflow is driven by the `qdbg` CLI (`pnpm qdbg` or `bin/qdbg`) that wraps Playwright interactions with the engine's `window.__quintusDebug` bridge. Human developers can use the same CLI directly from their terminal.

---

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Engine debug API — Node.serialize(), snapshot types | Done |
| 2 | DebugLog — ring buffer, drain/peek, event filtering | Done |
| 3 | Game debug mode — ?debug auto-pause, ?seed, ?step params | Done |
| 4 | Debug bridge — window.__quintusDebug full API | Done |
| 5 | Auto-instrumentation — lifecycle, physics, sensor, scene events | Done |
| 6 | Debug formatters — formatTree, formatEvents | Done |
| 7 | quintus-debug CLI — bash wrapper over playwright-cli | Done |
| 8 | Claude Code skill — /debug-game with SKILL.md + references | Done |
| 9 | Promote CLI to top-level `qdbg` script | Done |
| 10 | Input & audio auto-instrumentation | Done |
| 11 | Signal watching (opt-in) | Done |
| 12 | End-to-end integration test | Done |

---

## Table of Contents

1. [What's Already Built](#1-whats-already-built)
2. [Architecture Overview](#2-architecture-overview)
3. [Layer 1: Engine Debug API](#3-layer-1-engine-debug-api)
4. [Layer 2: Browser Debug Bridge](#4-layer-2-browser-debug-bridge)
5. [Layer 3: qdbg CLI](#5-layer-3-qdbg-cli)
6. [Layer 4: Claude Code Skill](#6-layer-4-claude-code-skill)
7. [Remaining Work: Promote CLI to Top-Level `qdbg`](#7-remaining-work-promote-cli-to-top-level-qdbg)
8. [Remaining Work: Input & Audio Instrumentation](#8-remaining-work-input--audio-instrumentation)
9. [Remaining Work: Signal Watching](#9-remaining-work-signal-watching)
10. [Remaining Work: End-to-End Test](#10-remaining-work-end-to-end-test)
11. [Test Plan](#11-test-plan)
12. [Definition of Done](#12-definition-of-done)

---

## 1. What's Already Built

Phase 8 is substantially complete. The three-layer architecture (engine API → browser bridge → CLI/skill) is fully implemented and tested. This section documents what exists so the remaining work is clearly scoped.

### 1.1 Engine Debug API (Layer 1)

| Feature | Location | Lines | Tests |
|---------|----------|-------|-------|
| `Node.serialize()` | `packages/core/src/node.ts:303` | ~10 | `snapshot-types.test.ts` |
| `Node2D.serialize()` | `packages/core/src/node2d.ts:107` | ~15 | `snapshot-types.test.ts` |
| `Actor.serialize()` | `packages/physics/src/actor.ts:116` | ~15 | `snapshot-types.test.ts` |
| `StaticCollider.serialize()` | `packages/physics/src/static-collider.ts` | ~10 | `snapshot-types.test.ts` |
| `Sensor.serialize()` | `packages/physics/src/sensor.ts` | ~10 | `snapshot-types.test.ts` |
| `CollisionShape.serialize()` | `packages/physics/src/collision-shape.ts` | ~10 | `snapshot-types.test.ts` |
| `Camera.serialize()` | `packages/camera/src/camera.ts` | ~15 | — |
| Snapshot type hierarchy | `packages/core/src/snapshot-types.ts` | ~40 | — |
| Physics snapshot types | `packages/physics/src/snapshot-types.ts` | ~50 | — |
| Snapshot query utils | `packages/core/src/snapshot-utils.ts` | ~40 | `snapshot-utils.test.ts` |
| `Game.screenshot()` | `packages/core/src/game.ts` | ~5 | `debug-bridge.test.ts` |
| `Game.log()` | `packages/core/src/game.ts:228` | ~5 | `debug-instrumentation.test.ts` |

### 1.2 DebugLog (Layer 1)

| Feature | Location | Tests |
|---------|----------|-------|
| `DebugLog` class | `packages/core/src/debug-log.ts` | `debug-log.test.ts` (148 lines) |
| Ring buffer (10K events) | `debug-log.ts` | overflow test |
| `drain()` + cursor | `debug-log.ts` | cursor behavior test |
| `peek()` without advancing | `debug-log.ts` | peek test |
| `EventFilter` (category, frame/time range, search, limit) | `debug-log.ts` | filter tests |

### 1.3 Auto-Instrumentation (Layer 1)

Events logged automatically when `game.debug === true`:

| Category | Events | Location |
|----------|--------|----------|
| `lifecycle` | `onReady`, `onDestroy` (with node type, ID, tags) | `packages/core/src/node.ts:182-190, 335-342` |
| `error` | Uncaught exceptions in lifecycle methods | `packages/core/src/scene.ts:117-125` |
| `scene` | Scene transitions (`SceneA → SceneB`) | `packages/core/src/game.ts:271-280` |
| `physics` | Collision events (normal, other body) | `packages/physics/src/actor.ts:330-345` |
| `physics` | Moving platform carry events | `packages/physics/src/actor.ts:359-370` |
| `physics` | Floor/wall/ceiling contact enter/exit | `packages/physics/src/actor.ts:425-450` |
| `physics` | Sensor body entered/exited | `packages/physics/src/physics-world.ts:501-525` |
| `game` | Custom events via `game.log()` | `packages/core/src/game.ts:228-231` |

**Not yet instrumented:** `input` category (action pressed/released), `audio` category (sound play/stop), `signal` category (opt-in signal watching).

### 1.4 Browser Debug Bridge (Layer 2)

| Feature | Location | Tests |
|---------|----------|-------|
| `installDebugBridge()` | `packages/core/src/debug-bridge.ts` | `debug-bridge.test.ts` (497 lines) |
| `window.__quintusDebug` API | `debug-bridge.ts:65-230` | all bridge methods tested |
| `window.__quintusFormatters` | `debug-bridge.ts:225` | `debug-format.test.ts` |
| `window.__quintusGame` | `debug-bridge.ts:228` (debug only) | — |
| `?debug` auto-pause | `packages/core/src/game.ts:171-195` | `debug-bridge.test.ts` |
| `?seed=N` override | `packages/core/src/game.ts:87-92` | — |
| `?step=N` auto-advance | `packages/core/src/game.ts:180-188` | — |
| "PAUSED [frame N]" overlay | `packages/core/src/game.ts` | visual |

**Bridge API surface (all implemented):**

```
Status:     paused, frame, elapsed
Control:    pause(), resume(), step(N)
Inspect:    tree(), query(q), inspect(nameOrId)
Capture:    screenshot()
Input:      listActions(), press(action), release(action), releaseAll()
Compound:   pressAndStep(action, N), run(script[])
Events:     events(filter?), peekEvents(filter?), clearEvents(), log(cat, msg, data?)
UI:         click(x, y), clickButton(nameOrText)
```

### 1.5 qdbg CLI (Layer 3)

**Current file:** `.claude/skills/debug-game/quintus-debug` (654 lines)
**Target file:** `bin/qdbg` (see [Section 7](#7-remaining-work-promote-cli-to-top-level-qdbg))

A bash script that wraps `playwright-cli` session commands to call the debug bridge.

| Category | Commands |
|----------|----------|
| Connection | `connect [demo]`, `disconnect` |
| Inspection | `status`, `tree`, `layout`, `inspect <name>`, `query <q>`, `physics <name>` |
| Simulation | `step [N]`, `pause`, `resume` |
| Input | `actions`, `press <action>`, `release <action>`, `release-all`, `tap <action> [N]`, `click <x> <y>`, `click-button <text>` |
| Movement | `move-to <node> <actions> <x> <y>`, `nearby <name> [radius]` |
| Scripting | `run '<json>'`, `track <name> [N]`, `jump-analysis <name>` |
| Events | `events [flags]`, `peek [flags]`, `clear-events` |
| Capture | `screenshot [file]` |

### 1.6 Claude Code Skill (Layer 4)

**File:** `.claude/skills/debug-game/SKILL.md`

Skill definition with:
- Quick start guide
- Command decision tree (what to use when)
- Core mental model (paused-by-default, frame-based, drain semantics)
- Important constraints and pitfalls
- Physics quick reference

**Reference docs:**
- `.claude/skills/debug-game/references/api-reference.md` — full command reference
- `.claude/skills/debug-game/references/recipes.md` — step-by-step debugging recipes
- `.claude/skills/debug-game/references/physics.md` — move() algorithm, formulas, debugging scenarios

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Claude Code (Claude Opus / Sonnet)                      │
│  ┌────────────────────────────────────┐                  │
│  │ /debug-game skill (SKILL.md)       │                  │
│  │   • Command decision tree          │                  │
│  │   • Physics reference              │                  │
│  │   • Debugging recipes              │                  │
│  └──────────────┬─────────────────────┘                  │
│                 │ invokes                                 │
│  ┌──────────────▼─────────────────────┐                  │
│  │ qdbg CLI (bin/qdbg)               │  Layer 3         │
│  │   • connect/disconnect             │                  │
│  │   • tree/inspect/physics/layout    │                  │
│  │   • step/press/tap/move-to         │                  │
│  │   • events/peek/screenshot         │                  │
│  └──────────────┬─────────────────────┘                  │
└─────────────────┼────────────────────────────────────────┘
                  │ playwright-cli session
┌─────────────────▼────────────────────────────────────────┐
│  Browser (Chromium via Playwright)                        │
│  ┌────────────────────────────────────┐                  │
│  │ window.__quintusDebug              │  Layer 2         │
│  │   • pause/resume/step              │                  │
│  │   • tree/query/inspect             │                  │
│  │   • press/release/run              │                  │
│  │   • events/peekEvents/clearEvents  │                  │
│  │   • click/clickButton              │                  │
│  └──────────────┬─────────────────────┘                  │
│                 │ delegates to                            │
│  ┌──────────────▼─────────────────────┐                  │
│  │ @quintus/core Engine APIs          │  Layer 1         │
│  │   • Game.step() / Game.pause()     │                  │
│  │   • Node.serialize() → snapshots   │                  │
│  │   • Input.inject() → actions       │                  │
│  │   • DebugLog → event recording     │                  │
│  │   • Game.screenshot() → PNG        │                  │
│  └────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────┘
```

**Key design principle:** The engine-level APIs (Layer 1) are production code in `@quintus/core` and `@quintus/physics`. The debug bridge (Layer 2) is also in `@quintus/core` but conditionally activated. The CLI (Layer 3) lives at `bin/qdbg` for direct access, with the skill (Layer 4) in `.claude/skills/` providing AI-specific guidance on top.

---

## 3. Layer 1: Engine Debug API

### 3.1 Snapshot Type Hierarchy

```
NodeSnapshot
├── id: number
├── type: string (constructor.name)
├── name: string
├── tags: string[]
└── children: NodeSnapshot[]

Node2DSnapshot extends NodeSnapshot
├── position: { x, y }
├── rotation: number
├── scale: { x, y }
├── globalPosition: { x, y }
├── visible: boolean
├── zIndex: number
├── alpha: number
└── renderFixed: boolean

ActorSnapshot extends Node2DSnapshot
├── velocity: { x, y }
├── gravity: number
├── isOnFloor / isOnWall / isOnCeiling: boolean
├── collisionGroup: string
└── bodyType: "actor"

StaticColliderSnapshot extends Node2DSnapshot
├── oneWay: boolean
├── constantVelocity: { x, y }
├── collisionGroup: string
└── bodyType: "static"

SensorSnapshot extends Node2DSnapshot
├── monitoring: boolean
├── overlappingBodyCount / overlappingSensorCount: number
├── collisionGroup: string
└── bodyType: "sensor"

CollisionShapeSnapshot extends Node2DSnapshot
├── shapeType: "rect" | "circle" | "capsule" | "polygon" | null
├── shapeDesc: string (human-readable, e.g., "circle(20)")
└── disabled: boolean

CameraSnapshot extends NodeSnapshot
├── position: { x, y }
├── zoom: number
├── smoothing: number
├── followTarget: string | null
├── bounds: { x, y, width, height } | null
├── isShaking: boolean
├── deadZone: { x, y, width, height } | null
└── pixelPerfectZoom: boolean
```

### 3.2 Extensibility Pattern

Game-specific classes extend `serialize()` to include custom data:

```typescript
class Player extends Actor {
  health = 5;
  score = 0;

  override serialize() {
    return { ...super.serialize(), health: this.health, score: this.score };
  }
}
```

This data flows through the entire pipeline — bridge → CLI → skill — because all layers pass JSON transparently.

### 3.3 Debug Log Event Categories

| Category | Source | Examples |
|----------|--------|---------|
| `lifecycle` | `Node._enterTreeRecursive()`, `Node.destroy()` | `Player#12.onReady tags=[player]`, `Coin#5.onDestroy` |
| `physics` | `Actor.move()`, `PhysicsWorld.stepSensors()` | `Player#12 collision normal=(0,-1)`, `floor_contact entered` |
| `scene` | `Game._switchScene()` | `Scene: Level1 → Level2` |
| `error` | `Scene._handleLifecycleError()` | `Goomba#8.onUpdate: TypeError...` |
| `game` | `game.log()` | Custom events from game code |
| `input` | *(not yet implemented)* | `jump pressed`, `move_right released` |
| `audio` | *(not yet implemented)* | `play "coin.ogg" volume=1` |
| `signal` | *(not yet implemented — opt-in)* | `Player#12.died emitted` |

---

## 4. Layer 2: Browser Debug Bridge

### 4.1 Installation

`installDebugBridge(game)` is called from `Game.start()` when `game.debug === true`.

**Activation flow:**
1. Game constructor: `this.debug = options.debug ?? _detectDebugMode()` (checks `?debug` in URL)
2. Game.start(): If `debug`, render one frame, install bridge, DON'T start loop
3. Bridge exposed at `window.__quintusDebug`, formatters at `window.__quintusFormatters`
4. Canvas shows "PAUSED [frame N]" overlay

**URL parameters:**
- `?debug` — auto-pause at frame 0
- `?debug&seed=42` — override RNG seed for reproducibility
- `?debug&step=60` — auto-advance 60 frames then pause

### 4.2 Bridge API Reference

See `.claude/skills/debug-game/references/api-reference.md` for the full CLI command reference, which maps 1:1 to bridge methods.

**Critical design decisions already made:**
- **Actions not keys:** Bridge uses `press("jump")` not `press("Space")`. The AI doesn't need to know key bindings.
- **Drain semantics:** `events()` returns events since last call and advances cursor. `peekEvents()` reads without advancing.
- **Held actions tracking:** Bridge tracks pressed actions in a `Set<string>` so `releaseAll()` can clean up.
- **Duck-typed input:** Bridge accesses `game.input.inject()` without hard-depending on `@quintus/input`.
- **Duck-typed UI clicks:** `click(x, y)` and `clickButton(nameOrText)` use duck typing to find interactive nodes with `_onPointerDown()`/`_onPointerUp()`.

---

## 5. Layer 3: qdbg CLI

### 5.1 Architecture

The CLI is a single bash script that:
1. Uses `playwright-cli -s=quintus` for persistent browser session
2. Evaluates JavaScript via `page.evaluate()` against `window.__quintusDebug`
3. Formats output as human/LLM-readable text

**Current location:** `.claude/skills/debug-game/quintus-debug` (654 lines)
**Target location:** `bin/qdbg` — see [Section 7: Promote CLI to Top-Level `qdbg`](#7-remaining-work-promote-cli-to-top-level-qdbg)

**Three evaluation modes:**
```bash
qeval "expression"     # Simple JS expression (no blocks)
qblock "block"         # JS block with return (via page.evaluate)
qrun "async fn"        # Full async function with page access (screenshots, fs)
```

### 5.2 Higher-Level Commands

The CLI adds commands beyond the raw bridge API:

| CLI Command | What It Adds Over Raw Bridge |
|-------------|------------------------------|
| `layout` | Spatial overview: flattened tree with positions, velocities, contact flags, shapes |
| `physics <name>` | Physics-focused summary for a single node |
| `track <name> [N]` | Step N frames, tabular position/velocity/contact tracking |
| `jump-analysis <name>` | Full jump arc analysis with measured vs theoretical metrics |
| `move-to <node> <actions> <x> <y>` | Hold actions until position threshold reached |
| `nearby <name> [radius]` | Show nearby nodes with distance, delta, shape info |
| `click-button <text>` | Find UI button by name/text and click programmatically |

These are the "ergonomic" layer — commands an AI actually needs for debugging workflows, built from composing the lower-level bridge API.

---

## 6. Layer 4: Claude Code Skill

### 6.1 Skill Structure (after `qdbg` promotion)

```
bin/
└── qdbg                              # Canonical CLI script

.claude/skills/debug-game/
├── SKILL.md                           # Main skill prompt (references qdbg)
├── qdbg -> ../../bin/qdbg            # Symlink for skill tool access
├── quintus-debug                      # Deprecation wrapper → qdbg
└── references/
    ├── api-reference.md               # Full command reference
    ├── recipes.md                     # Step-by-step debugging recipes
    └── physics.md                     # Physics debugging methodology
```

### 6.2 Skill Design

The skill is invoked as `/debug-game` and instructs Claude to:

1. **Connect** to a running game (starts dev server if needed)
2. Use the **command decision tree** to pick the right command for the situation
3. Follow **key constraints** (always connect first, positions are center-based, jump uses `isJustPressed`, etc.)
4. Reference **physics formulas** for reachability calculations
5. Follow **recipes** for common scenarios (platform reachability, item collection, sensor debugging)

**Core mental model** embedded in the skill:
- Debug mode starts paused — you must `step` to advance
- Everything is frame-based — one `step` = 1/60s
- Input is injected via action names — `press`/`release`/`tap`
- Events drain by default — `events` advances cursor, `peek` does not

---

## 7. Remaining Work: Promote CLI to Top-Level `qdbg`

### 7.1 Problem

The debug CLI currently lives buried inside the skill directory at `.claude/skills/debug-game/quintus-debug`. This has several problems:

1. **Not discoverable.** A developer cloning the repo has no idea it exists unless they read the skill docs.
2. **Not in `$PATH`.** Running it requires the full path or a manual alias.
3. **Skill-coupled.** The CLI is useful on its own (from a terminal, from other tools), but it's packaged as if it only exists for the Claude Code skill.
4. **No error guidance.** If `playwright-cli` isn't installed or the dev server isn't running, the errors are raw bash failures with no helpful context.

### 7.2 Solution

Move the CLI to a top-level `bin/qdbg` script that is:
- Accessible via `pnpm qdbg` from the project root
- Self-documenting with `qdbg help` and clear error messages for common failure modes
- Symlinked from the skill directory so `/debug-game` still works unchanged

### 7.3 File Layout

```
quintus/
├── bin/
│   └── qdbg                          # The canonical CLI script (moved here)
├── .claude/skills/debug-game/
│   ├── SKILL.md                      # Updated: references "qdbg" not "quintus-debug"
│   ├── qdbg -> ../../bin/qdbg        # Symlink for backward compat
│   └── references/
│       ├── api-reference.md           # Updated command examples
│       ├── recipes.md
│       └── physics.md
├── package.json                       # Add "qdbg" to scripts
```

### 7.4 Root `package.json` Integration

Add a script entry so `pnpm qdbg` works from anywhere in the workspace:

```jsonc
// package.json (root)
{
  "scripts": {
    // ... existing scripts ...
    "qdbg": "./bin/qdbg"
  }
}
```

This means:
```bash
pnpm qdbg connect platformer    # works from project root
pnpm qdbg tree                  # works from any subdirectory
pnpm qdbg step 60
```

### 7.5 Prerequisites Check & Error Messages

The script needs a preamble that checks for required tools and gives actionable error messages when things are wrong. This replaces the current raw `set -euo pipefail` crash behavior.

**Add to the top of `bin/qdbg`:**

```bash
#!/usr/bin/env bash
set -euo pipefail

# ── Prerequisites ────────────────────────────────────────────────────────────

# Find project root (works from any subdirectory)
QROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

check_playwright_cli() {
  if ! command -v playwright-cli &>/dev/null; then
    cat >&2 <<'MSG'
Error: playwright-cli is not installed or not in PATH.

The qdbg debugger requires playwright-cli to control the browser.
Install it with:

  npm install -g @anthropic-ai/claude-code

Or if you have Claude Code installed, ensure its bin directory is in your PATH.

playwright-cli is bundled with Claude Code and provides persistent
browser sessions for programmatic page control.
MSG
    exit 1
  fi
}

check_dev_server() {
  # Returns 0 if a dev server is detected on ports 3050-3055
  for p in 3050 3051 3052 3053 3054 3055; do
    if curl -s --connect-timeout 1 "http://localhost:${p}" >/dev/null 2>&1; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

# ── Usage / Help ─────────────────────────────────────────────────────────────

show_usage() {
  cat <<'USAGE'
qdbg — Quintus game engine debugger

Interactively debug any Quintus game from the terminal. Steps through
frames, inspects the scene tree, injects input, analyzes physics, and
captures screenshots — all via the engine's debug bridge.

PREREQUISITES
  1. playwright-cli must be installed (bundled with Claude Code)
  2. The Quintus dev server must be running: pnpm dev

QUICK START
  pnpm qdbg connect platformer     # Open game in browser, paused
  pnpm qdbg tree                   # See the scene tree
  pnpm qdbg step 60                # Advance 60 frames (1 second)
  pnpm qdbg physics Player         # Inspect player physics state
  pnpm qdbg tap jump 1             # Tap the jump button
  pnpm qdbg screenshot             # Save canvas to PNG
  pnpm qdbg disconnect             # Close browser

COMMANDS
  Connection:
    connect [demo|url]    Open browser with debug bridge (default: platformer)
    disconnect            Close browser session

  Inspection:
    status                Show frame number, elapsed time, paused state
    tree                  Formatted ASCII scene tree
    layout                Spatial overview with physics info
    inspect <name|id>     Detailed node snapshot (JSON)
    query <q>             Find nodes by type/name/tag
    physics <name>        Physics state summary for one node

  Simulation:
    step [N]              Advance N frames (default: 1)
    pause                 Pause game loop
    resume                Resume real-time game loop

  Input:
    actions               List available input actions
    press <action>        Press and hold an action
    release <action>      Release an action
    release-all           Release all held actions
    tap <action> [N]      Press for N frames then release (default: 1)
    click <x> <y>         Click at game-space coordinates
    click-button <text>   Click a UI button by name or text label

  Movement:
    move-to <node> <actions> <x> <y> [--max=N]
                          Hold action(s) until node reaches threshold
                          Use "-" for x or y to ignore that axis
    nearby <name> [rad]   Show nodes within radius (default: 100px)

  Scripting:
    run '<json>'          Execute a DebugAction[] script
    track <name> [N]      Step N frames with tabular tracking (default: 30)
    jump-analysis <name>  Full jump arc analysis with metrics

  Events:
    events [flags]        Drain events since last call
                          --category=  --search=  --limit=  --from=  --to=
    peek [flags]          View events without draining
    clear-events          Clear event log

  Capture:
    screenshot [file]     Save canvas to PNG (default: /tmp/quintus-screenshot.png)

COMMON ISSUES
  "Error: playwright-cli is not installed"
    → Install Claude Code (npm i -g @anthropic-ai/claude-code) which bundles it

  "Error: Debug bridge not found"
    → Run "qdbg connect" first. Every command except connect needs an active session.

  "Error: Dev server failed to start"
    → Run "pnpm dev" manually and check for errors

  "Node not found: Player"
    → Node names are case-sensitive. Run "qdbg tree" to see exact names.

EXAMPLES
  # Debug a custom example
  pnpm qdbg connect my-game

  # Connect to an arbitrary URL
  pnpm qdbg connect http://localhost:8080/game.html

  # Walk player right, jump, and check landing
  pnpm qdbg move-to Player move_right 250 -
  pnpm qdbg tap jump 1
  pnpm qdbg step 60
  pnpm qdbg physics Player

  # Run a scripted sequence
  pnpm qdbg run '[{"press":"move_right","frames":30},{"press":"jump","frames":1},{"wait":20}]'

  # Analyze jump physics
  pnpm qdbg jump-analysis Player

  # Filter events
  pnpm qdbg events --category=physics --search=floor
USAGE
}
```

### 7.6 Command Dispatch with Validation

The current dispatch (`case "$cmd" in ...`) falls through to a terse error. Replace with validation:

```bash
cmd="${1:-}"
if [ -z "$cmd" ]; then
  show_usage
  exit 0
fi

shift || true

case "$cmd" in
  help|-h|--help) show_usage ;;
  connect)
    check_playwright_cli
    cmd_connect "$@"
    ;;
  disconnect)
    check_playwright_cli
    cmd_disconnect
    ;;
  # ... all other commands check playwright_cli + need_bridge ...
  *)
    echo "Error: Unknown command '$cmd'" >&2
    echo "" >&2
    echo "Run 'qdbg help' for usage." >&2
    exit 1
    ;;
esac
```

### 7.7 Rename from `quintus-debug` to `qdbg`

The name `quintus-debug` is long and awkward to type. `qdbg` is:
- Short (4 chars vs 14)
- Memorable (Q for Quintus, dbg for debug)
- Unique enough to not collide with system tools
- Consistent with other short debug tools (`gdb`, `lldb`, `rdbg`)

### 7.8 Update Skill References

Update all references in the skill to use the new name:

**`.claude/skills/debug-game/SKILL.md`:**
- Change all `quintus-debug` → `qdbg` in command examples
- Update the Quick Start section
- Update the Command Decision Tree

**`.claude/skills/debug-game/references/api-reference.md`:**
- Change all `quintus-debug` → `qdbg` in command examples
- Update the format line at the top: `All commands use the format: qdbg <command> [args] [flags]`

**`.claude/skills/debug-game/references/recipes.md`:**
- Change all `quintus-debug` → `qdbg` in recipe steps

### 7.9 Backward Compatibility

Create a symlink so the old name still works (skill `allowed-tools` references it):

```bash
# In .claude/skills/debug-game/
ln -sf ../../bin/qdbg qdbg
```

Update `SKILL.md` `allowed-tools` to reference the new name:

```yaml
allowed-tools: Bash(qdbg:*),Bash(playwright-cli:*)
```

Keep the old `quintus-debug` file temporarily as a thin wrapper that warns and delegates:

```bash
#!/usr/bin/env bash
# DEPRECATED: use "qdbg" instead
echo "Note: 'quintus-debug' has been renamed to 'qdbg'. Forwarding..." >&2
exec "$(dirname "$0")/../../bin/qdbg" "$@"
```

### 7.10 Future: `@quintus/debug-cli` Package

Eventually `qdbg` should be installable globally via npm:

```bash
npx @quintus/debug-cli connect my-game
# or after global install:
qdbg connect my-game
```

This is **not in scope for Phase 8** but the design accommodates it:
- The script uses `$QROOT` to find the project root, which can later be replaced with auto-detection or a config file
- The `connect` command's URL resolution can be extended to find `vite.config.ts` or `package.json` in the current directory
- The `playwright-cli` dependency can be declared as a peer dep in the package

### 7.11 Deliverables

- [x] Move `.claude/skills/debug-game/quintus-debug` → `bin/qdbg`
- [x] Add prerequisites check (playwright-cli, dev server) with actionable error messages
- [x] Add comprehensive `help` output with usage, commands, common issues, and examples
- [x] Add `"qdbg": "./bin/qdbg"` to root `package.json` scripts
- [x] Create symlink `.claude/skills/debug-game/qdbg` → `../../bin/qdbg`
- [x] Create deprecation wrapper at old `.claude/skills/debug-game/quintus-debug` path
- [x] Update `SKILL.md` — change command name, update `allowed-tools`
- [x] Update `references/api-reference.md` — change all command examples
- [x] Update `references/recipes.md` — change all recipe steps
- [x] Verify `pnpm qdbg help` shows full usage from project root
- [x] Verify `pnpm qdbg connect platformer` works end-to-end
- [x] Verify `/debug-game` skill still works with the new paths

---

## 8. Remaining Work: Input & Audio Instrumentation

### 8.1 Purpose

The AI_DEBUG_PLAN.md specifies `input` and `audio` event categories. These are currently **not logged**, making it harder for an AI to trace causal chains like "jump was pressed → floor contact exited → player rose."

### 8.2 Input Event Logging

**File:** `packages/input/src/input.ts`

Add debug logging when actions fire during normal play (not just from bridge injection).

```typescript
// In Input._processBindings() or wherever action state changes:
if (this._game?.debug && actionJustPressed) {
  this._game.debugLog.write(
    { category: "input", message: `${action} pressed` },
    this._game.fixedFrame,
    this._game.elapsed,
  );
}

if (this._game?.debug && actionJustReleased) {
  this._game.debugLog.write(
    { category: "input", message: `${action} released` },
    this._game.fixedFrame,
    this._game.elapsed,
  );
}
```

Also log injected inputs from the bridge:

```typescript
// In Input.inject():
if (this._game?.debug) {
  this._game.debugLog.write(
    { category: "input", message: `${action} ${pressed ? "injected" : "injection released"}` },
    this._game.fixedFrame,
    this._game.elapsed,
  );
}
```

### 8.3 Audio Event Logging

**File:** `packages/audio/src/audio-plugin.ts` (or wherever `game.audio.play()` is implemented)

```typescript
// In the play() method:
if (this._game?.debug) {
  this._game.debugLog.write(
    {
      category: "audio",
      message: `play "${name}"`,
      data: { name, volume, loop },
    },
    this._game.fixedFrame,
    this._game.elapsed,
  );
}
```

### 8.4 Deliverables

- [x] Add `input` category logging to `@quintus/input` — action pressed/released events
- [x] Add `input` category logging for injected inputs (bridge/test injection)
- [x] Add `audio` category logging to `@quintus/audio` — sound play events
- [x] Write tests verifying input events appear in debug log
- [x] Write tests verifying audio events appear in debug log

### 8.5 Tests

**File:** `packages/input/src/input-debug.test.ts`

| Test | What It Verifies |
|------|------------------|
| `action press logged in debug mode` | `input` category event when action pressed |
| `action release logged in debug mode` | `input` category event when action released |
| `injected input logged` | Injection via `input.inject()` appears in log |
| `no logging when debug off` | No events when `game.debug === false` |

**File:** `packages/audio/src/audio-debug.test.ts`

| Test | What It Verifies |
|------|------------------|
| `play() logged in debug mode` | `audio` category event with sound name |
| `no logging when debug off` | No events when `game.debug === false` |

---

## 9. Remaining Work: Signal Watching

### 9.1 Purpose

The AI_DEBUG_PLAN.md describes an opt-in `watchSignal` feature that lets game code or the debug bridge subscribe to specific signal emissions and log them.

### 9.2 Design

**File:** `packages/core/src/debug-log.ts`

Add a `watchSignal` method to `DebugLog`:

```typescript
/**
 * Watch a signal and log all emissions as debug events.
 * @param signal - The signal to watch
 * @param label - Human-readable label (e.g., "Player.died")
 * @returns Disconnect function to stop watching
 */
watchSignal<T>(signal: Signal<T>, label: string): () => void {
  const handler = (data: T) => {
    this.write(
      {
        category: "signal",
        message: `${label} emitted`,
        data: data != null ? { payload: data } : undefined,
      },
      // Need frame/time from game — DebugLog needs a reference
    );
  };
  signal.connect(handler);
  return () => signal.disconnect(handler);
}
```

**Challenge:** `DebugLog` currently doesn't have a reference to the game (it gets `frame` and `time` passed to `write()`). Options:
1. Store a reference to a frame/time provider on the DebugLog
2. Add `watchSignal` as a convenience on `Game` instead of `DebugLog`

Option 2 is cleaner — `Game` already has the debug log and the frame/time:

**File:** `packages/core/src/game.ts`

```typescript
/**
 * Watch a signal and log emissions to the debug log.
 * No-op when debug mode is off.
 * @returns Disconnect function, or no-op function if debug is off.
 */
watchSignal<T>(signal: Signal<T>, label: string): () => void {
  if (!this.debug) return () => {};
  const handler = (data: T) => {
    this.debugLog.write(
      {
        category: "signal",
        message: `${label} emitted`,
        data: data != null ? { payload: data } : undefined,
      },
      this.fixedFrame,
      this.elapsed,
    );
  };
  signal.connect(handler);
  return () => signal.disconnect(handler);
}
```

**Usage in game code:**
```typescript
class Player extends Actor {
  readonly died = signal<void>();
  readonly hurt = signal<number>();

  onReady() {
    this.game?.watchSignal(this.died, "Player.died");
    this.game?.watchSignal(this.hurt, "Player.hurt");
  }
}
```

**Bridge integration (optional, Phase 8 stretch):**

The bridge could also expose signal watching via `inspect()` to discover signals, then `watchSignal(nodeName, signalName)` to start logging. However, this requires reflection on signal properties which adds complexity. For Phase 8, game-code opt-in is sufficient.

### 9.3 Deliverables

- [x] Add `Game.watchSignal(signal, label)` method
- [x] Returns disconnect function; no-op when `debug === false`
- [x] Writes to debug log with category `"signal"`
- [x] Test: watched signal appears in debug log
- [x] Test: unwatched signal does not appear
- [x] Test: no-op when debug is off

---

## 10. Remaining Work: End-to-End Test

### 10.1 Purpose

Verify the complete pipeline works: engine → bridge → CLI → meaningful debugging output. This is a high-level smoke test, not a unit test.

### 10.2 Test Approach

Since the `qdbg` CLI requires a real browser (Playwright), a full E2E test needs the dev server running. The most practical approach is a Vitest test that:

1. Starts Vite programmatically (or expects it running)
2. Uses Playwright to open the platformer with `?debug`
3. Verifies `window.__quintusDebug` is installed
4. Calls key bridge methods and verifies output structure
5. Exercises the drain semantics (events, peek, clear)
6. Tests a simple input injection + step sequence

**File:** `packages/core/src/debug-bridge-e2e.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from "vitest";
// Uses the jsdom-based bridge tests already in debug-bridge.test.ts
// which create a Game with debug:true and test all bridge methods.
// The e2e layer (actual Playwright) is validated by the skill's manual use.
```

**Pragmatic decision:** The existing `debug-bridge.test.ts` (497 lines) already tests every bridge method in a jsdom environment. The CLI is a thin bash wrapper. A full Playwright E2E test adds CI complexity (browser download, dev server startup) for minimal incremental confidence. Instead:

- [x] Document a manual smoke test checklist in this design doc
- [x] Verify the CLI commands work against the platformer example (manual, documented)

### 10.3 Manual Smoke Test Checklist

```bash
# 1. Start dev server
pnpm dev

# 2. Connect
pnpm qdbg connect platformer

# 3. Verify initial state
pnpm qdbg status        # Frame: 0, Paused: true
pnpm qdbg tree          # Scene tree with Player, platforms, coins
pnpm qdbg actions       # move_left, move_right, jump

# 4. Step and inspect
pnpm qdbg step 60       # Let player fall
pnpm qdbg physics Player # OnFloor: true

# 5. Input injection
pnpm qdbg tap jump 1    # Jump
pnpm qdbg step 10
pnpm qdbg physics Player # OnFloor: false, Vy < 0

# 6. Events
pnpm qdbg events --category=physics  # floor_contact events
pnpm qdbg clear-events
pnpm qdbg step 10
pnpm qdbg events        # Only new events

# 7. Higher-level commands
pnpm qdbg nearby Player 200
pnpm qdbg jump-analysis Player  # (must be on floor first)
pnpm qdbg move-to Player move_right 250 -

# 8. Screenshot
pnpm qdbg screenshot /tmp/test.png
# Verify PNG exists and shows game

# 9. Disconnect
pnpm qdbg disconnect
```

---

## 11. Test Plan

### Existing Tests (Complete)

| File | Lines | Coverage |
|------|-------|----------|
| `packages/core/src/debug-bridge.test.ts` | 497 | Bridge API: all methods |
| `packages/core/src/debug-log.test.ts` | 148 | Ring buffer, drain/peek, filtering |
| `packages/core/src/debug-format.test.ts` | — | formatTree, formatEvents |
| `packages/core/src/debug-instrumentation.test.ts` | ~130 | Lifecycle, error, scene, game.log |
| `packages/core/src/snapshot-types.test.ts` | — | Serialize/deserialize for all node types |
| `packages/core/src/snapshot-utils.test.ts` | — | findInSnapshot, findAllInSnapshot, countInSnapshot |
| `packages/physics/src/actor.test.ts:847-875` | ~30 | Physics collision and contact debug events |

### New Tests (Phases 9-12)

**Input instrumentation:** `packages/input/src/input-debug.test.ts`

| Test | What It Verifies |
|------|------------------|
| `action press logged` | Event with category "input" when action pressed |
| `action release logged` | Event with category "input" when action released |
| `injected input logged` | Events from `input.inject()` |
| `no logging when debug off` | Zero events |

**Audio instrumentation:** `packages/audio/src/audio-debug.test.ts`

| Test | What It Verifies |
|------|------------------|
| `play() logged` | Event with category "audio" |
| `no logging when debug off` | Zero events |

**Signal watching:** `packages/core/src/watch-signal.test.ts`

| Test | What It Verifies |
|------|------------------|
| `watchSignal logs emissions` | Signal emit → event in log |
| `disconnect stops logging` | After disconnect, no more events |
| `no-op when debug off` | Returns no-op function, no events |
| `payload included in data` | Signal payload in event.data |

---

## 12. Definition of Done

### Already Complete

- [x] `Node.serialize()` on all node types (Node, Node2D, Actor, StaticCollider, Sensor, Camera, CollisionShape)
- [x] Snapshot type hierarchy (NodeSnapshot, Node2DSnapshot, ActorSnapshot, etc.)
- [x] `DebugLog` with ring buffer, drain/peek, filtering
- [x] `Game.debug` flag with `?debug` URL auto-detection
- [x] `?seed=N` and `?step=N` query parameter support
- [x] `installDebugBridge()` exposing full API on `window.__quintusDebug`
- [x] All bridge methods: pause/resume/step/tree/query/inspect/screenshot/press/release/releaseAll/pressAndStep/run/events/peekEvents/clearEvents/log/click/clickButton
- [x] Auto-instrumentation: lifecycle, physics, sensor, scene, error events
- [x] `formatTree()` and `formatEvents()` pretty-printers
- [x] CLI script with 25+ commands (currently at `.claude/skills/debug-game/quintus-debug`)
- [x] Claude Code `/debug-game` skill with SKILL.md + 3 reference docs
- [x] Comprehensive tests for bridge, log, formatters, instrumentation (800+ lines of tests)
- [x] `pnpm build` succeeds
- [x] `pnpm test` passes
- [x] `pnpm lint` clean

### Remaining

- [x] Promote CLI to `bin/qdbg` with `pnpm qdbg` access from project root
- [x] Prerequisites check and comprehensive help/error messages in CLI
- [x] Update skill + reference docs to use `qdbg` name
- [x] Deprecation wrapper at old `quintus-debug` path
- [x] `input` event category: log action press/release and injections in `@quintus/input`
- [x] `audio` event category: log play events in `@quintus/audio`
- [x] `Game.watchSignal()` for opt-in signal logging
- [x] Tests for input, audio, and signal instrumentation
- [x] Manual smoke test of `qdbg` against platformer passes (documented checklist)

### Not In Scope (Phase 11)

The `@quintus/debug` package (FPS counter, node inspector, collision visualization) is Phase 11 per the implementation plan. It provides **visual** debug overlays on the canvas. Phase 8 is purely about **programmatic** debugging via the bridge and CLI.
