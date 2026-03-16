import { SeededRandom } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { resolveConfig3D } from "./particle-config-3d.js";
import type { ParticlePool3D } from "./particle-pool-3d.js";
import { ParticleSimulator3D } from "./particle-simulator-3d.js";

function makeSim(capacity = 200) {
	return new ParticleSimulator3D(capacity);
}

function makeConfig(overrides = {}) {
	return resolveConfig3D(overrides);
}

describe("ParticleSimulator3D", () => {
	it("pool is a ParticlePool3D with z/vz arrays", () => {
		const sim = makeSim();
		const pool = sim.pool as ParticlePool3D;
		expect(pool.z).toBeInstanceOf(Float32Array);
		expect(pool.vz).toBeInstanceOf(Float32Array);
	});

	describe("3D velocity from theta/phi", () => {
		it("theta=0 (straight up) sets vy=speed, vx≈0, vz≈0", () => {
			const sim = makeSim();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				initialSpeed: 100,
				initialTheta: 0,
				initialPhi: 0,
			});

			sim.burst(config, 1, 0, 0, rng);
			const pool = sim.pool as ParticlePool3D;
			expect(pool.vy[0]).toBeCloseTo(100, 1);
			expect(pool.vx[0]).toBeCloseTo(0, 1);
			expect(pool.vz[0]).toBeCloseTo(0, 1);
		});

		it("theta=90, phi=0 emits along +X", () => {
			const sim = makeSim();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				initialSpeed: 100,
				initialTheta: 90,
				initialPhi: 0,
			});

			sim.burst(config, 1, 0, 0, rng);
			const pool = sim.pool as ParticlePool3D;
			expect(pool.vx[0]).toBeCloseTo(100, 0);
			expect(pool.vy[0]).toBeCloseTo(0, 0);
			expect(pool.vz[0]).toBeCloseTo(0, 0);
		});

		it("theta=90, phi=90 emits along +Z", () => {
			const sim = makeSim();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				initialSpeed: 100,
				initialTheta: 90,
				initialPhi: 90,
			});

			sim.burst(config, 1, 0, 0, rng);
			const pool = sim.pool as ParticlePool3D;
			expect(pool.vx[0]).toBeCloseTo(0, 0);
			expect(pool.vy[0]).toBeCloseTo(0, 0);
			expect(pool.vz[0]).toBeCloseTo(100, 0);
		});

		it("theta=180 (straight down) sets vy=-speed", () => {
			const sim = makeSim();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				initialSpeed: 100,
				initialTheta: 180,
				initialPhi: 0,
			});

			sim.burst(config, 1, 0, 0, rng);
			const pool = sim.pool as ParticlePool3D;
			expect(pool.vy[0]).toBeCloseTo(-100, 0);
		});
	});

	describe("3D emission shapes", () => {
		it("point shape spawns at origin", () => {
			const sim = makeSim();
			const rng = new SeededRandom(1);
			const config = makeConfig({ emissionShape3D: "point" });

			sim.burst(config, 1, 10, 20, rng);
			const pool = sim.pool as ParticlePool3D;
			expect(pool.x[0]).toBe(10);
			expect(pool.y[0]).toBe(20);
			expect(pool.z[0]).toBe(0);
		});

		it("sphere shape spawns within radius", () => {
			const sim = makeSim();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				emissionShape3D: "sphere",
				emissionRadius: 50,
			});

			sim.burst(config, 100, 0, 0, rng);
			const pool = sim.pool as ParticlePool3D;
			for (let i = 0; i < pool.alive; i++) {
				const dist = Math.sqrt(
					(pool.x[i] as number) ** 2 + (pool.y[i] as number) ** 2 + (pool.z[i] as number) ** 2,
				);
				expect(dist).toBeLessThanOrEqual(50.01);
			}
		});

		it("hemisphere shape spawns with y >= 0", () => {
			const sim = makeSim();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				emissionShape3D: "hemisphere",
				emissionRadius: 50,
			});

			sim.burst(config, 100, 0, 0, rng);
			const pool = sim.pool as ParticlePool3D;
			for (let i = 0; i < pool.alive; i++) {
				expect(pool.y[i]).toBeGreaterThanOrEqual(-0.01);
				const dist = Math.sqrt(
					(pool.x[i] as number) ** 2 + (pool.y[i] as number) ** 2 + (pool.z[i] as number) ** 2,
				);
				expect(dist).toBeLessThanOrEqual(50.01);
			}
		});

		it("box shape spawns within half-extents", () => {
			const sim = makeSim();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				emissionShape3D: "box",
				emissionBoxX: 10,
				emissionBoxY: 20,
				emissionBoxZ: 30,
			});

			sim.burst(config, 100, 0, 0, rng);
			const pool = sim.pool as ParticlePool3D;
			for (let i = 0; i < pool.alive; i++) {
				expect(Math.abs(pool.x[i] as number)).toBeLessThanOrEqual(10.01);
				expect(Math.abs(pool.y[i] as number)).toBeLessThanOrEqual(20.01);
				expect(Math.abs(pool.z[i] as number)).toBeLessThanOrEqual(30.01);
			}
		});
	});

	describe("z-axis physics", () => {
		it("applies gravityZ", () => {
			const sim = makeSim();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				lifetime: 10,
				initialSpeed: 0,
				gravityZ: -100,
			});

			sim.burst(config, 1, 0, 0, rng);
			sim.update(config, 1, rng);

			const pool = sim.pool as ParticlePool3D;
			expect(pool.vz[0]).toBeCloseTo(-100, 0);
			expect(pool.z[0] as number).toBeLessThan(0);
		});

		it("applies drag to vz", () => {
			const sim = makeSim();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				lifetime: 10,
				initialSpeed: 100,
				initialTheta: 90,
				initialPhi: 90, // along +Z
				drag: 1,
			});

			sim.burst(config, 1, 0, 0, rng);
			const pool = sim.pool as ParticlePool3D;
			const initialVz = pool.vz[0] as number;
			expect(initialVz).toBeCloseTo(100, 0);

			sim.update(config, 1, rng);
			expect(pool.vz[0]).toBeCloseTo(100 * Math.exp(-1), 0);
		});

		it("applies 3D turbulence deterministically", () => {
			const makeRun = () => {
				const sim = makeSim();
				const rng = new SeededRandom(42);
				const config = makeConfig({
					lifetime: 10,
					initialSpeed: 0,
					turbulence: 50,
				});
				sim.burst(config, 1, 0, 0, rng);
				sim.update(config, 1 / 60, rng);
				const pool = sim.pool as ParticlePool3D;
				return { x: pool.x[0], y: pool.y[0], z: pool.z[0] };
			};

			const run1 = makeRun();
			const run2 = makeRun();
			expect(run1.x).toBe(run2.x);
			expect(run1.y).toBe(run2.y);
			expect(run1.z).toBe(run2.z);
		});

		it("kills particles when age >= life", () => {
			const sim = makeSim();
			const rng = new SeededRandom(1);
			const config = makeConfig({ lifetime: 0.5 });

			sim.burst(config, 5, 0, 0, rng);
			expect(sim.pool.alive).toBe(5);

			sim.update(config, 0.6, rng);
			expect(sim.pool.alive).toBe(0);
		});
	});

	describe("syncBuffers()", () => {
		it("copies position data to buffer", () => {
			const sim = makeSim();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				lifetime: 10,
				initialSpeed: 0,
				emissionShape3D: "point",
			});

			sim.burst(config, 2, 10, 20, rng);
			const pool = sim.pool as ParticlePool3D;
			pool.z[0] = 30;
			pool.z[1] = 60;

			const posAttr = { array: new Float32Array(6), needsUpdate: false };
			const colAttr = { array: new Float32Array(8), needsUpdate: false };
			const sizeAttr = { array: new Float32Array(2), needsUpdate: false };

			sim.syncBuffers(posAttr, colAttr, sizeAttr);

			expect(posAttr.array[0]).toBe(10); // x[0]
			expect(posAttr.array[1]).toBe(20); // y[0]
			expect(posAttr.array[2]).toBe(30); // z[0]
			expect(posAttr.needsUpdate).toBe(true);
		});

		it("lerps color over lifetime", () => {
			const sim = makeSim();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				lifetime: 1,
				initialSpeed: 0,
				colorStart: "#ff0000",
				colorEnd: "#0000ff",
			});

			sim.burst(config, 1, 0, 0, rng);
			// Manually set age to halfway
			sim.pool.age[0] = 0.5;
			sim.pool.life[0] = 1.0;

			const posAttr = { array: new Float32Array(3), needsUpdate: false };
			const colAttr = { array: new Float32Array(4), needsUpdate: false };
			const sizeAttr = { array: new Float32Array(1), needsUpdate: false };

			sim.syncBuffers(posAttr, colAttr, sizeAttr);

			// At t=0.5: lerp(1,0,0.5)=0.5 for R, lerp(0,0,0.5)=0 for G, lerp(0,1,0.5)=0.5 for B
			expect(colAttr.array[0]).toBeCloseTo(0.5, 1); // R
			expect(colAttr.array[1]).toBeCloseTo(0, 1); // G
			expect(colAttr.array[2]).toBeCloseTo(0.5, 1); // B
			expect(colAttr.needsUpdate).toBe(true);
		});

		it("applies size over life", () => {
			const sim = makeSim();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				lifetime: 1,
				initialSpeed: 0,
				size: 10,
				sizeOverLife: [1, 0],
			});

			sim.burst(config, 1, 0, 0, rng);
			sim.pool.age[0] = 0.5;
			sim.pool.life[0] = 1.0;

			const posAttr = { array: new Float32Array(3), needsUpdate: false };
			const colAttr = { array: new Float32Array(4), needsUpdate: false };
			const sizeAttr = { array: new Float32Array(1), needsUpdate: false };

			sim.syncBuffers(posAttr, colAttr, sizeAttr);

			// At t=0.5: size=10, scale=lerp(1,0,0.5)=0.5 → 5
			expect(sizeAttr.array[0]).toBeCloseTo(5, 1);
			expect(sizeAttr.needsUpdate).toBe(true);
		});
	});
});
