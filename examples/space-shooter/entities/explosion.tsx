import { type DrawContext, Node2D, NodePool, type Poolable } from "@quintus/core";
import { Color } from "@quintus/math";

const EXPLOSION_DURATION = 0.3;
const EXPLOSION_RADIUS = 16;
const EXPLOSION_COLOR = Color.fromHex("#ff8844");

export class Explosion extends Node2D implements Poolable {
	private _elapsed = 0;

	override onFixedUpdate(dt: number) {
		this._elapsed += dt;
		if (this._elapsed >= EXPLOSION_DURATION) {
			explosionPool.release(this);
		}
	}

	onDraw(ctx: DrawContext): void {
		const t = this._elapsed / EXPLOSION_DURATION;
		const radius = EXPLOSION_RADIUS * (0.5 + t * 0.5);
		const alpha = 1 - t;
		const c = new Color(EXPLOSION_COLOR.r, EXPLOSION_COLOR.g, EXPLOSION_COLOR.b, alpha);
		ctx.circle({ x: 0, y: 0 }, radius, { fill: c });
	}

	reset(): void {
		this._elapsed = 0;
	}
}

export const explosionPool = new NodePool(Explosion, 30);
