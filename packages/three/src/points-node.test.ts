import { describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("./__test-utils__/three-mock.js"));

import * as THREE from "three";
import { PointsNode } from "./points-node.js";

describe("PointsNode", () => {
	it("creates Points lazily", () => {
		const node = new PointsNode();
		expect(node.points).toBeInstanceOf(THREE.Points);
	});

	it("uses provided geometry and material", () => {
		const node = new PointsNode();
		const geo = new THREE.BufferGeometry();
		const mat = new THREE.PointsMaterial({ color: 0xff0000, size: 0.5 });
		node.geometry = geo;
		node.material = mat;
		expect(node.points.geometry).toBe(geo);
		expect(node.points.material).toBe(mat);
	});

	it("disposes on destroy", () => {
		const node = new PointsNode();
		const geo = new THREE.BufferGeometry();
		const mat = new THREE.PointsMaterial();
		node.geometry = geo;
		node.material = mat;

		const _points = node.points;
		const geoDispose = vi.spyOn(geo, "dispose");
		const matDispose = vi.spyOn(mat, "dispose");

		node.onDestroy();
		expect(geoDispose).toHaveBeenCalled();
		expect(matDispose).toHaveBeenCalled();
	});
});
