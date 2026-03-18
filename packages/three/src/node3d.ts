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
	 * @internal When true, _walkSync parents this node's object3d directly
	 * to the Three.js scene root, ignoring the Quintus parent chain.
	 */
	_worldFreeze = false;

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
			// Sync cached transform values into the new object3d (only if modified from defaults,
			// so subclass _createObject3D() overrides are preserved)
			const p = this._position;
			if (p.x !== 0 || p.y !== 0 || p.z !== 0) {
				this._object3d.position.copy(p);
			}
			const r = this._rotation;
			if (r.x !== 0 || r.y !== 0 || r.z !== 0) {
				this._object3d.rotation.set(r.x, r.y, r.z, r.order);
			}
			const q = this._quaternion;
			if (q.x !== 0 || q.y !== 0 || q.z !== 0 || q.w !== 1) {
				this._object3d.quaternion.copy(q);
			}
			const s = this._scale;
			if (s.x !== 1 || s.y !== 1 || s.z !== 1) {
				this._object3d.scale.copy(s);
			}
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

	private _position = new THREE.Vector3();
	private _rotation = new THREE.Euler();
	private _quaternion = new THREE.Quaternion();
	private _scale = new THREE.Vector3(1, 1, 1);

	get position(): THREE.Vector3 {
		return this._object3d ? this._object3d.position : this._position;
	}

	get rotation(): THREE.Euler {
		return this._object3d ? this._object3d.rotation : this._rotation;
	}

	get quaternion(): THREE.Quaternion {
		return this._object3d ? this._object3d.quaternion : this._quaternion;
	}

	get scale(): THREE.Vector3 {
		return this._object3d ? this._object3d.scale : this._scale;
	}

	/** Look at a world position. */
	lookAt(x: number, y: number, z: number): void {
		this.object3d.lookAt(x, y, z);
	}

	/**
	 * Freeze this node's world transform. The node's object3d will be
	 * reparented to the Three.js scene root on the next render, keeping
	 * it at its current world position and orientation regardless of
	 * Quintus parent movement. Call before the parent moves.
	 */
	freezeWorldTransform(): void {
		const obj = this.object3d;
		// Compute world transform by walking up the Three.js parent chain
		obj.updateWorldMatrix(true, false);
		const worldPos = new THREE.Vector3();
		const worldQuat = new THREE.Quaternion();
		obj.getWorldPosition(worldPos);
		obj.getWorldQuaternion(worldQuat);
		// Store world values as local (they become local once scene-root-parented)
		obj.position.copy(worldPos);
		obj.quaternion.copy(worldQuat);
		this._worldFreeze = true;
	}

	// === Lifecycle ===

	override onEnterTree(): void {
		for (const child of this.children) {
			if (child instanceof Node2D) {
				console.warn(
					`[Quintus] Node2D "${child.name || child.constructor.name}" is a child of Node3D ` +
						`"${this.name || this.constructor.name}". Node2D nodes cannot render under a Node3D parent. ` +
						`Move it under a Node3D parent using Billboard for in-world 2D content, ` +
						`or set renderFixed=true for HUD/overlay elements.`,
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
