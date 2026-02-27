import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import type { Player } from "./player.js";

export class Spike extends Sensor {
	override collisionGroup = "items";

	override onReady() {
		super.onReady();
		this.add(CollisionShape).shape = Shape.rect(6, 4);
		this.tag("spike");

		const sprite = this.add(AnimatedSprite);
		sprite.spriteSheet = entitySheet;
		sprite.play("spike");

		// Damageable's invincibility window naturally prevents repeated damage
		// from consecutive spike overlaps — no manual cooldown needed.
		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) {
				(body as Player).takeDamage(1);
			}
		});
	}
}
