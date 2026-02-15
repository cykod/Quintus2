import { AssetLoader } from "@quintus/core";
import { describe, expect, it, vi } from "vitest";
import { createMockAudioContext } from "./__test-utils__.js";
import { AudioSystem } from "./audio-system.js";

function createSystem() {
	const ctx = createMockAudioContext();
	const assets = new AssetLoader();
	const system = new AudioSystem(ctx as unknown as AudioContext, assets);
	return { ctx, assets, system };
}

describe("AudioSystem", () => {
	it("play() returns a handle with stop() and playing", () => {
		const { ctx, assets, system } = createSystem();
		const fakeBuffer = {} as AudioBuffer;
		assets._storeCustom("jump", fakeBuffer);

		const handle = system.play("jump");
		expect(handle.playing).toBe(true);
		expect(ctx.createBufferSource).toHaveBeenCalledOnce();

		handle.stop();
		expect(handle.playing).toBe(false);
	});

	it("play() warns and returns noop for missing asset", () => {
		const { system } = createSystem();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		const handle = system.play("missing");
		expect(handle.playing).toBe(false);
		expect(warn).toHaveBeenCalledOnce();

		warn.mockRestore();
	});

	it("play() returns noop when context is null", () => {
		const assets = new AssetLoader();
		const system = new AudioSystem(null, assets);

		const handle = system.play("anything");
		expect(handle.playing).toBe(false);
	});

	it("play() respects options", () => {
		const { ctx, assets, system } = createSystem();
		const fakeBuffer = {} as AudioBuffer;
		assets._storeCustom("shot", fakeBuffer);

		system.play("shot", { volume: 0.5, loop: true, rate: 2, bus: "ui" });

		const source = ctx._sources[0];
		expect(source.buffer).toBe(fakeBuffer);
		expect(source.loop).toBe(true);
		expect(source.playbackRate.value).toBe(2);
		expect(source.start).toHaveBeenCalledWith(0);
	});

	it("stopAll() stops all active sounds", () => {
		const { assets, system } = createSystem();
		const fakeBuffer = {} as AudioBuffer;
		assets._storeCustom("a", fakeBuffer);
		assets._storeCustom("b", fakeBuffer);

		const h1 = system.play("a");
		const h2 = system.play("b");

		system.stopAll();
		expect(h1.playing).toBe(false);
		expect(h2.playing).toBe(false);
	});

	it("masterVolume getter/setter", () => {
		const { system } = createSystem();

		system.masterVolume = 0.5;
		expect(system.masterVolume).toBeCloseTo(0.5);
	});

	it("setBusVolume / getBusVolume", () => {
		const { system } = createSystem();

		system.setBusVolume("music", 0.3);
		expect(system.getBusVolume("music")).toBeCloseTo(0.3);
	});

	it("handle.playing becomes false when source ends", () => {
		const { ctx, assets, system } = createSystem();
		const fakeBuffer = {} as AudioBuffer;
		assets._storeCustom("fx", fakeBuffer);

		const handle = system.play("fx");
		expect(handle.playing).toBe(true);

		// Simulate source ending
		const source = ctx._sources[0];
		source.onended?.();

		expect(handle.playing).toBe(false);
	});
});
