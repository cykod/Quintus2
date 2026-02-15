import { describe, expect, it, vi } from "vitest";
import { Matrix2D, Vec2 } from "@quintus/math";
import { CollisionGroups } from "./collision-groups.js";
import { CollisionShape } from "./collision-shape.js";
import { type BodyType, CollisionObject } from "./collision-object.js";
import { PhysicsWorld } from "./physics-world.js";
import { type Shape2D, Shape } from "./shapes.js";

// === Test helpers ===

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
	private _mon = true;
	readonly enteredBodies: CollisionObject[] = [];
	readonly exitedBodies: CollisionObject[] = [];

	override get _monitoring(): boolean {
		return this._mon;
	}

	set monitoring(v: boolean) {
		this._mon = v;
	}

	override _onBodyEntered(body: CollisionObject): void {
		this.enteredBodies.push(body);
	}

	override _onBodyExited(body: CollisionObject): void {
		this.exitedBodies.push(body);
	}
}

/**
 * Create a body with a collision shape at a position.
 * Manually sets up shape as child (no game/scene needed for direct PhysicsWorld tests).
 */
function createBody(
	type: BodyType,
	shape: Shape2D,
	pos: Vec2,
	group = "default",
): TestBody | TestSensor {
	const body = type === "sensor" ? new TestSensor() : new TestBody(type);
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

function customGroups(): CollisionGroups {
	return new CollisionGroups({
		player: { collidesWith: ["world"] },
		world: { collidesWith: ["player"] },
		ghost: { collidesWith: [] as string[] },
	});
}

describe("PhysicsWorld", () => {
	describe("register / unregister", () => {
		it("registers a body in the spatial hash", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const body = createBody("actor", Shape.rect(20, 20), new Vec2(0, 0));
			world.register(body);

			// Body should be queryable via testOverlap
			const other = createBody("static", Shape.rect(20, 20), new Vec2(5, 0));
			world.register(other);

			const overlaps = world.testOverlap(body);
			expect(overlaps).toContain(other);
		});

		it("unregisters a body from the spatial hash", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const body = createBody("actor", Shape.rect(20, 20), new Vec2(0, 0));
			const other = createBody("static", Shape.rect(20, 20), new Vec2(5, 0));
			world.register(body);
			world.register(other);
			world.unregister(other);

			const overlaps = world.testOverlap(body);
			expect(overlaps).not.toContain(other);
		});

		it("validates collision group on register", () => {
			const world = new PhysicsWorld({ groups: customGroups() });
			const body = createBody("actor", Shape.rect(10, 10), new Vec2(0, 0), "nonexistent");
			expect(() => world.register(body)).toThrow("Unknown collision group");
		});
	});

	describe("castMotion", () => {
		it("returns null with no obstacles", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const body = createBody("actor", Shape.rect(10, 10), new Vec2(0, 0));
			world.register(body);

			const result = world.castMotion(body, new Vec2(100, 0));
			expect(result).toBeNull();
		});

		it("returns collision with obstacle", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const body = createBody("actor", Shape.rect(10, 10), new Vec2(0, 0));
			const wall = createBody("static", Shape.rect(10, 10), new Vec2(50, 0));
			world.register(body);
			world.register(wall);

			const result = world.castMotion(body, new Vec2(100, 0));
			expect(result).not.toBeNull();
			expect(result!.collider).toBe(wall);
			// TOI should be < 1 (collision before full motion)
			expect(result!.travel.x).toBeLessThan(100);
			expect(result!.travel.x).toBeGreaterThan(0);
			// Normal should point away from wall (into body, i.e., -x direction)
			expect(result!.normal.x).toBeLessThan(0);
		});

		it("returns closest collision with multiple obstacles", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const body = createBody("actor", Shape.rect(10, 10), new Vec2(0, 0));
			const nearWall = createBody("static", Shape.rect(10, 10), new Vec2(30, 0));
			const farWall = createBody("static", Shape.rect(10, 10), new Vec2(80, 0));
			world.register(body);
			world.register(nearWall);
			world.register(farWall);

			const result = world.castMotion(body, new Vec2(100, 0));
			expect(result).not.toBeNull();
			expect(result!.collider).toBe(nearWall);
		});

		it("respects collision groups", () => {
			const groups = customGroups();
			const world = new PhysicsWorld({ groups });

			const body = createBody("actor", Shape.rect(10, 10), new Vec2(0, 0), "player");
			const ghost = createBody("static", Shape.rect(10, 10), new Vec2(30, 0), "ghost");
			const wall = createBody("static", Shape.rect(10, 10), new Vec2(60, 0), "world");
			world.register(body);
			world.register(ghost);
			world.register(wall);

			const result = world.castMotion(body, new Vec2(100, 0));
			expect(result).not.toBeNull();
			// Should skip ghost (player doesn't collide with ghost), hit wall
			expect(result!.collider).toBe(wall);
		});

		it("ignores sensor candidates", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const body = createBody("actor", Shape.rect(10, 10), new Vec2(0, 0));
			const sensor = createBody("sensor", Shape.rect(10, 10), new Vec2(30, 0));
			world.register(body);
			world.register(sensor);

			const result = world.castMotion(body, new Vec2(100, 0));
			expect(result).toBeNull(); // Sensor should not block motion
		});

		it("provides correct travel and remainder", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const body = createBody("actor", Shape.rect(10, 10), new Vec2(0, 0));
			const wall = createBody("static", Shape.rect(10, 10), new Vec2(50, 0));
			world.register(body);
			world.register(wall);

			const motion = new Vec2(100, 0);
			const result = world.castMotion(body, motion);
			expect(result).not.toBeNull();
			// travel + remainder should equal original motion
			expect(result!.travel.x + result!.remainder.x).toBeCloseTo(motion.x, 0);
			expect(result!.travel.y + result!.remainder.y).toBeCloseTo(motion.y, 0);
		});

		it("provides a contact point", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const body = createBody("actor", Shape.rect(10, 10), new Vec2(0, 0));
			const wall = createBody("static", Shape.rect(10, 10), new Vec2(50, 0));
			world.register(body);
			world.register(wall);

			const result = world.castMotion(body, new Vec2(100, 0));
			expect(result).not.toBeNull();
			expect(result!.point).toBeDefined();
			expect(typeof result!.point.x).toBe("number");
			expect(typeof result!.point.y).toBe("number");
		});

		it("returns null for no shapes on body", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const body = new TestBody("actor");
			body.position = new Vec2(0, 0);
			// No shape children
			world.register(body);

			const result = world.castMotion(body, new Vec2(100, 0));
			expect(result).toBeNull();
		});
	});

	describe("testOverlap", () => {
		it("detects overlapping bodies", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const a = createBody("actor", Shape.rect(20, 20), new Vec2(0, 0));
			const b = createBody("static", Shape.rect(20, 20), new Vec2(10, 0));
			world.register(a);
			world.register(b);

			const overlaps = world.testOverlap(a);
			expect(overlaps).toContain(b);
		});

		it("returns empty for no overlaps", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const a = createBody("actor", Shape.rect(10, 10), new Vec2(0, 0));
			const b = createBody("static", Shape.rect(10, 10), new Vec2(100, 0));
			world.register(a);
			world.register(b);

			const overlaps = world.testOverlap(a);
			expect(overlaps).toHaveLength(0);
		});

		it("respects collision groups", () => {
			const groups = customGroups();
			const world = new PhysicsWorld({ groups });

			const player = createBody("actor", Shape.rect(20, 20), new Vec2(0, 0), "player");
			const ghost = createBody("static", Shape.rect(20, 20), new Vec2(5, 0), "ghost");
			world.register(player);
			world.register(ghost);

			const overlaps = world.testOverlap(player);
			expect(overlaps).toHaveLength(0); // player doesn't collide with ghost
		});
	});

	describe("updatePosition", () => {
		it("updates body position in spatial hash", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const body = createBody("actor", Shape.rect(10, 10), new Vec2(0, 0));
			const wall = createBody("static", Shape.rect(10, 10), new Vec2(100, 0));
			world.register(body);
			world.register(wall);

			// Not overlapping initially
			expect(world.testOverlap(body)).toHaveLength(0);

			// Move body next to wall
			body.position = new Vec2(95, 0);
			world.updatePosition(body);

			// Now overlapping
			expect(world.testOverlap(body)).toContain(wall);
		});
	});

	describe("sensor stepping", () => {
		it("fires entered event when overlap begins", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const sensor = createBody("sensor", Shape.rect(20, 20), new Vec2(0, 0)) as TestSensor;
			const actor = createBody("actor", Shape.rect(10, 10), new Vec2(5, 0));
			world.register(sensor);
			world.register(actor);

			world.stepSensors();

			expect(sensor.enteredBodies).toContain(actor);
		});

		it("fires exited event when overlap ends", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const sensor = createBody("sensor", Shape.rect(20, 20), new Vec2(0, 0)) as TestSensor;
			const actor = createBody("actor", Shape.rect(10, 10), new Vec2(5, 0));
			world.register(sensor);
			world.register(actor);

			// First step: entered
			world.stepSensors();
			expect(sensor.enteredBodies).toHaveLength(1);

			// Move actor far away
			actor.position = new Vec2(200, 0);
			world.updatePosition(actor);

			// Second step: exited
			world.stepSensors();
			expect(sensor.exitedBodies).toContain(actor);
		});

		it("does not fire duplicate entered events", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const sensor = createBody("sensor", Shape.rect(20, 20), new Vec2(0, 0)) as TestSensor;
			const actor = createBody("actor", Shape.rect(10, 10), new Vec2(5, 0));
			world.register(sensor);
			world.register(actor);

			world.stepSensors();
			world.stepSensors();
			world.stepSensors();

			// Entered should only fire once
			expect(sensor.enteredBodies).toHaveLength(1);
		});

		it("fires exited when body is unregistered", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const sensor = createBody("sensor", Shape.rect(20, 20), new Vec2(0, 0)) as TestSensor;
			const actor = createBody("actor", Shape.rect(10, 10), new Vec2(5, 0));
			world.register(sensor);
			world.register(actor);

			world.stepSensors();
			expect(sensor.enteredBodies).toHaveLength(1);

			// Unregister actor — removes from overlap set
			world.unregister(actor);

			world.stepSensors();
			expect(sensor.exitedBodies).toContain(actor);
		});

		it("skips sensors with monitoring=false", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const sensor = createBody("sensor", Shape.rect(20, 20), new Vec2(0, 0)) as TestSensor;
			sensor.monitoring = false;
			const actor = createBody("actor", Shape.rect(10, 10), new Vec2(5, 0));
			world.register(sensor);
			world.register(actor);

			world.stepSensors();
			expect(sensor.enteredBodies).toHaveLength(0);
		});

		it("respects collision groups for sensors", () => {
			const groups = customGroups();
			const world = new PhysicsWorld({ groups });

			const sensor = createBody("sensor", Shape.rect(20, 20), new Vec2(0, 0), "player") as TestSensor;
			const ghost = createBody("static", Shape.rect(20, 20), new Vec2(5, 0), "ghost");
			world.register(sensor);
			world.register(ghost);

			world.stepSensors();
			// player doesn't collide with ghost → no entered event
			expect(sensor.enteredBodies).toHaveLength(0);
		});
	});

	describe("getOverlappingBodies / getOverlappingSensors", () => {
		it("returns bodies overlapping a sensor", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const sensor = createBody("sensor", Shape.rect(20, 20), new Vec2(0, 0)) as TestSensor;
			const actor = createBody("actor", Shape.rect(10, 10), new Vec2(5, 0));
			world.register(sensor);
			world.register(actor);

			world.stepSensors();

			const bodies = world.getOverlappingBodies(sensor);
			expect(bodies).toContain(actor);
		});

		it("returns sensors overlapping a sensor", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const sensorA = createBody("sensor", Shape.rect(20, 20), new Vec2(0, 0)) as TestSensor;
			const sensorB = createBody("sensor", Shape.rect(20, 20), new Vec2(5, 0)) as TestSensor;
			world.register(sensorA);
			world.register(sensorB);

			world.stepSensors();

			const sensors = world.getOverlappingSensors(sensorA);
			expect(sensors).toContain(sensorB);
		});

		it("getOverlappingBodies returns empty for unregistered sensor", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const sensor = createBody("sensor", Shape.rect(20, 20), new Vec2(0, 0)) as TestSensor;
			// Don't register the sensor
			expect(world.getOverlappingBodies(sensor)).toHaveLength(0);
		});

		it("getOverlappingSensors returns empty for unregistered sensor", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const sensor = createBody("sensor", Shape.rect(20, 20), new Vec2(0, 0)) as TestSensor;
			// Don't register the sensor
			expect(world.getOverlappingSensors(sensor)).toHaveLength(0);
		});
	});

	describe("castMotion (general TOI path)", () => {
		it("returns collision for circle shapes via binary-search TOI", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const body = createBody("actor", Shape.circle(8), new Vec2(0, 0));
			const wall = createBody("static", Shape.circle(8), new Vec2(50, 0));
			world.register(body);
			world.register(wall);

			// Motion must end overlapping the wall for findTOI to detect
			// At t=1: body at (55,0), distance to wall = 5 < 16 (both radii)
			const result = world.castMotion(body, new Vec2(55, 0));
			expect(result).not.toBeNull();
			expect(result!.collider).toBe(wall);
			expect(result!.travel.x).toBeLessThan(55);
			expect(result!.travel.x).toBeGreaterThan(0);
			// Normal should point away from wall into mover (-x direction)
			expect(result!.normal.x).toBeLessThan(0);
		});

		it("returns collision for polygon shapes via binary-search TOI", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const poly = Shape.polygon([
				new Vec2(-8, -8),
				new Vec2(8, -8),
				new Vec2(8, 8),
				new Vec2(-8, 8),
			]);
			const body = createBody("actor", poly, new Vec2(0, 0));
			const wall = createBody("static", poly, new Vec2(50, 0));
			world.register(body);
			world.register(wall);

			// At t=1: body center at (45,0), poly edge at 53, wall edge at 42.
			// Overlap at endpoint ensures findTOI converges.
			const result = world.castMotion(body, new Vec2(45, 0));
			expect(result).not.toBeNull();
			expect(result!.collider).toBe(wall);
			expect(result!.travel.x).toBeLessThan(45);
			expect(result!.travel.x).toBeGreaterThan(0);
			// Normal negated from SAT → points away from collider into mover
			expect(result!.normal.x).toBeLessThan(0);
		});

		it("general TOI provides correct depth from SAT result", () => {
			const world = new PhysicsWorld({ groups: defaultGroups() });
			const body = createBody("actor", Shape.circle(10), new Vec2(0, 0));
			const wall = createBody("static", Shape.circle(10), new Vec2(30, 0));
			world.register(body);
			world.register(wall);

			// At t=1: body at (25,0), distance to wall = 5 < 20. findTOI detects.
			const result = world.castMotion(body, new Vec2(25, 0));
			expect(result).not.toBeNull();
			// travel + remainder = original motion
			expect(result!.travel.x + result!.remainder.x).toBeCloseTo(25, 0);
		});
	});

	describe("construction defaults", () => {
		it("creates with default gravity", () => {
			const world = new PhysicsWorld();
			expect(world.gravity.x).toBe(0);
			expect(world.gravity.y).toBe(800);
		});

		it("accepts custom gravity", () => {
			const world = new PhysicsWorld({ gravity: new Vec2(0, 600) });
			expect(world.gravity.y).toBe(600);
		});
	});
});
