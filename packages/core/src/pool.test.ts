import { describe, expect, it } from "vitest";
import { Game } from "./game.js";
import { Node } from "./node.js";
import { Node2D } from "./node2d.js";
import { _applyClassDefaults, _captureClassDefaults, NodePool, type Poolable } from "./pool.js";
import { Scene } from "./scene.js";

// === Test fixtures ===

class TestNode extends Node implements Poolable {
	value = 42;
	resetCalls = 0;
	reset(): void {
		this.value = 42;
		this.resetCalls++;
	}
}

class TestNode2D extends Node2D implements Poolable {
	speed = 100;
	reset(): void {
		this.speed = 100;
	}
}

/** Helper to create a minimal game + scene for tree tests. */
function createGameScene(): { game: Game; scene: Scene } {
	class TestScene extends Scene {}
	const game = new Game({ width: 100, height: 100 });
	game.registerScenes({ test: TestScene });
	game.start("test");
	return { game, scene: game.currentScene as Scene };
}

// === Mock physics nodes for snapshot testing ===
// Core can't import Actor/CollisionObject, so we use duck-typed mocks.

class Vec2Mock {
	constructor(
		public x: number,
		public y: number,
	) {}
	_set(x: number, y: number): void {
		this.x = x;
		this.y = y;
	}
}

class MockCollisionObject extends Node implements Poolable {
	collisionGroup = "custom";
	monitoring = true;
	reset(): void {}
}

class MockActor extends Node implements Poolable {
	collisionGroup = "bullets";
	monitoring = false;
	solid = true;
	applyGravity = false;
	upDirection = new Vec2Mock(0, 0);
	gravity = 0;
	floorMaxAngle = Math.PI / 6;
	maxSlides = 2;
	reset(): void {}
}

class MockStaticCollider extends Node implements Poolable {
	collisionGroup = "platforms";
	monitoring = false;
	oneWay = true;
	oneWayDirection = new Vec2Mock(1, 0);
	reset(): void {}
}

describe("_captureClassDefaults", () => {
	it("returns null for plain Node", () => {
		const node = new TestNode();
		expect(_captureClassDefaults(node)).toBeNull();
	});

	it("returns null for plain Node2D", () => {
		const node = new TestNode2D();
		expect(_captureClassDefaults(node)).toBeNull();
	});

	it("captures CollisionObject properties", () => {
		const node = new MockCollisionObject();
		const snap = _captureClassDefaults(node);
		expect(snap).not.toBeNull();
		expect(snap?.collisionGroup).toBe("custom");
		expect(snap?.monitoring).toBe(true);
	});

	it("captures Actor properties including Vec2", () => {
		const node = new MockActor();
		const snap = _captureClassDefaults(node);
		expect(snap).not.toBeNull();
		expect(snap?.collisionGroup).toBe("bullets");
		expect(snap?.monitoring).toBe(false);
		expect(snap?.solid).toBe(true);
		expect(snap?.applyGravity).toBe(false);
		expect(snap?.upDirection_x).toBe(0);
		expect(snap?.upDirection_y).toBe(0);
		expect(snap?.gravity).toBe(0);
		expect(snap?.floorMaxAngle).toBe(Math.PI / 6);
		expect(snap?.maxSlides).toBe(2);
	});

	it("captures StaticCollider properties", () => {
		const node = new MockStaticCollider();
		const snap = _captureClassDefaults(node);
		expect(snap).not.toBeNull();
		expect(snap?.collisionGroup).toBe("platforms");
		expect(snap?.oneWay).toBe(true);
		expect(snap?.oneWayDirection_x).toBe(1);
		expect(snap?.oneWayDirection_y).toBe(0);
	});
});

describe("_applyClassDefaults", () => {
	it("restores all CollisionObject properties", () => {
		const node = new MockCollisionObject();
		node.collisionGroup = "clobbered";
		node.monitoring = false;

		_applyClassDefaults(node, { collisionGroup: "custom", monitoring: true });
		expect(node.collisionGroup).toBe("custom");
		expect(node.monitoring).toBe(true);
	});

	it("restores all Actor properties including Vec2", () => {
		const node = new MockActor();
		// Clobber values (simulating what _poolReset would do)
		node.collisionGroup = "default";
		node.monitoring = false;
		node.solid = false;
		node.applyGravity = true;
		node.upDirection._set(0, -1);
		node.gravity = 800;
		node.floorMaxAngle = Math.PI / 4;
		node.maxSlides = 4;

		_applyClassDefaults(node, {
			collisionGroup: "bullets",
			monitoring: false,
			solid: true,
			applyGravity: false,
			upDirection_x: 0,
			upDirection_y: 0,
			gravity: 0,
			floorMaxAngle: Math.PI / 6,
			maxSlides: 2,
		});

		expect(node.collisionGroup).toBe("bullets");
		expect(node.solid).toBe(true);
		expect(node.applyGravity).toBe(false);
		expect(node.upDirection.x).toBe(0);
		expect(node.upDirection.y).toBe(0);
		expect(node.gravity).toBe(0);
		expect(node.floorMaxAngle).toBe(Math.PI / 6);
		expect(node.maxSlides).toBe(2);
	});

	it("restores StaticCollider properties including Vec2", () => {
		const node = new MockStaticCollider();
		node.oneWay = false;
		node.oneWayDirection._set(0, -1);

		_applyClassDefaults(node, {
			collisionGroup: "platforms",
			monitoring: false,
			oneWay: true,
			oneWayDirection_x: 1,
			oneWayDirection_y: 0,
		});

		expect(node.oneWay).toBe(true);
		expect(node.oneWayDirection.x).toBe(1);
		expect(node.oneWayDirection.y).toBe(0);
	});
});

describe("NodePool", () => {
	it("constructor creates exemplar (pool starts with 1 available)", () => {
		const pool = new NodePool(TestNode);
		expect(pool.available).toBe(1);
	});

	it("acquire returns a fresh instance when pool is empty", () => {
		const pool = new NodePool(TestNode);
		// Drain the exemplar
		pool.acquire();
		// Now pool is empty — next acquire creates a fresh instance
		const node = pool.acquire();
		expect(node).toBeInstanceOf(TestNode);
		expect(node.value).toBe(42);
	});

	it("acquire reuses released instance", () => {
		const pool = new NodePool(TestNode);
		const node = pool.acquire();
		const originalId = node.id;
		pool.release(node);
		expect(pool.available).toBe(1);

		const reused = pool.acquire();
		expect(pool.available).toBe(0);
		// Same object, but new ID
		expect(reused).toBe(node);
		expect(reused.id).not.toBe(originalId);
	});

	it("acquire assigns fresh ID each time", () => {
		const pool = new NodePool(TestNode);
		const node = pool.acquire();
		pool.release(node);
		const id1 = node.id;

		const reacquired = pool.acquire();
		expect(reacquired.id).not.toBe(id1);
	});

	it("acquire resets base state (lifecycle, tags, signals, children)", () => {
		const { scene } = createGameScene();
		const pool = new NodePool(TestNode);

		const node = pool.acquire();
		node.tag("enemy", "boss");
		node.name = "CustomName";
		const child = new Node();
		scene.add(node);
		node.add(child);

		expect(node.hasTag("enemy")).toBe(true);
		expect(node.children.length).toBe(1);
		expect(node.isReady).toBe(true);

		pool.release(node);
		const reacquired = pool.acquire();

		expect(reacquired.hasTag("enemy")).toBe(false);
		expect(reacquired.hasTag("boss")).toBe(false);
		expect(reacquired.children.length).toBe(0);
		expect(reacquired.isReady).toBe(false);
		expect(reacquired.isDestroyed).toBe(false);
		expect(reacquired.name).toBe("TestNode");
	});

	it("acquire calls user reset()", () => {
		const pool = new NodePool(TestNode);
		const node = pool.acquire();
		// First acquire is from the exemplar pool, so resetCalls is already 1
		expect(node.resetCalls).toBe(1);

		node.value = 999;
		pool.release(node);

		const reacquired = pool.acquire();
		expect(reacquired.value).toBe(42);
		expect(reacquired.resetCalls).toBe(2);
	});

	it("release removes node from tree", () => {
		const { scene } = createGameScene();
		const pool = new NodePool(TestNode);
		const node = pool.acquire();
		scene.add(node);
		expect(node.parent).toBe(scene);

		pool.release(node);
		expect(node.parent).toBeNull();
	});

	it("release drops node when pool full (at maxSize)", () => {
		const pool = new NodePool(TestNode, 2);
		const a = pool.acquire();
		const b = pool.acquire();
		const c = pool.acquire();

		pool.release(a);
		pool.release(b);
		expect(pool.available).toBe(2);

		pool.release(c); // Exceeds maxSize, should be silently dropped
		expect(pool.available).toBe(2);
	});

	it("prefill creates instances eagerly", () => {
		const pool = new NodePool(TestNode, 10);
		expect(pool.available).toBe(1); // Exemplar

		pool.prefill(5);
		expect(pool.available).toBe(5);

		// Doesn't exceed maxSize
		pool.prefill(20);
		expect(pool.available).toBe(10);
	});

	it("clear empties the pool", () => {
		const pool = new NodePool(TestNode);
		pool.prefill(5);
		expect(pool.available).toBe(5);

		pool.clear();
		expect(pool.available).toBe(0);
	});

	it("re-acquired node goes through full lifecycle when re-added to tree", () => {
		const { scene } = createGameScene();
		const pool = new NodePool(TestNode);

		const node = pool.acquire();
		scene.add(node);
		expect(node.isReady).toBe(true);
		expect(node.isInsideTree).toBe(true);

		pool.release(node);
		// After release + acquire, lifecycle flags are reset
		const reacquired = pool.acquire();
		expect(reacquired.isReady).toBe(false);
		expect(reacquired.isInsideTree).toBe(false);

		// Re-add triggers build() + onReady() again
		scene.add(reacquired);
		expect(reacquired.isReady).toBe(true);
		expect(reacquired.isInsideTree).toBe(true);
	});

	it("Node2D pool resets transform state", () => {
		const pool = new NodePool(TestNode2D);
		const node = pool.acquire();
		node.position._set(100, 200);
		node.rotation = 1.5;
		node.scale._set(2, 3);
		node.zIndex = 5;
		node.visible = false;
		node.alpha = 0.5;

		pool.release(node);
		const reacquired = pool.acquire();

		expect(reacquired.position.x).toBe(0);
		expect(reacquired.position.y).toBe(0);
		expect(reacquired.rotation).toBe(0);
		expect(reacquired.scale.x).toBe(1);
		expect(reacquired.scale.y).toBe(1);
		expect(reacquired.zIndex).toBe(0);
		expect(reacquired.visible).toBe(true);
		expect(reacquired.alpha).toBe(1);
		expect(reacquired.speed).toBe(100);
	});

	it("maxSize property returns configured max", () => {
		const pool = new NodePool(TestNode, 42);
		expect(pool.maxSize).toBe(42);
	});

	it("preserves collisionGroup override through mock pool cycle", () => {
		const pool = new NodePool(MockCollisionObject);
		const node = pool.acquire();
		// Class default is "custom" — should be preserved after pool cycle
		expect(node.collisionGroup).toBe("custom");

		// Simulate gameplay changing it
		node.collisionGroup = "something-else";
		pool.release(node);

		const reacquired = pool.acquire();
		// Should be restored to class default, not the _poolReset base value
		expect(reacquired.collisionGroup).toBe("custom");
	});

	it("preserves Actor-like overrides through mock pool cycle", () => {
		const pool = new NodePool(MockActor);
		const node = pool.acquire();
		expect(node.applyGravity).toBe(false);
		expect(node.upDirection.x).toBe(0);
		expect(node.upDirection.y).toBe(0);
		expect(node.solid).toBe(true);

		pool.release(node);
		const reacquired = pool.acquire();
		expect(reacquired.applyGravity).toBe(false);
		expect(reacquired.upDirection.x).toBe(0);
		expect(reacquired.upDirection.y).toBe(0);
		expect(reacquired.solid).toBe(true);
	});

	it("properties changed during gameplay restored to class defaults on reacquire", () => {
		const pool = new NodePool(MockActor);
		const node = pool.acquire();

		// Simulate gameplay changes
		node.collisionGroup = "modified";
		node.applyGravity = true;
		node.upDirection._set(0, -1);
		node.solid = false;
		node.gravity = 999;

		pool.release(node);
		const reacquired = pool.acquire();

		// Restored to class defaults, not gameplay values
		expect(reacquired.collisionGroup).toBe("bullets");
		expect(reacquired.applyGravity).toBe(false);
		expect(reacquired.upDirection.x).toBe(0);
		expect(reacquired.upDirection.y).toBe(0);
		expect(reacquired.solid).toBe(true);
		expect(reacquired.gravity).toBe(0);
	});
});
