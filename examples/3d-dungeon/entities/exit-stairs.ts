import { GLTFModel, Node3D } from "@quintus/three";
import { TILE_SIZE } from "../config.js";
import type { DungeonGrid } from "./dungeon-grid.js";

/** Cardinal deltas: 0=North(-Z), 1=East(+X), 2=South(+Z), 3=West(-X). */
const DIR_DX = [0, 1, 0, -1];
const DIR_DZ = [-1, 0, 1, 0];
const DIR_ANGLE = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

export class ExitStairs extends Node3D {
	gridX = 0;
	gridZ = 0;
	dungeonGrid!: DungeonGrid;

	/** Cardinal direction index the stairs descend toward (away from walkable tile). */
	descentDir = 2; // default south

	override onReady(): void {
		// Find which adjacent tile is walkable — stairs face away from it
		for (let dir = 0; dir < 4; dir++) {
			const nx = this.gridX + DIR_DX[dir];
			const nz = this.gridZ + DIR_DZ[dir];
			if (this.dungeonGrid.isWalkable(nx, nz)) {
				// Descent is the opposite direction
				this.descentDir = (dir + 2) % 4;
				break;
			}
		}

		const model = this.add(GLTFModel, { src: "stairs" });
		// GLTF stairs model faces +Z; rotate to match descent direction
		model.rotation.y = DIR_ANGLE[this.descentDir] + Math.PI;
		this.position.set(this.gridX * TILE_SIZE, -1.0, this.gridZ * TILE_SIZE);
	}

	/** World-space descent direction vector (dx, dz). */
	get descentDX(): number {
		return DIR_DX[this.descentDir];
	}

	get descentDZ(): number {
		return DIR_DZ[this.descentDir];
	}

	/** rotation.y value for an entity facing the descent direction. */
	get descentAngle(): number {
		return DIR_ANGLE[this.descentDir];
	}
}
