import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import type { TileSpawnInfo } from "@quintus/tilemap";
import { FRAME, tileAtlas } from "../sprites.js";
import { gameState } from "../state.js";
import type { Player } from "./player.js";

/**
 * Heart pickup sensor — heals the player by 1 HP on collection.
 * Spawned from tiles via `spawnFromTiles()`.
 */
export class HeartPickup extends Sensor {
	override collisionGroup = "items";

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
			this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.HEART);
		}
		this.tag("collectible");
		this.tag("heart");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) {
				const player = body as Player;
				player.heal(1);
				gameState.health = player.health;
				this.game.audio.play("magic", { bus: "sfx" });
				this.destroy();
			}
		});
	}
}
