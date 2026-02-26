import { Node2D } from "@quintus/core";
import { Sprite } from "@quintus/sprites";
import { Ease } from "@quintus/tween";
import { CELL_SIZE, MOVE_DURATION } from "../config.js";
import type { Dir } from "../grid.js";
import {
	FRAME_PLAYER_DOWN,
	FRAME_PLAYER_LEFT,
	FRAME_PLAYER_RIGHT,
	FRAME_PLAYER_UP,
	tileSheet,
} from "../sprites.js";

/**
 * Visual representation of the player on the grid.
 * Tweens between grid positions when moved.
 */
export class PlayerSprite extends Node2D {
	private _sprite: Sprite | null = null;

	override onReady(): void {
		const sprite = new Sprite();
		sprite.texture = "tileset";
		sprite.sourceRect = tileSheet.getFrameRect(FRAME_PLAYER_DOWN);
		this.add(sprite);
		this._sprite = sprite;
	}

	/** Snap to grid position without animation. */
	snapTo(gx: number, gy: number): void {
		this.position._set(gx * CELL_SIZE + CELL_SIZE / 2, gy * CELL_SIZE + CELL_SIZE / 2);
	}

	/** Animate movement to a new grid position. */
	moveTo(gx: number, gy: number, dir: Dir): void {
		this._setDirection(dir);
		const targetX = gx * CELL_SIZE + CELL_SIZE / 2;
		const targetY = gy * CELL_SIZE + CELL_SIZE / 2;
		this.killTweens();
		this.tween().to({ position: { x: targetX, y: targetY } }, MOVE_DURATION, Ease.quadOut);
	}

	private _setDirection(dir: Dir): void {
		if (!this._sprite) return;
		let frame = FRAME_PLAYER_DOWN;
		if (dir.dy < 0) frame = FRAME_PLAYER_UP;
		else if (dir.dy > 0) frame = FRAME_PLAYER_DOWN;
		else if (dir.dx < 0) frame = FRAME_PLAYER_LEFT;
		else if (dir.dx > 0) frame = FRAME_PLAYER_RIGHT;
		this._sprite.sourceRect = tileSheet.getFrameRect(frame);
	}
}
