# Quintus 2.0

A modern HTML5 game engine built with TypeScript. Clean-room rewrite of the original Quintus engine, featuring a Godot-inspired node/scene tree architecture designed for the AI era.

## Quick Start

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm dev              # Start dev server on :3050
```

Open `http://localhost:3050` to see the example games.

## Architecture

Quintus uses a **Node/Scene Tree** (not ECS). Every game object is a node in a tree, and nodes inherit behavior through a class hierarchy:

```
Node          Base class — logic, parent/child tree, build() lifecycle
  Node2D      Adds 2D transform (position, rotation, scale)
    Actor           Code-controlled movement + collision via move()
    StaticCollider  Immovable collision geometry (platforms, walls)
    Sensor          Overlap detection only (triggers, pickups)
```

**Signals** provide typed observer-pattern communication between nodes. **Reactive state** (`reactiveState()`) drives HUDs and UI that auto-update when values change.

### JSX Scene Building

Nodes can declaratively compose children using JSX and the `build()` lifecycle:

```tsx
class Player extends Actor {
  sprite!: AnimatedSprite;

  override build() {
    return (
      <>
        <CollisionShape shape={Shape.rect(6, 7)} />
        <AnimatedSprite ref="sprite" spriteSheet={sheet} animation="idle" />
      </>
    );
  }

  onFixedUpdate(dt: number) {
    if (this.game.input.isPressed("right")) this.velocity.x = 200;
    if (this.game.input.isJustPressed("jump") && this.isOnFloor()) {
      this.velocity.y = -400;
    }
    this.move(dt);
  }
}
```

## Packages

Quintus is a pnpm monorepo with 21 packages under `packages/`:

| Package | Purpose |
|---------|---------|
| `@quintus/math` | Vec2, Matrix2D, Color, Rect, AABB, SeededRandom |
| `@quintus/core` | Node, Node2D, Scene, Game, signals, game loop, renderer |
| `@quintus/physics` | Actor, StaticCollider, Sensor, SAT collision, spatial hash, scene queries |
| `@quintus/sprites` | Sprite, AnimatedSprite, SpriteSheet, TextureAtlas |
| `@quintus/tilemap` | TileMap, Tiled JSON/TMX/TSX import, tile collision, DDA raycast |
| `@quintus/input` | Input actions, keyboard, mouse, touch, gamepad |
| `@quintus/audio` | AudioPlayer, Web Audio API, bus routing (music/sfx/ui) |
| `@quintus/ui` | Label, Button, Container, ProgressBar, Panel, Layer |
| `@quintus/tween` | Tween builder, 16 easing functions, sequential/parallel groups |
| `@quintus/camera` | Camera follow, shake, zoom, bounds, dead zone |
| `@quintus/jsx` | JSX runtime for the `build()` lifecycle |
| `@quintus/headless` | HeadlessGame for Node.js (no browser needed) |
| `@quintus/test` | TestRunner, InputScript DSL, assertions, deterministic replay |
| `@quintus/snapshot` | State snapshots and diffing |
| `quintus` | Meta-package re-exporting everything |

## Example Games

| Example | Description |
|---------|-------------|
| `examples/platformer/` | 2-level platformer with enemies, double jump, health, HUD, audio |
| `examples/platformer-tsx/` | Same platformer rewritten with JSX `build()` |
| `examples/dungeon/` | Multi-level crawler with equipment, combat, enemies (69 tests) |
| `examples/breakout/` | 3-level breakout with power-ups and sound effects |
| `examples/advanced-platformer/` | 3-level flagship: slopes, enemies, breakable blocks, parallax (105 tests) |
| `examples/bouncing-balls/` | Minimal physics demo |
| `examples/tilemap/` | Scrolling tilemap with camera |
| `examples/tween-ui/` | Tween animations with UI controls |

## Scene Queries

The physics world provides spatial queries for gameplay logic:

```typescript
// Raycast
const hit = this.raycast(direction, 200);

// Area queries
world.queryRect(rect, { excludeTags: ["player"] });
world.queryCircle(center, radius);

// Actor helpers
this.isEdgeAhead();
this.hasLineOfSight(target);
this.findNearest("enemy");
```

## Testing

```bash
pnpm test             # Run all 1726+ tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # With coverage report
```

Tests are co-located with source (`src/foo.ts` -> `src/foo.test.ts`). Example game tests live in `examples/<game>/__tests__/`.

The engine supports **deterministic testing** via `@quintus/headless` and `@quintus/test` -- seeded RNG, fixed timestep, input script replay, and snapshot diffing.

---

## Debug Bridge (Browser DevTools)

Quintus has a built-in debug bridge that exposes the full engine state to the browser console. This is the fastest way to inspect what's happening in a running game.

### Enabling Debug Mode

Add `?debug` to any game URL:

```
http://localhost:3050/platformer/?debug
```

This does two things:
1. Pauses the game at frame 0 (so you can inspect initial state)
2. Installs the debug bridge on `window`

The bridge is also enabled when `debug: true` is passed to `Game` options.

### Console Globals

When debug mode is active, three globals are available in the browser console:

| Global | Type | Description |
|--------|------|-------------|
| `__quintusDebug` | `DebugBridge` | The main debug API (33 methods) |
| `__quintusFormatters` | `DebugFormatters` | Pretty-print helpers for console output |
| `__quintusGame` | `Game` | Direct access to the Game instance |

### Quick Console Recipes

Open your browser DevTools console and try these:

#### Display the Scene Tree

```js
// Get the formatted ASCII tree
console.log(__quintusFormatters.formatTree(__quintusDebug.tree()))
```

Output:
```
[1] Scene "Level1"
├── [2] TileMap "map" (0, 0)
├── [3] Player "player" (100, 200) vel=(0,0) onFloor
│   ├── [4] CollisionShape rect(6, 7)
│   └── [5] AnimatedSprite "sprite"
├── [6] Enemy "goblin" (300, 200) vel=(-30,0) [enemy]
└── [7] Camera "cam" zoom=1 follow=player
```

#### Inspect a Specific Node

```js
// By name
__quintusDebug.inspect("Player")

// By node ID
__quintusDebug.inspect(3)
```

Returns a full JSON snapshot with position, velocity, tags, children, and physics state.

#### View Physics State

```js
console.log(__quintusFormatters.formatPhysics(__quintusDebug.inspect("Player")))
```

#### Find Nodes

```js
// By type, name, or tag
__quintusDebug.query("Enemy")
__quintusDebug.query("coin")

// Format results
console.log(__quintusFormatters.formatQueryResults(__quintusDebug.query("Enemy"), "Enemy"))
```

#### Step Through Frames

```js
__quintusDebug.step()      // Advance 1 frame
__quintusDebug.step(30)    // Advance 30 frames
__quintusDebug.resume()    // Resume real-time playback
__quintusDebug.pause()     // Pause again
```

#### Simulate Input

```js
// Press and hold (persists until release!)
__quintusDebug.press("move_right")
__quintusDebug.step(60)    // Hold for 60 frames
__quintusDebug.release("move_right")

// Press for N frames then auto-release
__quintusDebug.pressAndStep("jump", 1)

// Release everything
__quintusDebug.releaseAll()

// See available actions
__quintusDebug.listActions()
```

#### Track Movement Over Time

```js
// Record position/velocity for 60 frames
const data = __quintusDebug.track("Player", 60)
console.log(__quintusFormatters.formatTrack(data))
```

#### Analyze a Jump

```js
const result = __quintusDebug.jumpAnalysis("Player")
console.log(__quintusFormatters.formatJumpAnalysis(result, "Player"))
```

#### View Debug Events

```js
// Drain events (subsequent calls return only new ones)
console.log(__quintusFormatters.formatEvents(__quintusDebug.events()))

// Filter by category
console.log(__quintusFormatters.formatEvents(
  __quintusDebug.events({ category: "physics" })
))

// Peek without draining
__quintusDebug.peekEvents()

// Reset
__quintusDebug.clearEvents()
```

#### Find Nearby Nodes

```js
const result = __quintusDebug.nearby("Player", 150)
console.log(__quintusFormatters.formatNearby(result))
```

#### Switch Scenes

```js
__quintusDebug.listScenes()        // ["title", "level1", "gameOver"]
__quintusDebug.switchScene("level1")
```

#### Remove Nodes for Isolation Testing

```js
// Destroy by name, type, or tag
__quintusDebug.destroy("goblin")   // Remove specific node
__quintusDebug.destroy("enemy")    // Remove all nodes tagged "enemy"
```

#### Take a Screenshot

```js
// Returns a data URL (PNG)
const url = __quintusDebug.screenshot()

// Open in new tab
window.open(url)
```

#### Run a Scripted Sequence

```js
__quintusDebug.run([
  { press: "move_right", frames: 30 },
  { wait: 5 },
  { press: "jump", frames: 1 },
  { wait: 60 },
  { release: "move_right" },
])
```

### Full Debug Bridge API Reference

#### State

| Method | Returns | Description |
|--------|---------|-------------|
| `.paused` | `boolean` | Whether the game is paused |
| `.frame` | `number` | Current physics frame number |
| `.elapsed` | `number` | Elapsed game time in seconds |
| `.pause()` | `void` | Pause the game loop |
| `.resume()` | `void` | Resume the game loop |

#### Scene Tree

| Method | Returns | Description |
|--------|---------|-------------|
| `.tree()` | `NodeSnapshot` | Serialized snapshot of the entire scene tree |
| `.inspect(nameOrId)` | `NodeSnapshot` | Full snapshot of one node |
| `.query(q)` | `NodeSnapshot[]` | Find nodes by type, name, or tag |
| `.listScenes()` | `string[]` | Registered scene names |
| `.switchScene(name)` | `void` | Switch to a different scene |
| `.destroy(nameOrId)` | `number` | Remove node(s), returns count destroyed |

#### Simulation

| Method | Returns | Description |
|--------|---------|-------------|
| `.step(n?)` | `NodeSnapshot` | Advance N frames (default: 1) |
| `.run(script)` | `NodeSnapshot[]` | Execute a `DebugAction[]` sequence |
| `.screenshot()` | `string` | Canvas as PNG data URL |

#### Input

| Method | Returns | Description |
|--------|---------|-------------|
| `.listActions()` | `string[]` | Available input action names |
| `.press(action)` | `void` | Hold an action (persists until released) |
| `.release(action)` | `void` | Release a held action |
| `.releaseAll()` | `void` | Release all held actions |
| `.pressAndStep(action, n)` | `NodeSnapshot` | Press for N frames then release |
| `.click(x, y)` | `boolean` | Pointer click at game coordinates |
| `.clickButton(nameOrText)` | `boolean` | Click UI button by name or label |
| `.setMousePosition(x, y)` | `void` | Set pointer position |
| `.getMousePosition()` | `{x, y}` | Get pointer position |

#### Events

| Method | Returns | Description |
|--------|---------|-------------|
| `.events(filter?)` | `DebugEvent[]` | Drain events since last call |
| `.peekEvents(filter?)` | `DebugEvent[]` | Read events without draining |
| `.clearEvents()` | `void` | Reset event buffer |
| `.log(cat, msg, data?)` | `void` | Write a custom debug event |

#### Analysis

| Method | Returns | Description |
|--------|---------|-------------|
| `.track(target, n?)` | `TrackResult` | Record position/velocity over N frames |
| `.jumpAnalysis(target)` | `JumpAnalysisResult` | Measure full jump arc |
| `.moveTo(options)` | `MoveToResult` | Hold actions until node reaches threshold |
| `.nearby(target, radius?)` | `NearbyResult` | Find nodes within radius |

### Formatter Reference

All formatters live on `window.__quintusFormatters`:

| Formatter | Input | Description |
|-----------|-------|-------------|
| `formatTree(snapshot)` | `NodeSnapshot` | ASCII tree with IDs, types, positions, physics |
| `formatEvents(events)` | `DebugEvent[]` | Tabular event log |
| `formatLayout(snapshot)` | `NodeSnapshot` | Spatial overview (nodes with positions only) |
| `formatPhysics(snapshot)` | `NodeSnapshot` | Detailed physics state |
| `formatQueryResults(results, q)` | `NodeSnapshot[]` | Compact one-liners |
| `formatTrack(result)` | `TrackResult` | Tabular position/velocity history |
| `formatJumpAnalysis(result, name)` | `JumpAnalysisResult` | Jump metrics |
| `formatNearby(result)` | `NearbyResult` | Nearby nodes with distances |

---

## qdbg -- CLI Game Debugger

`qdbg` wraps the debug bridge with a terminal-friendly CLI using Playwright for browser automation. It's the primary tool for debugging Quintus games from the command line.

```bash
# Connect to a game (starts dev server if needed, opens browser paused at frame 0)
pnpm qdbg connect platformer

# Inspect
pnpm qdbg tree                          # ASCII scene tree
pnpm qdbg inspect Player                # Full node snapshot
pnpm qdbg physics Player                # Physics state summary
pnpm qdbg nearby Player 150             # What's around the player

# Simulate input
pnpm qdbg tap jump 1                    # Press jump for 1 frame
pnpm qdbg step 30                       # Advance 30 frames
pnpm qdbg move-to Player move_right 250 -  # Walk until x >= 250

# Observe
pnpm qdbg events --category=physics     # View collision events
pnpm qdbg screenshot                    # Save canvas PNG

# Cleanup
pnpm qdbg disconnect
```

See `CLAUDE.md` for the full qdbg command reference.

---

## Toolchain

| Tool | Purpose |
|------|---------|
| pnpm | Package manager + workspace |
| TypeScript | `strict: true`, no `any`, ES2022 target |
| tsup | Build (ESM + CJS + `.d.ts`) |
| Vitest | Testing (1726+ tests) |
| Biome | Linting + formatting |
| Vite | Dev server for examples |
| Playwright | Browser automation (qdbg) |

## Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # With coverage
pnpm lint             # Check with Biome
pnpm lint:fix         # Auto-fix
pnpm dev              # Dev server on :3050
pnpm clean            # Remove dist/ dirs
pnpm qdbg <cmd>       # CLI debugger
```

## License

See individual package directories for license information.
