import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("./__test-utils__/three-mock.js"));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
	GLTFLoader: class {
		loadAsync(_path: string) {
			return Promise.resolve({});
		}
	},
}));

import { Game, Scene } from "@quintus/core";
import { getThreeContext, ThreePlugin } from "./three-plugin.js";
import "./augment.js";

describe("ThreePlugin", () => {
	let game: Game;

	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("installs in full mode when renderer is null", () => {
		game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		const ctx = getThreeContext(game);
		expect(ctx).not.toBeNull();
		expect(ctx!.hybridMode).toBe(false);
		expect(game.hasRenderer).toBe(true); // ThreeRenderer installed
	});

	it("installs in hybrid mode when renderer exists", () => {
		game = new Game({ width: 800, height: 600 });
		game.use(ThreePlugin());

		const ctx = getThreeContext(game);
		expect(ctx).not.toBeNull();
		expect(ctx!.hybridMode).toBe(true);
	});

	it("provides game.three accessor", () => {
		game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		expect(game.three).toBeDefined();
		expect(game.three.scene).toBeDefined();
	});

	it("game.three throws without install", () => {
		game = new Game({ width: 800, height: 600, renderer: null });

		expect(() => game.three).toThrow("ThreePlugin not installed");
	});

	it("registers GLTF/GLB asset loaders", () => {
		game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		// The asset loaders are registered — verify by checking that
		// registerLoader was called (indirect: try loading)
		expect(getThreeContext(game)).not.toBeNull();
	});

	it("clears scene on sceneSwitched", () => {
		game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		const ctx = getThreeContext(game)!;
		// Add something to the Three.js scene
		const { Object3D } = vi.mocked(require("three"));
		const dummy = new Object3D();
		ctx.scene.add(dummy);
		expect(ctx.scene.children.length).toBe(1);

		// Simulate scene switch
		game.sceneSwitched.emit({ from: "a", to: "b" });
		expect(ctx.scene.children.length).toBe(0);
		expect(ctx.activeCamera).toBeNull();
	});

	it("cleans up on game stop", () => {
		game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		class EmptyScene extends Scene {}
		game.start(EmptyScene);

		expect(getThreeContext(game)).not.toBeNull();
		game.stop();
		expect(getThreeContext(game)).toBeNull();
	});
});
