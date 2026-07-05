import { type DrawContext, Node2D } from "@quintus/core";
import type { SeededRandom } from "@quintus/math";
import { generateHeightmap } from "./heightmap.js";

/** Narrow terrain-solidity query — all an entity needs to sweep-sample for collisions. */
export interface SolidQuery {
	isSolid(x: number, y: number): boolean;
}

export class Terrain extends Node2D implements SolidQuery {
	private readonly mask: Uint8Array; // 1 = solid, 0 = empty — source of truth
	private readonly canvas: HTMLCanvasElement; // presentation only
	private readonly ctx: CanvasRenderingContext2D;

	constructor(
		readonly mapWidth: number,
		readonly mapHeight: number,
	) {
		super();
		this.mask = new Uint8Array(mapWidth * mapHeight);
		this.canvas = document.createElement("canvas");
		this.canvas.width = mapWidth;
		this.canvas.height = mapHeight;
		// biome-ignore lint/style/noNonNullAssertion: 2d context is always available in browser + vitest-canvas-mock
		this.ctx = this.canvas.getContext("2d")!;
	}

	generate(rng: SeededRandom): void {
		const heights = generateHeightmap(this.mapWidth, rng);
		this.mask.fill(0);
		this.ctx.clearRect(0, 0, this.mapWidth, this.mapHeight);
		this.ctx.fillStyle = "#6b4a2b";
		for (let x = 0; x < this.mapWidth; x++) {
			const top = Math.floor(heights[x] ?? this.mapHeight);
			for (let y = top; y < this.mapHeight; y++) this.mask[y * this.mapWidth + x] = 1;
			this.ctx.fillRect(x, top, 1, this.mapHeight - top);
			this.ctx.fillStyle = "#4c8b32"; // grass cap (visual only)
			this.ctx.fillRect(x, top, 1, 4);
			this.ctx.fillStyle = "#6b4a2b";
		}
	}

	isSolid(x: number, y: number): boolean {
		const ix = Math.floor(x);
		const iy = Math.floor(y);
		if (ix < 0 || ix >= this.mapWidth || iy < 0 || iy >= this.mapHeight) return false;
		return this.mask[iy * this.mapWidth + ix] === 1;
	}

	/** Topmost solid Y in a column, or mapHeight if the column is empty. */
	surfaceY(x: number): number {
		const ix = Math.floor(x);
		if (ix < 0 || ix >= this.mapWidth) return this.mapHeight;
		for (let y = 0; y < this.mapHeight; y++) {
			if (this.mask[y * this.mapWidth + ix] === 1) return y;
		}
		return this.mapHeight;
	}

	carveCircle(cx: number, cy: number, radius: number): void {
		const r2 = radius * radius;
		const x0 = Math.max(0, Math.floor(cx - radius));
		const x1 = Math.min(this.mapWidth - 1, Math.ceil(cx + radius));
		const y0 = Math.max(0, Math.floor(cy - radius));
		const y1 = Math.min(this.mapHeight - 1, Math.ceil(cy + radius));
		for (let y = y0; y <= y1; y++) {
			for (let x = x0; x <= x1; x++) {
				const dx = x - cx;
				const dy = y - cy;
				if (dx * dx + dy * dy <= r2) this.mask[y * this.mapWidth + x] = 0;
			}
		}
		// Visual hole (no-op under vitest-canvas-mock; mask above is authoritative)
		this.ctx.save();
		this.ctx.globalCompositeOperation = "destination-out";
		this.ctx.beginPath();
		this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
		this.ctx.fill();
		this.ctx.restore();
	}

	override onDraw(ctx: DrawContext): void {
		ctx.drawCanvas?.(this.canvas, 0, 0);
	}
}
