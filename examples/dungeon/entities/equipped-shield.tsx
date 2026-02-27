import { Node2D } from "@quintus/core";
import { Sprite } from "@quintus/sprites";
import { Ease } from "@quintus/tween";
import { entitySheet, TILE } from "../sprites.js";
import type { Direction } from "./player.js";

/**
 * Visible shield child node. Rendered on the opposite side from the weapon.
 * On defend (hold), raises shield forward via position tween.
 */
export class EquippedShield extends Node2D {
	sprite?: Sprite;
	private _raised = false;
	private _restX = -5;
	private _restY = 2;

	shieldFrame = TILE.SHIELD_WOODEN;

	override build() {
		return (
			<Sprite
				ref="sprite"
				texture="tileset"
				sourceRect={entitySheet.getFrameRect(this.shieldFrame)}
				centered={false}
				position={[-8, -8]}
			/>
		);
	}

	/** Update the displayed shield sprite. */
	setShield(spriteFrame: number): void {
		this.shieldFrame = spriteFrame;
		if (this.sprite) {
			this.sprite.sourceRect = entitySheet.getFrameRect(spriteFrame);
		}
	}

	/** Raise shield (defend posture) — moves up slightly regardless of direction. */
	raise(_direction: Direction): void {
		if (this._raised) return;
		this._raised = true;
		this.killTweens();
		this.tween().to({ position: { x: this._restX, y: this._restY - 3 } }, 0.1, Ease.quadOut);
	}

	/** Lower shield (return to rest). */
	lower(): void {
		if (!this._raised) return;
		this._raised = false;
		this.killTweens();
		this.tween().to({ position: { x: this._restX, y: this._restY } }, 0.1, Ease.quadOut);
	}

	/**
	 * Position shield based on facing direction (at rest).
	 * Offset: x = ±5 mirrors the shield to the character's off-hand side
	 * (opposite the weapon), y = 2 aligns with the hand height.
	 */
	updateResting(_direction: Direction, flipH: boolean): void {
		if (this._raised) return;
		this._restX = flipH ? 5 : -5;
		this._restY = 2;
		this.position.x = this._restX;
		this.position.y = this._restY;
	}
}
