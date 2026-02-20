import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { Ease } from "@quintus/tween";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

export class HealthPickup extends Sensor {
	override collisionGroup = "items";

	sprite!: AnimatedSprite;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(6, 6)} />
				<AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="health" />
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("health");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player") && gameState.health < gameState.maxHealth) {
				gameState.health++;
				this.game?.audio.play("heal", { bus: "sfx" });

				// Float up + fade
				this.killTweens();
				this.tween()
					.to({ position: { y: this.position.y - 16 } }, 0.3, Ease.quadOut)
					.onComplete(() => this.destroy());

				this.sprite.killTweens();
				this.sprite.tween().to({ alpha: 0 }, 0.3, Ease.quadOut);
			}
		});
	}
}
