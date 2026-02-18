import { describe, expect, it } from "vitest";
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

		it("isJustPressed is true for exactly one frame", () => {
			const input = createInput();
			input._bufferKeyPress("Space");
			input._beginFrame();

			expect(input.isJustPressed("jump")).toBe(true);

			// Next frame: justPressed should be cleared
			input._beginFrame();
			expect(input.isJustPressed("jump")).toBe(false);
			expect(input.isPressed("jump")).toBe(true); // still pressed
		});

		it("isJustReleased is true for exactly one frame", () => {
			const input = createInput();
			input._bufferKeyPress("Space");
			input._beginFrame();

			input._bufferKeyRelease("Space");
			input._beginFrame();

			expect(input.isJustReleased("jump")).toBe(true);
			expect(input.isPressed("jump")).toBe(false);

			// Next frame: justReleased should be cleared
			input._beginFrame();
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

			// Next frame: no new injection, just beginFrame
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

			// Clear edge flags for next frame
			input._beginFrame();

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
	});
});
