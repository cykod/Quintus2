import { type DrawContext, Node2D, type Poolable } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";

const FLASH_LIFETIME = 0.05;
const FLASH_RADIUS = 6;
const FLASH_OUTER = Color.fromHex("#ffffaa");
const FLASH_INNER = Color.fromHex("#ffffff");
const _center = new Vec2(0, 0);

export class MuzzleFlash extends Node2D implements Poolable {
	private _elapsed = 0;
	private _recycled = false;

	_recycle: (() => void) | null = null;

	override onFixedUpdate(dt: number) {
		this._elapsed += dt;
		if (this._elapsed >= FLASH_LIFETIME) {
			if (!this._recycled) {
				this._recycled = true;
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
		this._recycled = false;
	}
}
