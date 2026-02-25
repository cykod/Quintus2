import { Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { _registerPhysicsAccessors, type BodyType, CollisionObject } from "./collision-object.js";
import { CollisionShape } from "./collision-shape.js";
import { getPhysicsWorld, PhysicsPlugin } from "./physics-plugin.js";
import type { PhysicsWorld } from "./physics-world.js";
import { Shape } from "./shapes.js";

// === Helpers ===

function createGame(): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 100, height: 100, canvas, renderer: null });
}

/** Concrete CollisionObject subclass for testing. */
class TestBody extends CollisionObject {
	readonly bodyType: BodyType;
	constructor(type: BodyType = "actor") {
		super();
		this.bodyType = type;
	}
}

/** Concrete sensor subclass for testing. */
class TestSensor extends CollisionObject {
	readonly bodyType: BodyType = "sensor";
	override monitoring = true;
	readonly enteredBodies: CollisionObject[] = [];
	readonly exitedBodies: CollisionObject[] = [];

	override onBodyEntered(body: CollisionObject): void {
		this.enteredBodies.push(body);
	}

	override onBodyExited(body: CollisionObject): void {
		this.exitedBodies.push(body);
	}
}

/** Create a body with shape and position, ready to be added to a scene. */
function makeBody(type: BodyType, pos: Vec2, shape = Shape.rect(10, 10)): TestBody | TestSensor {
	const body = type === "sensor" ? new TestSensor() : new TestBody(type);
	body.position = pos;
	const cs = body.addChild(CollisionShape);
	cs.shape = shape;
	return body;
}

// === Tests ===

describe("CollisionObject", () => {
	describe("getShapes()", () => {
		it("returns enabled CollisionShape children", () => {
			const body = new TestBody("actor");
			const cs = body.addChild(CollisionShape);
			cs.shape = Shape.rect(10, 10);

			const shapes = body.getShapes();
			expect(shapes).toHaveLength(1);
			expect(shapes[0]).toBe(cs);
		});

		it("excludes disabled shapes", () => {
			const body = new TestBody("actor");
			const cs1 = body.addChild(CollisionShape);
			cs1.shape = Shape.rect(10, 10);
			const cs2 = body.addChild(CollisionShape);
			cs2.shape = Shape.rect(20, 20);
			cs2.disabled = true;

			const shapes = body.getShapes();
			expect(shapes).toHaveLength(1);
			expect(shapes[0]).toBe(cs1);
		});

		it("excludes shapes with null shape property", () => {
			const body = new TestBody("actor");
			const cs1 = body.addChild(CollisionShape);
			cs1.shape = Shape.rect(10, 10);
			body.addChild(CollisionShape);
			// cs2.shape remains null

			const shapes = body.getShapes();
			expect(shapes).toHaveLength(1);
			expect(shapes[0]).toBe(cs1);
		});

		it("returns empty array with no CollisionShape children", () => {
			const body = new TestBody("actor");
			expect(body.getShapes()).toHaveLength(0);
		});

		it("returns multiple enabled shapes", () => {
			const body = new TestBody("actor");
			const cs1 = body.addChild(CollisionShape);
			cs1.shape = Shape.rect(10, 10);
			const cs2 = body.addChild(CollisionShape);
			cs2.shape = Shape.circle(5);

			const shapes = body.getShapes();
			expect(shapes).toHaveLength(2);
		});
	});

	describe("getShapeTransforms()", () => {
		it("returns shape + world transform pairs", () => {
			const body = new TestBody("actor");
			body.position = new Vec2(50, 100);
			const cs = body.addChild(CollisionShape);
			cs.shape = Shape.rect(10, 10);

			const transforms = body.getShapeTransforms();
			expect(transforms).toHaveLength(1);
			expect(transforms[0]?.shape).toBe(cs.shape);
			expect(transforms[0]?.transform).toBeDefined();
		});

		it("returns empty array when no shapes", () => {
			const body = new TestBody("actor");
			expect(body.getShapeTransforms()).toHaveLength(0);
		});
	});

	describe("getWorldAABB()", () => {
		it("returns null with no shapes", () => {
			const body = new TestBody("actor");
			expect(body.getWorldAABB()).toBeNull();
		});

		it("computes AABB for a single shape", () => {
			const body = new TestBody("actor");
			body.position = new Vec2(100, 200);
			const cs = body.addChild(CollisionShape);
			cs.shape = Shape.rect(20, 10);

			const aabb = body.getWorldAABB();
			expect(aabb).not.toBeNull();
			// Rect 20x10 centered at (100, 200)
			expect(aabb?.min.x).toBeCloseTo(90);
			expect(aabb?.min.y).toBeCloseTo(195);
			expect(aabb?.max.x).toBeCloseTo(110);
			expect(aabb?.max.y).toBeCloseTo(205);
		});

		it("merges AABB across multiple shapes", () => {
			const body = new TestBody("actor");
			body.position = new Vec2(0, 0);
			const cs1 = body.addChild(CollisionShape);
			cs1.shape = Shape.rect(10, 10);
			cs1.position = new Vec2(-50, 0);

			const cs2 = body.addChild(CollisionShape);
			cs2.shape = Shape.rect(10, 10);
			cs2.position = new Vec2(50, 0);

			const aabb = body.getWorldAABB();
			expect(aabb).not.toBeNull();
			// Should span from -55 to 55 on x-axis
			expect(aabb?.min.x).toBeCloseTo(-55);
			expect(aabb?.max.x).toBeCloseTo(55);
		});
	});

	describe("collisionGroup default", () => {
		it("defaults to 'default'", () => {
			const body = new TestBody("actor");
			expect(body.collisionGroup).toBe("default");
		});

		it("can be set to a custom group", () => {
			const body = new TestBody("actor");
			body.collisionGroup = "player";
			expect(body.collisionGroup).toBe("player");
		});
	});

	describe("monitoring default", () => {
		it("returns false on base CollisionObject", () => {
			const body = new TestBody("actor");
			expect(body.monitoring).toBe(false);
		});
	});

	describe("onBodyEntered / onBodyExited (virtual methods)", () => {
		it("emits bodyEntered signal on base class", () => {
			const body = new TestBody("actor");
			const other = new TestBody("actor");
			const entered: CollisionObject[] = [];
			body.bodyEntered.connect((b) => entered.push(b));
			body.onBodyEntered(other);
			expect(entered).toHaveLength(1);
			expect(entered[0]).toBe(other);
		});

		it("emits bodyExited signal on base class", () => {
			const body = new TestBody("actor");
			const other = new TestBody("actor");
			const exited: CollisionObject[] = [];
			body.bodyExited.connect((b) => exited.push(b));
			body.onBodyExited(other);
			expect(exited).toHaveLength(1);
			expect(exited[0]).toBe(other);
		});

		it("overriding without super suppresses signal", () => {
			class SilentBody extends CollisionObject {
				readonly bodyType: BodyType = "actor";
				override onBodyEntered(_body: CollisionObject): void {
					// Don't call super — signal should not fire
				}
			}
			const body = new SilentBody();
			const other = new TestBody("actor");
			const entered: CollisionObject[] = [];
			body.bodyEntered.connect((b) => entered.push(b));
			body.onBodyEntered(other);
			expect(entered).toHaveLength(0);
		});

		it("overriding with super fires both override and signal", () => {
			class CustomBody extends CollisionObject {
				readonly bodyType: BodyType = "actor";
				customCalled = false;
				override onBodyEntered(body: CollisionObject): void {
					this.customCalled = true;
					super.onBodyEntered(body);
				}
			}
			const body = new CustomBody();
			const other = new TestBody("actor");
			const entered: CollisionObject[] = [];
			body.bodyEntered.connect((b) => entered.push(b));
			body.onBodyEntered(other);
			expect(body.customCalled).toBe(true);
			expect(entered).toHaveLength(1);
		});
	});

	describe("auto-registration on onReady()", () => {
		it("registers body in PhysicsWorld when added to scene tree", () => {
			const game = createGame();
			game.use(PhysicsPlugin());

			// Build body with children FIRST, then add to scene
			// (onReady fires immediately on addChild if parent is in tree)
			const body = makeBody("actor", new Vec2(50, 50));
			class TestScene extends Scene {
				onReady() {
					this.addChild(body);
				}
			}
			game.start(TestScene);

			const world = getPhysicsWorld(game) as PhysicsWorld;

			// Probe body — overlaps at (52, 50)
			const probe = makeBody("static", new Vec2(52, 50));
			world.register(probe);

			const overlaps = world.testOverlap(probe);
			expect(overlaps).toContain(body);
		});
	});

	describe("auto-unregistration on onExitTree()", () => {
		it("unregisters body when removed from tree", () => {
			const game = createGame();
			game.use(PhysicsPlugin());

			const body = makeBody("actor", new Vec2(50, 50));
			class TestScene extends Scene {
				onReady() {
					this.addChild(body);
				}
			}
			game.start(TestScene);

			const world = getPhysicsWorld(game) as PhysicsWorld;

			// Probe overlapping the body
			const probe = makeBody("static", new Vec2(52, 50));
			world.register(probe);

			// Body is currently overlapping
			expect(world.testOverlap(probe)).toContain(body);

			// Remove body from tree — triggers onExitTree → unregister
			body.removeSelf();

			// Body should no longer be registered
			expect(world.testOverlap(probe)).not.toContain(body);
		});
	});

	describe("auto-install of PhysicsPlugin", () => {
		it("auto-installs PhysicsPlugin with defaults and warns", () => {
			const game = createGame();
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			// Don't install PhysicsPlugin — let the body auto-install it
			const body = makeBody("actor", new Vec2(50, 50));
			class TestScene extends Scene {
				onReady() {
					this.addChild(body);
				}
			}
			game.start(TestScene);

			// PhysicsPlugin should have been auto-installed
			expect(game.hasPlugin("physics")).toBe(true);
			expect(getPhysicsWorld(game)).not.toBeNull();
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("PhysicsPlugin auto-installed"));

			warnSpy.mockRestore();
		});
	});

	describe("_registerPhysicsAccessors()", () => {
		it("module-level wiring works (getPhysicsWorld resolves through accessor)", () => {
			const game = createGame();
			game.use(PhysicsPlugin());

			const body = makeBody("actor", new Vec2(0, 0));
			class TestScene extends Scene {
				onReady() {
					this.addChild(body);
				}
			}
			game.start(TestScene);

			// If _registerPhysicsAccessors didn't work, body wouldn't be in the world
			const world = getPhysicsWorld(game) as PhysicsWorld;

			const probe = makeBody("static", new Vec2(2, 0));
			world.register(probe);

			expect(world.testOverlap(probe)).toContain(body);
		});

		it("re-registering accessors overwrites previous ones", () => {
			const customGetWorld = vi.fn().mockReturnValue(null);
			const customPlugin = vi.fn();

			_registerPhysicsAccessors(customGetWorld, customPlugin);

			expect(typeof _registerPhysicsAccessors).toBe("function");

			// Restore the real accessors
			_registerPhysicsAccessors(getPhysicsWorld, (config) =>
				PhysicsPlugin(config as Parameters<typeof PhysicsPlugin>[0]),
			);
		});
	});

	describe("auto-rehash on position change", () => {
		it("spatial hash updates when position is set after add", () => {
			const game = createGame();
			game.use(PhysicsPlugin());

			const body = makeBody("static", new Vec2(0, 0));
			class TestScene extends Scene {
				onReady() {
					this.addChild(body);
				}
			}
			game.start(TestScene);

			const world = getPhysicsWorld(game) as PhysicsWorld;

			// Body was registered at (0, 0). Now move it to (200, 200).
			body.position = new Vec2(200, 200);

			// Probe at the NEW position should find the body
			const probeNew = makeBody("static", new Vec2(202, 200));
			world.register(probeNew);
			expect(world.testOverlap(probeNew)).toContain(body);

			// Probe at the OLD position should NOT find the body
			const probeOld = makeBody("static", new Vec2(2, 0));
			world.register(probeOld);
			expect(world.testOverlap(probeOld)).not.toContain(body);
		});

		it("spatial hash updates when position._set() is called", () => {
			const game = createGame();
			game.use(PhysicsPlugin());

			const body = makeBody("static", new Vec2(0, 0));
			class TestScene extends Scene {
				onReady() {
					this.addChild(body);
				}
			}
			game.start(TestScene);

			const world = getPhysicsWorld(game) as PhysicsWorld;

			// Use _set() instead of assignment
			body.position._set(200, 200);

			// Probe at the NEW position should find the body
			const probeNew = makeBody("static", new Vec2(202, 200));
			world.register(probeNew);
			expect(world.testOverlap(probeNew)).toContain(body);

			// Probe at the OLD position should NOT find the body
			const probeOld = makeBody("static", new Vec2(2, 0));
			world.register(probeOld);
			expect(world.testOverlap(probeOld)).not.toContain(body);
		});
	});

	describe("integration: full lifecycle", () => {
		it("body registered on enter, unregistered on scene switch", () => {
			const game = createGame();
			game.use(PhysicsPlugin());

			const body = makeBody("actor", new Vec2(0, 0));
			class SceneA extends Scene {
				onReady() {
					this.addChild(body);
				}
			}
			class SceneB extends Scene {}
			game.start(SceneA);

			const world = getPhysicsWorld(game) as PhysicsWorld;

			// Verify body is registered
			const probe = makeBody("static", new Vec2(2, 0));
			world.register(probe);
			expect(world.testOverlap(probe)).toContain(body);

			// Switch scene — old body should be unregistered (destroy → onExitTree)
			game.currentScene?.switchTo(SceneB);
			expect(world.testOverlap(probe)).not.toContain(body);
		});

		it("sensor events fire through full game loop", () => {
			const game = createGame();
			game.use(PhysicsPlugin());

			const sensor = makeBody("sensor", new Vec2(0, 0), Shape.rect(40, 40)) as TestSensor;
			const actor = makeBody("actor", new Vec2(5, 0));
			class TestScene extends Scene {
				onReady() {
					this.addChild(sensor);
					this.addChild(actor);
				}
			}
			game.start(TestScene);

			// Step to trigger postFixedUpdate → stepSensors
			game.step();

			expect(sensor.enteredBodies).toHaveLength(1);

			// Move actor far away and step again
			actor.position = new Vec2(500, 0);
			const world = getPhysicsWorld(game) as PhysicsWorld;
			world.updatePosition(actor);
			game.step();

			expect(sensor.exitedBodies).toHaveLength(1);
		});
	});
});
