import { Game, Node, Node2D, Scene } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { Fragment, h } from "./h.js";
import { ref } from "./ref.js";

// === Test helpers ===

function createTestGame(): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 100, height: 100, canvas });
}

function createTestScene(game: Game): Scene {
	return new Scene(game);
}

// === build() lifecycle tests ===

describe("build() lifecycle", () => {
	it("build() children are in tree before onReady() fires", () => {
		const game = createTestGame();
		const scene = createTestScene(game);

		let childInTreeAtReady = false;

		class Parent extends Node {
			override build() {
				return h(Node, { name: "built-child" }) as Node;
			}
			override onReady() {
				childInTreeAtReady = this.children[0]?.isInsideTree ?? false;
			}
		}

		scene.add(new Parent());

		expect(childInTreeAtReady).toBe(true);
		expect(scene.children[0].children).toHaveLength(1);
		expect(scene.children[0].children[0].name).toBe("built-child");
	});

	it("refs from build() are populated by onReady() time", () => {
		const game = createTestGame();
		const scene = createTestScene(game);

		const childRef = ref<Node2D>();
		let refPopulatedAtReady = false;

		class Parent extends Node {
			override build() {
				return h(Node2D, { ref: childRef, name: "refTarget" }) as Node;
			}
			override onReady() {
				refPopulatedAtReady = childRef.current !== null;
			}
		}

		scene.add(new Parent());

		expect(childRef.current).toBeInstanceOf(Node2D);
		expect(childRef.current?.name).toBe("refTarget");
		expect(refPopulatedAtReady).toBe(true);
	});

	it("nested build() works (parent builds child, child builds grandchild)", () => {
		const game = createTestGame();
		const scene = createTestScene(game);

		const readyOrder: string[] = [];

		class Grandchild extends Node {
			override onReady() {
				readyOrder.push("grandchild");
			}
		}
		class Child extends Node {
			override build() {
				return h(Grandchild, null) as Node;
			}
			override onReady() {
				readyOrder.push("child");
			}
		}
		class Parent extends Node {
			override build() {
				return h(Child, null) as Node;
			}
			override onReady() {
				readyOrder.push("parent");
			}
		}

		scene.add(new Parent());

		// Bottom-up: grandchild -> child -> parent
		expect(readyOrder).toEqual(["grandchild", "child", "parent"]);

		game.stop();
	});

	it("build() + imperative add() in onReady() coexist", () => {
		const game = createTestGame();
		const scene = createTestScene(game);

		class Parent extends Node {
			override build() {
				return h(Node, { name: "from-build" }) as Node;
			}
			override onReady() {
				const n = new Node();
				n.name = "from-ready";
				this.add(n);
			}
		}

		const parent = new Parent();
		scene.add(parent);

		expect(parent.children).toHaveLength(2);
		expect(parent.children[0].name).toBe("from-build");
		expect(parent.children[1].name).toBe("from-ready");
	});

	it("nodes without build() (returns null) are unaffected", () => {
		const game = createTestGame();
		const scene = createTestScene(game);

		let readyCalled = false;

		class PlainNode extends Node {
			override onReady() {
				readyCalled = true;
			}
		}

		const node = new PlainNode();
		scene.add(node);

		expect(readyCalled).toBe(true);
		expect(node.children).toHaveLength(0);
		expect(node.isReady).toBe(true);

		game.stop();
	});

	it("Fragment return (multiple root nodes) works", () => {
		const game = createTestGame();
		const scene = createTestScene(game);

		class Parent extends Node {
			override build() {
				return h(
					Fragment,
					null,
					h(Node, { name: "a" }),
					h(Node, { name: "b" }),
					h(Node, { name: "c" }),
				);
			}
		}

		const parent = new Parent();
		scene.add(parent);

		expect(parent.children).toHaveLength(3);
		expect(parent.children.map((c) => c.name)).toEqual(["a", "b", "c"]);
	});

	it("JSX composition children + build() children coexist", () => {
		const game = createTestGame();
		const scene = createTestScene(game);

		class Parent extends Node {
			override build() {
				return h(Node, { name: "build-child" }) as Node;
			}
		}

		// Simulate JSX: <Parent><Node name="composition-child" /></Parent>
		const parent = h(Parent, null, h(Node, { name: "composition-child" })) as Node;
		scene.add(parent);

		expect(parent.children).toHaveLength(2);
		expect(parent.children[0].name).toBe("composition-child");
		expect(parent.children[1].name).toBe("build-child");
	});

	it("Scene with build() has children ready before scene.onReady()", () => {
		const game = createTestGame();
		let childCountAtReady = 0;

		class TestScene extends Scene {
			override build() {
				return h(Fragment, null, h(Node, { name: "child-a" }), h(Node, { name: "child-b" }));
			}
			override onReady() {
				childCountAtReady = this.children.length;
			}
		}

		game.start(TestScene);

		expect(childCountAtReady).toBe(2);
		expect(game.currentScene?.children).toHaveLength(2);

		game.stop();
	});

	it("nested build in Scene: Scene builds entity, entity builds sub-nodes", () => {
		const game = createTestGame();
		const readyOrder: string[] = [];

		class Weapon extends Node {
			override onReady() {
				readyOrder.push("weapon");
			}
		}

		class Player extends Node {
			override build() {
				return h(Weapon, { name: "sword" }) as Node;
			}
			override onReady() {
				readyOrder.push("player");
			}
		}

		class TestScene extends Scene {
			override build() {
				return h(Player, { name: "hero" }) as Node;
			}
			override onReady() {
				readyOrder.push("scene");
			}
		}

		game.start(TestScene);

		// weapon ready -> player ready -> scene.onReady()
		expect(readyOrder).toEqual(["weapon", "player", "scene"]);

		const scene = game.currentScene!;
		const player = scene.children[0];
		expect(player.name).toBe("hero");
		expect(player.children[0].name).toBe("sword");

		game.stop();
	});

	it("build() children are ready (isReady=true) at parent onReady time", () => {
		const game = createTestGame();
		const scene = createTestScene(game);

		let childReady = false;

		class Parent extends Node {
			override build() {
				return h(Node, { name: "child" }) as Node;
			}
			override onReady() {
				childReady = this.children[0]?.isReady ?? false;
			}
		}

		scene.add(new Parent());
		expect(childReady).toBe(true);

		game.stop();
	});
});
