import { CollisionShape, Shape, StaticCollider } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import type { TileSpawnInfo } from "@quintus/tilemap";
import { Ease } from "@quintus/tween";
import { FRAME, tileAtlas } from "../sprites.js";

/**
 * Platform that shakes and falls away when the player stands on it.
 * Respawns after a delay.
 */
export class FallAwayPlatform extends StaticCollider {
	override collisionGroup = "world";

	/** Seconds before the platform falls after being triggered. */
	fallDelay = 0.5;

	/** Seconds before the platform respawns (0 = no respawn). */
	respawnDelay = 3.0;

	sprite!: Sprite;
	tileInfo: TileSpawnInfo | null = null;

	private _falling = false;
	private _startX = 0;
	private _startY = 0;
	private _collisionShape!: CollisionShape;

	override build() {
		return (
			<>
				<CollisionShape ref="_collisionShape" shape={Shape.rect(60, 14)} position={[0, -25]} />
				<Sprite ref="sprite" texture={tileAtlas.texture} centered />
			</>
		);
	}

	override onReady() {
		super.onReady();
		if (this.tileInfo) {
			this.sprite.sourceRect = this.tileInfo.sourceRect;
		} else {
			this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.BRIDGE);
		}
		this._startX = this.position.x;
		this._startY = this.position.y;
	}

	/** Trigger the crumble sequence. Called when player lands on top. */
	trigger(): void {
		if (this._falling) return;
		this._falling = true;

		// Shake for fallDelay seconds, then fall
		this.tween()
			.to({ position: { x: this._startX + 3 } }, 0.05)
			.to({ position: { x: this._startX - 3 } }, 0.05)
			.repeat(Math.floor(this.fallDelay / 0.1) - 1)
			.onComplete(() => this._fall());
	}

	private _fall(): void {
		// Snap back to center before falling
		this.position.x = this._startX;

		// Disable collision shape so the player falls through immediately
		this._collisionShape.disabled = true;

		this.tween()
			.to({ position: { y: this._startY + 200 } }, 0.4, Ease.easeInQuad)
			.parallel()
			.to({ sprite: { alpha: 0 } }, 0.4)
			.onComplete(() => {
				this.visible = false;

				if (this.respawnDelay > 0) {
					this.after(this.respawnDelay, () => this._respawn());
				} else {
					this.destroy();
				}
			});
	}

	private _respawn(): void {
		this.position.x = this._startX;
		this.position.y = this._startY;
		this.sprite.alpha = 1;
		this._collisionShape.disabled = false;
		this.visible = true;
		this._falling = false;
	}
}
