import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

export class LevelExit extends Sensor {
	override collisionGroup = "items";

	// nextScene is set externally by the Level scene after spawn (via
	// spawnObjects), because the exit entity itself doesn't know which
	// scene comes next — that's level-specific configuration.
	nextScene = "";

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(8, 8)} />
				<AnimatedSprite spriteSheet={entitySheet} animation="flag" />
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("exit");

		// Scene transition fires synchronously in the bodyEntered callback.
		// switchTo() replaces the current scene in the same frame.
		this.bodyEntered.connect((body) => {
			if (body.hasTag("player") && this.nextScene) {
				gameState.currentLevel++;
				this.game.audio.play("victory", { bus: "sfx" });
				this.scene.switchTo(this.nextScene);
			}
		});
	}
}
