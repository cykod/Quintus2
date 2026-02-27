import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { Ease } from "@quintus/tween";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

// HealthPickup does NOT extend Pickup because it has conditional collection:
// it only collects when health < maxHealth. Pickup's bodyEntered handler is
// unconditional (collect on any tagged Actor overlap), so using it would require
// overriding the guard logic. Keeping HealthPickup as a manual Sensor is simpler.
export class HealthPickup extends Sensor {
	override collisionGroup = "items";

	sprite?: AnimatedSprite;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(8, 8)} />
				<AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="potion_red" />
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("health");

		// Bobbing float animation (animate sprite offset, not node position)
		this.sprite
			?.tween()
			.to({ position: { y: -3 } }, 0.8, Ease.sineInOut)
			.to({ position: { y: 0 } }, 0.8, Ease.sineInOut)
			.repeat();

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player") && gameState.health < gameState.maxHealth) {
				this._collect();
			}
		});
	}

	private _collect(): void {
		gameState.health = Math.min(gameState.health + 1, gameState.maxHealth);
		this.game.audio.play("pickup", { volume: 0.5 });

		// Float up + fade effect
		this.killTweens();
		this.tween()
			.to({ position: { y: this.position.y - 16 } }, 0.3, Ease.quadOut)
			.onComplete(() => this.destroy());

		if (this.sprite) {
			this.sprite.killTweens();
			this.sprite.tween().to({ alpha: 0 }, 0.3, Ease.quadOut);
		}
	}
}
