import { CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { frogSheet } from "../../sprites.js";
import { BaseEnemy } from "./base-enemy.js";

/** Jumping enemy that periodically leaps toward the player. */
export class Frog extends BaseEnemy {
	jumpForce = -400;
	jumpInterval = 2.0;
	jumpSpeed = 80;
	readonly scoreValue = 250;

	private _jumpTimer = 0;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(32, 32)} />
				<AnimatedSprite ref="sprite" spriteSheet={frogSheet} animation="idle" centered />
			</>
		);
	}

	override onFixedUpdate(dt: number) {
		if (this._isDead) return;

		this._jumpTimer -= dt;

		if (this.isOnFloor()) {
			this.velocity.x = 0;
			this.sprite.play("idle");

			if (this._jumpTimer <= 0) {
				const nearest = this.findNearest(1500, { tags: ["player"] });
				let dir = 1;
				if (nearest) {
					dir = Math.sign(nearest.globalPosition.x - this.globalPosition.x) || 1;
				}
				this.velocity.x = this.jumpSpeed * dir;
				this.velocity.y = this.jumpForce;
				this._jumpTimer = this.jumpInterval;
				this.sprite.play("jump");
				this.sprite.flipH = dir > 0;
			}
		}

		this.move(dt);
	}
}
