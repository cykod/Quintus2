import type { DrawContext } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { Ease } from "@quintus/tween";
import { gameState } from "../state.js";

export class HealthPickup extends Sensor {
	override collisionGroup = "items";

	override onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(10, 10);
		this.tag("health");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player") && gameState.health < gameState.maxHealth) {
				gameState.health++;
				this.game?.audio.play("heal", { bus: "sfx" });

				this.killTweens();
				this.tween()
					.to({ position: { y: this.position.y - 16 }, alpha: 0 }, 0.3, Ease.quadOut)
					.onComplete(() => this.destroy());
			}
		});
	}

	override onDraw(ctx: DrawContext) {
		// Heart shape approximated as a pink square with a cross
		ctx.rect(new Vec2(-5, -5), new Vec2(10, 10), {
			fill: Color.fromHex("#ef5350"),
		});
		ctx.rect(new Vec2(-1, -4), new Vec2(2, 8), { fill: Color.WHITE });
		ctx.rect(new Vec2(-4, -1), new Vec2(8, 2), { fill: Color.WHITE });
	}
}
