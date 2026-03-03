import { Node2D } from "@quintus/core";
import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import type { TileSpawnInfo } from "@quintus/tilemap";
import { Ease } from "@quintus/tween";
import { FRAME, tileAtlas } from "../sprites.js";
import { gameState } from "../state.js";

/**
 * Collectible coin sensor — awards score and coins on pickup.
 * Spawned from tiles via `spawnFromTiles()`.
 */
export class Coin extends Sensor {
	override collisionGroup = "items";

	/** Score awarded on collection. */
	value = 10;

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
			this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.COIN_GOLD);
		}
		this.tag("collectible");
		this.tag("coin");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) {
				this.collect();
			}
		});
	}

	private collect(): void {
		gameState.coins += 1;
		gameState.score += this.value * 10;
		this.game.audio.play("coin", { bus: "sfx" });

		// Spawn a visual popup that tweens up and fades
		const popup = new CoinPopup();
		popup.position.x = this.position.x;
		popup.position.y = this.position.y;
		popup.frameName = FRAME.COIN_GOLD;
		this.parent?.add(popup);

		this.destroy();
	}
}

/** Visual-only coin sprite that tweens up and fades, then destroys itself. */
class CoinPopup extends Node2D {
	sprite!: Sprite;
	frameName = FRAME.COIN_GOLD;

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
