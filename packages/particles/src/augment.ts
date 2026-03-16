import { Game, type Scene } from "@quintus/core";
import type { Vec2 } from "@quintus/math";
import type { ParticleConfig } from "./particle-config.js";
import { ParticleEmitter } from "./particle-emitter.js";

Object.defineProperty(Game.prototype, "emitParticles", {
	value: function (
		this: Game,
		config: ParticleConfig,
		position: Vec2,
		count?: number,
	): ParticleEmitter {
		const emitter = new ParticleEmitter(config);
		emitter.position = position;
		emitter.oneShot = true;
		if (count != null) {
			emitter.emitting = false;
		}
		const scene = this.currentScene as Scene | null;
		if (!scene) {
			throw new Error("Cannot emit particles: no active scene.");
		}
		scene.add(emitter);
		if (count != null) {
			emitter.burst(count);
		}
		return emitter;
	},
	configurable: true,
	writable: true,
});

declare module "@quintus/core" {
	interface Game {
		/** Create a one-shot particle burst at a position */
		emitParticles(config: ParticleConfig, position: Vec2, count?: number): ParticleEmitter;
	}
}
