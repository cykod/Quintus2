import { describe, expect, it } from "vitest";
import { ParticlePool3D } from "./particle-pool-3d.js";

describe("ParticlePool3D", () => {
	it("starts with zero alive particles", () => {
		const pool = new ParticlePool3D(100);
		expect(pool.alive).toBe(0);
		expect(pool.capacity).toBe(100);
	});

	it("spawn() zeroes z and vz", () => {
		const pool = new ParticlePool3D(10);
		pool.z[0] = 999;
		pool.vz[0] = 999;

		pool.spawn();
		expect(pool.z[0]).toBe(0);
		expect(pool.vz[0]).toBe(0);
	});

	it("spawn() still zeroes age (inherited)", () => {
		const pool = new ParticlePool3D(10);
		pool.age[0] = 999;
		pool.spawn();
		expect(pool.age[0]).toBe(0);
	});

	it("kill() swaps z and vz along with base fields", () => {
		const pool = new ParticlePool3D(10);

		pool.spawn();
		pool.x[0] = 10;
		pool.z[0] = 100;
		pool.vz[0] = 200;

		pool.spawn();
		pool.x[1] = 20;
		pool.z[1] = 300;
		pool.vz[1] = 400;

		pool.spawn();
		pool.x[2] = 30;
		pool.z[2] = 500;
		pool.vz[2] = 600;

		// Kill particle 0 → particle 2 moves to slot 0
		pool.kill(0);
		expect(pool.alive).toBe(2);
		expect(pool.x[0]).toBe(30);
		expect(pool.z[0]).toBe(500);
		expect(pool.vz[0]).toBe(600);
	});

	it("reset() kills all particles", () => {
		const pool = new ParticlePool3D(10);
		pool.spawn();
		pool.spawn();
		pool.spawn();
		pool.reset();
		expect(pool.alive).toBe(0);
	});

	it("returns -1 when full", () => {
		const pool = new ParticlePool3D(2);
		expect(pool.spawn()).toBe(0);
		expect(pool.spawn()).toBe(1);
		expect(pool.spawn()).toBe(-1);
	});
});
