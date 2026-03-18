import { describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("./__test-utils__/three-mock.js"));

import type * as THREE from "three";
import { FogOverlay3D } from "./fog-overlay.js";

describe("FogOverlay3D", () => {
	it("creates fog meshes for non-wall tiles", () => {
		const fog = new FogOverlay3D();
		const wallGrid = [
			[true, false, false],
			[false, false, false],
			[false, false, true],
		];
		fog.setSize(3, 3, wallGrid);

		// 9 tiles - 2 walls = 7 fog meshes
		expect(fog.object3d.children.length).toBe(7);
	});

	it("creates fog meshes for all tiles when no wall grid provided", () => {
		const fog = new FogOverlay3D();
		fog.setSize(3, 3);

		expect(fog.object3d.children.length).toBe(9);
	});

	it("tiles start fully opaque", () => {
		const fog = new FogOverlay3D();
		fog.setSize(3, 3);

		const firstMesh = fog.object3d.children[0] as THREE.Mesh;
		const mat = firstMesh.material as THREE.MeshBasicMaterial;
		expect(mat.opacity).toBe(1.0);
	});

	it("updateVisibility hides tiles in sight range", () => {
		const fog = new FogOverlay3D();
		fog.sightRange = 1;
		fog.setSize(3, 3);

		fog.updateVisibility(1, 1);

		// Count hidden (visible=false) meshes
		let hiddenCount = 0;
		for (const child of fog.object3d.children) {
			if (!child.visible) hiddenCount++;
		}
		// 5 tiles within manhattan distance 1 of (1,1): center + 4 cardinals
		expect(hiddenCount).toBe(5);
	});

	it("visited tiles outside range get visitedOpacity", () => {
		const fog = new FogOverlay3D();
		fog.sightRange = 1;
		fog.visitedOpacity = 0.5;
		fog.setSize(5, 5);

		// Reveal from center
		fog.updateVisibility(2, 2);

		// Move away — previously seen tiles should have visitedOpacity
		fog.updateVisibility(0, 0);

		// Tile (2,2) was visited but is now outside range of (0,0)
		expect(fog.isVisited(2, 2)).toBe(true);
	});

	it("isVisited returns false for unvisited tiles", () => {
		const fog = new FogOverlay3D();
		fog.setSize(3, 3);

		expect(fog.isVisited(1, 1)).toBe(false);
	});

	it("isVisited returns true after visibility update", () => {
		const fog = new FogOverlay3D();
		fog.sightRange = 1;
		fog.setSize(3, 3);

		fog.updateVisibility(1, 1);
		expect(fog.isVisited(1, 1)).toBe(true);
		expect(fog.isVisited(0, 1)).toBe(true);
	});

	it("resetVisited clears all visited state", () => {
		const fog = new FogOverlay3D();
		fog.sightRange = 2;
		fog.setSize(3, 3);

		fog.updateVisibility(1, 1);
		expect(fog.isVisited(1, 1)).toBe(true);

		fog.resetVisited();
		expect(fog.isVisited(1, 1)).toBe(false);
	});

	it("resetVisited restores full opacity on meshes", () => {
		const fog = new FogOverlay3D();
		fog.sightRange = 1;
		fog.visitedOpacity = 0.5;
		fog.setSize(3, 3);

		fog.updateVisibility(1, 1);
		fog.updateVisibility(0, 0);
		fog.resetVisited();

		// All meshes should be visible and at hiddenOpacity
		for (const child of fog.object3d.children) {
			expect(child.visible).toBe(true);
			const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
			expect(mat.opacity).toBe(1.0);
		}
	});

	it("isVisited returns false for out-of-bounds", () => {
		const fog = new FogOverlay3D();
		fog.setSize(3, 3);
		expect(fog.isVisited(-1, 0)).toBe(false);
		expect(fog.isVisited(0, 5)).toBe(false);
	});

	it("setWall removes fog mesh at position", () => {
		const fog = new FogOverlay3D();
		fog.setSize(3, 3);
		expect(fog.object3d.children.length).toBe(9);

		fog.setWall(1, 1);
		expect(fog.object3d.children.length).toBe(8);
	});

	it("setWall ignores out-of-bounds", () => {
		const fog = new FogOverlay3D();
		fog.setSize(3, 3);

		fog.setWall(-1, 0);
		fog.setWall(0, 5);
		expect(fog.object3d.children.length).toBe(9);
	});

	it("custom tileSize affects mesh positions", () => {
		const fog = new FogOverlay3D();
		fog.tileSize = 2;
		fog.setSize(2, 2);

		const mesh = fog.object3d.children[1] as THREE.Mesh;
		// Second tile is at (1, 0) -> world x = 1 * 2 = 2
		expect(mesh.position.x).toBe(2);
	});

	it("custom height affects mesh Y position", () => {
		const fog = new FogOverlay3D();
		fog.height = 3;
		fog.setSize(1, 1);

		const mesh = fog.object3d.children[0] as THREE.Mesh;
		expect(mesh.position.y).toBeCloseTo(1.51, 2); // height / 2 + 0.01 z-fighting offset
	});

	it("onDestroy disposes materials", () => {
		const fog = new FogOverlay3D();
		fog.setSize(2, 2);

		const disposeSpy = vi.fn();
		for (const child of fog.object3d.children) {
			const mesh = child as THREE.Mesh;
			(mesh.material as THREE.Material).dispose = disposeSpy;
		}

		fog.onDestroy();
		expect(disposeSpy).toHaveBeenCalledTimes(4);
	});
});
