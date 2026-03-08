import { GLTFModel, Node3D } from "@quintus/three";
import { TILE_SIZE } from "../config.js";

export class CoinItem extends Node3D {
	gridX = 0;
	gridZ = 0;

	private _elapsed = 0;

	override onReady(): void {
		this.add(GLTFModel, { src: "coin" });
		this.position.set(this.gridX * TILE_SIZE, 0, this.gridZ * TILE_SIZE);
	}

	override onUpdate(dt: number): void {
		this._elapsed += dt;
		this.rotation.y += dt * 2;
		this.position.y = Math.sin(this._elapsed * 3) * 0.1;
	}
}
