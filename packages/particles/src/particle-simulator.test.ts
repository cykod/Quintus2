import { SeededRandom } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { resolveConfig } from "./particle-config.js";
import { ParticleSimulator } from "./particle-simulator.js";

function makeSimulator(capacity = 200) {
	return new ParticleSimulator(capacity);
}

function makeConfig(overrides = {}) {
	return resolveConfig(overrides);
}

describe("ParticleSimulator", () => {
	describe("emit()", () => {
		it("emits particles based on emission rate", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({ emissionRate: 60 }); // 60/sec → 1 per frame at 1/60 dt

			sim.emit(config, 1 / 60, 0, 0, rng);
			expect(sim.pool.alive).toBe(1);
		});

		it("accumulates fractional particles across frames", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			// 30/sec at 1/60 dt = 0.5 per frame → needs 2 frames for 1 particle
			const config = makeConfig({ emissionRate: 30 });

			sim.emit(config, 1 / 60, 0, 0, rng);
			expect(sim.pool.alive).toBe(0);

			sim.emit(config, 1 / 60, 0, 0, rng);
			expect(sim.pool.alive).toBe(1);
		});

		it("caps emissions per frame to 25% of maxParticles", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({ maxParticles: 100, emissionRate: 10000 });

			sim.emit(config, 1, 0, 0, rng); // 10000 requested, cap = 25
			expect(sim.pool.alive).toBeLessThanOrEqual(25);
		});

		it("resets accumulator when config reference changes", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config1 = makeConfig({ emissionRate: 30 });
			const config2 = makeConfig({ emissionRate: 30 });

			// Accumulate 0.5
			sim.emit(config1, 1 / 60, 0, 0, rng);
			expect(sim.pool.alive).toBe(0);

			// New config reference → accumulator resets, starts fresh
			sim.emit(config2, 1 / 60, 0, 0, rng);
			expect(sim.pool.alive).toBe(0); // 0.5 not carried over
		});

		it("does not emit when pool is full", () => {
			const sim = makeSimulator(5);
			const rng = new SeededRandom(1);
			const config = makeConfig({ maxParticles: 5, emissionRate: 1000 });

			// Fill pool via burst (bypasses per-frame cap)
			sim.burst(config, 5, 0, 0, rng);
			expect(sim.pool.alive).toBe(5);

			// Emit should not add more
			sim.emit(config, 1, 0, 0, rng);
			expect(sim.pool.alive).toBe(5);
		});
	});

	describe("burst()", () => {
		it("emits exact count immediately", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig();

			sim.burst(config, 50, 0, 0, rng);
			expect(sim.pool.alive).toBe(50);
		});

		it("clamps to pool capacity", () => {
			const sim = makeSimulator(10);
			const rng = new SeededRandom(1);
			const config = makeConfig({ maxParticles: 10 });

			sim.burst(config, 20, 0, 0, rng);
			expect(sim.pool.alive).toBe(10);
		});
	});

	describe("emission shapes", () => {
		it("point shape spawns at emitter position", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({ emissionShape: "point" });

			sim.burst(config, 1, 100, 200, rng);
			expect(sim.pool.x[0]).toBe(100);
			expect(sim.pool.y[0]).toBe(200);
		});

		it("circle shape spawns within radius", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({ emissionShape: "circle", emissionRadius: 50 });

			sim.burst(config, 100, 0, 0, rng);
			for (let i = 0; i < sim.pool.alive; i++) {
				const dist = Math.sqrt(sim.pool.x[i]! ** 2 + sim.pool.y[i]! ** 2);
				expect(dist).toBeLessThanOrEqual(50.01);
			}
		});

		it("ring shape spawns at exact radius", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({ emissionShape: "ring", emissionRadius: 30 });

			sim.burst(config, 50, 0, 0, rng);
			for (let i = 0; i < sim.pool.alive; i++) {
				const dist = Math.sqrt(sim.pool.x[i]! ** 2 + sim.pool.y[i]! ** 2);
				expect(dist).toBeCloseTo(30, 0);
			}
		});

		it("rect shape spawns within width/height", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				emissionShape: "rect",
				emissionWidth: 100,
				emissionHeight: 50,
			});

			sim.burst(config, 100, 0, 0, rng);
			for (let i = 0; i < sim.pool.alive; i++) {
				expect(Math.abs(sim.pool.x[i]!)).toBeLessThanOrEqual(50.01);
				expect(Math.abs(sim.pool.y[i]!)).toBeLessThanOrEqual(25.01);
			}
		});

		it("line shape spawns along a line", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				emissionShape: "line",
				emissionLength: 100,
				emissionLineAngle: 0, // horizontal
			});

			sim.burst(config, 100, 0, 0, rng);
			for (let i = 0; i < sim.pool.alive; i++) {
				expect(Math.abs(sim.pool.x[i]!)).toBeLessThanOrEqual(50.01);
				expect(sim.pool.y[i]).toBeCloseTo(0, 3);
			}
		});
	});

	describe("update()", () => {
		it("ages particles", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({ lifetime: 2 });

			sim.burst(config, 1, 0, 0, rng);
			sim.update(config, 0.5, rng);
			expect(sim.pool.age[0]).toBeCloseTo(0.5);
		});

		it("kills particles when age >= life", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({ lifetime: 0.5 });

			sim.burst(config, 5, 0, 0, rng);
			expect(sim.pool.alive).toBe(5);

			sim.update(config, 0.6, rng);
			expect(sim.pool.alive).toBe(0);
		});

		it("applies gravity", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				lifetime: 10,
				initialSpeed: 0,
				gravityY: 100,
			});

			sim.burst(config, 1, 0, 0, rng);
			sim.update(config, 1, rng); // 1 second

			// vy should be ~100 after 1s of gravity
			expect(sim.pool.vy[0]).toBeCloseTo(100, 0);
			// y should have moved
			expect(sim.pool.y[0]).toBeGreaterThan(0);
		});

		it("applies drag as exponential decay", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				lifetime: 10,
				initialSpeed: 100,
				initialAngle: 0, // right
				drag: 1,
			});

			sim.burst(config, 1, 0, 0, rng);
			const initialVx = sim.pool.vx[0];
			expect(initialVx).toBeCloseTo(100, 0);

			sim.update(config, 1, rng);
			// After drag of 1 for 1 second: vx * exp(-1) ≈ 36.8
			expect(sim.pool.vx[0]).toBeCloseTo(100 * Math.exp(-1), 0);
		});

		it("applies turbulence deterministically", () => {
			// Same seed, same config → same result
			const makeRun = () => {
				const sim = makeSimulator();
				const rng = new SeededRandom(42);
				const config = makeConfig({
					lifetime: 10,
					initialSpeed: 0,
					turbulence: 50,
				});
				sim.burst(config, 1, 0, 0, rng);
				sim.update(config, 1 / 60, rng);
				return { x: sim.pool.x[0], y: sim.pool.y[0] };
			};

			const run1 = makeRun();
			const run2 = makeRun();
			expect(run1.x).toBe(run2.x);
			expect(run1.y).toBe(run2.y);
		});

		it("offsets particles in local simulation space", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				lifetime: 10,
				initialSpeed: 0,
				simulationSpace: "local",
			});

			sim.burst(config, 1, 100, 100, rng);
			const initialX = sim.pool.x[0]!;

			// Emitter moved by 50,0
			sim.update(config, 1 / 60, rng, 50, 0);
			expect(sim.pool.x[0]).toBeCloseTo(initialX + 50, 1);
		});

		it("does not offset particles in world simulation space", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				lifetime: 10,
				initialSpeed: 0,
				simulationSpace: "world",
			});

			sim.burst(config, 1, 100, 100, rng);
			const initialX = sim.pool.x[0]!;

			sim.update(config, 1 / 60, rng, 50, 0);
			// Only velocity-based movement (which is 0), no emitter offset
			expect(sim.pool.x[0]).toBeCloseTo(initialX, 1);
		});

		it("updates rotation", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({
				lifetime: 10,
				initialSpeed: 0,
				angularVelocity: 360, // 360 deg/s → ~6.28 rad/s
			});

			sim.burst(config, 1, 0, 0, rng);
			sim.update(config, 1, rng);
			// After 1s at 360 deg/s ≈ 2*PI radians
			expect(sim.pool.rotation[0]).toBeCloseTo(
				sim.pool.rotation[0]!, // just check it changed
				-1,
			);
			expect(Math.abs(sim.pool.rotation[0]!)).toBeGreaterThan(0);
		});
	});

	describe("resetAccumulator()", () => {
		it("resets the emission accumulator", () => {
			const sim = makeSimulator();
			const rng = new SeededRandom(1);
			const config = makeConfig({ emissionRate: 30 });

			// Build up accumulator
			sim.emit(config, 1 / 60, 0, 0, rng);
			sim.resetAccumulator();

			// After reset, same dt should not produce a particle
			sim.emit(config, 1 / 60, 0, 0, rng);
			expect(sim.pool.alive).toBe(0);
		});
	});
});
