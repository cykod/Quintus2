# Mobile Touch UI — Detailed Design

> **Goal:** Add a mobile touch UI package (`@quintus/touch`) with virtual joysticks, D-pads, and buttons that auto-show on touch devices, inject actions into the existing Input system, and provide fullscreen + scroll prevention for a native-app-like mobile experience.
> **Outcome:** All seven example games are playable on mobile with appropriate virtual controls, the canvas scales responsively, and the experience feels like a native mobile game.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Core touch infrastructure (scaling, fullscreen, scroll prevention, multi-touch) | Done |
| 2 | Virtual control widgets (joystick, D-pad, button, overlay) | Done |
| 3 | Preset layouts for common game types | Done |
| 4 | Example game integration | Done |

---

## Architecture Overview

```
@quintus/touch (new package)
├── TouchPlugin          — Plugin: auto-detect, fullscreen, scroll prevention, canvas scaling
├── TouchOverlay         — Node2D container: multi-touch dispatch, auto-show/hide
├── VirtualJoystick      — Analog stick with dead zone, injects axis actions
├── VirtualDPad          — 4-way/8-way directional buttons, injects discrete actions
├── VirtualButton        — Single action button, hold or tap mode
└── layouts/             — Factory functions for common control schemes
    ├── platformerLayout
    ├── topDownLayout
    ├── dualStickLayout
    ├── puzzleLayout
    └── pointClickLayout
```

### Key Design Decisions

**1. Canvas-rendered, not DOM overlay.** Virtual controls are Node2D subclasses that draw via the engine's `DrawContext` API. This keeps visuals consistent with the game, avoids z-index/CSS headaches, and works with the existing rendering pipeline. Controls set `renderFixed = true` to stay in screen space.

**2. Input injection, not new input paths.** Virtual controls call `Input.inject(action, pressed)` and `Input.injectAnalog(action, value)`. Game code continues to read `isPressed("jump")` — zero changes needed in game logic. This is the same API used by the headless test runner and qdbg debugger. **Note:** `inject()` silently ignores unregistered action names. The `TouchPlugin.install()` should validate that all layout actions exist in the game's `InputConfig` and log a dev-mode warning for any mismatches (e.g., layout uses `"fire"` but game registered `"shoot"`).

**3. Multi-touch via PointerEvent.** The `TouchOverlay` registers its own `pointerdown`/`pointermove`/`pointerup` listeners (capture phase) on the canvas. Each pointer gets a unique `pointerId`, allowing simultaneous joystick + button operation. Touches on virtual controls call `e.stopImmediatePropagation()` so they don't reach the game's InputPlugin or UI PointerDispatcher (both register listeners on the same canvas element — `stopPropagation()` alone wouldn't prevent same-element listeners from firing). Touches that miss all controls pass through to the game's Input system and UI PointerDispatcher.

**4. Scene-tree integration.** The `TouchOverlay` is added to the active scene with a high `zIndex` (9999). The `TouchPlugin` stores the layout factory (not the overlay instance) as long-lived state. On `game.sceneSwitched`, it destroys the old overlay and creates a fresh one — calling `layout.createControls(game)` again — then adds it to the new scene. This is necessary because scene destruction recursively destroys all children, including the overlay.

**5. Auto-detect with manual override.** Touch capability is detected via `navigator.maxTouchPoints > 0` or the first `pointerdown` with `pointerType === "touch"`. Controls auto-show for touch, auto-hide for mouse/keyboard. The developer can force `visible: true/false`.

**6. Landscape-primary orientation.** All example games are landscape-oriented. When fullscreen is active, the `TouchPlugin` locks the screen orientation to landscape via `screen.orientation.lock("landscape")` (silently catching if unsupported). The `_setupScaling()` method and layout factories assume landscape. Games that need portrait support can opt out via `orientation: "any"` in the config.

### Data Flow

```
Touch Event (finger on canvas)
    │
    ▼
TouchOverlay.onPointerDown (capture phase)
    │
    ├──▶ Hit virtual control? ──▶ Yes ──▶ Track pointerId → control mapping
    │                                      Control calls input.inject(action, true)
    │                                      e.stopImmediatePropagation()
    │
    └──▶ No ──▶ Event propagates normally to:
                 ├── InputPlugin (mouse position, mouse:left action)
                 └── PointerDispatcher (UI button clicks)

Touch End
    │
    ▼
Control calls input.inject(action, false)
Remove pointerId from tracking
```

### Package Dependencies

```
@quintus/touch
├── @quintus/core    — Node2D, Game, Plugin, DrawContext, Signal
├── @quintus/math    — Vec2, Color
└── @quintus/input   — getInput(), Input.inject(), Input.injectAnalog()
```

No dependency on `@quintus/ui`. The virtual controls are self-contained Node2D subclasses with their own pointer handling and rendering.

---

## Phase 1: Core Touch Infrastructure

### 1.1 Package Setup

- [x] Create `packages/touch/` with `package.json`, `tsconfig.json`, `tsup.config.ts`
- [x] Create `packages/touch/src/index.ts` with all exports
- [x] Verify `pnpm install` discovers the new package (the `packages/*` glob handles this automatically)
- [x] Add dependency in the `quintus` meta-package

`packages/touch/package.json`:
```json
{
  "name": "@quintus/touch",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "dependencies": {
    "@quintus/core": "workspace:*",
    "@quintus/math": "workspace:*",
    "@quintus/input": "workspace:*"
  }
}
```

### 1.2 Canvas Scaling — Implement `scale: "fit"`

File: `packages/core/src/game.ts`

The `GameOptions.scale` field is declared but unimplemented. Implement it.

- [x] Add `_setupScaling()` method to `Game`
- [x] On `scale: "fit"` (or default), apply CSS sizing + ResizeObserver
- [x] Maintain aspect ratio with letterboxing (black bars)
- [x] Set `touch-action: none` on the canvas element
- [x] Update mouse position scaling in InputPlugin (already handles `getBoundingClientRect` — should work automatically)

```typescript
// In Game constructor, after canvas creation:
if (typeof window !== "undefined") {
    this._setupScaling(options.scale ?? "fixed");
}

private _setupScaling(mode: "fit" | "fixed"): void {
    if (mode === "fixed") return;

    const canvas = this.canvas;
    const aspect = this.width / this.height;

    const resize = () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const windowAspect = vw / vh;

        let cssWidth: number;
        let cssHeight: number;

        if (windowAspect > aspect) {
            // Window is wider than game — fit to height
            cssHeight = vh;
            cssWidth = vh * aspect;
        } else {
            // Window is taller than game — fit to width
            cssWidth = vw;
            cssHeight = vw / aspect;
        }

        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
        canvas.style.position = "absolute";
        canvas.style.left = `${(vw - cssWidth) / 2}px`;
        canvas.style.top = `${(vh - cssHeight) / 2}px`;
    };

    resize();
    window.addEventListener("resize", resize);
    // Also handle orientation change on mobile
    window.addEventListener("orientationchange", () => setTimeout(resize, 100));

    this.stopped.connect(() => {
        window.removeEventListener("resize", resize);
    });
}
```

The existing mouse position math in `InputPlugin` uses `getBoundingClientRect()` and scales by `game.width / rect.width`, so it will automatically handle the CSS-scaled canvas.

### 1.3 Fullscreen Helper

File: `packages/touch/src/fullscreen.ts`

- [x] `requestFullscreen(element)` — cross-browser wrapper
- [x] `exitFullscreen()` — cross-browser wrapper
- [x] `isFullscreen()` — query state
- [x] `onFullscreenChange(callback)` — listen for changes

```typescript
export function requestFullscreen(el: HTMLElement = document.documentElement): Promise<void> {
    if (el.requestFullscreen) return el.requestFullscreen();
    // Safari fallback
    const webkit = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (webkit.webkitRequestFullscreen) return webkit.webkitRequestFullscreen();
    return Promise.resolve();
}

export function isFullscreen(): boolean {
    return !!document.fullscreenElement;
}
```

### 1.4 Scroll Prevention

File: `packages/touch/src/scroll-lock.ts`

- [x] `lockScroll()` — prevent all scrolling/zooming behaviors
- [x] `unlockScroll()` — restore normal behavior

```typescript
export function lockScroll(canvas: HTMLCanvasElement): () => void {
    // Prevent canvas touch from scrolling
    canvas.style.touchAction = "none";

    // Prevent body scroll
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.height = "100%";

    // Block touchmove on document (prevents pull-to-refresh, rubber-banding)
    const prevent = (e: TouchEvent) => {
        if (e.target === canvas || canvas.contains(e.target as Node)) {
            e.preventDefault();
        }
    };
    document.addEventListener("touchmove", prevent, { passive: false });

    return () => {
        document.body.style.overflow = origOverflow;
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.height = "";
        document.removeEventListener("touchmove", prevent);
    };
}
```

### 1.5 Touch Detection

File: `packages/touch/src/detect.ts`

- [x] `isTouchDevice()` — static check
- [x] `onInputMethodChange(callback)` — dynamic detection for auto-show/hide

```typescript
/** Heuristic: does this device support touch? */
export function isTouchDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    return navigator.maxTouchPoints > 0;
}

/**
 * Listen for input method changes.
 * Fires "touch" on first touch event, "mouse" on first mouse move.
 * Used to auto-show/hide virtual controls.
 */
export function onInputMethodChange(
    callback: (method: "touch" | "mouse") => void,
): () => void {
    let current: "touch" | "mouse" | null = null;

    const onPointer = (e: PointerEvent) => {
        const method = e.pointerType === "touch" ? "touch" : "mouse";
        if (method !== current) {
            current = method;
            callback(method);
        }
    };

    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("pointermove", onPointer, true);

    return () => {
        document.removeEventListener("pointerdown", onPointer, true);
        document.removeEventListener("pointermove", onPointer, true);
    };
}
```

### 1.6 TouchPlugin

File: `packages/touch/src/touch-plugin.ts`

- [x] Define `TouchPluginConfig` interface
- [x] Implement plugin `install()`: sets up scaling, scroll lock, fullscreen, auto-detection
- [x] Store plugin state in `WeakMap<Game, TouchState>`
- [x] Listen to `game.sceneSwitched` to re-attach overlay
- [x] Clean up on `game.stopped`

```typescript
export interface TouchPluginConfig {
    /** Control layout to use. Provide a factory function or a preset name. */
    layout: TouchLayout | TouchLayoutFactory;
    /** Auto-request fullscreen on first touch. Default: false. */
    fullscreen?: boolean;
    /** Prevent page scroll when touching the canvas. Default: true. */
    preventScroll?: boolean;
    /** Force controls visible (true), hidden (false), or auto-detect (undefined). */
    visible?: boolean;
    /** Opacity of virtual controls. Default: 0.4. */
    opacity?: number;
    /** Preferred orientation when fullscreen. Default: "landscape". Set "any" to skip locking. */
    orientation?: "landscape" | "portrait" | "any";
}

export type TouchLayoutFactory = (game: Game) => TouchLayout;

export interface TouchLayout {
    /** Create the control nodes. Called once. */
    createControls(game: Game): Node2D[];
}
```

### Tests for Phase 1

**Unit:** `packages/touch/src/detect.test.ts`
- `isTouchDevice()` returns boolean
- `onInputMethodChange()` fires on pointer type changes

**Unit:** `packages/touch/src/fullscreen.test.ts`
- `requestFullscreen()` calls native API
- `isFullscreen()` reflects state

**Unit:** `packages/touch/src/scroll-lock.test.ts`
- `lockScroll()` sets CSS properties
- Cleanup function restores original state

**Integration:** `packages/core/src/game-scaling.test.ts`
- `scale: "fit"` applies CSS sizing
- Aspect ratio preserved after resize

---

## Phase 2: Virtual Control Widgets

### 2.1 TouchOverlay

File: `packages/touch/src/touch-overlay.ts`

The overlay is the root container for all virtual controls. It manages multi-touch dispatch and auto-show/hide.

- [ ] Extends `Node2D` with `renderFixed = true`, `zIndex = 9999`
- [ ] Registers canvas pointer event listeners (capture phase)
- [ ] Tracks active pointers: `Map<number, VirtualControl>` (pointerId → control)
- [ ] Hit-tests pointer position against child controls
- [ ] Controls that capture a pointer get all subsequent move/up events for that pointer
- [ ] Uncaptured pointers pass through to the game
- [ ] Auto-show/hide based on input method detection

```typescript
export class TouchOverlay extends Node2D {
    private pointers = new Map<number, VirtualControl>();
    private controls: VirtualControl[] = [];
    opacity = 0.4;

    constructor() {
        super();
        this.renderFixed = true;
        this.zIndex = 9999;
    }

    addControl(control: VirtualControl): void {
        this.controls.push(control);
        this.add(control);
    }

    onEnterTree(): void {
        const canvas = this.game.canvas;
        canvas.addEventListener("pointerdown", this._onPointerDown, true);
        canvas.addEventListener("pointermove", this._onPointerMove, true);
        canvas.addEventListener("pointerup", this._onPointerUp, true);
        canvas.addEventListener("pointercancel", this._onPointerUp, true);
    }

    onExitTree(): void {
        const canvas = this.game.canvas;
        canvas.removeEventListener("pointerdown", this._onPointerDown, true);
        canvas.removeEventListener("pointermove", this._onPointerMove, true);
        canvas.removeEventListener("pointerup", this._onPointerUp, true);
        canvas.removeEventListener("pointercancel", this._onPointerUp, true);
    }

    private _onPointerDown = (e: PointerEvent): void => {
        if (e.pointerType !== "touch") return; // Only intercept touch
        const pos = this._toLocal(e);
        for (const control of this.controls) {
            if (control.containsPoint(pos.x, pos.y)) {
                this.pointers.set(e.pointerId, control);
                control._onTouchStart(pos.x, pos.y);
                e.stopImmediatePropagation();
                e.preventDefault();
                return;
            }
        }
        // Touch missed all controls — let it pass through to the game
    };

    private _onPointerMove = (e: PointerEvent): void => {
        const control = this.pointers.get(e.pointerId);
        if (!control) return;
        const pos = this._toLocal(e);
        control._onTouchMove(pos.x, pos.y);
        e.stopImmediatePropagation();
        e.preventDefault();
    };

    private _onPointerUp = (e: PointerEvent): void => {
        const control = this.pointers.get(e.pointerId);
        if (!control) return;
        control._onTouchEnd();
        this.pointers.delete(e.pointerId);
        e.stopImmediatePropagation();
    };

    private _toLocal(e: PointerEvent): Vec2 {
        const rect = this.game.canvas.getBoundingClientRect();
        return new Vec2(
            (e.clientX - rect.left) * (this.game.width / rect.width),
            (e.clientY - rect.top) * (this.game.height / rect.height),
        );
    }
}
```

### 2.2 VirtualControl Base

File: `packages/touch/src/virtual-control.ts`

- [ ] Abstract base class extending `Node2D`
- [ ] `renderFixed = true`
- [ ] `containsPoint(x, y)` — hit test (circle or rect)
- [ ] Abstract methods: `_onTouchStart`, `_onTouchMove`, `_onTouchEnd`
- [ ] `input` getter for convenient access to the game's Input

```typescript
export abstract class VirtualControl extends Node2D {
    constructor() {
        super();
        this.renderFixed = true;
    }

    protected get input(): Input {
        return getInput(this.game)!;
    }

    abstract containsPoint(x: number, y: number): boolean;
    abstract _onTouchStart(x: number, y: number): void;
    abstract _onTouchMove(x: number, y: number): void;
    abstract _onTouchEnd(): void;
}
```

### 2.3 VirtualJoystick

File: `packages/touch/src/virtual-joystick.ts`

An analog joystick for continuous directional input. Thumb drags within a circular zone, producing axis values from -1 to 1.

- [ ] Configurable: radius, dead zone, actions (left/right/up/down)
- [ ] Visual: outer ring + inner knob that follows thumb
- [ ] Injects actions via `input.inject()` — digital press/release for each direction
- [ ] Optionally injects analog values via `input.injectAnalog()` for proportional control
- [ ] Knob snaps back to center on release

```typescript
export interface VirtualJoystickConfig {
    /** Screen position (center of the joystick). */
    position: Vec2;
    /** Outer radius in game pixels. Default: 40. */
    radius?: number;
    /** Dead zone as fraction of radius (0-1). Default: 0.2. */
    deadZone?: number;
    /** Actions to inject for each direction. */
    actions: {
        left?: string;
        right?: string;
        up?: string;
        down?: string;
    };
    /** Use analog injection (for proportional control). Default: false. */
    analog?: boolean;
}

export class VirtualJoystick extends VirtualControl {
    private config: Required<Omit<VirtualJoystickConfig, "actions" | "analog">>
        & Pick<VirtualJoystickConfig, "actions" | "analog">;
    private knobOffset = new Vec2(0, 0);
    private active = false;

    // Track which directions are currently injected (for release on end)
    private injected = new Set<string>();

    constructor(config: VirtualJoystickConfig) { /* ... */ }

    containsPoint(x: number, y: number): boolean {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        // Generous hit zone: 1.3x the visible radius
        return dx * dx + dy * dy <= (this.config.radius * 1.3) ** 2;
    }

    _onTouchStart(x: number, y: number): void {
        this.active = true;
        this._updateFromTouch(x, y);
    }

    _onTouchMove(x: number, y: number): void {
        if (!this.active) return;
        this._updateFromTouch(x, y);
    }

    _onTouchEnd(): void {
        this.active = false;
        this.knobOffset._set(0, 0);
        // Release all injected actions
        for (const action of this.injected) {
            this.input.inject(action, false);
        }
        this.injected.clear();
    }

    private _updateFromTouch(x: number, y: number): void {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = this.config.radius;

        // Clamp to radius
        if (dist > maxDist) {
            this.knobOffset._set((dx / dist) * maxDist, (dy / dist) * maxDist);
        } else {
            this.knobOffset._set(dx, dy);
        }

        // Compute normalized axes (-1 to 1)
        const nx = this.knobOffset.x / maxDist;
        const ny = this.knobOffset.y / maxDist;
        const deadZone = this.config.deadZone;

        // Inject horizontal
        this._injectDirection("left", "right", nx, deadZone);
        // Inject vertical
        this._injectDirection("up", "down", ny, deadZone);
    }

    private _injectDirection(
        negAction: string | undefined,
        posAction: string | undefined,
        value: number,
        deadZone: number,
    ): void {
        const absVal = Math.abs(value);
        if (absVal < deadZone) {
            // In dead zone — release both
            if (negAction) { this.input.inject(negAction, false); this.injected.delete(negAction); }
            if (posAction) { this.input.inject(posAction, false); this.injected.delete(posAction); }
        } else if (value < 0 && negAction) {
            this.input.inject(negAction, true);
            this.injected.add(negAction);
            if (posAction) { this.input.inject(posAction, false); this.injected.delete(posAction); }
        } else if (value > 0 && posAction) {
            this.input.inject(posAction, true);
            this.injected.add(posAction);
            if (negAction) { this.input.inject(negAction, false); this.injected.delete(negAction); }
        }
    }

    onDraw(ctx: DrawContext): void {
        const r = this.config.radius;
        const center = Vec2.ZERO; // Draw in local space

        // Outer ring (semi-transparent)
        ctx.circle(center, r, { stroke: Color.WHITE, strokeWidth: 2 });
        ctx.circle(center, r, { fill: new Color(1, 1, 1, 0.1) });

        // Inner knob
        const knobR = r * 0.4;
        ctx.circle(this.knobOffset, knobR, { fill: new Color(1, 1, 1, 0.5) });
    }
}
```

### 2.4 VirtualDPad

File: `packages/touch/src/virtual-dpad.ts`

A 4-directional pad for discrete movement. Unlike the joystick, this fires `justPressed` taps for grid-based games (Sokoban) and also supports continuous hold for games like Dungeon.

- [ ] Rendered as four arrow buttons arranged in a cross pattern
- [ ] Each direction is a separate hit zone
- [ ] Supports both hold (continuous inject) and tap modes
- [ ] Visual: cross-shaped arrangement of arrow triangles
- [ ] **Minimum 1-frame hold:** On touch end, the D-pad does NOT immediately call `inject(action, false)`. Instead, it queues the release for the next frame via `onFixedUpdate()`. This prevents the inject buffer (a `Map<string, boolean>`) from overwriting a `true` with `false` when a quick tap-and-release happens between frames. Without this, `isJustPressed()` would never see the press.

```typescript
export interface VirtualDPadConfig {
    /** Screen position (center of the D-pad). */
    position: Vec2;
    /** Size of each button in game pixels. Default: 32. */
    buttonSize?: number;
    /** Actions for each direction. */
    actions: {
        left?: string;
        right?: string;
        up?: string;
        down?: string;
    };
}

export class VirtualDPad extends VirtualControl {
    // Divides touch space into 4 quadrants from center
    // Up: y < center - deadband, abs(dx) < abs(dy)
    // Down: y > center + deadband, abs(dx) < abs(dy)
    // Left: x < center - deadband, abs(dy) < abs(dx)
    // Right: x > center + deadband, abs(dy) < abs(dx)

    private activeDirection: string | null = null;
    private pendingRelease: string | null = null;
    private releaseConsumed = false;

    _onTouchStart(x: number, y: number): void {
        const dir = this._directionFromPoint(x, y);
        if (dir) {
            this.activeDirection = dir;
            this.input.inject(dir, true);
        }
    }

    _onTouchEnd(): void {
        if (this.activeDirection) {
            // Don't release immediately — wait for at least one frame
            // so _beginFrame() sees the press before the release.
            this.pendingRelease = this.activeDirection;
            this.releaseConsumed = false;
            this.activeDirection = null;
        }
    }

    onFixedUpdate(_dt: number): void {
        if (this.pendingRelease) {
            if (this.releaseConsumed) {
                // One frame has passed since the press was consumed — now release
                this.input.inject(this.pendingRelease, false);
                this.pendingRelease = null;
            } else {
                // The press frame — mark as consumed, release next frame
                this.releaseConsumed = true;
            }
        }
    }
}
```

### 2.5 VirtualButton

File: `packages/touch/src/virtual-button.ts`

A circular button that injects a single action while held.

- [ ] Configurable: position, radius, action name, label/icon
- [ ] Visual: circle with text label
- [ ] Press visual feedback (scale/color change)
- [ ] Injects action on touch start, releases on touch end

```typescript
export interface VirtualButtonConfig {
    /** Screen position (center of the button). */
    position: Vec2;
    /** Radius in game pixels. Default: 24. */
    radius?: number;
    /** Action to inject when pressed. */
    action: string;
    /** Display label (short: "A", "B", "Jump", etc.). */
    label?: string;
    /** Fill color. Default: white with low alpha. */
    color?: Color;
}

export class VirtualButton extends VirtualControl {
    private pressed = false;

    containsPoint(x: number, y: number): boolean {
        const dx = x - this.position.x;
        const dy = y - this.position.y;
        return dx * dx + dy * dy <= (this.config.radius * 1.3) ** 2;
    }

    _onTouchStart(x: number, y: number): void {
        this.pressed = true;
        this.input.inject(this.config.action, true);
    }

    _onTouchMove(x: number, y: number): void {
        // Stay pressed even if finger drifts (already captured by overlay)
    }

    _onTouchEnd(): void {
        this.pressed = false;
        this.input.inject(this.config.action, false);
    }

    onDraw(ctx: DrawContext): void {
        const r = this.config.radius;
        const fill = this.pressed
            ? new Color(1, 1, 1, 0.5)
            : new Color(1, 1, 1, 0.2);
        ctx.circle(Vec2.ZERO, r, { fill, stroke: Color.WHITE, strokeWidth: 2 });
        if (this.config.label) {
            ctx.text(this.config.label, new Vec2(0, 0), {
                color: Color.WHITE,
                size: r * 0.6,
                align: "center",
                baseline: "middle",
            });
        }
    }
}
```

### 2.6 VirtualAimStick

File: `packages/touch/src/virtual-aim-stick.ts`

A specialized joystick for aiming (top-down shooter). Instead of injecting directional actions, it updates the Input's mouse position to simulate mouse aiming.

- [ ] Computes aim angle from stick direction
- [ ] Sets mouse position at a configurable distance from the player
- [ ] Fires a configurable action when active (e.g., "fire")

```typescript
export interface VirtualAimStickConfig {
    position: Vec2;
    radius?: number;
    deadZone?: number;
    /** Action to inject while stick is active (e.g., "fire"). Optional. */
    fireAction?: string;
    /** Node name to aim from (reads its position). */
    aimFrom?: string;
    /** Distance from the aim origin to set the mouse position. Default: 100. */
    aimDistance?: number;
}

export class VirtualAimStick extends VirtualControl {
    // On touch move:
    // 1. Compute normalized direction from stick offset
    // 2. Find the aimFrom node by name: game.currentScene.findByName(config.aimFrom)
    // 3. Compute aim target: aimNode.globalPosition + direction * aimDistance
    // 4. Call input.setMousePosition(target.x, target.y) to update aim
    // 5. If fireAction set and stick is outside dead zone, inject(fireAction, true)
    //
    // Requires promoting Input._setMousePosition() to a public
    // Input.setMousePosition(x, y) API (or adding injectMousePosition()).
}
```

### Tests for Phase 2

**Unit:** `packages/touch/src/virtual-joystick.test.ts`
- Joystick starts centered (knob at 0,0)
- Touch start within radius activates
- Touch move updates knob offset, clamped to radius
- Direction injection: touch right of center → `inject("right", true)`
- Dead zone: small movements don't inject
- Touch end releases all injected actions, knob resets
- `containsPoint` hit test with generous 1.3x zone

**Unit:** `packages/touch/src/virtual-dpad.test.ts`
- Touch in each quadrant injects the correct direction
- Diagonal touch → dominant axis wins
- Touch end releases direction after at least 1 frame (minimum hold)
- Quick tap-and-release within one frame still produces `isJustPressed`
- Continuous hold keeps action pressed across multiple frames

**Unit:** `packages/touch/src/virtual-button.test.ts`
- Touch start → `inject(action, true)`
- Touch end → `inject(action, false)`
- Finger drift doesn't release (captured by overlay)
- Visual: pressed state changes fill color

**Unit:** `packages/touch/src/touch-overlay.test.ts`
- Multi-touch: two pointers on different controls simultaneously
- Pointer on control → `stopImmediatePropagation` called
- Pointer miss → event passes through
- Pointer cancel → control released
- Auto-show on touch, auto-hide on mouse

---

## Phase 3: Preset Layouts

File: `packages/touch/src/layouts/`

Each layout factory function returns an array of virtual controls positioned appropriately for the game's canvas size. Controls are positioned relative to the game's logical dimensions (e.g., 320x240 for platformer), not the CSS display size.

### 3.1 platformerLayout

- [x] Factory: `platformerLayout(config)` → `TouchLayout`
- [x] Left/right D-pad buttons on lower-left
- [x] Jump button (large, "A") on lower-right
- [x] Used by: Platformer, Platformer-TSX

```typescript
export function platformerLayout(config?: {
    jumpAction?: string;  // Default: "jump"
}): TouchLayoutFactory {
    return (game: Game) => ({
        createControls(game: Game): Node2D[] {
            const w = game.width;
            const h = game.height;
            const margin = 12;
            const btnR = Math.min(w, h) * 0.08;

            return [
                // Left arrow button
                new VirtualButton({
                    position: new Vec2(margin + btnR, h - margin - btnR),
                    radius: btnR,
                    action: "left",
                    label: "<",
                }),
                // Right arrow button
                new VirtualButton({
                    position: new Vec2(margin + btnR * 3.5, h - margin - btnR),
                    radius: btnR,
                    action: "right",
                    label: ">",
                }),
                // Jump button (larger)
                new VirtualButton({
                    position: new Vec2(w - margin - btnR * 1.5, h - margin - btnR * 1.5),
                    radius: btnR * 1.5,
                    action: config?.jumpAction ?? "jump",
                    label: "A",
                }),
            ];
        },
    });
}
```

```
┌─────────────────────────────────────────┐
│                                         │
│              Game Area                  │
│                                         │
│                                         │
│                                         │
│   [<]  [>]                       (A)    │
└─────────────────────────────────────────┘
     L    R                       Jump
```

### 3.2 topDownLayout

- [x] Factory: `topDownLayout(config)` → `TouchLayout`
- [x] 8-way joystick on lower-left
- [x] 1-3 action buttons on lower-right
- [x] Used by: Dungeon, Space Shooter

```typescript
export function topDownLayout(config?: {
    actions?: Array<{ action: string; label: string }>;
}): TouchLayoutFactory;
```

```
┌─────────────────────────────────────────┐
│                                         │
│              Game Area                  │
│                                         │
│                                         │
│                                         │
│    (Joystick)             (B)   (A)     │
│     ◯  ←→↑↓                            │
└─────────────────────────────────────────┘
```

### 3.3 dualStickLayout

- [x] Factory: `dualStickLayout(config)` → `TouchLayout`
- [x] Movement joystick on lower-left
- [x] Aim joystick (VirtualAimStick) on lower-right
- [x] Optional fire button (or auto-fire when aim stick active)
- [x] Used by: Top-Down Shooter

```typescript
export function dualStickLayout(config?: {
    fireAction?: string;
    aimFrom?: string;
    aimDistance?: number;
    weaponButtons?: Array<{ action: string; label: string }>;
}): TouchLayoutFactory;
```

```
┌─────────────────────────────────────────┐
│                                         │
│              Game Area                  │
│                                         │
│  [1] [2] [3]                            │
│                                         │
│    (Move)                  (Aim)        │
│     ◯  ←→↑↓               ◯  ←→↑↓     │
└─────────────────────────────────────────┘
```

### 3.4 puzzleLayout

- [x] Factory: `puzzleLayout(config)` → `TouchLayout`
- [x] 4-way D-pad centered at bottom
- [x] Undo/Reset buttons along the top or side
- [x] Used by: Sokoban

```
┌─────────────────────────────────────────┐
│                                         │
│              Game Area                  │
│                                         │
│                                         │
│  [Undo] [Reset]        [▲]             │
│                      [◄] [►]            │
│                         [▼]             │
└─────────────────────────────────────────┘
```

### 3.5 pointClickLayout

- [x] Factory: `pointClickLayout(config)` → `TouchLayout`
- [x] No virtual controls — touch passes through as mouse clicks
- [x] Optional toolbar buttons along an edge
- [x] Used by: Tower Defense, Breakout

For **Tower Defense**: Touch already works for placement since the PointerDispatcher handles pointer events. Tower selection uses the existing UI buttons. This layout adds optional shortcut buttons if needed, but the default is no virtual controls — just pass-through touch.

For **Breakout**: The paddle follows mouse/touch X position. Need to wire `pointermove` to update `mousePosition` for touch (currently only `mousemove` is handled by InputPlugin). Add optional left/right buttons as an alternative.

```typescript
export function pointClickLayout(config?: {
    /** Extra buttons to show (e.g., tower types). */
    buttons?: Array<{ action: string; label: string; position: Vec2 }>;
}): TouchLayoutFactory;
```

### 3.6 breakoutLayout

- [x] Factory: `breakoutLayout(config)` → `TouchLayout`
- [x] Left/right buttons at bottom (alternative to touch-follow)
- [x] Launch button
- [x] Touch-follow mode via `TouchFollowZone` control

**Touch-follow behavior:** A transparent full-screen `TouchFollowZone` control (extends `VirtualControl`) captures any touch that misses the discrete buttons. On `_onTouchMove`, it calls `input.setMousePosition(touchX, paddleY)` to move the paddle to the finger's X position. This leverages the existing paddle-follows-mouse logic already in the breakout game. The `containsPoint()` returns `true` for the entire game area, but it is added *last* to the controls array so discrete buttons (left, right, launch) get priority in the overlay's hit-test loop.

```
┌───────────────────────────┐
│                           │
│       Game Area           │
│     (touch anywhere to    │
│      move paddle to X)    │
│                           │
│                           │
│                           │
│   [<]    (Launch)   [>]   │
└───────────────────────────┘
```

### Tests for Phase 3

**Unit:** `packages/touch/src/layouts/platformer-layout.test.ts`
- Creates correct number of controls
- Controls positioned within game bounds
- Jump button on lower-right, arrows on lower-left

**Unit:** `packages/touch/src/layouts/top-down-layout.test.ts`
- Joystick on lower-left
- Action buttons on lower-right
- Custom action list respected

**Unit:** `packages/touch/src/layouts/dual-stick-layout.test.ts`
- Two joysticks: left for movement, right for aiming
- Weapon buttons positioned above aim stick

---

## Phase 4: Example Game Integration

### 4.1 Add PointerEvent Support to InputPlugin

File: `packages/input/src/input-plugin.ts`

Before integrating virtual controls, the InputPlugin needs to handle `PointerEvent` for mouse position on touch devices. Currently it only listens for `MouseEvent`. Touch devices don't reliably fire `mousemove`.

- [ ] Replace `mousemove`/`mousedown`/`mouseup` listeners with `pointermove`/`pointerdown`/`pointerup`
- [ ] Filter to `pointerType !== "touch"` when virtual controls handle touch (avoid double-input)
- [ ] Or: keep both, but ensure virtual control's `stopPropagation` prevents the InputPlugin from seeing touch-captured events

Actually, the simplest fix: **Switch InputPlugin from MouseEvent to PointerEvent**. PointerEvent extends MouseEvent, so the same `e.clientX`, `e.button` etc. work identically. This immediately gives us touch support for games like Tower Defense that use direct touch.

```typescript
// Replace in InputPlugin:
// canvas.addEventListener("mousedown", onMouseDown);
// canvas.addEventListener("mousemove", onMouseMove);
// document.addEventListener("mouseup", onMouseUp);

// With:
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
document.addEventListener("pointerup", onPointerUp);
```

The handler signatures change from `MouseEvent` to `PointerEvent` but the logic is identical. `e.button` and `e.clientX/Y` exist on both.

### 4.2 Update HTML Files

All example HTML files need mobile viewport improvements:

- [ ] Add `maximum-scale=1, user-scalable=no` to viewport meta
- [ ] Remove hardcoded `style="width: Xpx; height: Ypx"` from canvas elements (let `scale: "fit"` handle it)
- [ ] Add `<meta name="apple-mobile-web-app-capable" content="yes">` for iOS
- [ ] Simplify body styles for fullscreen mode

Template:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<style>
  body { margin: 0; background: #1a1a2e; overflow: hidden; }
  canvas { display: block; touch-action: none; }
</style>
```

**Note:** The `viewport-fit=cover` allows the canvas to extend behind the notch/home indicator on modern iPhones. The `_setupScaling()` method should account for safe area insets by reading `env(safe-area-inset-*)` via a CSS probe element, and layout factories should add those insets to their margin calculations so controls aren't occluded by the notch or home indicator.

### 4.3 Platformer Integration

Files: `examples/platformer/main.ts`, `examples/platformer-tsx/main.ts`

- [ ] Add `import { TouchPlugin, platformerLayout } from "@quintus/touch"`
- [ ] Add `game.use(TouchPlugin({ layout: platformerLayout() }))` after InputPlugin
- [ ] Set `scale: "fit"` in GameOptions
- [ ] Update `index.html` with mobile viewport
- [ ] Test: virtual left/right buttons move player, jump button works with double jump

```typescript
// examples/platformer/main.ts — add after existing plugins
import { TouchPlugin, platformerLayout } from "@quintus/touch";

game.use(TouchPlugin({
    layout: platformerLayout({ jumpAction: "jump" }),
    fullscreen: true,
}));
```

### 4.4 Dungeon Integration

Files: `examples/dungeon/main.ts`

- [ ] Use `topDownLayout` with 4 action buttons: Attack (A), Defend (B), Interact (C), Potion (D)
- [ ] Joystick for 4-directional movement
- [ ] Scale: "fit"

```typescript
game.use(TouchPlugin({
    layout: topDownLayout({
        actions: [
            { action: "attack", label: "Atk" },
            { action: "defend", label: "Def" },
            { action: "interact", label: "E" },
            { action: "use_potion", label: "Pot" },
        ],
    }),
    fullscreen: true,
}));
```

### 4.5 Breakout Integration

Files: `examples/breakout/main.ts`

- [ ] Use `breakoutLayout` with left/right + launch
- [ ] Also support touch-follow: moving finger across screen moves paddle
- [ ] Scale: "fit"

### 4.6 Sokoban Integration

Files: `examples/sokoban/main.ts`

- [ ] Use `puzzleLayout` with undo and reset buttons
- [ ] D-pad for 4-way discrete movement
- [ ] Scale: "fit"

```typescript
game.use(TouchPlugin({
    layout: puzzleLayout({
        extraButtons: [
            { action: "undo", label: "Undo" },
            { action: "reset", label: "Reset" },
            { action: "menu", label: "Menu" },
        ],
    }),
    fullscreen: true,
}));
```

### 4.7 Tower Defense Integration

Files: `examples/tower-defense/main.ts`

- [ ] Use `pointClickLayout` — touch passes through as mouse position + click
- [ ] Tower selection already uses UI buttons which work with PointerEvent
- [ ] The PointerEvent upgrade in InputPlugin (4.1) handles touch-to-place automatically
- [ ] Scale: "fit"
- [ ] Optionally add tower shortcut buttons at the top: [1] [2] [3]

### 4.8 Top-Down Shooter Integration

Files: `examples/top-down-shooter/main.ts`

- [ ] Use `dualStickLayout` with aim stick
- [ ] Left stick: movement (move_up/down/left/right)
- [ ] Right stick: aim direction (updates mouse position) + auto-fire
- [ ] Weapon switch buttons: [1] [2] [3]
- [ ] Scale: "fit"

```typescript
game.use(TouchPlugin({
    layout: dualStickLayout({
        fireAction: "fire",
        aimFrom: "Player",
        aimDistance: 120,
        weaponButtons: [
            { action: "weapon1", label: "1" },
            { action: "weapon2", label: "2" },
            { action: "weapon3", label: "3" },
        ],
    }),
    fullscreen: true,
}));
```

### 4.9 Space Shooter Integration

Files: `examples/space-shooter/main.ts`

- [ ] Use `topDownLayout` with fire button
- [ ] Joystick for 4-directional movement
- [ ] Large fire button on right
- [ ] Scale: "fit"

### Tests for Phase 4

**Automated headless tests** (one per game, using `@quintus/headless` + `@quintus/test`):

Each test verifies: (1) TouchOverlay exists in the scene tree after `game.start()`, (2) expected controls exist with correct action names, (3) calling `input.inject()` from the controls produces expected game state changes.

**Integration:** `examples/platformer/__tests__/touch.test.ts`
- Virtual controls appear in scene tree (3 controls: left, right, jump)
- Injecting via virtual button triggers player jump
- Left/right injection moves player

**Integration:** `examples/dungeon/__tests__/touch.test.ts`
- TouchOverlay with joystick + 4 action buttons
- Joystick direction injection moves player

**Integration:** `examples/sokoban/__tests__/touch.test.ts`
- D-pad + undo/reset buttons present
- D-pad tap moves player exactly one tile (minimum-1-frame hold)

**Integration:** `examples/breakout/__tests__/touch.test.ts`
- Launch button and left/right controls present
- Launch injection starts ball

**Integration:** `examples/tower-defense/__tests__/touch.test.ts`
- Point-click layout: no virtual controls blocking game area
- Touch passes through to PointerDispatcher for tower placement

**Integration:** `examples/top-down-shooter/__tests__/touch.test.ts`
- Dual stick layout: movement joystick + aim stick present
- Movement injection moves player

**Integration:** `examples/space-shooter/__tests__/touch.test.ts`
- Joystick + fire button present
- Fire injection triggers shooting

**Manual on-device testing** (for visual polish and platform-specific issues):
- iOS Safari (iPhone)
- Android Chrome
- iPad Safari (landscape + portrait)

Verify for each game:
- [ ] Controls auto-appear on touch
- [ ] Controls auto-hide when mouse moves
- [ ] Multi-touch works (move + action simultaneously)
- [ ] Canvas fills screen on mobile
- [ ] No scroll/zoom/rubber-banding
- [ ] Fullscreen on first interaction (if supported)
- [ ] Game is playable end-to-end
- [ ] Controls not occluded by notch/home indicator (safe area insets)

---

## API Summary

### Quick Start (3 lines)

```typescript
import { TouchPlugin, platformerLayout } from "@quintus/touch";

const game = new Game({ width: 320, height: 240, scale: "fit", canvas: "game" });
game.use(TouchPlugin({ layout: platformerLayout() }));
```

### Full Configuration

```typescript
game.use(TouchPlugin({
    layout: topDownLayout({
        actions: [
            { action: "attack", label: "A" },
            { action: "defend", label: "B" },
        ],
    }),
    fullscreen: true,        // Request fullscreen on first touch
    preventScroll: true,     // Prevent page scroll (default: true)
    visible: undefined,      // Auto-detect (default), or force true/false
    opacity: 0.4,            // Control opacity (default: 0.4)
}));
```

### Custom Layout

```typescript
game.use(TouchPlugin({
    layout: {
        createControls(game: Game): Node2D[] {
            return [
                new VirtualJoystick({
                    position: new Vec2(60, game.height - 60),
                    radius: 40,
                    actions: { left: "left", right: "right", up: "up", down: "down" },
                }),
                new VirtualButton({
                    position: new Vec2(game.width - 40, game.height - 40),
                    radius: 28,
                    action: "fire",
                    label: "Fire",
                }),
            ];
        },
    },
}));
```

---

## File Structure

```
packages/touch/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts
    ├── touch-plugin.ts          — Plugin: install, lifecycle, config
    ├── touch-overlay.ts         — Multi-touch dispatch container
    ├── virtual-control.ts       — Abstract base class
    ├── virtual-joystick.ts      — Analog joystick
    ├── virtual-dpad.ts          — 4-way directional pad
    ├── virtual-button.ts        — Action button
    ├── virtual-aim-stick.ts     — Aim joystick (sets mouse position)
    ├── fullscreen.ts            — Fullscreen API helpers
    ├── scroll-lock.ts           — Scroll/zoom prevention
    ├── detect.ts                — Touch device detection
    ├── layouts/
    │   ├── index.ts
    │   ├── platformer-layout.ts
    │   ├── top-down-layout.ts
    │   ├── dual-stick-layout.ts
    │   ├── puzzle-layout.ts
    │   ├── point-click-layout.ts
    │   └── breakout-layout.ts
    └── __tests__/
        ├── virtual-joystick.test.ts
        ├── virtual-dpad.test.ts
        ├── virtual-button.test.ts
        ├── touch-overlay.test.ts
        ├── detect.test.ts
        ├── scroll-lock.test.ts
        └── layouts.test.ts
```

---

## Definition of Done

- [ ] All phases marked Done in status table
- [ ] `packages/touch/` builds with `pnpm build`
- [ ] `pnpm test` passes with all new tests
- [ ] `pnpm lint` clean
- [ ] All 7 example games have touch controls enabled
- [ ] `scale: "fit"` implemented in `@quintus/core`
- [ ] InputPlugin uses PointerEvent (not MouseEvent)
- [ ] Canvas fills viewport on mobile with correct aspect ratio
- [ ] No scroll/zoom on mobile devices
- [ ] Multi-touch works (simultaneous movement + action)
- [ ] Controls auto-show for touch, auto-hide for mouse
- [ ] Fullscreen requested on first interaction
