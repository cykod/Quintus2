# Mobile Enhancements — Detailed Design

> **Goal:** Fix multitouch sliding between on-screen buttons and add an opt-in mobile-fullscreen scaling mode
> **Outcome:** Fingers can slide on/off and between virtual buttons seamlessly; games can opt into filling the entire screen on mobile devices

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Fix VirtualButton slide behavior | Done |
| 2 | Add mobile-fullscreen scaling mode | Done |
| 3 | Tests | Done |

---

## Problem Analysis

### Bug 1: Button stays lit when sliding finger off

**Root cause:** `VirtualButton._onTouchMove()` is a no-op (line 53 of `virtual-button.ts`):

```typescript
_onTouchMove(_x: number, _y: number): void {
    // Button does not respond to move
}
```

The `TouchOverlay._onPointerMove` handler already handles the slide-off case correctly — when the pointer leaves a control's `containsPoint()` zone, it calls `_onTouchEnd()` on the old control. **However**, the visual `_pressed` state and input injection rely on `_onTouchEnd()` being called, and the overlay does call it. So the *input* should already release.

The real issue is subtler. Let me trace the flow:

1. Finger down on button A → `_onTouchStart` → `_pressed = true`, `inject(action, true)` ✓
2. Finger slides off button A into dead zone → overlay calls `current._onTouchEnd()` → `_pressed = false`, `inject(action, false)` ✓
3. Finger slides from button A to button B → overlay calls `current._onTouchEnd()` then `newControl._onTouchStart()` ✓

The overlay logic at lines 49–81 of `touch-overlay.ts` already handles all three cases. **The issue is that `containsPoint` uses a 1.3× generous hit zone** — the visual button radius is `this.radius`, but the touch zone extends to `this.radius * 1.3`. This means:

- **Slide off**: The finger has to move 30% beyond the visual radius before `containsPoint` returns false. The button visually appears stuck because the user sees their finger outside the drawn circle but it's still in the generous zone.
- **Slide between**: Two adjacent buttons with generous zones might overlap, or there might be a gap between the visual radius and the generous zone. In the platformer layout, the left button is at `x=margin+btnR` and the right button is at `x=margin+btnR*3.5` with `btnR ≈ 19` (8% of min(320,240)). The gap between visual circles is ~48px but the generous zones close that to ~36px. If the finger passes through the gap, it hits dead zone and the pointer gets untracked.

**The actual fix needed:** When a pointer slides into dead zone (no control hit), the overlay currently deletes the pointer from its tracking map (line 78). This means if the finger then slides into a new control, the `_onPointerMove` handler returns early at line 51 (`if (!current) return`) because the pointer is no longer tracked. **The finger is now invisible to the overlay** — no further controls can be activated until the finger lifts and touches down again.

### Bug 2: No mobile-fullscreen sizing mode

Currently `scale: "fit"` maintains the game's aspect ratio with letterboxing/pillarboxing. Some games (especially platformers) would benefit from stretching to fill the entire screen, using the full viewport area. This requires a new scaling mode.

---

## Phase 1: Fix VirtualButton Slide Behavior

The fix touches two files:

### 1a. `TouchOverlay`: Keep tracking pointers that slide into dead zone

**File:** `packages/touch/src/touch-overlay.ts`

Currently, when a pointer slides out of all controls (lines 76–79):
```typescript
// Pointer is in dead zone — untrack it
this._pointers.delete(e.pointerId);
```

**Change:** Instead of deleting the pointer, keep it tracked with a `null` control value. Then on subsequent `pointermove` events, if the pointer is tracked to `null`, hit-test all controls to see if it enters one.

```typescript
// In _onPointerMove:
_onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    const pos = this._toLocal(e);

    // Check if this pointer is tracked (may be null = in dead zone)
    if (!this._pointers.has(e.pointerId)) return;
    const current = this._pointers.get(e.pointerId) ?? null;

    if (current !== null) {
        // Pointer is tracked to a control
        if (current.containsPoint(pos.x, pos.y)) {
            current._onTouchMove(pos.x, pos.y);
            e.stopImmediatePropagation();
            e.preventDefault();
            return;
        }

        // Slid outside current control — release it
        current._onTouchEnd();
    }

    // Try to find a new control (skipping the one we just left)
    for (const control of this.controls) {
        if (control !== current && control.containsPoint(pos.x, pos.y)) {
            this._pointers.set(e.pointerId, control);
            control._onTouchStart(pos.x, pos.y);
            e.stopImmediatePropagation();
            e.preventDefault();
            return;
        }
    }

    // In dead zone — keep tracking but with null
    this._pointers.set(e.pointerId, null!);
    e.stopImmediatePropagation();
    e.preventDefault();
};
```

**Type change:** The `_pointers` map needs to allow `null` values:
```typescript
private _pointers = new Map<number, VirtualControl | null>();
```

The `_onPointerUp` and `_onPointerCancel` handlers also need to handle the `null` case — if the control is `null`, just delete the pointer without calling `_onTouchEnd()`.

### 1b. `VirtualButton`: Update pressed visual on slide-off

Currently `_onTouchMove` is a no-op. This is fine for input injection (the overlay handles release), but we should update the visual state when the touch is still within the button. No change needed — the overlay already calls `_onTouchEnd()` which sets `_pressed = false`. The visual update happens on the next draw.

However, there's one more issue: **VirtualButton doesn't update its visual when a finger slides back onto it after leaving.** This already works because `_onTouchStart` sets `_pressed = true`. No additional change needed.

### 1c. Handle edge case: pointer slides from dead zone back onto original control

With the fix above, if a finger slides from button A → dead zone → button A, the overlay will hit-test controls and find button A. Since we skip `current` in the loop, and `current` is `null` (dead zone), this works — button A will be found and `_onTouchStart` called again.

But if the finger slides from button A → still within button A's generous zone → exits → re-enters, we need to make sure the `control !== current` check doesn't skip it. Since `current` would be `null` at that point, this is fine.

### Files Changed

| File | Change |
|------|--------|
| `packages/touch/src/touch-overlay.ts` | Update `_pointers` type, keep dead-zone pointers tracked as `null`, handle `null` in up/cancel |

---

## Phase 2: Mobile-Fullscreen Scaling Mode

### Concept

Add a `scale: "fill"` mode that sets the canvas **internal resolution to the exact viewport pixel dimensions**. On a 750×1334 phone the canvas is literally 750×1334. This gives pixel-perfect rendering with no CSS scaling artifacts.

Because a 750px-wide canvas would make 16px tiles tiny, games pair this with a **camera zoom** to control how much of the world is visible. The `GameOptions` accepts a `baseHeight` hint that auto-computes the zoom: `zoom = viewportHeight / baseHeight`. A platformer designed around a 240px viewport on a 750px-tall screen gets zoom ≈ 3.1×.

```
┌─ Viewport (750 × 1334 CSS px) ──────────┐
│                                           │
│  canvas.width  = 750                      │
│  canvas.height = 1334                     │
│  camera.zoom   = 1334 / 240 ≈ 5.6        │
│                                           │
│  Visible world = 750/5.6 × 240 ≈ 134×240 │
│  (same vertical extent, narrower on       │
│   portrait — wider on landscape)          │
│                                           │
└───────────────────────────────────────────┘
```

### API Design

```typescript
const game = new Game({
    width: 320,          // Initial / fallback width
    height: 240,         // Initial / fallback height
    scale: "fill",       // NEW: canvas = viewport pixels
    baseHeight: 240,     // NEW: desired world-view height for auto-zoom
    pixelArt: true,
});
```

**`scale: "fill"` behavior:**
- `canvas.width = window.innerWidth`, `canvas.height = window.innerHeight` (exact pixels)
- CSS: `width: 100vw; height: 100vh; position: fixed; left: 0; top: 0` — no letterbox
- `game.width` and `game.height` update dynamically on resize / orientation change
- `game.resized` signal fires after dimensions change

**`baseHeight` option (optional, only meaningful with `scale: "fill"`):**
- If provided, the game computes a **recommended zoom** = `canvas.height / baseHeight`
- Exposed as `game.fillZoom` — a read-only value that updates on resize
- The Camera can consume this automatically (see below) or games can ignore it

### Camera integration

The Camera already has a `zoom` property. Games set it manually or via a new convenience:

```typescript
class Camera extends Node {
    /** When true, auto-set zoom from game.fillZoom each resize. Default: false. */
    autoZoom = false;
}
```

When `autoZoom` is on, the Camera listens to `game.resized` and sets `this.zoom = game.fillZoom`. This is opt-in — some games may want fixed zoom or their own formula.

**Typical platformer setup:**

```typescript
const camera = scene.add(new Camera());
camera.follow = player;
camera.autoZoom = true;  // auto-zoom from fill mode
camera.bounds = new Rect(0, 0, mapWidth, mapHeight);
```

**Manual zoom formula (if autoZoom is off):**

```typescript
game.resized.connect(({ height }) => {
    camera.zoom = height / 240;  // same as baseHeight
});
```

### Implementation

#### 2a. `GameOptions` & `Game` class

**File:** `packages/core/src/game.ts`

```typescript
export interface GameOptions {
    // ... existing fields ...
    scale?: "fit" | "fixed" | "fill";
    /**
     * Reference world-view height for `scale: "fill"`.
     * Used to compute `game.fillZoom = canvasHeight / baseHeight`.
     * Only meaningful when scale is "fill". Ignored otherwise.
     */
    baseHeight?: number;
}
```

`Game` class changes:

```typescript
class Game {
    // width and height become mutable (private backing fields + getters)
    private _width: number;
    private _height: number;
    get width(): number { return this._width; }
    get height(): number { return this._height; }

    /** Recommended camera zoom for fill mode. 1 if not in fill mode. */
    get fillZoom(): number { return this._fillZoom; }
    private _fillZoom = 1;

    /** Fires after canvas dimensions change (fill mode resize). */
    readonly resized: Signal<{ width: number; height: number }> = signal();

    private readonly _baseHeight: number | undefined;
}
```

**Note on `readonly` → getter migration:** `game.width` and `game.height` are currently `readonly` public fields. Changing them to getter properties is a **source-compatible** change — existing code reads them identically. TypeScript treats `readonly` fields and `get` accessors the same from the consumer side.

#### 2b. `_setupScaling` — fill mode

```typescript
private _setupScaling(mode: "fit" | "fixed" | "fill"): void {
    if (mode === "fixed") return;
    const canvas = this.canvas;
    canvas.style.touchAction = "none";

    if (mode === "fill") {
        const resize = () => {
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            // Set canvas to exact viewport pixel dimensions
            this._width = vw;
            this._height = vh;
            canvas.width = vw;
            canvas.height = vh;

            // CSS fills viewport with no transform
            canvas.style.width = "100vw";
            canvas.style.height = "100vh";
            canvas.style.position = "fixed";
            canvas.style.left = "0";
            canvas.style.top = "0";

            // Compute recommended zoom
            if (this._baseHeight) {
                this._fillZoom = vh / this._baseHeight;
            }

            // Re-apply pixel-art smoothing (canvas resize resets context state)
            if (this.pixelArt) {
                const ctx = canvas.getContext("2d");
                if (ctx) ctx.imageSmoothingEnabled = false;
            }

            // Update renderer's cached dimensions
            this.renderer?.resize(vw, vh);

            // Notify listeners
            this.resized.emit({ width: vw, height: vh });
        };

        resize();
        window.addEventListener("resize", resize);
        window.addEventListener("orientationchange", () => setTimeout(resize, 100));
        this.stopped.connect(() => window.removeEventListener("resize", resize));
        return;
    }

    // ... existing "fit" logic unchanged ...
}
```

#### 2c. `Canvas2DRenderer` — support dynamic resize

**File:** `packages/core/src/canvas2d-renderer.ts`

The renderer currently stores `gameWidth` and `gameHeight` as `readonly` fields set in the constructor. These are used in the `render()` method for `clearRect`. Add a `resize()` method:

```typescript
class Canvas2DRenderer implements Renderer {
    private gameWidth: number;   // remove readonly
    private gameHeight: number;  // remove readonly

    /** Update cached dimensions after canvas resize. */
    resize(width: number, height: number): void {
        this.gameWidth = width;
        this.gameHeight = height;
        if (this.pixelArt) {
            this.ctx.imageSmoothingEnabled = false;
        }
        this._renderListDirty = true;
    }
}
```

The `Renderer` interface also needs `resize`:

```typescript
export interface Renderer {
    render(scene: Scene): void;
    markRenderDirty(): void;
    resize?(width: number, height: number): void;  // optional for backward compat
}
```

#### 2d. Camera `autoZoom`

**File:** `packages/camera/src/camera.ts`

```typescript
class Camera extends Node {
    /** When true, auto-set zoom from game.fillZoom on resize. */
    autoZoom = false;

    private _resizeCleanup: (() => void) | null = null;

    override onEnterTree(): void {
        if (this.autoZoom) {
            // Set initial zoom
            this.zoom = this.game.fillZoom;
            // Listen for resize
            this._resizeCleanup = this.game.resized.connect(() => {
                this.zoom = this.game.fillZoom;
            });
        }
    }

    override onExitTree(): void {
        this._resizeCleanup?.();
        this._resizeCleanup = null;
    }
}
```

#### 2e. Touch overlay repositioning

When the game resizes, virtual control positions (which are based on `game.width` / `game.height`) become stale. The overlay needs to rebuild. Also, control sizes should scale with `fillZoom` so they remain the same *physical* size on screen.

**File:** `packages/touch/src/touch-plugin.ts`

```typescript
// In TouchPlugin install(), add resize listener:
game.resized.connect(() => {
    _destroyOverlay(state);
    _createOverlay(game, state);
});
```

**Layout factories** already receive the `Game` instance with updated `width`/`height`, so positions will be correct. But button sizes need attention — a `radius: 30` button that was fine at 320px is tiny at 750px. Layout factories should scale by `game.fillZoom`:

```typescript
// In platformerLayout():
const z = game.fillZoom;                      // e.g. 3.1
const margin = 12 * z;
const btnR = Math.min(w, h) * 0.08;          // already viewport-relative, OK
```

Since layouts already compute `btnR` as a percentage of `game.width`/`game.height`, and in fill mode those are viewport pixels, the buttons will automatically be viewport-relative. No change needed to layout factories — they already scale correctly.

### Files Changed

| File | Change |
|------|--------|
| `packages/core/src/game.ts` | Add `"fill"` scale mode, `baseHeight` option, mutable width/height, `fillZoom`, `resized` signal |
| `packages/core/src/canvas2d-renderer.ts` | Remove `readonly` from dimensions, add `resize()` method |
| `packages/core/src/renderer.ts` | Add optional `resize?()` to `Renderer` interface |
| `packages/camera/src/camera.ts` | Add `autoZoom` property, listen to `game.resized` |
| `packages/touch/src/touch-plugin.ts` | Rebuild overlay on `game.resized` |

### Usage in Examples

```typescript
// examples/platformer/main.ts
const game = new Game({
    width: 320,
    height: 240,
    scale: "fill",        // ← canvas = viewport pixels
    baseHeight: 240,      // ← auto-zoom reference
    pixelArt: true,
    backgroundColor: "#1a1a2e",
});
```

```typescript
// In the level scene:
const camera = this.add(new Camera());
camera.follow = player;
camera.autoZoom = true;   // ← auto-set zoom from fillZoom
camera.bounds = new Rect(0, 0, mapWidth, mapHeight);
```

On a 390×844 phone in portrait: canvas is 390×844, fillZoom = 844/240 ≈ 3.5, visible world ≈ 111×240. In landscape (844×390): fillZoom = 390/240 ≈ 1.6, visible world ≈ 528×240 (sees more horizontally).

---

## Phase 3: Tests

### Tests for Phase 1 (Slide Behavior)

**File:** `packages/touch/src/touch-overlay.test.ts` (extend existing)

- [x] Existing: "sliding from one button to another releases old and presses new" — already passes
- [x] Existing: "sliding off a button into dead zone releases the button" — already passes
- [ ] **NEW:** "sliding from dead zone onto a button activates it" — finger starts on button A, slides to dead zone, then slides to button B. Button B should activate.
- [ ] **NEW:** "sliding from dead zone back onto original button re-activates it" — finger starts on button A, slides to dead zone, slides back to button A. Button A should re-activate.
- [ ] **NEW:** "rapid slide across three controls" — finger starts on left button, slides through dead zone to right button, then to jump button. Each transition releases the old and activates the new.
- [ ] **NEW:** "pointer in dead zone still receives pointermove events" — verify that a pointer that slid into dead zone is still tracked and can discover new controls.
- [ ] **NEW:** "pointerup in dead zone cleans up without error" — finger slides to dead zone, then lifts. No crash, no leaked state.

### Tests for Phase 2 (Fill Mode)

**File:** `packages/core/src/game-scaling.test.ts` (extend existing or new file)

- [ ] `scale: "fill"` sets `canvas.width = window.innerWidth`, `canvas.height = window.innerHeight`
- [ ] `scale: "fill"` sets CSS to `100vw`/`100vh`, `position: fixed`
- [ ] `game.width` and `game.height` update after simulated resize event
- [ ] `game.fillZoom` equals `viewportHeight / baseHeight`
- [ ] `game.fillZoom` updates on resize
- [ ] `game.resized` signal fires with new `{ width, height }` on resize
- [ ] `scale: "fill"` re-applies pixelArt smoothing after resize
- [ ] `scale: "fit"` behavior unchanged (regression)
- [ ] `scale: "fixed"` behavior unchanged (regression)

**File:** `packages/core/src/canvas2d-renderer.test.ts` (extend existing or new)

- [ ] `resize()` updates `gameWidth`/`gameHeight` and marks render dirty
- [ ] `resize()` re-applies `imageSmoothingEnabled = false` for pixelArt

**File:** `packages/camera/src/camera.test.ts` (extend existing)

- [ ] `autoZoom = true` sets `zoom` to `game.fillZoom` on enter tree
- [ ] `autoZoom = true` updates `zoom` when `game.resized` fires
- [ ] `autoZoom = false` (default) does not change zoom on resize
- [ ] cleanup: resize listener removed on exit tree

**File:** `packages/touch/src/touch-plugin.test.ts` (extend existing)

- [ ] Touch overlay rebuilds when `game.resized` fires
- [ ] Control positions reflect new game dimensions after rebuild

---

## Definition of Done

- [ ] All phases marked Done in status table
- [ ] Sliding finger on/off buttons correctly activates/deactivates them
- [ ] Sliding between buttons seamlessly transitions input
- [ ] `scale: "fill"` sets canvas to exact viewport pixel dimensions
- [ ] `game.fillZoom` computes correct zoom from `baseHeight`
- [ ] Camera `autoZoom` tracks `fillZoom` across resize events
- [ ] `game.resized` signal fires on resolution change
- [ ] Touch controls reposition after resize
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes with no warnings
- [ ] `pnpm lint` clean
- [ ] Platformer demo works correctly with both `"fit"` and `"fill"` modes on mobile
