import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { Ease } from "@quintus/tween";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

export class HealthPickup extends Sensor {
	override collisionGroup = "items";

	private _sprite!: AnimatedSprite;

	override onReady() {
		super.onReady();
		this.add(CollisionShape).shape = Shape.rect(8, 8);
		this.tag("health");

		this._sprite = this.add(AnimatedSprite);
		this._sprite.spriteSheet = entitySheet;
		this._sprite.play("heart");

		// Bobbing float animation (animate sprite offset, not node position)
		this._sprite
			.tween()
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

		// Float up + fade effect
		this.killTweens();
		this.tween()
			.to({ position: { y: this.position.y - 16 } }, 0.3, Ease.quadOut)
			.onComplete(() => this.destroy());

		this._sprite.killTweens();
		this._sprite.tween().to({ alpha: 0 }, 0.3, Ease.quadOut);
	}
}
