import { Camera } from "@quintus/camera";
import { type DrawContext, Node2D } from "@quintus/core";
import { Vec2 } from "@quintus/math";

/**
 * Container node that groups parallax layers. Has no visual output itself.
 */
export class ParallaxBackground extends Node2D {}

/**
 * A single parallax layer that tiles a background image horizontally.
 *
 * Uses `renderFixed = true` so it draws in screen space, independent of
 * the camera's view transform. The parallax offset is computed manually
 * from the camera position and scrollFactor.
 *
 * scrollFactor controls how fast the layer scrolls relative to the camera:
 * - 0    = static (sky, doesn't move at all)
 * - 0.05 = very slow (distant clouds)
 * - 1    = locked to world (moves with everything else)
 *
 * screenY controls where the strip appears on screen at game start:
 * - 0    = top of screen
 * - 768  = bottom of screen (for a 768px-tall game)
 *
 * Set `tileY = true` for layers that should fill the entire screen
 * in both directions (e.g. a solid-color sky fill).
 */
export class ParallaxLayer extends Node2D {
	scrollFactor = 0;
	texture = "";
	tileWidth = 256;
	tileHeight = 256;
	/** Tile vertically as well as horizontally. */
	tileY = false;
	/** Screen-space Y position of the strip top at game start. */
	screenY = 0;

	private _camera: Camera | null = null;
	private _refCamY: number | null = null;

	override onReady(): void {
		this.renderFixed = true;
	}

	override onDraw(ctx: DrawContext): void {
		if (!this.texture) return;

		// Lazy lookup: Camera may be added after this node in the scene tree
		if (!this._camera) {
			this._camera = this.scene.findByType(Camera);
			if (!this._camera) return;
		}

		const cam = this._camera;
		const game = this.game;
		const screenW = game.width;
		const screenH = game.height;

		// Capture reference camera Y on first draw for relative parallax
		if (this._refCamY === null) {
			this._refCamY = cam.position.y;
		}

		// Horizontal parallax: layer scrolls opposite to camera
		const scrollX = -(cam.position.x * this.scrollFactor);

		// Vertical parallax: relative to initial camera position
		const deltaY = cam.position.y - this._refCamY;
		const scrollY = -(deltaY * this.scrollFactor);

		// Horizontal tile range to cover the screen
		const colStart = Math.floor(-scrollX / this.tileWidth);
		const colEnd = Math.ceil((-scrollX + screenW) / this.tileWidth);

		const pos = new Vec2(0, 0);

		if (this.tileY) {
			// Tile both directions (solid fills like sky)
			const baseY = Math.round(scrollY);
			const rowStart = Math.floor(-baseY / this.tileHeight);
			const rowEnd = Math.ceil((-baseY + screenH) / this.tileHeight);
			for (let row = rowStart; row <= rowEnd; row++) {
				for (let col = colStart; col <= colEnd; col++) {
					pos.x = Math.round(scrollX + col * this.tileWidth);
					pos.y = baseY + row * this.tileHeight;
					ctx.image(this.texture, pos, {
						width: this.tileWidth,
						height: this.tileHeight,
					});
				}
			}
		} else {
			// Horizontal only: single strip at screenY + vertical parallax
			const drawY = Math.round(this.screenY + scrollY);
			for (let col = colStart; col <= colEnd; col++) {
				pos.x = Math.round(scrollX + col * this.tileWidth);
				pos.y = drawY;
				ctx.image(this.texture, pos, {
					width: this.tileWidth,
					height: this.tileHeight,
				});
			}
		}
	}
}
