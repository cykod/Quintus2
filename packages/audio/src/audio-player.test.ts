import { Game, Scene } from "@quintus/core";
import { describe, expect, it, vi } from "vitest";
import { createMockAudioContext } from "./__test-utils__.js";
import { AudioPlayer } from "./audio-player.js";
import { AudioPlugin } from "./audio-plugin.js";

// Override AudioContext globally for tests
const mockCtx = createMockAudioContext();
// biome-ignore lint/complexity/useArrowFunction: must be constructable with `new`
vi.stubGlobal("AudioContext", function () {
	return mockCtx;
});

class TestScene extends Scene {
	onReady() {}
}

function createGame(): Game {
	return new Game({
		width: 320,
		height: 240,
		renderer: null,
	});
}

describe("AudioPlayer", () => {
	it("autoplay plays on ready", () => {
		const game = createGame();
		game.use(AudioPlugin());

		const fakeBuffer = {} as AudioBuffer;
		game.assets._storeCustom("bgm", fakeBuffer);

		game.start(TestScene);

		const player = new AudioPlayer();
		player.stream = "bgm";
		player.autoplay = true;
		game.currentScene.add(player);

		expect(player.playing).toBe(true);

		game.stop();
	});

	it("stop on destroy", () => {
		const game = createGame();
		game.use(AudioPlugin());

		const fakeBuffer = {} as AudioBuffer;
		game.assets._storeCustom("bgm2", fakeBuffer);

		game.start(TestScene);

		const player = new AudioPlayer();
		player.stream = "bgm2";
		game.currentScene.add(player);

		player.play();
		expect(player.playing).toBe(true);

		player.destroy();
		game.step(); // process destroy queue
		expect(player.playing).toBe(false);

		game.stop();
	});

	it("finished signal fires on stop", () => {
		const game = createGame();
		game.use(AudioPlugin());

		const fakeBuffer = {} as AudioBuffer;
		game.assets._storeCustom("sfx1", fakeBuffer);

		game.start(TestScene);

		const player = new AudioPlayer();
		player.stream = "sfx1";
		game.currentScene.add(player);

		const fn = vi.fn();
		player.finished.connect(fn);

		player.play();
		player.stop();
		expect(fn).toHaveBeenCalledOnce();

		game.stop();
	});

	it("play with no stream is a no-op", () => {
		const game = createGame();
		game.use(AudioPlugin());
		game.start(TestScene);

		const player = new AudioPlayer();
		game.currentScene.add(player);

		player.play(); // No stream set
		expect(player.playing).toBe(false);

		game.stop();
	});

	it("defaults to music bus", () => {
		const player = new AudioPlayer();
		expect(player.bus).toBe("music");
	});
});
