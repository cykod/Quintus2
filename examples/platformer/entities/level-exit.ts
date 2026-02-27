import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

// nextScene is set externally by the Level scene after spawning from the object
// layer. The scene transition happens synchronously in the bodyEntered callback.
export class LevelExit extends Sensor {
	override collisionGroup = "items";
	nextScene = "";

	override onReady() {
		super.onReady();
		this.add(CollisionShape).shape = Shape.rect(8, 8);
		this.tag("exit");

		const sprite = this.add(AnimatedSprite);
		sprite.spriteSheet = entitySheet;
		sprite.play("flag");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player") && this.nextScene) {
				gameState.currentLevel++;
				this.game.audio.play("victory", { bus: "sfx" });
				this.scene.switchTo(this.nextScene);
			}
		});
	}
}
