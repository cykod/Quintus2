import { Node3D } from "@quintus/three";
import { CAMERA_ORBIT_DURATION } from "../config.js";

/**
 * Intermediate pivot that sits between the player and the camera.
 * Q/E rotate it in 90° steps around the Y axis, letting the player
 * inspect the character from any side without affecting movement.
 */
export class CameraOrbit extends Node3D {
	private _targetAngle = 0;
	private _startAngle = 0;
	private _orbiting = false;
	private _orbitElapsed = 0;

	override onFixedUpdate(dt: number): void {
		if (this._orbiting) {
			this._orbitElapsed += dt;
			const t = Math.min(this._orbitElapsed / CAMERA_ORBIT_DURATION, 1);
			const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
			this.rotation.y = this._startAngle + (this._targetAngle - this._startAngle) * eased;
			if (t >= 1) {
				this._orbiting = false;
				this.rotation.y = this._targetAngle;
			}
			return;
		}

		const input = this.game.input;
		if (input.isJustPressed("camera_left")) {
			this._orbit(Math.PI / 2);
		} else if (input.isJustPressed("camera_right")) {
			this._orbit(-Math.PI / 2);
		}
	}

	private _orbit(delta: number): void {
		this._startAngle = this.rotation.y;
		this._targetAngle = this._startAngle + delta;
		this._orbitElapsed = 0;
		this._orbiting = true;
	}
}
