import type { Game } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { buttonName, gamepadButtonName } from "./bindings.js";

/**
 * Configuration for {@link InputPlugin}.
 *
 * **The defaults are built for a full-screen game and capture keys globally.** With no
 * `keyTarget`, the plugin binds `keydown`/`keyup` to `document` and calls
 * `preventDefault()` on every bound key code for the entire lifetime of the game object —
 * whether or not the canvas is focused, visible, or even started. Bind `Space` or the
 * arrows and a host page can no longer be scrolled with them, as a side effect of merely
 * constructing the game.
 *
 * Embedded games should therefore set both {@link InputConfig.keyTarget} and
 * {@link InputConfig.preventDefaultPolicy}, and use {@link Input.setEnabled} for
 * attract/idle states. (A future major may flip these defaults to embedded-safe; today
 * they are opt-in so shipped full-screen games keep working.)
 *
 * Regardless of configuration, a `keydown` whose target is an `<input>`, `<textarea>`,
 * `<select>` or `contenteditable` element is ignored entirely — those keystrokes belong
 * to the field, not the game. `keyup` is deliberately *not* filtered that way, so a key
 * held before focus moved into a field still releases and never sticks.
 *
 * @example Embedded in a page
 * ```ts
 * game.use(InputPlugin({
 *   actions: { jump: ["Space"], left: ["ArrowLeft"], right: ["ArrowRight"] },
 *   keyTarget: game.canvas,
 *   preventDefaultPolicy: "focused",
 * }));
 * // The canvas must actually receive focus, or the game gets no keys at all:
 * game.canvas.addEventListener("pointerdown", () => game.canvas.focus());
 * ```
 *
 * @see [Embedding quintus2](https://github.com/cykod/quintus2/blob/main/docs/embedding.md)
 */
export interface InputConfig {
	/**
	 * Action name → list of binding codes. Keyboard bindings are `KeyboardEvent.code`
	 * values (`"Space"`, `"ArrowLeft"`, `"KeyW"`); mouse and gamepad use the
	 * `"mouse:left"` / `"gamepad:a"` prefixes.
	 *
	 * This map is also the `preventDefault` allow-list: only codes bound here are ever
	 * prevented, so an unbound key always reaches the page.
	 */
	actions: Record<string, string[]>;
	/** Gamepad stick dead zone. Default: 0.15. */
	deadZone?: number;

	/**
	 * Element that receives keyboard listeners. Default: `document` — i.e. the
	 * game captures keys **globally, for its entire lifetime**.
	 *
	 * Pass the game canvas (or a focusable wrapper) to scope key capture to the
	 * game surface when embedding in a page. Keyboard events only reach a
	 * non-`document` element while it is focused, so the plugin sets
	 * `tabIndex = -1` on it if it has none — otherwise the game would silently
	 * receive no keyboard input. The plugin warns once per install if the
	 * element is not attached to the document, since a detached target can
	 * never receive a key event.
	 *
	 * **Setting this alone leaves a game that appears broken.** A `tabIndex` makes
	 * the element *focusable*, not *focused* — until the user clicks it (or you call
	 * `.focus()`), keyboard events go to `document.body` and the game responds to
	 * nothing. Give it focus explicitly:
	 *
	 * ```ts
	 * game.canvas.addEventListener("pointerdown", () => game.canvas.focus());
	 * ```
	 *
	 * Focus it on start as well if play begins without a click, and consider a visible
	 * focus style so players can tell when the game is listening.
	 */
	keyTarget?: HTMLElement | Document;

	/**
	 * When `preventDefault` runs on a bound key. Default: `"always"`.
	 * `"focused"` only prevents default while {@link InputConfig.keyTarget}
	 * (or a node inside it) is the active element — so an idle or unfocused
	 * embedded game never blocks host-page scrolling.
	 *
	 * Has **no effect** with the default `document` `keyTarget`: `document`
	 * always contains the active element, so the policy collapses to
	 * `"always"`. Pair it with a `keyTarget` (the plugin warns if you don't).
	 */
	preventDefaultPolicy?: "always" | "focused";
}

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

	// Mouse button buffer — accumulates between frames
	private _mousePressBuffer: Set<string>;
	private _mouseReleaseBuffer: Set<string>;

	// Injection buffer — accumulates between frames, flushed during _beginFrame
	private _injectionBuffer: Map<string, boolean>;
	private _injectionAnalogBuffer: Map<string, number>;

	// Tracks actions that had new transitions this browser frame (for InputEvent propagation)
	private _newlyTransitioned: Set<string>;

	// Mouse state
	private _mousePosition = new Vec2(0, 0);

	// Capture scope (see InputConfig)
	private _preventDefaultPolicy: "always" | "focused";
	private _enabled = true;

	/** @internal Game reference for debug logging. Set by InputPlugin. */
	_game: Game | null = null;

	/**
	 * @internal Element the InputPlugin binds keyboard listeners to.
	 * `null` only outside a DOM environment (headless).
	 */
	readonly _keyTarget: HTMLElement | Document | null;

	constructor(config: InputConfig) {
		this._deadZone = config.deadZone ?? 0.15;
		this._preventDefaultPolicy = config.preventDefaultPolicy ?? "always";
		this._keyTarget = config.keyTarget ?? (typeof document !== "undefined" ? document : null);
		this._actions = new Map();
		this._bindingToActions = new Map();
		this._activeBindings = new Set();
		this._keyPressBuffer = new Set();
		this._keyReleaseBuffer = new Set();
		this._mousePressBuffer = new Set();
		this._mouseReleaseBuffer = new Set();
		this._injectionBuffer = new Map();
		this._injectionAnalogBuffer = new Map();
		this._newlyTransitioned = new Set();

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
		return new Vec2(this.getAxis(left, right), this.getAxis(up, down));
	}

	/** Current mouse position in screen coordinates. */
	get mousePosition(): Vec2 {
		return this._mousePosition;
	}

	// === Injection (for testing/AI) ===

	/**
	 * Programmatically press or release an action — the deterministic input path used by
	 * tests, AI drivers and `qdbg`. Unknown action names are ignored.
	 *
	 * **Timing: buffered, applied at the start of the next frame, before any
	 * `onFixedUpdate`.** In headless tests that frame is the next `game.step()`, and one
	 * `step()` does *both*: it drains the buffer and runs the `onFixedUpdate` that reads
	 * the action. So **inject, then step once** to observe the effect — there is no extra
	 * frame of latency to compensate for.
	 *
	 * The injected value is a level, not a pulse: it stays held until you inject `false`.
	 * `isJustPressed` is true for exactly one fixed step after the press lands, so a
	 * one-frame tap is `inject(a, true); step(); inject(a, false); step();`.
	 *
	 * Injections are dropped, not queued, while {@link Input.enabled} is `false`.
	 *
	 * @example Headless
	 * ```ts
	 * const game = new HeadlessGame({ width: 320, height: 240, seed: 1 });
	 * game.use(InputPlugin({ actions: { jump: ["Space"] } }));
	 * game.start(Level);
	 *
	 * game.input.inject("jump", true);
	 * game.step();                     // player.onFixedUpdate() sees isJustPressed("jump")
	 * game.input.inject("jump", false);
	 * game.step();
	 * ```
	 *
	 * @see {@link Game.step}
	 * @see [Embedding quintus2](https://github.com/cykod/quintus2/blob/main/docs/embedding.md)
	 */
	inject(action: string, pressed: boolean): void {
		if (!this._actions.has(action)) return;
		this._injectionBuffer.set(action, pressed);
	}

	/**
	 * Inject an analog value in `[0, 1]` for an action, simulating a gamepad stick or
	 * trigger. Feeds {@link Input.getAxis}/{@link Input.getVector}; any value `> 0` also
	 * makes the action read as pressed. Unknown action names are ignored.
	 *
	 * Same timing as {@link Input.inject}: buffered, applied at the start of the next
	 * frame (`game.step()` in headless) before any `onFixedUpdate`, so inject then step
	 * once. Also dropped while {@link Input.enabled} is `false`.
	 */
	injectAnalog(action: string, value: number): void {
		if (!this._actions.has(action)) return;
		this._injectionAnalogBuffer.set(action, value);
	}

	/** Get all registered action names. */
	get actionNames(): string[] {
		return [...this._actions.keys()];
	}

	/** @internal Check if a key code is mapped to any action (for preventDefault). */
	_isBoundKey(code: string): boolean {
		return this._bindingToActions.has(code);
	}

	// === Enable / capture scope ===

	/**
	 * Whether input is applied. Default: `true`.
	 *
	 * **Invariant:** while `false`, no external event source may change action
	 * state or the mouse position. Concretely: keyboard is not captured (no
	 * `preventDefault`), pointer presses are not buffered, gamepads are not
	 * polled, {@link Input.setMousePosition} is ignored, and pending or injected
	 * input is dropped. (The `@internal` `_setMousePosition` is the one
	 * deliberate exception — it is the debug/test override path.)
	 *
	 * @see {@link Input.setEnabled}
	 */
	get enabled(): boolean {
		return this._enabled;
	}

	/**
	 * Enable or disable all input at runtime — e.g. an embedded game in an
	 * attract/idle state that exists but should not capture anything.
	 *
	 * Disabling releases every held action immediately and clears the pending
	 * input and injection buffers, so nothing buffered before the switch is
	 * applied after it. Re-enabling starts from a clean slate: a key physically
	 * held across the switch is not re-applied until it is pressed again.
	 *
	 * This does not remove the DOM listeners (only {@link Game.stop} does) and does not
	 * pause the game — the loop keeps running and `onFixedUpdate` keeps being called;
	 * actions simply never become pressed. With the default `preventDefaultPolicy`
	 * `"always"`, disabling is also what stops the game from swallowing the host page's
	 * key defaults while idle.
	 *
	 * @example Only capture input while actually playing
	 * ```ts
	 * const input = getInput(game)!;
	 * input.setEnabled(false);                       // attract screen: hands off the page
	 * startButton.addEventListener("click", () => input.setEnabled(true));
	 * ```
	 *
	 * @see [Embedding quintus2](https://github.com/cykod/quintus2/blob/main/docs/embedding.md)
	 */
	setEnabled(enabled: boolean): void {
		if (this._enabled === enabled) return;
		this._enabled = enabled;
		if (!enabled) this._releaseAll();
	}

	/**
	 * @internal Whether `preventDefault` should run for a bound key right now,
	 * per the configured `preventDefaultPolicy`.
	 */
	_shouldPreventDefault(): boolean {
		if (this._preventDefaultPolicy !== "focused") return true;
		if (typeof document === "undefined") return false;
		const target = this._keyTarget;
		if (!target) return false;

		// `document.activeElement` reports the shadow *host* when focus is inside
		// an open shadow root, so walk the focus chain: the target counts as
		// focused if it contains the host OR anything deeper in that chain.
		let active: Element | null = document.activeElement;
		while (active) {
			if (target.contains(active)) return true;
			active = active.shadowRoot?.activeElement ?? null;
		}
		return false;
	}

	// === Internal (called by InputPlugin) ===

	/**
	 * @internal Called once per browser frame before any fixedUpdate/update.
	 * Flushes all input buffers. Edge flags are NOT cleared here — they persist
	 * until consumed by _consumeEdgeFlags() after a fixedUpdate runs.
	 * This prevents lost presses on high-refresh-rate displays where a browser
	 * frame may run without a corresponding fixedUpdate.
	 */
	_beginFrame(): void {
		this._newlyTransitioned.clear();
		if (!this._enabled) {
			// Drop anything buffered while disabled instead of applying it later.
			this._clearBuffers();
			return;
		}
		this._flushInputBuffers();
		this._flushInjectionBuffer();
	}

	/**
	 * @internal Called after each fixedUpdate to consume edge flags.
	 * This ensures isJustPressed/isJustReleased are true for exactly one
	 * physics step, and that presses are never lost between frames.
	 */
	_consumeEdgeFlags(): void {
		for (const state of this._actions.values()) {
			state.justPressed = false;
			state.justReleased = false;
		}
	}

	/**
	 * @internal Actions that had new transitions this browser frame.
	 * Used by InputPlugin for propagating InputEvents (separate from polling).
	 */
	get newlyTransitioned(): ReadonlySet<string> {
		return this._newlyTransitioned;
	}

	/**
	 * @internal Process buffered keyboard AND mouse events.
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
	 */
	_flushInjectionBuffer(): void {
		for (const [action, pressed] of this._injectionBuffer) {
			const binding = `inject:${action}`;
			if (pressed) {
				this._activeBindings.add(binding);
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

	/**
	 * Set the mouse position in game coordinates. Used by virtual controls
	 * (`@quintus/touch`), which do not go through {@link InputPlugin}'s pointer
	 * handlers. Ignored while {@link Input.enabled} is `false`.
	 */
	setMousePosition(x: number, y: number): void {
		if (!this._enabled) return;
		this._mousePosition._set(x, y);
	}

	/**
	 * @internal Ungated mouse-position write. Used by InputPlugin's pointer
	 * handlers (which apply their own `enabled` guard) and by the debug bridge,
	 * where `qdbg mouse` must work regardless of the game's input state.
	 */
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
		this._clearBuffers();
	}

	/** @internal Poll gamepad state. */
	_pollGamepad(): void {
		if (!this._enabled) return;
		if (typeof navigator === "undefined" || !navigator.getGamepads) return;

		const gamepads = navigator.getGamepads();
		const gp = gamepads[0];
		if (!gp) return;

		// Poll buttons
		for (let i = 0; i < gp.buttons.length; i++) {
			const btn = gp.buttons[i];
			if (!btn) continue;
			const binding = `gamepad:${gamepadButtonName(i)}`;
			const wasActive = this._activeBindings.has(binding);

			if (btn.pressed && !wasActive) {
				this._activeBindings.add(binding);
				this._updateActionsForBinding(binding);
			} else if (!btn.pressed && wasActive) {
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

	/** Drop every pending key, mouse, and injection buffer entry. */
	private _clearBuffers(): void {
		this._keyPressBuffer.clear();
		this._keyReleaseBuffer.clear();
		this._mousePressBuffer.clear();
		this._mouseReleaseBuffer.clear();
		this._injectionBuffer.clear();
		this._injectionAnalogBuffer.clear();
	}

	private _pollAxis(gp: Gamepad, axisIndex: number, negBinding: string, posBinding: string): void {
		const value = gp.axes[axisIndex] ?? 0;
		const negValue = value < -this._deadZone ? -value : 0;
		const posValue = value > this._deadZone ? value : 0;

		this._updateAnalogBinding(negBinding, negValue);
		this._updateAnalogBinding(posBinding, posValue);
	}

	private _updateAnalogBinding(binding: string, value: number): void {
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
			state.analogValue = Math.max(value, this._maxAnalogForAction(actionName, binding));

			const nowPressed = state.analogValue > 0;
			if (nowPressed && !state.pressed) {
				state.pressed = true;
				state.justPressed = true;
				this._newlyTransitioned.add(actionName);
			} else if (!nowPressed && state.pressed) {
				state.pressed = false;
				state.justReleased = true;
				this._newlyTransitioned.add(actionName);
			}
		}
	}

	private _updateActionsForBinding(binding: string): void {
		const actions = this._bindingToActions.get(binding);
		if (!actions) return;

		for (const actionName of actions) {
			const state = this._actions.get(actionName);
			if (!state) continue;

			const anyActive = this._isAnyBindingActive(actionName);

			if (anyActive && !state.pressed) {
				state.pressed = true;
				state.justPressed = true;
				state.analogValue = 1;
				this._newlyTransitioned.add(actionName);
				if (this._game?.debug) {
					const isInjected = binding.startsWith("inject:");
					const msg = isInjected ? `${actionName} injected` : `${actionName} pressed`;
					this._game.debugLog.write(
						{ category: "input", message: msg },
						this._game.fixedFrame,
						this._game.elapsed,
					);
				}
			} else if (!anyActive && state.pressed) {
				state.pressed = false;
				state.justReleased = true;
				state.analogValue = 0;
				this._newlyTransitioned.add(actionName);
				if (this._game?.debug) {
					const isInjected = binding.startsWith("inject:");
					const msg = isInjected ? `${actionName} injection released` : `${actionName} released`;
					this._game.debugLog.write(
						{ category: "input", message: msg },
						this._game.fixedFrame,
						this._game.elapsed,
					);
				}
			}
		}
	}

	private _isAnyBindingActive(actionName: string): boolean {
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
