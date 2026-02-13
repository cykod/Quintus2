import { Color, Matrix2D, Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { Game } from "./game.js";
import { Node2D } from "./node2d.js";
import { Scene } from "./scene.js";

function createTestScene(): Scene {
	const canvas = document.createElement("canvas");
	const game = new Game({ width: 100, height: 100, canvas });
	return new Scene("test", game);
}

describe("Node2D", () => {
	// === Local Transform ===
	it("position, rotation, scale getters/setters", () => {
		const node = new Node2D();
		node.position = new Vec2(10, 20);
		node.rotation = Math.PI / 2;
		node.scale = new Vec2(2, 3);
		expect(node.position.equals(new Vec2(10, 20))).toBe(true);
		expect(node.rotation).toBe(Math.PI / 2);
		expect(node.scale.equals(new Vec2(2, 3))).toBe(true);
	});

	it("localTransform matches Matrix2D.compose(pos, rot, scale)", () => {
		const node = new Node2D();
		const pos = new Vec2(10, 20);
		const rot = Math.PI / 4;
		const scl = new Vec2(2, 3);
		node.position = pos;
		node.rotation = rot;
		node.scale = scl;
		const expected = Matrix2D.compose(pos, rot, scl);
		expect(node.localTransform.approxEquals(expected)).toBe(true);
	});

	// === Global Transform Cascade ===
	it("child inherits parent transform", () => {
		const scene = createTestScene();
		const parent = new Node2D();
		parent.position = new Vec2(100, 0);
		const child = new Node2D();
		child.position = new Vec2(10, 0);
		parent.addChild(child);
		scene.addChild(parent);
		expect(child.globalPosition.approxEquals(new Vec2(110, 0))).toBe(true);
	});

	it("moving parent updates child globalPosition", () => {
		const scene = createTestScene();
		const parent = new Node2D();
		const child = new Node2D();
		child.position = new Vec2(10, 0);
		parent.addChild(child);
		scene.addChild(parent);
		parent.position = new Vec2(50, 0);
		expect(child.globalPosition.approxEquals(new Vec2(60, 0))).toBe(true);
	});

	it("rotating parent rotates child around parent", () => {
		const scene = createTestScene();
		const parent = new Node2D();
		parent.rotation = Math.PI / 2;
		const child = new Node2D();
		child.position = new Vec2(10, 0);
		parent.addChild(child);
		scene.addChild(parent);
		expect(child.globalPosition.approxEquals(new Vec2(0, 10))).toBe(true);
	});

	it("scaling parent scales child position", () => {
		const scene = createTestScene();
		const parent = new Node2D();
		parent.scale = new Vec2(2, 2);
		const child = new Node2D();
		child.position = new Vec2(10, 5);
		parent.addChild(child);
		scene.addChild(parent);
		expect(child.globalPosition.approxEquals(new Vec2(20, 10))).toBe(true);
	});

	it("nested transforms (grandchild)", () => {
		const scene = createTestScene();
		const gp = new Node2D();
		gp.position = new Vec2(100, 0);
		const parent = new Node2D();
		parent.position = new Vec2(50, 0);
		const child = new Node2D();
		child.position = new Vec2(10, 0);
		gp.addChild(parent);
		parent.addChild(child);
		scene.addChild(gp);
		expect(child.globalPosition.approxEquals(new Vec2(160, 0))).toBe(true);
	});

	// === Dirty Flag Behavior ===
	it("setting position marks transform dirty", () => {
		const scene = createTestScene();
		const parent = new Node2D();
		const child = new Node2D();
		child.position = new Vec2(10, 0);
		parent.addChild(child);
		scene.addChild(parent);
		// Access to compute + cache
		child.globalTransform;
		// Change parent
		parent.position = new Vec2(50, 0);
		// Child should recompute
		expect(child.globalPosition.approxEquals(new Vec2(60, 0))).toBe(true);
	});

	it("mutating position.x/y through proxy marks transform dirty", () => {
		const scene = createTestScene();
		const parent = new Node2D();
		const child = new Node2D();
		child.position = new Vec2(10, 0);
		parent.addChild(child);
		scene.addChild(parent);
		// Force compute + cache
		child.globalTransform;
		// Mutate parent position through proxy
		parent.position.x = 50;
		// Child should recompute
		expect(child.globalPosition.approxEquals(new Vec2(60, 0))).toBe(true);
	});

	it("mutating scale.x/y through proxy marks transform dirty", () => {
		const scene = createTestScene();
		const node = new Node2D();
		node.position = new Vec2(10, 5);
		scene.addChild(node);
		node.localTransform; // Force compute
		node.scale.x = 2;
		node.scale.y = 3;
		const lt = node.localTransform;
		const expected = Matrix2D.compose(new Vec2(10, 5), 0, new Vec2(2, 3));
		expect(lt.approxEquals(expected)).toBe(true);
	});

	// === Global Position Setter ===
	it("setting globalPosition computes correct local position", () => {
		const scene = createTestScene();
		const parent = new Node2D();
		parent.position = new Vec2(100, 50);
		const child = new Node2D();
		parent.addChild(child);
		scene.addChild(parent);
		child.globalPosition = new Vec2(150, 75);
		expect(child.position.approxEquals(new Vec2(50, 25))).toBe(true);
	});

	// === Coordinate Conversion ===
	it("toLocal inverts transform correctly", () => {
		const scene = createTestScene();
		const node = new Node2D();
		node.position = new Vec2(100, 200);
		scene.addChild(node);
		const local = node.toLocal(new Vec2(110, 210));
		expect(local.approxEquals(new Vec2(10, 10))).toBe(true);
	});

	it("toGlobal applies transform correctly", () => {
		const scene = createTestScene();
		const node = new Node2D();
		node.position = new Vec2(100, 200);
		scene.addChild(node);
		const global = node.toGlobal(new Vec2(10, 10));
		expect(global.approxEquals(new Vec2(110, 210))).toBe(true);
	});

	// === Visibility ===
	it("visible defaults to true", () => {
		const node = new Node2D();
		expect(node.visible).toBe(true);
	});

	// === Tint ===
	it("default tint is Color.WHITE", () => {
		const node = new Node2D();
		expect(node.tint.equals(Color.WHITE)).toBe(true);
	});

	it("effectiveTint inherits parent tint", () => {
		const scene = createTestScene();
		const parent = new Node2D();
		parent.tint = new Color(1, 0.5, 0.5, 1);
		const child = new Node2D();
		parent.addChild(child);
		scene.addChild(parent);
		const eff = child.effectiveTint;
		expect(eff.r).toBeCloseTo(1);
		expect(eff.g).toBeCloseTo(0.5);
		expect(eff.b).toBeCloseTo(0.5);
	});

	it("changing parent tint dirties child effectiveTint", () => {
		const scene = createTestScene();
		const parent = new Node2D();
		const child = new Node2D();
		parent.addChild(child);
		scene.addChild(parent);
		// Force cache
		child.effectiveTint;
		parent.tint = new Color(0.5, 0.5, 0.5, 1);
		const eff = child.effectiveTint;
		expect(eff.r).toBeCloseTo(0.5);
	});

	it("selfTint only affects self, not children", () => {
		const scene = createTestScene();
		const parent = new Node2D();
		parent.selfTint = new Color(0.5, 0.5, 0.5, 1);
		const child = new Node2D();
		parent.addChild(child);
		scene.addChild(parent);
		// Parent's effectiveTint includes selfTint
		expect(parent.effectiveTint.r).toBeCloseTo(0.5);
		// Child should NOT inherit selfTint
		expect(child.effectiveTint.r).toBeCloseTo(1);
	});

	it("nested tint multiplication is correct", () => {
		const scene = createTestScene();
		const gp = new Node2D();
		gp.tint = new Color(0.5, 1, 1, 1);
		const parent = new Node2D();
		parent.tint = new Color(1, 0.5, 1, 1);
		const child = new Node2D();
		gp.addChild(parent);
		parent.addChild(child);
		scene.addChild(gp);
		const eff = child.effectiveTint;
		expect(eff.r).toBeCloseTo(0.5);
		expect(eff.g).toBeCloseTo(0.5);
		expect(eff.b).toBeCloseTo(1);
	});

	// === hasVisualContent ===
	it("default hasVisualContent is false", () => {
		const node = new Node2D();
		expect(node._hasVisualContent).toBe(false);
	});

	it("subclass with hasVisualContent = true", () => {
		class VisualNode extends Node2D {
			override hasVisualContent = true;
		}
		const node = new VisualNode();
		expect(node._hasVisualContent).toBe(true);
	});

	// === Global rotation and scale ===
	it("globalRotation", () => {
		const scene = createTestScene();
		const parent = new Node2D();
		parent.rotation = Math.PI / 4;
		const child = new Node2D();
		child.rotation = Math.PI / 4;
		parent.addChild(child);
		scene.addChild(parent);
		expect(child.globalRotation).toBeCloseTo(Math.PI / 2);
	});

	it("globalScale", () => {
		const scene = createTestScene();
		const parent = new Node2D();
		parent.scale = new Vec2(2, 3);
		const child = new Node2D();
		child.scale = new Vec2(4, 5);
		parent.addChild(child);
		scene.addChild(parent);
		const gs = child.globalScale;
		expect(gs.x).toBeCloseTo(8);
		expect(gs.y).toBeCloseTo(15);
	});

	// === zIndex ===
	it("zIndex defaults to 0", () => {
		const node = new Node2D();
		expect(node.zIndex).toBe(0);
	});
});
