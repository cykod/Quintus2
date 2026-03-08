import { GLTFModel, MeshNode, Node3D } from "@quintus/three";
import * as THREE from "three";
import { hasModels } from "../assets.js";
import { TILE_SIZE } from "../config.js";

export class CoinItem extends Node3D {
	gridX = 0;
	gridZ = 0;

	private _elapsed = 0;

	override onReady(): void {
		if (hasModels(this.game)) {
			this.add(GLTFModel, { src: "coin" });
		} else {
			this.add(MeshNode, {
				geometry: new THREE.BoxGeometry(0.4, 0.1, 0.4),
				material: new THREE.MeshStandardMaterial({ color: 0xffdd44 }),
				castShadow: true,
			});
		}

		this.position.set(this.gridX * TILE_SIZE, 0.5, this.gridZ * TILE_SIZE);
	}

	override onUpdate(dt: number): void {
		this._elapsed += dt;
		this.rotation.y += dt * 2;
		this.position.y = 0.5 + Math.sin(this._elapsed * 3) * 0.1;
	}
}
