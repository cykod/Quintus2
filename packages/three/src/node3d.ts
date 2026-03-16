import type { NodeSnapshot } from "@quintus/core";
import { Node, Node2D } from "@quintus/core";
import * as THREE from "three";

export interface Node3DSnapshot extends NodeSnapshot {
	position: { x: number; y: number; z: number };
	rotation: { x: number; y: number; z: number; order: string };
	quaternion: { x: number; y: number; z: number; w: number };
	scale: { x: number; y: number; z: number };
	visible: boolean;
}

export class Node3D extends Node {
	/** @internal Used by BoneAttachment to prevent ThreeLayer from re-parenting. */
	_boneParented = false;

	/**
	 * The underlying Three.js object. Created lazily via _createObject3D()
	 * on first access. Subclasses override _createObject3D() to return
	 * Mesh, Light, Camera, etc.
	 */
	private _object3d: THREE.Object3D | null = null;

	get object3d(): THREE.Object3D {
		if (!this._object3d) {
			this._object3d = this._createObject3D();
			this._object3d.userData.quintusNodeId = this.id;
			this._object3d.visible = this._visible;
		}
		return this._object3d;
	}

	/**
	 * Override in subclasses to create the specific Three.js object.
	 * Called lazily on first access to `object3d`. At this point, all
	 * properties set via add(Class, { props }) have been applied.
	 */
	protected _createObject3D(): THREE.Object3D {
		return new THREE.Object3D();
	}

	/**
	 * Visible state. Stored as a backing field to avoid triggering
	 * lazy object3d creation during Object.assign.
	 */
	private _visible = true;

	get visible(): boolean {
		return this._object3d ? this._object3d.visible : this._visible;
	}

	set visible(v: boolean) {
		this._visible = v;
		if (this._object3d) this._object3d.visible = v;
	}

	// === Transform Accessors ===

	get position(): THREE.Vector3 {
		return this.object3d.position;
	}

	get rotation(): THREE.Euler {
		return this.object3d.rotation;
	}

	get quaternion(): THREE.Quaternion {
		return this.object3d.quaternion;
	}

	get scale(): THREE.Vector3 {
		return this.object3d.scale;
	}

	/** Look at a world position. */
	lookAt(x: number, y: number, z: number): void {
		this.object3d.lookAt(x, y, z);
	}

	// === Lifecycle ===

	override onEnterTree(): void {
		for (const child of this.children) {
			if (child instanceof Node2D) {
				console.warn(
					`Node2D "${child.name || child.constructor.name}" is a child of Node3D ` +
						`"${this.name || this.constructor.name}". Node2D cannot render under Node3D. ` +
						`Use Billboard for in-world 2D content.`,
				);
			}
		}
	}

	override onExitTree(): void {
		if (this._object3d?.parent) {
			this._object3d.parent.remove(this._object3d);
		}
	}

	// === Serialization ===

	override serialize(): Node3DSnapshot {
		const p = this.object3d.position;
		const r = this.object3d.rotation;
		const q = this.object3d.quaternion;
		const s = this.object3d.scale;
		return {
			...super.serialize(),
			position: { x: p.x, y: p.y, z: p.z },
			rotation: { x: r.x, y: r.y, z: r.z, order: r.order },
			quaternion: { x: q.x, y: q.y, z: q.z, w: q.w },
			scale: { x: s.x, y: s.y, z: s.z },
			visible: this.object3d.visible,
		};
	}
}
