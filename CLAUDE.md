# Quintus 2.0

Complete rewrite of the Quintus HTML5 game engine for the AI/LLM era.

## Project Status

**Phases 0–8 complete. Phase 9 in progress.** The engine has a full node/scene tree, physics, sprites, input, audio, UI, tweens, camera, tilemaps, JSX scene building, deterministic testing infrastructure, and a Playwright-based CLI debugger (qdbg). Three complete example games ship: a platformer, a dungeon crawler, and a breakout clone.

## Architecture

Godot-inspired **Node/Scene Tree** (NOT ECS) with TypeScript. The key abstraction chain:

```
Node → Node2D → Actor / StaticCollider / Sensor
```

- `Node` — base class, pure logic, parent/child tree, `build()` lifecycle for JSX
- `Node2D` — adds 2D transform (position, rotation, scale) with cascade, ySortChildren
- `Actor` — code-controlled movement + collision response via `move()`, query helpers
- `StaticCollider` — immovable collision (platforms, walls), one-way support
- `Sensor` — overlap detection only (triggers, pickups)
- `Signal<T>` — typed observer pattern for decoupled communication
- `reactiveState()` — Proxy-based reactive state with per-key change signals

## Monorepo Layout

pnpm workspace. 21 packages under `packages/`:

| Package | npm Name | Purpose | Status |
|---------|----------|---------|--------|
| `math` | `@quintus/math` | Vec2, Matrix2D, Color, Rect, AABB, SeededRandom | Done |
| `core` | `@quintus/core` | Node, Node2D, Scene, Game, signals, game loop, renderer | Done |
| `physics` | `@quintus/physics` | Actor, StaticCollider, Sensor, CollisionShape, SAT, spatial hash, scene queries | Done |
| `sprites` | `@quintus/sprites` | Sprite, AnimatedSprite, SpriteSheet, TextureAtlas XML parser | Done |
| `tilemap` | `@quintus/tilemap` | TileMap, Tiled JSON/TMX/TSX import, tile collision, DDA raycast | Done |
| `input` | `@quintus/input` | Input actions, keyboard, mouse, touch, gamepad, deterministic inject | Done |
| `audio` | `@quintus/audio` | AudioPlayer, Web Audio API, bus routing (music/sfx/ui) | Done |
| `ui` | `@quintus/ui` | Label, Button, Container, ProgressBar, Panel, Layer | Done |
| `tween` | `@quintus/tween` | Tween builder, 16 easing functions, sequential/parallel groups | Done |
| `camera` | `@quintus/camera` | Camera follow, shake, zoom, bounds, dead zone | Done |
| `jsx` | `@quintus/jsx` | JSX runtime, `build()` lifecycle, refs (string/callback/dollar) | Done |
| `headless` | `@quintus/headless` | HeadlessGame, runFor/runUntil, Node.js runtime | Done |
| `test` | `@quintus/test` | TestRunner, InputScript DSL, assertions, assertDeterministic | Done |
| `snapshot` | `@quintus/snapshot` | StateSnapshot, captureState, diffSnapshots | Done |
| `quintus` | `quintus` | Meta-package re-exporting all engine packages | Done |
| `quintus-core` | `@quintus/quintus-core` | (placeholder) | — |
| `mcp` | `@quintus/mcp` | (placeholder) | — |
| `particles` | `@quintus/particles` | ParticleEmitter | — |
| `three` | `@quintus/three` | Three.js integration | — |
| `debug` | `@quintus/debug` | FPS counter, collision viz, inspector | — |
| `ai-prefabs` | `@quintus/ai-prefabs` | Pre-built game components | — |

## JSX / `build()` Pattern

Nodes can declaratively compose their children using JSX and the `build()` lifecycle method. This runs when a node enters the scene tree, before `onReady()`.

```tsx
// tsconfig.json: "jsx": "react-jsx", "jsxImportSource": "@quintus/jsx"

class Player extends Actor {
  sprite!: AnimatedSprite;  // assigned by string ref

  override build() {
    return (
      <>
        <CollisionShape shape={Shape.rect(6, 7)} />
        <AnimatedSprite ref="sprite" spriteSheet={sheet} animation="idle" />
      </>
    );
  }
}
```

**Three ref systems:**
- **String refs** — `ref="sprite"` assigns the node to `this.sprite` on the build owner
- **Callback refs** — `ref={node => ...}` for custom logic
- **Dollar refs** — `"$player"` for order-independent cross-node references

**Prop coercion:** tuples → Vec2, hex strings → Color, numbers → uniform scale, functions → Signal connections.

## qdbg — CLI Game Debugger

`bin/qdbg` is the **primary tool for debugging Quintus games at runtime**. It wraps `playwright-cli` with 30+ ergonomic commands that talk to the engine's debug bridge. **Always use `pnpm qdbg <command>` — never fall back to raw `playwright-cli` calls or `eval` with hand-written JS when a dedicated qdbg command exists.**

### How to Debug a Game

```bash
# 1. Connect (starts dev server if needed, opens browser paused at frame 0)
pnpm qdbg connect platformer

# 2. Inspect the scene
pnpm qdbg tree                          # ASCII scene tree
pnpm qdbg physics Player                # physics state of one node
pnpm qdbg nearby Player 150             # what's around the player

# 3. Simulate input and advance time
pnpm qdbg tap jump 1                    # press jump for 1 frame
pnpm qdbg step 30                       # advance 30 frames
pnpm qdbg move-to Player move_right 250 -  # walk until x≥250

# 4. Observe results
pnpm qdbg physics Player                # check landing
pnpm qdbg events --category=physics     # see collision events
pnpm qdbg screenshot                    # capture canvas

# 5. Cleanup
pnpm qdbg disconnect
```

### Command Reference

| Category | Command | Purpose |
|----------|---------|---------|
| **Connect** | `connect [demo\|url]` | Open game in browser, paused at first frame |
| | `disconnect` | Close browser session |
| **Inspect** | `tree` | Formatted ASCII scene tree |
| | `layout` | Spatial overview with physics info |
| | `inspect <name\|id>` | Full JSON snapshot of one node |
| | `query <type\|name\|tag>` | Find matching nodes |
| | `physics <name>` | Physics summary (pos, vel, gravity, contacts) |
| | `nearby <name> [radius]` | Nodes within radius, sorted by distance |
| **Scene** | `scenes` | List registered scene names |
| | `scene <name>` | Switch to a different scene |
| | `destroy <name\|id\|type\|tag>` | Remove node(s) from the scene |
| **Time** | `step [N]` | Advance N frames (default: 1) |
| | `pause` / `resume` | Pause or resume real-time loop |
| | `status` | Show frame, elapsed time, paused state |
| **Input** | `actions` | List available input actions |
| | `press <action>` | Press and hold (persists until release) |
| | `release <action>` | Release a held action |
| | `release-all` | Release all held actions |
| | `tap <action> [N]` | Press for N frames then release |
| | `click <x> <y>` | Pointer click at game coordinates |
| | `click-button <name\|text>` | Click a UI button by name or label |
| | `mouse <x> <y>` | Set the mouse/pointer position |
| | `mouse-get` | Get current mouse/pointer position |
| **Movement** | `move-to <node> <actions> <x> <y> [--max=N]` | Hold action(s) until node reaches threshold |
| **Analysis** | `track <name> [N]` | Tabular position/velocity over N frames |
| | `jump-analysis <name>` | Full jump arc metrics |
| **Script** | `run '<json>'` | Execute a DebugAction[] sequence |
| | `eval '<code>'` | Evaluate JS expression (last resort) |
| **Events** | `events [--category= --search= --limit=]` | Drain events since last call |
| | `peek [flags]` | View events without draining |
| | `clear-events` | Reset event log |
| **Capture** | `screenshot [file]` | Save canvas to PNG |

### Critical Rules for Debugging

1. **Use qdbg commands, not raw JS.** Every common operation has a dedicated command. `eval` is a last resort for one-off queries not covered by the command set.
2. **`connect` first.** Every other command requires an active debug session.
3. **Input persists.** `press` stays held until `release` or `release-all`. Forgetting to release causes actions to persist across steps.
4. **`jump` uses `isJustPressed`.** Don't use `move-to Player jump ...` — it only fires frame 1. Instead: `tap jump 1` then `move-to` for drift.
5. **`destroy` for isolation.** Remove enemies, spawners, or hazards to test one system at a time: `destroy enemy` removes all nodes tagged "enemy".
6. **Positions are center-based.** A platform at (200, 280) with rect 400×20 has its top edge at y=270.
7. **`events` drains.** Subsequent calls only return new events. Use `peek` to re-read, or `clear-events` to reset.
8. **Use the `/debug-game` skill** when asked to debug a game. It loads the full qdbg reference and recipes.

## Scene Query API

PhysicsWorld provides spatial queries with composable QueryOptions filtering:

- `raycast()` / `raycastAll()` — line intersection tests
- `queryPoint()` / `queryRect()` / `queryCircle()` / `queryShape()` — area queries
- `shapeCast()` — swept shape tests
- `TileMap` DDA grid raycast for fast tile-level line-of-sight

Actor convenience methods: `raycast()`, `isEdgeAhead()`, `hasLineOfSight()`, `findNearest()`.

## Toolchain

| Tool | Purpose |
|------|---------|
| pnpm | Package manager + workspace |
| TypeScript | `strict: true`, no `any`, `target: ES2022` |
| tsup | Build (ESM + CJS + `.d.ts` per package) |
| Vitest | Testing (jsdom env, 1726 tests, 95%+ coverage) |
| Biome | Linting + formatting (replaces ESLint + Prettier) |
| Vite | Dev server for examples (port 3050) |
| TypeDoc | API documentation |
| Playwright | Browser automation (qdbg debugger, `/debug-game` skill) |

## Build & Test Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages (dependency-ordered)
pnpm test             # Run all tests (1726 tests)
pnpm test:watch       # Watch mode
pnpm test:coverage    # Tests with coverage
pnpm lint             # Biome check
pnpm lint:fix         # Biome auto-fix
pnpm dev              # Vite dev server (examples on :3050)
pnpm docs             # TypeDoc generation
pnpm clean            # Remove all dist/ directories
pnpm qdbg <cmd>       # CLI game debugger (see qdbg section)
```

## Example Games

| Example | Path | Description | Status |
|---------|------|-------------|--------|
| Platformer | `examples/platformer/` | 2-level game with enemies, double jump, health, HUD, audio, pixel art | Done |
| Platformer TSX | `examples/platformer-tsx/` | Same platformer rewritten with JSX `build()` pattern | Done |
| Dungeon | `examples/dungeon/` | Multi-level crawler with equipment, combat, enemies, HUD, 69 tests | Done |
| Breakout | `examples/breakout/` | 3-level game with power-ups, sound effects, 6 test files | Done |
| Basic Platformer | `examples/basic_platformer/` | Simple reference demo (Phase 2 snapshot) | Done |
| Bouncing Balls | `examples/bouncing-balls/` | Minimal physics demo | Done |
| Tilemap | `examples/tilemap/` | Scrolling tilemap with camera | Done |
| Tween UI | `examples/tween-ui/` | Tween animations with UI controls | Done |
| Space Shooter | `examples/space-shooter/` | (placeholder) | — |
| Tower Defense | `examples/tower-defense/` | (placeholder) | — |
| Sokoban | `examples/sokoban/` | (placeholder) | — |
| Bullet Hell | `examples/bullet-hell/` | (placeholder) | — |

## Claude Code Skills

Custom skills in `.claude/skills/` for development workflows:

| Skill | Purpose |
|-------|---------|
| `/asks` | Log the current ask to ASKS.md |
| `/debug-game` | Interactive game debugging via qdbg |
| `/design` | Create a design document for a phase or feature |
| `/devil` | Devil's advocate review of a design document |
| `/doc` | Generate a manual testing walkthrough |
| `/implement` | Implement a phase from its design document |
| `/milestone` | Create a milestone commit with changelog entry |
| `/playwright-cli` | Browser automation for testing and screenshots |

## Design Documents

Steering docs live in `steering/`. Key documents:

| Document | Contents |
|----------|----------|
| `MODERNIZATION_RESEARCH.md` | Landscape analysis, gap identification, initial proposal |
| `GODOT_INSPIRED_ARCHITECTURE.md` | Node/Scene Tree, physics bodies, signals, API design |
| `AI_INTEGRATION_ARCHITECTURE.md` | Deterministic sim, debug CLI, headless runtime, AI testing |
| `IMPLEMENTATION_PLAN.md` | 12 phases, full dependency graph |
| `REACT_BUILD_PATTERN.md` | JSX `build()` design — refs, coercion, types |
| `QUERY_API.md` | Scene query API — raycast, area queries, shape cast |
| `PHASE_*_DESIGN.md` | Per-phase design documents (0–10) |
| `CODE_SMELLS.md` | API ergonomics overhaul (9 phases, all done) |

## Guiding Principles

1. **Clean-room rewrite** — `old/` is reference only. Zero code carries forward.
2. **TypeScript-strict from day one** — `strict: true`, no `any` escape hatches.
3. **Test-first** — Every module ships with Vitest tests. Target >90% coverage.
4. **Working software at each phase** — Each phase ends with a runnable demo.
5. **Tiny by default** — Core under 15KB gzipped. Full meta-package under 40KB.
6. **LLM-first API** — Predictable, typed, declarative. If an LLM can't guess the API, redesign it.
7. **Deterministic** — Seeded RNG, fixed timestep, serializable state.

## Code Conventions

- Tests live alongside source: `src/foo.ts` → `src/foo.test.ts`
- Example game tests go in `examples/<game>/__tests__/`
- Biome config: tabs, double quotes, semicolons, 100-char line width
- `noExplicitAny: error` — enforced by Biome
- `verbatimModuleSyntax: true` — explicit `type` imports required
- All packages export from `src/index.ts`
- Package build outputs: `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts`
- JSX files use `.tsx` extension with `jsxImportSource: "@quintus/jsx"`
- Ref-bound properties use definite assignment (`sprite!: AnimatedSprite`)

## The `old/` Directory

Contains the original Quintus 1.0 source (jQuery-era JavaScript). Useful as a reference for what features existed and how the API felt, but **never import, build, test, or lint code from `old/`**. It will be removed once the rewrite is complete.

## Key API Patterns

### Class-based with imperative setup

```typescript
class Player extends Actor {
  speed = 200;
  jumpForce = -400;

  onFixedUpdate(dt: number) {
    if (this.game.input.isPressed('right')) this.velocity.x = this.speed;
    if (this.game.input.isJustPressed('jump') && this.isOnFloor()) {
      this.velocity.y = this.jumpForce;
    }
    this.move(dt);
  }
}
```

### JSX `build()` for declarative composition

```tsx
class Coin extends Sensor {
  readonly collected = signal<void>();
  sprite!: AnimatedSprite;

  override build() {
    return (
      <>
        <CollisionShape shape={Shape.circle(4)} />
        <AnimatedSprite ref="sprite" spriteSheet={sheet} animation="spin" />
      </>
    );
  }

  onReady() {
    this.tag('coin');
    this.entered.connect((other) => {
      if (other.is(Actor) && other.hasTag('player')) {
        this.collected.emit();
        this.destroy();
      }
    });
  }
}
```

### Scene with registry

```typescript
class Level1 extends Scene {
  onReady() {
    const map = this.add(TileMap);
    map.asset = 'level1.tmx';

    const player = this.add(Player);
    player.position = new Vec2(100, 400);
  }
}

// Register scenes by name to avoid circular imports
game.registerScenes({ title: TitleScene, level1: Level1, gameOver: GameOverScene });
game.start('title');
```

### Reactive state for HUDs

```typescript
const gameState = reactiveState({ score: 0, lives: 3, health: 100 });

// In HUD — auto-updates when state changes
gameState.onChange('score', (val) => { scoreLabel.text = `Score: ${val}`; });
```

## Implementation Phases

| Phase | What | Status |
|-------|------|--------|
| 0 | Project bootstrap (monorepo, tooling) | Done |
| 1 | Core engine (Node, Node2D, math, signals, game loop) | Done |
| 2 | Physics (Actor, StaticCollider, Sensor, SAT, move, scene queries) | Done |
| 3 | Sprites & Input (AnimatedSprite, action map, gamepad) | Done |
| 4 | Tilemap & Camera (Tiled TMX import, follow, shake, zoom) | Done |
| 5 | Audio, Tween, UI (sounds, animations, HUD widgets) | Done |
| 6 | Meta-package & first complete platformer game | Done |
| 7 | Deterministic testing (headless, input scripts, snapshots) | Done |
| 8 | Debug CLI & AI Skills (qdbg, debug bridge, Playwright) | Done |
| 9 | AI prefabs & example games (breakout done, more in progress) | In Progress |
| 10 | Three.js integration | — |
| 11 | Particles & debug tools | — |
| 12 | DX polish (create-quintus, docs site, WebGL2) | — |
