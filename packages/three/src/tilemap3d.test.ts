import { describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("./__test-utils__/three-mock.js"));

import * as THREE from "three";
import { TileMap3D } from "./tilemap3d.js";

function makeMap(w: number, h: number): TileMap3D {
	const map = new TileMap3D();
	map.setSize(w, h);
	return map;
}

function defineTiles(map: TileMap3D, ...ids: number[]) {
	for (const id of ids) {
		map.defineTile(id, {
			geometry: new THREE.BoxGeometry(),
			material: new THREE.MeshStandardMaterial(),
		});
	}
}

describe("TileMap3D", () => {
	describe("setSize", () => {
		it("initializes grid dimensions and zeroed array", () => {
			const map = makeMap(4, 3);
			expect(map.width).toBe(4);
			expect(map.height).toBe(3);
			for (let r = 0; r < 3; r++) {
				for (let c = 0; c < 4; c++) {
					expect(map.getTile(c, r)).toBe(0);
				}
			}
		});
	});

	describe("setTile / getTile", () => {
		it("round-trips tile IDs", () => {
			const map = makeMap(3, 3);
			map.setTile(1, 2, 5);
			expect(map.getTile(1, 2)).toBe(5);
		});

		it("returns 0 for out-of-bounds getTile", () => {
			const map = makeMap(3, 3);
			expect(map.getTile(-1, 0)).toBe(0);
			expect(map.getTile(3, 0)).toBe(0);
			expect(map.getTile(0, -1)).toBe(0);
			expect(map.getTile(0, 3)).toBe(0);
		});

		it("ignores out-of-bounds setTile", () => {
			const map = makeMap(3, 3);
			map.setTile(-1, 0, 1);
			map.setTile(3, 0, 1);
			// No crash, grid unchanged
			expect(map.getTile(0, 0)).toBe(0);
		});
	});

	describe("fill", () => {
		it("sets all cells to given ID", () => {
			const map = makeMap(3, 2);
			map.fill(7);
			for (let r = 0; r < 2; r++) {
				for (let c = 0; c < 3; c++) {
					expect(map.getTile(c, r)).toBe(7);
				}
			}
		});
	});

	describe("defineTile", () => {
		it("stores tile definition", () => {
			const map = new TileMap3D();
			const geo = new THREE.BoxGeometry();
			const mat = new THREE.MeshStandardMaterial();
			map.defineTile(1, { geometry: geo, material: mat });
			// Verify it works by using it in a rebuild
			map.setSize(1, 1);
			map.setTile(0, 0, 1);
			map.rebuild();
			expect(map.object3d.children.length).toBe(1);
		});
	});

	describe("defineTileFromGLTF", () => {
		it("extracts first mesh from GLTF scene", () => {
			const map = new TileMap3D();
			const geo = new THREE.BoxGeometry();
			const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
			const scene = new THREE.Object3D();
			const mesh = new THREE.Mesh(geo, mat);
			scene.add(mesh);

			map.defineTileFromGLTF(1, scene, { offsetY: 1 });

			map.setSize(1, 1);
			map.setTile(0, 0, 1);
			map.rebuild();
			expect(map.object3d.children.length).toBe(1);
			const instMesh = map.object3d.children[0] as THREE.InstancedMesh;
			expect(instMesh.geometry).toBe(geo);
			expect(instMesh.material).toBe(mat);
		});

		it("warns on empty scene", () => {
			const map = new TileMap3D();
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			map.defineTileFromGLTF(1, new THREE.Object3D());
			expect(warn).toHaveBeenCalledWith("TileMap3D: no Mesh found for tile 1");
			warn.mockRestore();
		});

		it("handles multi-material mesh (uses first)", () => {
			const map = new TileMap3D();
			const geo = new THREE.BoxGeometry();
			const mat1 = new THREE.MeshStandardMaterial();
			const mat2 = new THREE.MeshStandardMaterial();
			const scene = new THREE.Object3D();
			const mesh = new THREE.Mesh(geo, mat1);
			mesh.material = [mat1, mat2];
			scene.add(mesh);

			map.defineTileFromGLTF(2, scene);
			map.setSize(1, 1);
			map.setTile(0, 0, 2);
			map.rebuild();
			const instMesh = map.object3d.children[0] as THREE.InstancedMesh;
			expect(instMesh.material).toBe(mat1);
		});
	});

	describe("rebuild", () => {
		it("creates one InstancedMesh per tile type", () => {
			const map = makeMap(4, 2);
			defineTiles(map, 1, 2);
			map.fill(1);
			map.setTile(0, 0, 2);
			map.setTile(1, 0, 2);
			map.rebuild();

			expect(map.object3d.children.length).toBe(2);
			const counts = map.object3d.children.map((c) => (c as THREE.InstancedMesh).count);
			counts.sort((a, b) => a - b);
			expect(counts).toEqual([2, 6]);
		});

		it("sets correct instance count per type", () => {
			const map = makeMap(3, 3);
			defineTiles(map, 1);
			map.fill(1);
			map.rebuild();

			const instMesh = map.object3d.children[0] as THREE.InstancedMesh;
			expect(instMesh.count).toBe(9);
		});

		it("removes old meshes on re-call (no accumulation)", () => {
			const map = makeMap(2, 2);
			defineTiles(map, 1);
			map.fill(1);
			map.rebuild();
			expect(map.object3d.children.length).toBe(1);

			map.rebuild();
			expect(map.object3d.children.length).toBe(1);
		});

		it("skips empty tiles (id=0)", () => {
			const map = makeMap(3, 3);
			defineTiles(map, 1);
			// Only set a few tiles, rest are 0
			map.setTile(0, 0, 1);
			map.setTile(1, 1, 1);
			map.rebuild();

			expect(map.object3d.children.length).toBe(1);
			const instMesh = map.object3d.children[0] as THREE.InstancedMesh;
			expect(instMesh.count).toBe(2);
		});

		it("produces no children for all-empty grid", () => {
			const map = makeMap(3, 3);
			defineTiles(map, 1);
			map.rebuild();
			expect(map.object3d.children.length).toBe(0);
		});

		it("applies castShadow and receiveShadow from tile def", () => {
			const map = makeMap(1, 1);
			map.defineTile(1, {
				geometry: new THREE.BoxGeometry(),
				material: new THREE.MeshStandardMaterial(),
				castShadow: true,
				receiveShadow: true,
			});
			map.setTile(0, 0, 1);
			map.rebuild();

			const instMesh = map.object3d.children[0] as THREE.InstancedMesh;
			expect(instMesh.castShadow).toBe(true);
			expect(instMesh.receiveShadow).toBe(true);
		});

		it("marks instanceMatrix.needsUpdate", () => {
			const map = makeMap(1, 1);
			defineTiles(map, 1);
			map.setTile(0, 0, 1);
			map.rebuild();

			const instMesh = map.object3d.children[0] as THREE.InstancedMesh;
			expect(instMesh.instanceMatrix.needsUpdate).toBe(true);
		});
	});

	describe("parseGrid", () => {
		it("sets size and tile IDs from string + charMap", () => {
			const map = new TileMap3D();
			defineTiles(map, 1, 2);
			map.parseGrid(["##", "..", "#."], { "#": 1, ".": 2 });

			expect(map.width).toBe(2);
			expect(map.height).toBe(3);
			expect(map.getTile(0, 0)).toBe(1);
			expect(map.getTile(1, 0)).toBe(1);
			expect(map.getTile(0, 1)).toBe(2);
			expect(map.getTile(1, 2)).toBe(2);
		});

		it("auto-calls rebuild", () => {
			const map = new TileMap3D();
			defineTiles(map, 1);
			map.parseGrid(["#"], { "#": 1 });
			// rebuild was called — children should exist
			expect(map.object3d.children.length).toBe(1);
		});

		it("leaves unmapped characters as 0", () => {
			const map = new TileMap3D();
			defineTiles(map, 1);
			map.parseGrid(["#."], { "#": 1 });
			expect(map.getTile(0, 0)).toBe(1);
			expect(map.getTile(1, 0)).toBe(0);
		});
	});

	describe("gridToWorld / worldToGrid", () => {
		it("converts grid coords to world position", () => {
			const map = new TileMap3D();
			map.tileSize = 2;
			const pos = map.gridToWorld(3, 5);
			expect(pos.x).toBe(6);
			expect(pos.y).toBe(0);
			expect(pos.z).toBe(10);
		});

		it("converts world position to grid coords", () => {
			const map = new TileMap3D();
			map.tileSize = 2;
			const grid = map.worldToGrid(new THREE.Vector3(6, 0, 10));
			expect(grid.col).toBe(3);
			expect(grid.row).toBe(5);
		});

		it("rounds to nearest tile for non-exact positions", () => {
			const map = new TileMap3D();
			map.tileSize = 2;
			const grid = map.worldToGrid(new THREE.Vector3(5.1, 0, 9.9));
			expect(grid.col).toBe(3);
			expect(grid.row).toBe(5);
		});
	});

	describe("isInBounds", () => {
		it("returns true for valid coords", () => {
			const map = makeMap(4, 3);
			expect(map.isInBounds(0, 0)).toBe(true);
			expect(map.isInBounds(3, 2)).toBe(true);
		});

		it("returns false for out-of-bounds coords", () => {
			const map = makeMap(4, 3);
			expect(map.isInBounds(-1, 0)).toBe(false);
			expect(map.isInBounds(4, 0)).toBe(false);
			expect(map.isInBounds(0, -1)).toBe(false);
			expect(map.isInBounds(0, 3)).toBe(false);
		});
	});

	describe("onDestroy", () => {
		it("removes instanced meshes from object3d", () => {
			const map = makeMap(2, 2);
			defineTiles(map, 1);
			map.fill(1);
			map.rebuild();
			expect(map.object3d.children.length).toBe(1);

			map.onDestroy();
			expect(map.object3d.children.length).toBe(0);
		});

		it("does not dispose shared geometry/material", () => {
			const geo = new THREE.BoxGeometry();
			const mat = new THREE.MeshStandardMaterial();
			const geoDispose = vi.spyOn(geo, "dispose");
			const matDispose = vi.spyOn(mat, "dispose");

			const map = makeMap(1, 1);
			map.defineTile(1, { geometry: geo, material: mat });
			map.setTile(0, 0, 1);
			map.rebuild();
			map.onDestroy();

			expect(geoDispose).not.toHaveBeenCalled();
			expect(matDispose).not.toHaveBeenCalled();
		});
	});
});
