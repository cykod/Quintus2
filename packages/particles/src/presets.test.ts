import { describe, expect, it } from "vitest";
import { resolveConfig } from "./particle-config.js";
import { Particles } from "./presets.js";

const presetNames = [
	"fire",
	"smoke",
	"sparks",
	"explosion",
	"blood",
	"rain",
	"snow",
	"magic",
	"poison",
	"electric",
	"bubbles",
	"leaves",
	"trail",
	"debris",
	"collect",
] as const;

describe("Particles presets", () => {
	for (const name of presetNames) {
		describe(name, () => {
			it("returns a valid ParticleConfig", () => {
				const config = Particles[name]();
				expect(config).toBeDefined();
				expect(typeof config).toBe("object");

				// Should resolve without errors
				const resolved = resolveConfig(config);
				expect(resolved.maxParticles).toBeGreaterThan(0);
				expect(resolved.lifetime).toBeDefined();
			});

			it("returns a fresh object each call", () => {
				const a = Particles[name]();
				const b = Particles[name]();
				expect(a).not.toBe(b);
				expect(a).toEqual(b);
			});

			it("accepts overrides", () => {
				const config = Particles[name]({ maxParticles: 999, gravityY: -42 });
				expect(config.maxParticles).toBe(999);
				expect(config.gravityY).toBe(-42);
			});

			it("overrides do not affect base config", () => {
				Particles[name]({ maxParticles: 999 });
				const clean = Particles[name]();
				expect(clean.maxParticles).not.toBe(999);
			});
		});
	}

	it("has exactly 15 presets", () => {
		expect(presetNames.length).toBe(15);
		for (const name of presetNames) {
			expect(typeof Particles[name]).toBe("function");
		}
	});

	it("all presets specify a lifetime", () => {
		for (const name of presetNames) {
			const config = Particles[name]();
			expect(config.lifetime).toBeDefined();
		}
	});

	it("all presets specify a shape", () => {
		for (const name of presetNames) {
			const config = Particles[name]();
			expect(config.shape).toBeDefined();
		}
	});

	it("override spread pattern works for color", () => {
		const blue = Particles.fire({
			colorStart: "#4488ff",
			colorEnd: "#0022ff00",
		});
		expect(blue.colorStart).toBe("#4488ff");
		expect(blue.colorEnd).toBe("#0022ff00");
		// Other fire properties preserved
		expect(blue.blendMode).toBe("additive");
	});
});
