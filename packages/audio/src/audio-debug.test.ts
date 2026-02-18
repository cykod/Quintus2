import { AssetLoader, DebugLog } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { createMockAudioContext } from "./__test-utils__.js";
import { AudioSystem } from "./audio-system.js";

function createSystem(debug: boolean) {
	const ctx = createMockAudioContext();
	const assets = new AssetLoader();
	const system = new AudioSystem(ctx as unknown as AudioContext, assets);
	const debugLog = new DebugLog();

	// Mock a minimal Game-like object for debug logging
	system._game = {
		debug,
		debugLog,
		fixedFrame: 5,
		elapsed: 0.083,
	} as never;

	return { ctx, assets, system, debugLog };
}

describe("Audio debug instrumentation", () => {
	it("logs play() in debug mode", () => {
		const { assets, system, debugLog } = createSystem(true);
		const fakeBuffer = {} as AudioBuffer;
		assets._storeCustom("coin", fakeBuffer);

		system.play("coin", { volume: 0.8, loop: false });

		const events = debugLog.peek({ category: "audio" });
		expect(events.length).toBe(1);
		expect(events[0]?.category).toBe("audio");
		expect(events[0]?.message).toBe('play "coin"');
		expect(events[0]?.data).toEqual({ name: "coin", volume: 0.8, loop: false });
	});

	it("does not log when debug is off", () => {
		const { assets, system, debugLog } = createSystem(false);
		const fakeBuffer = {} as AudioBuffer;
		assets._storeCustom("coin", fakeBuffer);

		system.play("coin");

		const events = debugLog.peek({ category: "audio" });
		expect(events.length).toBe(0);
	});
});
