import * as THREE from "three";
import { GLTFModel } from "./gltf-model.js";
import { Node3D } from "./node3d.js";

/**
 * Attaches its object3d to a named bone in a parent GLTFModel.
 *
 * Add as a child of the GLTFModel (or nested under it). On ready,
 * walks up the scene tree to find the nearest GLTFModel ancestor,
 * looks up the bone by name, and reparents this node's object3d
 * under the bone. Three.js propagates bone transforms automatically,
 * so no per-frame update is needed.
 *
 * ```ts
 * player.add(BoneAttachment, {
 *     boneName: "arm-right",
 *     offset: new THREE.Vector3(0, -0.15, 0),
 * }).add(GLTFModel, { src: "weapon-sword" });
 * ```
 */
export class BoneAttachment extends Node3D {
	/** Name of the bone to attach to. */
	boneName = "";

	/** Position offset in bone-local space. */
	offset: THREE.Vector3 = new THREE.Vector3();

	/** Rotation offset in bone-local space. */
	offsetRotation: THREE.Euler = new THREE.Euler();

	override onReady(): void {
		this._resolve();
	}

	override onExitTree(): void {
		if (this._boneParented && this.object3d.parent) {
			this.object3d.parent.remove(this.object3d);
			this._boneParented = false;
		}
	}

	/** Re-resolve the bone attachment (e.g. after model reload). */
	resolve(): void {
		this._resolve();
	}

	private _resolve(): void {
		if (!this.boneName) return;

		// Walk up the scene tree to find the nearest GLTFModel ancestor
		let current = this.parent;
		while (current) {
			if (current instanceof GLTFModel) {
				const bone = current.findBone(this.boneName);
				if (bone) {
					bone.add(this.object3d);
					this._boneParented = true;
					this.object3d.position.set(this.offset.x, this.offset.y, this.offset.z);
					this.object3d.rotation.set(
						this.offsetRotation.x,
						this.offsetRotation.y,
						this.offsetRotation.z,
						this.offsetRotation.order,
					);
				} else {
					console.warn(
						`BoneAttachment: bone "${this.boneName}" not found in ` +
							`"${current.name || current.constructor.name}".`,
					);
				}
				return;
			}
			current = current.parent;
		}

		console.warn(`BoneAttachment: no GLTFModel ancestor found for bone "${this.boneName}".`);
	}
}
