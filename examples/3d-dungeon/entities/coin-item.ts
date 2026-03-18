import { GLTFModel } from "@quintus/three";
import { GridEntity3D } from "./grid-entity.js";

export class CoinItem extends GridEntity3D {
	private _elapsed = 0;

	override onReady(): void {
		this.add(GLTFModel, { src: "coin", castShadow: true });
		this.position.y = 0.3;
	}

	override onUpdate(dt: number): void {
		this._elapsed += dt;
		this.rotation.y += dt * 2;
		this.position.y = 0.3 + Math.sin(this._elapsed * 3) * 0.1;
	}
}
