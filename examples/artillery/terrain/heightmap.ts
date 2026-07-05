import { clamp, type SeededRandom } from "@quintus/math";
import { TERRAIN_AMPLITUDE, TERRAIN_BASE_Y, TERRAIN_MIN_Y, TERRAIN_OCTAVES } from "../config.js";

export function generateHeightmap(width: number, rng: SeededRandom): number[] {
	const octaves = TERRAIN_OCTAVES.map((o) => ({ ...o, phase: rng.next() * Math.PI * 2 }));
	const heights = new Array<number>(width);
	const maxY = TERRAIN_BASE_Y + TERRAIN_AMPLITUDE;
	for (let x = 0; x < width; x++) {
		let h = TERRAIN_BASE_Y;
		for (const o of octaves) h += o.amp * Math.sin(x * o.freq + o.phase);
		heights[x] = clamp(h, TERRAIN_MIN_Y, maxY);
	}
	return heights;
}
