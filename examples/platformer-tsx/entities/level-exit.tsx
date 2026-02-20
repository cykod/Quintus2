import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

export class LevelExit extends Sensor {
	override collisionGroup = "items";
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

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player") && this.nextScene) {
				gameState.currentLevel++;
				this.game.audio.play("victory", { bus: "sfx" });
				this.scene.switchTo(this.nextScene);
			}
		});
	}
}
