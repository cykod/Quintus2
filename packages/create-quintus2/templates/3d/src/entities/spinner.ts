import { MeshNode } from "quintus2/three";
import * as THREE from "three";

/**
 * A cube that spins a little every fixed step.
 *
 * `MeshNode` builds a `THREE.Mesh` from the `geometry` + `material` you assign.
 * Swap the geometry (sphere, torus…) or material color to change how it looks.
 */
export class Spinner extends MeshNode {
	override geometry = new THREE.BoxGeometry(1, 1, 1);
	override material = new THREE.MeshStandardMaterial({ color: 0x44aa88 });

	override onFixedUpdate(dt: number): void {
		this.rotation.x += dt * 0.5;
		this.rotation.y += dt * 0.7;
	}
}
