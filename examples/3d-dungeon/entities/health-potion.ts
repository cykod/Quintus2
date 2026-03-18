import { GLTFModel } from "@quintus/three";
import { GridEntity3D } from "./grid-entity.js";

export class HealthPotion extends GridEntity3D {
	private _elapsed = 0;

	override onReady(): void {
		this.add(GLTFModel, { src: "barrel", castShadow: true });
		this.scale.set(0.7, 0.7, 0.7);
	}

	override onUpdate(dt: number): void {
		this._elapsed += dt;
		this.position.y = 0.05 + Math.sin(this._elapsed * 2) * 0.05;
	}
}
