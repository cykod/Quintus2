import { describe, expect, it } from "vitest";
import { Game } from "./game.js";
import { Node } from "./node.js";
import { Node2D } from "./node2d.js";
import { NodePool, type Poolable } from "./pool.js";
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

describe("NodePool", () => {
	it("acquire returns a fresh instance when pool is empty", () => {
		const pool = new NodePool(TestNode);
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
		node.value = 999;
		pool.release(node);

		const reacquired = pool.acquire();
		expect(reacquired.value).toBe(42);
		expect(reacquired.resetCalls).toBe(1);
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
		expect(pool.available).toBe(0);

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
});
