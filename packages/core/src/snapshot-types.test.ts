import { describe, expect, it } from "vitest";
import { Node } from "./node.js";
import { Node2D } from "./node2d.js";

describe("Node.serialize()", () => {
	it("returns correct base snapshot", () => {
		const node = new Node();
		node.name = "TestNode";
		node.tag("enemy", "flying");

		const snap = node.serialize();
		expect(snap.type).toBe("Node");
		expect(snap.name).toBe("TestNode");
		expect(snap.tags).toEqual(["enemy", "flying"]);
		expect(snap.children).toEqual([]);
		expect(typeof snap.id).toBe("number");
	});

	it("serializes children recursively", () => {
		const parent = new Node();
		parent.name = "Parent";
		const child1 = new Node();
		child1.name = "Child1";
		const child2 = new Node();
		child2.name = "Child2";
		const grandchild = new Node();
		grandchild.name = "Grandchild";

		parent.add(child1);
		parent.add(child2);
		child1.add(grandchild);

		const snap = parent.serialize();
		expect(snap.children.length).toBe(2);
		expect(snap.children[0]?.name).toBe("Child1");
		expect(snap.children[1]?.name).toBe("Child2");
		expect(snap.children[0]?.children.length).toBe(1);
		expect(snap.children[0]?.children[0]?.name).toBe("Grandchild");
	});

	it("uses constructor name as type", () => {
		class Player extends Node {}
		const p = new Player();
		expect(p.serialize().type).toBe("Player");
	});
});

describe("Node2D.serialize()", () => {
	it("returns Node2DSnapshot with transform data", () => {
		const node = new Node2D();
		node.position._set(100, 200);
		node.rotation = Math.PI / 4;
		node.scale._set(2, 3);
		node.visible = false;
		node.zIndex = 5;

		const snap = node.serialize();
		expect(snap.position).toEqual({ x: 100, y: 200 });
		expect(snap.rotation).toBeCloseTo(Math.PI / 4);
		expect(snap.scale).toEqual({ x: 2, y: 3 });
		expect(snap.globalPosition.x).toBeCloseTo(100);
		expect(snap.globalPosition.y).toBeCloseTo(200);
		expect(snap.visible).toBe(false);
		expect(snap.zIndex).toBe(5);
	});

	it("includes globalPosition with parent offset", () => {
		const parent = new Node2D();
		parent.position._set(50, 50);
		const child = new Node2D();
		child.position._set(10, 20);
		parent.add(child);

		const snap = child.serialize();
		expect(snap.position).toEqual({ x: 10, y: 20 });
		expect(snap.globalPosition.x).toBeCloseTo(60);
		expect(snap.globalPosition.y).toBeCloseTo(70);
	});
});
