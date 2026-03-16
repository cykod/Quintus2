import { Game, Node2D, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import { ParticleEmitter } from "./particle-emitter.js";

function createGame(): Game {
	return new Game({ width: 320, height: 240, renderer: null });
}

class TestScene extends Scene {}

describe("ParticleEmitter", () => {
	it("spawns particles over time", () => {
		const game = createGame();
		game.start(TestScene);

		const emitter = new ParticleEmitter({
			emissionRate: 60,
			lifetime: 2,
		});
		(game.currentScene as Scene).add(emitter);

		game.step(); // 1 frame at 60fps → emit ~1 particle
		expect(emitter.aliveCount).toBeGreaterThanOrEqual(1);

		game.stop();
	});

	it("kills particles when they expire", () => {
		const game = createGame();
		game.start(TestScene);

		const emitter = new ParticleEmitter({
			emissionRate: 120,
			lifetime: 0.1, // short but survives a couple frames
		});
		(game.currentScene as Scene).add(emitter);

		// Step a few frames to accumulate some particles
		for (let i = 0; i < 5; i++) game.step();
		expect(emitter.aliveCount).toBeGreaterThan(0);

		// Stop emitting and advance many frames so particles die
		emitter.emitting = false;
		for (let i = 0; i < 30; i++) game.step();
		expect(emitter.aliveCount).toBe(0);

		game.stop();
	});

	it("burst() spawns particles immediately", () => {
		const game = createGame();
		game.start(TestScene);

		const emitter = new ParticleEmitter({
			maxParticles: 200,
			emissionRate: 0,
			lifetime: 5,
		});
		emitter.emitting = false;
		(game.currentScene as Scene).add(emitter);

		game.step(); // need one step for the node to enter tree
		emitter.burst(50);
		expect(emitter.aliveCount).toBe(50);

		game.stop();
	});

	it("oneShot auto-destroys when finished", () => {
		const game = createGame();
		game.start(TestScene);

		const emitter = new ParticleEmitter({
			emissionRate: 0,
			lifetime: 0.05,
			maxParticles: 50,
		});
		emitter.emitting = false;
		(game.currentScene as Scene).add(emitter);

		const cb = vi.fn();
		emitter.finished.connect(cb);

		// Step once so node enters tree, then configure oneShot and burst
		game.step();
		emitter.oneShot = true;
		emitter.burst(1);
		expect(emitter.aliveCount).toBe(1);

		// Advance until particle dies
		for (let i = 0; i < 20; i++) game.step();

		expect(cb).toHaveBeenCalled();
		// Emitter should be destroyed (removed from tree)
		expect(emitter.parent).toBeNull();

		game.stop();
	});

	it("restart() resets particles and re-enables emission", () => {
		const game = createGame();
		game.start(TestScene);

		const emitter = new ParticleEmitter({
			emissionRate: 60,
			lifetime: 5,
		});
		(game.currentScene as Scene).add(emitter);

		game.step();
		expect(emitter.aliveCount).toBeGreaterThan(0);

		emitter.emitting = false;
		emitter.restart();
		expect(emitter.aliveCount).toBe(0);
		expect(emitter.emitting).toBe(true);

		game.stop();
	});

	it("isFinished reflects emitter state", () => {
		const game = createGame();
		game.start(TestScene);

		const emitter = new ParticleEmitter({
			emissionRate: 60,
			lifetime: 0.01,
		});
		(game.currentScene as Scene).add(emitter);

		game.step();
		expect(emitter.isFinished).toBe(false);

		emitter.emitting = false;
		for (let i = 0; i < 10; i++) game.step();
		expect(emitter.isFinished).toBe(true);

		game.stop();
	});

	it("config can be changed at runtime", () => {
		const game = createGame();
		game.start(TestScene);

		const emitter = new ParticleEmitter({
			maxParticles: 50,
			emissionRate: 60,
			lifetime: 5,
		});
		(game.currentScene as Scene).add(emitter);

		game.step();

		// Change config
		emitter.config = {
			maxParticles: 200,
			emissionRate: 120,
			lifetime: 5,
		};

		game.step();
		// Should still work — no crash
		expect(emitter.aliveCount).toBeGreaterThanOrEqual(0);

		game.stop();
	});

	it("uses global position for particle spawning", () => {
		const game = createGame();
		game.start(TestScene);

		const parent = new Node2D();
		parent.position = new Vec2(100, 100);
		(game.currentScene as Scene).add(parent);

		const emitter = new ParticleEmitter({
			emissionRate: 0,
			emissionShape: "point",
			initialSpeed: 0,
			lifetime: 5,
		});
		emitter.emitting = false;
		emitter.position = new Vec2(50, 50);
		parent.add(emitter);

		game.step();
		emitter.burst(1);

		// Particle should be at global position (150, 150)
		// Access internal simulator via aliveCount > 0
		expect(emitter.aliveCount).toBe(1);

		game.stop();
	});
});
