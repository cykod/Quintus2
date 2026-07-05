# Artillery: Destructible-Terrain Example — Detailed Design

> **Goal:** Ship a Worms/Scorched-Earth-style artillery example (`examples/artillery/`) where the player dials in an angle and muzzle velocity to lob a projectile across a **destructible bitmap terrain**, scoring points for hitting targets, with explosions carving craters out of the terrain.
> **Outcome:** `pnpm dev` shows a playable game — aim, fire, watch the shell arc under gravity and wind, blast a crater and destroy targets, run out of ammo or clear the field → results screen. Fully deterministic (seeded), unit + integration tested, lint-clean, and reachable via `pnpm qdbg connect artillery`.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Scaffold + Terrain (mask model, heightmap, canvas render, crater carving) | Done |
| 2 | Projectile ballistics + detonation (gravity, wind, sweep-sampling vs terrain) | Done |
| 3 | Cannon aiming + input + HUD readouts | Done |
| 4 | Targets, blast damage, scoring, wind-per-turn | Done |
| 5 | Explosion FX, camera shake, audio | Done |
| 6 | Scenes (title/game/results), game flow, integration + example registration | Done |

---

## The core problem & the one key decision

Quintus physics is **shape-based** (SAT/AABB over `RectShape`/`CircleShape`/…). There is **no per-pixel collision** in the engine (confirmed: `packages/physics/src/physics-world.ts` operates entirely on shapes). A destructible bitmap terrain is exactly the case shapes don't cover, so this example implements a **custom collision surface**. That is the whole point of the example — it demonstrates extending the engine with a bespoke collision model while reusing everything else (scene tree, input, scene queries, camera, audio, reactive HUD).

**The key decision: terrain solidity lives in an authoritative `Uint8Array` mask, not in the canvas.**

- The `Uint8Array` mask (`1 = solid, 0 = empty`, one byte per pixel) is the **source of truth** for collision. It is generated and carved with pure integer math.
- The `<canvas>` is **presentation only** — we paint the terrain into it and punch holes with `globalCompositeOperation = "destination-out"`, then blit it each frame via `DrawContext.drawCanvas`.

Why this matters:

1. **Determinism & testability.** Collision reads the mask, never the canvas. In the jsdom/`vitest-canvas-mock` test environment, canvas rasterization is a no-op (fills/arcs don't produce real pixels, `getImageData` returns zeros). If collision depended on `getImageData` it would be **untestable and non-deterministic**. Reading a `Uint8Array` we mutate ourselves is exact, fast, and works identically in the browser and in tests.
2. **Performance.** The projectile samples solidity every physics sub-step. `mask[y*w + x]` is O(1). `getImageData` per sample would be catastrophic.

This decision is the backbone of Phases 1–2. Everything else is conventional Quintus.

---

## Assumptions

1. **Single-player target practice**, not a 1v1 duel. The ask is "hit targets and earn points," so there is no AI opponent and no second cannon. (2-player hot-seat is noted under *Alternatives* / *Out of scope*.)
2. **Map == screen** (`GAME_WIDTH × GAME_HEIGHT`, default 800×500). No horizontal scrolling; the camera is used only for screen shake. This keeps the terrain a single fixed-size bitmap and avoids scroll bookkeeping.
3. **Targets sit on the terrain surface** (crates on hilltops/ledges/valleys), so the projectile only needs to detonate on **solid terrain or out-of-bounds** — target damage is resolved by blast radius at the detonation point. This removes any need for the projectile to know about targets or to stop on a mid-air target, and it makes "blast through a hill to reach a buried target" the core destructible-terrain mechanic. Targets do **not** fall when terrain beneath them is destroyed (see *Alternatives*).
   - **Cannon placement (default):** the cannon stands on the **left** (`CANNON_X`) and lobs **rightward**; targets spawn in `[TARGET_MIN_X, TARGET_MAX_X]` to its right. The aim arc is capped short of horizontal-left (`MAX_ANGLE ≈ 135°`) so shots can't be wasted firing off the left edge. The cannon pivot is seated `CANNON_ELEVATION` px **above** the surface so its muzzle never starts inside solid terrain (which would self-detonate the shell at the cannon's feet).
4. **Wind** is a per-shot constant horizontal acceleration, seeded from `game.random`. It exists to make "find the right angle + velocity" a genuine ballistic puzzle that changes each shot. It is a core mechanic, but trivially cheap (one added term in the integrator).
5. **No full trajectory preview.** The HUD shows angle/power numerically and the cannon draws a short barrel indicator, but the landing point is **not** predicted for the player — that would remove the challenge the ask is built around.
6. **Explosion visuals are hand-drawn** (an expanding, fading ring via `onDraw`), not the `@quintus/particles` package (Phase 11, still a placeholder in `CLAUDE.md`). Avoids depending on incomplete internals.
7. Determinism comes from the engine's fixed timestep + a seeded `SeededRandom`. The scene **forks** `game.random` (`game.random.fork("artillery")`) for terrain, target placement, and wind, keeping that stream independent of `Camera.shake`, which draws from `game.random` directly (see *Determinism notes*).
8. The example follows the **breakout** template exactly: a subdir under `examples/` with `index.html`, `main.ts`, `config.ts`, `state.ts`, `tsconfig.json`, `vitest.config.ts`, and `entities/`, `scenes/`, `hud/`, `__tests__/`, `assets/` folders. No new `package.json` or `vite.config` — `examples/vite.config.ts` auto-discovers any subdir containing `index.html`, and `examples/package.json`/aliases already resolve `@quintus/*`.

## Alternatives Considered

| Decision | Chosen | Alternative | Why chosen |
|----------|--------|-------------|------------|
| Terrain collision source of truth | `Uint8Array` mask; canvas is view-only | Sample the canvas via `getImageData` | Canvas sampling is non-deterministic and a no-op under `vitest-canvas-mock`; the mask is exact, fast, testable. |
| Terrain → physics bridge | Custom sweep-sampling in the projectile | Marching-squares → regenerate `StaticCollider` polygons after every crater | Rebuilding convex colliders from a bitmap every explosion is far more code and still approximate; sampling the mask is exact and simple. |
| Projectile base class | Plain `Node2D` with a manual ballistic integrator | `Actor` + `move()` / `moveAndCollide()` | `Actor.move()` adds gravity but no wind, and slides against *shape* colliders we don't have. We need custom terrain sampling anyway, so `Actor`'s floor/slide machinery is dead weight. A `Node2D` integrator is smaller and clearer. |
| Target damage detection | `game.physics.queryCircle` at the detonation point | Iterate the scene's target list with manual distance checks | Both work; `queryCircle` showcases the engine's scene-query API and keeps the scene from threading a target array around. |
| Target base class | `Sensor` (registers a shape + group so `queryCircle` finds it) | Plain `Node2D` in a scene-owned array | `Sensor` auto-registers in the physics world → discoverable by `queryCircle`, idiomatic, minimal code. |
| Aiming model | Direct angle/power adjustment + numeric HUD | Oscillating power meter you release at the right instant | Direct control maps precisely onto the ask ("a **specific** velocity"); the oscillating meter is a timing minigame. Noted as a future variant. |
| Players | Single-player target practice | 2-player hot-seat artillery duel | Ask is about scoring on targets; a duel doubles turn/UI complexity for no requested benefit. |
| Targets falling | Fixed targets | Targets get gravity + settle on terrain when unsupported | Falling targets need per-target terrain sampling + settle logic; deferred to *Future* to keep the core deterministic and small. |

---

## Architecture

### Scene tree (GameScene)

```
GameScene
├── Terrain (Node2D)          — Uint8Array mask + presentation canvas; onDraw blits canvas
├── Cannon (Node2D)           — reads input, holds angle/power, emits fired({velocity}); draws barrel
├── Target (Sensor) × N       — group "target", point value, sits on surface; draws crate
├── Projectile (Node2D)       — spawned on fire; ballistic sweep; emits detonated(point)/missed
├── Explosion (Node2D)        — transient; expanding fading ring; self-destructs
├── Camera                    — shake only (no follow)
└── HUD (Layer, fixed)        — angle / power / wind / ammo / score labels + power bar
```

### Data flow for one shot

```
Cannon.onFixedUpdate
  ├─ aim_up/down     → angle   (clamped)   ─┐
  ├─ power_up/down   → power   (clamped)    ├─→ gameState.{angle,power}  → HUD labels
  └─ fire (justPressed) & canFire → Cannon.fire()
                                       └─ emit fired({ velocity = polar(angle, power) })
GameScene.onFire({velocity})
  ├─ gameState.ammo -= 1;  cannon.canFire = false
  └─ spawn Projectile.init(muzzlePos, velocity, gameState.wind, terrain)

Projectile.onFixedUpdate(dt)   (each fixed step)
  ├─ velocity.y += GRAVITY*dt ;  velocity.x += wind*dt
  ├─ sweep old→new position in SWEEP_STEP-px increments:
  │     terrain.isSolid(px,py) ?  → emit detonated(hitPoint); destroy()
  └─ off-screen (sides / below) ? → emit missed(); destroy()

GameScene.onDetonate(point)
  ├─ terrain.carveCircle(point, BLAST_RADIUS)          — mask + canvas hole
  ├─ spawn Explosion.init(point) ; camera.shake ; audio.play("explosion")
  ├─ hits = game.physics.queryCircle(point, BLAST_RADIUS, {groups:["target"], includeSensors:true})
  │     for each hit: direct = dist(point,center) ≤ DIRECT_HIT_RADIUS
  │                   gameState.score += direct ? points*2 : points
  │                   hit.destroy(); gameState.targetsRemaining -= 1
  └─ afterShot()
GameScene.onMissed → afterShot()

GameScene.afterShot()   (rng = the scene's forked gameplay RNG, isolated from camera-shake FX)
  ├─ targetsRemaining ≤ 0 → gameState.won = true;  switchTo("results")   (+ leftover-ammo bonus)
  ├─ ammo ≤ 0             → gameState.won = false; switchTo("results")
  └─ else: gameState.wind = rng.int(-MAX_WIND, MAX_WIND); cannon.canFire = true
```

### Terrain solidity model

```
generate(rng):                         carveCircle(cx,cy,r):
 heights = generateHeightmap(w, rng)     for pixels in bbox(cx,cy,r):
 for x in 0..w:                             if (x-cx)²+(y-cy)² ≤ r²:
   top = floor(heights[x])                    mask[y*w+x] = 0        ← authoritative
   for y in top..h: mask[y*w+x]=1           canvas: destination-out arc  ← visual only
   canvas.fillRect(x, top, 1, h-top)
 (canvas fill = visual only)            isSolid(x,y): mask[floor(y)*w+floor(x)] === 1   (bounds → false)
```

The `Terrain` node sits at world origin `(0,0)`; the renderer applies its `globalTransform` (identity + camera view) before `onDraw`, so mask index `(floor(x), floor(y))` maps directly to world/screen pixels (no scroll).

---

## Config & constants (`examples/artillery/config.ts`)

```ts
import type { CollisionGroupsConfig } from "@quintus/physics";

// Dimensions
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 500;

// Terrain (heightmap = surface Y per column; larger Y = lower on screen)
export const TERRAIN_BASE_Y = 320;          // mean surface height
export const TERRAIN_AMPLITUDE = 140;        // max deviation from base
export const TERRAIN_OCTAVES = [             // sum-of-sines hills (seeded phases)
	{ amp: 70, freq: 0.006 },
	{ amp: 30, freq: 0.017 },
	{ amp: 12, freq: 0.045 },
];

// Ballistics
export const GRAVITY = 300;                  // px/s²
export const MAX_WIND = 120;                 // px/s² lateral, ±
export const SWEEP_STEP = 3;                 // terrain-sample increment (px) — < smallest terrain feature
export const PROJECTILE_RADIUS = 4;

// Cannon placement & aiming — cannon sits on the LEFT, lobbing rightward.
// Angle is measured CCW from +x (0 = right/horizontal, π/2 = straight up).
// The arc is capped short of horizontal-left so shots can't fire off-map to the left.
export const CANNON_X = 70;                  // column the cannon stands on
export const CANNON_ELEVATION = 18;          // px the pivot sits ABOVE the surface (clears muzzle from terrain)
export const MIN_ANGLE = 0.12;               // ~7° above horizontal-right
export const MAX_ANGLE = 2.36;               // ~135° (up and slightly left, for close high lobs)
export const DEFAULT_ANGLE = Math.PI / 4;
export const ANGLE_RATE = 0.9;               // rad/s while held
export const MIN_POWER = 120;
export const MAX_POWER = 640;                // muzzle speed px/s
export const DEFAULT_POWER = 380;
export const POWER_RATE = 260;               // px/s per second while held
export const MUZZLE_LENGTH = 34;             // barrel length (px) — muzzle offset from pivot

// Explosion / scoring
export const BLAST_RADIUS = 44;
export const DIRECT_HIT_RADIUS = 14;         // ≤ this from target center → double points
export const TARGET_RADIUS = 12;
export const TARGET_POINTS = 100;
export const TARGET_COUNT = 6;
export const TARGET_MIN_X = 180;             // targets spawn to the right of the cannon
export const TARGET_MAX_X = GAME_WIDTH - 40;
export const TARGET_MIN_SPACING = 70;        // min px between target centers
export const MAX_PLACEMENT_ATTEMPTS = 30;    // per target, before deterministic fallback
export const AMMO = TARGET_COUNT + 4;        // a few misses allowed
export const AMMO_BONUS = 50;                // points per unused shell at win
export const SHAKE_INTENSITY = 8;
export const SHAKE_DURATION = 0.3;
export const EXPLOSION_DURATION = 0.35;      // seconds
export const SEED = 1337;

// Physics: only targets are engine bodies (found via queryCircle). Projectile
// is not a body; terrain is a custom surface. collidesWith is unused here.
export const COLLISION_GROUPS: CollisionGroupsConfig = {
	target: { collidesWith: [] },
};

export const INPUT_BINDINGS: Record<string, string[]> = {
	aim_up: ["ArrowUp", "KeyW", "gamepad:dpad-up"],
	aim_down: ["ArrowDown", "KeyS", "gamepad:dpad-down"],
	power_up: ["ArrowRight", "KeyD", "gamepad:dpad-right"],
	power_down: ["ArrowLeft", "KeyA", "gamepad:dpad-left"],
	fire: ["Space", "gamepad:a"],
	ui_confirm: ["Enter", "gamepad:start"],
};
```

Reactive HUD state (`examples/artillery/state.ts`):

```ts
import { reactiveState } from "@quintus/core";
import { AMMO, DEFAULT_ANGLE, DEFAULT_POWER, TARGET_COUNT } from "./config.js";

export const gameState = reactiveState({
	score: 0,
	ammo: AMMO,
	targetsRemaining: TARGET_COUNT,
	wind: 0, // px/s², signed
	angle: DEFAULT_ANGLE, // radians
	power: DEFAULT_POWER, // px/s
	won: false, // set by afterShot before switching to results (no switchTo params channel)
});
```

---

## Phase 1: Scaffold + Terrain

Stand up the example skeleton and the destructible-terrain node — the mask model, deterministic heightmap, canvas rendering, and crater carving.

- [x] Create `examples/artillery/` with `index.html` (`<canvas id="game" width="800" height="500">` + `<script type="module" src="./main.ts">`), `config.ts` (above), `state.ts` (above), `tsconfig.json` and `vitest.config.ts` copied from `examples/breakout/` (they already set `jsx: "react-jsx"`, `jsxImportSource: "@quintus/jsx"`, jsdom + `vitest-canvas-mock`).
- [x] `examples/artillery/terrain/heightmap.ts` — pure `generateHeightmap(width: number, rng: SeededRandom): number[]` using `TERRAIN_OCTAVES` with seeded phases (`rng.next() * 2π`), clamped to `[20, TERRAIN_BASE_Y + TERRAIN_AMPLITUDE]`.
- [x] `examples/artillery/terrain/terrain.ts` — `Terrain extends Node2D` with the `Uint8Array` mask + presentation canvas, `generate(rng)`, `isSolid(x,y)`, `carveCircle(cx,cy,r)`, `surfaceY(x)` (topmost solid row in a column, for placing targets), and `onDraw` blitting the canvas.
- [x] Minimal `main.ts` that creates the `Game`, installs `PhysicsPlugin`/`InputPlugin`, and starts a placeholder scene that adds a `Terrain` and calls `generate(game.random)` — enough to eyeball hills in `pnpm dev`.

> **Phase 1 implementation notes (2026-07-05):**
> - The terrain test constructs `new Terrain(GAME_WIDTH, GAME_HEIGHT)` (800×500), **not** the design's literal `new Terrain(200, 150)`. `generateHeightmap` bases the surface on `TERRAIN_BASE_Y` (320) regardless of map height, so the surface lands at y≈223–408; a 150-px-tall mask would be entirely empty (no solid pixels), making "bottom solid / sky empty" assertions impossible. Using the real gameplay dimensions matches how the game actually runs and exercises the intended behavior.
> - `this.add(node)` returns the scene (`this`), not the node — so `main.ts` constructs the `Terrain` into a local var, `add`s it, then calls `generate()` on the var (the `add<T>(NodeClass)` overload can't be used because `Terrain`'s constructor requires `(mapWidth, mapHeight)`).
> - `biome-ignore` for the non-null `getContext("2d")!` uses the specific rule id `lint/style/noNonNullAssertion` (a bare `biome-ignore lint:` is rejected by Biome).

```ts
// terrain/heightmap.ts
import type { SeededRandom } from "@quintus/math";
import { TERRAIN_AMPLITUDE, TERRAIN_BASE_Y, TERRAIN_OCTAVES } from "../config.js";

export function generateHeightmap(width: number, rng: SeededRandom): number[] {
	const octaves = TERRAIN_OCTAVES.map((o) => ({ ...o, phase: rng.next() * Math.PI * 2 }));
	const heights = new Array<number>(width);
	const maxY = TERRAIN_BASE_Y + TERRAIN_AMPLITUDE;
	for (let x = 0; x < width; x++) {
		let h = TERRAIN_BASE_Y;
		for (const o of octaves) h += o.amp * Math.sin(x * o.freq + o.phase);
		heights[x] = Math.max(20, Math.min(maxY, h));
	}
	return heights;
}
```

```ts
// terrain/terrain.ts
import { type DrawContext, Node2D } from "@quintus/core";
import type { SeededRandom } from "@quintus/math";
import { generateHeightmap } from "./heightmap.js";

export class Terrain extends Node2D {
	private readonly mask: Uint8Array; // 1 = solid, 0 = empty — source of truth
	private readonly canvas: HTMLCanvasElement; // presentation only
	private readonly ctx: CanvasRenderingContext2D;

	constructor(
		readonly mapWidth: number,
		readonly mapHeight: number,
	) {
		super();
		this.mask = new Uint8Array(mapWidth * mapHeight);
		this.canvas = document.createElement("canvas");
		this.canvas.width = mapWidth;
		this.canvas.height = mapHeight;
		// biome-ignore lint: 2d context is always available in browser + vitest-canvas-mock
		this.ctx = this.canvas.getContext("2d")!;
	}

	generate(rng: SeededRandom): void {
		const heights = generateHeightmap(this.mapWidth, rng);
		this.mask.fill(0);
		this.ctx.clearRect(0, 0, this.mapWidth, this.mapHeight);
		this.ctx.fillStyle = "#6b4a2b";
		for (let x = 0; x < this.mapWidth; x++) {
			const top = Math.floor(heights[x] ?? this.mapHeight);
			for (let y = top; y < this.mapHeight; y++) this.mask[y * this.mapWidth + x] = 1;
			this.ctx.fillRect(x, top, 1, this.mapHeight - top);
			this.ctx.fillStyle = "#4c8b32"; // grass cap (visual only)
			this.ctx.fillRect(x, top, 1, 4);
			this.ctx.fillStyle = "#6b4a2b";
		}
	}

	isSolid(x: number, y: number): boolean {
		const ix = Math.floor(x);
		const iy = Math.floor(y);
		if (ix < 0 || ix >= this.mapWidth || iy < 0 || iy >= this.mapHeight) return false;
		return this.mask[iy * this.mapWidth + ix] === 1;
	}

	/** Topmost solid Y in a column, or mapHeight if the column is empty. */
	surfaceY(x: number): number {
		const ix = Math.floor(x);
		for (let y = 0; y < this.mapHeight; y++) {
			if (this.mask[y * this.mapWidth + ix] === 1) return y;
		}
		return this.mapHeight;
	}

	carveCircle(cx: number, cy: number, radius: number): void {
		const r2 = radius * radius;
		const x0 = Math.max(0, Math.floor(cx - radius));
		const x1 = Math.min(this.mapWidth - 1, Math.ceil(cx + radius));
		const y0 = Math.max(0, Math.floor(cy - radius));
		const y1 = Math.min(this.mapHeight - 1, Math.ceil(cy + radius));
		for (let y = y0; y <= y1; y++) {
			for (let x = x0; x <= x1; x++) {
				const dx = x - cx;
				const dy = y - cy;
				if (dx * dx + dy * dy <= r2) this.mask[y * this.mapWidth + x] = 0;
			}
		}
		// Visual hole (no-op under vitest-canvas-mock; mask above is authoritative)
		this.ctx.save();
		this.ctx.globalCompositeOperation = "destination-out";
		this.ctx.beginPath();
		this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
		this.ctx.fill();
		this.ctx.restore();
	}

	override onDraw(ctx: DrawContext): void {
		ctx.drawCanvas?.(this.canvas, 0, 0);
	}
}
```

### Tests for Phase 1

**`examples/artillery/__tests__/heightmap.test.ts`**
- Determinism: two `generateHeightmap(w, new SeededRandom(SEED))` calls produce identical arrays; a different seed differs.
- Length === width; every value within `[20, TERRAIN_BASE_Y + TERRAIN_AMPLITUDE]`.

**`examples/artillery/__tests__/terrain.test.ts`** (construct `new Terrain(200, 150)`, `generate(new SeededRandom(SEED))`)
- `isSolid(x, mapHeight-1)` true and `isSolid(x, 0)` false for representative columns (bottom solid, sky empty).
- `surfaceY(x)` returns a row where `isSolid(x, surfaceY(x))` is true and `isSolid(x, surfaceY(x)-1)` is false.
- `carveCircle(cx, cy, r)`: after carving, `isSolid(cx, cy)` false; a pixel at distance `> r` from center keeps its prior value; pixels just inside `r` are cleared.
- `isSolid` returns false for out-of-bounds coordinates (negative, ≥ dimension).

**Success criterion:** `pnpm test --filter artillery` passes Phase-1 tests; `pnpm dev` renders rolling hills for the `artillery` example; `pnpm lint` clean.

---

## Phase 2: Projectile ballistics + detonation

The custom ballistic integrator with tunnel-free terrain sweep-sampling.

- [x] `examples/artillery/entities/projectile.tsx` — `Projectile extends Node2D` with `detonated: Signal<Vec2>`, `missed: Signal<void>`, `init(pos, velocity, wind, terrain)`, and `onFixedUpdate` integrating gravity + wind and sweep-sampling the terrain in `SWEEP_STEP`-px increments (prevents tunneling through thin terrain). Detonation point is emitted in world coordinates; the node destroys itself. The shell spawns at the cannon's `muzzlePosition()`, which is guaranteed clear of terrain by the cannon's `CANNON_ELEVATION` seating (Assumption 3), so the first sweep step never self-detonates.
- [x] `onDraw` renders the shell (`ctx.circle` at local origin).
- [x] Off-screen guard emits `missed` when the shell exits the sides or falls below the map (top exit is allowed — the shell arcs above the screen and returns).

> **Phase 2 implementation notes (2026-07-05):**
> - Implemented exactly as designed — every engine API in the reference code block was verified against the packages and matched (`Node2D.onFixedUpdate(dt)`, `signal()`/`Signal<T>` from `@quintus/core`, `Vec2._set`/constructor, `Math.hypot` (there is no `Vec2.hypot` method), `Color.fromHex`, `ctx.circle(center, radius, { fill: Color })`). No deviations.
> - `destroy()` sets `isDestroyed = true` and detaches the node from its parent (`packages/core/src/node.ts`), so the Phase-2 tests assert removal via `projectile.isDestroyed === true` (a standalone, tree-detached node has no parent to check).
> - The stub terrain is typed as `{ isSolid: (x, y) => y >= 300 } as unknown as Terrain` to satisfy `no-any` while keeping the test isolated from Phase 1.

```ts
// entities/projectile.tsx
import { type DrawContext, Node2D, type Signal, signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { GAME_HEIGHT, GAME_WIDTH, GRAVITY, PROJECTILE_RADIUS, SWEEP_STEP } from "../config.js";
import type { Terrain } from "../terrain/terrain.js";

// DrawContext shape styles take a Color, not a hex string — convert once at module scope.
const SHELL_COLOR = Color.fromHex("#2b2b2b");

export class Projectile extends Node2D {
	readonly detonated: Signal<Vec2> = signal<Vec2>();
	readonly missed: Signal<void> = signal<void>();
	velocity = new Vec2(0, 0);
	wind = 0;
	private terrain!: Terrain;

	init(pos: Vec2, velocity: Vec2, wind: number, terrain: Terrain): void {
		this.position._set(pos.x, pos.y);
		this.velocity = velocity;
		this.wind = wind;
		this.terrain = terrain;
	}

	override onFixedUpdate(dt: number): void {
		this.velocity.y += GRAVITY * dt;
		this.velocity.x += this.wind * dt;
		const nx = this.position.x + this.velocity.x * dt;
		const ny = this.position.y + this.velocity.y * dt;
		const dx = nx - this.position.x;
		const dy = ny - this.position.y;
		const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / SWEEP_STEP));
		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			const px = this.position.x + dx * t;
			const py = this.position.y + dy * t;
			if (this.terrain.isSolid(px, py)) {
				this.detonated.emit(new Vec2(px, py));
				this.destroy();
				return;
			}
		}
		this.position._set(nx, ny);
		if (nx < -50 || nx > GAME_WIDTH + 50 || ny > GAME_HEIGHT + 50) {
			this.missed.emit();
			this.destroy();
		}
	}

	override onDraw(ctx: DrawContext): void {
		ctx.circle(new Vec2(0, 0), PROJECTILE_RADIUS, { fill: SHELL_COLOR });
	}
}
```

### Tests for Phase 2

**`examples/artillery/__tests__/projectile.test.ts`** — drive `onFixedUpdate` directly with a fixed `dt = 1/60` and a **stub terrain** (`{ isSolid: (x, y) => y >= 300 }`) to isolate ballistics from Phase 1:
- Gravity: a shell fired horizontally (`velocity=(200,0)`, `wind=0`) has monotonically increasing `velocity.y` and `position.y` each step.
- Wind: with `wind>0`, `velocity.x` increases over time; mirror for `wind<0`.
- Terrain detonation: stepping until `y ≥ 300` emits `detonated` exactly once with `point.y` within `SWEEP_STEP` of 300; the node is removed (`destroyed`/detached).
- No-tunnel: a fast downward shell (`velocity=(0, 3000)`, `dt=1/60` ⇒ 50px/step) still detonates at `y ≈ 300`, not below — proving the sweep loop, not the end-of-step position, drives detonation.
- Miss: with an always-empty terrain (`isSolid → false`), a shell driven off the right edge emits `missed` once and destroys.

**Success criterion:** Phase-2 tests pass; ballistics are deterministic across repeated runs with the same inputs.

---

## Phase 3: Cannon aiming + input + HUD

Player controls angle and muzzle velocity; readouts drive the HUD.

- [x] `examples/artillery/entities/cannon.tsx` — `Cannon extends Node2D` holding `angle`, `power`, `canFire`, a `fired: Signal<{ velocity: Vec2 }>`, and a `muzzlePosition(): Vec2`. `onFixedUpdate` reads held aim/power actions (clamped to config bounds), mirrors `angle`/`power` into `gameState`, and fires on `isJustPressed("fire")` when `canFire`. `onDraw` renders the base + a barrel line at `angle` (fills use module-level `Color.fromHex(...)` constants — `ShapeStyle.fill`/`LineStyle.color` take a `Color`, never a hex string).
- [x] `examples/artillery/hud/hud.tsx` — `HUD extends Layer` (`fixed = true`, `zIndex = 100`) with `Label`s for Angle (degrees), Power, Wind (signed, with a ◄/► arrow), Ammo, Score, plus a `rect`-drawn power meter. `onReady` subscribes to `gameState.on("...")` for each field and formats the labels.
- [x] Extend `main.ts` to install `AudioPlugin` + a `Camera`, and register the (still single) game scene wiring `cannon.fired` to a temporary spawn so aiming + firing is exercisable in `pnpm dev` before targets/scoring land in Phase 4.

> **Phase 3 implementation notes (2026-07-05):**
> - Implemented per the design; every engine API in the reference block was verified against the packages (`clamp`/`Color`/`Vec2` from `@quintus/math`; `input.isPressed`/`isJustPressed`; `Layer`/`Label` from `@quintus/ui`; `reactiveState.on(key).connect(({ value }) => …)`; `ctx.line`/`ctx.rect`/`ctx.circle` with `LineStyle`/`ShapeStyle` taking a `Color`).
> - The **power meter is drawn in `HUD.onDraw`** (the `Layer` is a `Node2D`, so overriding `onDraw` renders the meter track + proportional fill in screen space) rather than via a child node — smaller and matches the "rect-drawn" spec.
> - `main.ts` still uses a plain `Scene` (the JSX `GameScene` with `build()` arrives in Phase 4). The `Camera` is added imperatively and its `position` set to `(GAME_WIDTH/2, GAME_HEIGHT/2)` via `camera.position._set(...)` — confirmed against `packages/camera/src/camera.ts` (`_recomputeViewTransform` composes `T(viewport/2)·S(zoom)·T(-camPos)`, so a center-seated camera yields an identity view transform and keeps the terrain aligned with its mask). The temporary `cannon.fired` handler spawns a `Projectile` and carves the terrain on `detonated` so the full aim→fire→crater loop is exercisable now.
> - Cannon tests use `TestRunner` + `InputScript` (`.press(action, frames)` for held input, `.tap("fire")` for a single just-pressed frame); a small `CannonTestScene` records emitted `fired` velocities, and a `NoFireScene` subclass (`canFire = false`) exercises the fire guard.
> - Verified with `pnpm qdbg connect artillery`: the barrel rotates on `aim_up`, the power meter fills on `power_up` ("Power: 467"), and `tap fire 1` + `step` launches an arcing shell that carves a visible crater into a hill.

```ts
// entities/cannon.tsx  (core of the aiming logic)
export class Cannon extends Node2D {
	readonly fired: Signal<{ velocity: Vec2 }> = signal<{ velocity: Vec2 }>();
	angle = DEFAULT_ANGLE;
	power = DEFAULT_POWER;
	canFire = true;

	override onFixedUpdate(dt: number): void {
		const input = this.game.input;
		if (input.isPressed("aim_up")) this.angle = clamp(this.angle + ANGLE_RATE * dt, MIN_ANGLE, MAX_ANGLE);
		if (input.isPressed("aim_down")) this.angle = clamp(this.angle - ANGLE_RATE * dt, MIN_ANGLE, MAX_ANGLE);
		if (input.isPressed("power_up")) this.power = clamp(this.power + POWER_RATE * dt, MIN_POWER, MAX_POWER);
		if (input.isPressed("power_down")) this.power = clamp(this.power - POWER_RATE * dt, MIN_POWER, MAX_POWER);
		gameState.angle = this.angle;
		gameState.power = this.power;
		if (this.canFire && input.isJustPressed("fire")) {
			const v = new Vec2(Math.cos(this.angle) * this.power, -Math.sin(this.angle) * this.power);
			this.fired.emit({ velocity: v });
		}
	}

	muzzlePosition(): Vec2 {
		return new Vec2(
			this.position.x + Math.cos(this.angle) * MUZZLE_LENGTH,
			this.position.y - Math.sin(this.angle) * MUZZLE_LENGTH,
		);
	}
	// onDraw: draw wheel/base + line from pivot to muzzle at `angle`
}
```

### Tests for Phase 3

**`examples/artillery/__tests__/cannon.test.ts`** (headless via `@quintus/test` `TestRunner` + `InputScript`, or by injecting `input.inject`):
- Holding `aim_up` for N frames increases `angle` by `≈ ANGLE_RATE * N * dt`; never exceeds `MAX_ANGLE`. Mirror for `aim_down`/`MIN_ANGLE`.
- Holding `power_up`/`power_down` moves `power` within `[MIN_POWER, MAX_POWER]`.
- `fire` (just-pressed) with `canFire` emits `fired` **once**; the emitted `velocity` equals `(cos θ · power, −sin θ · power)` for the current `angle`/`power`.
- `gameState.angle`/`gameState.power` track the cannon after an update.

**Success criterion:** Phase-3 tests pass; in `pnpm dev` the barrel visibly rotates, the power meter fills, and firing launches an arcing shell that craters the terrain.

---

## Phase 4: Targets, blast damage, scoring, wind

Add targets on the terrain, resolve blast damage via a scene query, and score.

- [x] `examples/artillery/entities/target.tsx` — `Target extends Sensor` with `override collisionGroup = "target"`, a `points` field, `build()` returning `<CollisionShape shape={Shape.circle(TARGET_RADIUS)} />`, `onReady` tagging `"target"`, and `onDraw` drawing a crate (fills use `Color.fromHex(...)` constants, as above).
- [x] `examples/artillery/scenes/game-scene.tsx` — `GameScene extends Scene`: `build()` returns `<Camera ref="camera" position={[GAME_WIDTH / 2, GAME_HEIGHT / 2]} />` + `<HUD />`. **The camera position must be the screen center** — a default `<Camera />` sits at `(0,0)` and its `viewTransform` translates by `+viewport/2`, pushing world origin to screen center and desyncing the terrain from its authoritative mask (`packages/camera/src/camera.ts:235`). At center the view transform is identity, so mask pixel `(x,y)` maps to screen `(x,y)` as the terrain model requires. (qdbg-verified: Camera at (400,250), crates sit exactly on the surface.)
- [x] `onReady` creates a **forked gameplay RNG** `const rng = game.random.fork("artillery")` (isolated from `game.random`, which `Camera.shake` also consumes — see Determinism notes), creates the `Terrain`, calls `generate(rng)`, seats the `Cannon` at `(CANNON_X, terrain.surfaceY(CANNON_X) - CANNON_ELEVATION)` so its muzzle clears the terrain, places targets via `placeTargets(terrain, rng)`, sets the first-shot `gameState.wind = rng.int(-MAX_WIND, MAX_WIND)`, and connects `cannon.fired`, `projectile.detonated`, `projectile.missed`.
- [x] `placeTargets(terrain, rng)` — bounded rejection sampling: for each of `TARGET_COUNT` targets, draw up to `MAX_PLACEMENT_ATTEMPTS` candidate columns in `[TARGET_MIN_X, TARGET_MAX_X]`, accepting the first that is ≥ `TARGET_MIN_SPACING` from every placed target; on exhaustion, fall back to a deterministic evenly-spaced column. Each accepted target is placed at `y = terrain.surfaceY(x) - TARGET_RADIUS`. This guarantees termination and a bounded (thus deterministic-per-seed) RNG draw count.
- [x] Implement `onFire`, `onDetonate`, `onMissed`, `afterShot` per the data-flow diagram — ammo decrement, blast query via `game.physics.queryCircle`, direct-hit doubling, score/targetsRemaining updates, and per-shot wind regeneration from the forked `rng`.

> **Phase 4 implementation notes (2026-07-05):**
> - Every engine API in the design was verified before use and matched: `Sensor` (extends `CollisionObject extends Node2D`, auto-registers in the physics world on `onReady`, so `queryCircle` finds it — `Target.onReady` calls `super.onReady()` then tags), `<CollisionShape shape={Shape.circle(r)} />` (from `@quintus/physics`), `Scene.build()` + `<Camera ref="camera" position={[...]}>` (string ref assigns `this.camera`), `Scene.switchTo(name)`, `game.registerScenes({...})`, `game.physics.queryCircle(center, radius, { groups, includeSensors })` → `CollisionObject[]` (each hit **is** the `Target` node, so `body as Target` reads `position`/`points` directly), `game.random.fork(label)` / `rng.int(min,max)` (inclusive), `Camera.shake(intensity, duration)`. No API deviations.
> - **`onDetonate`/`onMissed`/`afterShot` are public methods** (not `private`) and `placeTargets` is `protected`, so `scoring.test.ts` can drive `onDetonate`/`afterShot` directly and subclass `GameScene` (`ScoringScene`) to suppress auto-placement and hand-place targets at known coordinates. This is the design's "drive `onDetonate` with hand-placed targets" test approach.
> - **Not-yet-existing results scene (Phase 6):** `Scene` exposes no public `hasScene`, and `switchTo("results")` throws if unregistered. So `main.ts` registers a **minimal placeholder `ResultsScene`** (a fixed `Layer` with two `Label`s reading `gameState.won`/`score`) alongside `GameScene`, and the scoring tests register a `StubResultsScene` via `TestRunner`'s `setup(game)` callback. Phase 6 replaces both with the real title/results flow.
> - **Explosion stub (Phase 5):** created a minimal `Explosion extends Node2D` with `init(point): this` (seats position) and an `onUpdate` self-destruct timer at `EXPLOSION_DURATION`. It has **no `onDraw` yet** — Phase 5 adds the expanding/fading ring. `onDetonate` spawns it via `this.add(Explosion).init(point)` so the scene wiring is complete and the tree self-cleans.
> - **Audio deferred to Phase 5:** the design's `onDetonate` block includes `this.game.audio.play("explosion")`, but the SFX assets + `game.assets.load(...)` wiring are explicit Phase 5 deliverables. Calling `play` on an unloaded asset only `console.warn`s and no-ops, so rather than spam a warning every shot, the call is left as a `// Phase 5` comment at the site. `camera.shake(...)` **is** wired now (the camera ref exists and it validates the gameplay/FX RNG isolation).
> - **`destroy()` is deferred** (marks `isDestroyed`, queues removal for the next frame), so scoring tests assert `target.isDestroyed === true` rather than immediate removal from `findAllByType`.
> - Replaced the temporary Phase-3 `main.ts` fire→spawn wiring with `game.registerScenes({ game: GameScene, results: ResultsScene })`.
> - **qdbg-verified** (`pnpm qdbg connect artillery`): `tree` shows Camera(400,250)/HUD/Terrain/Cannon/Target×6 each with a `circle r=12` sensor shape; `tap fire 1` + `step 130` destroyed a target (Explosion spawned, `Target#18.onDestroy`), and the screenshot showed **Score: 100, Ammo: 9, Wind re-rolled to 54**, a crater carved where the target sat, and 5 crates left resting on the surface.

```ts
// scenes/game-scene.tsx  (blast resolution core)
private onDetonate(point: Vec2): void {
	this.terrain.carveCircle(point.x, point.y, BLAST_RADIUS);
	this.add(Explosion).init(point);            // Phase 5
	this.camera.shake(SHAKE_INTENSITY, SHAKE_DURATION);
	this.game.audio.play("explosion");
	const hits = this.game.physics.queryCircle(point, BLAST_RADIUS, {
		groups: ["target"],
		includeSensors: true,
	});
	for (const body of hits) {
		const t = body as Target;
		const direct = Math.hypot(point.x - t.position.x, point.y - t.position.y) <= DIRECT_HIT_RADIUS;
		gameState.score += direct ? t.points * 2 : t.points;
		t.destroy();
		gameState.targetsRemaining -= 1;
	}
	this.afterShot();
}

private afterShot(): void {
	if (gameState.targetsRemaining <= 0) {
		gameState.score += gameState.ammo * AMMO_BONUS; // reward leftover shells
		gameState.won = true;
		this.switchTo("results"); // outcome passed via gameState; switchTo takes no params
	} else if (gameState.ammo <= 0) {
		gameState.won = false;
		this.switchTo("results");
	} else {
		gameState.wind = this.rng.int(-MAX_WIND, MAX_WIND); // this.rng = game.random.fork("artillery")
		this.cannon.canFire = true;
	}
}
```

### Tests for Phase 4

**`examples/artillery/__tests__/scoring.test.ts`** (unit-test the scene's blast logic; a small headless `Game` with `PhysicsPlugin` so `queryCircle` works, or drive `onDetonate` with hand-placed targets):
- Detonation with a target center inside `BLAST_RADIUS` but outside `DIRECT_HIT_RADIUS` → `score += points`, `targetsRemaining -= 1`, target destroyed.
- Detonation within `DIRECT_HIT_RADIUS` → `score += points * 2`.
- Detonation with **no** target in range → score unchanged, target count unchanged.
- Two targets inside one blast → both destroyed, both scored.
- `afterShot`: reaching `targetsRemaining == 0` adds `ammo * AMMO_BONUS` and requests `results` with `won:true`; `ammo == 0` with targets left requests `results` with `won:false`; otherwise wind is re-rolled deterministically and `canFire` is restored.

**`examples/artillery/__tests__/placement.test.ts`**
- With `SEED`, target placement is deterministic and every target rests on the surface (`isSolid` just below the target, empty just above); targets respect min-spacing.

**Success criterion:** Phase-4 tests pass; in `pnpm dev` a well-aimed shot destroys a target and the score increases; a near-miss craters terrain without scoring.

---

## Phase 5: Explosion FX, camera shake, audio

Make impacts feel good; no dependency on the placeholder particles package.

- [x] `examples/artillery/entities/explosion.tsx` — `Explosion extends Node2D`, `init(point)`, a lifetime timer in `onUpdate(dt)` (self-destruct at `EXPLOSION_DURATION`), and `onDraw` rendering an expanding, fading ring (radius grows `0.5→1.5 × BLAST_RADIUS`, alpha `1→0` via `ctx.setAlpha`). **NOTE: a minimal stub already exists** (Phase 4 created `init(point): this` + the `onUpdate` self-destruct timer so the scene wiring compiles/runs). Phase 5 only needs to add the `onDraw` ring.
- [x] Add `assets/fire.wav` and `assets/explosion.wav` (short synthesized SFX, or reuse an existing example's clip); load them in `main.ts` via `game.assets.load({ audio: [...] })`; play `"fire"` on `cannon.fired` and `"explosion"` on detonate (wired in Phase 4, assets provided here).
- [x] Confirm `camera.shake` fires on detonation (already called in Phase 4) and reads well.

> **Phase 5 implementation notes (2026-07-05):**
> - Every engine API in the design block was verified before use and matched: `DrawContext.save()/restore()/setAlpha()/circle(center, radius, { fill })` (all present in `packages/core/src/canvas2d-renderer.ts` + `draw-context.ts`), `Color.fromHex`, `game.audio.play(name)` (`packages/audio/src/audio-system.ts`), and the asset key derivation (`AssetLoader.nameFromPath` strips dir + extension, so `assets/fire.ogg` → key `"fire"`). No API deviations.
> - **`explosion.tsx`** kept the stub's `init(point): this` signature (the scene chains `this.add(Explosion).init(point)`) and its `onUpdate` self-destruct timer, and added `onDraw` per the design block — an expanding filled disc (radius `BLAST_RADIUS * (0.5 + p)`) fading via `ctx.setAlpha(1 - p)`, `p = min(1, t/EXPLOSION_DURATION)`. Timer and draw share the same `this.t`.
> - **Audio assets reused, not synthesized** (both Kenney CC0 — no synthesis risk, and audio can't be unit-tested anyway). Design specified `.wav`; used `.ogg` to match the copied source content (extension is irrelevant to the key + Web Audio decodes by content; the loader already handles `.ogg` across other examples):
>   - `assets/fire.ogg` ← copied from `examples/tower-defense/assets/sfx/cannon.ogg` (a literal cannon-fire SFX).
>   - `assets/explosion.ogg` ← copied from `examples/space-shooter/assets/boss_die.ogg`.
>   - Recorded in `examples/artillery/assets/ATTRIBUTION.md` (mirrors breakout's convention). `main.ts` loads them via `game.assets.load({ audio: ["assets/fire.ogg", "assets/explosion.ogg"] }).then(() => game.start("game"))`.
> - **`"fire"` is played in `GameScene.onFire`** (on `cannon.fired`) and the deferred `"explosion"` play was un-commented in `onDetonate`. `AudioSystem.play` no-ops gracefully in headless (null `AudioContext` → `noopHandle`), so the only test impact was that `scoring.test.ts` — which drives `onDetonate`/`onFire` directly — now needs `AudioPlugin()` in its plugin list (mirrors `examples/breakout/__tests__/helpers.ts`). Added it there.
> - **qdbg-verified** (`pnpm qdbg connect artillery`): a `tap fire 1` + step to detonation drained events `audio play "fire"` (frame 0), then at detonation `Explosion#.onReady` + `audio play "explosion"`, `Target#.onDestroy`, and `Explosion#.onDestroy` exactly 21 frames (0.35s = `EXPLOSION_DURATION`) later. Screenshot showed a bright orange `#ffb020` flash expanding inside the fresh crater with Score rising 100→200 as targets were destroyed. `camera.shake(SHAKE_INTENSITY, SHAKE_DURATION)` fires on every detonation.

```ts
// entities/explosion.tsx
import { type DrawContext, Node2D } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { BLAST_RADIUS, EXPLOSION_DURATION } from "../config.js";

const EXPLOSION_COLOR = Color.fromHex("#ffb020"); // ShapeStyle.fill is a Color, not a hex string

export class Explosion extends Node2D {
	private t = 0;
	init(point: Vec2): void {
		this.position._set(point.x, point.y);
	}
	override onUpdate(dt: number): void {
		this.t += dt;
		if (this.t >= EXPLOSION_DURATION) this.destroy();
	}
	override onDraw(ctx: DrawContext): void {
		const p = Math.min(1, this.t / EXPLOSION_DURATION);
		ctx.save();
		ctx.setAlpha(1 - p);
		ctx.circle(new Vec2(0, 0), BLAST_RADIUS * (0.5 + p), { fill: EXPLOSION_COLOR });
		ctx.restore();
	}
}
```

### Tests for Phase 5

**`examples/artillery/__tests__/explosion.test.ts`**
- `Explosion` self-destructs after `EXPLOSION_DURATION` of accumulated `onUpdate` time (still alive just before, gone at/after).
- Visual math is exercised without asserting canvas pixels (drive `onUpdate` then confirm the node removes itself) — canvas draws are no-ops under the mock, so **no pixel assertions**.

**Success criterion:** Phase-5 tests pass; `pnpm dev` shows an expanding flash + screen shake and plays fire/explosion sounds; `pnpm lint` clean.

---

## Phase 6: Scenes, game flow, integration

Wrap the loop with title/results screens, register the example, and prove an end-to-end playthrough.

- [x] `examples/artillery/scenes/title-scene.tsx` — title + controls text; `ui_confirm` → `switchTo("game")`; resets `gameState` on entry.
- [x] `examples/artillery/scenes/results-scene.tsx` — reads `gameState.won` (set by `afterShot`; `switchTo` has no params channel), shows "Field Cleared!"/"Out of Ammo", final `gameState.score`, and `ui_confirm` → back to `title`. `title-scene` calls `gameState.reset()` on entry so a new round starts clean.
- [x] Finalize `main.ts`: `Game` (`seed: SEED`, `backgroundColor` sky), `PhysicsPlugin({ gravity: Vec2(0,0), collisionGroups: COLLISION_GROUPS })` (projectile gravity is applied manually, so world gravity stays 0), `InputPlugin`, `AudioPlugin`, `TweenPlugin` (optional), `registerScenes({ title, game, results })`, load audio, `game.start("title")`.
- [x] Add `artillery` to the Example Games table in `CLAUDE.md` (status Done once shipped).
- [x] Full-playthrough integration test.

> **Phase 6 implementation notes (2026-07-05):**
> - Every engine API in the design was verified before use: `reactiveState.reset()` **exists** (`packages/core/src/reactive-state.ts:56` — restores the initial snapshot and emits per-key change signals); `Scene.build()` + `<Layer fixed>`/`<Panel>`/`<Label>` (mirrors `examples/breakout/scenes/title-scene.tsx` + `game-over-scene.tsx`); `Scene.switchTo`, `game.registerScenes`, `game.start`; `TestRunner.run` / `InputScript` / `assertDeterministic` from `@quintus/test`. No deviations from the engine API.
> - **`gameState.reset()` is called in `TitleScene.onReady`** (design's "reset on entry"), not on the transition out. Breakout resets on the transition *out* (button `onPressed`), but the design explicitly wants reset on title *entry* so the results→title→game "play again" path starts clean. Verified: `ui_confirm` from results returns to the title (which resets), so a second round is fresh.
> - **`TweenPlugin` omitted** — the design flagged it optional and nothing in the example uses tweens (simplicity-first).
> - **`.ogg` assets, not the design's `.wav`.** The Phase-6 main.ts code block still shows `assets/fire.wav`/`explosion.wav`, but Phase 5 shipped `.ogg` (the loader keys by filename regardless of extension). Kept the `.ogg` paths that exist on disk.
> - **`main.ts` now registers all three scenes and starts `"title"`**, replacing the Phase-4 placeholder `ResultsScene` (deleted) with the real `scenes/results-scene.tsx`.
> - **Integration test determinism uses two complementary checks**: (a) two runs of the same `InputScript` → identical final `gameState.score`/`targetsRemaining` (gameState is a module singleton, *not* in the node snapshot, so this is asserted directly); (b) `assertDeterministic` (2 runs) on the full scene-tree snapshot. Scoring/terrain/win/lose tests drive the *real* fire→projectile→terrain→scoring pipeline via `InputScript`; the known-seed detonation points (real 6-target scene → `(385, 240)`; empty-field wind → `(392.5, 231.5)`) were established empirically and used to hand-place the single win-test target. Because overriding `placeTargets` changes the RNG cursor (and thus the wind draw), the empty-field/one-target scenes use the empty-field detonation point.
> - **qdbg-verified** (`pnpm qdbg connect artillery`): loads at the `TitleScene`; `tap ui_confirm 1` switches to `GameScene` (Camera(400,250)/HUD/Terrain/Cannon/Target×6); `tap fire 1` + `step 150` fired the shell (audio "fire"), detonated at frame 85 (audio "explosion", Explosion spawned, `Target#27.onDestroy`), carved a visible crater, and the HUD read **Score: 100, Ammo: 9, Wind ► 54** with 5 crates left. `scene results` renders "Out of Ammo / Final Score: 100 / Press Enter to play again", and `ui_confirm` returns to the title. The only console error is a harmless `favicon.ico` 404.

```ts
// examples/artillery/main.ts (shape)
const game = new Game({ width: GAME_WIDTH, height: GAME_HEIGHT, canvas: "game",
	scale: "fill", fillAxis: "width", pixelArt: false, backgroundColor: "#8ec7e6", seed: SEED });
game.use(PhysicsPlugin({ gravity: new Vec2(0, 0), collisionGroups: COLLISION_GROUPS }));
game.use(InputPlugin({ actions: INPUT_BINDINGS }));
game.use(AudioPlugin());
game.registerScenes({ title: TitleScene, game: GameScene, results: ResultsScene });
game.assets.load({ audio: ["assets/fire.wav", "assets/explosion.wav"] }).then(() => game.start("title"));
```

### Tests for Phase 6

**`examples/artillery/__tests__/integration.test.ts`** (headless `TestRunner` on `GameScene`, fixed `SEED`, `InputScript`):
- **Determinism:** two runs of the same input script yield identical final `gameState.score` and `targetsRemaining` (leans on `assertDeterministic` where practical).
- **Scoring playthrough:** a scripted sequence that aims at a known-seed target column and fires destroys ≥1 target and raises `score` above 0.
- **Terrain destruction:** after a shot lands on a hill, `terrain.isSolid` at the impact point is now `false` (crater persisted in the mask).
- **Lose path:** exhaust `AMMO` shots into empty sky (all `missed`) → scene requests `results` with targets remaining.
- **Win bonus:** clearing all targets adds the leftover-ammo bonus to the score.

**Manual verification (qdbg):** `pnpm qdbg connect artillery` → `tree` shows Terrain/Cannon/Target×N/HUD → `press aim_up` / `tap fire 1` / `step 120` → `events` shows detonation, `screenshot` shows a crater. (Document in the phase, not automated.)

**Success criterion:** all Phase-6 tests pass; `pnpm qdbg connect artillery` loads and a scripted shot destroys a target; a full round can be won and lost in `pnpm dev`.

---

## Test Plan summary

| File | Kind | Covers |
|------|------|--------|
| `__tests__/heightmap.test.ts` | unit (pure) | deterministic terrain heights, bounds |
| `__tests__/terrain.test.ts` | unit | mask solidity, `surfaceY`, crater carving, bounds |
| `__tests__/projectile.test.ts` | unit (stub terrain) | gravity, wind, sweep detonation, no-tunnel, miss |
| `__tests__/cannon.test.ts` | headless input | angle/power clamping, fire velocity vector, `gameState` mirror |
| `__tests__/scoring.test.ts` | unit/headless | blast query, direct-hit doubling, ammo, win/lose branch |
| `__tests__/placement.test.ts` | unit | seeded on-surface target placement + spacing |
| `__tests__/explosion.test.ts` | unit | lifetime self-destruct (no pixel assertions) |
| `__tests__/integration.test.ts` | headless E2E | determinism, scoring run, terrain destruction, win/lose |

All tests run under jsdom + `vitest-canvas-mock`. **No test asserts canvas pixels** — collision and scoring read the `Uint8Array` mask and `gameState`, both of which are real in the mock environment.

## Determinism notes

- **Gameplay RNG is isolated from FX RNG.** The scene forks a dedicated stream `const rng = game.random.fork("artillery")` in `onReady`; terrain heightmap phases, target columns, and per-shot wind all draw from `rng` in a fixed order. This matters because **`Camera.shake` consumes `game.random` directly** — two `next()` calls per render frame for the shake's duration (`packages/camera/src/camera.ts:330`). If gameplay drew from the same `game.random`, the wind sequence would depend on how many render frames each shake lasted, which differs between real-time and headless runs. Forking keeps the gameplay stream independent of shake and frame count.
- Projectile integration uses the engine's fixed timestep — identical inputs ⇒ identical arcs.
- World gravity is `Vec2(0,0)`; the projectile applies `GRAVITY`/`wind` itself, so no engine body is subject to hidden acceleration.
- Target placement (`placeTargets`) draws a **bounded** number of RNG values (≤ `MAX_PLACEMENT_ATTEMPTS` per target, then a deterministic fallback), so the RNG cursor after setup is fixed per seed.

## Definition of Done

- [x] All six phases marked Done in the status table.
- [x] `pnpm build` succeeds with no errors.
- [x] `pnpm test` passes (new `artillery` suite green — 48 tests; existing suites unaffected — 2549 total, 0 type errors).
- [x] `pnpm lint` clean (Biome: tabs, double quotes, 100-col).
- [x] `pnpm dev` → `artillery` example plays: aim, fire, crater terrain, destroy targets, win/lose → results. (qdbg-verified: title→game→fire→crater→results→title.)
- [x] `pnpm qdbg connect artillery` works; a scripted shot destroys a target and leaves a visible crater.
- [x] `artillery` row added to the Example Games table in `CLAUDE.md`.

## Out of scope / Future

- **2-player hot-seat duel** (alternating turns, two cannons, health) — the natural "full Worms" extension; deferred to keep scoring single-player.
- **Gravity-affected targets** that fall/settle when the terrain beneath them is destroyed (needs per-target terrain sampling + settle loop).
- **Oscillating power meter** aiming variant (timing-based) as an alternate control scheme.
- **Scrolling / larger-than-screen maps** with camera follow on the shell.
- **Particle-based explosions & debris** once `@quintus/particles` (Phase 11) is real.
- **Multiple weapon types** (cluster, grenade with bounce, dirt-ball that *adds* terrain).
