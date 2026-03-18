import { GLTFModel } from "@quintus/three";
import { Direction } from "../direction.js";
import type { DungeonGrid } from "./dungeon-grid.js";
import { GridEntity3D } from "./grid-entity.js";

export class ExitStairs extends GridEntity3D {
	dungeonGrid!: DungeonGrid;

	/** Cardinal direction index the stairs descend toward (away from walkable tile). */
	descentDir = 2; // default south

	override onReady(): void {
		// Find which adjacent tile is walkable — stairs face away from it
		for (let dir = 0; dir < 4; dir++) {
			const nx = this.gridX + Direction.dx[dir];
			const nz = this.gridZ + Direction.dz[dir];
			if (this.dungeonGrid.isWalkable(nx, nz)) {
				// Descent is the opposite direction
				this.descentDir = (dir + 2) % 4;
				break;
			}
		}

		const model = this.add(GLTFModel, { src: "stairs" });
		// GLTF stairs model faces +Z; rotate to match descent direction
		model.rotation.y = Direction.angle[this.descentDir] + Math.PI;
		this.position.y = -1.0;
	}

	/** World-space descent direction vector (dx, dz). */
	get descentDX(): number {
		return Direction.dx[this.descentDir];
	}

	get descentDZ(): number {
		return Direction.dz[this.descentDir];
	}

	/** rotation.y value for an entity facing the descent direction. */
	get descentAngle(): number {
		return Direction.angle[this.descentDir];
	}
}
