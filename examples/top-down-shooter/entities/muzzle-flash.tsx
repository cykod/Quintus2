import { type DrawContext, Node2D, type Poolable } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";

// Design decision -- Muzzle flash lifecycle:
// Flash is a pooled visual effect with a ~50ms lifetime (3 frames at 60fps).
// It uses a fire-and-forget pattern: BulletManager acquires from pool, places at
// bullet spawn position, and sets a _recycle callback. The flash auto-recycles
// via _recycle when its timer expires, returning to the pool without explicit
// tracking by the manager. This avoids per-flash bookkeeping overhead.
const FLASH_LIFETIME = 0.05;
const FLASH_RADIUS = 6;
const FLASH_OUTER = Color.fromHex("#ffffaa");
const FLASH_INNER = Color.fromHex("#ffffff");
const _center = new Vec2(0, 0);

export class MuzzleFlash extends Node2D implements Poolable {
	private _elapsed = 0;

	_recycle: (() => void) | null = null;

	override onFixedUpdate(dt: number) {
		this._elapsed += dt;
		if (this._elapsed >= FLASH_LIFETIME) {
			if (this.isInsideTree) {
				this._recycle?.();
			}
		}
	}

	onDraw(ctx: DrawContext): void {
		const alpha = 1 - this._elapsed / FLASH_LIFETIME;
		ctx.setAlpha(Math.max(0, alpha));
		ctx.circle(_center, FLASH_RADIUS, { fill: FLASH_OUTER });
		ctx.circle(_center, FLASH_RADIUS * 0.5, { fill: FLASH_INNER });
		ctx.setAlpha(1);
	}

	reset(): void {
		this._elapsed = 0;
	}
}
