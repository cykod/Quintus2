import { Vec2 } from "@quintus/math";
import { CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { snailSheet } from "../../sprites.js";
import { gameState } from "../../state.js";
import { BaseEnemy } from "./base-enemy.js";

export type SnailState = "walking" | "shell" | "kicked" | "stopped";

/** Slow patrol enemy with a three-state shell mechanic. */
export class Snail extends BaseEnemy {
	speed = 30;
	shellSpeed = 300;
	direction = 1;
	readonly scoreValue = 200;

	private _state: SnailState = "walking";

	get state(): SnailState {
		return this._state;
	}

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(48, 32)} />
				<AnimatedSprite ref="sprite" spriteSheet={snailSheet} animation="walk" centered />
			</>
		);
	}

	override onFixedUpdate(dt: number) {
		if (this._isDead) return;

		switch (this._state) {
			case "walking": {
				const dir = this.direction > 0 ? Vec2.RIGHT : Vec2.LEFT;
				if (this.isOnFloor() && this.isEdgeAhead(dir)) {
					this.direction *= -1;
				}
				if (this.isOnWall()) {
					this.direction *= -1;
				}
				this.velocity.x = this.speed * this.direction;
				this.move(dt);
				this.sprite.flipH = this.direction > 0;
				break;
			}
			case "shell": {
				this.velocity.x = 0;
				this.move(dt); // gravity only
				break;
			}
			case "kicked": {
				this.velocity.x = this.shellSpeed * this.direction;
				this.move(dt);
				if (this.isOnWall()) {
					this.direction *= -1;
				}
				break;
			}
			case "stopped": {
				this.velocity.x = 0;
				// no movement
				break;
			}
		}
	}

	/**
	 * Override stomp completely — does NOT call super.stomp().
	 * State machine: walking → shell → kicked → stopped.
	 */
	override stomp(): void {
		if (this._isDead) return;

		switch (this._state) {
			case "walking": {
				this._state = "shell";
				gameState.score += this.scoreValue;
				this.game?.audio.play("disappear", { bus: "sfx" });
				this.sprite.play("shell");
				this.velocity.x = 0;
				this.died.emit();
				break;
			}
			case "shell": {
				this._state = "kicked";
				this.velocity.x = this.shellSpeed * this.direction;
				break;
			}
			case "kicked": {
				this._state = "stopped";
				this.velocity.x = 0;
				break;
			}
			case "stopped": {
				// no-op
				break;
			}
		}
	}
}
