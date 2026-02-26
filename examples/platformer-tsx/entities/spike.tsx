import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import type { Player } from "./player.js";

// Spike is a static hazard sensor. Damage is applied through the Player's
// Damageable-provided takeDamage(1). The Damageable mixin's invincibility
// window naturally prevents repeated spike damage within the i-frame duration.
export class Spike extends Sensor {
	override collisionGroup = "items";

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(6, 4)} />
				<AnimatedSprite spriteSheet={entitySheet} animation="spike" />
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("spike");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) {
				(body as Player).takeDamage(1);
			}
		});
	}
}
