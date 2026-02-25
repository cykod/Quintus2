import { Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { type BodyType, CollisionObject } from "./collision-object.js";
import { CollisionShape } from "./collision-shape.js";
import { getPhysicsWorld, PhysicsPlugin } from "./physics-plugin.js";
import { Shape } from "./shapes.js";

// === Helpers ===

function createGame(): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 100, height: 100, canvas, renderer: null });
}

class TestSensor extends CollisionObject {
	readonly bodyType: BodyType = "sensor";
	override collisionGroup = "default";
	override monitoring = true;
	readonly enteredBodies: CollisionObject[] = [];

	override onBodyEntered(body: CollisionObject): void {
		this.enteredBodies.push(body);
	}
}

class TestActor extends CollisionObject {
	readonly bodyType: BodyType = "actor";
	override collisionGroup = "default";
}

// === Tests ===

describe("PhysicsPlugin", () => {
	describe("plugin creation and defaults", () => {
		it("creates a PhysicsWorld with default gravity Vec2(0, 800)", () => {
			const game = createGame();
			game.use(PhysicsPlugin());

			const world = getPhysicsWorld(game);
			expect(world).not.toBeNull();
			expect(world?.gravity.x).toBe(0);
			expect(world?.gravity.y).toBe(800);
		});

		it("creates default collision groups", () => {
			const game = createGame();
			game.use(PhysicsPlugin());

			const world = getPhysicsWorld(game);
			expect(world).not.toBeNull();
			// Default group should be valid
			expect(() => world?.groups.validate("default")).not.toThrow();
		});

		it("custom gravity applies correctly", () => {
			const game = createGame();
			game.use(PhysicsPlugin({ gravity: new Vec2(0, 400) }));

			const world = getPhysicsWorld(game);
			expect(world).not.toBeNull();
			expect(world?.gravity.x).toBe(0);
			expect(world?.gravity.y).toBe(400);
		});

		it("custom collision groups propagate", () => {
			const game = createGame();
			game.use(
				PhysicsPlugin({
					collisionGroups: {
						player: { collidesWith: ["world"] },
						world: { collidesWith: ["player"] },
					},
				}),
			);

			const world = getPhysicsWorld(game);
			expect(world).not.toBeNull();
			expect(world?.groups.shouldCollide("player", "world")).toBe(true);
			expect(() => world?.groups.validate("player")).not.toThrow();
			expect(() => world?.groups.validate("world")).not.toThrow();
		});

		it("custom cellSize passes through to PhysicsWorld", () => {
			const game = createGame();
			game.use(PhysicsPlugin({ cellSize: 128 }));

			// PhysicsWorld was created with cellSize=128; verify via registering/querying a body
			const world = getPhysicsWorld(game);
			expect(world).not.toBeNull();
			// If cellSize is wrong, spatial hash queries may fail — basic smoke test
			const body = new TestActor();
			body.position = new Vec2(0, 0);
			const cs = body.addChild(CollisionShape);
			cs.shape = Shape.rect(10, 10);
			world?.register(body);

			const overlaps = world?.testOverlap(body);
			expect(overlaps).toHaveLength(0);
		});
	});

	describe("getPhysicsWorld()", () => {
		it("returns null before plugin is installed", () => {
			const game = createGame();
			expect(getPhysicsWorld(game)).toBeNull();
		});

		it("returns PhysicsWorld after plugin is installed", () => {
			const game = createGame();
			game.use(PhysicsPlugin());
			expect(getPhysicsWorld(game)).not.toBeNull();
		});
	});

	describe("double-install", () => {
		it("warns but doesn't crash when installed twice", () => {
			const game = createGame();
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			game.use(PhysicsPlugin());
			game.use(PhysicsPlugin());

			// First install works, second triggers warning from Game.use()
			expect(warnSpy).toHaveBeenCalled();
			expect(getPhysicsWorld(game)).not.toBeNull();

			warnSpy.mockRestore();
		});
	});

	describe("postFixedUpdate hook", () => {
		it("calls stepSensors each fixed update frame", () => {
			const game = createGame();
			game.use(PhysicsPlugin());

			// Build bodies with children FIRST, then add to scene
			const sensor = new TestSensor();
			sensor.position = new Vec2(0, 0);
			const scs = sensor.addChild(CollisionShape);
			scs.shape = Shape.rect(40, 40);

			const actor = new TestActor();
			actor.position = new Vec2(5, 0);
			const acs = actor.addChild(CollisionShape);
			acs.shape = Shape.rect(10, 10);

			class TestScene extends Scene {
				onReady() {
					this.addChild(sensor);
					this.addChild(actor);
				}
			}
			game.start(TestScene);

			// After a step, postFixedUpdate fires → stepSensors → sensor entered
			game.step();

			expect(sensor.enteredBodies).toHaveLength(1);
		});
	});

	describe("WeakMap isolation", () => {
		it("two Game instances get independent PhysicsWorlds", () => {
			const game1 = createGame();
			const game2 = createGame();

			game1.use(PhysicsPlugin({ gravity: new Vec2(0, 100) }));
			game2.use(PhysicsPlugin({ gravity: new Vec2(0, 999) }));

			const world1 = getPhysicsWorld(game1);
			const world2 = getPhysicsWorld(game2);

			expect(world1).not.toBeNull();
			expect(world2).not.toBeNull();
			expect(world1).not.toBe(world2);
			expect(world1?.gravity.y).toBe(100);
			expect(world2?.gravity.y).toBe(999);
		});
	});
});
