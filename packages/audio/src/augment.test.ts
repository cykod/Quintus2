import { Game, Scene } from "@quintus/core";
import { describe, expect, it, vi } from "vitest";
import { createMockAudioContext } from "./__test-utils__.js";
import "./augment.js";
import { AudioPlugin } from "./audio-plugin.js";

const mockCtx = createMockAudioContext();
// biome-ignore lint/complexity/useArrowFunction: must be constructable with `new`
vi.stubGlobal("AudioContext", function () {
	return mockCtx;
});

function createGame(): Game {
	return new Game({ width: 320, height: 240, renderer: null });
}

describe("audio augment (game.audio)", () => {
	it("game.audio throws when AudioPlugin not installed", () => {
		const game = createGame();
		game.start(class TestScene extends Scene {});

		expect(() => game.audio).toThrow("AudioPlugin not installed");

		game.stop();
	});

	it("game.audio returns AudioSystem when AudioPlugin is installed", () => {
		const game = createGame();
		game.use(AudioPlugin());
		game.start(class TestScene extends Scene {});

		expect(game.audio).toBeDefined();
		expect(game.audio.context).toBe(mockCtx);

		game.stop();
	});

	it("game.audio.ready reflects autoplay gate state", () => {
		const game = createGame();
		game.use(AudioPlugin());
		game.start(class TestScene extends Scene {});

		// Mock context state is "running", so should be ready
		expect(game.audio.ready).toBe(true);

		game.stop();
	});
});
