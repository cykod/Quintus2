import * as THREE from "three";
import { Node3D } from "./node3d.js";
import { getThreeContext } from "./three-plugin.js";

export class Billboard extends Node3D {
	width = 1;
	height = 1;
	axisLock = false;
	opacity = 1;

	protected override _createObject3D(): THREE.Sprite {
		const material = new THREE.SpriteMaterial({
			transparent: true,
			opacity: this.opacity,
		});
		const sprite = new THREE.Sprite(material);
		sprite.scale.set(this.width, this.height, 1);
		return sprite;
	}

	get sprite(): THREE.Sprite {
		return this.object3d as THREE.Sprite;
	}

	/** Set the texture from a loaded Three.js texture. */
	setTexture(texture: THREE.Texture): void {
		(this.sprite.material as THREE.SpriteMaterial).map = texture;
		(this.sprite.material as THREE.SpriteMaterial).needsUpdate = true;
	}

	override onUpdate(_dt: number): void {
		if (this.axisLock) {
			const ctx = this.gameOrNull ? getThreeContext(this.game) : null;
			const camera = ctx?.activeCamera;
			if (camera) {
				const pos = this.object3d.position;
				const camPos = camera.position;
				this.object3d.rotation.y = Math.atan2(camPos.x - pos.x, camPos.z - pos.z);
			}
		}
	}

	override onDestroy(): void {
		const mat = this.sprite.material as THREE.SpriteMaterial;
		mat.map?.dispose();
		mat.dispose();
	}
}
