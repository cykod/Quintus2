import type { Game } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { buttonName, gamepadButtonName } from "./bindings.js";

export interface InputConfig {
	/** Action name → list of bindings. */
	actions: Record<string, string[]>;
	/** Gamepad stick dead zone. Default: 0.15. */
	deadZone?: number;
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

	// Mouse state
	private _mousePosition = new Vec2(0, 0);

	/** @internal Game reference for debug logging. Set by InputPlugin. */
	_game: Game | null = null;

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
		return new Vec2(this.getAxis(left, right), this.getAxis(up, down));
	}

	/** Current mouse position in screen coordinates. */
	get mousePosition(): Vec2 {
		return this._mousePosition;
	}

	// === Injection (for testing/AI) ===

	/**
	 * Programmatically press or release an action.
	 * Buffers the injection — it takes effect during the next `_beginFrame()`.
	 */
	inject(action: string, pressed: boolean): void {
		if (!this._actions.has(action)) return;
		this._injectionBuffer.set(action, pressed);
	}

	/**
	 * Inject an analog value for an action (for simulating gamepad sticks).
	 * Buffers the injection — takes effect during the next `_beginFrame()`.
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
	 * @internal Called once per frame before any fixedUpdate/update.
	 * Clears previous frame's edge flags, then flushes all input buffers.
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
			} else if (!nowPressed && state.pressed) {
				state.pressed = false;
				state.justReleased = true;
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
