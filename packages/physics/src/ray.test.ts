import { Matrix2D, Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { CollisionGroups } from "./collision-groups.js";
import { type BodyType, CollisionObject } from "./collision-object.js";
import { CollisionShape } from "./collision-shape.js";
import { PhysicsWorld } from "./physics-world.js";
import { rayIntersectShape } from "./ray.js";
import { Shape, type Shape2D } from "./shapes.js";

// === Test helpers ===

class TestBody extends CollisionObject {
	readonly bodyType: BodyType;
	constructor(type: BodyType = "static") {
		super();
		this.bodyType = type;
	}
}

function createBody(type: BodyType, shape: Shape2D, pos: Vec2, group = "default"): TestBody {
	const body = new TestBody(type);
	body.position = pos;
	body.collisionGroup = group;
	const cs = body.addChild(CollisionShape);
	cs.shape = shape;
	return body;
}

function defaultGroups(): CollisionGroups {
	return new CollisionGroups({
		default: { collidesWith: ["default"] },
	});
}

// === Ray-Shape Intersection Tests ===

describe("rayIntersectShape", () => {
	describe("rect", () => {
		it("hits axis-aligned rect — correct point, normal, distance", () => {
			const shape = Shape.rect(20, 20);
			const transform = Matrix2D.translate(50, 0);
			const hit = rayIntersectShape(new Vec2(0, 0), new Vec2(1, 0), 100, shape, transform);
			expect(hit).not.toBeNull();
			expect(hit!.t).toBeCloseTo(40, 1); // center at 50, halfWidth = 10
			expect(hit!.normal.x).toBeCloseTo(-1, 5);
			expect(hit!.normal.y).toBeCloseTo(0, 5);
		});

		it("misses rect (parallel ray)", () => {
			const shape = Shape.rect(20, 20);
			const transform = Matrix2D.translate(50, 50);
			const hit = rayIntersectShape(new Vec2(0, 0), new Vec2(1, 0), 100, shape, transform);
			expect(hit).toBeNull();
		});

		it("misses rect (past end)", () => {
			const shape = Shape.rect(20, 20);
			const transform = Matrix2D.translate(50, 0);
			const hit = rayIntersectShape(new Vec2(0, 0), new Vec2(1, 0), 30, shape, transform);
			expect(hit).toBeNull();
		});

		it("hits rotated rect — correct normal in world space", () => {
			const shape = Shape.rect(20, 20);
			// Translate to (50,0) then rotate 45 degrees in place
			const transform = Matrix2D.translate(50, 0).multiply(Matrix2D.rotate(Math.PI / 4));
			const hit = rayIntersectShape(new Vec2(0, 0), new Vec2(1, 0), 200, shape, transform);
			expect(hit).not.toBeNull();
			// Normal should point generally left (toward the ray origin)
			expect(hit!.normal.x).toBeLessThan(0);
		});

		it("origin inside rect — returns null", () => {
			const shape = Shape.rect(100, 100);
			const transform = Matrix2D.translate(0, 0);
			const hit = rayIntersectShape(new Vec2(0, 0), new Vec2(1, 0), 100, shape, transform);
			expect(hit).toBeNull();
		});
	});

	describe("circle", () => {
		it("hits circle — correct point and normal", () => {
			const shape = Shape.circle(10);
			const transform = Matrix2D.translate(50, 0);
			const hit = rayIntersectShape(new Vec2(0, 0), new Vec2(1, 0), 100, shape, transform);
			expect(hit).not.toBeNull();
			expect(hit!.t).toBeCloseTo(40, 1); // center at 50, radius = 10
			expect(hit!.normal.x).toBeCloseTo(-1, 5);
			expect(hit!.normal.y).toBeCloseTo(0, 5);
		});

		it("origin inside circle — returns null", () => {
			const shape = Shape.circle(100);
			const transform = Matrix2D.translate(0, 0);
			const hit = rayIntersectShape(new Vec2(0, 0), new Vec2(1, 0), 100, shape, transform);
			expect(hit).toBeNull();
		});

		it("misses circle (ray passes beside)", () => {
			const shape = Shape.circle(10);
			const transform = Matrix2D.translate(50, 50);
			const hit = rayIntersectShape(new Vec2(0, 0), new Vec2(1, 0), 100, shape, transform);
			expect(hit).toBeNull();
		});
	});

	describe("capsule", () => {
		it("hits capsule body — correct hit", () => {
			const shape = Shape.capsule(10, 40); // radius=10, height=40
			const transform = Matrix2D.translate(50, 0);
			const hit = rayIntersectShape(new Vec2(0, 0), new Vec2(1, 0), 100, shape, transform);
			expect(hit).not.toBeNull();
			expect(hit!.t).toBeCloseTo(40, 1); // center at 50, radius = 10
			expect(hit!.normal.x).toBeCloseTo(-1, 5);
		});

		it("hits capsule cap", () => {
			// Cast from below toward the bottom cap
			const shape = Shape.capsule(10, 40); // halfSeg = 10, caps at y=-10 and y=+10
			const transform = Matrix2D.translate(0, 0);
			const hit = rayIntersectShape(new Vec2(0, 50), new Vec2(0, -1), 100, shape, transform);
			expect(hit).not.toBeNull();
			expect(hit!.normal.y).toBeGreaterThan(0); // Normal should point away from shape
		});
	});

	describe("polygon", () => {
		it("hits convex polygon — correct edge normal", () => {
			// Triangle facing right
			const shape = Shape.polygon([new Vec2(-10, -10), new Vec2(10, 0), new Vec2(-10, 10)]);
			const transform = Matrix2D.translate(50, 0);
			const hit = rayIntersectShape(new Vec2(0, 0), new Vec2(1, 0), 100, shape, transform);
			expect(hit).not.toBeNull();
			expect(hit!.t).toBeGreaterThan(0);
			// Normal should point generally left (toward the ray origin)
			expect(hit!.normal.x).toBeLessThan(0);
		});

		it("origin inside polygon — returns null", () => {
			// Large triangle around origin (clockwise winding)
			const shape = Shape.polygon([new Vec2(0, -50), new Vec2(-50, 50), new Vec2(50, 50)]);
			const transform = Matrix2D.translate(0, 0);
			const hit = rayIntersectShape(new Vec2(0, 10), new Vec2(1, 0), 100, shape, transform);
			expect(hit).toBeNull();
		});
	});

	it("maxDistance stops short — no hit beyond limit", () => {
		const shape = Shape.rect(20, 20);
		const transform = Matrix2D.translate(100, 0);
		const hit = rayIntersectShape(new Vec2(0, 0), new Vec2(1, 0), 50, shape, transform);
		expect(hit).toBeNull();
	});
});

// === PhysicsWorld Raycast Tests ===

describe("PhysicsWorld.raycast", () => {
	it("returns closest hit across multiple bodies", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const near = createBody("static", Shape.rect(20, 20), new Vec2(50, 0));
		const far = createBody("static", Shape.rect(20, 20), new Vec2(100, 0));
		world.register(near);
		world.register(far);

		const hit = world.raycast(new Vec2(0, 0), new Vec2(1, 0));
		expect(hit).not.toBeNull();
		expect(hit!.collider).toBe(near);
		expect(hit!.distance).toBeCloseTo(40, 1);
	});

	it("raycastAll returns all hits sorted by distance", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const near = createBody("static", Shape.rect(20, 20), new Vec2(50, 0));
		const far = createBody("static", Shape.rect(20, 20), new Vec2(100, 0));
		world.register(near);
		world.register(far);

		const hits = world.raycastAll(new Vec2(0, 0), new Vec2(1, 0));
		expect(hits).toHaveLength(2);
		expect(hits[0]!.collider).toBe(near);
		expect(hits[1]!.collider).toBe(far);
		expect(hits[0]!.distance).toBeLessThan(hits[1]!.distance);
	});

	it("QueryOptions.groups filters correctly", () => {
		const groups = new CollisionGroups({
			player: { collidesWith: ["world"] },
			world: { collidesWith: ["player"] },
			enemy: { collidesWith: ["player"] },
		});
		const world = new PhysicsWorld({ groups });

		const wall = createBody("static", Shape.rect(20, 20), new Vec2(50, 0), "world");
		const enemy = createBody("static", Shape.rect(20, 20), new Vec2(80, 0), "enemy");
		world.register(wall);
		world.register(enemy);

		const hit = world.raycast(new Vec2(0, 0), new Vec2(1, 0), 10000, {
			groups: ["enemy"],
		});
		expect(hit).not.toBeNull();
		expect(hit!.collider).toBe(enemy);
	});

	it("QueryOptions.tags filters correctly", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const tagged = createBody("static", Shape.rect(20, 20), new Vec2(50, 0));
		tagged.tag("target");
		const untagged = createBody("static", Shape.rect(20, 20), new Vec2(30, 0));
		world.register(tagged);
		world.register(untagged);

		const hit = world.raycast(new Vec2(0, 0), new Vec2(1, 0), 10000, {
			tags: ["target"],
		});
		expect(hit).not.toBeNull();
		expect(hit!.collider).toBe(tagged);
	});

	it("QueryOptions.exclude skips specified bodies", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const near = createBody("static", Shape.rect(20, 20), new Vec2(50, 0));
		const far = createBody("static", Shape.rect(20, 20), new Vec2(100, 0));
		world.register(near);
		world.register(far);

		const hit = world.raycast(new Vec2(0, 0), new Vec2(1, 0), 10000, {
			exclude: [near],
		});
		expect(hit).not.toBeNull();
		expect(hit!.collider).toBe(far);
	});

	it("QueryOptions.includeSensors controls sensor inclusion", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const sensor = createBody("sensor", Shape.rect(20, 20), new Vec2(50, 0));
		world.register(sensor);

		// Default: sensors excluded
		const hit1 = world.raycast(new Vec2(0, 0), new Vec2(1, 0));
		expect(hit1).toBeNull();

		// Include sensors
		const hit2 = world.raycast(new Vec2(0, 0), new Vec2(1, 0), 10000, {
			includeSensors: true,
		});
		expect(hit2).not.toBeNull();
		expect(hit2!.collider).toBe(sensor);
	});

	it("QueryOptions.filter custom predicate works", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const a = createBody("static", Shape.rect(20, 20), new Vec2(50, 0));
		const b = createBody("static", Shape.rect(20, 20), new Vec2(100, 0));
		world.register(a);
		world.register(b);

		const hit = world.raycast(new Vec2(0, 0), new Vec2(1, 0), 10000, {
			filter: (body) => body !== a,
		});
		expect(hit).not.toBeNull();
		expect(hit!.collider).toBe(b);
	});

	it("ray against body with multiple shapes returns closest shape hit", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const body = new TestBody("static");
		body.position = new Vec2(50, 0);
		body.collisionGroup = "default";

		const cs1 = body.addChild(CollisionShape);
		cs1.shape = Shape.rect(10, 10);
		cs1.position = new Vec2(-10, 0); // shape at x=40

		const cs2 = body.addChild(CollisionShape);
		cs2.shape = Shape.rect(10, 10);
		cs2.position = new Vec2(10, 0); // shape at x=60

		world.register(body);

		const hit = world.raycast(new Vec2(0, 0), new Vec2(1, 0));
		expect(hit).not.toBeNull();
		expect(hit!.colliderShape).toBe(cs1); // closer shape
	});

	it("returns null when ray hits nothing", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const body = createBody("static", Shape.rect(20, 20), new Vec2(0, 100));
		world.register(body);

		const hit = world.raycast(new Vec2(0, 0), new Vec2(1, 0));
		expect(hit).toBeNull();
	});

	it("normalizes direction automatically", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const body = createBody("static", Shape.rect(20, 20), new Vec2(50, 0));
		world.register(body);

		// Non-normalized direction
		const hit = world.raycast(new Vec2(0, 0), new Vec2(5, 0));
		expect(hit).not.toBeNull();
		expect(hit!.distance).toBeCloseTo(40, 1);
	});
});
