import { type Signal, signal } from "@quintus/core";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { Ease } from "@quintus/tween";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

export class FlyingEnemy extends Actor {
	speed = 50;
	amplitude = 30;
	frequency = 0.7;
	direction = -1;
	override solid = true;
	override collisionGroup = "enemies";

	private _time = 0;
	private _sprite!: AnimatedSprite;

	readonly died: Signal<void> = signal<void>();

	override onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(7, 7);
		this.tag("enemy");
		this.applyGravity = false;

		this._sprite = this.addChild(AnimatedSprite);
		this._sprite.spriteSheet = entitySheet;
		this._sprite.play("enemy_fly");
	}

	override onFixedUpdate(dt: number) {
		this._time += dt;
		this.velocity.x = this.speed * this.direction;
		this.velocity.y =
			this.amplitude *
			this.frequency *
			Math.PI *
			2 *
			Math.cos(this._time * this.frequency * Math.PI * 2);

		if (this.isOnWall()) {
			this.direction *= -1;
		}

		this.move(dt);

		this._sprite.flipH = this.direction < 0;
	}

	stomp(): void {
		this.game?.audio.play("stomp", { bus: "sfx" });
		gameState.score += 200;

		// Squash death animation (scale cascades to sprite child)
		this.killTweens();
		this.tween()
			.to({ scale: { y: 0 } }, 0.2, Ease.quadIn)
			.onComplete(() => this.destroy());

		// Fade sprite
		this._sprite.killTweens();
		this._sprite.tween().to({ alpha: 0 }, 0.2, Ease.quadIn);

		this.died.emit();
	}
}
