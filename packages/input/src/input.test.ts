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
});
