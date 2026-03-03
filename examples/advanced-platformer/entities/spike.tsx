import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import type { TileSpawnInfo } from "@quintus/tilemap";
import { FRAME, tileAtlas } from "../sprites.js";

/**
 * Spike hazard sensor — damages the player on overlap.
 * Spawned from tiles via `spawnFromTiles()`.
 * Damage is handled by the scene's `onOverlap("player", "hazards")` callback.
 */
export class Spike extends Sensor {
	override collisionGroup = "hazards";

	sprite!: Sprite;
	tileInfo: TileSpawnInfo | null = null;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(64, 32)} position={[0, 16]} />
				<Sprite ref="sprite" texture={tileAtlas.texture} centered />
			</>
		);
	}

	override onReady() {
		super.onReady();
		if (this.tileInfo) {
			this.sprite.sourceRect = this.tileInfo.sourceRect;
		} else {
			this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.SPIKES);
		}
		this.tag("hazard");
		this.tag("spike");
	}
}
