import { describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("./__test-utils__/three-mock.js"));

import * as THREE from "three";
import { MeshNode } from "./mesh-node.js";

describe("MeshNode", () => {
	it("creates mesh lazily with defaults", () => {
		const node = new MeshNode();
		expect(node.mesh).toBeInstanceOf(THREE.Mesh);
	});

	it("uses provided geometry and material", () => {
		const node = new MeshNode();
		const geo = new THREE.BoxGeometry(2, 2, 2);
		const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
		node.geometry = geo;
		node.material = mat;
		const mesh = node.mesh;
		expect(mesh.geometry).toBe(geo);
		expect(mesh.material).toBe(mat);
	});

	it("applies shadow properties", () => {
		const node = new MeshNode();
		node.castShadow = true;
		node.receiveShadow = true;
		const mesh = node.mesh;
		expect(mesh.castShadow).toBe(true);
		expect(mesh.receiveShadow).toBe(true);
	});

	it("disposes GPU resources on destroy", () => {
		const node = new MeshNode();
		const geo = new THREE.BoxGeometry();
		const mat = new THREE.MeshStandardMaterial();
		node.geometry = geo;
		node.material = mat;

		// Access to trigger creation
		const _mesh = node.mesh;
		const geoDispose = vi.spyOn(geo, "dispose");
		const matDispose = vi.spyOn(mat, "dispose");

		node.onDestroy();

		expect(geoDispose).toHaveBeenCalled();
		expect(matDispose).toHaveBeenCalled();
	});
});
