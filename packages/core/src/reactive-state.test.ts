import { describe, expect, it, vi } from "vitest";
import { reactiveState } from "./reactive-state.js";

describe("reactiveState", () => {
	it("reads and writes properties", () => {
		const state = reactiveState({ health: 3, coins: 0 });
		expect(state.health).toBe(3);
		expect(state.coins).toBe(0);
		state.health = 2;
		expect(state.health).toBe(2);
	});

	it("emits changed on property set", () => {
		const state = reactiveState({ health: 3, coins: 0 });
		const fn = vi.fn();
		state.changed.connect(fn);
		state.health = 2;
		expect(fn).toHaveBeenCalledWith({ key: "health", value: 2, previous: 3 });
	});

	it("does not emit changed for same value", () => {
		const state = reactiveState({ health: 3 });
		const fn = vi.fn();
		state.changed.connect(fn);
		state.health = 3;
		expect(fn).not.toHaveBeenCalled();
	});

	it("on(key) returns per-key signal", () => {
		const state = reactiveState({ health: 3, coins: 0 });
		const healthFn = vi.fn();
		const coinsFn = vi.fn();
		state.on("health").connect(healthFn);
		state.on("coins").connect(coinsFn);

		state.health = 2;
		expect(healthFn).toHaveBeenCalledWith({ value: 2, previous: 3 });
		expect(coinsFn).not.toHaveBeenCalled();

		state.coins = 5;
		expect(coinsFn).toHaveBeenCalledWith({ value: 5, previous: 0 });
	});

	it("on(key) returns same signal on repeated calls", () => {
		const state = reactiveState({ x: 0 });
		const s1 = state.on("x");
		const s2 = state.on("x");
		expect(s1).toBe(s2);
	});

	it("reset() restores initial values", () => {
		const state = reactiveState({ health: 3, coins: 0 });
		state.health = 1;
		state.coins = 10;
		state.reset();
		expect(state.health).toBe(3);
		expect(state.coins).toBe(0);
	});

	it("reset() emits signals for changed keys", () => {
		const state = reactiveState({ health: 3, coins: 0 });
		const fn = vi.fn();
		state.changed.connect(fn);

		state.health = 1;
		fn.mockClear();

		state.reset();
		expect(fn).toHaveBeenCalledWith({ key: "health", value: 3, previous: 1 });
	});

	it("reset() does not emit for unchanged keys", () => {
		const state = reactiveState({ health: 3, coins: 0 });
		state.health = 1;
		// coins unchanged
		const fn = vi.fn();
		state.on("coins").connect(fn);

		state.reset();
		expect(fn).not.toHaveBeenCalled();
	});

	it("snapshot() returns a copy of current state", () => {
		const state = reactiveState({ health: 3, coins: 0 });
		state.coins = 5;
		const snap = state.snapshot();
		expect(snap).toEqual({ health: 3, coins: 5 });

		// Modifying snapshot doesn't affect state
		(snap as Record<string, unknown>).coins = 99;
		expect(state.coins).toBe(5);
	});

	it("works with string and boolean properties", () => {
		const state = reactiveState({ name: "hero", active: true });
		const fn = vi.fn();
		state.changed.connect(fn);

		state.name = "villain";
		expect(fn).toHaveBeenCalledWith({ key: "name", value: "villain", previous: "hero" });

		state.active = false;
		expect(fn).toHaveBeenCalledWith({ key: "active", value: false, previous: true });
	});

	it("multiple listeners on same key all fire", () => {
		const state = reactiveState({ x: 0 });
		const fn1 = vi.fn();
		const fn2 = vi.fn();
		state.on("x").connect(fn1);
		state.on("x").connect(fn2);

		state.x = 42;
		expect(fn1).toHaveBeenCalledOnce();
		expect(fn2).toHaveBeenCalledOnce();
	});
});
