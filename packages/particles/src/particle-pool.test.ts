import { describe, expect, it } from "vitest";
import { ParticlePool } from "./particle-pool.js";

describe("ParticlePool", () => {
	it("starts with zero alive particles", () => {
		const pool = new ParticlePool(100);
		expect(pool.alive).toBe(0);
		expect(pool.capacity).toBe(100);
	});

	it("spawn() returns incrementing indices", () => {
		const pool = new ParticlePool(10);
		expect(pool.spawn()).toBe(0);
		expect(pool.spawn()).toBe(1);
		expect(pool.spawn()).toBe(2);
		expect(pool.alive).toBe(3);
	});

	it("spawn() returns -1 when pool is full", () => {
		const pool = new ParticlePool(2);
		expect(pool.spawn()).toBe(0);
		expect(pool.spawn()).toBe(1);
		expect(pool.spawn()).toBe(-1);
		expect(pool.alive).toBe(2);
	});

	it("spawn() initializes age to 0", () => {
		const pool = new ParticlePool(10);
		pool.age[0] = 999;
		pool.spawn();
		expect(pool.age[0]).toBe(0);
	});

	it("kill() swap-removes with last alive particle", () => {
		const pool = new ParticlePool(10);

		// Spawn 3 particles with distinct x values
		pool.spawn();
		pool.x[0] = 10;
		pool.spawn();
		pool.x[1] = 20;
		pool.spawn();
		pool.x[2] = 30;

		// Kill particle 0 → particle 2 moves to slot 0
		pool.kill(0);
		expect(pool.alive).toBe(2);
		expect(pool.x[0]).toBe(30); // swapped from slot 2
		expect(pool.x[1]).toBe(20); // unchanged
	});

	it("kill() last alive particle just decrements alive", () => {
		const pool = new ParticlePool(10);
		pool.spawn();
		pool.x[0] = 10;
		pool.spawn();
		pool.x[1] = 20;

		pool.kill(1);
		expect(pool.alive).toBe(1);
		expect(pool.x[0]).toBe(10); // unchanged
	});

	it("kill() swaps all array fields", () => {
		const pool = new ParticlePool(10);

		pool.spawn();
		pool.x[0] = 1;
		pool.y[0] = 2;
		pool.vx[0] = 3;
		pool.vy[0] = 4;
		pool.life[0] = 5;
		pool.r[0] = 0.1;

		pool.spawn();
		pool.x[1] = 10;
		pool.y[1] = 20;
		pool.vx[1] = 30;
		pool.vy[1] = 40;
		pool.life[1] = 50;
		pool.r[1] = 0.9;

		pool.kill(0);

		expect(pool.x[0]).toBe(10);
		expect(pool.y[0]).toBe(20);
		expect(pool.vx[0]).toBe(30);
		expect(pool.vy[0]).toBe(40);
		expect(pool.life[0]).toBe(50);
		expect(pool.r[0]).toBeCloseTo(0.9);
	});

	it("reset() kills all particles", () => {
		const pool = new ParticlePool(10);
		pool.spawn();
		pool.spawn();
		pool.spawn();
		expect(pool.alive).toBe(3);

		pool.reset();
		expect(pool.alive).toBe(0);
	});

	it("can spawn after kill frees space", () => {
		const pool = new ParticlePool(2);
		pool.spawn();
		pool.spawn();
		expect(pool.spawn()).toBe(-1);

		pool.kill(0);
		expect(pool.alive).toBe(1);
		expect(pool.spawn()).toBe(1);
	});
});
