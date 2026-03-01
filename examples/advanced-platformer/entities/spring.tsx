import { type Actor, CollisionShape, Shape, StaticCollider } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { FRAME, tileAtlas } from "../sprites.js";

/**
 * Spring bounce pad — launches actors upward on contact from above.
 */
export class Spring extends StaticCollider {
	override collisionGroup = "world";

	/** Upward velocity applied to the actor on bounce. */
	bounceForce = -800;

	sprite!: Sprite;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(64, 64)} />
				<Sprite ref="sprite" texture={tileAtlas.texture} centered />
			</>
		);
	}

	override onReady() {
		this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.SPRING);
	}

	/** Bounce an actor. Called by contact callback when player lands on top. */
	bounce(actor: Actor): void {
		actor.velocity.y = this.bounceForce;
		this.game.audio.play("jump", { bus: "sfx", volume: 1.2 });

		// Visual: swap to extended sprite, then back
		this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.SPRING_OUT);
		this.after(0.3, () => {
			this.sprite.sourceRect = tileAtlas.getFrameOrThrow(FRAME.SPRING);
		});
	}
}
