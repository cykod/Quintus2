import { Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { Actor } from "./actor.js";
import type { CollisionObject } from "./collision-object.js";
import { CollisionShape } from "./collision-shape.js";
import { getPhysicsWorld, PhysicsPlugin } from "./physics-plugin.js";
import { Sensor } from "./sensor.js";
import { Shape } from "./shapes.js";
import { StaticCollider } from "./static-collider.js";

// === Helpers ===

function setupScene(bodies: import("@quintus/core").Node[]): {
	game: Game;
	world: ReturnType<typeof getPhysicsWorld>;
} {
	const canvas = document.createElement("canvas");
	const game = new Game({ width: 800, height: 600, canvas, renderer: null });
	game.use(PhysicsPlugin());
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

function makeSensor(pos: Vec2, w = 40, h = 40): Sensor {
	const sensor = new Sensor();
	sensor.collisionGroup = "default";
	sensor.position = pos;
	const cs = sensor.addChild(CollisionShape);
	cs.shape = Shape.rect(w, h);
	return sensor;
}

function makeStatic(pos: Vec2, w = 20, h = 20): StaticCollider {
	const sc = new StaticCollider();
	sc.collisionGroup = "default";
	sc.position = pos;
	const cs = sc.addChild(CollisionShape);
	cs.shape = Shape.rect(w, h);
	return sc;
}

// === Tests ===

describe("Sensor", () => {
	describe("bodyType", () => {
		it("has bodyType 'sensor'", () => {
			const sensor = new Sensor();
			expect(sensor.bodyType).toBe("sensor");
		});
	});

	describe("bodyEntered / bodyExited", () => {
		it("bodyEntered fires when Actor overlaps Sensor", () => {
			const sensor = makeSensor(new Vec2(0, 0));
			const actor = makeActor(new Vec2(5, 0));
			const { game } = setupScene([sensor, actor]);

			const entered: CollisionObject[] = [];
			sensor.bodyEntered.connect((b) => entered.push(b));

			game.step();

			expect(entered).toHaveLength(1);
			expect(entered[0]).toBe(actor);
		});

		it("bodyExited fires when Actor leaves Sensor", () => {
			const sensor = makeSensor(new Vec2(0, 0));
			const actor = makeActor(new Vec2(5, 0));
			const { game, world } = setupScene([sensor, actor]);

			const exited: CollisionObject[] = [];
			sensor.bodyExited.connect((b) => exited.push(b));

			game.step(); // Enters

			// Move actor far away
			actor.position = new Vec2(500, 0);
			world?.updatePosition(actor);
			game.step(); // Exits

			expect(exited).toHaveLength(1);
			expect(exited[0]).toBe(actor);
		});

		it("bodyEntered fires for StaticCollider overlap too", () => {
			const sensor = makeSensor(new Vec2(0, 0));
			const sc = makeStatic(new Vec2(5, 0));
			const { game } = setupScene([sensor, sc]);

			const entered: CollisionObject[] = [];
			sensor.bodyEntered.connect((b) => entered.push(b));

			game.step();
			expect(entered).toContain(sc);
		});
	});

	describe("sensorEntered / sensorExited", () => {
		it("sensorEntered fires when two Sensors overlap", () => {
			const sensorA = makeSensor(new Vec2(0, 0));
			const sensorB = makeSensor(new Vec2(10, 0));
			const { game } = setupScene([sensorA, sensorB]);

			const entered: Sensor[] = [];
			sensorA.sensorEntered.connect((s) => entered.push(s));

			game.step();

			expect(entered).toHaveLength(1);
			expect(entered[0]).toBe(sensorB);
		});

		it("sensorExited fires when Sensors separate", () => {
			const sensorA = makeSensor(new Vec2(0, 0));
			const sensorB = makeSensor(new Vec2(10, 0));
			const { game, world } = setupScene([sensorA, sensorB]);

			const exited: Sensor[] = [];
			sensorA.sensorExited.connect((s) => exited.push(s));

			game.step(); // Overlap

			// Separate sensors
			sensorB.position = new Vec2(500, 0);
			world?.updatePosition(sensorB);
			game.step();

			expect(exited).toHaveLength(1);
			expect(exited[0]).toBe(sensorB);
		});

		it("mutual detection: sensor A overlaps B, both fire sensorEntered", () => {
			const sensorA = makeSensor(new Vec2(0, 0));
			const sensorB = makeSensor(new Vec2(10, 0));
			const { game } = setupScene([sensorA, sensorB]);

			const enteredA: Sensor[] = [];
			const enteredB: Sensor[] = [];
			sensorA.sensorEntered.connect((s) => enteredA.push(s));
			sensorB.sensorEntered.connect((s) => enteredB.push(s));

			game.step();

			expect(enteredA).toContain(sensorB);
			expect(enteredB).toContain(sensorA);
		});
	});

	describe("monitoring toggle", () => {
		it("monitoring = false prevents signals from firing", () => {
			const sensor = makeSensor(new Vec2(0, 0));
			sensor.monitoring = false;
			const actor = makeActor(new Vec2(5, 0));
			const { game } = setupScene([sensor, actor]);

			const entered: CollisionObject[] = [];
			sensor.bodyEntered.connect((b) => entered.push(b));

			game.step();

			expect(entered).toHaveLength(0);
		});

		it("re-enabling monitoring while overlapping fires bodyEntered for existing overlaps", () => {
			const sensor = makeSensor(new Vec2(0, 0));
			sensor.monitoring = false;
			const actor = makeActor(new Vec2(5, 0));
			const { game } = setupScene([sensor, actor]);

			const entered: CollisionObject[] = [];
			sensor.bodyEntered.connect((b) => entered.push(b));

			game.step(); // No events (monitoring off)
			expect(entered).toHaveLength(0);

			sensor.monitoring = true;
			game.step(); // Should detect existing overlap

			expect(entered).toHaveLength(1);
			expect(entered[0]).toBe(actor);
		});
	});

	describe("getOverlappingBodies / getOverlappingSensors", () => {
		it("getOverlappingBodies() returns current overlaps", () => {
			const sensor = makeSensor(new Vec2(0, 0));
			const actor = makeActor(new Vec2(5, 0));
			const { game } = setupScene([sensor, actor]);

			game.step();

			const bodies = sensor.getOverlappingBodies();
			expect(bodies).toContain(actor);
		});

		it("getOverlappingSensors() returns Sensor[]", () => {
			const sensorA = makeSensor(new Vec2(0, 0));
			const sensorB = makeSensor(new Vec2(10, 0));
			const { game } = setupScene([sensorA, sensorB]);

			game.step();

			const sensors = sensorA.getOverlappingSensors();
			expect(sensors).toContain(sensorB);
			expect(sensors[0]).toBeInstanceOf(Sensor);
		});

		it("returns empty arrays when no shapes", () => {
			const sensor = new Sensor(); // No CollisionShape children
			sensor.collisionGroup = "default";
			sensor.position = new Vec2(0, 0);
			setupScene([sensor]);

			expect(sensor.getOverlappingBodies()).toHaveLength(0);
			expect(sensor.getOverlappingSensors()).toHaveLength(0);
		});
	});

	describe("no duplicate events", () => {
		it("signal fires once per enter (no duplicates on sustained overlap)", () => {
			const sensor = makeSensor(new Vec2(0, 0));
			const actor = makeActor(new Vec2(5, 0));
			const { game } = setupScene([sensor, actor]);

			const entered: CollisionObject[] = [];
			sensor.bodyEntered.connect((b) => entered.push(b));

			game.step();
			game.step();
			game.step();

			expect(entered).toHaveLength(1);
		});
	});

	describe("exit on destroy", () => {
		it("bodyExited fires when overlapping body is destroyed", () => {
			const sensor = makeSensor(new Vec2(0, 0));
			const actor = makeActor(new Vec2(5, 0));
			const { game } = setupScene([sensor, actor]);

			const exited: CollisionObject[] = [];
			sensor.bodyExited.connect((b) => exited.push(b));

			game.step(); // Enter

			actor.destroy();
			game.step(); // Process destroy → unregister → exit event

			expect(exited).toContain(actor);
		});
	});

	describe("sensor movement", () => {
		it("sensor moves to overlap stationary actor, bodyEntered fires", () => {
			const sensor = makeSensor(new Vec2(500, 0));
			const actor = makeActor(new Vec2(0, 0));
			const { game, world } = setupScene([sensor, actor]);

			const entered: CollisionObject[] = [];
			sensor.bodyEntered.connect((b) => entered.push(b));

			game.step(); // No overlap (far apart)
			expect(entered).toHaveLength(0);

			// Move sensor near actor
			sensor.position = new Vec2(5, 0);
			world?.updatePosition(sensor);
			game.step();

			expect(entered).toHaveLength(1);
			expect(entered[0]).toBe(actor);
		});
	});

	describe("multiple bodies", () => {
		it("multiple bodies enter sensor in same frame, all get bodyEntered", () => {
			const sensor = makeSensor(new Vec2(0, 0), 100, 100);
			const actor1 = makeActor(new Vec2(5, 0));
			const actor2 = makeActor(new Vec2(-5, 0));
			const sc = makeStatic(new Vec2(0, 5));
			const { game } = setupScene([sensor, actor1, actor2, sc]);

			const entered: CollisionObject[] = [];
			sensor.bodyEntered.connect((b) => entered.push(b));

			game.step();

			expect(entered).toHaveLength(3);
			expect(entered).toContain(actor1);
			expect(entered).toContain(actor2);
			expect(entered).toContain(sc);
		});
	});

	describe("sensor with no shapes", () => {
		it("no errors, no signals", () => {
			const sensor = new Sensor();
			sensor.collisionGroup = "default";
			sensor.position = new Vec2(0, 0);
			const actor = makeActor(new Vec2(5, 0));
			const { game } = setupScene([sensor, actor]);

			const entered: CollisionObject[] = [];
			sensor.bodyEntered.connect((b) => entered.push(b));

			expect(() => game.step()).not.toThrow();
			expect(entered).toHaveLength(0);
		});
	});

	describe("signal cleanup", () => {
		it("disconnects all signals on destroy", () => {
			const sensor = makeSensor(new Vec2(0, 0));
			const { game } = setupScene([sensor]);

			sensor.bodyEntered.connect(() => {});
			sensor.bodyExited.connect(() => {});
			sensor.sensorEntered.connect(() => {});
			sensor.sensorExited.connect(() => {});

			expect(sensor.bodyEntered.hasListeners).toBe(true);
			expect(sensor.sensorEntered.hasListeners).toBe(true);

			sensor.destroy();
			game.step();

			expect(sensor.bodyEntered.hasListeners).toBe(false);
			expect(sensor.bodyExited.hasListeners).toBe(false);
			expect(sensor.sensorEntered.hasListeners).toBe(false);
			expect(sensor.sensorExited.hasListeners).toBe(false);
		});
	});

	describe("monitoring default", () => {
		it("defaults to monitoring = true", () => {
			const sensor = new Sensor();
			expect(sensor.monitoring).toBe(true);
		});
	});

	describe("onBodyEntered always emits bodyEntered", () => {
		it("sensor-to-sensor overlap emits BOTH bodyEntered AND sensorEntered", () => {
			const sensorA = makeSensor(new Vec2(0, 0));
			const sensorB = makeSensor(new Vec2(10, 0));
			const { game } = setupScene([sensorA, sensorB]);

			const bodyEnteredA: CollisionObject[] = [];
			const sensorEnteredA: Sensor[] = [];
			sensorA.bodyEntered.connect((b) => bodyEnteredA.push(b));
			sensorA.sensorEntered.connect((s) => sensorEnteredA.push(s));

			game.step();

			expect(bodyEnteredA).toContain(sensorB);
			expect(sensorEnteredA).toContain(sensorB);
		});

		it("sensor-to-actor overlap emits only bodyEntered (not sensorEntered)", () => {
			const sensor = makeSensor(new Vec2(0, 0));
			const actor = makeActor(new Vec2(5, 0));
			const { game } = setupScene([sensor, actor]);

			const sensorEnteredEvents: Sensor[] = [];
			sensor.sensorEntered.connect((s) => sensorEnteredEvents.push(s));

			const bodyEnteredEvents: CollisionObject[] = [];
			sensor.bodyEntered.connect((b) => bodyEnteredEvents.push(b));

			game.step();

			expect(bodyEnteredEvents).toHaveLength(1);
			expect(bodyEnteredEvents[0]).toBe(actor);
			expect(sensorEnteredEvents).toHaveLength(0);
		});

		it("onSensorEntered virtual method works for self-handling", () => {
			class CustomSensor extends Sensor {
				customSensors: Sensor[] = [];
				override onSensorEntered(sensor: Sensor): void {
					this.customSensors.push(sensor);
					super.onSensorEntered(sensor);
				}
			}
			const custom = new CustomSensor();
			custom.collisionGroup = "default";
			custom.position = new Vec2(0, 0);
			const cs = custom.addChild(CollisionShape);
			cs.shape = Shape.rect(40, 40);

			const other = makeSensor(new Vec2(10, 0));
			const { game } = setupScene([custom, other]);

			game.step();

			expect(custom.customSensors).toContain(other);
			// sensorEntered signal should also fire via super
		});
	});

	describe("queries without physics world", () => {
		it("getOverlappingBodies() returns empty when no world attached", () => {
			const sensor = new Sensor();
			// Not added to any scene — _getWorld() returns null
			expect(sensor.getOverlappingBodies()).toHaveLength(0);
		});

		it("getOverlappingSensors() returns empty when no world attached", () => {
			const sensor = new Sensor();
			expect(sensor.getOverlappingSensors()).toHaveLength(0);
		});
	});
});
