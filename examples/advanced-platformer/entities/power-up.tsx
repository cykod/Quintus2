import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import type { TileSpawnInfo } from "@quintus/tilemap";
import { FRAME, tileAtlas } from "../sprites.js";
import { gameState } from "../state.js";
import type { Player } from "./player.js";

/**
 * Power-up star sensor — grants star power (invincibility) on collection.
 * Spawned from tiles via `spawnFromTiles()`.
 */
export class PowerUp extends Sensor {
	override collisionGroup = "items";

	/** Duration of star power in seconds. */
	duration = 10;

	sprite!: Sprite;
	tileInfo: TileSpawnInfo | null = null;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.circle(20)} />
				<Sprite ref="sprite" texture={tileAtlas.texture} centered />
			</>
		);
	}

	override onReady() {
		super.onReady();
		if (this.tileInfo) {
			this.sprite.sourceRect = this.tileInfo.sourceRect;
		} else {
			this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.STAR);
		}
		this.tag("collectible");
		this.tag("powerup");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) {
				const player = body as Player;
				player.activateStarPower(this.duration);
				gameState.score += 500;
				this.game.audio.play("magic", { bus: "sfx" });
				this.destroy();
			}
		});
	}
}
