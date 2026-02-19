import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { Ease } from "@quintus/tween";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

export class PatrolEnemy extends Actor {
	speed = 40;
	direction = 1;
	override solid = true;
	override collisionGroup = "enemies";

	private _sprite!: AnimatedSprite;

	readonly died: Signal<void> = signal<void>();

	override onReady() {
		super.onReady();
		this.add(CollisionShape).shape = Shape.rect(7, 7);
		this.tag("enemy");

		this._sprite = this.add(AnimatedSprite);
		this._sprite.spriteSheet = entitySheet;
		this._sprite.play("enemy_walk");
	}

	override onFixedUpdate(dt: number) {
		const dir = this.direction > 0 ? Vec2.RIGHT : Vec2.LEFT;

		// Reverse at edges or walls before moving
		if (this.isOnFloor() && this.isEdgeAhead(dir)) {
			this.direction *= -1;
		}
		if (this.isOnWall()) {
			this.direction *= -1;
		}

		this.velocity.x = this.speed * this.direction;
		this.move(dt);

		this._sprite.flipH = this.direction < 0;
	}

	stomp(): void {
		this.game?.audio.play("stomp", { bus: "sfx" });
		gameState.score += 100;

		// Squash death animation (scale cascades to sprite child)
		this.killTweens();
		this.tween()
			.to({ scale: { x: 1.5, y: 0.3 } }, 0.15, Ease.quadOut)
			.onComplete(() => this.destroy());

		// Fade sprite
		this._sprite.killTweens();
		this._sprite.tween().to({ alpha: 0 }, 0.15);

		this.died.emit();
	}
}
