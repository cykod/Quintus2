import { SeededRandom } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { degToRad3D, resolveConfig3D, resolveRange3D } from "./particle-config-3d.js";

describe("ParticleConfig3D", () => {
	describe("resolveRange3D()", () => {
		it("returns fixed value for a number", () => {
			const rng = new SeededRandom(1);
			expect(resolveRange3D(42, rng)).toBe(42);
		});

		it("returns value within range for a tuple", () => {
			const rng = new SeededRandom(1);
			for (let i = 0; i < 100; i++) {
				const val = resolveRange3D([10, 20], rng);
				expect(val).toBeGreaterThanOrEqual(10);
				expect(val).toBeLessThanOrEqual(20);
			}
		});
	});

	describe("degToRad3D()", () => {
		it("converts 180 degrees to PI", () => {
			expect(degToRad3D(180)).toBeCloseTo(Math.PI);
		});

		it("converts 0 to 0", () => {
			expect(degToRad3D(0)).toBe(0);
		});
	});

	describe("resolveConfig3D()", () => {
		it("applies 3D defaults", () => {
			const resolved = resolveConfig3D({});
			expect(resolved.gravityZ).toBe(0);
			expect(resolved.initialTheta).toEqual([0, 180]);
			expect(resolved.initialPhi).toEqual([0, 360]);
			expect(resolved.emissionShape3D).toBe("point");
			expect(resolved.emissionBoxX).toBe(0);
			expect(resolved.emissionBoxY).toBe(0);
			expect(resolved.emissionBoxZ).toBe(0);
		});

		it("preserves 2D base config defaults", () => {
			const resolved = resolveConfig3D({});
			expect(resolved.maxParticles).toBe(100);
			expect(resolved.emissionRate).toBe(10);
			expect(resolved.lifetime).toBe(1);
		});

		it("overrides 3D fields", () => {
			const resolved = resolveConfig3D({
				gravityZ: -10,
				initialTheta: [0, 30],
				initialPhi: 90,
				emissionShape3D: "sphere",
				emissionBoxX: 5,
				emissionBoxY: 10,
				emissionBoxZ: 15,
			});
			expect(resolved.gravityZ).toBe(-10);
			expect(resolved.initialTheta).toEqual([0, 30]);
			expect(resolved.initialPhi).toBe(90);
			expect(resolved.emissionShape3D).toBe("sphere");
			expect(resolved.emissionBoxX).toBe(5);
			expect(resolved.emissionBoxY).toBe(10);
			expect(resolved.emissionBoxZ).toBe(15);
		});

		it("overrides 2D base fields", () => {
			const resolved = resolveConfig3D({
				maxParticles: 500,
				gravityY: -100,
			});
			expect(resolved.maxParticles).toBe(500);
			expect(resolved.gravityY).toBe(-100);
		});
	});
});
