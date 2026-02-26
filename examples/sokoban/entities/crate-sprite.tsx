import { Node2D } from "@quintus/core";
import { Sprite } from "@quintus/sprites";
import { Ease } from "@quintus/tween";
import { CELL_SIZE, MOVE_DURATION } from "../config.js";
import { FRAME_CRATE_BLUE, FRAME_CRATE_ON_TARGET, tileSheet } from "../sprites.js";

/**
 * Visual representation of a crate on the grid.
 * Changes sprite when on target. Tweens position on push.
 */
export class CrateSprite extends Node2D {
	private _sprite: Sprite | null = null;
	private _onTarget = false;

	override onReady(): void {
		const sprite = new Sprite();
		sprite.texture = "tileset";
		sprite.sourceRect = tileSheet.getFrameRect(FRAME_CRATE_BLUE);
		this.addChild(sprite);
		this._sprite = sprite;
	}

	/** Snap to grid position without animation. */
	snapTo(gx: number, gy: number): void {
		this.position._set(gx * CELL_SIZE + CELL_SIZE / 2, gy * CELL_SIZE + CELL_SIZE / 2);
	}

	/** Animate movement to a new grid position. */
	moveTo(gx: number, gy: number): void {
		const targetX = gx * CELL_SIZE + CELL_SIZE / 2;
		const targetY = gy * CELL_SIZE + CELL_SIZE / 2;
		this.killTweens();
		this.tween().to({ position: { x: targetX, y: targetY } }, MOVE_DURATION, Ease.quadOut);
	}

	/** Update the visual state based on whether the crate is on a target. */
	setOnTarget(on: boolean): void {
		if (this._onTarget === on) return;
		this._onTarget = on;
		if (this._sprite) {
			this._sprite.sourceRect = tileSheet.getFrameRect(
				on ? FRAME_CRATE_ON_TARGET : FRAME_CRATE_BLUE,
			);
		}
	}
}
