import { Color, SeededRandom } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { degToRad, resolveColor, resolveConfig, resolveRange } from "./particle-config.js";

describe("resolveRange", () => {
	const rng = new SeededRandom(42);

	it("returns a fixed number unchanged", () => {
		expect(resolveRange(5, rng)).toBe(5);
		expect(resolveRange(0, rng)).toBe(0);
		expect(resolveRange(-10, rng)).toBe(-10);
	});

	it("returns a value within [min, max) for a tuple", () => {
		for (let i = 0; i < 100; i++) {
			const val = resolveRange([10, 20], rng);
			expect(val).toBeGreaterThanOrEqual(10);
			expect(val).toBeLessThan(20);
		}
	});

	it("returns min when min === max", () => {
		const val = resolveRange([5, 5], rng);
		expect(val).toBe(5);
	});
});

describe("degToRad", () => {
	it("converts 0 degrees to 0 radians", () => {
		expect(degToRad(0)).toBe(0);
	});

	it("converts 90 degrees to PI/2", () => {
		expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
	});

	it("converts 180 degrees to PI", () => {
		expect(degToRad(180)).toBeCloseTo(Math.PI);
	});

	it("converts -90 degrees to -PI/2", () => {
		expect(degToRad(-90)).toBeCloseTo(-Math.PI / 2);
	});
});

describe("resolveColor", () => {
	it("passes through a Color instance unchanged", () => {
		const c = new Color(1, 0, 0, 1);
		expect(resolveColor(c)).toBe(c);
	});

	it("converts a hex string to a Color", () => {
		const c = resolveColor("#ff0000");
		expect(c.r).toBeCloseTo(1);
		expect(c.g).toBeCloseTo(0);
		expect(c.b).toBeCloseTo(0);
		expect(c.a).toBeCloseTo(1);
	});

	it("converts a hex string with alpha", () => {
		const c = resolveColor("#ff000080");
		expect(c.r).toBeCloseTo(1);
		expect(c.a).toBeCloseTo(128 / 255, 1);
	});
});

describe("resolveConfig", () => {
	it("applies defaults for an empty config", () => {
		const resolved = resolveConfig({});
		expect(resolved.maxParticles).toBe(100);
		expect(resolved.emissionRate).toBe(10);
		expect(resolved.emissionShape).toBe("point");
		expect(resolved.initialSpeed).toBe(100);
		expect(resolved.gravityX).toBe(0);
		expect(resolved.gravityY).toBe(0);
		expect(resolved.drag).toBe(0);
		expect(resolved.turbulence).toBe(0);
		expect(resolved.shape).toBe("circle");
		expect(resolved.size).toBe(4);
		expect(resolved.sizeOverLife).toEqual([1, 1]);
		expect(resolved.blendMode).toBe("normal");
		expect(resolved.lifetime).toBe(1);
		expect(resolved.simulationSpace).toBe("world");
	});

	it("resolves colorStart from hex string", () => {
		const resolved = resolveConfig({ colorStart: "#ff0000" });
		expect(resolved.colorStart).toBeInstanceOf(Color);
		expect(resolved.colorStart.r).toBeCloseTo(1);
	});

	it("uses colorStart as colorEnd when colorEnd is omitted", () => {
		const resolved = resolveConfig({ colorStart: "#00ff00" });
		expect(resolved.colorEnd.g).toBeCloseTo(1);
		expect(resolved.colorStart.equals(resolved.colorEnd)).toBe(true);
	});

	it("detects uniform color when start equals end", () => {
		const resolved = resolveConfig({ colorStart: "#ff0000", colorEnd: "#ff0000" });
		expect(resolved._uniformColor).not.toBeNull();
	});

	it("detects non-uniform color when start differs from end", () => {
		const resolved = resolveConfig({ colorStart: "#ff0000", colorEnd: "#0000ff" });
		expect(resolved._uniformColor).toBeNull();
	});

	it("preserves user-provided values", () => {
		const resolved = resolveConfig({
			maxParticles: 500,
			emissionRate: 100,
			gravityY: 200,
			drag: 0.5,
			shape: "rect",
			blendMode: "additive",
		});
		expect(resolved.maxParticles).toBe(500);
		expect(resolved.emissionRate).toBe(100);
		expect(resolved.gravityY).toBe(200);
		expect(resolved.drag).toBe(0.5);
		expect(resolved.shape).toBe("rect");
		expect(resolved.blendMode).toBe("additive");
	});
});
