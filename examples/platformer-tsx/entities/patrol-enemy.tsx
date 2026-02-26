import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { Ease } from "@quintus/tween";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

// PatrolEnemy does NOT use the Damageable mixin because:
// 1. It has 1 HP — there is no health to track or invincibility to manage.
// 2. It uses a custom squash+fade death animation in stomp() that conflicts
//    with Damageable's private _playDeathEffect (cannot be overridden).
// 3. With deathTween:false, Damageable calls destroy() immediately,
//    preventing the custom animation from playing.
export class PatrolEnemy extends Actor {
	speed = 40;
	direction = 1;
	override solid = true;
	override collisionGroup = "enemies";

	sprite!: AnimatedSprite;

	readonly died: Signal<void> = signal<void>();

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(7, 7)} />
				<AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="enemy_walk" />
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("enemy");
	}

	override onFixedUpdate(dt: number) {
		const dir = this.direction > 0 ? Vec2.RIGHT : Vec2.LEFT;

		// Edge detection: isEdgeAhead(dir) casts a short ray downward from the
		// leading edge of the collision shape. If no floor tile is found within
		// a few pixels, the enemy is at a platform edge and should reverse.
		if (this.isOnFloor() && this.isEdgeAhead(dir)) {
			this.direction *= -1;
		}
		if (this.isOnWall()) {
			this.direction *= -1;
		}

		this.velocity.x = this.speed * this.direction;
		this.move(dt);

		this.sprite.flipH = this.direction < 0;
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
		this.sprite.killTweens();
		this.sprite.tween().to({ alpha: 0 }, 0.15);

		this.died.emit();
	}
}
