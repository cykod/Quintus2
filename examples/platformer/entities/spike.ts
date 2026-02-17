import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import type { Player } from "./player.js";

export class Spike extends Sensor {
	override collisionGroup = "items";

	override onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(6, 4);
		this.tag("spike");

		const sprite = this.addChild(AnimatedSprite);
		sprite.spriteSheet = entitySheet;
		sprite.play("spike");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) {
				(body as Player).takeDamage();
			}
		});
	}
}
