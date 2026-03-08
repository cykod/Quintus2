# Fix: Touch Input & mousePosition — Detailed Design

> **Goal:** Make touch input work correctly across all example games without special-case hacks in InputPlugin
> **Outcome:** Tower defense placement, top-down shooter dual-stick aiming, breakout paddle tracking, and all other games work on both desktop and mobile with a simple, understandable input model

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Revert InputPlugin to simple pointer handling | Done |
| 2 | Add aim action injection to VirtualAimStick | Done |
| 3 | Update top-down shooter player aiming | Done |
| 4 | Update and add tests | Done |

## Background: What Went Wrong

The `mousePosition` field on `Input` is a shared Vec2 that any system can read or write. Three things update it:

1. **InputPlugin** — `onPointerDown` and `onPointerMove` DOM listeners
2. **VirtualAimStick** — calls `input.setMousePosition()` with a computed aim target
3. **TouchFollowZone** — calls `input.setMousePosition()` with the touch X position

On desktop, only (1) fires. On mobile, all three can fire in the same frame, and the last write wins. The bug: touching the **movement joystick** fires a `pointerdown` event that updates `mousePosition` to the joystick's screen position, overriding the aim stick's carefully computed target.

A previous fix filtered touch events out of InputPlugin (skipping `mousePosition` updates for `pointerType === "touch"`). This fixed the shooter but broke tower defense, which relies on `mousePosition` being set from taps. Attempts to patch this with forwarding hacks in TouchOverlay created a fragile system that was hard to reason about.

## Design Principle: Simple Data Flow

The fix follows one principle: **each game has exactly one source of truth for mousePosition, and the game code knows which one it's using.**

```
Desktop mouse     ──→ InputPlugin writes mousePosition ──→ game reads mousePosition
Touch (point-click) ──→ InputPlugin writes mousePosition ──→ game reads mousePosition
Touch (aim stick)   ──→ VirtualAimStick injects aim actions ──→ game reads getAxis()
Touch (follow zone) ──→ TouchFollowZone writes mousePosition ──→ game reads mousePosition
```

The key insight: **InputPlugin should be dumb.** It sees a pointer event, it updates `mousePosition`. No filtering by pointer type. The smart logic lives in game code, which chooses between `mousePosition` (desktop) and `getAxis()` (mobile aim stick).

For the top-down shooter specifically, the VirtualAimStick is changed to inject directional actions (like VirtualJoystick already does), giving the player two clean input pathways:
- **Mouse pathway:** `input.mousePosition` → `atan2()` — used on desktop
- **Stick pathway:** `input.getAxis("aim_left", "aim_right")` → `atan2()` — used on mobile and gamepad

When the stick pathway is active (axes non-zero), the mouse pathway is ignored. On mobile with no active aim stick, the player holds its current rotation.

## Phase 1: Revert InputPlugin to Simple Pointer Handling

Remove all touch-specific filtering from `InputPlugin`. Every pointer event updates `mousePosition`, regardless of `pointerType`.

### File: `packages/input/src/input-plugin.ts`

**Before (current, broken):**
```ts
const onPointerDown = (e: PointerEvent) => {
    // Touch position is managed by TouchOverlay — it forwards
    // unhandled touches and lets virtual controls call
    // setMousePosition() explicitly.
    if (e.pointerType !== "touch" && game.canvas) {
        // ... update mousePosition
    }
    input._bufferMousePress(e.button);
};

const onPointerMove = (e: PointerEvent) => {
    // Touch position is managed by TouchOverlay (see onPointerDown).
    if (e.pointerType === "touch") return;
    // ... update mousePosition
};
```

**After (simple):**
```ts
const onPointerDown = (e: PointerEvent) => {
    if (game.canvas) {
        const rect = game.canvas.getBoundingClientRect();
        const scaleX = game.width / rect.width;
        const scaleY = game.height / rect.height;
        input._setMousePosition(
            (e.clientX - rect.left) * scaleX,
            (e.clientY - rect.top) * scaleY,
        );
    }
    input._bufferMousePress(e.button);
};

const onPointerMove = (e: PointerEvent) => {
    if (!game.canvas) return;
    const rect = game.canvas.getBoundingClientRect();
    const scaleX = game.width / rect.width;
    const scaleY = game.height / rect.height;
    input._setMousePosition(
        (e.clientX - rect.left) * scaleX,
        (e.clientY - rect.top) * scaleY,
    );
};
```

No comments about touch. No special cases. Every pointer event is equal.

### File: `packages/touch/src/touch-overlay.ts`

Remove the mousePosition forwarding hack added in the previous attempt. The `_onTouchStartHandler` should go back to its original form — no `getInput()` import, no `setMousePosition()` call for unhandled touches.

**Before (hacked):**
```ts
this._onTouchStartHandler = (e: TouchEvent) => {
    this._hasTouchEvents = true;
    let hit = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (!touch) continue;
        const pos = this._toLocal(touch);
        if (this._handleStart(touch.identifier, pos.x, pos.y)) {
            hit = true;
        } else {
            // No control claimed this touch — forward position to Input
            const input = getInput(this.game);
            input?.setMousePosition(pos.x, pos.y);
        }
    }
    if (hit) e.preventDefault();
};
```

**After (clean):**
```ts
this._onTouchStartHandler = (e: TouchEvent) => {
    this._hasTouchEvents = true;
    let hit = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (!touch) continue;
        const pos = this._toLocal(touch);
        if (this._handleStart(touch.identifier, pos.x, pos.y)) hit = true;
    }
    if (hit) e.preventDefault();
};
```

Also remove the `import { getInput } from "@quintus/input"` line.

- [ ] Remove `pointerType` check from `onPointerDown` in `input-plugin.ts`
- [ ] Remove `pointerType === "touch"` early return from `onPointerMove` in `input-plugin.ts`
- [ ] Remove `getInput` import and `setMousePosition` forwarding from `touch-overlay.ts`

## Phase 2: Add Aim Action Injection to VirtualAimStick

The VirtualAimStick currently only calls `setMousePosition()` for aiming. This creates a coupling where game code must read `mousePosition` and can't distinguish aim stick input from raw touch input.

Add optional `aimActions` config so the stick injects directional actions (like VirtualJoystick does). This gives game code a clean axis-based input pathway.

### File: `packages/touch/src/virtual-aim-stick.ts`

**Add to config interface:**
```ts
export interface VirtualAimStickConfig {
    position: Vec2;
    radius?: number;
    deadZone?: number;
    fireAction?: string;
    aimFrom?: string;
    aimDistance?: number;
    /** Optional aim direction actions to inject (like VirtualJoystick). */
    aimActions?: {
        left?: string;
        right?: string;
        up?: string;
        down?: string;
    };
}
```

**Add injection logic to `_updateFromTouch()`:**

Reuse the same `_injectDirection` pattern that VirtualJoystick uses. When aimActions is provided, inject digital directional actions based on the stick's normalized displacement.

```ts
export class VirtualAimStick extends VirtualControl {
    // ... existing fields ...
    readonly aimActions: { left?: string; right?: string; up?: string; down?: string } | undefined;
    private _injectedAim = new Set<string>();

    constructor(config: VirtualAimStickConfig) {
        // ... existing constructor ...
        this.aimActions = config.aimActions;
    }

    _onTouchEnd(): void {
        this._active = false;
        this._knobOffset = new Vec2(0, 0);
        if (this._firing && this.fireAction) {
            this.input.inject(this.fireAction, false);
            this._firing = false;
        }
        // Release all aim actions
        for (const action of this._injectedAim) {
            this.input.inject(action, false);
        }
        this._injectedAim.clear();
    }

    private _updateFromTouch(x: number, y: number): void {
        // ... existing knob offset + clamping logic (unchanged) ...

        const normalized = dist > 0 ? dist / this.radius : 0;
        const inDeadZone = normalized < this.deadZone;

        // Inject aim direction actions (if configured)
        if (this.aimActions && dist > 0) {
            const nx = dx / this.radius;
            const ny = dy / this.radius;
            this._injectDirection(this.aimActions.left, this.aimActions.right, nx);
            this._injectDirection(this.aimActions.up, this.aimActions.down, ny);
        }

        // Update aim position (existing logic, unchanged)
        if (!inDeadZone && this.aimFrom && dist > 0) {
            // ... existing setMousePosition logic ...
        }

        // Fire action (existing logic, unchanged)
        // ...
    }

    private _injectDirection(
        negAction: string | undefined,
        posAction: string | undefined,
        value: number,
    ): void {
        const absValue = Math.abs(value);
        const inDeadZone = absValue < this.deadZone;

        if (negAction) {
            if (!inDeadZone && value < 0) {
                this.input.inject(negAction, true);
                this._injectedAim.add(negAction);
            } else if (this._injectedAim.has(negAction)) {
                this.input.inject(negAction, false);
                this._injectedAim.delete(negAction);
            }
        }

        if (posAction) {
            if (!inDeadZone && value > 0) {
                this.input.inject(posAction, true);
                this._injectedAim.add(posAction);
            } else if (this._injectedAim.has(posAction)) {
                this.input.inject(posAction, false);
                this._injectedAim.delete(posAction);
            }
        }
    }
}
```

Note: the `_injectDirection` method is identical to `VirtualJoystick._injectDirection`. A shared helper could be extracted later, but for now keeping it inline is simpler.

The `setMousePosition()` call is **kept** alongside `aimActions`. It's harmless — on mobile the player won't read it when aim axes are active, and removing it would break any game code that does read mousePosition from the aim stick.

- [ ] Add `aimActions` to `VirtualAimStickConfig` interface
- [ ] Add `_injectedAim` tracking set and `_injectDirection()` method
- [ ] Inject aim actions in `_updateFromTouch()` when `aimActions` is configured
- [ ] Release aim actions in `_onTouchEnd()`

## Phase 3: Update Top-Down Shooter Player Aiming

The player currently has one aiming pathway with a fallback chain:

```ts
// Current: prefer right stick, fall back to mouse
if (aimX or aimY active) {
    rotation = atan2(aimY, aimX);       // gamepad right stick
} else {
    rotation = atan2(mouse - position);  // mouse aim
}
```

With VirtualAimStick now injecting aim actions, the axis check covers both gamepad AND mobile aim stick. The mouse fallback only needs to fire on desktop.

### File: `examples/top-down-shooter/entities/player.tsx`

```ts
import { getTouchState } from "@quintus/touch";

// In onFixedUpdate:
const aimX = input.getAxis("aim_left", "aim_right");
const aimY = input.getAxis("aim_up", "aim_down");
if (Math.abs(aimX) > 0.1 || Math.abs(aimY) > 0.1) {
    // Gamepad right stick or mobile aim stick — use axis direction
    this.rotation = Math.atan2(aimY, aimX);
} else {
    // Mouse aim — only on desktop (touch uses the aim stick above)
    const touchState = getTouchState(this.game);
    if (touchState?.inputMethod !== "touch") {
        const mouse = input.mousePosition;
        this.rotation = Math.atan2(mouse.y - this.position.y, mouse.x - this.position.x);
    }
    // On touch with no active aim stick: keep current rotation
}
```

The logic reads naturally:
1. If the aim stick or gamepad is providing direction → use it
2. If we're on desktop → use the mouse
3. If we're on mobile with no aim input → hold steady

### File: `examples/top-down-shooter/main.ts`

Pass `aimActions` to the dual-stick layout so the aim stick injects directional actions:

```ts
game.use(
    TouchPlugin({
        layout: dualStickLayout({
            fireAction: "fire",
            aimFrom: "Player",
            aimDistance: 120,
            aimActions: {
                left: "aim_left",
                right: "aim_right",
                up: "aim_up",
                down: "aim_down",
            },
        }),
        fullscreen: true,
    }),
);
```

### File: `packages/touch/src/layouts/dual-stick-layout.ts`

Pass through `aimActions` from the layout config to VirtualAimStick:

```ts
export interface DualStickLayoutConfig {
    fireAction?: string;
    aimFrom?: string;
    aimDistance?: number;
    /** Optional aim direction actions for the aim stick. */
    aimActions?: { left?: string; right?: string; up?: string; down?: string };
    weaponButtons?: Array<{ action: string; label: string }>;
}

// In createControls:
new VirtualAimStick({
    position: new Vec2(w - margin - stickR, h - margin - stickR),
    radius: stickR,
    fireAction: config?.fireAction,
    aimFrom: config?.aimFrom,
    aimDistance: config?.aimDistance,
    aimActions: config?.aimActions,
}),
```

- [ ] Add `aimActions` passthrough to `DualStickLayoutConfig` and `dualStickLayout()`
- [ ] Configure `aimActions` in `examples/top-down-shooter/main.ts`
- [ ] Update `Player.onFixedUpdate()` to check `inputMethod` for mouse fallback
- [ ] Add `getTouchState` import to player

## Phase 4: Update and Add Tests

### File: `packages/input/src/input-plugin.test.ts`

Revert the touch-filtering test to verify all pointers update mousePosition:

```ts
it("pointerdown sets mouse position (touch has no preceding pointermove)", () => {
    // ... simulate touch pointerdown ...
    // mousePosition should be updated (no touch filtering)
    expect(input.mousePosition.x).toBe(200);
    expect(input.mousePosition.y).toBe(150);
});
```

Remove the "touch pointer events skip mousePosition" test — that behavior no longer exists.

### File: `packages/touch/src/virtual-aim-stick.test.ts`

Add tests for the new `aimActions` feature:

```ts
it("injects aim direction actions when aimActions configured", () => {
    // Create aim stick with aimActions: { left, right, up, down }
    // Simulate touch at 45-degree angle (right + down)
    // Verify aim_right and aim_down are pressed
    // Verify aim_left and aim_up are NOT pressed
});

it("releases aim actions on touch end", () => {
    // Touch aim stick, verify actions injected
    // End touch, verify all aim actions released
});

it("does not inject aim actions when aimActions not configured", () => {
    // Create aim stick without aimActions (backwards compat)
    // Simulate touch, verify no aim actions injected
});
```

### File: `packages/touch/src/touch-overlay.test.ts`

Remove the "forwards mousePosition for touches not claimed by any control" test — that forwarding is being removed.

### Existing tests to verify still pass

- `packages/input/src/input-plugin.test.ts` — all 13 tests
- `packages/touch/src/touch-overlay.test.ts` — all existing tests (minus the forwarding test)
- `packages/touch/src/virtual-aim-stick.test.ts` — existing + new tests
- `examples/top-down-shooter/__tests__/` — all 29 tests
- `examples/tower-defense/__tests__/` — all 36 tests
- Full suite: `pnpm test` should pass with 2163+ tests

- [ ] Revert input-plugin test to assert touch updates mousePosition
- [ ] Remove touch-skip test from input-plugin
- [ ] Remove mousePosition forwarding test from touch-overlay
- [ ] Add aimActions injection tests to virtual-aim-stick
- [ ] Add aimActions release-on-end test
- [ ] Add backwards-compat test (no aimActions configured)
- [ ] Verify all existing tests pass

## Impact on All Example Games

| Game | Touch Layout | mousePosition Usage | Impact |
|------|-------------|---------------------|--------|
| **Tower Defense** | `pointClickLayout()` | `PlacementManager` reads on tap | **Fixed.** Touch updates mousePosition directly via InputPlugin. No hacks needed. |
| **Top-Down Shooter** | `dualStickLayout()` | Player aims via axes (stick) or mousePosition (desktop) | **Fixed.** Aim stick injects actions; player checks `inputMethod` for mouse fallback. Movement joystick touch updates mousePosition but player ignores it when axes or touch active. |
| **Breakout** | `breakoutLayout()` | `TouchFollowZone` calls `setMousePosition()` | **No change.** Follow zone is a virtual control; it calls `setMousePosition()` explicitly. Works on both desktop (mouse) and mobile (follow zone). |
| **Platformer** | `platformerLayout()` | None | **No change.** No mousePosition usage. |
| **Dungeon** | `topDownLayout()` | None | **No change.** D-pad + buttons only. |
| **All others** | Various or none | None | **No change.** No mousePosition dependency. |

## Data Flow Diagrams

### Tower Defense (Mobile)

```
Touch on grid cell
  → touchstart fires
  → pointerdown fires (pointerType: "touch")
  → InputPlugin.onPointerDown
  → input._setMousePosition(cellX, cellY)
  → PlacementManager reads input.mousePosition
  → Turret placed at correct cell
```

### Top-Down Shooter (Mobile, Aim Stick Active)

```
Touch on aim stick
  → touchstart fires → TouchOverlay claims it → VirtualAimStick._onTouchStart
  → VirtualAimStick._updateFromTouch:
      1. input.inject("aim_right", true)    ← NEW: injects direction
      2. input.inject("aim_down", true)     ← NEW: injects direction
      3. input.setMousePosition(target)     ← kept (harmless)
  → pointerdown fires → InputPlugin.onPointerDown
  → input._setMousePosition(stickScreenPos) ← writes stale position (ignored)
  → Player.onFixedUpdate:
      aimX = getAxis("aim_left", "aim_right") → non-zero! (from inject)
      → rotation = atan2(aimY, aimX)          ← uses stick direction
      → mousePosition is IGNORED
```

### Top-Down Shooter (Mobile, Only Movement Stick)

```
Touch on movement joystick
  → touchstart → TouchOverlay claims it → VirtualJoystick._onTouchStart
  → VirtualJoystick: input.inject("move_right", true)
  → pointerdown → InputPlugin.onPointerDown
  → input._setMousePosition(joystickScreenPos) ← writes joystick position
  → Player.onFixedUpdate:
      aimX = getAxis("aim_left", "aim_right") → 0 (aim stick not touched)
      → touchState.inputMethod === "touch" → skip mouse fallback
      → rotation stays unchanged (holds last aim direction)
```

### Top-Down Shooter (Desktop, Mouse)

```
Mouse moves over game area
  → pointermove fires (pointerType: "mouse")
  → InputPlugin.onPointerMove
  → input._setMousePosition(mouseX, mouseY)
  → Player.onFixedUpdate:
      aimX = getAxis("aim_left", "aim_right") → 0 (no gamepad)
      → touchState.inputMethod !== "touch" → use mouse fallback
      → rotation = atan2(mouse - position)
```

## Definition of Done

- [ ] All phases marked Done in status table
- [ ] InputPlugin has ZERO touch-specific logic (no `pointerType` checks)
- [ ] TouchOverlay has ZERO mousePosition forwarding
- [ ] VirtualAimStick supports optional `aimActions` for directional injection
- [ ] Top-down shooter uses axis-based aim on mobile, mouse aim on desktop
- [ ] Tower defense tap-to-place works on mobile
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes (2163+ tests)
- [ ] `pnpm lint` clean
