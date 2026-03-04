import { type Actor, CollisionShape, Shape, StaticCollider } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import type { TileSpawnInfo } from "@quintus/tilemap";
import { Ease } from "@quintus/tween";
import { FRAME, tileAtlas } from "../sprites.js";
import { Player } from "./player.js";

/**
 * Spring bounce pad — launches actors upward on contact from above.
 */
export class Spring extends StaticCollider {
	override collisionGroup = "world";

	/** Upward velocity applied to the actor on bounce. */
	bounceForce = -800;

	sprite!: Sprite;
	tileInfo: TileSpawnInfo | null = null;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(56, 56)} />
				<Sprite ref="sprite" texture={tileAtlas.texture} centered />
			</>
		);
	}

	override onReady() {
		super.onReady();
		if (this.tileInfo) {
			this.sprite.sourceRect = this.tileInfo.sourceRect;
		} else {
			this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.SPRING);
		}
	}

	/** Bounce an actor. Called by contact callback when player lands on top. */
	bounce(actor: Actor): void {
		actor.velocity.y = this.bounceForce;
		this.game.audio.play("jump_high", { bus: "sfx", volume: 1.2 });

		// Visual: swap to extended sprite, then back
		this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.SPRING_OUT);
		this.after(0.3, () => {
			this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.SPRING);
		});

		// Squash-stretch on the player sprite
		if (actor instanceof Player && actor.sprite) {
			actor.sprite.killTweens();
			actor.sprite
				.tween()
				.to({ scale: { x: 0.7, y: 1.3 } }, 0.1, Ease.quadOut)
				.to({ scale: { x: 1, y: 1 } }, 0.15, Ease.quadOut);
		}
	}
}
