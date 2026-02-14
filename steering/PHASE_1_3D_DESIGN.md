# Phase 1 3D-Readiness: Avoiding Tech Debt Now

Small, low-risk changes to make during Phase 1 (or immediately after) that prevent
rework when 3D support lands in Phase 10.

These are ordered by impact. Total effort: ~2-3 hours.

---

## 1. Move `onDraw` from `Node` to `Node2D` ✅ Done

**The problem:** `Node` currently defines `onDraw(_ctx: DrawContext): void {}` at the
base class level (node.ts:276). This means every future `Node3D` subclass inherits a
2D-specific drawing method that takes a `DrawContext` full of `Vec2` parameters. It's
meaningless in 3D — Three.js rendering is declarative (set geometry + material, sync
transforms), not imperative (draw lines and circles each frame).

**What to change:**

- Remove `onDraw` from `Node` entirely
- Remove the `import type { DrawContext }` from `node.ts`
- Add `onDraw` as a method on `Node2D` only (it already overrides it there)
- `Canvas2DRenderer.collectVisible` already only operates on `Node2D` instances,
  and the prototype check (`node.onDraw !== baseOnDraw`) references
  `Node2D.prototype.onDraw` — no changes needed in the renderer

**Why it matters:** Without this, `Node3D extends Node` inherits `onDraw(ctx: DrawContext)`.
Developers would see it in autocomplete, try to use it, and get confused. Worse, an LLM
generating a 3D node class would see `onDraw` in the base class and try to override it
with 2D drawing calls inside a 3D node.

**Risk:** Very low. No external consumer calls `onDraw` on a plain `Node` — the renderer
only draws `Node2D` instances. Any plain `Node` subclass that overrides `onDraw` today is
already broken (it never gets called).

---

## 2. Extract `Renderer` interface and make it pluggable in `Game` ✅ Done

**The problem:** `Game` hardcodes `Canvas2DRenderer` in three places:

1. The import (game.ts:3)
2. The field type: `private renderer: Canvas2DRenderer | null` (game.ts:54)
3. Construction in the constructor (game.ts:98-104)
4. Calls to `markRenderDirty()` in `_switchScene` and `_loadScene` (game.ts:210, 224)

A 3D game using `ThreePlugin` needs to replace or augment the renderer. A headless game
needs no renderer at all. Today there's no way to do either without subclassing `Game`.

**What to change:**

Add a `Renderer` interface to `@quintus/core`:

```typescript
// packages/core/src/renderer.ts
export interface Renderer {
  /** Render the current scene. Called once per frame. */
  render(scene: Scene): void;
  /** Notify the renderer that the scene tree structure changed. */
  markRenderDirty(): void;
}
```

Update `Game` to use the interface:

```typescript
// In GameOptions:
renderer?: Renderer | null; // null = headless (no rendering)

// In Game class:
private renderer: Renderer | null;

// In constructor:
if (options.renderer === null) {
  this.renderer = null;
} else if (options.renderer) {
  this.renderer = options.renderer;
} else {
  this.renderer = new Canvas2DRenderer(this.canvas, ...);
}
```

Also expose a setter for plugins to swap renderers:

```typescript
/** @internal Used by renderer plugins (e.g. ThreePlugin) to replace the renderer. */
_setRenderer(renderer: Renderer | null): void {
  this.renderer = renderer;
}
```

**Why it matters:** This is the single proactive change called out in the 3D plan.
Without it, `ThreePlugin.install(game)` has no clean way to provide its own renderer.
The alternatives are worse: monkey-patching, subclassing Game, or adding a parallel
render path that bypasses the game loop.

`Canvas2DRenderer` already satisfies this interface shape — adding `implements Renderer`
is the only change to that class.

**Risk:** None. The default behavior is unchanged (Canvas2D). The interface is tiny and
stable. Headless mode (`renderer: null`) also becomes possible, which is useful for
testing and the `@quintus/headless` package.

---

## 3. Add `resize()` and `dispose()` to the `Renderer` interface ✅ Done

While extracting the interface, include lifecycle methods that Three.js will need:

```typescript
export interface Renderer {
  render(scene: Scene): void;
  markRenderDirty(): void;
  /** Handle canvas/viewport resize. */
  resize?(width: number, height: number): void;
  /** Clean up GPU resources. */
  dispose?(): void;
}
```

These are optional (marked with `?`) so `Canvas2DRenderer` doesn't need to implement
them today. But `ThreeRenderer` will need both — WebGL contexts must be resized
explicitly, and GPU resources (textures, shaders, framebuffers) must be freed on dispose.

Having them in the interface from day one means `Game.stop()` can call
`this.renderer?.dispose?.()` and window resize handlers can call
`this.renderer?.resize?.(w, h)` without knowing which renderer is active.

---

## 4. Make `Game` constructor work without a canvas ✅ Done

**The problem:** `Game` constructor always resolves or creates an `HTMLCanvasElement`
(game.ts:70-83). This fails in Node.js (no `document`) and is unnecessary for headless
simulation or server-side game logic.

**What to change:**

Make canvas resolution conditional on whether a renderer is requested:

```typescript
constructor(options: GameOptions) {
  // ... existing config ...

  // Canvas: only create if we need a renderer
  if (options.renderer !== null) {
    this.canvas = resolveCanvas(options.canvas, options.width, options.height);
    // ... pixelArt, etc ...
  }

  // Renderer
  if (options.renderer === null) {
    this.renderer = null;
  } else if (options.renderer) {
    this.renderer = options.renderer;
  } else {
    this.renderer = new Canvas2DRenderer(this.canvas!, ...);
  }
}
```

This unblocks `@quintus/headless`:

```typescript
const game = new Game({ width: 800, height: 600, renderer: null });
game.scene("sim", (scene) => { ... });
game.start("sim");
game.step(); // Runs logic without rendering
```

**Risk:** Low. Canvas becomes `HTMLCanvasElement | undefined` when `renderer: null`.
The only consumer of `game.canvas` is the renderer (which doesn't exist in headless
mode). TypeScript enforces this — accessing `game.canvas` in headless mode would be
a type error if we type it correctly, or documented as undefined behavior.

Actually, the simpler approach: keep `canvas` as a required field but allow
`Game` to skip creating the renderer. The canvas can still be created (jsdom provides
`document.createElement("canvas")` in tests). The key change is just: don't force a
Canvas2DRenderer when `renderer: null`.

---

## 5. Document the `_onChange` pattern for Vec3/Quaternion 📝 Documented

This isn't a code change — it's a note in the steering docs so Vec3 and Quaternion
follow the same dirty-flagging convention when they're built.

**The pattern (established in Vec2):**

```typescript
class Vec2 {
  private _x: number;
  private _y: number;
  _onChange?: () => void;

  set x(v: number) {
    if (this._x !== v) {
      this._x = v;
      this._onChange?.();
    }
  }
}
```

`Node2D` wires this up in its constructor:

```typescript
this._position = new Vec2(0, 0);
this._position._onChange = () => this._markTransformDirty();
```

**Vec3 and Quaternion must follow the same pattern** for Node3D transform dirty-flagging:

```typescript
// Vec3: _x, _y, _z with getters/setters + _onChange
// Quaternion: _x, _y, _z, _w with getters/setters + _onChange

// Node3D wires them the same way:
this._position = new Vec3(0, 0, 0);
this._position._onChange = () => this._markTransformDirty();
this._rotation = new Quaternion(0, 0, 0, 1);
this._rotation._onChange = () => this._markTransformDirty();
```

**Static constants must use the same `Object.freeze() as T` pattern:**

```typescript
static readonly ZERO = Object.freeze(new Vec3(0, 0, 0)) as Vec3;
static readonly IDENTITY = Object.freeze(new Quaternion(0, 0, 0, 1)) as Quaternion;
```

Without documenting this, a future implementer might use plain public fields on Vec3
(like the 3D_IMPLEMENTATION_PLAN.md code samples show: `public x, y, z`), creating an
inconsistency with Vec2 that breaks the dirty-flagging pattern.

---

## 6. Keep `Node` imports dimension-free ✅ Done

After moving `onDraw` to `Node2D` (item 1), verify that `node.ts` has zero imports from
`@quintus/math`. Currently it imports `DrawContext` which imports `Vec2` — this is the
only math dependency. Removing it makes Node truly dimension-agnostic, which is the core
architectural invariant from the 3D plan.

**Check list after changes:**
- `node.ts` imports: only `./signal.js` (for Signal)
- `node2d.ts` imports: `@quintus/math` (Vec2, Matrix2D), `./draw-context.js`, `./node.js`
- Future `node3d.ts` imports: `@quintus/math` (Vec3, Quaternion, Matrix4), `./node.js`

No cross-contamination between 2D and 3D branches.

---

## Summary

| # | Change | Effort | Impact | Risk |
|---|--------|--------|--------|------|
| 1 | Move `onDraw` from Node to Node2D | 15 min | High — keeps Node dimension-agnostic | Very low |
| 2 | Extract `Renderer` interface, plug into Game | 30 min | High — unblocks ThreePlugin and headless | None |
| 3 | Add optional `resize`/`dispose` to Renderer | 5 min | Medium — lifecycle hooks for GPU renderers | None |
| 4 | Game constructor without forced Canvas2DRenderer | 30 min | Medium — unblocks headless mode | Low |
| 5 | Document `_onChange` pattern for Vec3/Quaternion | 10 min | Medium — prevents inconsistency | None |
| 6 | Verify Node has zero math imports after #1 | 5 min | Low — confirms architectural invariant | None |

Items 1-3 are the highest priority. They're small changes with zero risk to existing
2D functionality that directly prevent coupling issues when Node3D and ThreeRenderer
arrive.

Item 4 is nice-to-have now but becomes critical for `@quintus/headless` (Phase 7).

Item 5 is a documentation-only change to prevent a common mistake.
