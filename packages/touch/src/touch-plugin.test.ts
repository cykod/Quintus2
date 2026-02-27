import { Game, type GameOptions, Scene } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { getTouchState, type TouchLayout, TouchPlugin } from "./touch-plugin.js";

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null, ...opts });
}

function dummyLayout(): TouchLayout {
	return { createControls: () => [] };
}

describe("TouchPlugin", () => {
	it("installs and registers state on the game", () => {
		const game = createGame();
		game.use(TouchPlugin({ layout: dummyLayout() }));
		const state = getTouchState(game);
		expect(state).not.toBeNull();
		expect(state!.config.layout).toBeDefined();
	});

	it("getTouchState returns null when not installed", () => {
		const game = createGame();
		expect(getTouchState(game)).toBeNull();
	});

	it("accepts a layout factory function", () => {
		const game = createGame();
		game.use(
			TouchPlugin({
				layout: (_g) => ({ createControls: () => [] }),
			}),
		);
		const state = getTouchState(game);
		expect(state).not.toBeNull();
		expect(state!.layout).toBeDefined();
	});

	it("respects visible: true config", () => {
		const game = createGame();
		game.use(TouchPlugin({ layout: dummyLayout(), visible: true }));
		const state = getTouchState(game);
		expect(state!.controlsVisible).toBe(true);
	});

	it("respects visible: false config", () => {
		const game = createGame();
		game.use(TouchPlugin({ layout: dummyLayout(), visible: false }));
		const state = getTouchState(game);
		expect(state!.controlsVisible).toBe(false);
	});

	it("defaults controlsVisible to false when visible is undefined", () => {
		const game = createGame();
		game.use(TouchPlugin({ layout: dummyLayout() }));
		const state = getTouchState(game);
		expect(state!.controlsVisible).toBe(false);
	});

	it("cleans up state on game.stop()", () => {
		const game = createGame();
		game.use(TouchPlugin({ layout: dummyLayout() }));
		game.start(Scene);
		expect(getTouchState(game)).not.toBeNull();
		game.stop();
		expect(getTouchState(game)).toBeNull();
	});

	it("applies scroll lock by default", () => {
		const game = createGame();
		game.use(TouchPlugin({ layout: dummyLayout() }));
		// Scroll lock sets body overflow: hidden
		expect(document.body.style.overflow).toBe("hidden");
		// Cleanup
		game.start(Scene);
		game.stop();
	});

	it("skips scroll lock when preventScroll: false", () => {
		// Reset body styles from previous test
		document.body.style.overflow = "";
		document.body.style.position = "";
		document.body.style.width = "";
		document.body.style.height = "";

		const game = createGame();
		game.use(TouchPlugin({ layout: dummyLayout(), preventScroll: false }));
		expect(document.body.style.overflow).toBe("");
	});

	it("stores config values", () => {
		const game = createGame();
		game.use(
			TouchPlugin({
				layout: dummyLayout(),
				fullscreen: true,
				opacity: 0.8,
				orientation: "portrait",
			}),
		);
		const state = getTouchState(game);
		expect(state!.config.fullscreen).toBe(true);
		expect(state!.config.opacity).toBe(0.8);
		expect(state!.config.orientation).toBe("portrait");
	});
});
