import { Node3D } from "@quintus/three";
import * as THREE from "three";
import { FOG_HIDDEN_OPACITY, FOG_SIGHT_RANGE, FOG_VISITED_OPACITY } from "../config.js";

/** Height of fog cubes — tall enough to fill the tile from floor to above the walls. */
const FOG_CUBE_HEIGHT = 1.5;

/**
 * Fog of war overlay — hides tiles beyond the player's sight range using
 * opaque black cubes that completely block vision.
 *
 * - Tiles within sight range: cube hidden (visible = false)
 * - Previously visited tiles outside range: semi-transparent cube
 * - Never-visited tiles: fully opaque cube
 */
export class FogOfWar extends Node3D {
	private _width = 0;
	private _height = 0;
	private _visited: boolean[][] = [];
	private _meshes: (THREE.Mesh | null)[][] = [];
	private _materials: THREE.MeshBasicMaterial[] = [];

	/**
	 * Initialize the fog grid. Call once after the dungeon grid is parsed.
	 * @param width Grid width in tiles
	 * @param height Grid height in tiles
	 * @param wallGrid 2D boolean array — true = wall tile (no fog mesh)
	 */
	init(width: number, height: number, wallGrid: boolean[][]): void {
		this._width = width;
		this._height = height;
		this._visited = Array.from({ length: height }, () => Array(width).fill(false) as boolean[]);
		this._meshes = Array.from({ length: height }, () => Array(width).fill(null) as null[]);

		const geo = new THREE.BoxGeometry(1, FOG_CUBE_HEIGHT, 1);

		for (let z = 0; z < height; z++) {
			for (let x = 0; x < width; x++) {
				if (wallGrid[z][x]) continue;

				const mat = new THREE.MeshBasicMaterial({
					color: 0x000000,
					transparent: true,
					opacity: FOG_HIDDEN_OPACITY,
					depthWrite: true,
				});
				const mesh = new THREE.Mesh(geo, mat);
				mesh.position.set(x, FOG_CUBE_HEIGHT / 2, z);
				this.object3d.add(mesh);
				this._meshes[z][x] = mesh;
				this._materials.push(mat);
			}
		}
	}

	/**
	 * Update fog based on the player's current grid position.
	 * Tiles within manhattan distance of FOG_SIGHT_RANGE become visible.
	 */
	updatePlayerPosition(gridX: number, gridZ: number): void {
		// Mark tiles in range as visited
		for (let z = 0; z < this._height; z++) {
			for (let x = 0; x < this._width; x++) {
				const dist = Math.abs(x - gridX) + Math.abs(z - gridZ);
				if (dist <= FOG_SIGHT_RANGE) {
					this._visited[z][x] = true;
				}
			}
		}

		// Update visibility/opacity for all fog meshes
		for (let z = 0; z < this._height; z++) {
			for (let x = 0; x < this._width; x++) {
				const mesh = this._meshes[z][x];
				if (!mesh) continue;

				const dist = Math.abs(x - gridX) + Math.abs(z - gridZ);
				const mat = mesh.material as THREE.MeshBasicMaterial;

				if (dist <= FOG_SIGHT_RANGE) {
					mesh.visible = false;
				} else if (this._visited[z][x]) {
					mesh.visible = true;
					mat.opacity = FOG_VISITED_OPACITY;
				} else {
					mesh.visible = true;
					mat.opacity = FOG_HIDDEN_OPACITY;
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
