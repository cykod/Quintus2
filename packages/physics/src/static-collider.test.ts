import { Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { Actor } from "./actor.js";
import { CollisionShape } from "./collision-shape.js";
import { getPhysicsWorld, PhysicsPlugin } from "./physics-plugin.js";
import { Shape } from "./shapes.js";
import { StaticCollider } from "./static-collider.js";

// === Helpers ===

function setupScene(
	bodies: import("@quintus/core").Node[],
	gravity?: Vec2,
): { game: Game; world: ReturnType<typeof getPhysicsWorld> } {
	const canvas = document.createElement("canvas");
	const game = new Game({ width: 800, height: 600, canvas, renderer: null });
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
	actor.collisionGroup = "default";
	actor.solid = false;
	actor.position = pos;
	const cs = actor.addChild(CollisionShape);
	cs.shape = Shape.rect(w, h);
	return actor;
}

function makeStatic(pos: Vec2, w = 200, h = 20): StaticCollider {
	const sc = new StaticCollider();
	sc.collisionGroup = "default";
	sc.position = pos;
	const cs = sc.addChild(CollisionShape);
	cs.shape = Shape.rect(w, h);
	return sc;
}

// === Tests ===

describe("StaticCollider", () => {
	describe("basic collision", () => {
		it("actor collides with StaticCollider and stops", () => {
			const actor = makeActor(new Vec2(0, 0));
			const wall = makeStatic(new Vec2(50, 0), 20, 20);
			setupScene([actor, wall]);

			actor.applyGravity = false;
			actor.velocity = new Vec2(200, 0);
			actor.move(0.5);

			// Actor should stop before the wall
			expect(actor.position.x).toBeLessThan(50);
			expect(actor.position.x).toBeGreaterThan(0);
		});

		it("StaticCollider does not move on collision", () => {
			const actor = makeActor(new Vec2(0, 0));
			const wall = makeStatic(new Vec2(50, 0), 20, 20);
			setupScene([actor, wall]);

			actor.applyGravity = false;
			actor.velocity = new Vec2(200, 0);
			actor.move(0.5);

			expect(wall.position.x).toBe(50);
			expect(wall.position.y).toBe(0);
		});
	});

	describe("bodyType", () => {
		it("has bodyType 'static'", () => {
			const sc = new StaticCollider();
			expect(sc.bodyType).toBe("static");
		});
	});

	describe("constantVelocity — moving platforms", () => {
		it("carries actor standing on it", () => {
			const actor = makeActor(new Vec2(100, 80));
			const platform = makeStatic(new Vec2(100, 100));
			platform.constantVelocity = new Vec2(50, 0); // Moving right
			setupScene([actor, platform]);

			// Actor falls onto platform
			actor.velocity = new Vec2(0, 200);
			actor.move(0.1);
			expect(actor.isOnFloor()).toBe(true);

			// Second move: actor should be carried by platform
			const xBefore = actor.position.x;
			actor.velocity = new Vec2(0, 0);
			actor.move(0.1);

			// Actor should have moved right by platform.constantVelocity.x * dt
			expect(actor.position.x).toBeGreaterThan(xBefore);
		});

		it("moving platform carry is collision-tested (no clipping into wall)", () => {
			const actor = makeActor(new Vec2(100, 80));
			const platform = makeStatic(new Vec2(100, 100));
			platform.constantVelocity = new Vec2(500, 0); // Fast moving right
			const wall = makeStatic(new Vec2(120, 80), 20, 50);
			setupScene([actor, platform, wall]);

			// Actor falls onto platform
			actor.velocity = new Vec2(0, 200);
			actor.move(0.1);
			expect(actor.isOnFloor()).toBe(true);

			// Second move: platform carries right but wall should stop carry
			actor.velocity = new Vec2(0, 0);
			actor.move(0.1);

			// Actor should not clip through the wall
			expect(actor.position.x).toBeLessThan(120);
		});

		it("defaults to zero velocity (truly static)", () => {
			const sc = new StaticCollider();
			expect(sc.constantVelocity.x).toBe(0);
			expect(sc.constantVelocity.y).toBe(0);
		});
	});

	describe("one-way platforms", () => {
		it("actor passes through from below", () => {
			const actor = makeActor(new Vec2(100, 120));
			const platform = makeStatic(new Vec2(100, 100));
			platform.oneWay = true;
			setupScene([actor, platform]);

			// Move upward through the platform
			actor.applyGravity = false;
			actor.velocity = new Vec2(0, -300);
			actor.move(0.5);

			// Should have passed through
			expect(actor.position.y).toBeLessThan(100);
		});

		it("actor stops from above", () => {
			const actor = makeActor(new Vec2(100, 50));
			const platform = makeStatic(new Vec2(100, 100));
			platform.oneWay = true;
			setupScene([actor, platform]);

			// Fall down onto the platform
			actor.velocity = new Vec2(0, 300);
			actor.move(0.5);

			// Should stop on the platform
			expect(actor.isOnFloor()).toBe(true);
			expect(actor.position.y).toBeLessThan(100);
			expect(actor.position.y).toBeGreaterThan(50);
		});

		it("defaults to oneWay = false", () => {
			const sc = new StaticCollider();
			expect(sc.oneWay).toBe(false);
		});

		it("defaults to oneWayDirection = Vec2.UP", () => {
			const sc = new StaticCollider();
			expect(sc.oneWayDirection.x).toBe(0);
			expect(sc.oneWayDirection.y).toBe(-1);
		});
	});
});
