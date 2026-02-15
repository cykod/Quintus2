import { describe, expect, it, vi } from "vitest";
import { Game } from "./game.js";
import { Node } from "./node.js";
import { Scene } from "./scene.js";

// Helper: create a game with a simple scene for tree tests
function createTestGame(): Game {
	const canvas = document.createElement("canvas");
	const game = new Game({ width: 100, height: 100, canvas });
	return game;
}

function createTestScene(game: Game): Scene {
	const scene = new Scene(game);
	return scene;
}

class TestNode extends Node {
	readyCalled = false;
	enterTreeCalled = false;
	exitTreeCalled = false;
	destroyedCalled = false;
	enterTreeCount = 0;
	exitTreeCount = 0;

	override onReady(): void {
		this.readyCalled = true;
	}
	override onEnterTree(): void {
		this.enterTreeCalled = true;
		this.enterTreeCount++;
	}
	override onExitTree(): void {
		this.exitTreeCalled = true;
		this.exitTreeCount++;
	}
	override onDestroy(): void {
		this.destroyedCalled = true;
	}
}

describe("Node", () => {
	// === Tree Manipulation ===
	it("addChild adds to children array and sets parent", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const child = new Node();
		scene.addChild(child);
		expect(scene.children).toContain(child);
		expect(child.parent).toBe(scene);
	});

	it("addChild(Class) constructs and adds to tree", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const child = scene.addChild(Node);
		expect(child).toBeInstanceOf(Node);
		expect(child.parent).toBe(scene);
		expect(child.isReady).toBe(true);
	});

	it("properties are set via direct assignment after addChild", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const child = scene.addChild(Node);
		child.name = "myNode";
		child.pauseMode = "independent";
		expect(child.name).toBe("myNode");
		expect(child.pauseMode).toBe("independent");
	});

	it("removeChild removes from children and clears parent", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const child = new Node();
		scene.addChild(child);
		scene.removeChild(child);
		expect(scene.children).not.toContain(child);
		expect(child.parent).toBeNull();
	});

	it("removeSelf calls parent.removeChild", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const child = new Node();
		scene.addChild(child);
		child.removeSelf();
		expect(scene.children).not.toContain(child);
	});

	it("cannot add node to itself", () => {
		const node = new Node();
		expect(() => node.addChild(node)).toThrow("Cannot add a node to itself");
	});

	it("cannot add node that already has a parent", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const child = new Node();
		scene.addChild(child);
		const otherParent = new Node();
		expect(() => otherParent.addChild(child)).toThrow("already has a parent");
	});

	it("adding multiple children preserves order", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const a = new Node();
		a.name = "a";
		const b = new Node();
		b.name = "b";
		const c = new Node();
		c.name = "c";
		scene.addChild(a);
		scene.addChild(b);
		scene.addChild(c);
		expect(scene.children.map((ch) => ch.name)).toEqual(["a", "b", "c"]);
	});

	// === Lifecycle Ordering ===
	it("onReady() called after node enters tree", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const node = new TestNode();
		scene.addChild(node);
		expect(node.readyCalled).toBe(true);
		expect(node.isReady).toBe(true);
	});

	it("onReady() called bottom-up (children before parents)", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const order: string[] = [];
		class Parent extends Node {
			override onReady() {
				order.push("parent");
			}
		}
		class Child extends Node {
			override onReady() {
				order.push("child");
			}
		}

		const parent = new Parent();
		const child = new Child();
		parent.addChild(child);
		scene.addChild(parent);
		expect(order).toEqual(["child", "parent"]);
	});

	it("onReady() called only once, even if reparented", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const node = new TestNode();
		scene.addChild(node);
		node.removeSelf();
		scene.addChild(node);
		// onEnterTree fires twice, but onReady fires once
		expect(node.enterTreeCount).toBe(2);
		expect(node.readyCalled).toBe(true);
	});

	it("onEnterTree() called every time node enters tree", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const node = new TestNode();
		scene.addChild(node);
		expect(node.enterTreeCount).toBe(1);
		node.removeSelf();
		scene.addChild(node);
		expect(node.enterTreeCount).toBe(2);
	});

	it("onExitTree() called every time node exits tree", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const node = new TestNode();
		scene.addChild(node);
		scene.removeChild(node);
		expect(node.exitTreeCount).toBe(1);
	});

	it("isReady and isInsideTree flags set correctly", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const node = new TestNode();
		expect(node.isReady).toBe(false);
		expect(node.isInsideTree).toBe(false);
		scene.addChild(node);
		expect(node.isReady).toBe(true);
		expect(node.isInsideTree).toBe(true);
		scene.removeChild(node);
		expect(node.isInsideTree).toBe(false);
		expect(node.isReady).toBe(true); // still ready even when removed
	});

	it("onDestroy() called when node is destroyed", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const node = new TestNode();
		scene.addChild(node);
		node.destroy();
		node._processDestroy();
		expect(node.destroyedCalled).toBe(true);
	});

	it("children destroyed when parent destroyed", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const parent = new TestNode();
		const child = new TestNode();
		parent.addChild(child);
		scene.addChild(parent);
		parent.destroy();
		parent._processDestroy();
		expect(child.destroyedCalled).toBe(true);
	});

	// === Destruction Ordering ===
	it("treeExited fires during destruction", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const node = new TestNode();
		scene.addChild(node);
		const handler = vi.fn();
		node.treeExited.connect(handler);
		node.destroy();
		node._processDestroy();
		expect(handler).toHaveBeenCalled();
	});

	it("destroying signal fires before onDestroy()", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const order: string[] = [];
		class TrackNode extends Node {
			override onDestroy() {
				order.push("onDestroy");
			}
		}
		const node = new TrackNode();
		scene.addChild(node);
		node.destroying.connect(() => order.push("destroying"));
		node.destroy();
		node._processDestroy();
		expect(order).toEqual(["destroying", "onDestroy"]);
	});

	// === Tags ===
	it("tag(), hasTag(), untag()", () => {
		const node = new Node();
		node.tag("enemy", "flying");
		expect(node.hasTag("enemy")).toBe(true);
		expect(node.hasTag("flying")).toBe(true);
		expect(node.hasTag("player")).toBe(false);
		node.untag("flying");
		expect(node.hasTag("flying")).toBe(false);
	});

	it("findAll(tag) returns correct nodes", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const a = new Node();
		a.tag("enemy");
		const b = new Node();
		b.tag("enemy");
		const c = new Node();
		c.tag("player");
		scene.addChild(a);
		scene.addChild(b);
		scene.addChild(c);
		expect(scene.findAll("enemy")).toHaveLength(2);
	});

	it("multiple tags on one node", () => {
		const node = new Node();
		node.tag("a", "b", "c");
		expect(node.tags.size).toBe(3);
	});

	// === Queries ===
	it("find(name) searches depth-first", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const parent = new Node();
		parent.name = "parent";
		const child = new Node();
		child.name = "target";
		parent.addChild(child);
		scene.addChild(parent);
		expect(scene.find("target")).toBe(child);
	});

	it("getChild(Type) returns first matching child", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		class SpecialNode extends Node {}
		const special = new SpecialNode();
		scene.addChild(new Node());
		scene.addChild(special);
		expect(scene.getChild(SpecialNode)).toBe(special);
	});

	it("getChildren(Type) returns all matching children", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		class SpecialNode extends Node {}
		scene.addChild(new SpecialNode());
		scene.addChild(new Node());
		scene.addChild(new SpecialNode());
		expect(scene.getChildren(SpecialNode)).toHaveLength(2);
	});

	it("findByType(Type) recursive search", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		class SpecialNode extends Node {}
		const parent = new Node();
		const deep = new SpecialNode();
		parent.addChild(deep);
		scene.addChild(parent);
		expect(scene.findByType(SpecialNode)).toBe(deep);
	});

	it("findAllByType(Type) recursive search", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		class SpecialNode extends Node {}
		const parent = new Node();
		parent.addChild(new SpecialNode());
		scene.addChild(parent);
		scene.addChild(new SpecialNode());
		expect(scene.findAllByType(SpecialNode)).toHaveLength(2);
	});

	// === Pause Mode ===
	it("'inherit' respects scene pause state", () => {
		const node = new Node();
		node.pauseMode = "inherit";
		expect(node._shouldProcess(false)).toBe(true);
		expect(node._shouldProcess(true)).toBe(false);
	});

	it("'independent' always processes even when scene paused", () => {
		const node = new Node();
		node.pauseMode = "independent";
		expect(node._shouldProcess(true)).toBe(true);
		expect(node._shouldProcess(false)).toBe(true);
	});

	it("'inherit' follows parent pauseMode", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const parent = new Node();
		parent.pauseMode = "independent";
		const child = new Node();
		child.pauseMode = "inherit";
		parent.addChild(child);
		scene.addChild(parent);
		expect(child._shouldProcess(true)).toBe(true);
	});

	// === Signals ===
	it("treeEntered fires when added to tree", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const node = new Node();
		const handler = vi.fn();
		node.treeEntered.connect(handler);
		scene.addChild(node);
		expect(handler).toHaveBeenCalled();
	});

	it("treeExited fires when removed", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const node = new Node();
		scene.addChild(node);
		const handler = vi.fn();
		node.treeExited.connect(handler);
		scene.removeChild(node);
		expect(handler).toHaveBeenCalled();
	});

	it("readySignal fires after ready()", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const node = new Node();
		const handler = vi.fn();
		node.readySignal.connect(handler);
		scene.addChild(node);
		expect(handler).toHaveBeenCalled();
	});

	// === Deferred Destruction ===
	it("destroy() marks but doesn't immediately remove", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const node = new Node();
		scene.addChild(node);
		node.destroy();
		expect(node.isDestroyed).toBe(true);
		expect(scene.children).toContain(node); // Still in tree until cleanup
	});

	it("actual removal happens in _processDestroy", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const node = new Node();
		scene.addChild(node);
		node.destroy();
		node._processDestroy();
		expect(scene.children).not.toContain(node);
	});

	it("destroy() queues for deferred processing via game.step()", () => {
		const game = createTestGame();
		class TestSceneDeferred extends Scene {
			onReady() {
				const node = new TestNode();
				this.addChild(node);
				node.destroy();
				// Node is still in tree before cleanup
				expect(this.children).toContain(node);
			}
		}
		game.start(TestSceneDeferred);
		// After step, the destroy queue should be processed
		game.step();
		const scene = game.currentScene;
		expect(scene).not.toBeNull();
		// The node destroyed in setup was already processed during the first step
		// Add a fresh node, destroy it, step, and verify removal
		const node = new TestNode();
		scene?.addChild(node);
		expect(scene?.children).toContain(node);
		node.destroy();
		expect(scene?.children).toContain(node); // Still in tree
		game.step();
		expect(scene?.children).not.toContain(node); // Removed after step
		expect(node.destroyedCalled).toBe(true);
	});

	// === Unique ID ===
	it("nodes have unique IDs", () => {
		const a = new Node();
		const b = new Node();
		expect(a.id).not.toBe(b.id);
	});

	// === Tree Queries: Not Found ===
	it("find(name) returns null when no match exists", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const child = new Node();
		child.name = "exists";
		scene.addChild(child);
		expect(scene.find("nonexistent")).toBeNull();
	});

	it("findByType(Type) returns null when no match exists", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		class SpecialNode extends Node {}
		scene.addChild(new Node());
		expect(scene.findByType(SpecialNode)).toBeNull();
	});

	// === exitTree with nested children ===
	it("removeChild fires onExitTree recursively on nested children", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const parent = new TestNode();
		const child = new TestNode();
		const grandchild = new TestNode();
		parent.addChild(child);
		child.addChild(grandchild);
		scene.addChild(parent);

		expect(grandchild.isInsideTree).toBe(true);
		scene.removeChild(parent);
		expect(parent.exitTreeCalled).toBe(true);
		expect(child.exitTreeCalled).toBe(true);
		expect(grandchild.exitTreeCalled).toBe(true);
	});

	// === Scene/Game Access ===
	it("scene accessor walks up to root Scene", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const parent = new Node();
		const child = new Node();
		parent.addChild(child);
		scene.addChild(parent);
		expect(child.scene).toBe(scene);
	});

	it("game accessor returns game from scene", () => {
		const game = createTestGame();
		const scene = createTestScene(game);
		const node = new Node();
		scene.addChild(node);
		expect(node.game).toBe(game);
	});

	it("scene accessor returns null for orphaned node", () => {
		const node = new Node();
		expect(node.scene).toBeNull();
	});

	it("game accessor returns null for orphaned node", () => {
		const node = new Node();
		expect(node.game).toBeNull();
	});
});
