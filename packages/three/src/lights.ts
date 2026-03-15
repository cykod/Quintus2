import * as THREE from "three";
import { Node3D } from "./node3d.js";

export class AmbientLight extends Node3D {
	color: THREE.ColorRepresentation = 0xffffff;
	intensity = 0.5;

	protected override _createObject3D(): THREE.AmbientLight {
		return new THREE.AmbientLight(this.color, this.intensity);
	}

	get light(): THREE.AmbientLight {
		return this.object3d as THREE.AmbientLight;
	}
}

export class DirectionalLight extends Node3D {
	color: THREE.ColorRepresentation = 0xffffff;
	intensity = 1;
	castShadow = false;
	shadowMapSize = 1024;
	/** Shadow camera frustum extent. Default covers a 30×30 unit area. */
	shadowExtent = 15;
	/** Shadow camera near plane. */
	shadowNear = 0.5;
	/** Shadow camera far plane. */
	shadowFar = 50;

	protected override _createObject3D(): THREE.DirectionalLight {
		const light = new THREE.DirectionalLight(this.color, this.intensity);
		if (this.castShadow) {
			light.castShadow = true;
			light.shadow.mapSize.set(this.shadowMapSize, this.shadowMapSize);
			const cam = light.shadow.camera;
			cam.left = -this.shadowExtent;
			cam.right = this.shadowExtent;
			cam.top = this.shadowExtent;
			cam.bottom = -this.shadowExtent;
			cam.near = this.shadowNear;
			cam.far = this.shadowFar;
			cam.updateProjectionMatrix();
		}
		return light;
	}

	get light(): THREE.DirectionalLight {
		return this.object3d as THREE.DirectionalLight;
	}

	override onDestroy(): void {
		this.light.shadow?.map?.dispose();
	}
}

export class PointLight extends Node3D {
	color: THREE.ColorRepresentation = 0xffffff;
	intensity = 1;
	distance = 0;
	decay = 2;
	castShadow = false;

	protected override _createObject3D(): THREE.PointLight {
		const light = new THREE.PointLight(this.color, this.intensity, this.distance, this.decay);
		if (this.castShadow) {
			light.castShadow = true;
		}
		return light;
	}

	get light(): THREE.PointLight {
		return this.object3d as THREE.PointLight;
	}

	override onDestroy(): void {
		this.light.shadow?.map?.dispose();
	}
}
