import * as THREE from "three";
import { Node3D } from "./node3d.js";
import { getThreeContext } from "./three-plugin.js";

export class Camera3D extends Node3D {
	/** Field of view in degrees. Default: 75. */
	fov = 75;
	/** Near clipping plane. Default: 0.1. */
	near = 0.1;
	/** Far clipping plane. Default: 1000. */
	far = 1000;
	/** Use orthographic instead of perspective. Default: false. */
	orthographic = false;
	/** Orthographic frustum size. Default: 10. */
	orthoSize = 10;
	/** Make this the active camera. Default: true. */
	active = true;

	/** Target node to follow (smooth follow). */
	follow: Node3D | null = null;
	/** Follow offset. */
	followOffset = new THREE.Vector3(0, 5, 10);
	/** Follow smoothing (0 = instant, higher = slower). */
	followSmoothing = 5;

	protected override _createObject3D(): THREE.Camera {
		if (this.orthographic) {
			return new THREE.OrthographicCamera(
				-this.orthoSize,
				this.orthoSize,
				this.orthoSize,
				-this.orthoSize,
				this.near,
				this.far,
			);
		}
		return new THREE.PerspectiveCamera(this.fov, 1, this.near, this.far);
	}

	/** The underlying THREE.Camera (typed convenience accessor). */
	get camera(): THREE.Camera {
		return this.object3d as THREE.Camera;
	}

	override onEnterTree(): void {
		super.onEnterTree();
		if (this.camera instanceof THREE.PerspectiveCamera) {
			const game = this.gameOrNull;
			if (game) {
				this.camera.aspect = game.width / game.height;
				this.camera.updateProjectionMatrix();
			}
		}
		if (this.active) {
			this._registerAsActive();
		}
	}

	override onUpdate(dt: number): void {
		if (this.camera instanceof THREE.PerspectiveCamera) {
			const game = this.gameOrNull;
			if (game) {
				const aspect = game.width / game.height;
				if (Math.abs(this.camera.aspect - aspect) > 0.001) {
					this.camera.aspect = aspect;
					this.camera.updateProjectionMatrix();
				}
			}
		}

		if (this.follow) {
			const target = this.follow.object3d.position;
			const desired = target.clone().add(this.followOffset);
			this.position.lerp(desired, 1 - Math.exp(-this.followSmoothing * dt));
			this.object3d.lookAt(target);
		}
	}

	private _registerAsActive(): void {
		const ctx = this.gameOrNull ? getThreeContext(this.game) : null;
		if (ctx) {
			ctx.activeCamera = this.camera;
		}
	}
}
