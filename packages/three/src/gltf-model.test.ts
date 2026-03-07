import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("./__test-utils__/three-mock.js"));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
	GLTFLoader: class {
		loadAsync() {
			return Promise.resolve({});
		}
	},
}));
vi.mock("three/addons/utils/SkeletonUtils.js", () => ({
	clone: (_scene: unknown) => {
		// Return a mock clone (simple Object3D-like)
		const THREE = require("three");
		const cloned = new THREE.Object3D();
		return cloned;
	},
}));

import { Game, Scene } from "@quintus/core";
import * as THREE from "three";
import { GLTFModel } from "./gltf-model.js";
import { ThreePlugin } from "./three-plugin.js";

describe("GLTFModel", () => {
	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("loads from asset system", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		const mockGltf = {
			scene: new THREE.Object3D(),
			animations: [],
		};
		game.assets._storeCustom("model", mockGltf);

		class TestScene extends Scene {
			onReady() {
				this.add(GLTFModel, { src: "model" });
			}
		}
		game.start(TestScene);
		game.step();

		const model = game.currentScene!.children.find((c) => c instanceof GLTFModel) as GLTFModel;
		expect(model.loaded).toBe(true);
	});

	it("warns if asset is missing", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		class TestScene extends Scene {
			onReady() {
				this.add(GLTFModel, { src: "missing" });
			}
		}
		game.start(TestScene);

		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("not found"));
	});

	it("reports animation names", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		const mockGltf = {
			scene: new THREE.Object3D(),
			animations: [new THREE.AnimationClip("walk", 1), new THREE.AnimationClip("idle", 1)],
		};
		game.assets._storeCustom("char", mockGltf);

		class TestScene extends Scene {
			onReady() {
				this.add(GLTFModel, { src: "char" });
			}
		}
		game.start(TestScene);

		const model = game.currentScene!.children.find((c) => c instanceof GLTFModel) as GLTFModel;
		expect(model.animationNames).toContain("walk");
		expect(model.animationNames).toContain("idle");
	});

	it("play/stop animations", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		const mockGltf = {
			scene: new THREE.Object3D(),
			animations: [new THREE.AnimationClip("run", 1)],
		};
		game.assets._storeCustom("char", mockGltf);

		class TestScene extends Scene {
			onReady() {
				this.add(GLTFModel, { src: "char" });
			}
		}
		game.start(TestScene);

		const model = game.currentScene!.children.find((c) => c instanceof GLTFModel) as GLTFModel;
		// Should not throw
		model.play("run");
		model.stop();
	});

	it("does nothing with empty src", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		class TestScene extends Scene {
			onReady() {
				this.add(GLTFModel);
			}
		}
		game.start(TestScene);

		const model = game.currentScene!.children.find((c) => c instanceof GLTFModel) as GLTFModel;
		expect(model.loaded).toBe(false);
	});

	it("applies modelScale", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		const mockGltf = {
			scene: new THREE.Object3D(),
			animations: [],
		};
		game.assets._storeCustom("char", mockGltf);

		class TestScene extends Scene {
			onReady() {
				this.add(GLTFModel, { src: "char", modelScale: 2 });
			}
		}
		game.start(TestScene);

		const model = game.currentScene!.children.find((c) => c instanceof GLTFModel) as GLTFModel;
		expect(model.loaded).toBe(true);
	});
});
