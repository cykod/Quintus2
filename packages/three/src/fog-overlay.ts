import * as THREE from "three";
import { Node3D } from "./node3d.js";

/**
 * Fog of war overlay for tile-based games.
 *
 * Covers the grid with opaque cubes that hide tiles from view.
 * Tiles within sight range are fully hidden (invisible cubes),
 * visited tiles outside range show semi-transparent cubes,
 * and never-visited tiles show fully opaque cubes.
 */
export class FogOverlay3D extends Node3D {
	/** World units per tile. Default: 1. */
	tileSize = 1;

	/** Manhattan distance for sight range. Default: 3. */
	sightRange = 3;

	/** Opacity for never-visited tiles. Default: 1.0. */
	hiddenOpacity = 1.0;

	/** Opacity for previously visited tiles outside range. Default: 0.5. */
	visitedOpacity = 0.5;

	/** Height of fog cubes. Default: 1.5. */
	height = 1.5;

	private _width = 0;
	private _depth = 0;
	private _visited: boolean[][] = [];
	private _meshes: (THREE.Mesh | null)[][] = [];
	private _materials: THREE.MeshBasicMaterial[] = [];

	/**
	 * Initialize the fog grid. Call once after dungeon layout is known.
	 * @param width Grid width in tiles
	 * @param depth Grid depth in tiles
	 * @param wallGrid 2D boolean array — true = wall tile (no fog mesh created)
	 */
	setSize(width: number, depth: number, wallGrid?: boolean[][]): void {
		this._width = width;
		this._depth = depth;
		this._visited = Array.from({ length: depth }, () => Array(width).fill(false) as boolean[]);
		this._meshes = Array.from({ length: depth }, () => Array(width).fill(null) as null[]);

		// Slightly larger cubes so fog fully covers wall faces
		const outset = this.tileSize * 0.02;
		const cubeSize = this.tileSize + outset * 2;
		const geo = new THREE.BoxGeometry(cubeSize, this.height, cubeSize);

		for (let z = 0; z < depth; z++) {
			for (let x = 0; x < width; x++) {
				if (wallGrid?.[z]?.[x]) continue;

				const mat = new THREE.MeshBasicMaterial({
					color: 0x000000,
					transparent: true,
					opacity: this.hiddenOpacity,
					depthWrite: true,
				});
				// Push fog fragments forward in the depth buffer so fog wins over walls
				mat.polygonOffset = true;
				mat.polygonOffsetFactor = -1;
				mat.polygonOffsetUnits = -1;

				const mesh = new THREE.Mesh(geo, mat);
				mesh.position.set(x * this.tileSize, this.height / 2 + 0.01, z * this.tileSize);
				this.object3d.add(mesh);
				(this._meshes[z] as (THREE.Mesh | null)[])[x] = mesh;
				this._materials.push(mat);
			}
		}
	}

	/**
	 * Mark a tile as a wall (removes its fog mesh if present).
	 */
	setWall(col: number, row: number): void {
		if (row < 0 || row >= this._depth || col < 0 || col >= this._width) return;
		const rowArr = this._meshes[row] as (THREE.Mesh | null)[];
		const mesh = rowArr[col];
		if (mesh) {
			this.object3d.remove(mesh);
			rowArr[col] = null;
		}
	}

	/**
	 * Update visibility based on a source grid position.
	 * Tiles within sightRange (Manhattan distance) become visible (mesh hidden).
	 */
	updateVisibility(sourceCol: number, sourceRow: number): void {
		// Mark tiles in range as visited
		for (let z = 0; z < this._depth; z++) {
			const visitedRow = this._visited[z] as boolean[];
			for (let x = 0; x < this._width; x++) {
				const dist = Math.abs(x - sourceCol) + Math.abs(z - sourceRow);
				if (dist <= this.sightRange) {
					visitedRow[x] = true;
				}
			}
		}

		// Update visibility/opacity
		for (let z = 0; z < this._depth; z++) {
			const meshRow = this._meshes[z] as (THREE.Mesh | null)[];
			const visitedRow = this._visited[z] as boolean[];
			for (let x = 0; x < this._width; x++) {
				const mesh = meshRow[x];
				if (!mesh) continue;

				const dist = Math.abs(x - sourceCol) + Math.abs(z - sourceRow);
				const mat = mesh.material as THREE.MeshBasicMaterial;

				if (dist <= this.sightRange) {
					mesh.visible = false;
				} else if (visitedRow[x]) {
					mesh.visible = true;
					mat.opacity = this.visitedOpacity;
				} else {
					mesh.visible = true;
					mat.opacity = this.hiddenOpacity;
				}
			}
		}
	}

	/**
	 * Check if a tile has been visited.
	 */
	isVisited(col: number, row: number): boolean {
		if (row < 0 || row >= this._depth || col < 0 || col >= this._width) return false;
		return (this._visited[row] as boolean[])[col] ?? false;
	}

	/**
	 * Reset all visited state and restore full opacity.
	 */
	resetVisited(): void {
		for (let z = 0; z < this._depth; z++) {
			const visitedRow = this._visited[z] as boolean[];
			const meshRow = this._meshes[z] as (THREE.Mesh | null)[];
			for (let x = 0; x < this._width; x++) {
				visitedRow[x] = false;
				const mesh = meshRow[x];
				if (mesh) {
					mesh.visible = true;
					(mesh.material as THREE.MeshBasicMaterial).opacity = this.hiddenOpacity;
				}
			}
		}
	}

	override onDestroy(): void {
		for (const mat of this._materials) {
			mat.dispose();
		}
	}
}
