import { CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { beeSheet } from "../../sprites.js";
import { BaseEnemy } from "./base-enemy.js";

/** Flying sine-wave enemy. Oscillates vertically while moving horizontally. */
export class Bee extends BaseEnemy {
	speed = 50;
	amplitude = 40;
	frequency = 1.5;
	direction = -1;
	readonly scoreValue = 150;

	override applyGravity = false;

	private _time = 0;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(32, 28)} />
				<AnimatedSprite ref="sprite" spriteSheet={beeSheet} animation="fly" centered />
			</>
		);
	}

	override onFixedUpdate(dt: number) {
		if (this._isDead) return;

		this._time += dt;

		this.velocity.x = this.speed * this.direction;
		// Derivative of sin(t * f * 2pi) * A = cos(t * f * 2pi) * A * f * 2pi
		this.velocity.y =
			Math.cos(this._time * this.frequency * Math.PI * 2) *
			this.amplitude *
			this.frequency *
			Math.PI *
			2;

		this.move(dt);

		if (this.isOnWall()) {
			this.direction *= -1;
		}

		this.sprite.flipH = this.direction > 0;
	}

	override stomp(): void {
		if (this._isDead) return;
		this.sprite.play("rest");
		super.stomp();
	}
}
