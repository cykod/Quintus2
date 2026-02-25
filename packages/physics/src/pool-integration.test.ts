import { Game, NodePool, type Poolable, Scene } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { Actor } from "./actor.js";
import { CollisionShape } from "./collision-shape.js";
import { getPhysicsWorld, PhysicsPlugin } from "./physics-plugin.js";
import type { PhysicsWorld } from "./physics-world.js";
import { Sensor } from "./sensor.js";
import { Shape } from "./shapes.js";
import { StaticCollider } from "./static-collider.js";

// === Test fixtures ===

class PooledActor extends Actor implements Poolable {
	speed = 200;
	reset(): void {
		this.speed = 200;
	}

	override build() {
		const shape = new CollisionShape();
		shape.shape = Shape.rect(10, 10);
		return shape;
	}
}

class PooledSensor extends Sensor implements Poolable {
	triggered = false;
	reset(): void {
		this.triggered = false;
	}

	override build() {
		const shape = new CollisionShape();
		shape.shape = Shape.rect(10, 10);
		return shape;
	}
}

function createPhysicsGame(): { game: Game; scene: Scene; world: PhysicsWorld } {
	class TestScene extends Scene {}
	const game = new Game({ width: 200, height: 200 });
	game.use(PhysicsPlugin());
	game.registerScenes({ test: TestScene });
	game.start("test");
	const world = getPhysicsWorld(game) as PhysicsWorld;
	return { game, scene: game.currentScene as Scene, world };
}

describe("Pool + Physics Integration", () => {
	it("pooled Actor: acquire → add → move() → release → acquire → physics works", () => {
		const { scene } = createPhysicsGame();
		const pool = new NodePool(PooledActor);

		// First use
		const actor = pool.acquire();
		actor.position._set(50, 50);
		scene.add(actor);
		expect(actor.isReady).toBe(true);

		// Should have collision shape from build()
		const shapes = actor.getShapes();
		expect(shapes.length).toBe(1);

		// Move should work
		actor.velocity._set(100, 0);
		actor.move(1 / 60);
		expect(actor.position.x).toBeGreaterThan(50);

		// Release
		pool.release(actor);
		expect(actor.parent).toBeNull();
		expect(pool.available).toBe(1);

		// Re-acquire
		const reused = pool.acquire();
		expect(reused).toBe(actor);
		expect(reused.velocity.x).toBe(0);
		expect(reused.velocity.y).toBe(0);
		expect(reused.speed).toBe(200);
		expect(reused.isReady).toBe(false);

		// Re-add to scene
		reused.position._set(100, 100);
		scene.add(reused);
		expect(reused.isReady).toBe(true);

		// build() children should be rebuilt
		expect(reused.getShapes().length).toBe(1);

		// Physics still works
		reused.velocity._set(0, 100);
		reused.move(1 / 60);
		expect(reused.position.y).toBeGreaterThan(100);
	});

	it("pooled Sensor: acquire → add → detect overlaps → release → acquire → signals fire", () => {
		const { scene, world } = createPhysicsGame();
		const pool = new NodePool(PooledSensor);

		// First use
		const sensor = pool.acquire();
		sensor.position._set(50, 50);
		scene.add(sensor);
		expect(sensor.monitoring).toBe(true);

		// Set up signal
		let entered = false;
		sensor.bodyEntered.connect(() => {
			entered = true;
		});

		// Release
		pool.release(sensor);

		// Re-acquire
		const reused = pool.acquire();
		expect(reused).toBe(sensor);
		expect(reused.monitoring).toBe(true); // Sensor default

		// Signal listeners should be cleared
		reused.position._set(50, 50);
		scene.add(reused);

		// Connect a new listener
		let newEntered = false;
		reused.bodyEntered.connect(() => {
			newEntered = true;
		});

		// Create an overlapping actor
		const actor = new PooledActor();
		actor.position._set(50, 50);
		scene.add(actor);

		// Step monitoring
		world.stepMonitoring();

		// New listener should fire, old one shouldn't (it was disconnected)
		expect(entered).toBe(false);
		expect(newEntered).toBe(true);
	});

	it("pool 100 Actors rapidly — no stale state leaks", () => {
		const { scene } = createPhysicsGame();
		const pool = new NodePool(PooledActor, 100);

		const nodes: PooledActor[] = [];

		// Acquire 100
		for (let i = 0; i < 100; i++) {
			const actor = pool.acquire();
			actor.position._set(i * 20, 0);
			actor.speed = i * 10;
			actor.tag(`enemy-${i}`);
			scene.add(actor);
			nodes.push(actor);
		}

		// Release all
		for (const node of nodes) {
			pool.release(node);
		}
		expect(pool.available).toBe(100);

		// Re-acquire all and verify clean state
		for (let i = 0; i < 100; i++) {
			const actor = pool.acquire();
			expect(actor.speed).toBe(200); // User reset
			expect(actor.tags.size).toBe(0); // Tags cleared
			expect(actor.position.x).toBe(0); // Position reset
			expect(actor.position.y).toBe(0);
			expect(actor.velocity.x).toBe(0);
			expect(actor.velocity.y).toBe(0);
			expect(actor.children.length).toBe(0); // Build children cleared
		}
	});

	it("pooled Actor with build() children rebuilds CollisionShape on reuse", () => {
		const { scene } = createPhysicsGame();
		const pool = new NodePool(PooledActor);

		const actor = pool.acquire();
		scene.add(actor);
		const firstShapes = actor.getShapes();
		expect(firstShapes.length).toBe(1);

		pool.release(actor);
		const reused = pool.acquire();
		// Before adding to tree, no shapes (children cleared by _poolReset)
		expect(reused.children.length).toBe(0);

		scene.add(reused);
		// After adding to tree, build() runs again
		expect(reused.getShapes().length).toBe(1);
	});

	it("pooled Actor re-registers in physics world on re-add", () => {
		const { scene } = createPhysicsGame();
		const pool = new NodePool(PooledActor);

		const actor = pool.acquire();
		actor.position._set(50, 50);
		scene.add(actor);

		// Create a floor to collide with
		const floor = new StaticCollider();
		floor.position._set(50, 100);
		const floorShape = new CollisionShape();
		floorShape.shape = Shape.rect(200, 20);
		floor.add(floorShape);
		scene.add(floor);

		// Should be able to detect collision
		actor.velocity._set(0, 800);
		actor.move(1 / 60);

		pool.release(actor);
		const reused = pool.acquire();
		reused.position._set(50, 50);
		scene.add(reused);

		// After re-add, physics should work (re-registered in world)
		reused.velocity._set(0, 800);
		reused.move(1 / 60);
		// The actor moved downward — physics is functioning
		expect(reused.position.y).toBeGreaterThan(50);
	});
});
