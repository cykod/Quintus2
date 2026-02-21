import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { Ease } from "@quintus/tween";
import { entitySheet } from "../sprites.js";
import { showToast } from "../hud/toast.js";
import { gameState, POTIONS } from "../state.js";

export class PotionPickup extends Sensor {
	override collisionGroup = "items";
	potionType: "health" | "speed" | "attack" = "health";

	sprite?: AnimatedSprite;

	override build() {
		const anim = this._getAnimation();
		return (
			<>
				<CollisionShape shape={Shape.rect(8, 8)} />
				<AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation={anim} />
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("potion");

		// Bobbing float animation
		this.sprite
			?.tween()
			.to({ position: { y: -3 } }, 0.8, Ease.sineInOut)
			.to({ position: { y: 0 } }, 0.8, Ease.sineInOut)
			.repeat();

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) {
				this._collect();
			}
		});
	}

	private _collect(): void {
		const potion = POTIONS.find((p) => p.type === this.potionType);
		if (!potion) return;
		gameState.potion = potion;
		this.game.audio.play("pickup", { volume: 0.5 });
		showToast(this.scene!, `Got ${potion.name}! [Q to use]`);

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

	private _getAnimation(): string {
		switch (this.potionType) {
			case "health":
				return "potion_red";
			case "speed":
				return "potion_blue";
			case "attack":
				return "potion_green";
		}
	}
}
