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
	clone: (scene: unknown) => {
		return scene; // Return the original scene for testing
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

	it("destroy removes cloned scene without disposing shared resources", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		const mockGltf = {
			scene: new THREE.Object3D(),
			animations: [],
		};
		game.assets._storeCustom("shared", mockGltf);

		class TestScene extends Scene {
			onReady() {
				this.add(GLTFModel, { src: "shared" });
				this.add(GLTFModel, { src: "shared" });
			}
		}
		game.start(TestScene);
		game.step();

		const models = game.currentScene!.children.filter((c) => c instanceof GLTFModel) as GLTFModel[];
		expect(models).toHaveLength(2);
		expect(models[0].loaded).toBe(true);
		expect(models[1].loaded).toBe(true);

		// Destroy first — second should still be loaded and have its 3D children
		const secondChildCount = models[1].object3d.children.length;
		models[0].destroy();
		expect(models[1].loaded).toBe(true);
		expect(models[1].object3d.children.length).toBe(secondChildCount);
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

	it("applies flipModel rotation", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		const mockGltf = {
			scene: new THREE.Object3D(),
			animations: [],
		};
		game.assets._storeCustom("char", mockGltf);

		class TestScene extends Scene {
			onReady() {
				this.add(GLTFModel, { src: "char", flipModel: true });
			}
		}
		game.start(TestScene);

		const model = game.currentScene!.children.find((c) => c instanceof GLTFModel) as GLTFModel;
		expect(model.modelRotation).toBe(Math.PI);
	});

	it("applies custom modelRotation", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		const mockGltf = {
			scene: new THREE.Object3D(),
			animations: [],
		};
		game.assets._storeCustom("char", mockGltf);

		class TestScene extends Scene {
			onReady() {
				this.add(GLTFModel, { src: "char", modelRotation: Math.PI / 2 });
			}
		}
		game.start(TestScene);

		const model = game.currentScene!.children.find((c) => c instanceof GLTFModel) as GLTFModel;
		expect(model.modelRotation).toBe(Math.PI / 2);
	});

	it("getMaterials returns empty for unloaded model", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		class TestScene extends Scene {
			onReady() {
				this.add(GLTFModel);
			}
		}
		game.start(TestScene);

		const model = game.currentScene!.children.find((c) => c instanceof GLTFModel) as GLTFModel;
		expect(model.getMaterials()).toEqual([]);
	});

	it("cloneMaterials is idempotent", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		const mockGltf = {
			scene: new THREE.Object3D(),
			animations: [],
		};
		game.assets._storeCustom("char", mockGltf);

		class TestScene extends Scene {
			onReady() {
				this.add(GLTFModel, { src: "char" });
			}
		}
		game.start(TestScene);

		const model = game.currentScene!.children.find((c) => c instanceof GLTFModel) as GLTFModel;
		// Should not throw when called multiple times
		model.cloneMaterials();
		model.cloneMaterials();
	});

	it("setEmissive and resetEmissive work", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		// Create a scene with a mesh that has MeshStandardMaterial
		const meshScene = new THREE.Object3D();
		const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(), mat);
		meshScene.add(mesh);

		const mockGltf = { scene: meshScene, animations: [] };
		game.assets._storeCustom("char", mockGltf);

		class TestScene extends Scene {
			onReady() {
				this.add(GLTFModel, { src: "char" });
			}
		}
		game.start(TestScene);

		const model = game.currentScene!.children.find((c) => c instanceof GLTFModel) as GLTFModel;

		const mats = model.getMaterials();
		expect(mats.length).toBeGreaterThan(0);

		// setEmissive should auto-clone and set
		model.setEmissive({ r: 1, g: 0, b: 0 });
		// Materials were cloned so we need to re-get
		const matsAfter = model.getMaterials();
		const stdAfter = matsAfter[0] as unknown as { emissive: { r: number; g: number; b: number } };
		expect(stdAfter.emissive.r).toBe(1);

		// resetEmissive
		model.resetEmissive();
		expect(stdAfter.emissive.r).toBe(0);
	});

	it("setOpacity sets transparent flag", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		const meshScene = new THREE.Object3D();
		const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(), mat);
		meshScene.add(mesh);

		const mockGltf = { scene: meshScene, animations: [] };
		game.assets._storeCustom("char", mockGltf);

		class TestScene extends Scene {
			onReady() {
				this.add(GLTFModel, { src: "char" });
			}
		}
		game.start(TestScene);

		const model = game.currentScene!.children.find((c) => c instanceof GLTFModel) as GLTFModel;
		model.setOpacity(0.5);

		const mats = model.getMaterials();
		const stdMat = mats[0] as unknown as { opacity: number; transparent: boolean };
		expect(stdMat.opacity).toBe(0.5);
		expect(stdMat.transparent).toBe(true);
	});
});
