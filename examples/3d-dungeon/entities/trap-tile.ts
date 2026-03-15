import { GLTFModel, Node3D } from "@quintus/three";
import { TILE_SIZE } from "../config.js";

export class TrapTile extends Node3D {
	gridX = 0;
	gridZ = 0;

	override onReady(): void {
		this.add(GLTFModel, { src: "trap", castShadow: true });
		this.position.set(this.gridX * TILE_SIZE, 0.0, this.gridZ * TILE_SIZE);
	}
}
