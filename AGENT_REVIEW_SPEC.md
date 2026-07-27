# Agent Review Spec — Quintus 2.0

Project-specific instructions for the `/review` skill. How to **verify changes by exercising
the running engine and its games**, not just reading the diff or trusting a green `pnpm test`.
Read `CLAUDE.md` and `AGENT_IMPLEMENTATION_SPEC.md` first.

The "live surface" depends on what changed. For a **package** (`packages/*`) it's the Vitest
suite plus a headless harness that drives the real classes. For an **example game**
(`examples/*`) it's the game running in a browser, driven by **qdbg** — the Playwright-based
CLI debugger that is this project's primary runtime-verification tool.

## Golden Rule

**A review must exercise the code a real user, LLM, or player would touch — not just read the
diff.** A green suite proves the implementer's tests pass; a review proves the physics actually
resolves the way the design says, the scene tree builds, input drives movement, and the game is
playable end-to-end including on the edge cases the implementer didn't pick. Reading the diff or
trusting a green `pnpm test` is **not** a review.

Enumerate the surfaces the change touches, then cover each:
core/physics/math modules (Vitest + headless harness) · JSX `build()` composition · example
games (qdbg in a real browser) · deterministic replay · the published-package boundary
(`test:e2e`).

**If you cannot exercise the code — dev server won't start, qdbg can't connect, a package won't
build — stop and report `BLOCKED:` naming exactly what you need.** Never sign off on unexercised
code and never fabricate qdbg output or physics numbers. A review written from what *should*
happen is the specific failure this document exists to prevent.

**When a change genuinely has no runtime surface** (a doc comment, a CHANGELOG edit, a spec, a
Biome-formatting-only diff), write a one-line N/A note saying so and why — an empty review
directory is indistinguishable from "review never run" and misleads `/gate-review`. Everything
that touches product source in `packages/*/src` or `examples/*/src` has a runtime surface and
must be exercised.

## Pick the Surface by What Changed

| Changed | Live surface to exercise |
|---------|--------------------------|
| `math` / `core` (Node, Node2D, signals, game loop) | Vitest suite + a headless harness: build a tree, run frames, assert transforms/signals fire |
| `physics` (Actor, StaticCollider, Sensor, SAT, `move`) | Headless harness driving `move()` across the edge cases (§4) **and** an example game in qdbg |
| `sprites` / `tilemap` / `camera` / `input` | Vitest + the relevant example game in qdbg (tilemap, platformer) — watch it render and respond |
| `jsx` (`build()`, refs, coercion) | Headless harness that enters a node into a tree and asserts refs/children resolved; a `*-tsx` example in qdbg |
| `ui` / `tween` / `audio` | The example that uses it (tween-ui, breakout) in qdbg; drive a button, watch a tween settle |
| `headless` / `test` / `snapshot` | The deterministic-replay check (§6): same seed + input script ⇒ identical final snapshot |
| An **example game** (`examples/*`) | The game in qdbg, driven through its core loop (§5) |
| `quintus2` / `create-quintus2` packaging | `pnpm test:e2e` — pack → scaffold → install → build → test → tsc (§7) |

## 1. Prerequisites

- Node + pnpm at the project's versions. `pnpm install` if the lockfile changed.
- **`pnpm build` before verifying anything cross-package** — tests and qdbg resolve against
  built `dist/`, so a stale build makes a fixed bug look unfixed (`AGENT_IMPLEMENTATION_SPEC.md`).
- Vite dev server on **port 3050** for any qdbg session (`pnpm qdbg connect` starts it if needed).
- Playwright installed (qdbg wraps it). If qdbg can't launch a browser, that's a `BLOCKED:`, not
  a reason to skip runtime verification.

## 2. Quality Gate Stack

Run every gate and capture the full output verbatim, **including the test count** (e.g.
`1726 passed`). A review without command output is unverifiable. Full-suite green is required —
a focused `pnpm test:platformer` pass that hides a full-suite break is itself a regression.

```bash
pnpm build          # dependency-ordered; required before cross-package verification
pnpm test           # full unit suite (jsdom, offline) — must be green, ZERO warnings
pnpm lint           # Biome — zero warnings (noExplicitAny: error, verbatimModuleSyntax)
```

**Zero warnings is a hard gate** (`AGENT_IMPLEMENTATION_SPEC.md`). A stderr warning about a
lingering rAF loop usually means a test called `game.start()` without `game.stop()` — treat it as
a finding, not noise. If the change touches an example with its own suite, run it too
(`pnpm test:platformer`, `pnpm test:dungeon`, or the example's local vitest config).

## 3. Headless Harness Verification — the heart of a package review

For every public class/method in the diff, drive it through the **real** `HeadlessGame` (never a
mock of the engine) and assert observable state, then walk one edge case the implementer didn't.
Paste each session as a narrated fenced block saying what it proves.

```ts
// build a tree, run deterministic frames, assert
const game = new HeadlessGame({ seed: 1 });
game.registerScenes({ test: TestScene });
game.start("test");
game.runFor(30);                          // fixed timestep, deterministic
const player = game.scene.findByName("Player");
expect(player.position.y).toBeCloseTo(400);   // landed on the platform
game.stop();                                  // ALWAYS stop — lingering rAF = warning
```

Per layer:

- **`core`** — a built tree has correct parent/child links and cascaded `Node2D` transforms;
  `build()` runs before `onReady()`; a `Signal` fires to every connected slot and stops after
  `disconnect`; `reactiveState().onChange` fires per-key.
- **`physics`** — see §4; this is the highest-value check in the project.
- **`jsx`** — string refs assign to `this.<name>`, dollar refs resolve order-independently across
  nodes, and prop coercion works (tuple→Vec2, hex→Color, number→uniform scale, fn→Signal connect).

## 4. Physics Verification — walk the traps, not the happy path

Physics is where "looks right" and "is right" diverge. For any `physics` or `move()` change,
drive an Actor through these in a headless harness (or in qdbg against a real game) and assert:

- **Landing** — an Actor falling onto a `StaticCollider` stops exactly at the surface
  (positions are **center-based**: a platform at y=280 with rect 400×20 has its top at y=270).
- **One-way platforms** — pass through from below, land from above.
- **Walls / corners** — moving into a wall stops horizontally without tunneling; a corner
  approach doesn't wedge or jitter.
- **Sensor overlap** — a `Sensor` emits `entered`/`exited` on overlap but applies no collision
  response.
- **Tunneling at speed** — a fast Actor doesn't pass through a thin collider in one step.
- **Scene queries** — `raycast`, `queryRect/Circle`, `shapeCast`, `isEdgeAhead`,
  `hasLineOfSight` return what the geometry says; TileMap DDA raycast agrees with the collider.

## 5. Example-Game Verification with qdbg — the heart of a game review

For any change to an `examples/*` game (or a package whose effect is only visible in a game),
drive the running game with **qdbg** and embed the output. **Use qdbg commands, not raw
`playwright-cli` or `eval`** (`CLAUDE.md`). A game review that never ran `qdbg connect` is not a
review.

```bash
pnpm qdbg connect platformer     # opens browser, paused at frame 0 (starts :3050 if needed)
pnpm qdbg tree                   # scene tree built as designed?
pnpm qdbg physics Player         # starting physics state
pnpm qdbg tap jump 1             # jump uses isJustPressed — tap, don't hold
pnpm qdbg step 30                # advance deterministic frames
pnpm qdbg physics Player         # landed? velocity zeroed?
pnpm qdbg events --category=physics   # collisions fired (events DRAIN — peek to re-read)
pnpm qdbg screenshot after-jump.png   # embed as evidence
pnpm qdbg disconnect             # always clean up the session
```

Cover the game's **core loop**, not one frame: for a platformer — walk, jump, land, take
damage, reach the goal; for breakout — launch, bounce, break a brick, catch a power-up; for
the dungeon — move, attack, pick up equipment. Verify the change's specific behavior and
confirm you didn't regress the loop around it.

qdbg rules that bite (`CLAUDE.md`): **`connect` first**; **input persists** — `release-all`
after `press`; **`jump` only fires frame 1** — `tap jump 1` then `move-to` for drift, never
`move-to Player jump`; **`destroy` to isolate** — remove enemies/hazards to test one system;
**positions are center-based**; **`events` drains** — use `peek` to re-read.

Use the **`/debug-game` skill** for the full qdbg reference and recipes when driving a game.

## 6. Deterministic Replay Verification

Determinism is a first-class engine guarantee (`CLAUDE.md`: seeded RNG, fixed timestep,
serializable state). For any change to `physics`, `core` timing, `headless`, `input`, or RNG,
confirm it holds:

- Same seed + same `InputScript` ⇒ **identical** final `StateSnapshot` across two runs
  (`assertDeterministic`, or run twice and `diffSnapshots` to an empty diff).
- A change that introduces `Date.now()`, `Math.random()`, iteration order over a hashed
  collection, or float noise into the fixed-step path is a **Blocker** — it breaks replay,
  headless tests, and AI-driven testing at once.

## 7. Published-Package Boundary (packaging changes)

For changes to `quintus2`, `create-quintus2`, the bundle config, or public exports, the unit
suite is not enough — the real risk is at the pack/install boundary:

```bash
pnpm test:e2e     # pack quintus2 → scaffold via create-quintus2 → install → build → test → tsc
```

Confirm: `noExternal` still inlines all 21 `@quintus/*` internals into `dist` (no private
package leaks as a bare dependency); subpath exports (`/jsx-runtime`, `/three`, `/testing`)
resolve; a scaffolded starter builds and its `tsc` is clean. This is slow and hits the network —
it is **not** in `pnpm test`, so run it explicitly when the packaging surface changes.

## 8. Review Document Format

Write to `.work/reviews/<YYYY-MM-DD-short-slug>/overview.md`; screenshots under
`.../screenshots/`. The doc is self-contained evidence:

1. **Summary** — what changed (1–2 sentences), packages/examples touched.
2. **Spec line** — "AGENT_REVIEW_SPEC.md applied".
3. **Quality Gate Stack** — every command with full output and test count.
4. **Live Sessions** — headless harness runs, qdbg command sequences, replay checks — each in a
   fenced block with a 1–2 sentence narration of what it proves; qdbg screenshots embedded.
5. **Findings** — bulleted, severity (Blocker / Finding / Nit), `file:line`, proposed fix.
6. **Checklist** — §9, each box checked or N/A.

A session block without narration is decoration; narration without a session is unverifiable.

## 9. Review Checklist

- [ ] `pnpm build` run first; gate stack (`test`, `lint`) green with **zero warnings**, counts captured
- [ ] Every public class/method in the diff exercised through the **real** engine (headless harness or qdbg), happy path
- [ ] Physics changes: landing, one-way, walls/corners, sensor overlap, tunneling-at-speed, and one scene query walked (§4)
- [ ] Example-game changes: game driven through its **core loop** in qdbg, screenshots embedded, session disconnected
- [ ] JSX changes: string/dollar refs and prop coercion confirmed on a real built tree
- [ ] Determinism confirmed (same seed + input ⇒ identical snapshot) for any timing/physics/RNG change; no `Date.now()`/`Math.random()` in the fixed-step path
- [ ] Packaging changes: `pnpm test:e2e` green; internals stay inlined; subpath exports resolve
- [ ] Every `game.start()` in a harness paired with `game.stop()` (no lingering-rAF warnings)
- [ ] Findings tagged Blocker / Finding / Nit with `file:line` and proposed fixes

## Common Blockers

| Symptom | Likely cause / resolution |
|---------|---------------------------|
| Fixed bug still looks broken in qdbg / tests | Stale `dist/` — run `pnpm build` before verifying cross-package |
| `pnpm test` emits a lingering-rAF warning | A test called `game.start()` without `game.stop()` — pair them |
| Actor sinks into / floats above a platform | Positions are center-based — you're off by half the collider height |
| `move-to Player jump …` never jumps | `jump` is `isJustPressed` (frame-1 only) — `tap jump 1`, then `move-to` for drift |
| qdbg `events` returns nothing the second call | `events` **drains** — use `peek` to re-read, `clear-events` to reset |
| Held input persists across steps | `press` stays held — call `release`/`release-all` after |
| Two replay runs diverge | `Date.now()`/`Math.random()`/hash-order leaked into the fixed step — inject seed/`now`, retest |
| `pnpm test` green but scaffolded starter breaks | Packaging boundary untested — run `pnpm test:e2e`; a private `@quintus/*` leaked as a bare dep |
| qdbg can't connect | Dev server (:3050) or Playwright down — `BLOCKED:`, don't skip runtime verification |
| A finding is "the layout looks off" | Visual-design quality is out of scope here — route to `/design-review` |
