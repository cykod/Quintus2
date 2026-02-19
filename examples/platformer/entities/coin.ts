import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { Ease } from "@quintus/tween";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

export class Coin extends Sensor {
	override collisionGroup = "items";

	private _sprite!: AnimatedSprite;

	override onReady() {
		super.onReady();
		this.add(CollisionShape).shape = Shape.circle(4);
		this.tag("coin");

		this._sprite = this.add(AnimatedSprite);
		this._sprite.spriteSheet = entitySheet;
		this._sprite.play("coin_idle");

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

		// Pop + fade effect (scale cascades to sprite child)
		this.killTweens();
		this.tween()
			.to({ scale: { x: 1.8, y: 1.8 } }, 0.2, Ease.backOut)
			.onComplete(() => this.destroy());

		this._sprite.killTweens();
		this._sprite.tween().to({ alpha: 0 }, 0.2, Ease.backOut);
	}
}
