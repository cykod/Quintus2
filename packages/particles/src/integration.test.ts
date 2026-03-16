import { Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { ParticleEmitter } from "./particle-emitter.js";
import { ParticlePlugin } from "./particle-plugin.js";
import "./augment.js";

function createGame(): Game {
	return new Game({ width: 320, height: 240, renderer: null });
}

class EmptyScene extends Scene {}

describe("Particle integration", () => {
	it("game.emitParticles() creates a one-shot emitter", () => {
		const game = createGame();
		game.use(ParticlePlugin());
		game.start(EmptyScene);

		const emitter = game.emitParticles(
			{ lifetime: 0.01, maxParticles: 50 },
			new Vec2(100, 100),
			10,
		);

		expect(emitter).toBeInstanceOf(ParticleEmitter);
		expect(emitter.oneShot).toBe(true);
		expect(emitter.aliveCount).toBe(10);

		// After enough frames, particles die and emitter auto-destroys
		for (let i = 0; i < 20; i++) game.step();
		expect(emitter.parent).toBeNull();

		game.stop();
	});

	it("deterministic simulation produces same results with same seed", () => {
		function runSimulation(seed: number) {
			const game = new Game({
				width: 320,
				height: 240,
				renderer: null,
				seed,
			});
			game.start(EmptyScene);

			const emitter = new ParticleEmitter({
				emissionRate: 60,
				lifetime: 1,
				initialSpeed: [50, 100],
				initialAngle: [-120, -60],
				gravityY: 200,
			});
			(game.currentScene as Scene).add(emitter);

			for (let i = 0; i < 30; i++) game.step();

			const result = {
				alive: emitter.aliveCount,
			};

			game.stop();
			return result;
		}

		const run1 = runSimulation(12345);
		const run2 = runSimulation(12345);

		expect(run1.alive).toBe(run2.alive);
	});

	it("multiple emitters run independently", () => {
		const game = createGame();
		game.start(EmptyScene);

		const fire = new ParticleEmitter({
			emissionRate: 30,
			lifetime: 1,
		});
		fire.position = new Vec2(100, 100);

		const rain = new ParticleEmitter({
			emissionRate: 60,
			lifetime: 2,
		});
		rain.position = new Vec2(200, 0);

		const scene = game.currentScene as Scene;
		scene.add(fire);
		scene.add(rain);

		for (let i = 0; i < 60; i++) game.step();

		expect(fire.aliveCount).toBeGreaterThan(0);
		expect(rain.aliveCount).toBeGreaterThan(0);

		game.stop();
	});
});
