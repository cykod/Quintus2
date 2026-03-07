import * as THREE from "three";
import { Node3D } from "./node3d.js";

export class MeshNode extends Node3D {
	/** Geometry for the mesh. Default: BoxGeometry(1,1,1). */
	geometry?: THREE.BufferGeometry;
	/** Material for the mesh. Default: MeshStandardMaterial({ color: 0xcccccc }). */
	material?: THREE.Material;
	/** Whether this mesh casts shadows. Default: false. */
	castShadow = false;
	/** Whether this mesh receives shadows. Default: false. */
	receiveShadow = false;

	protected override _createObject3D(): THREE.Mesh {
		const geo = this.geometry ?? new THREE.BoxGeometry(1, 1, 1);
		const mat = this.material ?? new THREE.MeshStandardMaterial({ color: 0xcccccc });
		const mesh = new THREE.Mesh(geo, mat);
		mesh.castShadow = this.castShadow;
		mesh.receiveShadow = this.receiveShadow;
		return mesh;
	}

	/** The underlying THREE.Mesh (typed convenience accessor). */
	get mesh(): THREE.Mesh {
		return this.object3d as THREE.Mesh;
	}

	override onDestroy(): void {
		this.mesh.geometry.dispose();
		if (Array.isArray(this.mesh.material)) {
			for (const m of this.mesh.material) m.dispose();
		} else {
			this.mesh.material.dispose();
		}
	}
}
