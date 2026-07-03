import { AnimatedSprite, CollisionShape, Sensor, Shape } from "quintus2";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

/** Overlap-only pickup: when the player touches it, add score and remove it. */
export class Coin extends Sensor {
	override collisionGroup = "items";

	sprite!: AnimatedSprite;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.circle(4)} />
				<AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="coin_idle" />
			</>
		);
	}

	override onReady() {
		super.onReady(); // registers the sensor body in the physics world for overlap detection
		this.tag("coin");
		this.bodyEntered.connect((body) => {
			if (!body.hasTag("player")) return;
			gameState.score += 10;
			this.game.audio.play("coin", { bus: "sfx" });
			this.destroy();
		});
	}
}
