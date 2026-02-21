import { Node2D } from "@quintus/core";
import { Sprite } from "@quintus/sprites";
import { Ease } from "@quintus/tween";
import { entitySheet, TILE } from "../sprites.js";
import { directionToSwingEnd, directionToSwingStart } from "./equipment-utils.js";
import type { Direction } from "./player.js";

/**
 * Visible weapon child node. Always rendered at the character's side.
 * On attack, plays a swing animation (rotation arc via tween).
 */
export class EquippedWeapon extends Node2D {
	sprite?: Sprite;
	private _swinging = false;

	weaponFrame = TILE.SWORD_SMALL;

	override build() {
		return (
			<Sprite
				ref="sprite"
				texture="tileset"
				sourceRect={entitySheet.getFrameRect(this.weaponFrame)}
				centered={false}
				position={[-8, -14]}
			/>
		);
	}

	/** Update the displayed weapon sprite. */
	setWeapon(spriteFrame: number): void {
		this.weaponFrame = spriteFrame;
		if (this.sprite) {
			this.sprite.sourceRect = entitySheet.getFrameRect(spriteFrame);
		}
	}

	/** Play attack swing animation. */
	swing(direction: Direction): void {
		if (this._swinging) return;
		this._swinging = true;

		const startRot = directionToSwingStart(direction);
		const endRot = directionToSwingEnd(direction);

		this.rotation = startRot;
		this.killTweens();
		this.tween()
			.to({ rotation: endRot }, 0.15, Ease.quadOut)
			.onComplete(() => {
				this._swinging = false;
				this.rotation = 0;
			});
	}

	/** Position weapon based on facing direction (at rest). */
	updateResting(_direction: Direction, flipH: boolean): void {
		if (this._swinging) return;
		this.position.x = flipH ? -6 : 6;
		this.position.y = 2;
		this.rotation = 0;
	}

	get isSwinging(): boolean {
		return this._swinging;
	}
}
