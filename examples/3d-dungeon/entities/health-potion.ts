import { GLTFModel, Node3D } from "@quintus/three";
import { TILE_SIZE } from "../config.js";

export class HealthPotion extends Node3D {
	gridX = 0;
	gridZ = 0;
	private _elapsed = 0;

	override onReady(): void {
		this.add(GLTFModel, { src: "barrel", castShadow: true });
		this.position.set(this.gridX * TILE_SIZE, 0.0, this.gridZ * TILE_SIZE);
		this.scale.set(0.7, 0.7, 0.7);
	}

	override onUpdate(dt: number): void {
		this._elapsed += dt;
		this.position.y = 0.05 + Math.sin(this._elapsed * 2) * 0.05;
	}
}
