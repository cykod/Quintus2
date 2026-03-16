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
	clone: (scene: unknown) => scene ?? {},
}));

import { Game, Scene } from "@quintus/core";
import * as THREE from "three";
import { BoneAttachment } from "./bone-attachment.js";
import { GLTFModel } from "./gltf-model.js";
import { ThreePlugin } from "./three-plugin.js";

function createGame() {
	const game = new Game({ width: 800, height: 600, renderer: null });
	game.use(ThreePlugin());
	return game;
}

function storeMockGltf(game: Game, name: string) {
	const scene = new THREE.Object3D();
	const bone = new THREE.Object3D();
	bone.name = "arm-right";
	scene.add(bone);
	game.assets._storeCustom(name, { scene, animations: [] });
}

describe("BoneAttachment", () => {
	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("finds bone in parent GLTFModel and reparents object3d", () => {
		const game = createGame();
		storeMockGltf(game, "char");

		class TestScene extends Scene {
			onReady() {
				const model = this.add(GLTFModel, { src: "char" });
				model.add(BoneAttachment, { boneName: "arm-right" });
			}
		}
		game.start(TestScene);

		const model = game.currentScene!.findByType(GLTFModel)!;
		const attachment = game.currentScene!.findByType(BoneAttachment)!;
		const bone = model.findBone("arm-right")!;

		expect(attachment.object3d.parent).toBe(bone);
	});

	it("sets _boneParented to true", () => {
		const game = createGame();
		storeMockGltf(game, "char");

		class TestScene extends Scene {
			onReady() {
				const model = this.add(GLTFModel, { src: "char" });
				model.add(BoneAttachment, { boneName: "arm-right" });
			}
		}
		game.start(TestScene);

		const attachment = game.currentScene!.findByType(BoneAttachment)!;
		expect(attachment._boneParented).toBe(true);
	});

	it("applies offset as object3d.position", () => {
		const game = createGame();
		storeMockGltf(game, "char");

		const offset = new THREE.Vector3(0, -0.15, 0.1);

		class TestScene extends Scene {
			onReady() {
				const model = this.add(GLTFModel, { src: "char" });
				model.add(BoneAttachment, { boneName: "arm-right", offset });
			}
		}
		game.start(TestScene);

		const attachment = game.currentScene!.findByType(BoneAttachment)!;
		expect(attachment.object3d.position.x).toBe(0);
		expect(attachment.object3d.position.y).toBeCloseTo(-0.15);
		expect(attachment.object3d.position.z).toBeCloseTo(0.1);
	});

	it("applies offsetRotation as object3d.rotation", () => {
		const game = createGame();
		storeMockGltf(game, "char");

		const offsetRotation = new THREE.Euler(0, Math.PI / 2, 0);

		class TestScene extends Scene {
			onReady() {
				const model = this.add(GLTFModel, { src: "char" });
				model.add(BoneAttachment, { boneName: "arm-right", offsetRotation });
			}
		}
		game.start(TestScene);

		const attachment = game.currentScene!.findByType(BoneAttachment)!;
		expect(attachment.object3d.rotation.y).toBeCloseTo(Math.PI / 2);
	});

	it("warns when bone name not found", () => {
		const game = createGame();
		storeMockGltf(game, "char");

		class TestScene extends Scene {
			onReady() {
				const model = this.add(GLTFModel, { src: "char" });
				model.add(BoneAttachment, { boneName: "nonexistent-bone" });
			}
		}
		game.start(TestScene);

		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("nonexistent-bone"));
	});

	it("cleans up on exit tree", () => {
		const game = createGame();
		storeMockGltf(game, "char");

		class TestScene extends Scene {
			onReady() {
				const model = this.add(GLTFModel, { src: "char" });
				model.add(BoneAttachment, { boneName: "arm-right" });
			}
		}
		game.start(TestScene);

		const attachment = game.currentScene!.findByType(BoneAttachment)!;
		const obj3d = attachment.object3d;
		const bone = obj3d.parent!;
		expect(bone).toBeDefined();
		expect(bone.children).toContain(obj3d);

		attachment.destroy();
		game.step(); // process deferred destruction
		expect(bone.children).not.toContain(obj3d);
		expect(attachment._boneParented).toBe(false);
	});

	it("does nothing when boneName is empty", () => {
		const game = createGame();
		storeMockGltf(game, "char");

		class TestScene extends Scene {
			onReady() {
				const model = this.add(GLTFModel, { src: "char" });
				model.add(BoneAttachment, { boneName: "" });
			}
		}
		game.start(TestScene);

		const attachment = game.currentScene!.findByType(BoneAttachment)!;
		expect(attachment._boneParented).toBe(false);
		expect(console.warn).not.toHaveBeenCalled();
	});
});
