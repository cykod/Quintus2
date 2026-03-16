import { Node3D } from "@quintus/three";

export class CameraShake extends Node3D {
	private _intensity = 0;
	private _decay = 0;
	private _timer = 0;

	/** Trigger a shake. intensity = max offset in world units, duration in seconds. */
	shake(intensity: number, duration: number): void {
		this._intensity = intensity;
		this._decay = intensity / duration;
		this._timer = duration;
	}

	override onFixedUpdate(dt: number): void {
		if (this._timer <= 0) return;

		this._timer -= dt;
		this._intensity = Math.max(0, this._intensity - this._decay * dt);

		const rx = (Math.random() - 0.5) * 2 * this._intensity;
		const ry = (Math.random() - 0.5) * 2 * this._intensity;
		const rz = (Math.random() - 0.5) * 2 * this._intensity;
		this.position.set(rx, ry, rz);

		if (this._timer <= 0) {
			this.position.set(0, 0, 0);
		}
	}
}
