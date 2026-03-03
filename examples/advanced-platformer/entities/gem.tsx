import { Node2D } from "@quintus/core";
import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import type { TileSpawnInfo } from "@quintus/tilemap";
import { Ease } from "@quintus/tween";
import { FRAME, tileAtlas } from "../sprites.js";
import { gameState } from "../state.js";

/**
 * Collectible gem sensor — awards score on pickup.
 * Spawned from tiles via `spawnFromTiles()`.
 */
export class Gem extends Sensor {
	override collisionGroup = "items";

	/** Score awarded on collection. */
	value = 100;

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
			this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.GEM_BLUE);
		}
		this.tag("collectible");
		this.tag("gem");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) {
				this.collect();
			}
		});
	}

	private collect(): void {
		gameState.score += this.value;
		this.game.audio.play("gem", { bus: "sfx" });

		// Spawn a visual popup that tweens up and fades
		const popup = new GemPopup();
		popup.position.x = this.position.x;
		popup.position.y = this.position.y;
		popup.frameName = FRAME.GEM_BLUE;
		this.parent?.add(popup);

		this.destroy();
	}
}

/** Visual-only gem sprite that tweens up and fades, then destroys itself. */
class GemPopup extends Node2D {
	sprite!: Sprite;
	frameName = FRAME.GEM_BLUE;

	override build() {
		return <Sprite ref="sprite" texture={tileAtlas.texture} centered />;
	}

	override onReady() {
		this.sprite.sourceRect = tileAtlas.getFrameOrThrow(this.frameName);

		this.tween()
			.to({ position: { y: this.position.y - 40 } }, 0.4, Ease.easeOutQuad)
			.parallel()
			.to({ sprite: { alpha: 0 } }, 0.4, Ease.easeInQuad)
			.onComplete(() => this.destroy());
	}
}
