import { type DrawContext, Node2D } from "@quintus/core";
import { type Rect, Vec2 } from "@quintus/math";

export class Sprite extends Node2D {
	/** Texture asset name (loaded via game.assets). */
	texture = "";

	/** Source rectangle within the texture (for manual frame selection). */
	sourceRect: Rect | null = null;

	/** Whether the sprite is drawn centered at its origin. Default: true. */
	centered = true;

	/** Flip the sprite horizontally. */
	flipH = false;

	/** Flip the sprite vertically. */
	flipV = false;

	/** Opacity (0 = invisible, 1 = fully opaque). Default: 1. */
	alpha = 1;

	/** Pre-allocated draw offset vector. Updated each draw. */
	protected _drawOffset = new Vec2(0, 0);

	onDraw(ctx: DrawContext): void {
		if (!this.texture) return;

		const w = this._displayWidth();
		const h = this._displayHeight();
		if (w === 0 || h === 0) return;

		if (this.alpha < 1) ctx.setAlpha(this.alpha);

		this._drawOffset._set(this.centered ? -w / 2 : 0, this.centered ? -h / 2 : 0);

		ctx.image(this.texture, this._drawOffset, {
			sourceRect: this.sourceRect ?? undefined,
			flipH: this.flipH,
			flipV: this.flipV,
		});
	}

	/** Compute display width from sourceRect or loaded texture. */
	protected _displayWidth(): number {
		if (this.sourceRect) return this.sourceRect.width;
		const img = this.game?.assets.getImage(this.texture);
		return img?.width ?? 0;
	}

	/** Compute display height from sourceRect or loaded texture. */
	protected _displayHeight(): number {
		if (this.sourceRect) return this.sourceRect.height;
		const img = this.game?.assets.getImage(this.texture);
		return img?.height ?? 0;
	}
}
