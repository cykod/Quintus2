import { Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { Game } from "./game.js";
import { Node } from "./node.js";
import { Node2D } from "./node2d.js";
import { defineScene, Scene } from "./scene.js";

function createTestGame(): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 100, height: 100, canvas });
}

describe("Scene", () => {
	it("add(NodeClass) creates and adds node to tree", () => {
		const game = createTestGame();
		const scene = new Scene("test", game);
		const node = scene.add(Node2D);
		node.position = new Vec2(10, 20);
		node.name = "myNode";
		expect(node.position.equals(new Vec2(10, 20))).toBe(true);
		expect(node.name).toBe("myNode");
		expect(scene.children).toContain(node);
	});

	it("add(existing node) adds it", () => {
		const game = createTestGame();
		const scene = new Scene("test", game);
		const node = new Node();
		scene.add(node);
		expect(scene.children).toContain(node);
	});

	it("findAll(tag) searches entire tree", () => {
		const game = createTestGame();
		const scene = new Scene("test", game);
		const a = new Node();
		a.tag("enemy");
		const parent = new Node();
		const b = new Node();
		b.tag("enemy");
		parent.addChild(b);
		scene.addChild(a);
		scene.addChild(parent);
		expect(scene.findAll("enemy")).toHaveLength(2);
	});

	it("findAllByType(Type) searches entire tree", () => {
		const game = createTestGame();
		const scene = new Scene("test", game);
		class SpecialNode extends Node {}
		const parent = new Node();
		parent.addChild(new SpecialNode());
		scene.addChild(parent);
		scene.addChild(new SpecialNode());
		expect(scene.findAllByType(SpecialNode)).toHaveLength(2);
	});

	it("count(tag) returns correct count", () => {
		const game = createTestGame();
		const scene = new Scene("test", game);
		const n1 = new Node();
		n1.tag("a");
		const n2 = new Node();
		n2.tag("a");
		const n3 = new Node();
		n3.tag("b");
		scene.addChild(n1);
		scene.addChild(n2);
		scene.addChild(n3);
		expect(scene.count("a")).toBe(2);
	});

	it("paused flag", () => {
		const game = createTestGame();
		const scene = new Scene("test", game);
		expect(scene.paused).toBe(false);
		scene.paused = true;
		expect(scene.paused).toBe(true);
	});

	it("defineScene() returns correct SceneDefinition", () => {
		const setup = vi.fn();
		const def = defineScene("myScene", setup);
		expect(def.name).toBe("myScene");
		expect(def.setup).toBe(setup);
	});

	it("scene setup function receives scene reference", () => {
		const game = createTestGame();
		const setup = vi.fn();
		game.scene("test", setup);
		game.start("test");
		expect(setup).toHaveBeenCalledTimes(1);
		expect(setup.mock.calls[0]?.[0]).toBeInstanceOf(Scene);
	});

	it("switchTo destroys current scene and loads new one", () => {
		const game = createTestGame();
		const destroyed = vi.fn();
		game.scene("a", (scene) => {
			const node = new Node();
			node.onDestroy = destroyed;
			scene.addChild(node);
		});
		game.scene("b", (_scene) => {});
		game.start("a");
		game.currentScene?.switchTo("b");
		expect(destroyed).toHaveBeenCalled();
		expect(game.currentScene?.name).toBe("b");
	});
});
