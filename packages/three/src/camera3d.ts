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

	/** @internal Shake state */
	private _shakeIntensity = 0;
	private _shakeDuration = 0;
	private _shakeTimer = 0;
	private _shakeOffset = new THREE.Vector3();

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

	/**
	 * Apply camera shake. Multiple concurrent shakes use the max intensity.
	 * @param intensity Maximum offset in world units per axis
	 * @param duration Duration in seconds before shake decays to zero
	 */
	shake(intensity: number, duration: number): void {
		// Use max intensity to avoid accumulation
		if (intensity > this._shakeIntensity) {
			this._shakeIntensity = intensity;
		}
		if (duration > this._shakeDuration - this._shakeTimer) {
			this._shakeDuration = duration;
			this._shakeTimer = 0;
		}
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

		// Apply camera shake
		if (this._shakeIntensity > 0) {
			// Remove previous shake offset
			this.position.x -= this._shakeOffset.x;
			this.position.y -= this._shakeOffset.y;
			this.position.z -= this._shakeOffset.z;

			this._shakeTimer += dt;
			if (this._shakeTimer >= this._shakeDuration) {
				// Shake complete
				this._shakeIntensity = 0;
				this._shakeDuration = 0;
				this._shakeTimer = 0;
				this._shakeOffset.set(0, 0, 0);
			} else {
				// Decay intensity linearly
				const remaining = 1 - this._shakeTimer / this._shakeDuration;
				const currentIntensity = this._shakeIntensity * remaining;
				this._shakeOffset.set(
					(Math.random() - 0.5) * 2 * currentIntensity,
					(Math.random() - 0.5) * 2 * currentIntensity,
					(Math.random() - 0.5) * 2 * currentIntensity,
				);
				this.position.x += this._shakeOffset.x;
				this.position.y += this._shakeOffset.y;
				this.position.z += this._shakeOffset.z;
			}
		}
	}

	private _registerAsActive(): void {
		const ctx = this.gameOrNull ? getThreeContext(this.game) : null;
		if (ctx) {
			ctx.activeCamera = this.camera;
		}
	}
}
