import type { DrawContext } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { Ease } from "@quintus/tween";
import { gameState } from "../state.js";

export class Coin extends Sensor {
	override collisionGroup = "items";

	override onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.circle(6);
		this.tag("coin");

		// Float animation
		const baseY = this.position.y;
		this.tween()
			.to({ position: { y: baseY - 4 } }, 0.8, Ease.sineInOut)
			.to({ position: { y: baseY } }, 0.8, Ease.sineInOut)
			.repeat();

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) this._collect();
		});
	}

	private _collect() {
		gameState.coins++;
		gameState.score += 10;
		this.game?.audio.play("coin", { bus: "sfx" });

		// Pop + fade effect
		this.killTweens();
		this.tween()
			.to({ scale: { x: 1.8, y: 1.8 }, alpha: 0 }, 0.2, Ease.backOut)
			.onComplete(() => this.destroy());
	}

	override onDraw(ctx: DrawContext) {
		ctx.circle(Vec2.ZERO, 6, { fill: Color.fromHex("#ffd54f") });
	}
}
