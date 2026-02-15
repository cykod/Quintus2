import { Game, Node2D, Scene } from "@quintus/core";
import { Rect, Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { Camera } from "./camera.js";

function createGame(width = 320, height = 240): Game {
	return new Game({
		width,
		height,
		canvas: document.createElement("canvas"),
		renderer: null,
		seed: 42,
	});
}

function setupCamera(
	game: Game,
	configure?: (camera: Camera, target: Node2D) => void,
): { camera: Camera; target: Node2D } {
	let camera!: Camera;
	let target!: Node2D;
	class TestScene extends Scene {
		onReady() {
			target = this.add(Node2D);
			target.position.x = 100;
			target.position.y = 50;
			camera = this.add(Camera);
			configure?.(camera, target);
		}
	}
	game.start(TestScene);
	return { camera, target };
}

describe("Camera", () => {
	describe("follow", () => {
		it("snaps to target with smoothing=0", () => {
			const game = createGame();
			const { camera } = setupCamera(game, (c, t) => {
				c.follow = t;
				c.smoothing = 0;
			});
			game.step();
			expect(camera.position.x).toBe(100);
			expect(camera.position.y).toBe(50);
		});

		it("interpolates with smoothing > 0", () => {
			const game = createGame();
			const { camera } = setupCamera(game, (c, t) => {
				c.follow = t;
				c.smoothing = 0.5;
			});
			game.step();
			// Should be closer to target but not there yet
			expect(camera.position.x).toBeGreaterThan(0);
			expect(camera.position.x).toBeLessThan(100);
		});

		it("applies offset", () => {
			const game = createGame();
			const { camera } = setupCamera(game, (c, t) => {
				c.follow = t;
				c.smoothing = 0;
				c.offset.x = 20;
				c.offset.y = -10;
			});
			game.step();
			expect(camera.position.x).toBe(120);
			expect(camera.position.y).toBe(40);
		});

		it("stops following destroyed target", () => {
			const game = createGame();
			const { camera, target } = setupCamera(game, (c, t) => {
				c.follow = t;
				c.smoothing = 0;
			});
			game.step();
			expect(camera.position.x).toBe(100);

			target.destroy();
			game.step(); // process destruction
			game.step(); // camera should detect destroyed target

			// Camera should hold position
			expect(camera.follow).toBeNull();
			expect(camera.position.x).toBe(100);
		});

		it("works with manual position when no follow target", () => {
			const game = createGame();
			const { camera } = setupCamera(game);
			camera.position.x = 200;
			camera.position.y = 150;
			game.step();
			expect(camera.position.x).toBe(200);
			expect(camera.position.y).toBe(150);
		});
	});

	describe("bounds", () => {
		it("clamps camera inside bounds", () => {
			const game = createGame();
			const { camera } = setupCamera(game, (c, t) => {
				c.follow = t;
				c.smoothing = 0;
				c.bounds = new Rect(0, 0, 200, 100);
			});

			// Target at (100, 50), viewport 320x240 at zoom=1
			// halfViewW = 160, halfViewH = 120
			// Bounds 200x100 is smaller than viewport, so center
			game.step();
			expect(camera.position.x).toBe(100); // 200/2 = 100 (centered)
			expect(camera.position.y).toBe(50); // 100/2 = 50 (centered)
		});

		it("clamps at edges of large map", () => {
			const game = createGame();
			const { camera, target } = setupCamera(game, (c, t) => {
				c.follow = t;
				c.smoothing = 0;
				c.bounds = new Rect(0, 0, 1000, 800);
			});

			// Move target to far right
			target.position.x = 950;
			target.position.y = 750;
			game.step();

			// halfViewW = 160, maxX = 1000 - 160 = 840
			// halfViewH = 120, maxY = 800 - 120 = 680
			expect(camera.position.x).toBe(840);
			expect(camera.position.y).toBe(680);
		});

		it("clamps at top-left corner", () => {
			const game = createGame();
			const { camera, target } = setupCamera(game, (c, t) => {
				c.follow = t;
				c.smoothing = 0;
				c.bounds = new Rect(0, 0, 1000, 800);
			});

			target.position.x = 0;
			target.position.y = 0;
			game.step();

			// minX = 160, minY = 120
			expect(camera.position.x).toBe(160);
			expect(camera.position.y).toBe(120);
		});

		it("adjusts bounds for zoom", () => {
			const game = createGame();
			const { camera, target } = setupCamera(game, (c, t) => {
				c.follow = t;
				c.smoothing = 0;
				c.bounds = new Rect(0, 0, 1000, 800);
				c.zoom = 2;
			});

			target.position.x = 0;
			target.position.y = 0;
			game.step();

			// At zoom 2: halfViewW = 320/(2*2) = 80, halfViewH = 240/(2*2) = 60
			expect(camera.position.x).toBe(80);
			expect(camera.position.y).toBe(60);
		});
	});

	describe("zoom", () => {
		it("scales view transform", () => {
			const game = createGame();
			const { camera } = setupCamera(game, (c) => {
				c.zoom = 2;
			});
			game.step();

			const vt = camera.viewTransform;
			expect(vt.a).toBe(2); // scaleX
			expect(vt.d).toBe(2); // scaleY
		});

		it("pixel-perfect zoom snaps to integer", () => {
			const game = createGame();
			const { camera } = setupCamera(game, (c) => {
				c.zoom = 1.7;
				c.pixelPerfectZoom = true;
			});
			game.step();

			const vt = camera.viewTransform;
			expect(vt.a).toBe(2);
			expect(vt.d).toBe(2);
		});

		it("affects visible rect", () => {
			const game = createGame();
			const { camera } = setupCamera(game, (c) => {
				c.zoom = 2;
			});
			game.step();

			const rect = camera.visibleRect;
			// At zoom 2: visible area = 320/2 x 240/2 = 160x120
			expect(rect.width).toBe(160);
			expect(rect.height).toBe(120);
		});
	});

	describe("dead zone", () => {
		it("doesn't move camera when target is inside dead zone", () => {
			const game = createGame();
			const { camera } = setupCamera(game, (c, t) => {
				c.follow = t;
				c.smoothing = 0;
				// Big dead zone: target at 100,50 will be inside
				c.deadZone = new Rect(-200, -200, 400, 400);
			});

			// Camera starts at (0,0), target at (100,50)
			// Dead zone spans -200 to +200 in world, so target is inside
			game.step();
			expect(camera.position.x).toBe(0);
			expect(camera.position.y).toBe(0);
		});

		it("moves camera when target exits dead zone", () => {
			const game = createGame();
			const { camera } = setupCamera(game, (c, t) => {
				c.follow = t;
				c.smoothing = 0;
				c.deadZone = new Rect(-20, -20, 40, 40);
			});

			// Target at (100,50), dead zone is +-20 pixels in world
			// dx = 100 > 20 (dzRight), so camera moves
			game.step();
			expect(camera.position.x).toBeGreaterThan(0);
		});
	});

	describe("shake", () => {
		it("applies shake offset", () => {
			const game = createGame();
			const { camera } = setupCamera(game, (c) => {
				c.shake(10, 0.5);
			});
			game.step();

			// Shake should produce non-zero offset in the view transform
			// Camera position stays at 0,0 but viewTransform includes shake
			expect(camera.isShaking).toBe(true);
		});

		it("decays over duration", () => {
			const game = createGame();
			const { camera } = setupCamera(game, (c) => {
				c.shake(10, 0.1); // Short duration
			});

			// Step enough frames to exceed duration
			for (let i = 0; i < 10; i++) game.step();

			expect(camera.isShaking).toBe(false);
		});

		it("emits shakeFinished signal", () => {
			const game = createGame();
			let finished = false;
			setupCamera(game, (c) => {
				c.shake(10, 0.05);
				c.shakeFinished.connect(() => {
					finished = true;
				});
			});

			for (let i = 0; i < 20; i++) game.step();

			expect(finished).toBe(true);
		});

		it("produces deterministic shake with same seed", () => {
			// Create two games with same seed
			const game1 = createGame();
			const game2 = new Game({
				width: 320,
				height: 240,
				canvas: document.createElement("canvas"),
				renderer: null,
				seed: 42,
			});

			const { camera: cam1 } = setupCamera(game1, (c) => {
				c.shake(10, 1);
			});
			const { camera: cam2 } = setupCamera(game2, (c) => {
				c.shake(10, 1);
			});

			game1.step();
			game2.step();

			expect(cam1.viewTransform.e).toBe(cam2.viewTransform.e);
			expect(cam1.viewTransform.f).toBe(cam2.viewTransform.f);
		});
	});

	describe("view transform", () => {
		it("is identity when camera is at origin with zoom=1", () => {
			const game = createGame();
			const { camera } = setupCamera(game);
			game.step();

			const vt = camera.viewTransform;
			// Camera at (0,0), zoom=1: T(160,120) * S(1) * T(0,0)
			// = Matrix2D(1, 0, 0, 1, 160, 120)
			expect(vt.a).toBe(1);
			expect(vt.d).toBe(1);
			expect(vt.e).toBe(160); // hw
			expect(vt.f).toBe(120); // hh
		});

		it("translates for camera position", () => {
			const game = createGame();
			const { camera } = setupCamera(game);
			camera.position.x = 100;
			camera.position.y = 50;
			game.step();

			const vt = camera.viewTransform;
			// e = -100 * 1 + 160 = 60
			// f = -50 * 1 + 120 = 70
			expect(vt.e).toBe(60);
			expect(vt.f).toBe(70);
		});

		it("scales for zoom", () => {
			const game = createGame();
			const { camera } = setupCamera(game);
			camera.zoom = 2;
			game.step();

			const vt = camera.viewTransform;
			// a = 2, d = 2
			// e = -0 * 2 + 160 = 160
			expect(vt.a).toBe(2);
			expect(vt.d).toBe(2);
		});

		it("composes position and zoom correctly", () => {
			const game = createGame();
			const { camera } = setupCamera(game);
			camera.position.x = 100;
			camera.position.y = 50;
			camera.zoom = 2;
			game.step();

			const vt = camera.viewTransform;
			// e = -100 * 2 + 160 = -40
			// f = -50 * 2 + 120 = 20
			expect(vt.a).toBe(2);
			expect(vt.e).toBe(-40);
			expect(vt.f).toBe(20);
		});

		it("sets scene.viewTransform on update", () => {
			const game = createGame();
			const { camera } = setupCamera(game, (c) => {
				c.position.x = 50;
			});
			game.step();

			const scene = game.currentScene;
			expect(scene?.viewTransform.e).toBe(camera.viewTransform.e);
		});
	});

	describe("coordinate conversion", () => {
		it("screenToWorld converts correctly", () => {
			const game = createGame();
			const { camera } = setupCamera(game);
			camera.position.x = 100;
			camera.position.y = 50;
			game.step();

			// Screen center (160, 120) should map to camera position (100, 50)
			const world = camera.screenToWorld(new Vec2(160, 120));
			expect(world.x).toBeCloseTo(100);
			expect(world.y).toBeCloseTo(50);
		});

		it("worldToScreen converts correctly", () => {
			const game = createGame();
			const { camera } = setupCamera(game);
			camera.position.x = 100;
			camera.position.y = 50;
			game.step();

			// Camera position should map to screen center
			const screen = camera.worldToScreen(new Vec2(100, 50));
			expect(screen.x).toBeCloseTo(160);
			expect(screen.y).toBeCloseTo(120);
		});

		it("round-trip conversion is identity", () => {
			const game = createGame();
			const { camera } = setupCamera(game);
			camera.position.x = 100;
			camera.position.y = 50;
			camera.zoom = 2;
			game.step();

			const original = new Vec2(200, 100);
			const roundTrip = camera.screenToWorld(camera.worldToScreen(original));
			expect(roundTrip.x).toBeCloseTo(200, 5);
			expect(roundTrip.y).toBeCloseTo(100, 5);
		});

		it("handles zoom in coordinate conversion", () => {
			const game = createGame();
			const { camera } = setupCamera(game);
			camera.zoom = 2;
			game.step();

			// Screen (0, 0) at zoom 2: should map to (-80, -60) in world
			const world = camera.screenToWorld(new Vec2(0, 0));
			expect(world.x).toBeCloseTo(-80);
			expect(world.y).toBeCloseTo(-60);
		});
	});

	describe("visible rect", () => {
		it("returns correct rect at zoom=1", () => {
			const game = createGame();
			const { camera } = setupCamera(game);
			game.step();

			const rect = camera.visibleRect;
			expect(rect.x).toBe(-160);
			expect(rect.y).toBe(-120);
			expect(rect.width).toBe(320);
			expect(rect.height).toBe(240);
		});

		it("halves at zoom=2", () => {
			const game = createGame();
			const { camera } = setupCamera(game);
			camera.zoom = 2;
			game.step();

			const rect = camera.visibleRect;
			expect(rect.width).toBe(160);
			expect(rect.height).toBe(120);
		});
	});

	describe("serialize", () => {
		it("includes camera state in snapshot", () => {
			const game = createGame();
			const { camera, target } = setupCamera(game, (c, t) => {
				c.follow = t;
				c.smoothing = 0;
				c.zoom = 2;
				c.bounds = new Rect(0, 0, 2000, 2000);
			});
			target.name = "Target";
			game.step();

			const snap = camera.serialize();
			expect(snap.type).toBe("Camera");
			expect(snap.position.x).toBe(100);
			expect(snap.position.y).toBe(60); // clamped: halfViewH = 240/(2*2) = 60
			expect(snap.zoom).toBe(2);
			expect(snap.smoothing).toBe(0);
			expect(snap.followTarget).toBe("Target");
			expect(snap.bounds).toEqual({ x: 0, y: 0, width: 2000, height: 2000 });
			expect(snap.isShaking).toBe(false);
			expect(snap.deadZone).toBeNull();
			expect(snap.pixelPerfectZoom).toBe(false);
		});

		it("includes follow target name when set", () => {
			const game = createGame();
			const { camera, target } = setupCamera(game, (c, t) => {
				c.follow = t;
				c.smoothing = 0;
			});
			target.name = "Player";
			game.step();

			const snap = camera.serialize();
			expect(snap.followTarget).toBe("Player");
		});

		it("shows null followTarget when no follow", () => {
			const game = createGame();
			const { camera } = setupCamera(game);
			game.step();

			const snap = camera.serialize();
			expect(snap.followTarget).toBeNull();
		});

		it("shows shaking state", () => {
			const game = createGame();
			const { camera } = setupCamera(game, (c) => {
				c.shake(10, 1);
			});
			game.step();

			const snap = camera.serialize();
			expect(snap.isShaking).toBe(true);
		});
	});
});
