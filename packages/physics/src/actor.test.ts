import { Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { Actor } from "./actor.js";
import type { CollisionInfo } from "./collision-info.js";
import { CollisionShape } from "./collision-shape.js";
import { getPhysicsWorld, PhysicsPlugin } from "./physics-plugin.js";
import { Shape } from "./shapes.js";
import { StaticCollider } from "./static-collider.js";

// === Helpers ===

function createGame(): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null });
}

/** Set up a game with physics, add bodies to scene, start it. */
function setupScene(
	bodies: import("@quintus/core").Node[],
	gravity?: Vec2,
): { game: Game; world: ReturnType<typeof getPhysicsWorld> } {
	const game = createGame();
	game.use(PhysicsPlugin({ gravity }));
	class TestScene extends Scene {
		onReady() {
			for (const body of bodies) this.addChild(body);
		}
	}
	game.start(TestScene);
	return { game, world: getPhysicsWorld(game) };
}

function makeActor(pos: Vec2, w = 10, h = 10): Actor {
	const actor = new Actor();
	actor.position = pos;
	const cs = actor.addChild(CollisionShape);
	cs.shape = Shape.rect(w, h);
	return actor;
}

function makeStatic(pos: Vec2, w = 200, h = 20): StaticCollider {
	const sc = new StaticCollider();
	sc.position = pos;
	const cs = sc.addChild(CollisionShape);
	cs.shape = Shape.rect(w, h);
	return sc;
}

// === Tests ===

describe("Actor", () => {
	describe("gravity", () => {
		it("defaults to PhysicsWorld gravity.y in onReady()", () => {
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor], new Vec2(0, 600));
			expect(actor.gravity).toBe(600);
		});

		it("defaults to 800 with default PhysicsPlugin config", () => {
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor]);
			expect(actor.gravity).toBe(800);
		});

		it("applies gravity when applyGravity = true", () => {
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor]);
			actor.velocity = new Vec2(0, 0);
			actor.move(0.1);
			// velocity.y should have increased by gravity * dt = 800 * 0.1 = 80
			// Position should have moved down
			expect(actor.position.y).toBeGreaterThan(0);
		});

		it("does not apply gravity when applyGravity = false", () => {
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor]);
			actor.applyGravity = false;
			actor.velocity = new Vec2(100, 0);
			actor.move(0.1);
			// Should only move horizontally
			expect(actor.position.x).toBeCloseTo(10, 0);
			expect(actor.position.y).toBeCloseTo(0);
		});

		it("floor snap: on floor, velocity.y stays small (no phantom accumulation)", () => {
			const actor = makeActor(new Vec2(100, 80));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			// First move: actor falls onto floor
			actor.velocity = new Vec2(0, 200);
			actor.move(0.1);
			expect(actor.isOnFloor()).toBe(true);

			// Second move: on floor, gravity should snap to small constant
			const velBefore = actor.velocity.y;
			actor.move(0.1);
			// velocity.y should be small (floor snap gravity), not accumulating
			expect(actor.velocity.y).toBeLessThan(10);
		});
	});

	describe("move() — no collision", () => {
		it("position updates by velocity * dt", () => {
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor]);
			actor.applyGravity = false;
			actor.velocity = new Vec2(100, 50);
			actor.move(0.1);
			expect(actor.position.x).toBeCloseTo(10, 0);
			expect(actor.position.y).toBeCloseTo(5, 0);
		});
	});

	describe("move() — floor collision", () => {
		it("stops on floor, isOnFloor() true", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);

			expect(actor.isOnFloor()).toBe(true);
			// Actor should be near the floor, not past it
			expect(actor.position.y).toBeLessThan(100);
			expect(actor.position.y).toBeGreaterThan(50);
		});

		it("velocity zeroed into floor surface", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.velocity = new Vec2(100, 300);
			actor.move(0.5);

			// Y velocity should be zeroed (into floor)
			expect(Math.abs(actor.velocity.y)).toBeLessThan(2);
			// X velocity preserved
			expect(actor.velocity.x).toBeCloseTo(100, 0);
		});
	});

	describe("move() — wall collision", () => {
		it("slides along wall, isOnWall() true", () => {
			const actor = makeActor(new Vec2(0, 100));
			const wall = makeStatic(new Vec2(50, 100), 20, 200);
			setupScene([actor, wall]);

			actor.applyGravity = false;
			actor.velocity = new Vec2(200, 50);
			actor.move(0.5);

			expect(actor.isOnWall()).toBe(true);
			// Should have slid vertically
			expect(actor.position.y).toBeGreaterThan(100);
			// Should be near the wall, not past it
			expect(actor.position.x).toBeLessThan(50);
		});
	});

	describe("move() — ceiling collision", () => {
		it("isOnCeiling() true when hitting ceiling", () => {
			const actor = makeActor(new Vec2(100, 50));
			const ceiling = makeStatic(new Vec2(100, 10));
			setupScene([actor, ceiling]);

			actor.applyGravity = false;
			actor.velocity = new Vec2(0, -300);
			actor.move(0.5);

			expect(actor.isOnCeiling()).toBe(true);
		});
	});

	describe("moveAndCollide()", () => {
		it("returns first collision, no sliding", () => {
			const actor = makeActor(new Vec2(0, 0));
			const wall = makeStatic(new Vec2(50, 0), 20, 20);
			setupScene([actor, wall]);

			const result = actor.moveAndCollide(new Vec2(100, 0));
			expect(result).not.toBeNull();
			expect(result!.collider).toBe(wall);
			expect(actor.position.x).toBeLessThan(50);
			expect(actor.position.x).toBeGreaterThan(0);
		});

		it("returns null when no collision", () => {
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor]);

			const result = actor.moveAndCollide(new Vec2(100, 0));
			expect(result).toBeNull();
			expect(actor.position.x).toBeCloseTo(100, 0);
		});
	});

	describe("getSlideCollisions()", () => {
		it("contains all collisions from last move()", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);

			expect(actor.getSlideCollisions().length).toBeGreaterThanOrEqual(1);
			expect(actor.getSlideCollisions()[0]!.collider).toBe(floor);
		});

		it("is cleared on each move() call", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);
			expect(actor.getSlideCollisions().length).toBeGreaterThanOrEqual(1);

			// Move away from floor
			actor.applyGravity = false;
			actor.velocity = new Vec2(0, -10);
			actor.move(0.01);
			expect(actor.getSlideCollisions().length).toBe(0);
		});
	});

	describe("collided signal", () => {
		it("fires for each collision", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			const collisions: CollisionInfo[] = [];
			actor.collided.connect((info) => collisions.push(info));

			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);

			expect(collisions.length).toBeGreaterThanOrEqual(1);
			expect(collisions[0]!.collider).toBe(floor);
		});
	});

	describe("floor detection angles", () => {
		it("slope within floorMaxAngle is floor", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			// Default floorMaxAngle = PI/4 (45 deg)
			// Normal straight up (0, -1) is a floor (angle = 0)
			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);
			expect(actor.isOnFloor()).toBe(true);
		});

		it("upDirection = Vec2.ZERO means no floor concept", () => {
			const actor = makeActor(new Vec2(100, 50));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.upDirection = new Vec2(0, 0);
			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);

			// No floor/wall/ceiling when upDirection is zero
			expect(actor.isOnFloor()).toBe(false);
			expect(actor.isOnWall()).toBe(false);
			expect(actor.isOnCeiling()).toBe(false);
		});
	});

	describe("maxSlides", () => {
		it("maxSlides = 1 stops at first collision, no slide", () => {
			const actor = makeActor(new Vec2(0, 0));
			const wall = makeStatic(new Vec2(50, 0), 20, 200);
			setupScene([actor, wall]);

			actor.applyGravity = false;
			actor.maxSlides = 1;
			actor.velocity = new Vec2(200, 50);
			actor.move(0.5);

			// Should stop at wall, not slide vertically
			expect(actor.getSlideCollisions().length).toBe(1);
		});
	});

	describe("actor vs actor", () => {
		it("actors do not collide with other actors", () => {
			const actor1 = makeActor(new Vec2(0, 0));
			const actor2 = makeActor(new Vec2(30, 0));
			setupScene([actor1, actor2]);

			actor1.applyGravity = false;
			actor1.velocity = new Vec2(200, 0);
			actor1.move(0.5);

			// actor1 should pass through actor2
			expect(actor1.position.x).toBeCloseTo(100, 0);
			expect(actor1.getSlideCollisions().length).toBe(0);
		});
	});

	describe("signal cleanup", () => {
		it("disconnects collided signal on destroy", () => {
			const actor = makeActor(new Vec2(0, 0));
			const { game } = setupScene([actor]);

			const handler = vi.fn();
			actor.collided.connect(handler);
			expect(actor.collided.hasListeners).toBe(true);

			actor.destroy();
			game.step();

			expect(actor.collided.hasListeners).toBe(false);
		});
	});

	describe("batched displacement", () => {
		it("position is written once per move() (totalDisplacement pattern)", () => {
			// Verify that move() works correctly with the batched displacement approach
			// by checking the final position is consistent with velocity * dt
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor]);

			actor.applyGravity = false;
			actor.velocity = new Vec2(100, 0);
			const startX = actor.position.x;
			actor.move(0.1);

			// Should have moved exactly velocity * dt = 100 * 0.1 = 10
			expect(actor.position.x - startX).toBeCloseTo(10, 1);
		});
	});

	describe("getFloorNormal / getWallNormal", () => {
		it("getFloorNormal returns floor normal when on floor", () => {
			const actor = makeActor(new Vec2(100, 80));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.velocity = new Vec2(0, 200);
			actor.move(0.1);

			expect(actor.isOnFloor()).toBe(true);
			const fn = actor.getFloorNormal();
			// Floor normal should point up (approximately)
			expect(fn.y).toBeLessThan(0);
		});

		it("getWallNormal returns wall normal when on wall", () => {
			const actor = makeActor(new Vec2(0, 100));
			const wall = makeStatic(new Vec2(50, 100), 20, 200);
			setupScene([actor, wall]);

			actor.applyGravity = false;
			actor.velocity = new Vec2(200, 0);
			actor.move(0.5);

			expect(actor.isOnWall()).toBe(true);
			const wn = actor.getWallNormal();
			// Wall normal should point left (away from wall)
			expect(wn.x).toBeLessThan(0);
		});
	});

	describe("getFloorCollider", () => {
		it("returns the floor collider when on floor", () => {
			const actor = makeActor(new Vec2(100, 80));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			actor.velocity = new Vec2(0, 200);
			actor.move(0.1);

			expect(actor.getFloorCollider()).toBe(floor);
		});

		it("returns null when not on floor", () => {
			const actor = makeActor(new Vec2(0, 0));
			setupScene([actor]);

			actor.applyGravity = false;
			actor.velocity = new Vec2(100, 0);
			actor.move(0.1);

			expect(actor.getFloorCollider()).toBeNull();
		});
	});

	describe("move/moveAndCollide without physics world", () => {
		it("move() is a no-op when no physics world is attached", () => {
			const actor = new Actor();
			actor.position = new Vec2(10, 20);
			actor.velocity = new Vec2(100, 0);
			// Not added to any scene with physics — _getWorld() returns null
			actor.move(0.1);
			// Position should be unchanged
			expect(actor.position.x).toBe(10);
			expect(actor.position.y).toBe(20);
		});

		it("moveAndCollide() returns null when no physics world is attached", () => {
			const actor = new Actor();
			actor.position = new Vec2(10, 20);
			const result = actor.moveAndCollide(new Vec2(100, 0));
			expect(result).toBeNull();
			// Position should be unchanged
			expect(actor.position.x).toBe(10);
			expect(actor.position.y).toBe(20);
		});
	});

	describe("floor snap preserves jump velocity", () => {
		it("negative velocity.y is preserved on floor (allows jumping)", () => {
			const actor = makeActor(new Vec2(100, 80));
			const floor = makeStatic(new Vec2(100, 100));
			setupScene([actor, floor]);

			// Land on floor
			actor.velocity = new Vec2(0, 200);
			actor.move(0.1);
			expect(actor.isOnFloor()).toBe(true);

			// Set negative (upward) velocity to simulate jump
			actor.velocity.y = -400;
			actor.move(1 / 60);
			// Should not snap to floor — velocity.y should stay negative
			expect(actor.velocity.y).toBeLessThan(0);
		});
	});
});
