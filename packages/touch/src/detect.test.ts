import { describe, expect, it, vi } from "vitest";
import { isTouchDevice, onInputMethodChange } from "./detect.js";

// jsdom doesn't have PointerEvent — polyfill as MouseEvent subclass
if (typeof globalThis.PointerEvent === "undefined") {
	(globalThis as Record<string, unknown>).PointerEvent = class PointerEvent extends MouseEvent {
		readonly pointerType: string;
		constructor(type: string, init?: PointerEventInit) {
			super(type, init);
			this.pointerType = init?.pointerType ?? "";
		}
	};
}

describe("isTouchDevice", () => {
	it("returns a boolean", () => {
		expect(typeof isTouchDevice()).toBe("boolean");
	});

	it("returns false when maxTouchPoints is 0", () => {
		Object.defineProperty(navigator, "maxTouchPoints", {
			value: 0,
			configurable: true,
		});
		expect(isTouchDevice()).toBe(false);
	});

	it("returns true when maxTouchPoints > 0", () => {
		Object.defineProperty(navigator, "maxTouchPoints", {
			value: 5,
			configurable: true,
		});
		expect(isTouchDevice()).toBe(true);
	});
});

describe("onInputMethodChange", () => {
	it("fires callback on pointerdown with touch type", () => {
		const callback = vi.fn();
		const cleanup = onInputMethodChange(callback);

		document.dispatchEvent(
			new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }),
		);

		expect(callback).toHaveBeenCalledWith("touch");
		cleanup();
	});

	it("fires callback on pointermove with mouse type", () => {
		const callback = vi.fn();
		const cleanup = onInputMethodChange(callback);

		document.dispatchEvent(
			new PointerEvent("pointermove", { pointerType: "mouse", bubbles: true }),
		);

		expect(callback).toHaveBeenCalledWith("mouse");
		cleanup();
	});

	it("does not fire when method stays the same", () => {
		const callback = vi.fn();
		const cleanup = onInputMethodChange(callback);

		document.dispatchEvent(
			new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }),
		);
		document.dispatchEvent(
			new PointerEvent("pointermove", { pointerType: "touch", bubbles: true }),
		);

		expect(callback).toHaveBeenCalledTimes(1);
		cleanup();
	});

	it("fires when switching from touch to mouse", () => {
		const callback = vi.fn();
		const cleanup = onInputMethodChange(callback);

		document.dispatchEvent(
			new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }),
		);
		document.dispatchEvent(
			new PointerEvent("pointermove", { pointerType: "mouse", bubbles: true }),
		);

		expect(callback).toHaveBeenCalledTimes(2);
		expect(callback).toHaveBeenNthCalledWith(1, "touch");
		expect(callback).toHaveBeenNthCalledWith(2, "mouse");
		cleanup();
	});

	it("cleanup removes listeners", () => {
		const callback = vi.fn();
		const cleanup = onInputMethodChange(callback);
		cleanup();

		document.dispatchEvent(
			new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }),
		);

		expect(callback).not.toHaveBeenCalled();
	});
});
