import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("./__test-utils__/three-mock.js"));

import { Node, Node2D } from "@quintus/core";
import { Node3D } from "./node3d.js";

describe("Node3D", () => {
	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates object3d lazily", () => {
		const node = new Node3D();
		// Private field _object3d should not exist yet — test via serialize triggering creation
		const snap = node.serialize();
		expect(snap.position).toEqual({ x: 0, y: 0, z: 0 });
	});

	it("position delegates to object3d", () => {
		const node = new Node3D();
		node.position.set(1, 2, 3);
		expect(node.position.x).toBe(1);
		expect(node.position.y).toBe(2);
		expect(node.position.z).toBe(3);
	});

	it("rotation delegates to object3d", () => {
		const node = new Node3D();
		node.rotation.y = 1.5;
		expect(node.rotation.y).toBe(1.5);
	});

	it("quaternion delegates to object3d", () => {
		const node = new Node3D();
		expect(node.quaternion.w).toBe(1);
	});

	it("scale delegates to object3d", () => {
		const node = new Node3D();
		expect(node.scale.x).toBe(1);
		expect(node.scale.y).toBe(1);
		expect(node.scale.z).toBe(1);
	});

	it("visible syncs to object3d", () => {
		const node = new Node3D();
		node.visible = false;
		expect(node.visible).toBe(false);
		expect(node.object3d.visible).toBe(false);
	});

	it("visible works before object3d creation", () => {
		const node = new Node3D();
		// Set visible before accessing object3d
		node.visible = false;
		// Now access object3d — should get the backing field value
		expect(node.object3d.visible).toBe(false);
	});

	it("serialize includes 3D data", () => {
		const node = new Node3D();
		node.position.set(1, 2, 3);
		node.rotation.y = Math.PI;

		const snap = node.serialize();
		expect(snap.position).toEqual({ x: 1, y: 2, z: 3 });
		expect(snap.rotation.y).toBe(Math.PI);
		expect(snap.quaternion).toBeDefined();
		expect(snap.scale).toEqual({ x: 1, y: 1, z: 1 });
		expect(snap.visible).toBe(true);
	});

	it("object3d stores quintusNodeId in userData", () => {
		const node = new Node3D();
		expect(node.object3d.userData.quintusNodeId).toBe(node.id);
	});

	it("warns when Node2D is a child of Node3D", () => {
		const parent = new Node3D();
		const child = new Node2D();
		parent.add(child);
		parent.onEnterTree();

		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Node2D"));
	});

	it("does not warn when Node3D is child of Node3D", () => {
		const parent = new Node3D();
		const child = new Node3D();
		parent.add(child);
		parent.onEnterTree();

		expect(console.warn).not.toHaveBeenCalled();
	});

	it("onExitTree removes object3d from Three.js parent", () => {
		const node = new Node3D();
		const obj = node.object3d;
		// The mock's Object3D has add/remove with proper parent/children tracking
		// obj.parent is set by mock's add(), so onExitTree can call parent.remove()
		const mockParent = {
			children: [obj],
			remove(child: typeof obj) {
				const i = this.children.indexOf(child);
				if (i >= 0) this.children.splice(i, 1);
				(child as unknown as { parent: unknown }).parent = null;
			},
		};
		(obj as unknown as { parent: unknown }).parent = mockParent;
		expect(mockParent.children.length).toBe(1);

		node.onExitTree();
		expect(mockParent.children.length).toBe(0);
	});

	it("lookAt delegates to object3d", () => {
		const node = new Node3D();
		// Should not throw
		node.lookAt(0, 0, 0);
	});

	it("extends Node", () => {
		const node = new Node3D();
		expect(node).toBeInstanceOf(Node);
	});
});
