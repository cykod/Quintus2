import { describe, expect, it } from "vitest";
import { createMockAudioContext } from "./__test-utils__.js";
import { AudioBus } from "./audio-bus.js";

describe("AudioBus", () => {
	it("creates master and 3 bus gain nodes", () => {
		const ctx = createMockAudioContext();
		new AudioBus(ctx as unknown as AudioContext);

		// master + music + sfx + ui = 4 gain nodes
		expect(ctx.createGain).toHaveBeenCalledTimes(4);
	});

	it("getOutput returns the correct bus", () => {
		const ctx = createMockAudioContext();
		const bus = new AudioBus(ctx as unknown as AudioContext);

		const sfx = bus.getOutput("sfx");
		const music = bus.getOutput("music");
		const ui = bus.getOutput("ui");

		expect(sfx).toBeTruthy();
		expect(music).toBeTruthy();
		expect(ui).toBeTruthy();
		expect(sfx).not.toBe(music);
	});

	it("getOutput falls back to sfx for unknown bus", () => {
		const ctx = createMockAudioContext();
		const bus = new AudioBus(ctx as unknown as AudioContext);

		const sfx = bus.getOutput("sfx");
		const unknown = bus.getOutput("nonexistent");
		expect(unknown).toBe(sfx);
	});

	it("setVolume clamps and sets volume", () => {
		const ctx = createMockAudioContext();
		const bus = new AudioBus(ctx as unknown as AudioContext);

		bus.setVolume("sfx", 0.5);
		expect(bus.getVolume("sfx")).toBe(0.5);

		bus.setVolume("sfx", -1);
		expect(bus.getVolume("sfx")).toBe(0);

		bus.setVolume("sfx", 2);
		expect(bus.getVolume("sfx")).toBe(1);
	});

	it("masterVolume getter/setter works", () => {
		const ctx = createMockAudioContext();
		const bus = new AudioBus(ctx as unknown as AudioContext);

		bus.masterVolume = 0.3;
		expect(bus.masterVolume).toBeCloseTo(0.3);
	});

	it("getVolume returns 1 for unknown bus", () => {
		const ctx = createMockAudioContext();
		const bus = new AudioBus(ctx as unknown as AudioContext);

		expect(bus.getVolume("nonexistent")).toBe(1);
	});
});
