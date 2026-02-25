import { Game, NodePool, type Poolable, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
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

// === Subclasses with class-level overrides ===

class CustomGroupActor extends Actor implements Poolable {
	override collisionGroup = "bullets";
	speed = 300;
	reset(): void {
		this.speed = 300;
	}

	override build() {
		const shape = new CollisionShape();
		shape.shape = Shape.rect(4, 4);
		return shape;
	}
}

class TopDownActor extends Actor implements Poolable {
	override applyGravity = false;
	override upDirection = new Vec2(0, 0);
	speed = 150;
	reset(): void {
		this.speed = 150;
	}

	override build() {
		const shape = new CollisionShape();
		shape.shape = Shape.rect(8, 8);
		return shape;
	}
}

class SolidActor extends Actor implements Poolable {
	override solid = true;
	override collisionGroup = "enemies";
	reset(): void {}

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

function createPhysicsGameWithGroups(): { game: Game; scene: Scene; world: PhysicsWorld } {
	class TestScene extends Scene {}
	const game = new Game({ width: 200, height: 200 });
	game.use(
		PhysicsPlugin({
			collisionGroups: {
				default: { collidesWith: ["default"] },
				bullets: { collidesWith: ["enemies", "default"] },
				enemies: { collidesWith: ["bullets", "default"] },
			},
		}),
	);
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

describe("Pool + Class Override Preservation", () => {
	it("pooled Actor with override collisionGroup survives pool cycle", () => {
		const { scene } = createPhysicsGameWithGroups();
		const pool = new NodePool(CustomGroupActor);

		const actor = pool.acquire();
		expect(actor.collisionGroup).toBe("bullets");

		actor.position._set(50, 50);
		scene.add(actor);

		// Simulate gameplay
		actor.velocity._set(100, 0);
		actor.move(1 / 60);

		pool.release(actor);
		const reused = pool.acquire();

		// collisionGroup should be preserved to class default, not reset to "default"
		expect(reused.collisionGroup).toBe("bullets");
		expect(reused.speed).toBe(300); // User reset
	});

	it("pooled Actor with override applyGravity = false preserves through cycle", () => {
		const { scene } = createPhysicsGame();
		const pool = new NodePool(TopDownActor);

		const actor = pool.acquire();
		expect(actor.applyGravity).toBe(false);

		actor.position._set(50, 50);
		scene.add(actor);

		pool.release(actor);
		const reused = pool.acquire();

		// applyGravity should be preserved as false
		expect(reused.applyGravity).toBe(false);
	});

	it("pooled Actor with override upDirection = (0,0) preserves through cycle", () => {
		const { scene } = createPhysicsGame();
		const pool = new NodePool(TopDownActor);

		const actor = pool.acquire();
		expect(actor.upDirection.x).toBe(0);
		expect(actor.upDirection.y).toBe(0);

		actor.position._set(50, 50);
		scene.add(actor);

		pool.release(actor);
		const reused = pool.acquire();

		// upDirection should be preserved as (0, 0), not reset to (0, -1)
		expect(reused.upDirection.x).toBe(0);
		expect(reused.upDirection.y).toBe(0);
	});

	it("pooled Actor with override solid = true preserves through cycle", () => {
		const { scene } = createPhysicsGameWithGroups();
		const pool = new NodePool(SolidActor);

		const actor = pool.acquire();
		expect(actor.solid).toBe(true);
		expect(actor.collisionGroup).toBe("enemies");

		actor.position._set(50, 50);
		scene.add(actor);

		pool.release(actor);
		const reused = pool.acquire();

		expect(reused.solid).toBe(true);
		expect(reused.collisionGroup).toBe("enemies");
	});

	it("runtime property changes reset to class defaults on reacquire", () => {
		const { scene } = createPhysicsGameWithGroups();
		const pool = new NodePool(CustomGroupActor);

		const actor = pool.acquire();
		actor.position._set(50, 50);
		scene.add(actor);

		// Simulate runtime changes that differ from class defaults
		actor.collisionGroup = "enemies";
		actor.applyGravity = false;
		actor.upDirection._set(1, 0);
		actor.solid = true;

		pool.release(actor);
		const reused = pool.acquire();

		// Should restore to class defaults, not the runtime values
		expect(reused.collisionGroup).toBe("bullets");
		expect(reused.applyGravity).toBe(true); // Actor base default (CustomGroupActor doesn't override)
		expect(reused.upDirection.x).toBe(0);
		expect(reused.upDirection.y).toBe(-1); // Actor base default
		expect(reused.solid).toBe(false); // Actor base default
	});
});
