import type { ParticleConfig3D } from "@quintus/particles";
import { ParticleEmitter3D } from "@quintus/particles";
import { Node3D, PointLight } from "@quintus/three";

const TORCH_FIRE_CONFIG: ParticleConfig3D = {
	maxParticles: 120,
	emissionRate: 45,
	emissionShape3D: "point",
	initialSpeed: [0.5, 1],
	initialTheta: [0, 10],
	initialPhi: [0, 20, 0],
	gravityY: 3,
	drag: 0.02,
	turbulence: 2,
	size: [0.05, 0.15],
	sizeOverLife: [1, 0.5],
	colorStart: "#ffcc00",
	colorEnd: "#ff440088",
	blendMode: "additive",
	lifetime: [0.5, 0.8],
};

export class Torch extends Node3D {
	private _light!: PointLight;
	private _baseIntensity = 1.2;
	private _elapsed = 0;

	override onReady(): void {
		this._light = this.add(PointLight, {
			color: 0xff9933,
			intensity: this._baseIntensity,
			distance: 4,
			decay: 2,
		});
		this._light.position.set(0, 0.3, 0);

		const fire = this.add(ParticleEmitter3D, {
			config: TORCH_FIRE_CONFIG,
		});
		fire.position.set(0, 0.3, 0);
	}

	override onUpdate(dt: number): void {
		this._elapsed += dt;
		const flicker =
			Math.sin(this._elapsed * 12) * 0.15 +
			Math.sin(this._elapsed * 23.7) * 0.1 +
			Math.sin(this._elapsed * 37.3) * 0.05;
		this._light.light.intensity = this._baseIntensity + flicker;
	}
}
