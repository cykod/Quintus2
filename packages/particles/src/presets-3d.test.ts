import { describe, expect, it } from "vitest";
import { resolveConfig3D } from "./particle-config-3d.js";
import { Particles3D } from "./presets-3d.js";

const presetNames = ["fire", "sparks", "explosion", "magic", "snow", "trail"] as const;

describe("Particles3D presets", () => {
	for (const name of presetNames) {
		describe(name, () => {
			it("returns a valid config", () => {
				const config = Particles3D[name]();
				expect(config).toBeDefined();
				expect(config.maxParticles).toBeGreaterThan(0);
			});

			it("resolves without error", () => {
				const config = Particles3D[name]();
				const resolved = resolveConfig3D(config);
				expect(resolved.maxParticles).toBeGreaterThan(0);
				expect(resolved.gravityZ).toBeDefined();
			});

			it("returns fresh config each call", () => {
				const a = Particles3D[name]();
				const b = Particles3D[name]();
				expect(a).not.toBe(b);
				expect(a).toEqual(b);
			});

			it("applies overrides", () => {
				const config = Particles3D[name]({ maxParticles: 999 });
				expect(config.maxParticles).toBe(999);
			});
		});
	}
});
