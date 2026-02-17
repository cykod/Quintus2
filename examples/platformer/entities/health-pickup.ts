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
		this.addChild(CollisionShape).shape = Shape.rect(6, 6);
		this.tag("health");

		this._sprite = this.addChild(AnimatedSprite);
		this._sprite.spriteSheet = entitySheet;
		this._sprite.play("health");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player") && gameState.health < gameState.maxHealth) {
				gameState.health++;
				this.game?.audio.play("heal", { bus: "sfx" });

				// Float up + fade
				this.killTweens();
				this.tween()
					.to({ position: { y: this.position.y - 16 } }, 0.3, Ease.quadOut)
					.onComplete(() => this.destroy());

				this._sprite.killTweens();
				this._sprite.tween().to({ alpha: 0 }, 0.3, Ease.quadOut);
			}
		});
	}
}
