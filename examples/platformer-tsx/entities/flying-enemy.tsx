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
	override applyGravity = false;

	private _time = 0;

	sprite!: AnimatedSprite;

	readonly died: Signal<void> = signal<void>();

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(7, 7)} />
				<AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="enemy_fly" />
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("enemy");
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

		this.move(dt);

		if (this.isOnWall()) {
			this.direction *= -1;
		}

		this.sprite.flipH = this.direction < 0;
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
		this.sprite.killTweens();
		this.sprite.tween().to({ alpha: 0 }, 0.2, Ease.quadIn);

		this.died.emit();
	}
}
