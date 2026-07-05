import { type DrawContext, Node2D } from "@quintus/core";
import { Color, lerp, Vec2 } from "@quintus/math";
import { BLAST_RADIUS, EXPLOSION_DURATION } from "../config.js";

// ShapeStyle.fill takes a Color, not a hex string — convert once at module scope.
const EXPLOSION_COLOR = Color.fromHex("#ffb020");

/**
 * Transient blast effect spawned at a detonation point. Seats itself at the
 * point, self-destructs after EXPLOSION_DURATION, and draws an expanding,
 * fading flash: radius grows 0.5→1.5 × BLAST_RADIUS while alpha fades 1→0.
 * Purely cosmetic — never touches gameplay state or RNG.
 */
export class Explosion extends Node2D {
	private t = 0;

	init(point: Vec2): this {
		this.position._set(point.x, point.y);
		return this;
	}

	override onUpdate(dt: number): void {
		this.t += dt;
		if (this.t >= EXPLOSION_DURATION) this.destroy();
	}

	override onDraw(ctx: DrawContext): void {
		const p = Math.min(1, this.t / EXPLOSION_DURATION);
		ctx.save();
		ctx.setAlpha(1 - p);
		ctx.circle(new Vec2(0, 0), lerp(0.5, 1.5, p) * BLAST_RADIUS, { fill: EXPLOSION_COLOR });
		ctx.restore();
	}
}
