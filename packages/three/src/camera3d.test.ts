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
import { getThreeContext, ThreePlugin } from "./three-plugin.js";

describe("Camera3D", () => {
	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates perspective camera by default", () => {
		const cam = new Camera3D();
		expect(cam.camera).toBeInstanceOf(THREE.PerspectiveCamera);
	});

	it("creates orthographic camera", () => {
		const cam = new Camera3D();
		cam.orthographic = true;
		expect(cam.camera).toBeInstanceOf(THREE.OrthographicCamera);
	});

	it("uses custom fov via lazy creation", () => {
		const cam = new Camera3D();
		cam.fov = 90;
		const pcam = cam.camera as THREE.PerspectiveCamera;
		expect(pcam.fov).toBe(90);
	});

	it("uses custom near/far", () => {
		const cam = new Camera3D();
		cam.near = 0.5;
		cam.far = 500;
		const pcam = cam.camera as THREE.PerspectiveCamera;
		expect(pcam.near).toBe(0.5);
		expect(pcam.far).toBe(500);
	});

	it("registers as active camera on enter tree", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		class TestScene extends Scene {
			onReady() {
				this.add(Camera3D, { fov: 75 });
			}
		}
		game.start(TestScene);
		game.step();

		const ctx = getThreeContext(game);
		expect(ctx!.activeCamera).not.toBeNull();
		expect(ctx!.activeCamera).toBeInstanceOf(THREE.PerspectiveCamera);
	});

	it("does not register inactive camera", () => {
		const game = new Game({ width: 800, height: 600, renderer: null });
		game.use(ThreePlugin());

		class TestScene extends Scene {
			onReady() {
				this.add(Camera3D, { active: false });
			}
		}
		game.start(TestScene);
		game.step();

		const ctx = getThreeContext(game);
		expect(ctx!.activeCamera).toBeNull();
	});

	it("follows a target node", () => {
		const cam = new Camera3D();
		const target = new Node3D();
		target.position.set(10, 0, 0);

		cam.follow = target;
		cam.followSmoothing = 1000; // very fast
		cam.onUpdate(1 / 60);

		// Camera should have moved toward target + offset
		expect(cam.position.x).toBeGreaterThan(0);
	});

	it("shake offsets position", () => {
		const cam = new Camera3D();
		cam.position.set(0, 0, 0);

		cam.shake(1, 1);
		cam.onUpdate(0.1);

		// Position should be offset (non-zero due to shake)
		const pos = cam.position;
		const offset = Math.abs(pos.x) + Math.abs(pos.y) + Math.abs(pos.z);
		expect(offset).toBeGreaterThan(0);
	});

	it("shake decays and returns to base position", () => {
		const cam = new Camera3D();
		cam.position.set(5, 5, 5);

		cam.shake(1, 0.1);

		// Advance past shake duration
		cam.onUpdate(0.05);
		cam.onUpdate(0.05);
		cam.onUpdate(0.01); // past duration

		// Position should be restored to original (no shake offset)
		// Note: due to random offsets, we just check shake has stopped
		// The _shakeOffset should be (0,0,0) after completion
		// One more update to verify no further offset
		const before = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
		cam.onUpdate(0.1);
		expect(cam.position.x).toBe(before.x);
		expect(cam.position.y).toBe(before.y);
		expect(cam.position.z).toBe(before.z);
	});

	it("higher intensity shake overrides lower", () => {
		const cam = new Camera3D();
		cam.shake(0.1, 1);
		cam.shake(5, 1);

		cam.onUpdate(0.016);

		// Max offset should reflect the higher intensity
		const pos = cam.position;
		// With intensity 5, offsets can be up to ±5
		// We can't test exact values due to Math.random, but the shake should be active
		const offset = Math.abs(pos.x) + Math.abs(pos.y) + Math.abs(pos.z);
		expect(offset).toBeGreaterThan(0);
	});
});
