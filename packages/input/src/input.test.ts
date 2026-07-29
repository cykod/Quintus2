import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "./input.js";

function createInput(): Input {
	return new Input({
		actions: {
			left: ["ArrowLeft", "KeyA"],
			right: ["ArrowRight", "KeyD"],
			jump: ["Space", "ArrowUp"],
			attack: ["KeyZ", "mouse:left"],
		},
	});
}

describe("Input", () => {
	describe("isPressed / isJustPressed / isJustReleased", () => {
		it("returns false for all initially", () => {
			const input = createInput();
			expect(input.isPressed("jump")).toBe(false);
			expect(input.isJustPressed("jump")).toBe(false);
			expect(input.isJustReleased("jump")).toBe(false);
		});

		it("isPressed returns true while key is held", () => {
			const input = createInput();
			input._bufferKeyPress("Space");
			input._beginFrame();

			expect(input.isPressed("jump")).toBe(true);
		});

		it("isJustPressed is true for exactly one physics step", () => {
			const input = createInput();
			input._bufferKeyPress("Space");
			input._beginFrame();

			expect(input.isJustPressed("jump")).toBe(true);

			// After fixedUpdate consumes edge flags, justPressed is cleared
			input._consumeEdgeFlags();
			expect(input.isJustPressed("jump")).toBe(false);
			expect(input.isPressed("jump")).toBe(true); // still pressed
		});

		it("isJustPressed survives frames without fixedUpdate", () => {
			const input = createInput();
			input._bufferKeyPress("Space");
			input._beginFrame();

			expect(input.isJustPressed("jump")).toBe(true);

			// Another browser frame without fixedUpdate — justPressed persists
			input._beginFrame();
			expect(input.isJustPressed("jump")).toBe(true);
			expect(input.isPressed("jump")).toBe(true);

			// Now a fixedUpdate runs and consumes it
			input._consumeEdgeFlags();
			expect(input.isJustPressed("jump")).toBe(false);
			expect(input.isPressed("jump")).toBe(true);
		});

		it("isJustReleased is true for exactly one physics step", () => {
			const input = createInput();
			input._bufferKeyPress("Space");
			input._beginFrame();
			input._consumeEdgeFlags();

			input._bufferKeyRelease("Space");
			input._beginFrame();

			expect(input.isJustReleased("jump")).toBe(true);
			expect(input.isPressed("jump")).toBe(false);

			// After fixedUpdate consumes edge flags, justReleased is cleared
			input._consumeEdgeFlags();
			expect(input.isJustReleased("jump")).toBe(false);
		});

		it("handles press+release in same frame (release wins)", () => {
			const input = createInput();
			// Press then release in the same frame
			input._bufferKeyPress("Space");
			input._bufferKeyRelease("Space");
			input._beginFrame();

			// Release buffer wins because _flushInputBuffers processes releases first
			// then presses, but since the release buffer cleared the press buffer
			// via _bufferKeyRelease deleting from _keyPressBuffer, only release is processed
			expect(input.isPressed("jump")).toBe(false);
		});

		it("multiple bindings: action stays pressed if any binding active", () => {
			const input = createInput();
			// Press both Space and ArrowUp (both map to jump)
			input._bufferKeyPress("Space");
			input._bufferKeyPress("ArrowUp");
			input._beginFrame();

			expect(input.isPressed("jump")).toBe(true);

			// Release Space but ArrowUp still held
			input._bufferKeyRelease("Space");
			input._beginFrame();

			expect(input.isPressed("jump")).toBe(true); // ArrowUp still holds it

			// Release ArrowUp too
			input._bufferKeyRelease("ArrowUp");
			input._beginFrame();

			expect(input.isPressed("jump")).toBe(false);
			expect(input.isJustReleased("jump")).toBe(true);
		});

		it("unknown action returns false (no crash)", () => {
			const input = createInput();
			expect(input.isPressed("nonexistent")).toBe(false);
			expect(input.isJustPressed("nonexistent")).toBe(false);
			expect(input.isJustReleased("nonexistent")).toBe(false);
		});
	});

	describe("getAxis / getVector", () => {
		it("getAxis returns -1/0/1 for digital input", () => {
			const input = createInput();
			expect(input.getAxis("left", "right")).toBe(0);

			input._bufferKeyPress("ArrowLeft");
			input._beginFrame();
			expect(input.getAxis("left", "right")).toBe(-1);

			input._bufferKeyRelease("ArrowLeft");
			input._bufferKeyPress("ArrowRight");
			input._beginFrame();
			expect(input.getAxis("left", "right")).toBe(1);
		});

		it("getVector returns correct Vec2", () => {
			const input = new Input({
				actions: {
					left: ["ArrowLeft"],
					right: ["ArrowRight"],
					up: ["ArrowUp"],
					down: ["ArrowDown"],
				},
			});

			input._bufferKeyPress("ArrowRight");
			input._bufferKeyPress("ArrowDown");
			input._beginFrame();

			const v = input.getVector("left", "right", "up", "down");
			expect(v.x).toBe(1);
			expect(v.y).toBe(1);
		});
	});

	describe("inject()", () => {
		it("buffers and flushes correctly via _beginFrame", () => {
			const input = createInput();

			input.inject("jump", true);
			// Not yet flushed — should NOT be pressed
			expect(input.isPressed("jump")).toBe(false);

			input._beginFrame();
			expect(input.isPressed("jump")).toBe(true);
			expect(input.isJustPressed("jump")).toBe(true);
		});

		it("inject + step: justPressed survives _beginFrame clearing", () => {
			const input = createInput();

			input.inject("jump", true);
			input._beginFrame();

			// justPressed should be true because injection is flushed AFTER clearing
			expect(input.isJustPressed("jump")).toBe(true);
		});

		it("inject uses virtual bindings — coexists with physical keys", () => {
			const input = createInput();

			// Press via keyboard
			input._bufferKeyPress("Space");
			input._beginFrame();
			expect(input.isPressed("jump")).toBe(true);

			// Also inject the same action
			input.inject("jump", true);
			input._beginFrame();
			expect(input.isPressed("jump")).toBe(true);

			// Release injection but keyboard still held
			input.inject("jump", false);
			input._beginFrame();
			expect(input.isPressed("jump")).toBe(true); // Space still held

			// Release keyboard
			input._bufferKeyRelease("Space");
			input._beginFrame();
			expect(input.isPressed("jump")).toBe(false);
		});

		it("holding injected input: pressed persists, justPressed only on first", () => {
			const input = createInput();

			input.inject("jump", true);
			input._beginFrame();
			expect(input.isJustPressed("jump")).toBe(true);
			expect(input.isPressed("jump")).toBe(true);

			// Consume edge flags (simulating fixedUpdate) then next frame
			input._consumeEdgeFlags();
			input._beginFrame();
			expect(input.isJustPressed("jump")).toBe(false);
			expect(input.isPressed("jump")).toBe(true);
		});

		it("inject ignores unknown actions", () => {
			const input = createInput();
			input.inject("nonexistent", true);
			input._beginFrame();
			expect(input.isPressed("nonexistent")).toBe(false);
		});
	});

	describe("injectAnalog()", () => {
		it("sets analog value for action", () => {
			const input = new Input({
				actions: {
					left: ["ArrowLeft"],
					right: ["ArrowRight"],
				},
			});

			input.injectAnalog("right", 0.5);
			input._beginFrame();

			expect(input.getAxis("left", "right")).toBeCloseTo(0.5);
		});
	});

	describe("mouse buffering", () => {
		it("bufferMousePress and bufferMouseRelease work like keyboard", () => {
			const input = createInput();

			input._bufferMousePress(0); // mouse:left → attack
			input._beginFrame();

			expect(input.isPressed("attack")).toBe(true);
			expect(input.isJustPressed("attack")).toBe(true);

			input._bufferMouseRelease(0);
			input._beginFrame();

			expect(input.isPressed("attack")).toBe(false);
			expect(input.isJustReleased("attack")).toBe(true);
		});
	});

	describe("mouse position", () => {
		it("tracks mouse position", () => {
			const input = createInput();
			input._setMousePosition(100, 200);
			expect(input.mousePosition.x).toBe(100);
			expect(input.mousePosition.y).toBe(200);
		});
	});

	describe("_releaseAll", () => {
		it("clears all active bindings and buffers", () => {
			const input = createInput();

			input._bufferKeyPress("Space");
			input._beginFrame();
			expect(input.isPressed("jump")).toBe(true);

			input._releaseAll();
			// After releaseAll, action state should be updated immediately
			expect(input.isPressed("jump")).toBe(false);
		});
	});

	describe("actionNames", () => {
		it("returns all registered action names", () => {
			const input = createInput();
			expect(input.actionNames).toEqual(["left", "right", "jump", "attack"]);
		});
	});

	describe("gamepad polling", () => {
		function mockGamepad(buttons: Array<{ pressed: boolean }>, axes: number[]): void {
			const gp = {
				buttons,
				axes,
				connected: true,
				id: "Test Gamepad",
				index: 0,
				mapping: "standard",
				timestamp: performance.now(),
				hapticActuators: [],
				vibrationActuator: null,
			} as unknown as Gamepad;
			vi.stubGlobal("navigator", {
				getGamepads: () => [gp, null, null, null],
			});
		}

		it("gamepad button press triggers action", () => {
			const input = new Input({
				actions: {
					jump: ["gamepad:a"],
				},
			});

			// No gamepad initially
			input._beginFrame();
			expect(input.isPressed("jump")).toBe(false);

			// Gamepad button 0 (a) pressed
			mockGamepad([{ pressed: true }], [0, 0, 0, 0]);

			input._pollGamepad();
			expect(input.isPressed("jump")).toBe(true);
			expect(input.isJustPressed("jump")).toBe(true);
		});

		it("gamepad button release triggers justReleased", () => {
			const input = new Input({
				actions: {
					jump: ["gamepad:a"],
				},
			});

			// Press
			mockGamepad([{ pressed: true }], [0, 0, 0, 0]);
			input._pollGamepad();
			expect(input.isPressed("jump")).toBe(true);

			// Consume edge flags (simulating fixedUpdate)
			input._consumeEdgeFlags();

			// Release
			mockGamepad([{ pressed: false }], [0, 0, 0, 0]);
			input._pollGamepad();
			expect(input.isPressed("jump")).toBe(false);
			expect(input.isJustReleased("jump")).toBe(true);
		});

		it("gamepad stick generates analog axis values", () => {
			const input = new Input({
				actions: {
					left: ["gamepad:left-stick-left"],
					right: ["gamepad:left-stick-right"],
				},
				deadZone: 0.15,
			});

			// Push left stick right (axis 0 = 0.75)
			mockGamepad([], [0.75, 0, 0, 0]);
			input._pollGamepad();

			expect(input.getAxis("left", "right")).toBeCloseTo(0.75);
			expect(input.isPressed("right")).toBe(true);
			expect(input.isPressed("left")).toBe(false);
		});

		it("gamepad stick within dead zone is ignored", () => {
			const input = new Input({
				actions: {
					left: ["gamepad:left-stick-left"],
					right: ["gamepad:left-stick-right"],
				},
				deadZone: 0.15,
			});

			// Stick at 0.1 — within dead zone
			mockGamepad([], [0.1, 0, 0, 0]);
			input._pollGamepad();

			expect(input.isPressed("right")).toBe(false);
			expect(input.getAxis("left", "right")).toBe(0);
		});

		it("gamepad left stick negative axis", () => {
			const input = new Input({
				actions: {
					left: ["gamepad:left-stick-left"],
					right: ["gamepad:left-stick-right"],
				},
				deadZone: 0.15,
			});

			// Push left stick left (axis 0 = -0.8)
			mockGamepad([], [-0.8, 0, 0, 0]);
			input._pollGamepad();

			expect(input.isPressed("left")).toBe(true);
			expect(input.isPressed("right")).toBe(false);
			expect(input.getAxis("left", "right")).toBeCloseTo(-0.8);
		});

		it("gamepad vertical axis (left stick up/down)", () => {
			const input = new Input({
				actions: {
					up: ["gamepad:left-stick-up"],
					down: ["gamepad:left-stick-down"],
				},
				deadZone: 0.15,
			});

			// Push left stick down (axis 1 = 0.6)
			mockGamepad([], [0, 0.6, 0, 0]);
			input._pollGamepad();

			expect(input.isPressed("down")).toBe(true);
			expect(input.isPressed("up")).toBe(false);
		});

		it("_pollGamepad is a no-op when navigator.getGamepads unavailable", () => {
			const input = new Input({
				actions: { jump: ["gamepad:a"] },
			});

			vi.stubGlobal("navigator", {});
			// Should not throw
			input._pollGamepad();
			expect(input.isPressed("jump")).toBe(false);
		});

		it("_pollGamepad handles no connected gamepad", () => {
			const input = new Input({
				actions: { jump: ["gamepad:a"] },
			});

			vi.stubGlobal("navigator", {
				getGamepads: () => [null, null, null, null],
			});

			// Should not throw
			input._pollGamepad();
			expect(input.isPressed("jump")).toBe(false);
		});

		it("gamepad dpad button press", () => {
			const input = new Input({
				actions: {
					up: ["gamepad:dpad-up"],
				},
			});

			// dpad-up is button index 12
			const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
			buttons[12] = { pressed: true };
			mockGamepad(buttons, [0, 0, 0, 0]);
			input._pollGamepad();

			expect(input.isPressed("up")).toBe(true);
		});

		it("right stick axes", () => {
			const input = new Input({
				actions: {
					lookLeft: ["gamepad:right-stick-left"],
					lookRight: ["gamepad:right-stick-right"],
				},
				deadZone: 0.15,
			});

			// Right stick right (axis 2 = 0.9)
			mockGamepad([], [0, 0, 0.9, 0]);
			input._pollGamepad();

			expect(input.isPressed("lookRight")).toBe(true);
			expect(input.getAxis("lookLeft", "lookRight")).toBeCloseTo(0.9);
		});

		it("does not poll while disabled", () => {
			const input = new Input({ actions: { up: ["gamepad:dpad-up"] } });
			input.setEnabled(false);

			const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
			buttons[12] = { pressed: true };
			mockGamepad(buttons, [0, 0, 0, 0]);
			input._pollGamepad();

			expect(input.isPressed("up")).toBe(false);
		});
	});

	describe("enabled / setEnabled", () => {
		it("is enabled by default", () => {
			expect(createInput().enabled).toBe(true);
		});

		it("releases held actions when disabled", () => {
			const input = createInput();
			input._bufferKeyPress("Space");
			input._beginFrame();
			expect(input.isPressed("jump")).toBe(true);

			input.setEnabled(false);

			expect(input.enabled).toBe(false);
			expect(input.isPressed("jump")).toBe(false);
			expect(input.isJustReleased("jump")).toBe(true);
		});

		it("drops buffered key presses while disabled", () => {
			const input = createInput();
			input.setEnabled(false);

			input._bufferKeyPress("Space");
			input._beginFrame();
			expect(input.isPressed("jump")).toBe(false);

			// The dropped press must not resurface once re-enabled.
			input.setEnabled(true);
			input._beginFrame();
			expect(input.isPressed("jump")).toBe(false);
		});

		it("drops buffered mouse presses while disabled", () => {
			const input = createInput();
			input.setEnabled(false);

			input._bufferMousePress(0);
			input._beginFrame();
			expect(input.isPressed("attack")).toBe(false);

			input.setEnabled(true);
			input._beginFrame();
			expect(input.isPressed("attack")).toBe(false);
		});

		it("drops injected actions while disabled", () => {
			const input = createInput();
			input.setEnabled(false);

			input.inject("jump", true);
			input.injectAnalog("right", 0.8);
			input._beginFrame();
			expect(input.isPressed("jump")).toBe(false);
			expect(input.getAxis("left", "right")).toBe(0);

			input.setEnabled(true);
			input._beginFrame();
			expect(input.isPressed("jump")).toBe(false);
			expect(input.getAxis("left", "right")).toBe(0);
		});

		it("drops input buffered before disabling", () => {
			const input = createInput();
			input.inject("jump", true);
			input._bufferKeyPress("KeyD");

			input.setEnabled(false);
			input.setEnabled(true);
			input._beginFrame();

			expect(input.isPressed("jump")).toBe(false);
			expect(input.isPressed("right")).toBe(false);
		});

		it("restores normal behavior after re-enabling", () => {
			const input = createInput();
			input.setEnabled(false);
			input.setEnabled(true);

			input._bufferKeyPress("Space");
			input._beginFrame();

			expect(input.isPressed("jump")).toBe(true);
		});
	});

	// Invariant: while disabled, NO external event source may change action
	// state or the mouse position. Table-driven on purpose — an entry point
	// added later is only covered if someone edits this list, which is a
	// visible, reviewable act, unlike a missing one-off `it`.
	describe("disabled invariant — no entry point may mutate input state", () => {
		afterEach(() => {
			vi.unstubAllGlobals();
		});

		function createGatedInput(): Input {
			return new Input({
				actions: {
					left: ["ArrowLeft"],
					right: ["ArrowRight", "KeyD"],
					jump: ["Space"],
					attack: ["mouse:left"],
					pad: ["gamepad:dpad-up"],
				},
			});
		}

		function stubPressedGamepad(): void {
			const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
			buttons[12] = { pressed: true };
			const gp = {
				buttons,
				axes: [0, 0, 0, 0],
				connected: true,
				id: "Test Gamepad",
				index: 0,
				mapping: "standard",
			} as unknown as Gamepad;
			vi.stubGlobal("navigator", { getGamepads: () => [gp, null, null, null] });
		}

		function observe(input: Input): Record<string, unknown> {
			return {
				left: input.isPressed("left"),
				right: input.isPressed("right"),
				jump: input.isPressed("jump"),
				attack: input.isPressed("attack"),
				pad: input.isPressed("pad"),
				axis: input.getAxis("left", "right"),
				mouseX: input.mousePosition.x,
				mouseY: input.mousePosition.y,
			};
		}

		const entryPoints: Array<[string, (input: Input) => void]> = [
			["_bufferKeyPress", (i) => i._bufferKeyPress("Space")],
			["_bufferKeyRelease", (i) => i._bufferKeyRelease("Space")],
			["_bufferMousePress", (i) => i._bufferMousePress(0)],
			["_bufferMouseRelease", (i) => i._bufferMouseRelease(0)],
			["setMousePosition", (i) => i.setMousePosition(123, 456)],
			["inject", (i) => i.inject("jump", true)],
			["injectAnalog", (i) => i.injectAnalog("right", 0.8)],
			["_pollGamepad", (i) => i._pollGamepad()],
		];

		for (const [name, mutate] of entryPoints) {
			it(`${name}() changes nothing while disabled`, () => {
				stubPressedGamepad();
				const input = createGatedInput();
				input.setEnabled(false);
				const before = observe(input);

				mutate(input);
				input._beginFrame();

				expect(observe(input)).toEqual(before);
			});
		}

		// Positive control for the newly gated path, so the loop above cannot
		// pass merely because nothing ever moves the mouse position.
		it("setMousePosition() works while enabled", () => {
			const input = createGatedInput();
			input.setMousePosition(123, 456);
			expect(input.mousePosition.x).toBe(123);
			expect(input.mousePosition.y).toBe(456);
		});

		it("_setMousePosition() stays ungated as the debug/test override path", () => {
			const input = createGatedInput();
			input.setEnabled(false);
			input._setMousePosition(123, 456);
			expect(input.mousePosition.x).toBe(123);
			expect(input.mousePosition.y).toBe(456);
		});
	});

	describe("_shouldPreventDefault", () => {
		it('defaults to "always" — true regardless of focus', () => {
			const input = createInput();
			expect(input._shouldPreventDefault()).toBe(true);

			const outside = document.createElement("input");
			document.body.appendChild(outside);
			outside.focus();
			expect(input._shouldPreventDefault()).toBe(true);
			outside.remove();
		});

		it('"always" with an element keyTarget still prevents default when unfocused', () => {
			const canvas = document.createElement("canvas");
			document.body.appendChild(canvas);
			const input = new Input({
				actions: { jump: ["Space"] },
				keyTarget: canvas,
				preventDefaultPolicy: "always",
			});

			expect(input._shouldPreventDefault()).toBe(true);
			canvas.remove();
		});

		it('"focused" is false when the active element is outside keyTarget', () => {
			const canvas = document.createElement("canvas");
			const outside = document.createElement("input");
			document.body.append(canvas, outside);
			const input = new Input({
				actions: { jump: ["Space"] },
				keyTarget: canvas,
				preventDefaultPolicy: "focused",
			});

			outside.focus();
			expect(input._shouldPreventDefault()).toBe(false);

			canvas.remove();
			outside.remove();
		});

		it('"focused" is true when keyTarget itself is focused', () => {
			const canvas = document.createElement("canvas");
			canvas.tabIndex = -1;
			document.body.appendChild(canvas);
			const input = new Input({
				actions: { jump: ["Space"] },
				keyTarget: canvas,
				preventDefaultPolicy: "focused",
			});

			canvas.focus();
			expect(document.activeElement).toBe(canvas);
			expect(input._shouldPreventDefault()).toBe(true);

			canvas.remove();
		});

		it('"focused" is true when a descendant of keyTarget is focused', () => {
			const wrapper = document.createElement("div");
			const inner = document.createElement("input");
			wrapper.appendChild(inner);
			document.body.appendChild(wrapper);
			const input = new Input({
				actions: { jump: ["Space"] },
				keyTarget: wrapper,
				preventDefaultPolicy: "focused",
			});

			inner.focus();
			expect(input._shouldPreventDefault()).toBe(true);

			wrapper.remove();
		});

		it('"focused" is a no-op without a keyTarget — document always contains the active element', () => {
			// Documented footgun, not a feature: the policy collapses to "always"
			// with the default `document` target. InputPlugin warns about it at
			// install time (see input-plugin.test.ts).
			const input = new Input({
				actions: { jump: ["Space"] },
				preventDefaultPolicy: "focused",
			});

			const el = document.createElement("input");
			document.body.appendChild(el);
			el.focus();
			expect(input._shouldPreventDefault()).toBe(true);
			el.remove();
		});

		it('"focused" sees focus inside an open shadow root', () => {
			const host = document.createElement("div");
			document.body.appendChild(host);
			const root = host.attachShadow({ mode: "open" });
			const inner = document.createElement("button");
			root.appendChild(inner);

			// keyTarget is the shadow host: document.activeElement reports the host.
			const hostTargeted = new Input({
				actions: { jump: ["Space"] },
				keyTarget: host,
				preventDefaultPolicy: "focused",
			});
			// keyTarget is inside the shadow root: only the focus-chain walk finds it.
			const innerTargeted = new Input({
				actions: { jump: ["Space"] },
				keyTarget: inner,
				preventDefaultPolicy: "focused",
			});

			inner.focus();
			expect(hostTargeted._shouldPreventDefault()).toBe(true);
			expect(innerTargeted._shouldPreventDefault()).toBe(true);

			inner.blur();
			host.remove();
		});
	});
});
