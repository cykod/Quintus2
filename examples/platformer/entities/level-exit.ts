import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

export class LevelExit extends Sensor {
	override collisionGroup = "items";
	nextScene!: string;

	override onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(8, 8);
		this.tag("exit");

		const sprite = this.addChild(AnimatedSprite);
		sprite.spriteSheet = entitySheet;
		sprite.play("flag");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) {
				gameState.currentLevel++;
				this.game?.audio.play("victory", { bus: "sfx" });
				this.scene?.switchTo(this.nextScene);
			}
		});
	}
}
