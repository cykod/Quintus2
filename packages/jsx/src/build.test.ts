import { Game, Node, Node2D, Scene } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { Fragment, h } from "./h.js";
import { ref } from "./ref.js";
// Import ref-scope to ensure resolver is registered on globalThis
import "./ref-scope.js";

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

		const scene = game.currentScene;
		expect(scene).toBeTruthy();
		const player = scene?.children[0];
		expect(player?.name).toBe("hero");
		expect(player?.children[0].name).toBe("sword");

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

// === String ref integration tests ===

describe("string ref lifecycle", () => {
	it("string refs are populated by onReady() time", () => {
		const game = createTestGame();
		const scene = createTestScene(game);

		let spriteAtReady: Node2D | undefined;

		class Parent extends Node {
			sprite?: Node2D;

			override build() {
				return h(Node2D, { ref: "sprite", name: "mySprite" }) as Node;
			}
			override onReady() {
				spriteAtReady = this.sprite;
			}
		}

		scene.add(new Parent());

		expect(spriteAtReady).toBeInstanceOf(Node2D);
		expect(spriteAtReady?.name).toBe("mySprite");

		game.stop();
	});

	it("nested build owners don't leak refs to outer owner", () => {
		const game = createTestGame();
		const scene = createTestScene(game);

		class Inner extends Node {
			innerChild?: Node;

			override build() {
				return h(Node, { ref: "innerChild", name: "inner-target" }) as Node;
			}
		}

		class Outer extends Node {
			outerChild?: Node;

			override build() {
				return h(
					Fragment,
					null,
					h(Node, { ref: "outerChild", name: "outer-target" }),
					h(Inner, null),
				);
			}
		}

		const outer = new Outer();
		scene.add(outer);

		// Outer's ref should be populated
		expect(outer.outerChild).toBeInstanceOf(Node);
		expect(outer.outerChild?.name).toBe("outer-target");

		// Outer should NOT have innerChild (that belongs to Inner)
		expect((outer as Record<string, unknown>).innerChild).toBeUndefined();

		// Inner's ref should be populated
		const inner = outer.children[1] as Inner;
		expect(inner.innerChild).toBeInstanceOf(Node);
		expect(inner.innerChild?.name).toBe("inner-target");

		game.stop();
	});
});

// === Dollar ref integration tests ===

describe("dollar ref lifecycle", () => {
	it("dollar refs resolve across build() children (Camera follow=$player)", () => {
		const game = createTestGame();

		class CameraNode extends Node {
			follow: Node | null = null;
			smoothing = 0;
		}

		class Player extends Node {}

		let cameraRef: CameraNode | undefined;
		let playerRef: Player | undefined;

		class TestScene extends Scene {
			camera?: CameraNode;
			player?: Player;

			override build() {
				return h(
					Fragment,
					null,
					h(CameraNode, { ref: "camera", follow: "$player", smoothing: 0.1 }),
					h(Player, { ref: "player", name: "hero" }),
				);
			}
			override onReady() {
				cameraRef = this.camera;
				playerRef = this.player;
			}
		}

		game.start(TestScene);

		expect(cameraRef).toBeInstanceOf(CameraNode);
		expect(playerRef).toBeInstanceOf(Player);
		expect(cameraRef?.follow).toBe(playerRef);
		expect(cameraRef?.smoothing).toBe(0.1);

		game.stop();
	});

	it("dollar refs resolve regardless of order (player before camera)", () => {
		const game = createTestGame();

		class CameraNode extends Node {
			follow: Node | null = null;
		}

		class Player extends Node {}

		class TestScene extends Scene {
			camera?: CameraNode;
			player?: Player;

			override build() {
				return h(
					Fragment,
					null,
					h(Player, { ref: "player", name: "hero" }),
					h(CameraNode, { ref: "camera", follow: "$player" }),
				);
			}
		}

		game.start(TestScene);

		const scene = game.currentScene as TestScene;
		expect(scene.camera?.follow).toBe(scene.player);

		game.stop();
	});
});

// === Callback ref integration tests ===

describe("callback ref lifecycle", () => {
	it("callback ref works inside build()", () => {
		const game = createTestGame();
		const scene = createTestScene(game);

		let capturedNode: Node2D | null = null;

		class Parent extends Node {
			override build() {
				return h(Node2D, {
					ref: (n: Node) => {
						capturedNode = n as Node2D;
					},
					name: "target",
				}) as Node;
			}
		}

		scene.add(new Parent());

		expect(capturedNode).toBeInstanceOf(Node2D);
		expect(capturedNode?.name).toBe("target");

		game.stop();
	});
});

// === Scene dollar ref integration tests ===

describe("scene dollar refs", () => {
	it("Scene dollar refs resolved before children enter tree", () => {
		const game = createTestGame();

		class CameraNode extends Node {
			follow: Node | null = null;
		}

		class Player extends Node {}

		let cameraFollowAtReady: Node | null = null;

		class TestScene extends Scene {
			camera?: CameraNode;
			player?: Player;

			override build() {
				return h(
					Fragment,
					null,
					h(CameraNode, { ref: "camera", follow: "$player" }),
					h(Player, { ref: "player" }),
				);
			}
			override onReady() {
				// By the time Scene.onReady fires, all built children are in tree and dollar refs resolved
				cameraFollowAtReady = this.camera?.follow ?? null;
			}
		}

		game.start(TestScene);

		const scene = game.currentScene as TestScene;
		expect(cameraFollowAtReady).toBe(scene.player);

		game.stop();
	});
});
