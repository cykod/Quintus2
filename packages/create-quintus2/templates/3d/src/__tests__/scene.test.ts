import { AmbientLight, Camera3D, DirectionalLight, MeshNode } from "quintus2/three";
import { TestRunner } from "quintus2/testing";
import { describe, expect, it } from "vitest";
import { Spinner } from "../entities/spinner.js";
import { MainScene } from "../scenes/main-scene.js";

describe("MainScene", () => {
	it("builds the 3D scene and spins the mesh", async () => {
		// No ThreePlugin: its WebGL renderer needs a real GL context that jsdom lacks.
		// The scene graph + fixed-update loop are fully exercisable without it — Camera3D
		// degrades gracefully when no Three.js context is installed.
		const result = await TestRunner.run({
			scene: MainScene,
			seed: 42,
			width: 800,
			height: 600,
			duration: 1,
		});

		const scene = result.game.currentScene;
		expect(scene).toBeDefined();

		// The scene tree contains the mesh, a camera, and both lights.
		// `findByType` returns null (not undefined) when absent, so assert `.not.toBeNull()`
		// — `expect(null).toBeDefined()` would pass and make these checks hollow.
		const spinner = scene?.findByType(Spinner);
		expect(spinner).not.toBeNull();
		expect(spinner).toBeInstanceOf(MeshNode);
		expect(scene?.findByType(Camera3D)).not.toBeNull();
		expect(scene?.findByType(AmbientLight)).not.toBeNull();
		expect(scene?.findByType(DirectionalLight)).not.toBeNull();

		// The mesh's rotation advances after stepping frames.
		expect(spinner!.rotation.y).toBeGreaterThan(0);

		result.game.stop();
	});
});
