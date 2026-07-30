# Quintus 2.0

Complete rewrite of the Quintus HTML5 game engine for the AI/LLM era.

## Project Status

**Phases 0–8 complete. Phase 9 in progress.** The engine has a full node/scene tree, physics, sprites, input, audio, UI, tweens, camera, tilemaps, JSX scene building, deterministic testing infrastructure, and a Playwright-based CLI debugger (qdbg). Three complete example games ship: a platformer, a dungeon crawler, and a breakout clone.

**Packaging & release (per `steering/20260702_PACKAGING_DESIGN.md`, all phases Done):** the engine is now publishable. Exactly **two** packages ship to npm — **`quintus2`** (the whole engine, bundled into one `dist`) and **`create-quintus2`** (the project scaffolder, `npm create quintus2@latest my-game`). The 21 `@quintus/*` packages are **private internals** inlined into `quintus2`. Releases go through `pnpm release` (CHANGELOG-driven, lockstep versioning starting at `0.0.1`).

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

pnpm workspace, 23 packages under `packages/`. **Only two publish to npm** — `quintus2` (bundled engine) and `create-quintus2` (scaffolder); the other 21 `@quintus/*` are `"private": true` internals bundled into `quintus2`'s `dist`.

| Package | npm Name | Purpose | Status |
|---------|----------|---------|--------|
| `math` | `@quintus/math` | Vec2, Matrix2D, Color, Rect, AABB, SeededRandom | Done |
| `core` | `@quintus/core` | Node, Node2D, Scene, Game, signals, game loop, renderer | Done |
| `physics` | `@quintus/physics` | Actor, StaticCollider, Sensor, CollisionShape, SAT, spatial hash, scene queries | Done |
| `sprites` | `@quintus/sprites` | Sprite, AnimatedSprite, SpriteSheet, TextureAtlas XML parser | Done |
| `tilemap` | `@quintus/tilemap` | TileMap, Tiled JSON/TMX/TSX import, tile collision, DDA raycast | Done |
| `input` | `@quintus/input` | Input actions, keyboard, mouse, touch, gamepad, deterministic inject | Done |
| `touch` | `@quintus/touch` | Mobile touch UI — virtual joysticks, D-pads, buttons, scroll lock | Done |
| `audio` | `@quintus/audio` | AudioPlayer, Web Audio API, bus routing (music/sfx/ui) | Done |
| `ui` | `@quintus/ui` | Label, Button, Container, ProgressBar, Panel, Layer | Done |
| `tween` | `@quintus/tween` | Tween builder, 16 easing functions, sequential/parallel groups | Done |
| `camera` | `@quintus/camera` | Camera follow, shake, zoom, bounds, dead zone | Done |
| `jsx` | `@quintus/jsx` | JSX runtime, `build()` lifecycle, refs (string/callback/dollar) | Done |
| `headless` | `@quintus/headless` | HeadlessGame, runFor/runUntil, Node.js runtime | Done |
| `test` | `@quintus/test` | TestRunner, InputScript DSL, assertions, assertDeterministic | Done |
| `snapshot` | `@quintus/snapshot` | StateSnapshot, captureState, diffSnapshots | Done |
| `quintus2` | `quintus2` | **Published** — bundled engine (`noExternal` inlines all internals into `dist`; subpaths `/jsx-runtime`, `/three`, `/testing`) | Done |
| `create-quintus2` | `create-quintus2` | **Published** — scaffolder for 2D/3D starter projects (`npm create quintus2@latest`) | Done |
| `quintus-core` | `@quintus/quintus-core` | (placeholder) | — |
| `mcp` | `@quintus/mcp` | (placeholder) | — |
| `particles` | `@quintus/particles` | ParticleEmitter | — |
| `three` | `@quintus/three` | Three.js integration | — |
| `debug` | `@quintus/debug` | FPS counter, collision viz, inspector | — |
| `prefabs` | `@quintus/prefabs` | Pre-built game components | — |

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

### Verifying DOM/CSS behavior in a real browser

qdbg drives *games* through the debug bridge. For engine-level DOM behavior — canvas
scaling, layout, element sizing — use `playwright-cli` directly, because **jsdom never lays
out: `clientWidth`/`clientHeight`/`getBoundingClientRect()` are always `0`.** A passing
jsdom test of layout logic verifies arithmetic against values the test itself stubbed; it
is not evidence the layout is correct.

Three gotchas, in the order you'll hit them:

1. **Run `playwright-cli` from the repo root** — elsewhere it misses the CLI config and
   defaults to channel `chrome`, which isn't installed.
2. **`file://` is blocked.** Serve the scratch page: `python3 -m http.server 8791` from the
   scratchpad, then `goto http://localhost:8791/page.html`.
3. **Await layout before reading** — `ResizeObserver` and style writes land after the
   frame; wrap the `eval` in two nested `requestAnimationFrame`s.

Scratch pages go in the scratchpad directory, never in the repo.

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
| Vitest | Testing (jsdom env, 95%+ coverage) — `pnpm test` covers `packages/*` + `scripts/*.test.mjs` only |
| Biome | Linting + formatting (replaces ESLint + Prettier) |
| Vite | Dev server for examples (port 3050) |
| TypeDoc | API documentation |
| Playwright | Browser automation (qdbg debugger, `/debug-game` skill) |

## Build & Test Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages (dependency-ordered)
pnpm test             # Run all tests (fast unit suite; offline)
pnpm test:e2e         # Packaging E2E: pack quintus2 → scaffold → install → build → test → tsc (slow, network; NOT in `pnpm test`)
pnpm test:watch       # Watch mode
pnpm test:coverage    # Tests with coverage
pnpm lint             # Biome check
pnpm lint:fix         # Biome auto-fix
pnpm dev              # Vite dev server (examples on :3050)
pnpm run docs         # TypeDoc generation — NOTE: `pnpm docs` (no `run`) is a pnpm
                      # BUILTIN that opens an npm page and exits 0 without running
                      # the script. Always use `pnpm run docs`.
pnpm build:examples   # Build all examples for static deploy (QUINTUS_BASE=/Quintus2/ for the deploy path)
pnpm clean            # Remove all dist/ directories
pnpm qdbg <cmd>       # CLI game debugger (see qdbg section)
pnpm release          # CHANGELOG-driven lockstep publish of quintus2 + create-quintus2 (see scripts/release.mjs)
```

### What the gates cover — and what they don't

The real gates are `pnpm test`, `pnpm lint`, `pnpm build`, and `pnpm run docs`.
**A command documented here but absent from `.github/workflows/ci.yml` is a claim, not a
gate** — `typedoc.json` sat broken from the Phase 0 bootstrap until Phase 9 for exactly
this reason.

- **`pnpm test` covers `packages/*` and `scripts/*.test.mjs` only.** The 11 example-game
  suites (`examples/*/vitest.config.ts`) are not in it and not in CI. Run one explicitly
  when you touch engine code it exercises:
  `pnpm exec vitest run --config examples/<game>/vitest.config.ts`.
- **No tool typechecks `*.test.ts`.** `pnpm test` typechecks only `*.test-d.ts` (via the
  root `tsconfig.typetest.json`); `pnpm build` emits `.d.ts` from non-test `src`; TypeDoc
  sets `skipErrorChecking`. **Put type-level guarantees in `*.test-d.ts`** — a
  `@ts-expect-error` or `expectTypeOf` anywhere else is not gated. `pnpm test` prints
  `Type Errors: no errors` when they pass.
- **Per-package `tsc` is not a gate.** Don't chase it and don't use it to verify a change.

### Known-red baselines — compare, don't re-derive

Red on `main`. Compare against the number before blaming your diff.

| Check | Baseline |
|---|---|
| `pnpm exec vitest run --config examples/advanced-platformer/vitest.config.ts` | **5 failed / 100 passed** — hard-coded coordinates drifted from the TMX data |
| `npx tsc --noEmit -p tsconfig.json` (root) | **~699 errors**, 574 of them in `*.test.ts` |
| `npx tsc --noEmit -p packages/core/tsconfig.json` | **1 error** — `asset-loader.test.ts:261` |
| `pnpm run docs` | **4 warnings**, all from `@types/three`'s own malformed TSDoc |

Don't cite absolute test counts in docs or design notes — they go stale within a commit.
Report "full suite green" plus the command output instead.

## CI/CD

- `.github/workflows/ci.yml` — lint, test, build, docs on every PR and push to `main`
- `.github/workflows/deploy-examples.yml` — deploys all examples to GitHub Pages on push
  to `main` (<https://cykod.github.io/Quintus2/>), building with `QUINTUS_BASE=/Quintus2/`.
  Manual deploys via `workflow_dispatch`. Repo setting required: Pages source must be
  "GitHub Actions", not "Deploy from a branch".
- `.github/workflows/e2e.yml` — packaging E2E (slow, network)

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
| Advanced Platformer | `examples/advanced-platformer/` | 3-level flagship demo: slopes, enemies, breakable blocks, parallax, HUD, 105 tests | Done |
| Artillery | `examples/artillery/` | Worms-style destructible-terrain artillery: custom `Uint8Array` pixel-mask collision, ballistics, wind, crater carving, scoring, title/results flow | Done |

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

// In HUD — subscribe to the per-key signal; payload is { value, previous }
gameState.on('score').connect(({ value }) => { scoreLabel.text = `Score: ${value}`; });

// `changed` fires for any key
gameState.changed.connect(({ key, value }) => { /* ... */ });

// `reset()` restores creation-time values and emits only for keys that differ.
// The store is a module-level singleton — it survives scene re-entry and game.stop(),
// so reset it on boot and on teardown.
```

Connections are not released for you: `destroy()` disconnects only a node's four
built-in lifecycle signals, so a HUD that connects to `gameState` must keep the
`SignalConnection` and disconnect it in `onDestroy()`.

## Engine API Gotchas

Non-obvious runtime behavior that the type signatures don't convey. Each of these cost a
phase's worth of debugging at least once.

- **`add()` has two overloads with different return types.** `add(NodeClass, props?)`
  returns the new node; `add(nodeInstance)` returns the parent (`this`). A class with
  required constructor args can't use the class overload — construct into a local, `add`
  it, then configure the local.
- **Chain `super.onReady()`** in any `Actor`/`CollisionObject` subclass override. It
  initializes gravity from the world and registers the collision body. Omitting it yields
  an entity that never falls or collides, with no compile error.
- **`switchTo(name)` / `game.start(name)` throw** if the scene isn't registered — there is
  no `hasScene` guard. When an integration phase wires a transition to a scene a later
  phase owns, register a placeholder now.
- **`Vec2` in-place mutation is `_set(x, y)`.** Despite the underscore this is the intended
  public mutator; there is no `set`/`setTo`.
- **A `Camera` at `(0,0)` centers world origin on screen.** For a fixed, non-scrolling
  scene where world pixel (x,y) must map 1:1 to screen, seat the camera at
  `(width/2, height/2)` so the view transform is identity.
- **`destroy()` is deferred but immediately invisible.** Tree and scene queries stop
  returning the node in the same tick; the splice and teardown hooks run at end-of-frame.
  The physics **solver** is deliberately exempt — a body destroyed mid-tick stays solid for
  the rest of that step, so nothing falls through a platform destroyed underneath it.
  `Node.is()` is also exempt: it is a type guard, and narrowing must not depend on
  lifecycle state.
- **Never pair `removeChild()` with `destroy()`.** `removeChild` nulls the parent, so
  `destroy()` can't reach the scene queue and silently skips `destroying`, `onDestroy`,
  child recursion, and signal disconnect. Call `destroy()` alone.
- **Fork the RNG for gameplay** when FX also draw from `game.random` (camera shake,
  particles) — otherwise a visual-only change shifts the deterministic stream.

### Testing conventions

- Headless input uses the `InputScript` DSL, not the qdbg verbs:
  `InputScript.create().press(action, frames)`, `.tap(action)`, `.hold`, `.release`,
  `.wait(frames)`.
- Centralize an example's headless plugin set in `examples/<game>/__tests__/helpers.ts`
  and import it everywhere. Tests that call scene methods directly are coupled to every
  plugin those methods transitively reach.
- **Don't hardcode physics outcomes probed offline from a fixed seed** (landing
  coordinates, hit points) — they rot when any unrelated constant changes and the failure
  gives no hint that the fix is "re-probe the number". Capture the outcome at runtime, or
  assert on the outcome (`won`, `score > 0`) and unit-test exact math with synthetic
  inputs. Overriding a setup method that draws from the seeded RNG shifts the cursor for
  every later draw.
- `biome-ignore` must name the exact rule (`lint/style/noNonNullAssertion`), not just the
  category. A bare `// biome-ignore lint:` is rejected.
- `pnpm lint` runs Biome across the whole monorepo with no change-scoping, so pre-existing
  violations in unrelated files fail your gate. Lint your diff first with
  `biome check --changed --since=<ref>`, and triage the rest rather than silently folding
  unrelated fixes into your phase.
- Example runtime assets live in `examples/<game>/assets/` — the deploy build copies only
  that directory. `examples/dist/` is ephemeral build output; don't check it in.

### Working on `scripts/release.mjs`

`pnpm release` is git- and npm-mutating. Smoke-test it by bumping `CHANGELOG.md` on a
throwaway branch, running `pnpm release --dry-run`, then discarding the branch — `--dry-run`
suppresses the script's mutations but its gates still read live git/package state. When
parsing `git status --porcelain`, split into lines **first**, then slice each line
(`XY <path>`, path at column 3) — trimming the whole blob eats the first line's leading
space and shifts every column parse by one.

## Packaging Invariants

Two rules hold across every change to `packages/quintus2/`:

- **`three` is external for the entire tsup build**, not per-entry — tsup applies one
  `external`/`noExternal` config to all entries. Only the `./three` subpath may reference
  `three`; the main barrel must never import it, directly or transitively. Before adding a
  package to the barrel, check: `grep -rl 'from "three"' packages/<pkg>/src`. This is why
  `particles`, `snapshot`, and `debug` are excluded.
- **Validate from a tarball, never from `dist/` or `src/`.** The recurring packaging bug is
  manifest omissions — the published artifact missing something the source tree has. A
  green build against `dist` can still ship a broken tarball. `npm pack`, install into a
  temp dir *outside* the workspace (workspace symlinks otherwise resolve `private`
  packages a real consumer never installs), then `tsc --noEmit` against it.

After `pnpm build`: `dist/index.js` must contain no `@quintus/*` import, and
`dist/three.js` must retain a bare `from "three"`.

### create-quintus2 template contract

Templates under `packages/create-quintus2/templates/<2d|3d>/` are consumer projects, not
engine source (excluded from Biome lint). The scaffolder hard-depends on:

- `package.json` declares exactly one engine dep, the sentinel `"quintus2": "0.0.0"` — the
  CLI rewrites it to the real version. No `@quintus/*`, no `workspace:*`.
- Dotfiles ship `_`-prefixed (`_gitignore`, `_npmrc`) and are renamed on copy — npm strips
  real `.gitignore`/`.npmrc` from tarballs.
- Executables under `bin/` are re-chmod'd to 0755 after copy (npm normalizes to 0644).
- **`bin/qdbg` and `.claude/skills/debug-game/` are vendored into both templates with no
  automatic sync.** Edit the root copy and you must update the template copies too.
- Assets go under `public/assets/`. A project-root `assets/` dir works in `dev` but is
  absent from `vite build` output.

### Testing a 3D scene headlessly

`ThreePlugin` installs `THREE.WebGLRenderer`, which needs a real WebGL context jsdom does
not provide. Run the scene via `TestRunner.run({ scene })` with **no plugins** —
`MeshNode`, the lights, and `Camera3D` all construct fine without a GL context. Keep the
`ThreePlugin` bootstrap out of any module a test imports.

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
