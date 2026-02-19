import { describe, expect, it, vi } from "vitest";
import { ConstantsRegistry } from "./constants.js";

describe("ConstantsRegistry", () => {
	it("define() registers and returns default value", () => {
		const reg = new ConstantsRegistry();
		const val = reg.define("player.speed", 150);
		expect(val).toBe(150);
	});

	it("define() on existing key returns existing value (no overwrite)", () => {
		const reg = new ConstantsRegistry();
		reg.define("player.speed", 150);
		const val = reg.define("player.speed", 999);
		expect(val).toBe(150);
	});

	it("get() returns current value", () => {
		const reg = new ConstantsRegistry();
		reg.define("player.speed", 150);
		expect(reg.get<number>("player.speed")).toBe(150);
	});

	it("get() on unknown key throws", () => {
		const reg = new ConstantsRegistry();
		expect(() => reg.get("nope")).toThrow('Unknown constant: "nope"');
	});

	it("set() updates value and emits changed", () => {
		const reg = new ConstantsRegistry();
		reg.define("player.speed", 150);
		const fn = vi.fn();
		reg.changed.connect(fn);

		reg.set("player.speed", 200);
		expect(reg.get<number>("player.speed")).toBe(200);
		expect(fn).toHaveBeenCalledWith({
			name: "player.speed",
			value: 200,
			previous: 150,
		});
	});

	it("load() applies JSON overrides for registered keys", () => {
		const reg = new ConstantsRegistry();
		reg.define("player.speed", 150);
		reg.define("player.jump", -350);

		reg.load({ "player.speed": 180, "player.jump": -400 });
		expect(reg.get<number>("player.speed")).toBe(180);
		expect(reg.get<number>("player.jump")).toBe(-400);
	});

	it("load() ignores unknown keys", () => {
		const reg = new ConstantsRegistry();
		reg.define("player.speed", 150);
		const fn = vi.fn();
		reg.changed.connect(fn);

		reg.load({ "player.speed": 180, "unknown.key": 999 });
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("export() returns all key/value pairs", () => {
		const reg = new ConstantsRegistry();
		reg.define("a", 1);
		reg.define("b", "hello");
		expect(reg.export()).toEqual({ a: 1, b: "hello" });
	});

	it("definitions enumerates all registered constants with metadata", () => {
		const reg = new ConstantsRegistry();
		reg.define("player.speed", 150, {
			description: "Movement speed",
			category: "player",
			min: 50,
			max: 500,
		});

		const def = reg.definitions.get("player.speed");
		expect(def).toBeDefined();
		expect(def?.name).toBe("player.speed");
		expect(def?.value).toBe(150);
		expect(def?.description).toBe("Movement speed");
		expect(def?.category).toBe("player");
		expect(def?.min).toBe(50);
		expect(def?.max).toBe(500);
	});
});
