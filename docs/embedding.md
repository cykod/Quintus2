---
title: Embedding quintus2
---

# Embedding quintus2 in an existing page

quintus2's defaults are tuned for a game that owns the whole browser window: the canvas
letterboxes into the viewport and the keyboard is captured on `document`. Both are wrong
when the game is one element inside a larger, scrolling page — a landing-page demo, a
tutorial widget, an easter egg on an About page.

This guide covers the four things that behave differently when embedded: **scale**, **input
scope**, **teardown**, and **headless testing**. Everything here is opt-in; a full-screen
game needs none of it.

## TL;DR

```ts
import { Game, InputPlugin } from "quintus2";
import { gameState } from "./state";

// The game gets its OWN container — no siblings inside it.
const box = document.getElementById("game-box")!;
const canvas = document.createElement("canvas");
box.appendChild(canvas);

const game = new Game({
	width: 800,
	height: 500,
	canvas,
	scale: "fit-parent", // letterbox into `box`, stay in normal flow
});

game.use(
	InputPlugin({
		actions: { jump: ["Space"], left: ["ArrowLeft"], right: ["ArrowRight"] },
		keyTarget: canvas, // don't bind keys on `document`
		preventDefaultPolicy: "focused", // don't eat the page's scroll keys when unfocused
	}),
);

// A `keyTarget` is only *focusable*, never automatically *focused*.
canvas.addEventListener("pointerdown", () => canvas.focus());

gameState.reset();
game.registerScenes({ title: TitleScene, level1: Level1 });
game.start("title");

// On unmount:
//   game.stop();
//   canvas.remove();
//   gameState.reset();
```

---

## 1. Scale — keep the canvas inside its container

`GameOptions.scale` has four modes. Only one of them is embedding-safe.

| Mode | What it does | Changes `game.width`/`height`? |
|------|--------------|-------------------------------|
| `"fixed"` (default) | Leaves the canvas CSS completely alone. You size it in your own stylesheet. | No |
| `"fit"` | Letterboxes into the **viewport**: `position: absolute`, offsets measured against `window.innerWidth`/`innerHeight`. **Escapes its container and covers the page.** | No |
| `"fill"` | On a coarse-pointer (mobile) device, fills the viewport and *changes the internal resolution* along `fillAxis`. On desktop it falls back to `"fit"`. | Yes, on mobile |
| `"fit-parent"` | Letterboxes into the canvas's **parent element**, staying in normal flow. Re-fits via `ResizeObserver`. | No |

`"fit"` and `"fill"` assume the game owns the window. They are not "responsive sizing"
modes — they are full-screen modes. In a page they will cover your content.

### Using `"fit-parent"`

```ts
const game = new Game({ width: 800, height: 500, canvas, scale: "fit-parent" });
```

The mode preserves the 800×500 backing store and computes a CSS width/height that fits the
parent's **content box** while preserving the aspect ratio, centring the result with
`position: relative` plus `left`/`top` offsets.

Three requirements, each of which the engine warns about when it can detect a violation:

**Give the game its own container element.** `left`/`top` on a `position: relative` element
offset from the element's *normal-flow* origin, which coincides with the parent's
content-box origin only when the canvas is the parent's first in-flow child. Put a toolbar
or a caption in the same container *before* the canvas and the canvas is displaced
downwards by that sibling's height and overflows the container's bottom edge by the same
amount. Wrap the canvas in a container of its own and put the toolbar outside it:

```html
<div class="game-widget">
  <div class="game-toolbar">Score: 0</div>
  <div id="game-box"><!-- canvas goes here, alone --></div>
</div>
```

**Give the container an explicit size.** The fit measures the parent, so a parent whose
height is derived from its content (the default for a `<div>`, and for `<body>`) can never
letterbox vertically — the fit degenerates to a plain width-fill. An `aspect-ratio` or a
fixed height is enough:

```css
#game-box { width: 100%; max-width: 800px; aspect-ratio: 8 / 5; }
```

`"fit-parent"` warns once when its parent is `<body>`, which is what the auto-created-canvas
path produces if you don't pass a `canvas` yourself.

**Have a parent and a `ResizeObserver`.** With no parent element, or in an environment
without a global `ResizeObserver` (jsdom), the mode warns once and falls back to `"fit"`.
That fallback is viewport-scoped — if your own jsdom tests construct a `Game` with
`scale: "fit-parent"`, either polyfill `ResizeObserver` or use `scale: "fixed"` in tests.

### Positioning HTML overlays on top of the canvas

The design-space → CSS-pixel factor is:

```ts
const factor = canvas.clientWidth / game.width;
```

Recompute it whenever the canvas is re-fitted. `game.resized` fires after each re-fit, but
note its payload is the **internal** resolution, which `"fit-parent"` never changes — it is
constant, and it is a notification, not data:

```ts
game.resized.connect(() => {
	const factor = canvas.clientWidth / game.width;
	overlay.style.left = `${shipX * factor}px`;
});
```

### The `"fixed"` alternative

`scale: "fixed"` plus CSS is a perfectly good option, and it is what you want if your layout
already handles the sizing:

```css
canvas { width: 100%; height: auto; display: block; }
```

The same `canvas.clientWidth / game.width` factor applies. The difference is that `"fixed"`
never centres or letterboxes — the canvas is exactly as wide as CSS makes it, and the aspect
ratio is yours to preserve.

---

## 2. Input scope — stop capturing the whole page

**By default the input plugin binds `keydown`/`keyup` to `document` and calls
`preventDefault()` on every bound key code, for the entire lifetime of the game object.**
Not only while focused; not only while playing; not only while visible — from
`game.use(InputPlugin(...))` until `game.stop()`. Bind `Space` and the arrows, as almost
every game does, and the host page can no longer be scrolled with them.

This default is deliberate: it is correct for a full-screen game, it is what every shipped
example relies on, and changing it would be breaking. Embedded games opt out with two
config fields and one runtime switch. (A future major release may flip the defaults to the
embedded-safe behaviour.)

### `keyTarget` — where the listeners go

```ts
InputPlugin({ actions, keyTarget: canvas });
```

Keyboard events only reach a non-`document` element while that element is focused, so the
plugin sets `tabIndex = -1` on a target that has none.

> **`keyTarget` on its own leaves a game that looks broken.** `tabIndex` makes an element
> *focusable*, not *focused*. Until something focuses it, key events go to `document.body`,
> the game receives nothing, and there is no error to notice. Focus it yourself:
>
> ```ts
> canvas.addEventListener("pointerdown", () => canvas.focus());
> ```
>
> If play can start without a click (an autoplaying demo, a keyboard-only flow), call
> `canvas.focus()` at that point too. A visible `:focus-visible` outline on the canvas is
> worth adding so players can tell when the game is listening.

The plugin warns once if the `keyTarget` is not attached to the document — a detached
element receives no key events at all.

### `preventDefaultPolicy` — when the page's keys get eaten

```ts
InputPlugin({ actions, keyTarget: canvas, preventDefaultPolicy: "focused" });
```

- `"always"` (default) — `preventDefault()` on every bound key, always.
- `"focused"` — `preventDefault()` only while the `keyTarget`, or something inside it, is
  the active element. Focus inside an open shadow root counts.

> **`preventDefaultPolicy: "focused"` does nothing without a `keyTarget`.** `document`
> always contains the active element, so with the default target the policy silently
> collapses back to `"always"`. This is the single most likely embedding mistake, and the
> plugin warns about it at install time.

Only bound key codes are ever prevented. Unbound keys always reach the page, in every mode.

### `setEnabled` — attract and idle states

For a game that exists but should not be capturing anything yet — a disguised easter egg, an
attract loop, a widget the reader has scrolled past — turn input off entirely:

```ts
game.input.setEnabled(false);
startButton.addEventListener("click", () => game.input.setEnabled(true));
```

While disabled, nothing external can change action state: no keyboard capture (and so no
`preventDefault`), no pointer buffering, no gamepad polling, `setMousePosition` ignored, and
buffered or injected input dropped rather than queued. Held actions are released on the way
down, and re-enabling starts clean — a key physically held across the switch is not
re-applied until it is pressed again.

`setEnabled(false)` does not pause the game: the loop keeps running and `onFixedUpdate` keeps
being called. It also does not remove the DOM listeners — only `game.stop()` does that.

### Form fields

Regardless of configuration, a `keydown` whose target is an `<input>`, `<textarea>`,
`<select>` or `contenteditable` element is ignored entirely — those keystrokes belong to the
field. `keyup` is deliberately *not* filtered that way, so a key held before focus moved into
a field still releases and never sticks.

---

## 3. Teardown

An embedded game is mounted and unmounted repeatedly: route changes, component remounts,
React StrictMode's deliberate double-mount in development. Everything below has to be
symmetric.

### `game.stop()`

`game.stop()` stops the loop, disposes the renderer, and emits `game.stopped`, which is the
hook the engine's own plugins use to clean up:

- the input plugin removes its `keydown`/`keyup`/pointer/blur listeners,
- `"fit"` and `"fill"` remove their `window` resize/orientation listeners,
- `"fit-parent"` disconnects its `ResizeObserver`.

Skip it and those listeners outlive the component; mount again and you have two of each.

What `stop()` does **not** do — the caller's remaining obligations:

| Not done by `stop()` | What to do |
|----------------------|------------|
| Scene teardown (`onDestroy` never runs) | Usually nothing — the tree is garbage once the `Game` is. Destroy explicitly only if a node registered something outside the tree. |
| Removing the canvas from the DOM | `canvas.remove()`, if you created it. |
| Resetting module-level state | `yourState.reset()` — see below. |

### `reactiveState` is a module singleton

`reactiveState()` has no tie to a `Game` or a `Scene`. The conventional (and intended) usage
is a module-level store so a HUD can import it directly:

```ts
// state.ts
import { reactiveState } from "quintus2";

export const gameState = reactiveState({ score: 0, lives: 3 });
```

A module is evaluated once per page load, so that object outlives every `Game` built against
it. It survives scene switches and re-entry, `game.stop()` and a fresh `Game`, client-side
route changes back to the page, and React's StrictMode double-mount — the second mount sees
the first mount's score, not `0`. Nothing in the engine clears it.

So reset on **both** ends:

```ts
useEffect(() => {
	gameState.reset();

	const game = new Game({ width: 800, height: 500, canvas, scale: "fit-parent" });
	game.use(InputPlugin({ actions, keyTarget: canvas, preventDefaultPolicy: "focused" }));
	game.registerScenes({ title: TitleScene, level1: Level1 });
	game.start("title");

	return () => {
		game.stop();
		gameState.reset();
	};
}, []);
```

Resetting only on boot leaves stale values visible to anything else on the page after
unmount; resetting only on teardown is not enough either, because a hard reload is not the
only way a page arrives at your component.

`reset()` restores the values captured when the store was created and emits `changed` plus
the per-key signal for every key that actually differs, so bound HUD labels update.

### Signal connections are not released for you

`reset()` does not disconnect handlers, and neither does `Node.destroy()` — destroying a node
disconnects that node's *own* signals, but a handler the node connected to an external signal
stays connected, keeps firing, and keeps the destroyed node alive. Keep the connection and
disconnect it:

```ts
class Hud extends Node2D {
	private conn?: SignalConnection;
	private label!: Label;

	override onReady(): void {
		this.conn = gameState.on("score").connect(({ value }) => {
			this.label.text = `Score: ${value}`;
		});
	}

	override onDestroy(): void {
		this.conn?.disconnect();
	}
}
```

The same applies to any listener you add yourself on `window`, `document`, or the canvas.

---

## 4. Headless testing

`renderer: null` runs the full simulation — `onReady`, `onFixedUpdate`, `onUpdate`, physics,
signals, timers — and simply never calls `onDraw`. `HeadlessGame` (from `quintus2/testing`)
is that, plus a required `seed` and `runFor`/`runUntil` helpers.

This needs **no canvas mock** (no `vitest-canvas-mock`), on one condition: **no canvas-context
method may be reached off the `onDraw` path**. Keep all painting in `onDraw` and keep game
state in plain data — masks, arrays, numbers — and the whole simulation is testable
headlessly. Measuring text or reading pixels from `onReady` breaks that, and is worth avoiding
for its own sake.

> **A DOM is still required.** `Game`'s constructor references `HTMLCanvasElement` and
> `document` unguarded, so `HeadlessGame` throws `ReferenceError: HTMLCanvasElement is not
> defined` under bare Node. Run headless tests under jsdom (`environment: "jsdom"` in the
> vitest config, which is what this repo does) or provide equivalent globals.

### `inject` → `step()` timing

`input.inject(action, pressed)` is **buffered and applied at the start of the next frame,
before any `onFixedUpdate`**. One `game.step()` does both: it drains the buffer *and* runs the
`onFixedUpdate` that reads the action. So inject, then step once — there is no extra frame to
compensate for.

```ts
import { InputPlugin } from "quintus2";
import { HeadlessGame } from "quintus2/testing";

const game = new HeadlessGame({ width: 320, height: 240, seed: 1 });
game.use(InputPlugin({ actions: { jump: ["Space"] } }));
game.start(Level);

game.input.inject("jump", true);
game.step(); // this step's onFixedUpdate sees isPressed("jump") === true
//           //                          and isJustPressed("jump") === true

game.input.inject("jump", false);
game.step(); // released
```

The injected value is a **level, not a pulse** — it stays held until you inject `false`.
`isJustPressed` is true for exactly one fixed step after the press lands, so a one-frame tap is
the four lines above.

`step()` runs one whole frame in order: `preFrame` (where input drains) → `onFixedUpdate` →
`onUpdate` → render → end-of-frame cleanup. It is unrelated to `pause()`/`resume()`, which
start and stop the real-time `requestAnimationFrame` loop.

---

## 5. Two gotchas worth knowing

### Don't pair `removeChild()` with `destroy()`

```ts
parent.removeChild(child);
child.destroy(); // ← silently does nothing
```

`destroy()` reaches the scene's destroy queue by walking up the parent chain, and
`removeChild()` has just nulled it. The node is flagged `isDestroyed` but is never processed:
`destroying` never emits, `onDestroy` never runs, signals are never disconnected.

Call `destroy()` **alone**. It is deferred — the splice out of the parent's child list and the
full teardown happen at end-of-frame cleanup, which is what makes it safe to call from inside
`onFixedUpdate` — but it is *immediately* visible to queries: the node and its whole subtree
stop being returned by `find`, `findAll`, `findFirst`, `findByType`, `findAllByType`,
`getChild`, `getChildren`, and `Scene.count()` in the same tick. Clear-and-rebuild works
without any detach dance:

```ts
for (const t of scene.findAllByType(Target)) t.destroy();
scene.findAllByType(Target).length; // → 0, same tick
scene.add(new Target(nextSpot));
```

`removeChild()` remains the immediate detach-without-destroy path, for moving a node between
parents.

Two deliberate asymmetries to know about:

- **`node.is(Type)` ignores `isDestroyed`.** It is a type guard, not a query — narrowing must
  not depend on lifecycle state. Check `isDestroyed` yourself if you hold a node reference
  across frames.
- **The physics solver ignores it too.** A body destroyed mid-tick keeps colliding for the rest
  of that step, so an actor never falls through a platform destroyed underneath it. Physics
  *scene* queries (`raycast`, `queryCircle`, `findNearest`, …) do follow the query rule and
  agree with the tree queries. In short: queries answer "is it still in the game?", immediately;
  the solver answers "what did this step collide with?", unchanged.

### Any node class works as a query token

`findByType`, `findAllByType`, `is`, `getChild`, `getChildren`, `findAll` and `findFirst` take a
**type token**, not a constructor. Abstract classes and classes with required constructor
arguments both work, with no cast:

```ts
class Target extends Node2D {
	constructor(public spot: Vec2) {
		super();
	}
}

scene.findAllByType(Target); // Target[]
scene.findAllByType(CollisionObject); // an abstract base class — fine too
```

`add()`, node pools, the JSX factory and `TileMap.spawnObjects` still require a zero-argument
constructor, because they actually call `new`. Pass an instance instead:
`scene.add(new Target(spot))`.
