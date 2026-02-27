import { Pickup } from "@quintus/ai-prefabs";
import type { Actor } from "@quintus/physics";
import { CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { showToast } from "../hud/toast.js";
import { entitySheet } from "../sprites.js";
import { gameState, POTIONS } from "../state.js";

// Pickup base replaces hand-rolled bob animation, bodyEntered listener, and collection logic.
// It provides: sine-based bobbing (bobAmount/bobSpeed), single-collection guard (_collected),
// bodyEntered → onCollect() dispatch, and a pop scale+destroy effect on collection.
export class PotionPickup extends Pickup {
	override collisionGroup = "items";
	override collectTag = "player";
	override bobAmount = 3;
	override bobSpeed = 1.6;
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
	}

	protected override onCollect(_collector: Actor): void {
		const potion = POTIONS.find((p) => p.type === this.potionType);
		if (!potion) return;
		const scene = this.scene;
		if (!scene) return;
		gameState.potion = potion;
		this.game.audio.play("pickup", { volume: 0.5 });
		showToast(scene, `Got ${potion.name}! [Q to use]`);

		// Fade sprite alongside Pickup's pop effect
		if (this.sprite) {
			this.sprite.killTweens();
			this.sprite.tween().to({ alpha: 0 }, this.popDuration);
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
