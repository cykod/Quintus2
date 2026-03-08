import { GLTFModel, MeshNode, Node3D } from "@quintus/three";
import * as THREE from "three";
import { hasModels } from "../assets.js";
import { TILE_SIZE } from "../config.js";

export class ExitStairs extends Node3D {
	gridX = 0;
	gridZ = 0;

	override onReady(): void {
		if (hasModels(this.game)) {
			this.add(GLTFModel, { src: "stairs" });
		} else {
			this.add(MeshNode, {
				geometry: new THREE.BoxGeometry(TILE_SIZE * 0.8, 0.5, TILE_SIZE * 0.8),
				material: new THREE.MeshStandardMaterial({ color: 0x44cc44 }),
			});
		}

		this.position.set(this.gridX * TILE_SIZE, 0.25, this.gridZ * TILE_SIZE);
	}
}
