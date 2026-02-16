import { AABB, Matrix2D, Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { CollisionGroups } from "./collision-groups.js";
import { type BodyType, CollisionObject } from "./collision-object.js";
import { CollisionShape } from "./collision-shape.js";
import { PhysicsWorld } from "./physics-world.js";
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

// === queryPoint ===

describe("PhysicsWorld.queryPoint", () => {
	it("finds body containing the point", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const body = createBody("static", Shape.rect(20, 20), new Vec2(0, 0));
		world.register(body);

		const result = world.queryPoint(new Vec2(5, 5));
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(body);
	});

	it("returns empty array for empty space", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const body = createBody("static", Shape.rect(20, 20), new Vec2(0, 0));
		world.register(body);

		const result = world.queryPoint(new Vec2(100, 100));
		expect(result).toHaveLength(0);
	});

	it("works with rotated shape", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const body = new TestBody("static");
		body.position = new Vec2(0, 0);
		body.collisionGroup = "default";
		body.rotation = Math.PI / 4; // Rotate 45 degrees

		const cs = body.addChild(CollisionShape);
		cs.shape = Shape.rect(20, 20);
		world.register(body);

		// Center is still at (0,0), so (0,0) should be inside even when rotated
		const result = world.queryPoint(new Vec2(0, 0));
		expect(result).toHaveLength(1);
	});

	it("works with circle shape", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const body = createBody("static", Shape.circle(10), new Vec2(0, 0));
		world.register(body);

		const inside = world.queryPoint(new Vec2(5, 5));
		expect(inside).toHaveLength(1);

		const outside = world.queryPoint(new Vec2(15, 0));
		expect(outside).toHaveLength(0);
	});

	it("works with capsule shape", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const body = createBody("static", Shape.capsule(10, 40), new Vec2(0, 0));
		world.register(body);

		// Inside the capsule body
		const inside = world.queryPoint(new Vec2(0, 0));
		expect(inside).toHaveLength(1);

		// Outside the capsule
		const outside = world.queryPoint(new Vec2(20, 0));
		expect(outside).toHaveLength(0);
	});

	it("works with polygon shape", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		// Clockwise triangle
		const shape = Shape.polygon([new Vec2(0, -20), new Vec2(-20, 20), new Vec2(20, 20)]);
		const body = createBody("static", shape, new Vec2(0, 0));
		world.register(body);

		const inside = world.queryPoint(new Vec2(0, 5));
		expect(inside).toHaveLength(1);

		const outside = world.queryPoint(new Vec2(0, -25));
		expect(outside).toHaveLength(0);
	});

	it("multiple shapes on one body — hit on any shape counts", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const body = new TestBody("static");
		body.position = new Vec2(0, 0);
		body.collisionGroup = "default";

		const cs1 = body.addChild(CollisionShape);
		cs1.shape = Shape.rect(10, 10);
		cs1.position = new Vec2(-20, 0);

		const cs2 = body.addChild(CollisionShape);
		cs2.shape = Shape.rect(10, 10);
		cs2.position = new Vec2(20, 0);

		world.register(body);

		// Hit first shape
		const result1 = world.queryPoint(new Vec2(-20, 0));
		expect(result1).toHaveLength(1);
		expect(result1[0]).toBe(body);

		// Hit second shape
		const result2 = world.queryPoint(new Vec2(20, 0));
		expect(result2).toHaveLength(1);
		expect(result2[0]).toBe(body);
	});
});

// === queryRect ===

describe("PhysicsWorld.queryRect", () => {
	it("finds all overlapping bodies", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const a = createBody("static", Shape.rect(20, 20), new Vec2(-10, 0));
		const b = createBody("static", Shape.rect(20, 20), new Vec2(10, 0));
		const c = createBody("static", Shape.rect(20, 20), new Vec2(100, 0));
		world.register(a);
		world.register(b);
		world.register(c);

		const result = world.queryRect(new AABB(new Vec2(-30, -30), new Vec2(30, 30)));
		expect(result).toHaveLength(2);
		expect(result).toContain(a);
		expect(result).toContain(b);
	});

	it("with tight AABB finds exact matches", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const body = createBody("static", Shape.rect(20, 20), new Vec2(0, 0));
		world.register(body);

		const hit = world.queryRect(new AABB(new Vec2(-5, -5), new Vec2(5, 5)));
		expect(hit).toHaveLength(1);

		const miss = world.queryRect(new AABB(new Vec2(50, 50), new Vec2(60, 60)));
		expect(miss).toHaveLength(0);
	});

	it("with maxResults: 1 returns at most one body", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const a = createBody("static", Shape.rect(20, 20), new Vec2(-5, 0));
		const b = createBody("static", Shape.rect(20, 20), new Vec2(5, 0));
		world.register(a);
		world.register(b);

		const result = world.queryRect(new AABB(new Vec2(-30, -30), new Vec2(30, 30)), {
			maxResults: 1,
		});
		expect(result).toHaveLength(1);
	});

	it("respects QueryOptions filters", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const a = createBody("static", Shape.rect(20, 20), new Vec2(0, 0));
		a.tag("target");
		const b = createBody("static", Shape.rect(20, 20), new Vec2(5, 0));
		world.register(a);
		world.register(b);

		const result = world.queryRect(new AABB(new Vec2(-30, -30), new Vec2(30, 30)), {
			tags: ["target"],
		});
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(a);
	});
});

// === queryCircle ===

describe("PhysicsWorld.queryCircle", () => {
	it("finds bodies within radius", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const near = createBody("static", Shape.rect(20, 20), new Vec2(30, 0));
		const far = createBody("static", Shape.rect(20, 20), new Vec2(200, 0));
		world.register(near);
		world.register(far);

		const result = world.queryCircle(new Vec2(0, 0), 50);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(near);
	});

	it("excludes bodies just outside radius", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const body = createBody("static", Shape.rect(10, 10), new Vec2(100, 0));
		world.register(body);

		const result = world.queryCircle(new Vec2(0, 0), 50);
		expect(result).toHaveLength(0);
	});

	it("respects QueryOptions filters", () => {
		const groups = new CollisionGroups({
			player: { collidesWith: ["world"] },
			world: { collidesWith: ["player"] },
		});
		const world = new PhysicsWorld({ groups });
		const a = createBody("static", Shape.rect(20, 20), new Vec2(10, 0), "player");
		const b = createBody("static", Shape.rect(20, 20), new Vec2(20, 0), "world");
		world.register(a);
		world.register(b);

		const result = world.queryCircle(new Vec2(0, 0), 100, { groups: ["world"] });
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(b);
	});
});

// === queryShape ===

describe("PhysicsWorld.queryShape", () => {
	it("with polygon finds overlapping bodies", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const body = createBody("static", Shape.rect(20, 20), new Vec2(0, 0));
		world.register(body);

		const queryPoly = Shape.polygon([
			new Vec2(-15, -15),
			new Vec2(-15, 15),
			new Vec2(15, 15),
			new Vec2(15, -15),
		]);
		const result = world.queryShape(queryPoly, Matrix2D.translate(0, 0));
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(body);
	});

	it("respects QueryOptions filters", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const a = createBody("static", Shape.rect(20, 20), new Vec2(0, 0));
		a.tag("target");
		const b = createBody("static", Shape.rect(20, 20), new Vec2(5, 0));
		world.register(a);
		world.register(b);

		const result = world.queryShape(Shape.circle(50), Matrix2D.translate(0, 0), {
			tags: ["target"],
		});
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(a);
	});
});

// === shapeCast ===

describe("PhysicsWorld.shapeCast", () => {
	it("with rect finds first collision", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const obstacle = createBody("static", Shape.rect(20, 20), new Vec2(50, 0));
		world.register(obstacle);

		const hit = world.shapeCast(Shape.rect(10, 10), Matrix2D.translate(0, 0), new Vec2(100, 0));
		expect(hit).not.toBeNull();
		expect(hit!.collider).toBe(obstacle);
	});

	it("with circle sweeps correctly", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const obstacle = createBody("static", Shape.rect(20, 20), new Vec2(50, 0));
		world.register(obstacle);

		const hit = world.shapeCast(
			Shape.circle(5),
			Matrix2D.translate(0, 0),
			new Vec2(60, 0), // motion ends past the obstacle so sweep should find it
		);
		expect(hit).not.toBeNull();
		expect(hit!.collider).toBe(obstacle);
	});

	it("along clear path returns null", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const obstacle = createBody("static", Shape.rect(20, 20), new Vec2(0, 100));
		world.register(obstacle);

		const hit = world.shapeCast(Shape.rect(10, 10), Matrix2D.translate(0, 0), new Vec2(100, 0));
		expect(hit).toBeNull();
	});

	it("respects QueryOptions filters", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const a = createBody("static", Shape.rect(20, 20), new Vec2(30, 0));
		a.tag("target");
		const b = createBody("static", Shape.rect(20, 20), new Vec2(60, 0));
		world.register(a);
		world.register(b);

		const hit = world.shapeCast(Shape.rect(10, 10), Matrix2D.translate(0, 0), new Vec2(100, 0), {
			exclude: [a],
		});
		expect(hit).not.toBeNull();
		expect(hit!.collider).toBe(b);
	});

	it("returns correct travel/remainder", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const obstacle = createBody("static", Shape.rect(20, 20), new Vec2(50, 0));
		world.register(obstacle);

		const motion = new Vec2(100, 0);
		const hit = world.shapeCast(Shape.rect(10, 10), Matrix2D.translate(0, 0), motion);
		expect(hit).not.toBeNull();
		// travel + remainder should equal motion
		const totalX = hit!.travel.x + hit!.remainder.x;
		const totalY = hit!.travel.y + hit!.remainder.y;
		expect(totalX).toBeCloseTo(motion.x, 0);
		expect(totalY).toBeCloseTo(motion.y, 0);
	});

	it("contact point is accurate", () => {
		const world = new PhysicsWorld({ groups: defaultGroups() });
		const obstacle = createBody("static", Shape.rect(20, 20), new Vec2(50, 0));
		world.register(obstacle);

		const hit = world.shapeCast(Shape.rect(10, 10), Matrix2D.translate(0, 0), new Vec2(100, 0));
		expect(hit).not.toBeNull();
		// Contact point should be near the collision boundary
		expect(hit!.point.x).toBeGreaterThan(30);
		expect(hit!.point.x).toBeLessThan(50);
	});
});
