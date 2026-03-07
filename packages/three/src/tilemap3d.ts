import * as THREE from "three";
import { Node3D } from "./node3d.js";

export interface TileDef3D {
	geometry: THREE.BufferGeometry;
	material: THREE.Material;
	offsetY?: number;
	rotationY?: number;
	castShadow?: boolean;
	receiveShadow?: boolean;
}

export class TileMap3D extends Node3D {
	/** World units per grid cell. */
	tileSize = 2;
	/** Grid width in tiles. */
	width = 0;
	/** Grid height (depth) in tiles. */
	height = 0;

	private _grid: number[] = [];
	private _tileDefs = new Map<number, TileDef3D>();
	private _instancedMeshes: THREE.InstancedMesh[] = [];

	// --- Tile registration ---

	/** Register a tile type with geometry + material. */
	defineTile(id: number, def: TileDef3D): void {
		this._tileDefs.set(id, def);
	}

	/**
	 * Register a tile type from a GLTF scene.
	 * Extracts the first Mesh found, sharing its geometry and material.
	 */
	defineTileFromGLTF(
		id: number,
		gltfScene: THREE.Object3D,
		options?: Partial<Omit<TileDef3D, "geometry" | "material">>,
	): void {
		let foundMesh: THREE.Mesh | null = null;
		gltfScene.traverse((child) => {
			if (!foundMesh && child instanceof THREE.Mesh) {
				foundMesh = child;
			}
		});
		if (!foundMesh) {
			console.warn(`TileMap3D: no Mesh found for tile ${id}`);
			return;
		}
		const mesh = foundMesh as THREE.Mesh;
		const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		this.defineTile(id, {
			geometry: mesh.geometry,
			material: materials[0] as THREE.Material,
			...options,
		});
	}

	// --- Grid manipulation ---

	/** Allocate grid of given dimensions, filled with 0 (empty). */
	setSize(width: number, height: number): void {
		this.width = width;
		this.height = height;
		this._grid = new Array(width * height).fill(0);
	}

	/** Set tile ID at grid position. 0 = empty. */
	setTile(col: number, row: number, tileId: number): void {
		if (!this.isInBounds(col, row)) return;
		this._grid[row * this.width + col] = tileId;
	}

	/** Get tile ID at grid position. Returns 0 for out-of-bounds. */
	getTile(col: number, row: number): number {
		if (!this.isInBounds(col, row)) return 0;
		return this._grid[row * this.width + col] ?? 0;
	}

	/** Fill entire grid with a single tile ID. */
	fill(tileId: number): void {
		this._grid.fill(tileId);
	}

	/**
	 * Parse string-array level data with character-to-id mapping.
	 * Sets size from the input dimensions, fills grid, and calls rebuild().
	 */
	parseGrid(lines: string[], charMap: Record<string, number>): void {
		const h = lines.length;
		const w = Math.max(0, ...lines.map((l) => l.length));
		this.setSize(w, h);
		for (let row = 0; row < h; row++) {
			const line = lines[row] as string;
			for (let col = 0; col < line.length; col++) {
				const ch = line[col] as string;
				if (ch in charMap) {
					this._grid[row * w + col] = charMap[ch] as number;
				}
			}
		}
		this.rebuild();
	}

	// --- Rendering ---

	/**
	 * Rebuild all InstancedMesh objects from current grid state.
	 * Creates one THREE.InstancedMesh per tile type, sets instance matrices
	 * from grid positions. Old meshes are removed first.
	 */
	rebuild(): void {
		// 1. Remove old instanced meshes
		for (const mesh of this._instancedMeshes) {
			this.object3d.remove(mesh);
		}
		this._instancedMeshes = [];

		// 2. Count occurrences per tile type
		const counts = new Map<number, number>();
		for (const id of this._grid) {
			if (id === 0) continue;
			counts.set(id, (counts.get(id) ?? 0) + 1);
		}

		// 3. Create InstancedMesh per tile type
		for (const [tileId, count] of counts) {
			const def = this._tileDefs.get(tileId);
			if (!def) continue;

			const instMesh = new THREE.InstancedMesh(def.geometry, def.material, count);
			const matrix = new THREE.Matrix4();
			let idx = 0;

			for (let row = 0; row < this.height; row++) {
				for (let col = 0; col < this.width; col++) {
					if (this._grid[row * this.width + col] !== tileId) continue;

					matrix.makeTranslation(col * this.tileSize, def.offsetY ?? 0, row * this.tileSize);

					if (def.rotationY) {
						const rot = new THREE.Matrix4();
						rot.makeRotationY(def.rotationY);
						matrix.multiply(rot);
					}

					instMesh.setMatrixAt(idx, matrix);
					idx++;
				}
			}

			instMesh.castShadow = def.castShadow ?? false;
			instMesh.receiveShadow = def.receiveShadow ?? false;
			instMesh.instanceMatrix.needsUpdate = true;

			this.object3d.add(instMesh);
			this._instancedMeshes.push(instMesh);
		}
	}

	// --- Coordinate helpers ---

	/** Convert grid coords to world position. */
	gridToWorld(col: number, row: number): THREE.Vector3 {
		return new THREE.Vector3(col * this.tileSize, 0, row * this.tileSize);
	}

	/** Convert world position to grid coords (nearest tile). */
	worldToGrid(worldPos: THREE.Vector3): { col: number; row: number } {
		return {
			col: Math.round(worldPos.x / this.tileSize),
			row: Math.round(worldPos.z / this.tileSize),
		};
	}

	/** Check if grid coords are within bounds. */
	isInBounds(col: number, row: number): boolean {
		return col >= 0 && col < this.width && row >= 0 && row < this.height;
	}

	// --- Lifecycle ---

	/** Disposes InstancedMesh wrappers but NOT shared geometry/material. */
	override onDestroy(): void {
		for (const mesh of this._instancedMeshes) {
			this.object3d.remove(mesh);
		}
		this._instancedMeshes = [];
	}
}
