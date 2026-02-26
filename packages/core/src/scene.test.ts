import { Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { Game } from "./game.js";
import { Node } from "./node.js";
import { Node2D } from "./node2d.js";
import { Scene } from "./scene.js";

function createTestGame(): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 100, height: 100, canvas });
}

describe("Scene", () => {
	it("add(NodeClass) creates and adds node to tree", () => {
		const game = createTestGame();
		const scene = new Scene(game);
		const node = scene.add(Node2D);
		node.position = new Vec2(10, 20);
		node.name = "myNode";
		expect(node.position.equals(new Vec2(10, 20))).toBe(true);
		expect(node.name).toBe("myNode");
		expect(scene.children).toContain(node);
	});

	it("add(existing node) adds it", () => {
		const game = createTestGame();
		const scene = new Scene(game);
		const node = new Node();
		scene.add(node);
		expect(scene.children).toContain(node);
	});

	it("findAll(tag) searches entire tree", () => {
		const game = createTestGame();
		const scene = new Scene(game);
		const a = new Node();
		a.tag("enemy");
		const parent = new Node();
		const b = new Node();
		b.tag("enemy");
		parent.add(b);
		scene.add(a);
		scene.add(parent);
		expect(scene.findAll("enemy")).toHaveLength(2);
	});

	it("findAllByType(Type) searches entire tree", () => {
		const game = createTestGame();
		const scene = new Scene(game);
		class SpecialNode extends Node {}
		const parent = new Node();
		parent.add(new SpecialNode());
		scene.add(parent);
		scene.add(new SpecialNode());
		expect(scene.findAllByType(SpecialNode)).toHaveLength(2);
	});

	it("count(tag) returns correct count", () => {
		const game = createTestGame();
		const scene = new Scene(game);
		const n1 = new Node();
		n1.tag("a");
		const n2 = new Node();
		n2.tag("a");
		const n3 = new Node();
		n3.tag("b");
		scene.add(n1);
		scene.add(n2);
		scene.add(n3);
		expect(scene.count("a")).toBe(2);
	});

	it("paused flag", () => {
		const game = createTestGame();
		const scene = new Scene(game);
		expect(scene.paused).toBe(false);
		scene.paused = true;
		expect(scene.paused).toBe(true);
	});

	it("onFixedUpdate error is caught and reported via game.onError", () => {
		const game = createTestGame();
		const errorHandler = vi.fn();
		game.onError.connect(errorHandler);
		class TestScene extends Scene {
			onReady() {
				class BuggyNode extends Node {
					override onFixedUpdate(_dt: number): void {
						throw new Error("fixedUpdate oops");
					}
				}
				this.add(new BuggyNode());
			}
		}
		game.start(TestScene);
		game.step();
		expect(errorHandler).toHaveBeenCalled();
		expect(errorHandler.mock.calls[0]?.[0].lifecycle).toBe("onFixedUpdate");
	});

	it("onFixedUpdate error logged to console when no onError listener", () => {
		const game = createTestGame();
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		class TestScene extends Scene {
			onReady() {
				class BuggyNode extends Node {
					override onFixedUpdate(_dt: number): void {
						throw new Error("fixedUpdate oops");
					}
				}
				this.add(new BuggyNode());
			}
		}
		game.start(TestScene);
		game.step();
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it("switchTo destroys current scene and loads new one", () => {
		const game = createTestGame();
		const destroyed = vi.fn();

		class SceneA extends Scene {
			onReady() {
				const node = new Node();
				node.onDestroy = destroyed;
				this.add(node);
			}
		}
		class SceneB extends Scene {}

		game.start(SceneA);
		game.currentScene?.switchTo(SceneB);
		expect(destroyed).toHaveBeenCalled();
		expect(game.currentScene?.name).toBe("SceneB");
	});
});
