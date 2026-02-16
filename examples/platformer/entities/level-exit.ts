import type { DrawContext, SceneConstructor } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { gameState } from "../state.js";

export class LevelExit extends Sensor {
	override collisionGroup = "items";
	nextScene!: SceneConstructor;

	override onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(16, 32);
		this.tag("exit");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) {
				gameState.currentLevel++;
				this.game?.audio.play("victory", { bus: "sfx" });
				this.scene!.switchTo(this.nextScene);
			}
		});
	}

	override onDraw(ctx: DrawContext) {
		// Pulsing door
		ctx.rect(new Vec2(-8, -16), new Vec2(16, 32), {
			fill: Color.fromHex("#81c784"),
		});
	}
}
