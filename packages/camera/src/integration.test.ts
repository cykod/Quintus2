import { Game, Node2D, Scene } from "@quintus/core";
import { Matrix2D, Rect } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { Camera } from "./camera.js";

describe("Camera Integration", () => {
	it("Camera + Scene.viewTransform + game loop", () => {
		const game = new Game({
			width: 320,
			height: 240,
			canvas: document.createElement("canvas"),
			renderer: null,
			seed: 42,
		});

		let camera!: Camera;
		let target!: Node2D;

		class TestScene extends Scene {
			onReady() {
				target = this.add(Node2D);
				target.position.x = 200;
				target.position.y = 100;

				camera = this.add(Camera);
				camera.follow = target;
				camera.smoothing = 0;
				camera.zoom = 2;
				camera.bounds = new Rect(0, 0, 1000, 800);
			}
		}
		game.start(TestScene);
		game.step();

		// Camera should follow target
		expect(camera.position.x).toBe(200);
		expect(camera.position.y).toBe(100);

		// Scene viewTransform should be set
		const scene = game.currentScene;
		const vt = scene.viewTransform;
		expect(vt.a).toBe(2);
		expect(vt.d).toBe(2);
		// e = -200 * 2 + 160 = -240
		expect(vt.e).toBe(-240);
		// f = -100 * 2 + 120 = -80
		expect(vt.f).toBe(-80);

		// Move target and step
		target.position.x = 500;
		target.position.y = 300;
		game.step();

		expect(camera.position.x).toBe(500);
		expect(camera.position.y).toBe(300);

		// Verify viewTransform updated
		const vt2 = scene.viewTransform;
		expect(vt2.e).toBe(-500 * 2 + 160);
	});

	it("scene switch resets viewTransform", () => {
		const game = new Game({
			width: 320,
			height: 240,
			canvas: document.createElement("canvas"),
			renderer: null,
		});

		let sceneRef!: Scene;

		class Scene1 extends Scene {
			onReady() {
				sceneRef = this;
				const camera = this.add(Camera);
				camera.position.x = 100;
			}
		}

		class Scene2 extends Scene {
			onReady() {
				sceneRef = this;
				// No camera — viewTransform should be identity
			}
		}

		game.start(Scene1);
		game.step();

		// Scene 1 has non-identity viewTransform
		expect(sceneRef.viewTransform.e).not.toBe(0);

		// Switch to scene 2
		sceneRef.switchTo(Scene2);

		// New scene should have identity viewTransform
		expect(sceneRef.viewTransform).toBe(Matrix2D.IDENTITY);
	});

	it("camera follow with smooth interpolation converges", () => {
		const game = new Game({
			width: 320,
			height: 240,
			canvas: document.createElement("canvas"),
			renderer: null,
		});

		let camera!: Camera;
		let target!: Node2D;

		class TestScene extends Scene {
			onReady() {
				target = this.add(Node2D);
				target.position.x = 200;
				target.position.y = 100;

				camera = this.add(Camera);
				camera.follow = target;
				camera.smoothing = 0.3;
			}
		}
		game.start(TestScene);

		// Step many frames — camera should converge toward target
		for (let i = 0; i < 120; i++) game.step();

		expect(camera.position.x).toBeCloseTo(200, 0);
		expect(camera.position.y).toBeCloseTo(100, 0);
	});

	it("camera shake + follow works together", () => {
		const game = new Game({
			width: 320,
			height: 240,
			canvas: document.createElement("canvas"),
			renderer: null,
			seed: 42,
		});

		let camera!: Camera;

		class TestScene extends Scene {
			onReady() {
				const target = this.add(Node2D);
				target.position.x = 100;
				target.position.y = 50;

				camera = this.add(Camera);
				camera.follow = target;
				camera.smoothing = 0;
			}
		}
		game.start(TestScene);
		game.step();

		// Verify position is set
		expect(camera.position.x).toBe(100);

		// Start shake
		camera.shake(5, 0.5);
		game.step();

		// Camera should still be following target (position unchanged)
		expect(camera.position.x).toBe(100);
		expect(camera.position.y).toBe(50);

		// But viewTransform should include shake offset
		expect(camera.isShaking).toBe(true);
	});
});
