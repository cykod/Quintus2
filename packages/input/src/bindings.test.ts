import { describe, expect, it } from "vitest";
import { buttonName, gamepadButtonName } from "./bindings.js";

describe("gamepadButtonName", () => {
	it("maps standard button indices to names", () => {
		expect(gamepadButtonName(0)).toBe("a");
		expect(gamepadButtonName(1)).toBe("b");
		expect(gamepadButtonName(2)).toBe("x");
		expect(gamepadButtonName(3)).toBe("y");
		expect(gamepadButtonName(4)).toBe("lb");
		expect(gamepadButtonName(5)).toBe("rb");
		expect(gamepadButtonName(6)).toBe("lt");
		expect(gamepadButtonName(7)).toBe("rt");
		expect(gamepadButtonName(8)).toBe("select");
		expect(gamepadButtonName(9)).toBe("start");
		expect(gamepadButtonName(10)).toBe("left-stick");
		expect(gamepadButtonName(11)).toBe("right-stick");
		expect(gamepadButtonName(12)).toBe("dpad-up");
		expect(gamepadButtonName(13)).toBe("dpad-down");
		expect(gamepadButtonName(14)).toBe("dpad-left");
		expect(gamepadButtonName(15)).toBe("dpad-right");
	});

	it("falls back to buttonN for unknown indices", () => {
		expect(gamepadButtonName(16)).toBe("button16");
		expect(gamepadButtonName(20)).toBe("button20");
	});
});

describe("buttonName", () => {
	it("maps mouse button indices to names", () => {
		expect(buttonName(0)).toBe("left");
		expect(buttonName(1)).toBe("middle");
		expect(buttonName(2)).toBe("right");
	});

	it("falls back to buttonN for unknown indices", () => {
		expect(buttonName(3)).toBe("button3");
		expect(buttonName(4)).toBe("button4");
	});
});
