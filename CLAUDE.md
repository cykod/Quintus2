# Quintus 2.0

Complete rewrite of the Quintus HTML5 game engine for the AI/LLM era.

## Project Status

**Phase 1 complete.** Monorepo bootstrapped, `@quintus/math` and `@quintus/core` implemented with tests. Bouncing ball demo runs.

## Architecture

Godot-inspired **Node/Scene Tree** (NOT ECS) with TypeScript. The key abstraction chain:

```
Node → Node2D → Actor / StaticCollider / Sensor
```

- `Node` — base class, pure logic, parent/child tree
- `Node2D` — adds 2D transform (position, rotation, scale) with cascade
- `Actor` — code-controlled movement + collision response via `move()`
- `StaticCollider` — immovable collision (platforms, walls)
- `Sensor` — overlap detection only (triggers, pickups)
- `Signal<T>` — typed observer pattern for decoupled communication

## Monorepo Layout

pnpm workspace. 19 packages under `packages/`:

| Package | npm Name | Purpose |
|---------|----------|---------|
| `core` | `@quintus/core` | Node, Node2D, Scene, Game, signals, game loop, renderer |
| `math` | `@quintus/math` | Vec2, Matrix2D, Color, Rect, AABB, SeededRandom |
| `physics` | `@quintus/physics` | Actor, StaticCollider, Sensor, CollisionShape, SAT, spatial hash |
| `sprites` | `@quintus/sprites` | Sprite, AnimatedSprite, sprite sheets |
| `tilemap` | `@quintus/tilemap` | TileMap, Tiled JSON import, tile collision |
| `input` | `@quintus/input` | Input actions, keyboard, mouse, touch, gamepad |
| `audio` | `@quintus/audio` | AudioPlayer, Web Audio API |
| `ui` | `@quintus/ui` | Label, Button, Container, ProgressBar |
| `tween` | `@quintus/tween` | Tween builder, easing functions |
| `camera` | `@quintus/camera` | Camera follow, shake, zoom, bounds |
| `particles` | `@quintus/particles` | ParticleEmitter |
| `three` | `@quintus/three` | Three.js integration |
| `debug` | `@quintus/debug` | FPS counter, collision viz, inspector |
| `headless` | `@quintus/headless` | Node.js runtime, no browser |
| `test` | `@quintus/test` | TestRunner, InputScript, assertions |
| `snapshot` | `@quintus/snapshot` | State serialization, filmstrip, visual diff |
| `mcp` | `@quintus/mcp` | MCP server for AI tool integration |
| `ai-prefabs` | `@quintus/ai-prefabs` | 30+ pre-built game components |
| `quintus` | `quintus` | Meta-package (~40KB gzipped) |

## Toolchain

| Tool | Purpose |
|------|---------|
| pnpm | Package manager + workspace |
| TypeScript | `strict: true`, no `any`, `target: ES2022` |
| tsup | Build (ESM + CJS + `.d.ts` per package) |
| Vitest | Testing (jsdom env, >90% coverage target) |
| Biome | Linting + formatting (replaces ESLint + Prettier) |
| Vite | Dev server for examples |
| TypeDoc | API documentation |

## Build & Test Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages (dependency-ordered)
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Tests with coverage
pnpm lint             # Biome check
pnpm lint:fix         # Biome auto-fix
pnpm dev              # Vite dev server (examples on :3050)
pnpm docs             # TypeDoc generation
pnpm clean            # Remove all dist/ directories
```

## Design Documents

Read these to understand architectural decisions:

| Document | Contents |
|----------|----------|
| `MODERNIZATION_RESEARCH.md` | Landscape analysis, gap identification, initial proposal |
| `GODOT_INSPIRED_ARCHITECTURE.md` | Node/Scene Tree, physics bodies, signals, API design |
| `AI_INTEGRATION_ARCHITECTURE.md` | Deterministic sim, MCP server, headless runtime, AI testing |
| `IMPLEMENTATION_PLAN.md` | 12 phases, ~24 weeks, full dependency graph |
| `PHASE_0_DESIGN.md` | Detailed steps for project bootstrap |

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
- Biome config: tabs, double quotes, semicolons, 100-char line width
- `noExplicitAny: error` — enforced by Biome
- `verbatimModuleSyntax: true` — explicit `type` imports required
- All packages export from `src/index.ts`
- Package build outputs: `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts`

## The `old/` Directory

Contains the original Quintus 1.0 source (jQuery-era JavaScript). Useful as a reference for what features existed and how the API felt, but **never import, build, test, or lint code from `old/`**. It will be removed once the rewrite is complete.

## Key API Patterns

The engine uses Godot-style patterns adapted for TypeScript:

```typescript
// Extend nodes via class inheritance
class Player extends Actor {
  speed = 200;
  jumpForce = -400;

  onUpdate(dt: number) {
    if (this.game.input.isPressed('right')) this.velocity.x = this.speed;
    if (this.game.input.isJustPressed('jump') && this.isOnFloor()) {
      this.velocity.y = this.jumpForce;
    }
    this.move(dt);
  }
}

// Signals for decoupled events
class Coin extends Sensor {
  readonly collected = signal<void>();
  onReady() {
    this.entered.connect((other) => {
      if (other.hasTag('player')) {
        this.collected.emit();
        this.destroy();
      }
    });
  }
}

// Class-based scenes
class Level1 extends Scene {
  onReady() {
    const map = this.add(TileMap);
    map.asset = 'level1.json';

    const player = this.add(Player);
    player.position = new Vec2(100, 400);
  }
}

game.start(Level1);
```

## Implementation Phases

| Phase | What | Status |
|-------|------|--------|
| 0 | Project bootstrap (monorepo, tooling) | Done |
| 1 | Core engine (Node, Node2D, math, signals, game loop) | Done |
| 2 | Physics (Actor, StaticCollider, Sensor, SAT, move) | — |
| 3 | Sprites & Input (AnimatedSprite, action map, gamepad) | — |
| 4 | Tilemap & Camera (Tiled import, follow, shake, zoom) | — |
| 5 | Audio, Tween, UI (sounds, animations, HUD widgets) | — |
| 6 | Meta-package & first complete platformer game | — |
| 7 | Deterministic testing (headless, input scripts, snapshots) | — |
| 8 | MCP server (AI tool integration) | — |
| 9 | AI prefabs & example games | — |
| 10 | Three.js integration | — |
| 11 | Particles & debug tools | — |
| 12 | DX polish (create-quintus, docs site, WebGL2) | — |
