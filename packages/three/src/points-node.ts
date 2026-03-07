import * as THREE from "three";
import { Node3D } from "./node3d.js";

export class PointsNode extends Node3D {
	geometry?: THREE.BufferGeometry;
	material?: THREE.PointsMaterial;

	protected override _createObject3D(): THREE.Points {
		const geo = this.geometry ?? new THREE.BufferGeometry();
		const mat = this.material ?? new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });
		return new THREE.Points(geo, mat);
	}

	get points(): THREE.Points {
		return this.object3d as THREE.Points;
	}

	override onDestroy(): void {
		this.points.geometry.dispose();
		const mat = this.points.material;
		if (Array.isArray(mat)) {
			for (const m of mat) m.dispose();
		} else {
			mat.dispose();
		}
	}
}
