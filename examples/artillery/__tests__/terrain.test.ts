import { SeededRandom } from "@quintus/math";
import { beforeEach, describe, expect, it } from "vitest";
import { GAME_HEIGHT, GAME_WIDTH, SEED } from "../config.js";
import { Terrain } from "../terrain/terrain.js";

// NOTE: the terrain must be tall enough to contain the heightmap surface.
// TERRAIN_BASE_Y (320) puts the surface around y≈223–408, so the design's
// literal 200×150 dimensions would produce an all-empty mask. We use the real
// GAME_WIDTH × GAME_HEIGHT (the size the game actually runs at) instead.
const W = GAME_WIDTH;
const H = GAME_HEIGHT;
const COLUMNS = [50, 200, 400, 600, 780];

describe("Terrain", () => {
	let terrain: Terrain;

	beforeEach(() => {
		terrain = new Terrain(W, H);
		terrain.generate(new SeededRandom(SEED));
	});

	it("is solid at the bottom and empty at the top of each column", () => {
		for (const x of COLUMNS) {
			expect(terrain.isSolid(x, H - 1)).toBe(true);
			expect(terrain.isSolid(x, 0)).toBe(false);
		}
	});

	it("surfaceY marks the boundary between empty and solid", () => {
		for (const x of COLUMNS) {
			const sy = terrain.surfaceY(x);
			expect(sy).toBeLessThan(H);
			expect(terrain.isSolid(x, sy)).toBe(true);
			expect(terrain.isSolid(x, sy - 1)).toBe(false);
		}
	});

	it("carveCircle clears solidity inside the radius and preserves outside", () => {
		const cx = 400;
		const cy = H - 20; // deep in solid terrain
		const r = 15;

		expect(terrain.isSolid(cx, cy)).toBe(true);
		// A far pixel that should stay solid after carving.
		const far = { x: cx + r + 10, y: cy };
		const farBefore = terrain.isSolid(far.x, far.y);

		terrain.carveCircle(cx, cy, r);

		// Center cleared.
		expect(terrain.isSolid(cx, cy)).toBe(false);
		// Just inside the radius cleared.
		expect(terrain.isSolid(cx + r - 2, cy)).toBe(false);
		// Beyond the radius unchanged.
		expect(terrain.isSolid(far.x, far.y)).toBe(farBefore);
	});

	it("isSolid returns false for out-of-bounds coordinates", () => {
		expect(terrain.isSolid(-1, 10)).toBe(false);
		expect(terrain.isSolid(10, -1)).toBe(false);
		expect(terrain.isSolid(W, 10)).toBe(false);
		expect(terrain.isSolid(10, H)).toBe(false);
	});

	it("surfaceY returns mapHeight for out-of-bounds columns", () => {
		expect(terrain.surfaceY(-1)).toBe(H);
		expect(terrain.surfaceY(W)).toBe(H);
	});
});
