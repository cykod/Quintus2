# quintus2 Engine — Issues & Suggested Upstream Fixes

> **Purpose.** While building the Artillery Easter Egg (see `steering/2026-07-27_ARTILLARY_EASTER_EGG.md`) we integrated **[quintus2](https://www.npmjs.com/package/quintus2) `v0.0.4`** into an existing **Next.js 15 / React** page — i.e. the engine runs as an **embedded, non-fullscreen canvas inside a larger scrolling document**, not as a standalone full-viewport game. Across all five phases we hit the same class of problem repeatedly: **the published TypeScript types (`dist/index.d.ts`) describe the _shape_ of the API but not its _runtime behavior_**, and several defaults are implicitly designed for the full-screen-game case and misbehave when embedded.
>
> This doc collects each issue so it can be addressed **at the engine** (that's the durable fix). Each entry lists the observed behavior in `0.0.4`, why it matters for embedded integration, a suggested engine-level change, and the app-side workaround we currently ship (so this repo can drop the workaround once the engine is fixed).
>
> **Caveat:** diagnoses were reverse-engineered from `0.0.4`'s compiled `dist/` + `.d.ts` and observed runtime behavior, not from engine source. Treat the root-cause guesses as strong hypotheses to confirm against the source.

---

## Meta-issue: types document shape, not behavior

Four consecutive phases each lost time to a load-bearing behavior that the `.d.ts` signature did **not** reveal (`scale:"fit"`, `Node.destroy()` timing, `findByType` constructor constraint, `InputPlugin` document binding — all below). The single highest-value upstream improvement is **documenting the runtime contract** of the load-bearing APIs — ideally as TSDoc on the exported symbols so it shows up at the call site in-editor.

**Suggested engine change (umbrella):** add TSDoc to `GameOptions.scale`, `Node.destroy`, `Game.findByType`/`findAllByType`, `InputPlugin`, `reactiveState`, and `input.inject` stating the semantics (timing, side effects, scope), not just the types. Consider a short "Embedding quintus2 in an existing page" guide covering scale, input scope, and teardown.

---

## Issue 1 — `scale:"fit"` is a full-**viewport** letterbox, not a fit-to-element

- **Observed (`0.0.4`):** setting `GameOptions.scale: "fit"` runs `_setupFitScaling`, which sizes the canvas to `window.innerWidth`/`window.innerHeight` and `position:absolute`s it against the viewport. For a game embedded in a page, this **hijacks layout** — the canvas escapes its container and covers the viewport.
- **Why it matters for embedding:** there is no built-in way to say "scale the fixed design space uniformly into my container element." `"fit"` assumes the game owns the whole window.
- **Impact:** we could not use the documented/recommended `scale:"fit"` at all.
- **Suggested engine fix:** either (a) add a `scale: "fit-parent"` (or `container`/`element` option) that scales into the canvas's parent element instead of the viewport, or (b) let `fit` observe the parent when the game is not full-screen. Document that `"fit"` is viewport-scoped.
- **Our workaround:** use the default `scale:"fixed"` (engine leaves the canvas CSS alone) with an intrinsic 800×500 backing store, and do responsive sizing in CSS (`width:100%; height:auto`). The design-space→CSS-px factor is then simply `canvas.clientWidth / GAME_WIDTH`. See `src/game/artillery/boot.ts` and `src/components/ArtilleryEasterEgg.tsx` (`syncShipRect`).

---

## Issue 2 — `Node.destroy()` is deferred to frame-end, so post-destroy queries see stale nodes

- **Observed (`0.0.4`):** calling `node.destroy()` does **not** remove the node synchronously — removal is deferred (to end-of-frame). Code that destroys children and then immediately queries the tree (e.g. `count("target")`, `findAll(...)`) still sees the just-destroyed nodes.
- **Why it matters:** a "reset the scene" / "clear targets" operation that rebuilds state in the same tick reads an inconsistent tree. We hit this in `reset(seed)`: after destroying old targets, the count still included them, corrupting the new round.
- **Impact:** a real, test-caught bug (RED) during Phase 3.
- **Suggested engine fix:** either provide a **synchronous** removal API (e.g. `node.remove()` / `parent.removeChild(node)` that detaches immediately and also schedules `destroy` lifecycle), or document `destroy()`'s deferral explicitly and point callers at the synchronous path. Ideally `destroy()` detaches from the parent's child list synchronously and only defers heavier teardown.
- **Our workaround:** on reset, iterate a copy of children and call `parent.removeChild(child)` (synchronous detach) **then** `child.destroy()`, so subsequent queries are correct immediately. See `ArtilleryScene.reset()` in `src/game/artillery/scene.ts`.

---

## Issue 3 — `findByType` / `findAllByType` require a **zero-arg** constructor

- **Observed (`0.0.4`):** `Game.findByType(Ctor)` / `findAllByType(Ctor)` type their argument as a zero-arg `NodeConstructor`. Nodes whose constructor takes required args (e.g. our `Target(position: Vec2)`) **do not satisfy the type**, so you can't look them up by class — even though the lookup itself is presumably runtime `instanceof`-based and would work fine.
- **Why it matters:** it's a subtle asymmetry — a zero-arg node (`Terrain`) works with `findByType`, so the API looks available until you try it with a node that takes constructor args, and it fails to compile.
- **Impact:** forced a fallback lookup pattern.
- **Suggested engine fix:** relax the constraint to `abstract new (...args: any[]) => Node` (or `Function & { prototype: T }`) so any node class can be used as a type token; the runtime `instanceof` check doesn't care about constructor arity.
- **Our workaround:** look up by tag and narrow: `findAll("target").filter((n): n is Target => n instanceof Target)`. See `src/game/artillery/scene.ts`.

---

## Issue 4 — `InputPlugin` binds keydown on `document` and `preventDefault`s bound keys for the game's entire lifetime

- **Observed (`0.0.4`):** `InputPlugin` attaches a `keydown` listener on `document` and `preventDefault`s its bound keys (Space, arrows, …) for as long as the game is running — **regardless of whether the game canvas is focused or even visibly active**. For a full-screen game that's correct; for an embedded game it means the host page **cannot scroll with Space/arrows/PageDown** while the game exists, even when the game is idle/disguised and the user is just reading the page.
- **Why it matters (embedding):** this is the most disruptive of the set — it silently breaks normal page scrolling for the whole document as a side effect of merely instantiating the engine. It was the 4th consecutive "`.d.ts` didn't tell us" behavior and the only **High**-severity one.
- **Impact:** on our About page, Space/arrows stopped scrolling the page as soon as the (still-disguised, not-yet-activated) game booted.
- **Suggested engine fix:** scope input to the game surface by default — bind keydown on the **canvas/root element** (with `tabIndex`) rather than `document`, and/or only `preventDefault` when the game surface is focused. At minimum expose options: `inputTarget?: HTMLElement | Document`, `preventDefaultWhenUnfocused?: boolean`, and a way to enable/disable input capture at runtime (e.g. while the game is in an "attract"/idle state). Document the current global-capture behavior loudly.
- **Our workaround:** a capture-phase `document` keydown guard that `stopImmediatePropagation()`s the engine's bound keys **unless** the game is the focused, actively-playing surface — restoring page scroll at rest and while unfocused, and only capturing keys during active, focused play. Listener is added once and removed on unmount. See the keydown-guard effect in `src/components/ArtilleryEasterEgg.tsx`.

---

## Issue 5 — `input.inject(action, pressed)` buffer→apply timing is undocumented

- **Observed (`0.0.4`):** `input.inject(action, pressed)` is buffered and applied on the next `_beginFrame`, so a test/consumer that injects an action and then expects its effect must advance the correct number of frames — the injected value drains on one `step()`, and the code that *reads* it runs in the `onFixedUpdate` of that same (or next) frame. The exact drain-vs-effect frame count is not documented and had to be established empirically.
- **Why it matters:** deterministic/headless tests that drive input via `inject` are flaky unless the step count is exactly right; there's no signature-level hint of the buffering.
- **Impact:** minor — resolved once, then pinned as a shared constant, but it's a papercut for anyone writing input-driven tests.
- **Suggested engine fix:** document the buffer→apply timing on `input.inject` (and ideally on the headless/`renderer:null` stepping story), or expose a synchronous "flush injected input" helper for tests.
- **Our workaround:** empirically verified the drain count (one `step()` both drains the buffer and runs the reading `onFixedUpdate`) and pinned it as `INJECT_DRAIN_STEPS` in a shared test helper. See `src/game/artillery/__tests__/helpers.ts`.

---

## Non-engine notes (for completeness — not quintus2 bugs)

These bit us during the build but are **not** engine defects; recording them so they aren't mistaken for upstream work.

- **`reactiveState` module singletons persist across mounts.** `gameState` (and our own `motion.ts` flag) are module-level singletons; under React StrictMode's dev double-mount and client-side route revisits they retain prior state. This is expected module behavior, not an engine bug — the fix is discipline: `gameState.reset()` on boot **and** on unmount, and overwrite the motion flag on every boot. (Documented in the design doc's Implementation Notes.)
- **Headless construction under `renderer:null`.** Constructing/stepping a scene with `renderer:null` works cleanly **as long as no canvas-context method is called off the `onDraw` path** — this is an app-side invariant we maintain (pure masks/state, all painting in `onDraw`), and it let us test the whole simulation headlessly with **no** `vitest-canvas-mock`. Not an engine issue; a useful property worth the engine documenting as the supported headless-testing story.

---

## Summary table

| # | Area | Severity (to embedders) | Engine-level fix | Workaround shipped |
|---|------|-------------------------|------------------|--------------------|
| 1 | `scale:"fit"` = viewport letterbox | Medium | add fit-to-parent scale mode; document viewport scope | `scale:"fixed"` + CSS sizing |
| 2 | `destroy()` deferred; stale queries | Medium (bug-prone) | synchronous detach API / document deferral | `removeChild` then `destroy` |
| 3 | `findByType` needs zero-arg ctor | Low | relax type to any node ctor | tag lookup + `instanceof` narrow |
| 4 | `InputPlugin` global keydown capture | **High** | scope input to focused surface; add options | capture-phase keydown guard |
| 5 | `inject()` buffer timing undocumented | Low | document timing / add flush helper | pinned `INJECT_DRAIN_STEPS` |

All five share one root cause: **the `0.0.4` `.d.ts` conveys type shape but not runtime behavior/scope.** Fixing the behaviors is ideal; documenting the runtime contract (Meta-issue) is the cheapest high-leverage step.
