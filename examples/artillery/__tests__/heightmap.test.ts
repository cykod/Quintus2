import { SeededRandom } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { SEED, TERRAIN_AMPLITUDE, TERRAIN_BASE_Y, TERRAIN_MIN_Y } from "../config.js";
import { generateHeightmap } from "../terrain/heightmap.js";

const WIDTH = 200;
const MAX_Y = TERRAIN_BASE_Y + TERRAIN_AMPLITUDE;

describe("generateHeightmap", () => {
	it("is deterministic for the same seed", () => {
		const a = generateHeightmap(WIDTH, new SeededRandom(SEED));
		const b = generateHeightmap(WIDTH, new SeededRandom(SEED));
		expect(a).toEqual(b);
	});

	it("differs for a different seed", () => {
		const a = generateHeightmap(WIDTH, new SeededRandom(SEED));
		const b = generateHeightmap(WIDTH, new SeededRandom(SEED + 1));
		expect(a).not.toEqual(b);
	});

	it("has length equal to width", () => {
		const heights = generateHeightmap(WIDTH, new SeededRandom(SEED));
		expect(heights).toHaveLength(WIDTH);
	});

	it("keeps every value within [TERRAIN_MIN_Y, TERRAIN_BASE_Y + TERRAIN_AMPLITUDE]", () => {
		const heights = generateHeightmap(WIDTH, new SeededRandom(SEED));
		for (const h of heights) {
			expect(h).toBeGreaterThanOrEqual(TERRAIN_MIN_Y);
			expect(h).toBeLessThanOrEqual(MAX_Y);
		}
	});
});
