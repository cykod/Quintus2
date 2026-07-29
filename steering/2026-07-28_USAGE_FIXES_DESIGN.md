# Embedded-Integration Fixes — Detailed Design

> **Goal:** Make quintus2 behave correctly and legibly when embedded as a non-fullscreen canvas inside a larger host page, by fixing four runtime behaviors and documenting the load-bearing public API contract.
> **Outcome:** An embedder can drop the five app-side workarounds shipped in the Artillery build (see `steering/QUINTUS_FIXES.md`): input no longer hijacks page scroll, `destroy()` queries are consistent, `findByType` accepts any node class, a scale mode fits the parent element, and every load-bearing symbol documents its runtime contract in-editor.

This design responds to `steering/QUINTUS_FIXES.md`, which reverse-engineered five issues from `quintus2@0.0.4`'s compiled `dist/`. Every hypothesis in that doc was re-verified against the current engine source; the confirmations (and one correction) are recorded per-phase under **Ground truth**.

---

## Status

| Phase | Description | Severity to embedders | Status |
|-------|-------------|-----------------------|--------|
| 1 | Relax type-token constraint on `instanceof` queries (`findByType` et al.) | Low | **Done** |
| 2 | Filter destroyed nodes from tree queries (same-tick consistency) | Medium (bug-prone) | **Done** |
| 3 | Scope input capture to the game surface (opt-in) + runtime enable | **High** | **Done** |
| 4 | `scale: "fit-parent"` — fit design space into the parent element | Medium | Pending |
| 5 | Comprehensive TSDoc contract pass + "Embedding quintus2" guide | Meta (highest leverage) | Pending |

Phases are independent and can land in any order; **Phase 5 depends on 1–4** (it documents their final behavior) and must land last or be updated as each ships.

---

## Assumptions

1. **Back-compatibility is required.** quintus2 is published (`0.0.4`) and ships example games that rely on current defaults (full-viewport `"fit"`, `document`-scoped input). No phase may change the behavior of an existing full-screen game without an opt-in. Where the source doc's "ideal" fix implies a breaking default change, this design keeps the default and adds an opt-in, and records the breaking alternative under **Alternatives Considered**.
2. **The 21 `@quintus/*` packages are private internals** bundled into `quintus2`. Fixes land in the internal packages (`core`, `input`) and flow into `quintus2`'s bundle; no new public package is created.
3. **TSDoc is the primary documentation surface.** Per the request, the doc pass (Phase 5) is applied more expansively than `QUINTUS_FIXES.md` suggested — it covers the whole public surface an embedder touches, not just the six named symbols — because TSDoc shows up at the call site in-editor and is the cheapest high-leverage fix.
4. **No behavior is added speculatively.** Options are added only where an embedder demonstrably needs them (input target/enable, parent scaling). No general "plugin config" framework is introduced.
5. **`destroy()`'s end-of-frame deferral is deliberate, not a bug.** The update/render/input walks iterate the live `_children` and `destroy()` is commonly called mid-`onFixedUpdate`, so the tree must not be mutated synchronously. Phase 2 therefore fixes the *query* side (skip destroyed nodes), not the *destroy* side. `removeChild` (node.ts:240) remains the separate immediate detach-without-destroy path.

---

## Ground truth: hypotheses vs. current source

| # | `QUINTUS_FIXES.md` hypothesis | Verdict against source | Key file:line |
|---|-------------------------------|------------------------|---------------|
| 1 | `"fit"` sizes to `window.innerWidth/Height`, `position:absolute` vs viewport; no parent observation | **Confirmed.** Also `"fill"` on **desktop** falls back to the same letterbox. | `packages/core/src/game.ts:451`, `:526` |
| 2 | `destroy()` deferred to frame-end; post-destroy queries see stale nodes | **Confirmed.** `destroy()` only flags+queues (`:494`); the child-list splice happens in `_processDestroy` during end-of-frame `_cleanup`. | `packages/core/src/node.ts:494`, `:535`; `game.ts:445` |
| 3 | `findByType` requires a zero-arg constructor | **Confirmed.** `NodeConstructor<T> = { new (): T }` (`:16`) is shared by 7 `instanceof`-only query methods *and* by the genuine construction sites. | `packages/core/src/node.ts:16` |
| 4 | `InputPlugin` binds keydown on `document` and `preventDefault`s bound keys for the game's lifetime; no focus check | **Confirmed, with one nuance:** `preventDefault` is already **conditional** — only for bound key codes (`input._isBoundKey`), not all keys. Still `document`-scoped with no focus gate and no `inputTarget` option. | `packages/input/src/input-plugin.ts:80`, `:38` |
| 5 | `inject()` buffer→apply timing undocumented | **Partially stale:** `inject`/`injectAnalog` *do* carry TSDoc, but it references the `@internal` `_beginFrame()`, which an embedder can't map to `step()` counts. It's a doc-*quality* gap, not a doc-*absence*. | `packages/input/src/input.ts:119`, `:156` |
| Meta | TSDoc absent on load-bearing symbols | **Confirmed for the worst offenders:** `Node.destroy`, `findByType`, `findAllByType` have only section-banner comments; scaling methods are `private` with one-line docs. | `packages/core/src/node.ts:494`, `:330`/`:339` |

---

## Phase 1: Relax the type-token constraint on `instanceof` queries

**Problem.** `NodeConstructor<T>` is `{ new (): T }` (node.ts:16) — strictly zero-arg. It is used both by methods that **construct** a node (`add`, `NodePool`, the JSX factory, `TileMap.spawn*`) and by methods that only do a runtime `instanceof` check (`is`, `getChild`, `getChildren`, `findAll`, `findFirst`, `findByType`, `findAllByType`). The query methods don't care about constructor arity, but the shared type rejects any node whose constructor takes required args (e.g. `class Target extends Sensor { constructor(p: Vec2) }`).

**Fix.** Introduce a separate **type-token** type for the `instanceof`-based queries; keep `NodeConstructor` (zero-arg) for the construction sites.

```ts
// packages/core/src/node.ts — near line 16

/** A zero-arg class, usable to *construct* a node (`add`, pools, JSX). */
export interface NodeConstructor<T extends Node = Node> {
	new (): T;
}

/**
 * A class used purely as a runtime `instanceof` **type token** — for query/guard
 * methods (`is`, `findByType`, `getChild`, …) that never instantiate it.
 * Unlike {@link NodeConstructor}, it accepts node classes with required
 * constructor args (e.g. `class Target extends Sensor { constructor(p: Vec2) }`),
 * because `instanceof` does not care about arity.
 */
export type NodeType<T extends Node = Node> = abstract new (...args: never[]) => T;
```

`...args: never[]` (not `any[]`) satisfies Biome's `noExplicitAny: error`, and by contravariance a constructor with required params *is* assignable to it, as is a zero-arg constructor — so this strictly widens what compiles; no existing call breaks.

**Change the 7 query methods only** to take `NodeType<T>`:

| Method | node.ts line | New param type |
|--------|-------------|----------------|
| `is` | 276 | `NodeType<T>` |
| `findAll` (typed overload) | 291–292 | `NodeType<T>` |
| `findFirst` (typed overload) + `_findFirstByTag` | 301–306 | `NodeType<T>` / `NodeType<Node>` |
| `getChild` | 322 | `NodeType<T>` |
| `getChildren` | 326 | `NodeType<T>` |
| `findByType` | 330 | `NodeType<T>` |
| `findAllByType` + `_collectByType` | 339–345 | `NodeType<T>` |

**Leave unchanged (they construct):** `add` (node.ts:115), `NodePool` (pool.ts:158), JSX `h`/factory (`packages/jsx/src/h.ts:30,55,104,124` and `types.ts:79` `DeriveProps`), `TileMap.spawnObjects`/`spawn` (tilemap.ts:255,299). These keep `NodeConstructor`.

**Export** `NodeType` from `packages/core/src/index.ts:38` alongside `NodeConstructor`.

### Tests for Phase 1
**Unit:** `packages/core/src/node.test.ts`
- A node subclass with a required-arg constructor compiles as an argument to `findByType`/`findAllByType`/`is`/`getChild` (compile-time assertion via a `// @ts-expect-error`-free block; the test file failing to typecheck is the RED).
- Runtime: `findAllByType(Target)` returns instances of a required-arg `Target` subclass placed in the tree.
- Regression: zero-arg lookups (`findByType(Terrain)`) still return correctly.

**Success criterion:** `findAllByType` / `findByType` accept `class Target extends Sensor { constructor(p: Vec2){…} }` with no cast and return the right instances; `pnpm build` and `pnpm test` pass; `add(Target)` still fails to compile (it must, since `add` constructs).

> **Implementation note (shipped).** Phase 1's guarantee is compile-time only: esbuild strips
> types and `instanceof` never cared about constructor arity, so runtime tests in
> `node.test.ts` pass identically with and without the change. The real assertions therefore
> live in **`packages/core/src/node.test-d.ts`** and are enforced by `pnpm test`:
> `packages/jsx/tsconfig.typetest.json` was promoted to a root **`tsconfig.typetest.json`**
> covering `packages/*/src/**/*.test-d.{ts,tsx}`, and `vitest.config.ts`'s
> `typecheck.include` was widened to match. The `add()`-rejects-required-arg guarantee is
> pinned by a `// @ts-expect-error` there. The runtime tests in `node.test.ts` stay as cheap
> query regression coverage, retitled so they no longer read as verifying Phase 1.
> (Note: `npx tsc --noEmit -p packages/core` still lands red on a **pre-existing, unrelated**
> error at `asset-loader.test.ts:261`, which is why the gate is the vitest typecheck project
> and not a whole-package `tsc` run.)

---

## Phase 2: Filter destroyed nodes from tree queries (same-tick query consistency)

**Problem.** `destroy()` (node.ts:494) is deferred: it flags `_isDestroyed`/`_pendingDestroy` and enqueues; the actual splice out of `_parent._children` happens in `_processDestroy` during end-of-frame `_cleanup` (game.ts:445). All tree queries recurse over the live `_children`, so a `destroy()` followed by a same-tick `count("target")` / `findAll(...)` still sees the destroyed node. This caused a real RED bug in the Artillery `reset(seed)`. **The deferral itself is correct and must not change** (see below); the fix is to make queries agree with it.

**Why not synchronously splice in `destroy()`?** The update, render, and input walks iterate the **live** `_children` array (`scene.ts:86,104`, `canvas2d-renderer.ts:334`, `input-plugin.ts:111`), and `destroy()` is overwhelmingly called from *within* `onFixedUpdate` (e.g. `packages/prefabs/src/bullet.ts`, `examples/artillery/entities/projectile.tsx`). Splicing `_children` mid-`for...of` would skip the sibling *following* the destroyed node for that frame — a subtle, widespread stutter regression. Deferring the splice to end-of-frame is deliberate and must stay.

**Fix (non-mutating): make tree queries skip destroyed nodes.** The update/render walks already guard `if (node.isDestroyed) return` (scene.ts:79,97). Apply the same guard to the query/lookup methods so a destroyed-but-not-yet-processed node (and its subtree) is invisible to queries in the same tick, **without touching the tree**. `destroy()` stays exactly as-is.

**The invariant (one contract for the whole query family):** *a destroyed node and its
entire subtree are invisible to every tree query in the same tick — including when the
destroyed node is the **receiver** of the query.* Every method below must satisfy it; the
table is an implementation hint, not the spec. Tests must assert the invariant across all
seven public query methods, not the per-row mechanics.

Two mechanics are needed because `destroy()` flags **only the receiver** (descendants stay
unflagged until `_processDestroy`, node.ts:538): a **receiver guard** (`if (this.isDestroyed)`
at the top) makes the destroyed node's whole subtree vanish, and a **per-child skip** makes
the subtree vanish when the query enters from a live ancestor. Recursive walks need both.

| Method (`packages/core/src/node.ts`) | Receiver guard | Child skip |
|--------------------------------------|----------------|------------|
| `find` | `if (this.isDestroyed) return null;` | `if (child.isDestroyed) continue;` |
| `findByType` | `if (this.isDestroyed) return null;` | `if (child.isDestroyed) continue;` |
| `getChild` | `if (this.isDestroyed) return null;` | `!c.isDestroyed` in `.find()` |
| `getChildren` | `if (this.isDestroyed) return [];` | `!c.isDestroyed` in `.filter()` |
| `_findFirstByTag` (backs `findFirst`) | `if (this.isDestroyed) return null;` | n/a — recursion re-enters the guard |
| `_collectByTag` (backs `findAll`, and `Scene.count` → `findAll`) | `if (this.isDestroyed) return;` | n/a — same |
| `_collectByType` (backs `findAllByType`) | `if (this.isDestroyed) return;` | n/a — same |

> The `_collect*` / `_findFirstByTag` family recurses into `this`-guarded helpers, so the
> receiver guard alone covers both directions. `find` / `findByType` recurse into the *public*
> method on the child, and `getChild` / `getChildren` do not recurse at all, so those four need
> the explicit child skip as well.

```ts
// packages/core/src/node.ts:345
private _collectByType<T extends Node>(type: NodeType<T>, result: T[]): void {
	if (this.isDestroyed) return;              // skip destroyed node + subtree
	if (this instanceof type) result.push(this as unknown as T);
	for (const child of this._children) {
		child._collectByType(type, result);
	}
}
```

`Scene.count` (scene.ts:63) delegates to `findAll`, so it is fixed transitively. This resolves the Artillery `reset` bug with **zero tree mutation, no allocation, and no change to `destroy()` timing or subtree teardown ordering** — the sibling-skip regression, the determinism shift, and the removeChild-dance footgun all disappear.

**Consequence for the workaround / embedding guide.** After this fix a plain `destroy()` is same-tick-query-consistent, so the `removeChild()`+`destroy()` dance from `QUINTUS_FIXES.md` is no longer needed. That dance also has a latent footgun worth documenting (Phase 5): `removeChild()` sets `_parent = null` (node.ts:250), and `destroy()` enqueues via `this.sceneOrNull?._queueDestroy(this)` (node.ts:498) where `sceneOrNull` walks the now-null parent chain (node.ts:367) and returns `null` — so calling `removeChild()` **then** `destroy()` silently skips all destroy lifecycle (`onDestroy`, `onExitTree`, `treeExited`, signal `disconnectAll`). Guidance: to remove a node *with* lifecycle, call `destroy()` alone; `removeChild()` is detach-without-destroy and runs no destroy hooks.

### Alternatives Considered — Phase 2
- **(A) Recommended: filter destroyed nodes in queries (above).** Non-mutating, matches the engine's existing `isDestroyed` walk guards, no regression, no allocation; resolves the bug with `destroy()` alone.
- **(B) Synchronous splice in `destroy()`.** Detach from `_parent._children` immediately. *Rejected:* mutates the live array the update/render/input walks iterate, skipping the following sibling when `destroy()` is called mid-`onFixedUpdate` (the common case); "fixing" that by copying every walk's child array adds a per-node per-frame allocation with real GC cost and shifts deterministic subtree teardown ordering.
- **(C) Doc-only.** Leave queries as-is; document the deferral and the `destroy()`-then-`removeChild()` order. *Rejected:* preserves the footgun the source doc calls "bug-prone."

### Tests for Phase 2
**Unit:** `packages/core/src/node.test.ts`
- After `child.destroy()` (before `_processDestroy` runs), `find(name)` / `findAll(tag)` / `findFirst` / `findByType` / `findAllByType` / `getChild` / `getChildren` / `Scene.count` **all exclude** the child in the same tick (RED reproduction of the Artillery bug).
- A destroyed node's **descendants** are also excluded from queries (subtree skipped).
- `onExitTree`/`treeExited`/`onDestroy` still fire exactly once at end-of-frame `_cleanup`, and `destroy()` timing is otherwise unchanged (regression).

**Integration/headless:** `packages/core/src/scene.test.ts` (or headless)
- **Sibling-survival regression:** parent with children `[A, B, C]`; `B.destroy()` called inside `B.onFixedUpdate`; assert `C.onFixedUpdate` still runs that same step (guards against anyone reintroducing a mid-walk splice).
- A `reset()`-style routine that `destroy()`s all tagged nodes then rebuilds in the same tick sees a clean tree (the Artillery scenario, minimally reproduced).

**Success criterion:** the same-tick stale-query test is RED before the change and GREEN after; the sibling-survival test passes; all existing tests remain green; `destroy()` lifecycle timing is unchanged.

> **Scope note (shipped).** The parallel `PhysicsWorld` scene-query surface (`raycast`,
> `raycastAll`, `queryPoint`, `queryRect`, `queryCircle`, `queryShape`, `shapeCast`, and the
> `Actor.findNearest`/`raycast`/`hasLineOfSight` helpers that delegate to them) was brought
> into line at the same time, so both query APIs answer "is this node still in the game?"
> identically. One guard in the shared choke point `packages/physics/src/query-filter.ts`
> (`matchesQuery` — called *only* by those six methods) covers all of them. The collision
> solver collects candidates straight from the spatial hash and never calls `matchesQuery`,
> so collision resolution is untouched: a body destroyed mid-frame still resolves collisions
> for the remainder of that frame, and nothing falls through a platform destroyed mid-tick.
> Covered by new tests in `packages/physics/src/query.test.ts`.

> **Implementation note (shipped).** RED was verified by reverting `node.ts` alone: 5 of the new tests fail (the 4 `node.test.ts` same-tick/subtree cases plus the `scene.test.ts` reset-then-rebuild case) and pass after. The sibling-survival and `destroy()`-timing tests pass in both states by design — they are regression guards, not fixes. Full suite green (do not cite absolute counts — they go stale within a commit; paste the run's summary line instead).
>
> `getChildren(CollisionShape)` in `physics/collision-object.ts` is the only internal consumer affected. Once the **receiver** guard was added (see the invariant above), a destroyed body reported *zero* shapes, which made an actor fall straight through a platform destroyed mid-tick — measured against the real solver, not assumed. `CollisionObject.getShapes()` therefore now walks `children` directly instead of going through `getChildren`, so the solver keeps a destroyed body solid for the remainder of the frame in which it was destroyed (individually destroyed *shapes* are still skipped, as before). This keeps the two contracts cleanly separated: **tree and scene queries answer "is it still in the game?" — immediately; the solver answers "what did this step collide with?" — unchanged, end-of-frame.** Pinned by regression tests in `packages/physics/src/integration.test.ts` and `collision-object.test.ts`.

---

## Phase 3: Scope input capture to the game surface (opt-in) + runtime enable

**Problem (High severity).** `InputPlugin` binds `keydown`/`keyup` to `document` (input-plugin.ts:80) and `preventDefault`s bound key codes (input-plugin.ts:38). For an embedded game this means the host page cannot scroll with Space/arrows/PageDown for the *entire lifetime of the game object* — even while the game is idle, disguised, or off-screen — as a side effect of merely instantiating the engine. There is no focus gate and no `inputTarget` option; `InputConfig` exposes only `actions` and `deadZone` (input.ts:5).

**Fix.** Add three opt-in controls to `InputConfig`, plus a runtime enable switch, keeping the default (`document`, always-on) unchanged for back-compat with shipped full-screen examples.

```ts
// packages/input/src/input.ts — InputConfig (line 5)
export interface InputConfig {
	actions: Record<string, string[]>;
	deadZone?: number;

	/**
	 * Element that receives keyboard listeners. Default: `document`.
	 * Pass the game canvas (or a focusable wrapper) to scope key capture to
	 * the game surface when embedding in a page. Keyboard events only reach a
	 * non-`document` element while it is focused, so the plugin sets
	 * `tabIndex = -1` on it if it has none (and warns once if it still can't be
	 * focused) — otherwise the game would silently receive no keyboard input.
	 */
	keyTarget?: HTMLElement | Document;

	/**
	 * When `preventDefault` runs on a bound key. Default: `"always"` (current
	 * behavior). `"focused"` only prevents default while `keyTarget` (or a node
	 * inside it) is the active element — so an idle/unfocused embedded game
	 * never blocks host-page scrolling.
	 */
	preventDefaultPolicy?: "always" | "focused";
}
```

Runtime enable (covers the "attract/idle" state where the game exists but shouldn't capture input at all):

```ts
// packages/input/src/input.ts — Input class
/**
 * When false, no input is applied: keyboard is not captured (no `preventDefault`),
 * pointer presses are not buffered, and pending/injected input is dropped. Held
 * actions are released on disable. Default: true.
 */
get enabled(): boolean;
setEnabled(v: boolean): void;   // on false → _releaseAll() and clear input/injection buffers
```

**Wiring (`packages/input/src/input-plugin.ts` + `input.ts`):**
- Read `keyTarget` (default `document`) into a local; attach `keydown`/`keyup` to it (line 80) and remove them from **the same target** on `game.stopped` (line 90). When `keyTarget` is a non-`document` element with no `tabIndex`, set `tabIndex = -1` so it can receive key events (warn once if it still isn't focusable).
- Gate **all** input on `enabled`, so `setEnabled(false)` genuinely freezes the game (the "attract/idle" state), matching the doc: in `onKeyDown` (line 38) early-return if `!input.enabled`; in the pointer handlers `onPointerDown`/`onPointerMove`/`onPointerUp` (input-plugin.ts:48–61) early-return if `!input.enabled`; and in `Input._beginFrame` (input.ts:156) skip `_flushInputBuffers()`/`_flushInjectionBuffer()` and clear both buffers when disabled, so no buffered or injected input applies while disabled.
- Gate `preventDefault` on the policy: `if (input._isBoundKey(e.code) && input._shouldPreventDefault()) e.preventDefault();` where `_shouldPreventDefault()` returns `true` for `"always"`, and for `"focused"` returns whether `keyTarget` contains/is `document.activeElement`.
- Keep the `window` blur→`_releaseAll` as-is.

**Focused-policy helper (`Input`):** store `keyTarget` and `preventDefaultPolicy` on the `Input` instance (passed from config) so `_shouldPreventDefault()` is self-contained and unit-testable without the DOM plugin.

This lets an embedder pass `{ keyTarget: canvas, preventDefaultPolicy: "focused" }` and toggle `input.setEnabled(playing)` — replacing the app-side capture-phase keydown guard entirely.

### Alternatives Considered — Phase 3
- **(A) Recommended: opt-in options + runtime enable, default unchanged.** *Pro:* zero regression for shipped full-screen examples; embedders get exactly the controls the workaround implemented. *Con:* embedders must know to set them (mitigated by the Phase 5 "Embedding" guide and loud TSDoc).
- **(B) Flip the default to canvas-scoped + focus-gated.** Matches the source doc's "scope input to the game surface by default." *Pro:* embedded-correct out of the box; nobody hits the footgun. *Con:* **breaking** — every shipped example (platformer, dungeon, breakout, advanced-platformer, artillery) and qdbg's real-key story assumes `document` capture; a full-screen game would stop responding until its canvas is focused. Rejected as the default for `0.x`→ but a candidate for a future major.

> **Decision (resolved by the human, pre-implementation): (A).** `document`-scoped, always-on
> `preventDefault` stays the default; `keyTarget` / `preventDefaultPolicy` / `setEnabled` ship as
> opt-in controls. Every shipped full-screen example and qdbg's real-key story keeps working with
> zero changes. **(B)** is recorded as a future-major consideration only (call it out in the
> Phase 5 embedding guide).

### Tests for Phase 3
**Unit:** `packages/input/src/input.test.ts` (+ a jsdom test for the plugin, matching existing `input-plugin` tests)
- `preventDefaultPolicy: "always"` → bound key calls `preventDefault` regardless of focus (regression: current behavior).
- `preventDefaultPolicy: "focused"` → bound key does **not** `preventDefault` when `document.activeElement` is outside `keyTarget`; **does** when inside.
- `keyTarget: element` → listeners attach to that element, not `document`; unbound keys never `preventDefault` (regression); a `tabIndex`-less element gets `tabIndex = -1` set by the plugin.
- `setEnabled(false)` → no input applies: keyboard `preventDefault` skipped, **pointer presses not buffered, injected actions dropped**, `_releaseAll` fires and buffers clear; `setEnabled(true)` restores.
- Cleanup: on `game.stopped`, listeners are removed from the configured `keyTarget` (not `document`).

**Success criterion:** with `{ keyTarget: canvas, preventDefaultPolicy: "focused" }` and the canvas unfocused, a bound Space keydown does **not** call `preventDefault` (host page would scroll); focused, it does. All existing input tests stay green with defaults.

> **Implementation note (shipped).** Landed exactly as specified, plus three small decisions the
> design left open:
> 1. **Gamepad polling is gated on `enabled` too** (`Input._pollGamepad` early-returns). `_pollGamepad`
>    mutates active bindings directly rather than going through a buffer, so without this gate a
>    disabled `Input` would still respond to a gamepad — contradicting the documented "no input is
>    applied". One line; covered by a test.
> 2. **`ensureFocusable` skips natively-focusable targets.** It only sets `tabIndex = -1` when the
>    element has no `tabindex` attribute *and* reports `tabIndex < 0`, so passing a `<button>`-like
>    wrapper doesn't get yanked out of the page's tab order.
>    **Correction (post-review fix pass):** the design asked for a warn when the target "still can't
>    be focused". As first shipped that branch was **unreachable** — `keyTarget.tabIndex = -1`
>    reflects to the `tabindex` attribute, so the following `!hasAttribute("tabindex")` was never
>    true, and the promised warning never fired. It now warns on `!keyTarget.isConnected` instead,
>    which is the reachable, genuinely-fatal case (a detached element receives no key events); it
>    fires once per install and is pinned by
>    `input-plugin.test.ts > "warns when the keyTarget is detached from the document"`.
> 3. **`keyTarget.addEventListener(...)` needs an `as EventListener` cast.** TypeScript collapses the
>    `HTMLElement | Document` union to the untyped `addEventListener` overload; the handlers keep
>    their `KeyboardEvent` parameter types at the declaration site. Verified with `tsc`, not assumed.
>
> `_shouldPreventDefault()` is a pure method on `Input` (reads the stored `_keyTarget` /
> `_preventDefaultPolicy` and `document.activeElement`), so the focused-policy matrix is unit-tested
> without the DOM plugin. `_releaseAll()` and the disabled `_beginFrame()` path share one
> `_clearBuffers()` private helper. Type-level contracts for `keyTarget` / `preventDefaultPolicy` /
> `enabled` / `setEnabled` are pinned in **`packages/input/src/input.test-d.ts`** (gated by
> `pnpm test` via the root `tsconfig.typetest.json`).
>
> **Post-review fix pass (shipped).** Five further changes, each pinned by a test:
> 1. **`setMousePosition()` is gated on `enabled`.** `@quintus/touch` (`TouchFollowZone`,
>    `VirtualAimStick`) calls it directly rather than through `InputPlugin`, so a touch drag moved
>    the pointer while "frozen". The `@internal _setMousePosition` stays ungated as the deliberate
>    debug/test override (`qdbg mouse` must work regardless of input state). `Input.enabled`'s TSDoc
>    is now stated as an **invariant** rather than a list of gated call sites, and
>    `input.test.ts > "disabled invariant"` is one table-driven test over every mutating entry point.
> 2. **Keys typed into a form field or `contenteditable` no longer reach the game.** Real key events
>    bubble, so an `<input>`/`<textarea>`/`<select>`/`contenteditable` anywhere under the `keyTarget`
>    both got `preventDefault`ed and fired the bound action. `onKeyDown` now bails on such targets.
>    Applied to the **default** config too — it is a bug fix, not a behavior change any game wants
>    (no shipped example contains a form element; verified). `onKeyUp` deliberately does **not** bail,
>    so a key held before focus moved into a field still releases and never sticks.
> 3. **`preventDefaultPolicy: "focused"` without a `keyTarget` warns at install.** `document` always
>    contains the active element, so the policy silently collapses to `"always"` — the single most
>    likely embedder mistake. TSDoc says so too.
> 4. **`keyTarget` is resolved once**, on `Input`; the plugin reads `input._keyTarget` instead of
>    re-deriving the default, so the listener target and the focus check cannot drift apart.
> 5. **`_shouldPreventDefault()` walks open shadow roots.** `document.activeElement` reports the
>    shadow *host*, so a web-component-wrapped game never prevented default while focused.
>
> Also: `qdbg status` now appends `Input: DISABLED` when the game's input is disabled, so
> `press`/`tap` silently no-opping is diagnosable.

---

## Phase 4: `scale: "fit-parent"` — fit the design space into the parent element

**Problem.** `_setupFitScaling` (game.ts:526) is a viewport letterbox: it computes CSS size from `window.innerWidth/innerHeight`, sets `position:absolute`, and centers against the window. There is no mode that scales the fixed design space uniformly into the canvas's **parent element**, so `"fit"` hijacks layout for an embedded canvas. (`"fill"` on desktop also falls back to this letterbox.)

**Fix.** Add a fourth scale mode, `"fit-parent"`, that letterboxes into the parent element's content box instead of the viewport, driven by a `ResizeObserver` on the parent.

```ts
// packages/core/src/game.ts — GameOptions.scale (line 26)
scale?: "fit" | "fixed" | "fill" | "fit-parent";
```

```ts
// packages/core/src/game.ts — _setupScaling switch (line 451)
case "fit-parent":
	this._setupFitParentScaling();
	break;
```

**`_setupFitParentScaling()`** — mirror `_setupFitScaling` (game.ts:526) but:
- Measure `canvas.parentElement` (guard: if none, warn once and fall back to `_setupFitScaling`).
- Preserve internal resolution (backing store unchanged — same as `"fit"`); compute CSS `width`/`height` from the **parent's** `clientWidth`/`clientHeight` vs the game aspect ratio, letterboxing the shorter axis.
- Set `position: relative` / `margin: auto` (or `left`/`top` centering **within** the parent) — do **not** use viewport-absolute positioning; the canvas must stay in normal flow so it doesn't escape its container.
- **Drive the first fit from the `ResizeObserver`'s initial callback, not a constructor read.** `_setupScaling` runs in the `Game` constructor (game.ts:162); reading `parentElement.clientWidth/clientHeight` there can be `0` before layout (React not flushed, `display:none`, not yet attached). A `ResizeObserver` fires once on `observe()` with the laid-out size, so the initial fit lands correctly and re-fits on later resizes — one code path, no stale 0×0. Treat `clientWidth === 0 || clientHeight === 0` as "defer" (skip applying) rather than writing a 0-sized canvas.
- Observe the parent with a `ResizeObserver` (available in all modern browsers; the engine already targets DOM). Recompute on parent resize instead of listening to `window` resize. Disconnect the observer on `game.stopped` (mirror the listener-removal at game.ts:558-560). The no-parent fallback to `_setupFitScaling` must **not** also register the observer (avoid double-registration / mixed window+parent listeners).
- Emit `this.resized` after each recompute (same contract as `"fill"`).

Because the design→CSS-px factor becomes `canvas.clientWidth / GAME_WIDTH`, the embedder's `syncShipRect`-style overlay math still works — and now the engine, not the app, owns the responsive sizing.

**Note:** keep `"fit"` semantics exactly as-is (viewport) for back-compat; document the distinction in Phase 5.

### Alternatives Considered — Phase 4
- **(A) Recommended: new `"fit-parent"` mode** — explicit, discoverable via the `scale` union, no change to existing modes.
- **(B) Make `"fit"` observe the parent when not full-screen** (auto-detect). *Con:* ambiguous "full-screen" heuristic; silently changes `"fit"` for existing users. Rejected.
- **(C) `element?: HTMLElement` option** to point any mode at a container. *Con:* more surface than needed; `"fit-parent"` covers the concrete need (parent = the natural container). If a future case needs an arbitrary element, add it then (YAGNI).

### Tests for Phase 4
**Unit/jsdom:** `packages/core/src/game-scaling.test.ts`
- `scale: "fit-parent"` with a sized parent → canvas CSS width/height letterbox into the parent's box, aspect-ratio preserved, backing store unchanged; positioning is in-flow (not `position:absolute` against viewport).
- No parent element → falls back to `_setupFitScaling` and warns once (assert no throw).
- Resizing the parent (simulate `ResizeObserver` callback / manual recompute) updates CSS and emits `resized`.
- **Zero-sized-then-sized parent:** parent starts `0×0` (unlaid-out) → no canvas CSS is applied; when the observer reports a nonzero size, the fit lands. (RED without the ResizeObserver-first approach.)
- Regression: `"fit"` still sizes to `window.innerWidth/innerHeight` and sets `position:absolute`.
- Cleanup: on `game.stopped` the observer is disconnected; the fallback path registers no observer.

**Success criterion:** a canvas whose parent is 400×250 with an 800×500 design space gets CSS ~400×250 (uniform scale, letterboxed), stays inside the parent (no viewport takeover), and re-fits when the parent resizes.

> **`ResizeObserver` in tests:** jsdom lacks `ResizeObserver`; the test provides a minimal polyfill/mock (as `game-scaling.test.ts` already mocks `window` sizing) or drives the recompute method directly.

---

## Phase 5: Comprehensive TSDoc contract pass + "Embedding quintus2" guide

This is the meta-issue and, per the request, the highest-leverage phase — applied **more expansively** than `QUINTUS_FIXES.md` proposed. The rule for every symbol below: **document the runtime contract (timing, side effects, scope, teardown obligations), not the type.** Each load-bearing symbol gets an `@example` showing the embedded-in-a-page case, and an `@see` link to the embedding guide.

### 5a. TSDoc on the load-bearing public surface

| Symbol | File:line | Contract to state |
|--------|-----------|-------------------|
| `Node.destroy()` | node.ts:494 | Deferred: the node is flagged `isDestroyed` immediately (so tree queries stop returning it in the same tick — Phase 2), but its splice from the parent and full teardown (`onDestroy`, `onExitTree`, `treeExited`, child recursion, signal disconnect) run at end-of-frame `_cleanup`. Safe to call from `onFixedUpdate`. `@see removeChild`. |
| `Node.removeChild` / `removeSelf` | node.ts:240,266 | Immediate synchronous detach; node is **not** destroyed and **no destroy hooks run**. Do not call `removeChild()` then `destroy()` — that nulls `_parent`, so `destroy()` can't reach the scene queue and lifecycle is silently skipped. Contrast with `destroy()`. |
| `Node.findByType` / `findAllByType` | node.ts:330,339 | Runtime `instanceof`; `findByType` excludes `this` and recurses children; `findAllByType` **includes** `this`. Accepts any node class (`NodeType`), incl. required-arg constructors. |
| `Node.is` / `getChild` / `getChildren` / `findAll` / `findFirst` | node.ts:276,322,326,290,300 | Same `NodeType` token semantics; note which include `this`. |
| `NodeType` vs `NodeConstructor` | node.ts:16 | Token-vs-constructor distinction (from Phase 1). |
| `GameOptions.scale` (+ each mode) | game.ts:26 | `"fixed"` = leave CSS alone; `"fit"` = **viewport** letterbox (`position:absolute`, escapes container); `"fill"` = mobile fills viewport, desktop falls back to `"fit"`; `"fit-parent"` = letterbox into parent element (embedding-safe). |
| `GameOptions` (all fields) | game.ts:21–48 | Confirm each field documents its runtime effect (most already do; tighten `scale`/`fillAxis`/`canvas`). |
| `Input.inject` / `injectAnalog` | input.ts:119,128 | Rewrite timing in terms the consumer controls: "buffered; applied at the start of the next frame (`step()` in headless), **before** any `onFixedUpdate`. In headless tests, one `step()` both drains the buffer and runs the reading `onFixedUpdate` — so inject, then `step()` once to observe the effect." Replace the `_beginFrame()` reference (internal, unmappable by consumers). |
| `InputConfig` (all fields, incl. new `keyTarget`/`preventDefaultPolicy`) | input.ts:5 | Default `keyTarget` = `document`; `preventDefault` scope; runtime `setEnabled`. State the global-capture default **loudly**. |
| `Input.setEnabled` / `enabled` | input.ts (new) | Runtime capture toggle; disabling releases all held actions. |
| `reactiveState` | (locate in core) | Document that returned state is a **module-level singleton by convention** and persists across scene re-entry / React re-mounts; call `.reset()` on boot and teardown. (This is the app-side note in `QUINTUS_FIXES.md` §Non-engine — worth documenting so embedders aren't surprised.) |

> **`private` scaling methods:** `_setupFitScaling`/`_setupFitParentScaling` stay `private`, so their TSDoc won't surface at call sites — the observable contract is documented on `GameOptions.scale` (the public symbol) instead. Keep the private one-liners accurate.

### 5b. "Embedding quintus2 in an existing page" guide

New Markdown doc (e.g. `docs/embedding.md`, surfaced via TypeDoc), covering the four axes an embedder hits, each cross-linked from the relevant symbol's `@see`:
1. **Scale** — use `scale: "fit-parent"` (or `"fixed"` + CSS); why `"fit"`/`"fill"` take the viewport.
2. **Input scope** — `keyTarget: canvas` + `preventDefaultPolicy: "focused"` + `setEnabled(playing)` for attract/idle states; the default global-capture caveat.
3. **Teardown** — `game.stop()` obligations; `reactiveState().reset()` on unmount; module-singleton persistence under React StrictMode double-mount.
4. **Headless testing** — the supported story: `renderer: null` works as long as no canvas-context method is called off the `onDraw` path (from `QUINTUS_FIXES.md` §Non-engine); `inject` → `step()` timing.

### Tests / verification for Phase 5
Documentation has no unit tests; verify via:
- `pnpm docs` (TypeDoc) builds with no warnings and renders the new TSDoc + the embedding guide.
- A doc-lint check that the six originally-named symbols (`GameOptions.scale`, `Node.destroy`, `findByType`, `findAllByType`, `InputConfig`/`InputPlugin`, `reactiveState`, `input.inject`) each carry a TSDoc block (can be a simple grep-based test or manual checklist).
- `@example` blocks compile (if the repo runs `typedoc`'s or `tsd`'s example checking; otherwise eyeball against the real API).

**Success criterion:** hovering `destroy`, `findByType`, `scale`, and `inject` in an editor shows the runtime contract (timing/scope/side-effects), not just the type; `docs/embedding.md` exists and is linked from TypeDoc; `pnpm docs` is clean.

---

## Files touched (surgical scope)

| File | Phase | Change |
|------|-------|--------|
| `packages/core/src/node.ts` | 1, 2, 5 | Add `NodeType`; retype 7 query methods; add `isDestroyed` receiver-guard + child-skip to the query/lookup methods; TSDoc. |
| `packages/core/src/index.ts` | 1 | Export `NodeType`. |
| `packages/physics/src/query-filter.ts` | 2 | `matchesQuery` excludes destroyed bodies, so scene queries agree with tree queries. |
| `packages/physics/src/collision-object.ts` | 2 | `getShapes()` walks `children` directly, so the *solver* keeps a mid-tick-destroyed body solid for the rest of the frame. |
| `tsconfig.typetest.json` (new) + `vitest.config.ts` | 1 | Gate `packages/*/src/**/*.test-d.ts` under `pnpm test` (supersedes `packages/jsx/tsconfig.typetest.json`). |
| `packages/core/src/game.ts` | 4, 5 | `"fit-parent"` mode + `_setupFitParentScaling`; TSDoc on `GameOptions`. |
| `packages/input/src/input.ts` | 3, 5 | `keyTarget`/`preventDefaultPolicy` on `InputConfig`; `enabled`/`setEnabled`; `_shouldPreventDefault`; TSDoc on `inject`/config. |
| `packages/input/src/input-plugin.ts` | 3 | Bind to `keyTarget` (+ `tabIndex` handling); `enabled` gates on key/pointer handlers; policy gate in `onKeyDown`; cleanup from configured target. |
| `docs/embedding.md` (new) | 5 | Embedding guide. |
| Test files alongside each source file | 1–4 | Per-phase tests above. |

**Deliberately left alone:** `add`/`NodePool`/JSX factory/`TileMap.spawn*` (keep `NodeConstructor`); `"fit"`/`"fill"` runtime behavior (only documented, not changed); pointer/blur wiring in `input-plugin.ts`; the `reactiveState` implementation (documented, not changed).

---

## Definition of Done

- [x] Phase 1: `NodeType` added and exported; 7 query methods retyped; required-arg node classes accept in `findByType`/`findAllByType`; construction sites still require zero-arg. Type-level assertions live in `packages/core/src/node.test-d.ts` and are **gated by `pnpm test`** (root `tsconfig.typetest.json` + widened `typecheck.include`).
- [x] Phase 2: every tree query — receiver included — skips `isDestroyed` nodes and their subtrees; same-tick stale-query test RED→GREEN; sibling-survival test passes; all existing tests green; `destroy()` timing unchanged. `PhysicsWorld` scene queries filter destroyed bodies too, so both query APIs agree.
- [x] Phase 3: `keyTarget`, `preventDefaultPolicy`, `setEnabled` implemented (with pointer/injection/gamepad gating and `tabIndex` handling); focused-policy and disabled-input tests pass; defaults unchanged and existing input tests green. Decision **(A)** confirmed by the human: defaults stay `document`/always-on, the new controls are opt-in.
- [ ] Phase 4: `"fit-parent"` mode letterboxes into the parent, re-fits on parent resize, disconnects observer on stop; `"fit"` regression intact.
- [ ] Phase 5: TSDoc runtime contracts on the full load-bearing surface; `docs/embedding.md` created and linked; `pnpm docs` clean.
- [ ] `pnpm build` succeeds; `pnpm test` passes with no warnings; `pnpm lint` clean.
- [ ] `steering/QUINTUS_FIXES.md` updated to mark each issue's workaround as droppable once the corresponding phase ships (or a follow-up note added).

---

## Open decisions to confirm before implementation

1. ~~**Phase 3 — input default:** keep `document`/always-on capture as the default and ship the opt-in controls (recommended A), or flip the default to embedded-safe (canvas-scoped + focus-gated) — which is **breaking** for the shipped full-screen examples and belongs in a future major (B)?~~ **Resolved by the human as (A)** before implementation: defaults unchanged, `keyTarget` / `preventDefaultPolicy` / `setEnabled` ship as opt-in. (B) is a future-major consideration to note in the Phase 5 embedding guide.

_Resolved during review:_ Phase 2 uses non-mutating query-filtering (safe, non-breaking) rather than a synchronous splice — no sign-off needed. Phase 4 uses the narrower `"fit-parent"` mode name; a general `element?` option is deferred (YAGNI).
