import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import type { TileSpawnInfo } from "@quintus/tilemap";
import { Ease } from "@quintus/tween";
import { FRAME, tileAtlas } from "../sprites.js";
import { gameState } from "../state.js";

/**
 * Checkpoint flag sensor — sets the respawn checkpoint on first touch.
 * Spawned from tiles via `spawnFromTiles()`.
 */
export class Flag extends Sensor {
	override collisionGroup = "items";

	sprite!: Sprite;
	tileInfo: TileSpawnInfo | null = null;

	private _activated = false;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(40, 64)} />
				<Sprite ref="sprite" texture={tileAtlas.texture} centered />
			</>
		);
	}

	override onReady() {
		super.onReady();
		if (this.tileInfo) {
			this.sprite.sourceRect = this.tileInfo.sourceRect;
		} else {
			this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.FLAG_OFF);
		}
		this.tag("flag");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player") && !this._activated) {
				this.activate();
			}
		});
	}

	private activate(): void {
		this._activated = true;
		gameState.checkpoint = this.position.clone();
		this.game.audio.play("magic", { bus: "sfx" });

		// Swap to waving flag sprite
		this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.FLAG_YELLOW_A);

		// Bounce tween
		const baseY = this.position.y;
		this.tween()
			.to({ position: { y: baseY - 6 } }, 0.15, Ease.quadOut)
			.to({ position: { y: baseY } }, 0.15, Ease.quadIn);
	}
}
