# Phase 3: Sprites & Input — Detailed Design

> **Goal:** Sprite sheets, frame animation, and the Godot-style input action system. After this phase, you can build a visually animated platformer with keyboard/gamepad controls.
> **Duration:** ~2 weeks
> **Outcome:** An animated platformer demo runs in the browser. Player character has run/jump/idle/fall animations driven by a sprite sheet. Controls work via named input actions mapped to keyboard and gamepad. `@quintus/sprites` + `@quintus/input` ship as valid ESM/CJS bundles. All tests pass.

---

## Table of Contents

1. [Core Changes](#1-core-changes)
   - [preFrame Signal & beginFrame Callback](#11-preframe-signal--beginframe-callback)
2. [Package: @quintus/sprites](#2-package-quintussprites)
   - [SpriteSheet](#21-spritesheet)
   - [Sprite](#22-sprite)
   - [AnimatedSprite](#23-animatedsprite)
   - [File Structure](#24-file-structure)
3. [Package: @quintus/input](#3-package-quintusinput)
   - [Input Class](#31-input-class)
   - [InputPlugin](#32-inputplugin)
   - [Binding Format](#33-binding-format)
   - [Gamepad Support](#34-gamepad-support)
   - [Mouse Support](#35-mouse-support)
   - [Input Injection](#36-input-injection)
   - [Input Events & Propagation](#37-input-events--propagation)
   - [File Structure](#38-file-structure)
4. [Cross-Cutting Concerns](#4-cross-cutting-concerns)
   - [Determinism](#41-determinism)
   - [Performance](#42-performance)
   - [Error Handling](#43-error-handling)
5. [Test Plan](#5-test-plan)
6. [Demo: Animated Platformer](#6-demo-animated-platformer)
7. [Definition of Done](#7-definition-of-done)
8. [Execution Order](#8-execution-order)

---

## 1. Core Changes

Phase 3 requires one small change to `@quintus/core`. It is additive and backward-compatible.

### 1.1 preFrame Signal & beginFrame Callback

Input must be polled once per frame, **before** any `fixedUpdate` or `update` calls. This ensures `isJustPressed()` returns consistent results for all update callbacks within a single frame.

**File:** `packages/core/src/game-loop.ts`

Add an optional `beginFrame` callback to the game loop:

```typescript
export class GameLoop {
	constructor(
		private readonly config: GameLoopConfig,
		private readonly callbacks: {
			beginFrame?: () => void;   // NEW — fires once per frame, before updates
			fixedUpdate: (dt: number) => void;
			update: (dt: number) => void;
			render: () => void;
			cleanup: () => void;
		},
	) {}

	private tick(timestamp: number): void {
		if (!this._running) return;

		const rawDt = (timestamp - this.lastTimestamp) / 1000;
		this.lastTimestamp = timestamp;
		const frameDt = Math.min(rawDt, this.config.maxAccumulator);
		this.accumulator += frameDt;
		this.elapsed += frameDt;

		// NEW — fire once per frame before any updates
		this.callbacks.beginFrame?.();

		const fixedDt = this.config.fixedDeltaTime;
		while (this.accumulator >= fixedDt) {
			this.callbacks.fixedUpdate(fixedDt);
			this.fixedFrame++;
			this.accumulator -= fixedDt;
		}

		this.callbacks.update(frameDt);
		this.callbacks.render();
		this.callbacks.cleanup();

		this.rafId = requestAnimationFrame((t) => this.tick(t));
	}

	step(variableDt?: number): void {
		const fixedDt = this.config.fixedDeltaTime;
		this.callbacks.beginFrame?.();   // NEW — also fire on manual step
		this.callbacks.fixedUpdate(fixedDt);
		this.fixedFrame++;
		this.elapsed += fixedDt;
		this.callbacks.update(variableDt ?? fixedDt);
		this.callbacks.render();
		this.callbacks.cleanup();
	}
}
```

**File:** `packages/core/src/game.ts`

Add a `preFrame` signal that fires from the `beginFrame` callback:

```typescript
export class Game {
	// ... existing signals ...
	readonly preFrame: Signal<void> = signal<void>();

	constructor(options: GameOptions) {
		// ...
		this.loop = new GameLoop(
			{ fixedDeltaTime: this.fixedDeltaTime, maxAccumulator: 0.25 },
			{
				beginFrame: () => this.preFrame.emit(),   // NEW
				fixedUpdate: (dt) => this._fixedUpdate(dt),
				update: (dt) => this._update(dt),
				render: () => this._render(),
				cleanup: () => this._cleanup(),
			},
		);
	}
}
```

**Why `preFrame`, not just polling inside `fixedUpdate`?**

- Input must be sampled once per frame, not per physics step. If `isJustPressed('jump')` were cleared after each `fixedUpdate`, a jump press could be missed when multiple physics steps run per frame.
- `preFrame` fires exactly once per frame (or once per `step()` call), before any game logic runs. This ensures all `onFixedUpdate` and `onUpdate` calls within the same frame see the same input state.
- When no input plugin is installed, `preFrame` has no listeners — zero overhead.

### Frame Sequence After Phase 3

```
┌────────────────────────── One Frame ──────────────────────────┐
│                                                                │
│  0. preFrame signal                                            │
│     → input._beginFrame():                                     │
│         a. Clear previous justPressed/justReleased flags       │
│         b. _flushInputBuffers(): flush keyboard + mouse buffer │
│         c. _flushInjectionBuffer(): flush inject() buffer      │
│     → input._pollGamepad(): poll gamepad buttons + axes        │
│     → propagateTransitions(): fire InputEvents for transitions │
│                                                                │
│  ┌── Fixed Update (may run 0, 1, or N times) ──┐              │
│  │  1. Scene._walkFixedUpdate(dt)               │              │
│  │     → Each node's onFixedUpdate(dt)          │              │
│  │     → Actors call this.move(dt) here         │              │
│  │     → Input queries return consistent state  │              │
│  │                                              │              │
│  │  2. Game.postFixedUpdate.emit(dt)            │              │
│  │     → PhysicsWorld.stepSensors()             │              │
│  └──────────────────────────────────────────────┘              │
│                                                                │
│  3. Scene._walkUpdate(dt)         (once per frame)             │
│     → Each node's onUpdate(dt)                                 │
│     → Input queries still return same state                    │
│  4. Renderer.render(scene)        (once per frame)             │
│  5. Scene._processDestroyQueue()  (once per frame)             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. Package: `@quintus/sprites`

Size budget: **~5KB gzipped**

Dependencies: `@quintus/core`, `@quintus/math` (workspace deps)

### 2.1 SpriteSheet

**File:** `packages/sprites/src/sprite-sheet.ts`

A `SpriteSheet` is a pure data class that describes how a texture is divided into frames and which frames constitute named animations. It has no DOM dependencies and no connection to the asset loader — it's just grid math plus animation metadata.

```typescript
export interface AnimationConfig {
	/** Frame indices into the sprite sheet grid. */
	frames: number[];
	/** Playback speed in frames per second. Default: 10. */
	fps?: number;
	/** Whether the animation loops. Default: true. */
	loop?: boolean;
}

export interface SpriteSheetConfig {
	/** Texture asset name (must be loaded via game.assets). */
	texture: string;
	/** Width of each frame in pixels. */
	frameWidth: number;
	/** Height of each frame in pixels. */
	frameHeight: number;
	/** Number of columns in the grid. Required. */
	columns: number;
	/** Number of rows in the grid. Optional — defaults to ceil(maxFrame / columns). */
	rows?: number;
	/** Margin around the entire sheet in pixels. Default: 0. */
	margin?: number;
	/** Spacing between frames in pixels. Default: 0. */
	spacing?: number;
	/** Named animations. */
	animations?: Record<string, AnimationConfig>;
}

export interface Animation {
	readonly name: string;
	readonly frames: readonly number[];
	readonly fps: number;
	readonly loop: boolean;
}
```

```typescript
export class SpriteSheet {
	readonly texture: string;
	readonly frameWidth: number;
	readonly frameHeight: number;
	readonly columns: number;
	readonly rows: number;
	readonly margin: number;
	readonly spacing: number;

	private readonly _frameRects: Rect[];
	private readonly _animations: Map<string, Animation>;

	constructor(config: SpriteSheetConfig) {
		this.texture = config.texture;
		this.frameWidth = config.frameWidth;
		this.frameHeight = config.frameHeight;
		this.columns = config.columns;
		this.margin = config.margin ?? 0;
		this.spacing = config.spacing ?? 0;

		// Compute rows from animations or explicit value
		const maxFrame = this._findMaxFrame(config.animations);
		this.rows = config.rows ?? Math.ceil((maxFrame + 1) / this.columns);

		// Pre-compute all frame rectangles (zero allocation in hot path)
		this._frameRects = [];
		const totalFrames = this.columns * this.rows;
		for (let i = 0; i < totalFrames; i++) {
			const col = i % this.columns;
			const row = Math.floor(i / this.columns);
			this._frameRects.push(new Rect(
				this.margin + col * (this.frameWidth + this.spacing),
				this.margin + row * (this.frameHeight + this.spacing),
				this.frameWidth,
				this.frameHeight,
			));
		}

		// Build animation map
		this._animations = new Map();
		for (const [name, anim] of Object.entries(config.animations ?? {})) {
			this._animations.set(name, {
				name,
				frames: Object.freeze([...anim.frames]),
				fps: anim.fps ?? 10,
				loop: anim.loop ?? true,
			});
		}
	}

	/** Get the source rectangle for a frame index. Cached — zero allocation. */
	getFrameRect(index: number): Rect {
		return this._frameRects[index] ?? this._frameRects[0]!;
	}

	/** Get a named animation. Returns undefined if not found. */
	getAnimation(name: string): Animation | undefined {
		return this._animations.get(name);
	}

	/** Check if an animation exists. */
	hasAnimation(name: string): boolean {
		return this._animations.has(name);
	}

	/** Get all animation names. */
	get animationNames(): string[] {
		return [...this._animations.keys()];
	}

	/** Total number of frames in the grid. */
	get frameCount(): number {
		return this._frameRects.length;
	}

	/**
	 * Create a SpriteSheet from JSON config + image dimensions.
	 * Convenience for when columns isn't known ahead of time.
	 */
	static fromJSON(
		json: Omit<SpriteSheetConfig, "columns"> & { columns?: number },
		imageWidth?: number,
	): SpriteSheet {
		const columns = json.columns
			?? (imageWidth ? Math.floor(imageWidth / json.frameWidth) : 1);
		return new SpriteSheet({ ...json, columns });
	}

	private _findMaxFrame(animations?: Record<string, AnimationConfig>): number {
		if (!animations) return 0;
		let max = 0;
		for (const anim of Object.values(animations)) {
			for (const f of anim.frames) {
				if (f > max) max = f;
			}
		}
		return max;
	}
}
```

**Why `columns` is required in `SpriteSheetConfig`:** SpriteSheet is pure data with no access to the asset loader or loaded images. The number of columns can't be auto-detected without the image. When loading from JSON, use `SpriteSheet.fromJSON()` which accepts an optional `imageWidth` to calculate columns automatically.

**Why pre-compute frame rects:** `getFrameRect()` is called every frame by every AnimatedSprite. Pre-computing avoids per-frame `Rect` allocations.

### Sprite Sheet JSON Format

**Companion file convention:** `hero.sprites.json` alongside `hero.png`.

```json
{
  "texture": "hero",
  "frameWidth": 16,
  "frameHeight": 24,
  "columns": 8,
  "animations": {
    "idle":  { "frames": [0, 1], "fps": 4, "loop": true },
    "run":   { "frames": [2, 3, 4, 5], "fps": 12, "loop": true },
    "jump":  { "frames": [6], "loop": false },
    "fall":  { "frames": [7], "loop": false }
  }
}
```

**Loading pattern:**

```typescript
// Load assets first
await game.assets.load({ images: ["hero.png"], json: ["hero.sprites.json"] });

// Create SpriteSheet from loaded JSON
const json = game.assets.getJSON<SpriteSheetConfig>("hero");
const sheet = new SpriteSheet(json);

// Or with auto-column detection
const img = game.assets.getImage("hero");
const sheet = SpriteSheet.fromJSON(json, img.width);
```

No special loader or plugin needed — SpriteSheet is just a data class constructed from JSON that the existing `AssetLoader` already loads.

### 2.2 Sprite

**File:** `packages/sprites/src/sprite.ts`

`Sprite` extends `Node2D` and renders a single image or a single frame from a sprite sheet. It's the simplest visual node — use it for backgrounds, props, UI elements, or static images.

```typescript
export class Sprite extends Node2D {
	/** Texture asset name (loaded via game.assets). */
	texture = "";

	/** Source rectangle within the texture (for manual frame selection). */
	sourceRect: Rect | null = null;

	/** Whether the sprite is drawn centered at its origin. Default: true. */
	centered = true;

	/** Flip the sprite horizontally. */
	flipH = false;

	/** Flip the sprite vertically. */
	flipV = false;

	/** Opacity (0 = invisible, 1 = fully opaque). Default: 1. */
	alpha = 1;

	onDraw(ctx: DrawContext): void {
		if (!this.texture) return;

		// Determine display size for centering
		const w = this._displayWidth();
		const h = this._displayHeight();
		if (w === 0 || h === 0) return;

		if (this.alpha < 1) ctx.setAlpha(this.alpha);

		const dx = this.centered ? -w / 2 : 0;
		const dy = this.centered ? -h / 2 : 0;

		ctx.image(this.texture, this._drawOffset, {
			sourceRect: this.sourceRect ?? undefined,
			flipH: this.flipH,
			flipV: this.flipV,
		});
	}

	// --- Internal ---

	/** Pre-allocated draw offset vector. Updated each draw. */
	protected _drawOffset = new Vec2(0, 0);

	/** Compute display width from sourceRect or loaded texture. */
	protected _displayWidth(): number {
		if (this.sourceRect) return this.sourceRect.width;
		const img = this.game?.assets.getImage(this.texture);
		return img?.width ?? 0;
	}

	/** Compute display height from sourceRect or loaded texture. */
	protected _displayHeight(): number {
		if (this.sourceRect) return this.sourceRect.height;
		const img = this.game?.assets.getImage(this.texture);
		return img?.height ?? 0;
	}
}
```

**Draw offset:** The `_drawOffset` Vec2 is pre-allocated and reused to avoid per-frame allocation. The centered offset is applied by mutating `_drawOffset._set(dx, dy)` before passing to `ctx.image()`. (The full onDraw implementation above is slightly simplified for readability — the actual code will update `_drawOffset` via `_set()`.)

**Alpha handling:** The renderer wraps each node's `onDraw` in `ctx.save()`/`ctx.restore()`, so setting `globalAlpha` inside onDraw is safely reverted. Alpha cascade (parent alpha × child alpha) is not supported in Phase 3 — it can be added later if needed.

**Usage:**

```typescript
// Full texture
const bg = scene.add(Sprite);
bg.texture = "background";
bg.centered = false;

// Single frame from a sheet
const icon = scene.add(Sprite);
icon.texture = "items";
icon.sourceRect = new Rect(0, 0, 16, 16);
icon.position = new Vec2(100, 50);
```

### 2.3 AnimatedSprite

**File:** `packages/sprites/src/animated-sprite.ts`

`AnimatedSprite` extends `Node2D` and plays named animations from a `SpriteSheet`. It handles frame timing, looping, and signals.

```typescript
export class AnimatedSprite extends Node2D {
	/** The sprite sheet containing frame and animation data. */
	spriteSheet: SpriteSheet | null = null;

	/** Whether the sprite is drawn centered at its origin. Default: true. */
	centered = true;

	/** Flip the sprite horizontally. */
	flipH = false;

	/** Flip the sprite vertically. */
	flipV = false;

	/** Opacity (0 = invisible, 1 = fully opaque). Default: 1. */
	alpha = 1;

	/** Playback speed multiplier (1 = normal, 2 = double speed). */
	speed = 1;

	// === Signals ===

	/** Fires when a non-looping animation reaches its last frame. Payload: animation name. */
	readonly animationFinished: Signal<string> = signal<string>();

	/** Fires when the animation changes. */
	readonly animationChanged: Signal<{ from: string; to: string }> = signal();

	/** Fires each time the frame advances. Payload: frame index within animation. */
	readonly frameChanged: Signal<number> = signal<number>();

	// === Read-only State ===

	/** Currently playing animation name. Empty string if none. */
	get currentAnimation(): string {
		return this._currentAnim;
	}

	/** Current frame index within the animation's frames array. */
	get frame(): number {
		return this._frame;
	}

	/** Set the current frame manually (clamps to valid range). */
	set frame(value: number) {
		const anim = this._getAnim();
		if (!anim) return;
		this._frame = Math.max(0, Math.min(value, anim.frames.length - 1));
		this.frameChanged.emit(this._frame);
	}

	/** Whether an animation is currently playing. */
	get playing(): boolean {
		return this._playing;
	}

	// === Playback Control ===

	/**
	 * Play a named animation.
	 * @param name - Animation name (must exist in spriteSheet).
	 * @param restart - If true, restart even if already playing this animation.
	 */
	play(name: string, restart = false): void {
		if (!this.spriteSheet) return;

		if (this._currentAnim === name && this._playing && !restart) return;

		const anim = this.spriteSheet.getAnimation(name);
		if (!anim) {
			throw new Error(
				`Animation "${name}" not found. Available: ${this.spriteSheet.animationNames.join(", ")}`,
			);
		}

		const prev = this._currentAnim;
		this._currentAnim = name;
		this._frame = 0;
		this._elapsed = 0;
		this._playing = true;

		if (prev !== name) {
			this.animationChanged.emit({ from: prev, to: name });
		}
	}

	/** Stop playback. Keeps current frame. */
	stop(): void {
		this._playing = false;
	}

	/** Pause playback. Alias for stop(). */
	pause(): void {
		this._playing = false;
	}

	// === Lifecycle ===

	onUpdate(dt: number): void {
		if (!this._playing || !this.spriteSheet) return;

		const anim = this._getAnim();
		if (!anim || anim.frames.length === 0) return;

		this._elapsed += dt * this.speed;
		const frameDuration = 1 / anim.fps;

		while (this._elapsed >= frameDuration) {
			this._elapsed -= frameDuration;
			this._frame++;

			if (this._frame >= anim.frames.length) {
				if (anim.loop) {
					this._frame = 0;
				} else {
					this._frame = anim.frames.length - 1;
					this._playing = false;
					this.animationFinished.emit(this._currentAnim);
					this._elapsed = 0;
					break;
				}
			}

			this.frameChanged.emit(this._frame);
		}
	}

	onDraw(ctx: DrawContext): void {
		if (!this.spriteSheet || !this._currentAnim) return;

		const anim = this._getAnim();
		if (!anim || anim.frames.length === 0) return;

		const sheetFrame = anim.frames[this._frame];
		if (sheetFrame === undefined) return;

		const rect = this.spriteSheet.getFrameRect(sheetFrame);
		const w = this.spriteSheet.frameWidth;
		const h = this.spriteSheet.frameHeight;

		if (this.alpha < 1) ctx.setAlpha(this.alpha);

		this._drawOffset._set(
			this.centered ? -w / 2 : 0,
			this.centered ? -h / 2 : 0,
		);

		ctx.image(this.spriteSheet.texture, this._drawOffset, {
			sourceRect: rect,
			flipH: this.flipH,
			flipV: this.flipV,
		});
	}

	// === Internal ===
	private _currentAnim = "";
	private _frame = 0;
	private _playing = false;
	private _elapsed = 0;
	protected _drawOffset = new Vec2(0, 0);

	private _getAnim(): Animation | undefined {
		return this.spriteSheet?.getAnimation(this._currentAnim);
	}
}
```

**Why `onUpdate` not `onFixedUpdate` for animation?** Animation is visual-only — it doesn't affect physics or game logic. Running in `onUpdate` means animations play at display frame rate for visual smoothness, while physics remains at the fixed 60hz timestep.

**Usage:**

```typescript
class Player extends Actor {
	private sprite!: AnimatedSprite;

	onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(14, 24);

		this.sprite = this.addChild(AnimatedSprite);
		this.sprite.spriteSheet = heroSheet;
		this.sprite.play("idle");
	}

	onFixedUpdate(dt: number) {
		// ... movement code ...
		this.move(dt);

		// Update animation based on state
		if (!this.isOnFloor()) {
			this.sprite.play(this.velocity.y < 0 ? "jump" : "fall");
		} else if (Math.abs(this.velocity.x) > 10) {
			this.sprite.play("run");
		} else {
			this.sprite.play("idle");
		}

		// Flip sprite to face movement direction
		if (this.velocity.x < 0) this.sprite.flipH = true;
		if (this.velocity.x > 0) this.sprite.flipH = false;
	}
}
```

### 2.4 File Structure

```
packages/sprites/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts                   # Public exports
    ├── sprite-sheet.ts            # SpriteSheet class
    ├── sprite.ts                  # Sprite node
    ├── animated-sprite.ts         # AnimatedSprite node
    │
    ├── sprite-sheet.test.ts       # Frame rect computation, animation lookup, fromJSON
    ├── sprite.test.ts             # Rendering, centered, flip, alpha
    └── animated-sprite.test.ts    # Play/stop/pause, frame timing, signals, looping
```

Size budget: **~5KB gzipped**. Dependencies: `@quintus/core`, `@quintus/math`.

---

## 3. Package: `@quintus/input`

Size budget: **~4KB gzipped**

Dependencies: `@quintus/core`, `@quintus/math` (workspace deps)

### 3.1 Input Class

**File:** `packages/input/src/input.ts`

The `Input` class tracks action state (pressed, just-pressed, just-released) and maps physical inputs (keyboard keys, gamepad buttons) to named actions.

```typescript
export interface InputConfig {
	/** Action name → list of bindings. */
	actions: Record<string, string[]>;
	/** Gamepad stick dead zone. Default: 0.15. */
	deadZone?: number;
}
```

**Internal state model:**

Each action tracks three pieces of state per frame:

| State | Meaning | Reset timing |
|-------|---------|------|
| `pressed` | Currently held down (at least one binding active) | Cleared when all bindings released |
| `justPressed` | Transitioned from not-pressed to pressed this frame | Cleared at start of next frame |
| `justReleased` | Transitioned from pressed to not-pressed this frame | Cleared at start of next frame |
| `analogValue` | Analog intensity (0–1) for this action | Updated each poll |

```typescript
interface ActionState {
	pressed: boolean;
	justPressed: boolean;
	justReleased: boolean;
	analogValue: number;
}

export class Input {
	private _actions: Map<string, ActionState>;
	private _bindingToActions: Map<string, string[]>;
	private _activeBindings: Set<string>;
	private _deadZone: number;

	// Keyboard buffer — accumulates between frames
	private _keyPressBuffer: Set<string>;
	private _keyReleaseBuffer: Set<string>;

	// Mouse button buffer — accumulates between frames (same pattern as keyboard)
	private _mousePressBuffer: Set<string>;
	private _mouseReleaseBuffer: Set<string>;

	// Injection buffer — accumulates between frames, flushed during _beginFrame
	private _injectionBuffer: Map<string, boolean>;       // action → pressed
	private _injectionAnalogBuffer: Map<string, number>;  // action → value

	// Mouse state
	private _mousePosition = new Vec2(0, 0);

	constructor(config: InputConfig) {
		this._deadZone = config.deadZone ?? 0.15;
		this._actions = new Map();
		this._bindingToActions = new Map();
		this._activeBindings = new Set();
		this._keyPressBuffer = new Set();
		this._keyReleaseBuffer = new Set();
		this._mousePressBuffer = new Set();
		this._mouseReleaseBuffer = new Set();
		this._injectionBuffer = new Map();
		this._injectionAnalogBuffer = new Map();

		// Initialize action states
		for (const [name, bindings] of Object.entries(config.actions)) {
			this._actions.set(name, {
				pressed: false,
				justPressed: false,
				justReleased: false,
				analogValue: 0,
			});

			// Build reverse map: binding → action names
			for (const binding of bindings) {
				const existing = this._bindingToActions.get(binding) ?? [];
				existing.push(name);
				this._bindingToActions.set(binding, existing);
			}
		}
	}

	// === Query Methods ===

	/** Whether the action is currently held down. */
	isPressed(action: string): boolean {
		return this._actions.get(action)?.pressed ?? false;
	}

	/** Whether the action was pressed this frame (transition: up → down). */
	isJustPressed(action: string): boolean {
		return this._actions.get(action)?.justPressed ?? false;
	}

	/** Whether the action was released this frame (transition: down → up). */
	isJustReleased(action: string): boolean {
		return this._actions.get(action)?.justReleased ?? false;
	}

	/**
	 * Compute axis value from two opposing actions.
	 * Returns -1 to 1. Keyboard returns -1/0/1. Gamepad returns analog value.
	 */
	getAxis(negative: string, positive: string): number {
		const neg = this._actions.get(negative)?.analogValue ?? 0;
		const pos = this._actions.get(positive)?.analogValue ?? 0;
		return pos - neg;
	}

	/**
	 * Compute 2D vector from four actions (convenience for top-down movement).
	 * Returns a Vec2 with components in [-1, 1]. Not normalized.
	 */
	getVector(left: string, right: string, up: string, down: string): Vec2 {
		return new Vec2(
			this.getAxis(left, right),
			this.getAxis(up, down),
		);
	}

	/** Current mouse position in screen coordinates. */
	get mousePosition(): Vec2 {
		return this._mousePosition;
	}

	// === Injection (for testing/AI) ===

	/**
	 * Programmatically press or release an action.
	 * Buffers the injection — it takes effect during the next `_beginFrame()`,
	 * which runs at the start of `game.step()` or each frame tick. This
	 * ensures injected input survives the justPressed/justReleased clearing
	 * and is visible to all game logic within the frame.
	 *
	 * Injection uses virtual bindings (`inject:actionName`) under the hood,
	 * so injected and real input coexist correctly — releasing an injected
	 * action while a physical key is held will NOT release the action.
	 */
	inject(action: string, pressed: boolean): void {
		if (!this._actions.has(action)) return;
		this._injectionBuffer.set(action, pressed);
	}

	/**
	 * Inject an analog value for an action (for simulating gamepad sticks).
	 * Buffers the injection — takes effect during the next `_beginFrame()`.
	 * Value should be 0–1.
	 */
	injectAnalog(action: string, value: number): void {
		if (!this._actions.has(action)) return;
		this._injectionAnalogBuffer.set(action, value);
	}

	/** Get all registered action names. */
	get actionNames(): string[] {
		return [...this._actions.keys()];
	}

	// === Internal (called by InputPlugin) ===

	/**
	 * @internal Called once per frame (at the start of `game.step()` or each
	 * rAF tick) before any fixedUpdate/update. Clears previous frame's edge
	 * flags, then flushes all input buffers so game logic sees fresh state.
	 */
	_beginFrame(): void {
		// 1. Clear previous frame's edge flags
		for (const state of this._actions.values()) {
			state.justPressed = false;
			state.justReleased = false;
		}

		// 2. Flush all buffered input (keyboard, mouse, injection)
		this._flushInputBuffers();
		this._flushInjectionBuffer();
	}

	/**
	 * @internal Process buffered keyboard AND mouse events.
	 * Both use the same buffer-then-flush pattern for consistent timing.
	 */
	_flushInputBuffers(): void {
		// Process releases first (handles press+release in same frame)
		for (const code of this._keyReleaseBuffer) {
			this._activeBindings.delete(code);
			this._updateActionsForBinding(code);
		}
		for (const binding of this._mouseReleaseBuffer) {
			this._activeBindings.delete(binding);
			this._updateActionsForBinding(binding);
		}

		// Then process presses
		for (const code of this._keyPressBuffer) {
			this._activeBindings.add(code);
			this._updateActionsForBinding(code);
		}
		for (const binding of this._mousePressBuffer) {
			this._activeBindings.add(binding);
			this._updateActionsForBinding(binding);
		}

		this._keyPressBuffer.clear();
		this._keyReleaseBuffer.clear();
		this._mousePressBuffer.clear();
		this._mouseReleaseBuffer.clear();
	}

	/**
	 * @internal Process buffered injection commands.
	 * Uses virtual bindings (`inject:actionName`) so injected and real
	 * input coexist — releasing an injected action while a physical
	 * key is held will NOT release the action.
	 */
	_flushInjectionBuffer(): void {
		for (const [action, pressed] of this._injectionBuffer) {
			const binding = `inject:${action}`;
			if (pressed) {
				this._activeBindings.add(binding);
				// Ensure reverse map entry exists for virtual binding
				if (!this._bindingToActions.has(binding)) {
					this._bindingToActions.set(binding, [action]);
				}
			} else {
				this._activeBindings.delete(binding);
			}
			this._updateActionsForBinding(binding);
		}
		this._injectionBuffer.clear();

		for (const [action, value] of this._injectionAnalogBuffer) {
			const binding = `inject-analog:${action}`;
			if (!this._bindingToActions.has(binding)) {
				this._bindingToActions.set(binding, [action]);
			}
			this._updateAnalogBinding(binding, value);
		}
		this._injectionAnalogBuffer.clear();
	}

	/** @internal Buffer a key press (from DOM event). */
	_bufferKeyPress(code: string): void {
		this._keyPressBuffer.add(code);
		this._keyReleaseBuffer.delete(code);
	}

	/** @internal Buffer a key release (from DOM event). */
	_bufferKeyRelease(code: string): void {
		this._keyReleaseBuffer.add(code);
		this._keyPressBuffer.delete(code);
	}

	/** @internal Buffer a mouse button press (from DOM event). */
	_bufferMousePress(button: number): void {
		const binding = `mouse:${buttonName(button)}`;
		this._mousePressBuffer.add(binding);
		this._mouseReleaseBuffer.delete(binding);
	}

	/** @internal Buffer a mouse button release (from DOM event). */
	_bufferMouseRelease(button: number): void {
		const binding = `mouse:${buttonName(button)}`;
		this._mouseReleaseBuffer.add(binding);
		this._mousePressBuffer.delete(binding);
	}

	/** @internal Update mouse position (immediate — no buffering needed). */
	_setMousePosition(x: number, y: number): void {
		this._mousePosition._set(x, y);
	}

	/**
	 * @internal Release all active bindings. Called on window blur to
	 * prevent stuck keys when alt-tabbing.
	 */
	_releaseAll(): void {
		for (const binding of [...this._activeBindings]) {
			this._activeBindings.delete(binding);
			this._updateActionsForBinding(binding);
		}
		this._keyPressBuffer.clear();
		this._keyReleaseBuffer.clear();
		this._mousePressBuffer.clear();
		this._mouseReleaseBuffer.clear();
		this._injectionBuffer.clear();
		this._injectionAnalogBuffer.clear();
	}

	/** @internal Poll gamepad state. */
	_pollGamepad(): void {
		if (typeof navigator === "undefined" || !navigator.getGamepads) return;

		const gamepads = navigator.getGamepads();
		const gp = gamepads[0]; // Use first connected gamepad
		if (!gp) return;

		// Poll buttons
		for (let i = 0; i < gp.buttons.length; i++) {
			const button = gp.buttons[i]!;
			const binding = `gamepad:${gamepadButtonName(i)}`;
			const wasActive = this._activeBindings.has(binding);

			if (button.pressed && !wasActive) {
				this._activeBindings.add(binding);
				this._updateActionsForBinding(binding);
			} else if (!button.pressed && wasActive) {
				this._activeBindings.delete(binding);
				this._updateActionsForBinding(binding);
			}
		}

		// Poll axes (convert to directional bindings)
		this._pollAxis(gp, 0, "gamepad:left-stick-left", "gamepad:left-stick-right");
		this._pollAxis(gp, 1, "gamepad:left-stick-up", "gamepad:left-stick-down");
		this._pollAxis(gp, 2, "gamepad:right-stick-left", "gamepad:right-stick-right");
		this._pollAxis(gp, 3, "gamepad:right-stick-up", "gamepad:right-stick-down");
	}

	// === Private ===

	private _pollAxis(
		gp: Gamepad,
		axisIndex: number,
		negBinding: string,
		posBinding: string,
	): void {
		const value = gp.axes[axisIndex] ?? 0;
		const negValue = value < -this._deadZone ? -value : 0;
		const posValue = value > this._deadZone ? value : 0;

		this._updateAnalogBinding(negBinding, negValue);
		this._updateAnalogBinding(posBinding, posValue);
	}

	private _updateAnalogBinding(binding: string, value: number): void {
		const wasActive = this._activeBindings.has(binding);

		if (value > 0) {
			this._activeBindings.add(binding);
		} else {
			this._activeBindings.delete(binding);
		}

		const actions = this._bindingToActions.get(binding);
		if (!actions) return;

		for (const actionName of actions) {
			const state = this._actions.get(actionName);
			if (!state) continue;

			// Use the maximum analog value across all bindings for this action
			state.analogValue = Math.max(
				value,
				this._maxAnalogForAction(actionName, binding),
			);

			const nowPressed = state.analogValue > 0;
			if (nowPressed && !state.pressed) {
				state.pressed = true;
				state.justPressed = true;
			} else if (!nowPressed && state.pressed) {
				state.pressed = false;
				state.justReleased = true;
			}
		}
	}

	private _updateActionsForBinding(binding: string): void {
		const actions = this._bindingToActions.get(binding);
		if (!actions) return;

		const isActive = this._activeBindings.has(binding);

		for (const actionName of actions) {
			const state = this._actions.get(actionName);
			if (!state) continue;

			// Check if ANY binding for this action is active
			const anyActive = this._isAnyBindingActive(actionName);

			if (anyActive && !state.pressed) {
				state.pressed = true;
				state.justPressed = true;
				state.analogValue = 1;
			} else if (!anyActive && state.pressed) {
				state.pressed = false;
				state.justReleased = true;
				state.analogValue = 0;
			}
		}
	}

	private _isAnyBindingActive(actionName: string): boolean {
		// Check all bindings mapped to this action
		for (const [binding, actions] of this._bindingToActions) {
			if (actions.includes(actionName) && this._activeBindings.has(binding)) {
				return true;
			}
		}
		return false;
	}

	private _maxAnalogForAction(actionName: string, excludeBinding: string): number {
		let max = 0;
		for (const [binding, actions] of this._bindingToActions) {
			if (binding === excludeBinding) continue;
			if (actions.includes(actionName) && this._activeBindings.has(binding)) {
				max = 1; // Non-analog bindings contribute 1.0
			}
		}
		return max;
	}
}
```

### 3.2 InputPlugin

**File:** `packages/input/src/input-plugin.ts`

The InputPlugin installs the Input system into a Game, sets up DOM event listeners, and hooks into the game loop's `preFrame` signal for polling.

```typescript
const inputMap = new WeakMap<Game, Input>();

/** Get the Input instance for a Game. Returns null if InputPlugin not installed. */
export function getInput(game: Game): Input | null {
	return inputMap.get(game) ?? null;
}

/** Create the input plugin. */
export function InputPlugin(config: InputConfig): Plugin {
	return definePlugin({
		name: "input",
		install(game: Game) {
			const input = new Input(config);
			inputMap.set(game, input);

			// --- Game Loop Hook (works in all environments, including headless) ---

			game.preFrame.connect(() => {
				// _beginFrame clears edge flags, flushes keyboard/mouse/injection buffers
				input._beginFrame();
				// Poll gamepad after buffers are flushed (gamepad is polled, not buffered)
				input._pollGamepad();
				// Propagate InputEvents for any actions that transitioned
				propagateTransitions(game, input);
			});

			// --- DOM Listeners (browser only) ---

			if (typeof document !== "undefined") {
				const onKeyDown = (e: KeyboardEvent) => {
					if (e.repeat) return;
					input._bufferKeyPress(e.code);
				};

				const onKeyUp = (e: KeyboardEvent) => {
					input._bufferKeyRelease(e.code);
				};

				const onMouseDown = (e: MouseEvent) => {
					input._bufferMousePress(e.button);
				};

				const onMouseUp = (e: MouseEvent) => {
					input._bufferMouseRelease(e.button);
				};

				const onMouseMove = (e: MouseEvent) => {
					if (!game.canvas) return;
					// Convert to canvas-relative coordinates
					const rect = game.canvas.getBoundingClientRect();
					const scaleX = game.width / rect.width;
					const scaleY = game.height / rect.height;
					input._setMousePosition(
						(e.clientX - rect.left) * scaleX,
						(e.clientY - rect.top) * scaleY,
					);
				};

				const onBlur = () => {
					// Release all keys when window loses focus
					input._releaseAll();
				};

				document.addEventListener("keydown", onKeyDown);
				document.addEventListener("keyup", onKeyUp);
				if (game.canvas) {
					game.canvas.addEventListener("mousedown", onMouseDown);
					game.canvas.addEventListener("mousemove", onMouseMove);
				}
				document.addEventListener("mouseup", onMouseUp);
				window.addEventListener("blur", onBlur);

				// --- Cleanup on stop ---

				game.stopped.connect(() => {
					document.removeEventListener("keydown", onKeyDown);
					document.removeEventListener("keyup", onKeyUp);
					if (game.canvas) {
						game.canvas.removeEventListener("mousedown", onMouseDown);
						game.canvas.removeEventListener("mousemove", onMouseMove);
					}
					document.removeEventListener("mouseup", onMouseUp);
					window.removeEventListener("blur", onBlur);
					inputMap.delete(game);
				});
			}
		},
	});
}
```

**`propagateTransitions` — fires InputEvents for actions that changed this frame:**

```typescript
function propagateTransitions(game: Game, input: Input): void {
	const scene = game.currentScene;
	if (!scene) return;

	for (const actionName of input.actionNames) {
		const jp = input.isJustPressed(actionName);
		const jr = input.isJustReleased(actionName);
		if (!jp && !jr) continue;

		const event = new InputEvent(actionName, jp, jp ? 1 : 0);
		propagateInputEvent(scene, event);
	}
}
```

This ensures `InputEvent` propagation fires for **all** input sources — keyboard, mouse, gamepad, and injected input — since all of them go through the same buffer→flush→transition pipeline.

**Accessing input from game code:**

The InputPlugin uses the same WeakMap pattern as PhysicsPlugin. Access is via `getInput()`:

```typescript
import { getInput } from "@quintus/input";

class Player extends Actor {
	onFixedUpdate(dt: number) {
		const input = getInput(this.game!);
		if (!input) return;

		if (input.isPressed("left")) this.velocity.x = -this.speed;
		// ...
	}
}
```

**Convenience accessor via module augmentation:**

For the cleaner `this.game.input` API shown in the implementation plan, we use TypeScript module augmentation + prototype getter:

**File:** `packages/input/src/augment.ts`

```typescript
import { Game } from "@quintus/core";
import type { Input } from "./input.js";
import { getInput } from "./input-plugin.js";

// Runtime: add getter to Game.prototype
Object.defineProperty(Game.prototype, "input", {
	get(this: Game): Input {
		const input = getInput(this);
		if (!input) {
			throw new Error(
				'InputPlugin not installed. Call game.use(InputPlugin({...})) before accessing game.input.',
			);
		}
		return input;
	},
	configurable: true,
});

// TypeScript: merge Input accessor into Game's type
declare module "@quintus/core" {
	interface Game {
		/** Input system. Requires InputPlugin to be installed. */
		get input(): Input;
	}
}
```

This augmentation is exported from the package's `index.ts` (as a side-effect import), so importing `@quintus/input` automatically makes `game.input` available. If InputPlugin isn't installed, accessing `game.input` throws a clear error.

**Why module augmentation?** It provides the clean `game.input.isPressed('left')` API without modifying `@quintus/core`. This is the standard TypeScript pattern for plugin-provided properties (used by Express, Mongoose, etc.). The WeakMap is the runtime storage; the augmentation is purely for type safety.

### 3.3 Binding Format

Bindings are strings that identify physical inputs. The format uses prefixes to distinguish input sources:

**Keyboard** — uses `KeyboardEvent.code` (position-based, locale-independent):

| Binding | Key |
|---------|-----|
| `KeyA`, `KeyW`, `KeyS`, `KeyD` | Letter keys (WASD works on all layouts) |
| `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` | Arrow keys |
| `Space` | Spacebar |
| `Enter` | Enter/Return |
| `ShiftLeft`, `ShiftRight` | Shift keys |
| `ControlLeft`, `ControlRight` | Ctrl keys |
| `Escape` | Escape |
| `Digit1` ... `Digit9` | Number row |

**Gamepad buttons** — `gamepad:` prefix:

| Binding | Standard Gamepad |
|---------|-----------------|
| `gamepad:a` | buttons[0] — A / Cross |
| `gamepad:b` | buttons[1] — B / Circle |
| `gamepad:x` | buttons[2] — X / Square |
| `gamepad:y` | buttons[3] — Y / Triangle |
| `gamepad:lb` | buttons[4] — Left Bumper |
| `gamepad:rb` | buttons[5] — Right Bumper |
| `gamepad:lt` | buttons[6] — Left Trigger |
| `gamepad:rt` | buttons[7] — Right Trigger |
| `gamepad:select` | buttons[8] — Select / Back |
| `gamepad:start` | buttons[9] — Start / Menu |
| `gamepad:left-stick` | buttons[10] — Left stick click |
| `gamepad:right-stick` | buttons[11] — Right stick click |
| `gamepad:dpad-up` | buttons[12] |
| `gamepad:dpad-down` | buttons[13] |
| `gamepad:dpad-left` | buttons[14] |
| `gamepad:dpad-right` | buttons[15] |

**Gamepad axes** — directional bindings from analog sticks:

| Binding | Axis | Condition |
|---------|------|-----------|
| `gamepad:left-stick-left` | axes[0] | value < -deadZone |
| `gamepad:left-stick-right` | axes[0] | value > deadZone |
| `gamepad:left-stick-up` | axes[1] | value < -deadZone |
| `gamepad:left-stick-down` | axes[1] | value > deadZone |
| `gamepad:right-stick-left` | axes[2] | value < -deadZone |
| `gamepad:right-stick-right` | axes[2] | value > deadZone |
| `gamepad:right-stick-up` | axes[3] | value < -deadZone |
| `gamepad:right-stick-down` | axes[3] | value > deadZone |

**Mouse buttons** — `mouse:` prefix:

| Binding | Button |
|---------|--------|
| `mouse:left` | MouseEvent.button 0 |
| `mouse:right` | MouseEvent.button 2 |
| `mouse:middle` | MouseEvent.button 1 |

**Example action map:**

```typescript
game.use(InputPlugin({
	actions: {
		left:   ["ArrowLeft", "KeyA", "gamepad:dpad-left", "gamepad:left-stick-left"],
		right:  ["ArrowRight", "KeyD", "gamepad:dpad-right", "gamepad:left-stick-right"],
		up:     ["ArrowUp", "KeyW", "gamepad:dpad-up", "gamepad:left-stick-up"],
		down:   ["ArrowDown", "KeyS", "gamepad:dpad-down", "gamepad:left-stick-down"],
		jump:   ["Space", "ArrowUp", "KeyW", "gamepad:a"],
		attack: ["KeyZ", "KeyJ", "gamepad:x", "mouse:left"],
		pause:  ["Escape", "gamepad:start"],
	},
	deadZone: 0.15,
}));
```

**File:** `packages/input/src/bindings.ts` — helper functions used by the Input class:

```typescript
const GAMEPAD_BUTTONS = [
	"a", "b", "x", "y", "lb", "rb", "lt", "rt",
	"select", "start", "left-stick", "right-stick",
	"dpad-up", "dpad-down", "dpad-left", "dpad-right",
];

/** Map a standard gamepad button index to a name. Unknown indices → `buttonN`. */
export function gamepadButtonName(index: number): string {
	return GAMEPAD_BUTTONS[index] ?? `button${index}`;
}

/** Mouse button names matching DOM MouseEvent.button indices. */
const MOUSE_BUTTONS = ["left", "middle", "right"];

/** Map a MouseEvent.button index to a name. Unknown indices → `buttonN`. */
export function buttonName(button: number): string {
	return MOUSE_BUTTONS[button] ?? `button${button}`;
}
```

### 3.4 Gamepad Support

The Gamepad API is polled (not event-based). Each `preFrame`, the input system calls `navigator.getGamepads()` and reads the first connected controller.

**Analog vs. digital:** Gamepad sticks produce analog values (0–1) which are stored as `analogValue` on the action. `getAxis()` returns the analog value for smooth movement. Keyboard keys always produce 0 or 1 (digital), so `getAxis()` snaps to -1/0/1 for keyboard input.

**Dead zone:** Stick values with absolute value below `deadZone` (default 0.15) are treated as 0. This prevents stick drift from triggering actions.

**Multiple gamepads:** Phase 3 supports only the first connected gamepad (`gamepads[0]`). Multi-gamepad support (local multiplayer) can be added later by introducing a `gamepadIndex` config option or per-player input instances.

### 3.5 Mouse Support

Mouse input provides:

1. **Mouse position** — tracked in game coordinates (canvas-relative, scaled to game resolution). Available via `input.mousePosition`.

2. **Mouse buttons as actions** — `mouse:left`, `mouse:right`, `mouse:middle` can be bound to actions like any other input. `isPressed("attack")` works if attack is bound to `mouse:left`.

Mouse coordinates are converted from page coordinates to game coordinates using the canvas bounding rect and the game's logical resolution:

```
gameX = (clientX - canvasRect.left) × (game.width / canvasRect.width)
gameY = (clientY - canvasRect.top)  × (game.height / canvasRect.height)
```

**Touch:** Phase 3 does not implement touch-to-action mapping or virtual joysticks. Touch input is deferred to Phase 5 (UI package) where it can be built on top of the UI widget system. For now, mobile browsers that fire mouse events from touch will get basic pointer support.

### 3.6 Input Injection

Input injection allows programmatic control of the input system, enabling:
- **Automated testing:** Drive the game with scripted inputs
- **AI agents:** Control the player via LLM-generated actions
- **Replays:** Reproduce exact input sequences

```typescript
const input = getInput(game)!;

// Press an action (buffered — takes effect at start of next step)
input.inject("jump", true);  // Buffers a "jump pressed" injection
game.step();                  // _beginFrame flushes injection → game sees isJustPressed("jump") === true
input.inject("jump", false); // Buffers a "jump released" injection
game.step();                  // _beginFrame flushes injection → game sees isJustReleased("jump") === true

// Inject analog input
input.injectAnalog("right", 0.5); // Buffers half-right on stick
game.step();                       // _beginFrame flushes → getAxis("left","right") returns 0.5
```

**Injection is buffered, just like keyboard and mouse input.** Calling `inject()` writes to an internal buffer. The buffer is flushed inside `_beginFrame()` — after clearing the previous frame's edge flags but before game logic runs. This ensures:

1. **Correct timing:** `inject("jump", true); game.step();` works — the injection survives the `justPressed` clearing because it's flushed afterward.
2. **Correct multi-step behavior:** After the first `game.step()` flushes the buffer, subsequent `game.step()` calls see `pressed=true` (persists) but `justPressed=false` (cleared normally). This matches how holding a physical key works.

**Injection uses virtual bindings for correct coexistence with real input.** Under the hood, `inject("jump", true)` creates a virtual binding `inject:jump` in `_activeBindings`. This means:

- If a physical key (e.g., Space) is held while injection releases "jump", the action stays pressed because Space's binding is still active.
- The `_isAnyBindingActive()` check considers all bindings — physical and virtual — so the action state reflects the union.
- Game code cannot distinguish injected input from real input — this is intentional for deterministic testing.

### 3.7 Input Events & Propagation

In addition to polling (`isPressed`, `isJustPressed`), the input system supports Godot-style event propagation through the scene tree. This is critical for UI: a button should consume a click before the game world sees it.

**File:** `packages/input/src/input-event.ts`

```typescript
export class InputEvent {
	/** The action name. */
	readonly action: string;
	/** Whether the action was pressed (true) or released (false). */
	readonly pressed: boolean;
	/** Analog value (0–1). 1 for keyboard, variable for gamepad sticks. */
	readonly value: number;

	private _consumed = false;

	constructor(action: string, pressed: boolean, value: number) {
		this.action = action;
		this.pressed = pressed;
		this.value = value;
	}

	/** Mark this event as consumed. Stops propagation to parent nodes. */
	consume(): void {
		this._consumed = true;
	}

	/** Whether this event has been consumed by a handler. */
	get consumed(): boolean {
		return this._consumed;
	}
}
```

**Propagation order:** When an action transitions (pressed or released), the input system creates an `InputEvent` and propagates it through the scene tree **leaf-to-root**. Each registered node's `onInput(event)` callback is called. If `event.consume()` is called, propagation stops.

**Registration-based opt-in (no prototype patching):**

Rather than patching `Node.prototype.onInput` (which is fragile across class hierarchies and pollutes all nodes), nodes explicitly register for input events via the `InputReceiver` interface:

**File:** `packages/input/src/input-receiver.ts`

```typescript
/** Nodes that want input events implement this interface. */
export interface InputReceiver {
	onInput(event: InputEvent): void;
}

/** Type guard — checks if a node implements InputReceiver. */
export function isInputReceiver(node: unknown): node is InputReceiver {
	return (
		typeof node === "object" &&
		node !== null &&
		"onInput" in node &&
		typeof (node as InputReceiver).onInput === "function"
	);
}
```

**Propagation walk (in InputPlugin):**

```typescript
function propagateInputEvent(scene: Scene, event: InputEvent): void {
	// Collect all nodes depth-first, then walk in reverse (leaf-to-root)
	const nodes = collectDepthFirst(scene);
	for (let i = nodes.length - 1; i >= 0; i--) {
		const node = nodes[i]!;
		if (!isInputReceiver(node)) continue; // Skip nodes that don't handle input
		node.onInput(event);
		if (event.consumed) break;
	}
}
```

**When propagation fires:** The `propagateTransitions()` function (shown in Section 3.2) runs inside the `preFrame` hook, after all input buffers are flushed and gamepad is polled. It scans all actions for `justPressed`/`justReleased` transitions and fires `InputEvent` propagation for each. This means propagation fires for **all** input sources: keyboard, mouse, gamepad, and injected input — since they all go through the same buffer→flush→transition pipeline.

**Usage:**

```typescript
class UIButton extends Node2D implements InputReceiver {
	onInput(event: InputEvent) {
		if (event.action === "attack" && event.pressed) {
			// Handle button press
			this.onClicked();
			event.consume(); // Prevent game world from seeing this press
		}
	}
}
```

**Performance:** Input propagation only calls `onInput` on nodes that implement `InputReceiver` (checked via the `isInputReceiver` type guard, which is a simple property-existence check). Nodes that don't implement the interface are skipped with no overhead beyond the `in` check. Games that don't use input events pay only the cost of iterating nodes with a fast bail-out.

### 3.8 File Structure

```
packages/input/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts                   # Public exports + side-effect augmentation import
    ├── input.ts                   # Input class (state tracking, queries, buffered injection)
    ├── input-plugin.ts            # InputPlugin factory, DOM listeners, game loop hook, propagation
    ├── input-event.ts             # InputEvent class for propagation
    ├── input-receiver.ts          # InputReceiver interface + isInputReceiver type guard
    ├── augment.ts                 # Game.input module augmentation + prototype getter
    ├── bindings.ts                # Binding name helpers (gamepadButtonName, buttonName)
    │
    ├── input.test.ts              # Action state, justPressed/justReleased timing, injection buffer
    ├── input-plugin.test.ts       # Keyboard events, mouse buffering, gamepad polling, headless, cleanup
    ├── input-event.test.ts        # Event creation, consume, propagation, InputReceiver filtering
    ├── bindings.test.ts           # Binding name resolution
    └── integration.test.ts        # Full game integration, injection timing, determinism
```

Size budget: **~4KB gzipped**. Dependencies: `@quintus/core`, `@quintus/math`.

---

## 4. Cross-Cutting Concerns

### 4.1 Determinism

**Sprites:** Animation timing uses `onUpdate(dt)` with deterministic math. Given the same `dt` sequence, the same frames display at the same times. No randomness involved.

**Input:**
- Keyboard/gamepad input from real hardware is inherently non-deterministic. This is fine — deterministic replay works via `input.inject()`.
- `isJustPressed` is guaranteed to be true for exactly one frame (all physics steps within that frame see it).
- The input flushing order is deterministic: keyboard+mouse buffers → injection buffer → gamepad poll → event propagation. Consistent regardless of event timing within the frame.
- For headless/testing: no DOM events fire. Use `inject()` exclusively. `InputPlugin` guards all DOM access with `typeof document !== "undefined"` — the `preFrame` hook and injection buffer work in any environment.

**Input injection replay pattern:**

```typescript
// Record
const recording: Array<{ frame: number; action: string; pressed: boolean }> = [];

// Replay — inject BEFORE step, buffer is flushed at start of step
for (const entry of recording) {
	while (game.fixedFrame < entry.frame) game.step();
	input.inject(entry.action, entry.pressed);
}
// Final step processes the last injection
game.step();
```

### 4.2 Performance

**Sprite rendering budget:** 500 sprites at 60fps on mid-range mobile.

**Hot paths and mitigations:**

1. **`AnimatedSprite.onDraw()` (called per sprite per frame)**
   - `getFrameRect()` returns a pre-computed `Rect` — zero allocation
   - `_drawOffset` is pre-allocated and reused via `_set()`
   - Only one `ctx.image()` call per sprite

2. **`AnimatedSprite.onUpdate()` (called per sprite per frame)**
   - Simple accumulator math — no allocations
   - `while` loop for frame advancement handles large `dt × speed` without skipping frames

3. **`Input._beginFrame()` (called once per frame)**
   - Iterates all actions (typically <20) to clear flags — negligible cost
   - Keyboard buffer is typically 0–2 events per frame

4. **`Input._pollGamepad()` (called once per frame)**
   - Single `navigator.getGamepads()` call
   - 16 buttons + 4 axes = 20 comparisons — negligible

**Allocation targets:**
- `SpriteSheet.getFrameRect()`: zero allocations (pre-computed)
- `AnimatedSprite.onDraw()`: zero allocations (reuses `_drawOffset`)
- `Input.isPressed()` / `isJustPressed()` / `isJustReleased()`: zero allocations (Map lookup)
- `Input.getAxis()`: zero allocations (inline math)
- `Input.getVector()`: one `Vec2` allocation per call. **Conscious tradeoff:** returning a new Vec2 is safer than returning a shared mutable reference. Games that need zero-allocation input in tight loops should use `getAxis()` directly (zero alloc). A `getVectorInto()` variant can be added later if profiling shows this matters.

### 4.3 Error Handling

**Sprites:**
- **Missing texture:** `Sprite.onDraw()` silently returns if the texture isn't loaded yet. No error — the sprite simply doesn't render until the asset is available. This is consistent with `DrawContext.image()` behavior.
- **Invalid animation name:** `AnimatedSprite.play(name)` throws: `'Animation "typo" not found. Available: idle, run, jump, fall'`. Fail-fast with a helpful message.
- **No SpriteSheet set:** `AnimatedSprite.onDraw()` silently returns if `spriteSheet` is null. No error — useful for sprites that haven't finished setup.
- **Out-of-range frame index:** `SpriteSheet.getFrameRect(index)` clamps to the first frame if out of range. No crash.

**Input:**
- **Unknown action name:** `isPressed("typo")` returns `false`. No error — unknown actions are simply never pressed. This is intentional: game code can query actions before they're bound (e.g., checking for optional gamepad actions).
- **InputPlugin not installed:** Accessing `game.input` throws: `'InputPlugin not installed. Call game.use(InputPlugin({...})) before accessing game.input.'`
- **No gamepad connected:** `_pollGamepad()` silently returns. No error.
- **Window blur:** All keys are released when the window loses focus (via `_releaseAll()`). Prevents stuck keys when alt-tabbing.

---

## 5. Test Plan

### @quintus/sprites Tests

| Test File | What's Tested |
|-----------|---------------|
| `sprite-sheet.test.ts` | Frame rect computation for various grid sizes; margin and spacing; animation lookup by name; `hasAnimation()` / `animationNames`; `fromJSON()` factory with and without columns; max frame detection from animations |
| `sprite.test.ts` | Renders texture via `onDraw`; centered vs. non-centered positioning; `flipH` / `flipV` flags pass through to DrawContext; alpha applies correctly; missing texture doesn't throw; sourceRect for manual frame selection |
| `animated-sprite.test.ts` | `play()` starts animation; `play()` same animation doesn't restart unless `restart=true`; frame advances at correct fps; `speed` multiplier works; looping wraps to frame 0; non-looping stops at last frame + emits `animationFinished`; `stop()` / `pause()` freeze frame; `animationChanged` signal fires on animation switch; `frameChanged` signal fires each frame advance; setting `frame` manually clamps to valid range; `flipH` applied during draw; missing spriteSheet handled gracefully |

### @quintus/input Tests

| Test File | What's Tested |
|-----------|---------------|
| `input.test.ts` | `isPressed` returns true while held; `isJustPressed` true for exactly one frame; `isJustReleased` true for exactly one frame; press+release in same frame handled correctly; multiple bindings for same action — action stays pressed if any binding active; `getAxis()` returns -1/0/1 for digital, analog for gamepad; `getVector()` returns correct Vec2; unknown action returns false (no crash); `inject()` buffers and flushes correctly via `_beginFrame()`; `inject()` + `game.step()` — justPressed visible to game logic; `inject()` uses virtual bindings — coexists with physical keys; `injectAnalog()` respects deadZone; mouse buffering — `_bufferMousePress`/`_bufferMouseRelease` flushed alongside keyboard; `_releaseAll()` clears all bindings and buffers |
| `input-plugin.test.ts` | Keyboard events buffered and flushed at preFrame; `event.repeat` ignored; mouse position scaled to game coordinates; mouse buttons buffered (not immediate) and flushed at preFrame; gamepad button polling; gamepad axis polling with dead zone; blur calls `_releaseAll()`; cleanup on game.stop(); preFrame signal timing (before fixedUpdate); DOM listeners guarded — no crash in headless environment |
| `input-event.test.ts` | InputEvent creation; `consume()` marks event consumed; propagation walks leaf-to-root; consumed event stops propagation; only `InputReceiver` nodes receive events; propagation fires from `propagateTransitions()` after buffer flush; injected input triggers propagation identically to keyboard input |
| `bindings.test.ts` | `gamepadButtonName()` maps indices to names; `buttonName()` maps mouse button indices to names (0=left, 1=middle, 2=right matching DOM order); all standard gamepad buttons have names; unknown indices fall back to `buttonN` |
| `integration.test.ts` | Full game with InputPlugin: keyboard press triggers action, game.step sees isJustPressed, next step clears it; inject drives game identically to keyboard; inject + step timing — justPressed survives _beginFrame clearing; multiple physics steps per frame all see same isJustPressed; holding injected input across multiple steps — pressed persists, justPressed only on first; scene switch doesn't lose input state; InputPlugin works without DOM (headless) |

### @quintus/core Tests (Additions)

| What's Tested |
|---------------|
| `preFrame` signal fires before fixedUpdate in `tick()` |
| `preFrame` signal fires before fixedUpdate in `step()` |
| `beginFrame` callback is optional (backward compat) |

---

## 6. Demo: Animated Platformer

Update the existing platformer demo to use sprites and the input system:

```typescript
import { Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import {
	Actor, CollisionShape, PhysicsPlugin, Sensor, Shape, StaticCollider,
} from "@quintus/physics";
import { AnimatedSprite, SpriteSheet } from "@quintus/sprites";
import { InputPlugin } from "@quintus/input";

// === Setup ===

const game = new Game({
	width: 400,
	height: 300,
	canvas: "game",
	backgroundColor: "#1a1a2e",
	pixelArt: true,
});

game.use(PhysicsPlugin({
	gravity: new Vec2(0, 800),
	collisionGroups: {
		player: { collidesWith: ["world", "coins"] },
		world: { collidesWith: ["player"] },
		coins: { collidesWith: ["player"] },
	},
}));

game.use(InputPlugin({
	actions: {
		left:  ["ArrowLeft", "KeyA", "gamepad:dpad-left", "gamepad:left-stick-left"],
		right: ["ArrowRight", "KeyD", "gamepad:dpad-right", "gamepad:left-stick-right"],
		jump:  ["Space", "ArrowUp", "KeyW", "gamepad:a"],
	},
}));

// === Sprite Sheet ===

const heroSheet = new SpriteSheet({
	texture: "hero",
	frameWidth: 16,
	frameHeight: 24,
	columns: 8,
	animations: {
		idle: { frames: [0, 1], fps: 4 },
		run:  { frames: [2, 3, 4, 5], fps: 12 },
		jump: { frames: [6], loop: false },
		fall: { frames: [7], loop: false },
	},
});

// === Player ===

class Player extends Actor {
	speed = 150;
	jumpForce = -350;
	collisionGroup = "player";
	private sprite!: AnimatedSprite;

	onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(14, 24);
		this.tag("player");

		this.sprite = this.addChild(AnimatedSprite);
		this.sprite.spriteSheet = heroSheet;
		this.sprite.play("idle");
	}

	onFixedUpdate(dt: number) {
		const input = this.game!.input;

		this.velocity.x = 0;
		if (input.isPressed("left"))  this.velocity.x = -this.speed;
		if (input.isPressed("right")) this.velocity.x = this.speed;

		if (input.isJustPressed("jump") && this.isOnFloor()) {
			this.velocity.y = this.jumpForce;
		}

		this.move(dt);

		// Flip sprite to face movement direction
		if (this.velocity.x < 0) this.sprite.flipH = true;
		if (this.velocity.x > 0) this.sprite.flipH = false;

		// Choose animation based on state
		if (!this.isOnFloor()) {
			this.sprite.play(this.velocity.y < 0 ? "jump" : "fall");
		} else if (Math.abs(this.velocity.x) > 10) {
			this.sprite.play("run");
		} else {
			this.sprite.play("idle");
		}
	}
}

// === Scene ===

class DemoScene extends Scene {
	async onReady() {
		// Load assets
		await this.game.assets.load({ images: ["hero.png"] });

		// Platforms (still using colored rects — sprites for tiles come in Phase 4)
		addPlatform(this, 200, 280, 400, 20);
		addPlatform(this, 100, 220, 80, 12);
		addPlatform(this, 250, 180, 80, 12);
		addPlatform(this, 150, 120, 80, 12);

		// Player with animated sprite
		const player = this.add(Player);
		player.position = new Vec2(200, 100);
	}
}

game.start(DemoScene);
```

**What this demo validates:**
- SpriteSheet frame calculation and animation lookup
- AnimatedSprite rendering with correct sourceRect
- Animation transitions (idle → run → jump → fall)
- Sprite flipping based on movement direction
- InputPlugin keyboard bindings replacing raw DOM events
- `isPressed` / `isJustPressed` timing with physics
- Gamepad support (if controller connected)

---

## 7. Definition of Done

All of these must be true before Phase 3 is complete:

- [ ] `@quintus/sprites` builds and exports as ESM + CJS + `.d.ts`
- [ ] `@quintus/input` builds and exports as ESM + CJS + `.d.ts`
- [ ] `SpriteSheet` correctly computes frame rects from grid config
- [ ] `SpriteSheet.fromJSON()` creates sheets from loaded JSON data
- [ ] `Sprite` renders full textures and sprite sheet frames with centering/flip
- [ ] `AnimatedSprite` plays animations at correct fps with looping
- [ ] `animationFinished` signal fires when non-looping animation ends
- [ ] `play()` with same animation name doesn't restart (unless `restart=true`)
- [ ] `InputPlugin` installs and hooks into `preFrame` signal
- [ ] `game.input.isPressed(action)` works via module augmentation
- [ ] `isJustPressed` returns true for exactly one frame per press
- [ ] `isJustReleased` returns true for exactly one frame per release
- [ ] Multiple bindings per action work (any binding pressed = action pressed)
- [ ] `getAxis()` returns -1/0/1 for keyboard, analog for gamepad
- [ ] `getVector()` returns correct Vec2 for 2D movement
- [ ] Gamepad polling works with dead zone filtering
- [ ] Mouse position tracked in game coordinates
- [ ] Mouse buttons bindable as actions
- [ ] `input.inject()` is buffered and drives the game identically to real input
- [ ] `inject()` + `game.step()` — `isJustPressed` visible to game logic (survives `_beginFrame`)
- [ ] `inject()` uses virtual bindings — coexists with physical keys held simultaneously
- [ ] Mouse buttons are buffered (not immediate) and flushed at frame boundary like keyboard
- [ ] `InputEvent` propagation fires leaf-to-root with `consume()` support
- [ ] `InputEvent` propagation fires for all input sources (keyboard, mouse, gamepad, injected)
- [ ] Nodes opt in to input events via `InputReceiver` interface (no prototype patching)
- [ ] InputPlugin works in headless environment (DOM access guarded)
- [ ] Window blur releases all keys via `_releaseAll()` (no stuck keys)
- [ ] `preFrame` signal added to Game (fires before fixedUpdate)
- [ ] `beginFrame` callback added to GameLoop
- [ ] Platformer demo uses AnimatedSprite + InputPlugin (no raw DOM events)
- [ ] All tests pass, Biome lint clean, `pnpm build` succeeds
- [ ] Combined sprite + input bundle under 9KB gzipped

---

## 8. Execution Order

Build dependencies bottom-up. Each step produces testable output.

```
Week 1: Sprites + Core Changes
─────────────────────────────────────
Step 1: Core changes (0.5 day)
  - Add beginFrame callback to GameLoop
  - Add preFrame signal to Game
  - Tests: preFrame fires before fixedUpdate

Step 2: SpriteSheet (1 day)
  - SpriteSheet class with grid math and animation map
  - fromJSON factory
  - Tests: frame rects, animations, edge cases

Step 3: Sprite node (0.5 day)
  - Sprite extends Node2D
  - Renders via DrawContext.image()
  - Tests: centered, flip, alpha, missing texture

Step 4: AnimatedSprite node (1.5 days)
  - AnimatedSprite extends Node2D
  - Frame timing, play/stop/pause, looping
  - Signals: animationFinished, animationChanged, frameChanged
  - Tests: fps timing, transitions, signals, edge cases

Step 5: Sprites integration (0.5 day)
  - Wire up package exports
  - Test Sprite + AnimatedSprite in a Game context

Week 2: Input System + Demo
─────────────────────────────────────
Step 6: Input class (1.5 days)
  - Action state tracking with keyboard + mouse + injection buffers
  - Unified _beginFrame: clear flags → _flushInputBuffers → _flushInjectionBuffer
  - Query methods: isPressed, isJustPressed, isJustReleased
  - getAxis, getVector
  - Buffered inject/injectAnalog using virtual bindings
  - _releaseAll for blur handling
  - Tests: state transitions, timing, analog values, injection buffer timing

Step 7: InputPlugin + DOM integration (1 day)
  - Plugin factory, DOM-guarded listeners, preFrame hook
  - Module augmentation (game.input accessor)
  - Keyboard buffering, mouse buffering, gamepad polling
  - Blur handling via _releaseAll, cleanup on stop
  - Headless-safe: preFrame hook + injection work without DOM
  - Tests: event flow, mouse buffering, gamepad polling, headless, cleanup

Step 8: Input events + propagation (0.5 day)
  - InputEvent class
  - InputReceiver interface + isInputReceiver type guard
  - propagateTransitions in preFrame hook (after buffer flush)
  - Leaf-to-root propagation with consume, fires for all input sources
  - Tests: propagation order, consume stops walk, InputReceiver filtering

Step 9: Demo + integration (1 day)
  - Update platformer demo with AnimatedSprite + InputPlugin
  - Remove all raw DOM keyboard handling
  - Verify gamepad works
  - Full integration tests
  - Biome lint clean, pnpm build succeeds
```
