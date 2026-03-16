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

	it("60-frame lifecycle: particles spawn and some die", () => {
		const game = createGame();
		game.start(EmptyScene);

		const emitter = new ParticleEmitter({
			emissionRate: 60,
			lifetime: 0.5,
			maxParticles: 200,
		});
		(game.currentScene as Scene).add(emitter);

		for (let i = 0; i < 60; i++) game.step();

		// Particles were emitted
		const alive = emitter.aliveCount;
		expect(alive).toBeGreaterThan(0);
		// Some should have died (lifetime 0.5s = 30 frames at 60fps)
		// With 60 emitted per second for 1 second = 60 total, but first ones die after 0.5s
		expect(alive).toBeLessThan(60);

		game.stop();
	});

	it("burst at specific position: particles near that position at frame 0", () => {
		const game = createGame();
		game.start(EmptyScene);

		const emitter = new ParticleEmitter({
			emissionRate: 0,
			lifetime: 5,
			maxParticles: 50,
			initialSpeed: 0,
		});
		emitter.position = new Vec2(150, 100);
		(game.currentScene as Scene).add(emitter);

		// Step once so emitter enters tree and gets positioned
		game.step();

		// Burst particles
		emitter.burst(20);

		// Step one more frame so burst is processed
		game.step();

		expect(emitter.aliveCount).toBe(20);

		// Access pool to check positions — particles should be near emitter position
		const pool = (
			emitter as unknown as {
				_simulator: { pool: { x: Float32Array; y: Float32Array; alive: number } };
			}
		)._simulator.pool;
		for (let i = 0; i < pool.alive; i++) {
			// Particles in world space should be near the emitter's position
			// With zero speed and point emission, they should be at exactly the emission point
			expect(pool.x[i]).toBeCloseTo(0, 0); // emitted at local (0,0) relative to emitter
			expect(pool.y[i]).toBeCloseTo(0, 0);
		}

		game.stop();
	});

	it("local simulation space: particles track emitter movement", () => {
		const game = createGame();
		game.start(EmptyScene);

		const emitter = new ParticleEmitter({
			emissionRate: 0,
			lifetime: 10,
			maxParticles: 50,
			initialSpeed: 0,
			simulationSpace: "local",
		});
		emitter.position = new Vec2(100, 100);
		(game.currentScene as Scene).add(emitter);

		game.step();
		emitter.burst(5);
		game.step();

		// Move the emitter
		emitter.position = new Vec2(200, 200);
		game.step();

		// In local space, particles should NOT have moved relative to the emitter.
		// The pool positions stay near (0,0) in local coords because particles track emitter.
		const pool = (
			emitter as unknown as {
				_simulator: { pool: { x: Float32Array; y: Float32Array; alive: number } };
			}
		)._simulator.pool;
		for (let i = 0; i < pool.alive; i++) {
			// In local space with zero speed, particles stay at origin (emitter-relative)
			expect(Math.abs(pool.x[i]!)).toBeLessThan(5);
			expect(Math.abs(pool.y[i]!)).toBeLessThan(5);
		}

		game.stop();
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
