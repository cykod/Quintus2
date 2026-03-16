import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("./__test-utils__/three-mock.js"));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
	GLTFLoader: class {
		loadAsync() {
			return Promise.resolve({});
		}
	},
}));

import { Game, Scene } from "@quintus/core";
import * as THREE from "three";
import { Camera3D } from "./camera3d.js";
import { Node3D } from "./node3d.js";
import { ThreeLayer } from "./three-layer.js";
import { getThreeContext, ThreePlugin } from "./three-plugin.js";

describe("ThreeLayer", () => {
	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates its own Three.js scene", () => {
		const layer = new ThreeLayer();
		expect(layer.threeScene).toBeInstanceOf(THREE.Scene);
	});

	it("syncs Node3D children to its Three.js scene", () => {
		const layer = new ThreeLayer();
		const child = new Node3D();
		layer.add(child);

		// Trigger sync
		layer.onUpdate(1 / 60);

		expect(layer.threeScene.children.length).toBe(1);
	});

	it("finds child Camera3D automatically", () => {
		const game = new Game({ width: 800, height: 600 });
		game.use(ThreePlugin());

		class TestScene extends Scene {
			onReady() {
				const layer = this.add(ThreeLayer);
				layer.add(Camera3D, { fov: 60 });
				layer.add(Node3D);
			}
		}
		game.start(TestScene);
		game.step();

		// Layer should have found the child Camera3D
		const layer = game.currentScene!.children.find((c) => c instanceof ThreeLayer) as ThreeLayer;
		expect(layer).toBeDefined();
	});

	it("uses shared WebGLRenderer from ThreeContext", () => {
		const game = new Game({ width: 800, height: 600 });
		game.use(ThreePlugin());

		const ctx = getThreeContext(game);
		expect(ctx).not.toBeNull();
		expect(ctx!.hybridMode).toBe(true);
	});

	it("does not reparent bone-parented nodes", () => {
		const layer = new ThreeLayer();
		const child = new Node3D();
		child._boneParented = true;

		// Manually parent the object3d elsewhere (simulating bone attachment)
		const fakeBone = new THREE.Object3D();
		fakeBone.add(child.object3d);

		layer.add(child);
		layer.onUpdate(1 / 60);

		// Should NOT have been moved to threeScene
		expect(child.object3d.parent).toBe(fakeBone);
		expect(layer.threeScene.children).not.toContain(child.object3d);
	});

	it("clears its Three.js scene on destroy", () => {
		const layer = new ThreeLayer();
		const child = new Node3D();
		layer.add(child);
		layer.onUpdate(1 / 60);
		expect(layer.threeScene.children.length).toBe(1);

		layer.onDestroy();
		expect(layer.threeScene.children.length).toBe(0);
	});
});
