import { Game, type Node, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { Actor } from "./actor.js";
import "./augment.js";
import { CollisionShape } from "./collision-shape.js";
import { PhysicsPlugin } from "./physics-plugin.js";
import { Shape } from "./shapes.js";
import { StaticCollider } from "./static-collider.js";

// === Helpers ===

function createGame(): Game {
	const canvas = document.createElement("canvas");
	const game = new Game({ width: 800, height: 600, canvas, renderer: null });
	game.use(PhysicsPlugin());
	return game;
}

function startScene(game: Game, bodies: Node[]): void {
	class TestScene extends Scene {
		onReady() {
			for (const body of bodies) this.addChild(body);
		}
	}
	game.start(TestScene);
}

function makeActor(pos: Vec2, w = 20, h = 20): Actor {
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

// === Actor.raycast ===

describe("Actor.raycast", () => {
	it("casts from actor center, excludes self", () => {
		const game = createGame();
		const actor = makeActor(new Vec2(0, 0));
		const target = makeStatic(new Vec2(100, 0), 20, 20);
		startScene(game, [actor, target]);

		const hit = actor.raycast(new Vec2(1, 0));
		expect(hit).not.toBeNull();
		expect(hit?.collider).toBe(target);
		// Should not hit self even though ray starts at actor's center
	});

	it("with options filters correctly", () => {
		const game = createGame();
		const actor = makeActor(new Vec2(0, 0));
		const near = makeStatic(new Vec2(50, 0), 20, 20);
		const far = makeStatic(new Vec2(100, 0), 20, 20);
		far.tag("target");
		startScene(game, [actor, near, far]);

		const hit = actor.raycast(new Vec2(1, 0), 10000, { tags: ["target"] });
		expect(hit).not.toBeNull();
		expect(hit?.collider).toBe(far);
	});
});

// === Actor.isEdgeAhead ===

describe("Actor.isEdgeAhead", () => {
	it("returns true at platform edge", () => {
		const game = createGame();
		// Platform: center (0, 100), 200x20 → top at y=90, right edge at x=100
		// Actor: 20x20 at (90, 80) → bottom at y=90 (on platform), right edge at x=100
		const actor = makeActor(new Vec2(90, 80));
		actor.applyGravity = false;
		const platform = makeStatic(new Vec2(0, 100), 200, 20);
		startScene(game, [actor, platform]);

		const isEdge = actor.isEdgeAhead(new Vec2(1, 0));
		expect(isEdge).toBe(true);
	});

	it("returns false on continuous platform", () => {
		const game = createGame();
		// Platform: center (0, 100), 200x20 → top at y=90
		// Actor: 20x20 at (0, 79) → bottom at y=89 (just above platform top)
		const actor = makeActor(new Vec2(0, 79));
		actor.applyGravity = false;
		const platform = makeStatic(new Vec2(0, 100), 200, 20);
		startScene(game, [actor, platform]);

		const isEdge = actor.isEdgeAhead(new Vec2(1, 0));
		expect(isEdge).toBe(false);
	});

	it("returns false when actor has no collision shapes", () => {
		const game = createGame();
		const actor = new Actor();
		actor.collisionGroup = "default";
		actor.solid = false;
		actor.position = new Vec2(0, 0);
		const platform = makeStatic(new Vec2(0, 10), 200, 20);
		startScene(game, [actor, platform]);

		const isEdge = actor.isEdgeAhead(new Vec2(1, 0));
		expect(isEdge).toBe(false);
	});

	it("with Vec2.LEFT checks left side", () => {
		const game = createGame();
		// Actor near the left edge of a platform
		const actor = makeActor(new Vec2(-90, 80));
		actor.applyGravity = false;
		const platform = makeStatic(new Vec2(0, 100), 200, 20);
		startScene(game, [actor, platform]);

		const isEdge = actor.isEdgeAhead(new Vec2(-1, 0));
		expect(isEdge).toBe(true);
	});
});

// === Actor.hasLineOfSight ===

describe("Actor.hasLineOfSight", () => {
	it("returns true when unobstructed", () => {
		const game = createGame();
		const actor = makeActor(new Vec2(0, 0));
		const target = makeActor(new Vec2(200, 0));
		startScene(game, [actor, target]);

		const result = actor.hasLineOfSight(target);
		expect(result).toBe(true);
	});

	it("returns false when wall blocks view", () => {
		const game = createGame();
		const actor = makeActor(new Vec2(0, 0));
		const wall = makeStatic(new Vec2(100, 0), 20, 100);
		const target = makeActor(new Vec2(200, 0));
		startScene(game, [actor, wall, target]);

		const result = actor.hasLineOfSight(target);
		expect(result).toBe(false);
	});

	it("accepts Vec2 target", () => {
		const game = createGame();
		const actor = makeActor(new Vec2(0, 0));
		startScene(game, [actor]);

		const result = actor.hasLineOfSight(new Vec2(200, 0));
		expect(result).toBe(true);
	});

	it("with originOffset casts from custom position", () => {
		const game = createGame();
		const actor = makeActor(new Vec2(0, 0));
		// A short wall that would block from center but not from elevated eye position
		const wall = makeStatic(new Vec2(100, 0), 20, 10);
		const target = makeActor(new Vec2(200, 0));
		startScene(game, [actor, wall, target]);

		// From center, wall blocks
		const blocked = actor.hasLineOfSight(target);
		expect(blocked).toBe(false);

		// From above, no block (wall is too short)
		const clear = actor.hasLineOfSight(target, undefined, new Vec2(0, -20));
		expect(clear).toBe(true);
	});
});

// === Actor.findNearest ===

describe("Actor.findNearest", () => {
	it("returns closest body", () => {
		const game = createGame();
		const actor = makeActor(new Vec2(0, 0));
		const near = makeStatic(new Vec2(50, 0), 20, 20);
		const far = makeStatic(new Vec2(150, 0), 20, 20);
		startScene(game, [actor, near, far]);

		const result = actor.findNearest();
		expect(result).toBe(near);
	});

	it("returns null when nothing in range", () => {
		const game = createGame();
		const actor = makeActor(new Vec2(0, 0));
		const far = makeStatic(new Vec2(500, 0), 20, 20);
		startScene(game, [actor, far]);

		const result = actor.findNearest(50);
		expect(result).toBeNull();
	});

	it("respects tag/group filters", () => {
		const game = createGame();
		const actor = makeActor(new Vec2(0, 0));
		const near = makeStatic(new Vec2(50, 0), 20, 20);
		const far = makeStatic(new Vec2(100, 0), 20, 20);
		far.tag("pickup");
		startScene(game, [actor, near, far]);

		const result = actor.findNearest(10000, { tags: ["pickup"] });
		expect(result).toBe(far);
	});
});
