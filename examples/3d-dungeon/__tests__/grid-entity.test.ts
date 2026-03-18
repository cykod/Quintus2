import { describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("../../../packages/three/src/__test-utils__/three-mock.js"));

import { GridEntity3D } from "../entities/grid-entity.js";

vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
	GLTFLoader: class {
		loadAsync() {
			return Promise.resolve({});
		}
	},
}));

describe("GridEntity3D", () => {
	it("default grid position is (0, 0)", () => {
		const entity = new GridEntity3D();
		expect(entity.gridX).toBe(0);
		expect(entity.gridZ).toBe(0);
	});

	it("setting gridX updates world position.x", () => {
		const entity = new GridEntity3D();
		entity.gridX = 3;
		expect(entity.position.x).toBe(3); // TILE_SIZE = 1
		expect(entity.gridX).toBe(3);
	});

	it("setting gridZ updates world position.z", () => {
		const entity = new GridEntity3D();
		entity.gridZ = 5;
		expect(entity.position.z).toBe(5);
		expect(entity.gridZ).toBe(5);
	});

	it("setGridPosition updates both axes", () => {
		const entity = new GridEntity3D();
		entity.setGridPosition(2, 4);
		expect(entity.gridX).toBe(2);
		expect(entity.gridZ).toBe(4);
		expect(entity.position.x).toBe(2);
		expect(entity.position.z).toBe(4);
	});

	it("gridDistanceTo computes Manhattan distance", () => {
		const a = new GridEntity3D();
		a.setGridPosition(1, 1);

		const b = new GridEntity3D();
		b.setGridPosition(3, 5);

		expect(a.gridDistanceTo(b)).toBe(6); // |1-3| + |1-5| = 2 + 4
	});

	it("gridDistanceTo works with plain objects", () => {
		const entity = new GridEntity3D();
		entity.setGridPosition(0, 0);

		expect(entity.gridDistanceTo({ gridX: 2, gridZ: 3 })).toBe(5);
	});

	it("custom tileSize scales world position", () => {
		const entity = new GridEntity3D();
		entity.tileSize = 2;
		entity.gridX = 3;
		expect(entity.position.x).toBe(6); // 3 * 2
	});
});
