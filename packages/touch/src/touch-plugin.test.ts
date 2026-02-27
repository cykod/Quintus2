import { Game, type GameOptions, Scene } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { TouchOverlay } from "./touch-overlay.js";
import { getTouchState, type TouchLayout, TouchPlugin } from "./touch-plugin.js";
import { VirtualButton } from "./virtual-button.js";

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

describe("TouchPlugin lifecycle", () => {
	it("creates overlay with controls when scene starts", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { jump: [] } }));
		const layout = {
			createControls: () => [
				new VirtualButton({ position: new Vec2(700, 500), radius: 30, action: "jump", label: "A" }),
			],
		};
		game.start(Scene);
		// Install after scene is active so the plugin sees currentScene
		game.use(TouchPlugin({ layout, visible: true }));

		const state = getTouchState(game)!;
		expect(state.overlay).not.toBeNull();
		expect(state.overlay).toBeInstanceOf(TouchOverlay);
		expect(state.overlay!.controls).toHaveLength(1);

		game.stop();
	});

	it("applies configured opacity to overlay", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: {} }));
		game.start(Scene);
		game.use(TouchPlugin({ layout: dummyLayout(), visible: true, opacity: 0.7 }));

		const state = getTouchState(game)!;
		expect(state.overlay!.alpha).toBe(0.7);

		game.stop();
	});

	it("applies default opacity of 0.4", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: {} }));
		game.start(Scene);
		game.use(TouchPlugin({ layout: dummyLayout(), visible: true }));

		const state = getTouchState(game)!;
		expect(state.overlay!.alpha).toBe(0.4);

		game.stop();
	});

	it("destroys old overlay and creates new one on scene switch", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: {} }));

		let callCount = 0;
		const layout = {
			createControls: () => {
				callCount++;
				return [];
			},
		};

		class Scene1 extends Scene {}
		class Scene2 extends Scene {}
		game.registerScenes({ scene1: Scene1, scene2: Scene2 });
		game.start("scene1");

		// Install after scene is active — creates overlay immediately
		game.use(TouchPlugin({ layout, visible: true }));

		const state = getTouchState(game)!;
		const firstOverlay = state.overlay;
		expect(firstOverlay).not.toBeNull();
		expect(callCount).toBe(1);

		// Switch scene — triggers sceneSwitched, destroys old overlay and creates new
		game._switchScene("scene2");
		game.step(); // process scene switch

		expect(callCount).toBe(2);
		expect(state.overlay).not.toBeNull();
		// First overlay should be destroyed
		expect(firstOverlay!.isDestroyed).toBe(true);

		game.stop();
	});

	it("sets overlay visible from controlsVisible when visible config is undefined", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: {} }));
		game.start(Scene);
		game.use(TouchPlugin({ layout: dummyLayout() })); // visible: undefined

		const state = getTouchState(game)!;
		// controlsVisible defaults to false, so overlay should be hidden
		expect(state.overlay!.visible).toBe(false);

		game.stop();
	});

	it("creates overlay immediately if scene already active", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: {} }));
		game.start(Scene);

		// Install plugin after scene already started
		game.use(TouchPlugin({ layout: dummyLayout(), visible: true }));

		const state = getTouchState(game)!;
		expect(state.overlay).not.toBeNull();

		game.stop();
	});

	it("does not create overlay if no scene active", () => {
		const game = createGame();
		game.use(TouchPlugin({ layout: dummyLayout() }));
		// Don't start any scene
		const state = getTouchState(game)!;
		expect(state.overlay).toBeNull();
	});

	it("cleans up all resources on game.stop()", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: {} }));
		game.start(Scene);
		game.use(TouchPlugin({ layout: dummyLayout(), visible: true }));

		const state = getTouchState(game)!;
		const overlay = state.overlay!;
		expect(overlay.isDestroyed).toBe(false);

		game.stop();
		expect(overlay.isDestroyed).toBe(true);
		expect(getTouchState(game)).toBeNull();
	});
});
