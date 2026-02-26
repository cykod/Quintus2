import { Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { Actor } from "./actor.js";
import { CollisionShape } from "./collision-shape.js";
import { PhysicsPlugin } from "./physics-plugin.js";
import { Sensor } from "./sensor.js";
import { Shape } from "./shapes.js";
import { StaticCollider } from "./static-collider.js";

function createGame(): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null });
}

function setupWithBodies(bodies: import("@quintus/core").Node[]): Game {
	const game = createGame();
	game.use(PhysicsPlugin());
	class TestScene extends Scene {
		onReady() {
			for (const body of bodies) this.add(body);
		}
	}
	game.start(TestScene);
	return game;
}

describe("Actor.serialize()", () => {
	it("includes physics state", () => {
		const actor = new Actor();
		actor.collisionGroup = "default";
		actor.solid = false;
		actor.name = "Player";
		actor.tag("hero");
		actor.position = new Vec2(100, 200);
		actor.velocity = new Vec2(50, -100);
		const cs = actor.add(CollisionShape);
		cs.shape = Shape.rect(16, 16);

		setupWithBodies([actor]);

		const snap = actor.serialize();
		expect(snap.bodyType).toBe("actor");
		expect(snap.velocity).toEqual({ x: 50, y: -100 });
		expect(snap.gravity).toBe(800);
		expect(snap.isOnFloor).toBe(false);
		expect(snap.isOnWall).toBe(false);
		expect(snap.isOnCeiling).toBe(false);
		expect(snap.collisionGroup).toBe("default");
		expect(snap.position).toEqual({ x: 100, y: 200 });
		expect(snap.name).toBe("Player");
		expect(snap.tags).toContain("hero");
	});
});

describe("StaticCollider.serialize()", () => {
	it("includes collider state", () => {
		const sc = new StaticCollider();
		sc.collisionGroup = "default";
		sc.name = "Platform";
		sc.oneWay = true;
		sc.constantVelocity = new Vec2(50, 0);
		const cs = sc.add(CollisionShape);
		cs.shape = Shape.rect(100, 20);

		setupWithBodies([sc]);

		const snap = sc.serialize();
		expect(snap.bodyType).toBe("static");
		expect(snap.oneWay).toBe(true);
		expect(snap.constantVelocity).toEqual({ x: 50, y: 0 });
		expect(snap.collisionGroup).toBe("default");
	});
});

describe("Sensor.serialize()", () => {
	it("includes sensor state", () => {
		const sensor = new Sensor();
		sensor.collisionGroup = "default";
		sensor.name = "Coin";
		sensor.monitoring = true;
		const cs = sensor.add(CollisionShape);
		cs.shape = Shape.rect(16, 16);

		setupWithBodies([sensor]);

		const snap = sensor.serialize();
		expect(snap.bodyType).toBe("sensor");
		expect(snap.monitoring).toBe(true);
		expect(snap.overlappingBodyCount).toBe(0);
		expect(snap.overlappingSensorCount).toBe(0);
		expect(snap.collisionGroup).toBe("default");
	});
});
