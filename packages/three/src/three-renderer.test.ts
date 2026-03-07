import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("./__test-utils__/three-mock.js"));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
	GLTFLoader: class {
		loadAsync() {
			return Promise.resolve({});
		}
	},
}));

import type { DrawContext } from "@quintus/core";
import { Game, Node, Node2D, Scene } from "@quintus/core";
import { Node3D } from "./node3d.js";
import { ThreeContext } from "./three-context.js";
import { getThreeContext, ThreePlugin } from "./three-plugin.js";
import { ThreeRenderer } from "./three-renderer.js";

describe("ThreeRenderer", () => {
	let game: Game;

	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function makeFullGame(): Game {
		game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());
		return game;
	}

	it("syncs Node3D to Three.js scene", () => {
		const game = makeFullGame();

		class TestScene extends Scene {
			onReady() {
				this.add(Node3D);
			}
		}
		game.start(TestScene);
		game.step(); // trigger render

		const ctx = getThreeContext(game)!;
		expect(ctx.scene.children.length).toBeGreaterThan(0);
	});

	it("syncs nested Node3D hierarchy", () => {
		const game = makeFullGame();

		class TestScene extends Scene {
			onReady() {
				const parent = this.add(Node3D);
				parent.add(Node3D);
			}
		}
		game.start(TestScene);
		game.step();

		const threeScene = getThreeContext(game)!.scene;
		expect(threeScene.children.length).toBe(1);
		expect(threeScene.children[0]!.children.length).toBe(1);
	});

	it("non-3D nodes are transparent to sync", () => {
		const game = makeFullGame();

		class TestScene extends Scene {
			onReady() {
				const wrapper = this.add(Node); // plain Node wrapper
				wrapper.add(Node3D);
			}
		}
		game.start(TestScene);
		game.step();

		const ctx = getThreeContext(game)!;
		expect(ctx.scene.children.length).toBe(1);
	});

	it("marks render dirty", () => {
		const ctx = new ThreeContext(document.createElement("canvas"), 800, 600);
		const renderer = new ThreeRenderer(ctx);
		renderer.markRenderDirty();
		// Should not throw — just sets internal flag
	});

	it("warns on non-renderFixed Node2D in 3D mode", () => {
		const game = makeFullGame();

		class DrawableNode2D extends Node2D {
			override onDraw(_ctx: DrawContext): void {}
		}

		class TestScene extends Scene {
			onReady() {
				this.add(DrawableNode2D);
			}
		}
		game.start(TestScene);
		game.step();

		expect(console.warn).toHaveBeenCalledWith(
			expect.stringContaining("will not render in full-3D mode"),
		);
	});
});
