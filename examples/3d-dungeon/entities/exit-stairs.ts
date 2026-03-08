import { GLTFModel, Node3D } from "@quintus/three";
import { TILE_SIZE } from "../config.js";

export class ExitStairs extends Node3D {
	gridX = 0;
	gridZ = 0;

	override onReady(): void {
		this.add(GLTFModel, { src: "stairs" });
		this.position.set(this.gridX * TILE_SIZE, 0.25, this.gridZ * TILE_SIZE);
	}
}
