import { Game, Scene } from "@quintus/core";
import { describe, expect, it, vi } from "vitest";
import { createMockAudioContext } from "./__test-utils__.js";
import { AudioPlugin, getAudio } from "./audio-plugin.js";

describe("AudioPlugin", () => {
	it("installs AudioSystem on game", () => {
		const mockCtx = createMockAudioContext();
		// biome-ignore lint/complexity/useArrowFunction: must be constructable with `new`
		vi.stubGlobal("AudioContext", function () {
			return mockCtx;
		});

		const game = new Game({ width: 320, height: 240, renderer: null });
		game.use(AudioPlugin());

		class TestScene extends Scene {}
		game.start(TestScene);

		const audio = getAudio(game);
		expect(audio).not.toBeNull();
		expect(audio?.context).toBe(mockCtx);

		game.stop();
	});

	it("getAudio returns null when plugin not installed", () => {
		const game = new Game({ width: 320, height: 240, renderer: null });
		class TestScene extends Scene {}
		game.start(TestScene);
		expect(getAudio(game)).toBeNull();
		game.stop();
	});

	it("registers audio asset loader", () => {
		const mockCtx = createMockAudioContext();
		// biome-ignore lint/complexity/useArrowFunction: must be constructable with `new`
		vi.stubGlobal("AudioContext", function () {
			return mockCtx;
		});

		const game = new Game({ width: 320, height: 240, renderer: null });
		game.use(AudioPlugin());

		class TestScene extends Scene {}
		game.start(TestScene);

		// The loader should be registered — verify we can store a custom audio asset
		game.assets._storeCustom("test-sound", {} as AudioBuffer);
		expect(game.assets.get("test-sound")).toBeDefined();

		game.stop();
	});

	it("cleans up on game.stop()", () => {
		const mockCtx = createMockAudioContext();
		// biome-ignore lint/complexity/useArrowFunction: must be constructable with `new`
		vi.stubGlobal("AudioContext", function () {
			return mockCtx;
		});

		const game = new Game({ width: 320, height: 240, renderer: null });
		game.use(AudioPlugin());

		class TestScene extends Scene {}
		game.start(TestScene);

		expect(getAudio(game)).not.toBeNull();

		game.stop();

		// After stop, AudioSystem should be cleaned up
		expect(getAudio(game)).toBeNull();
		expect(mockCtx.close).toHaveBeenCalled();
	});

	it("handles headless environment (no AudioContext)", () => {
		// Simulate headless: AudioContext constructor throws
		// biome-ignore lint/complexity/useArrowFunction: must be constructable with `new`
		vi.stubGlobal("AudioContext", function () {
			throw new Error("Not supported");
		});

		const game = new Game({ width: 320, height: 240, renderer: null });
		// Should not throw
		game.use(AudioPlugin());

		class TestScene extends Scene {}
		game.start(TestScene);

		const audio = getAudio(game);
		expect(audio).not.toBeNull();
		// Context should be null in headless
		expect(audio?.context).toBeNull();

		game.stop();
	});

	it("headless registers noop audio loader", () => {
		// biome-ignore lint/complexity/useArrowFunction: must be constructable with `new`
		vi.stubGlobal("AudioContext", function () {
			throw new Error("Not supported");
		});

		const game = new Game({ width: 320, height: 240, renderer: null });
		game.use(AudioPlugin());

		class TestScene extends Scene {}
		game.start(TestScene);

		// The noop loader should be registered and not throw
		// We can't easily test it without calling load, but at least verify system works
		const audio = getAudio(game);
		expect(audio?.ready).toBe(false);

		game.stop();
	});
});
