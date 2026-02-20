import { type Signal, signal } from "@quintus/core";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

export class Player extends Actor {
	speed = 120;
	jumpForce = -300;
	doubleJumpForce = -250;
	override collisionGroup = "player";
	override solid = true;
	invincibilityDuration = 1.5;

	private _canDoubleJump = false;
	private _invincible = false;
	private _invincibleTimer = 0;
	private _facing: "left" | "right" = "right";

	sprite?: AnimatedSprite;

	readonly damaged: Signal<number> = signal<number>();
	readonly died: Signal<void> = signal<void>();

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(6, 7)} />
				<AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="player_idle" />
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("player");
	}

	override onFixedUpdate(dt: number) {
		const input = this.game.input;

		// Horizontal movement
		this.velocity.x = 0;
		if (input.isPressed("left")) {
			this.velocity.x = -this.speed;
			this._facing = "left";
		}
		if (input.isPressed("right")) {
			this.velocity.x = this.speed;
			this._facing = "right";
		}

		// Jump + double-jump
		if (input.isJustPressed("jump")) {
			if (this.isOnFloor()) {
				this.velocity.y = this.jumpForce;
				this._canDoubleJump = true;
				this.game.audio.play("jump", { bus: "sfx" });
			} else if (this._canDoubleJump) {
				this.velocity.y = this.doubleJumpForce;
				this._canDoubleJump = false;
				this.game.audio.play("jump", { bus: "sfx", volume: 0.7 });
			}
		}

		// Reset double-jump on landing
		if (this.isOnFloor()) {
			this._canDoubleJump = false;
		}

		this.move(dt);

		// Animation state
		this.sprite!.flipH = this._facing === "left";
		if (!this.isOnFloor()) {
			this.sprite!.play("player_jump");
		} else if (Math.abs(this.velocity.x) > 1) {
			this.sprite!.play("player_run");
		} else {
			this.sprite!.play("player_idle");
		}

		// Invincibility timer + blink effect
		if (this._invincible) {
			this._invincibleTimer -= dt;
			this.sprite!.alpha = Math.sin(this._invincibleTimer * 20) > 0 ? 0.3 : 1;
			if (this._invincibleTimer <= 0) {
				this._invincible = false;
				this.sprite!.alpha = 1;
			}
		}

		// Fall death
		if (this.position.y > 400) {
			gameState.health = 0;
			this.died.emit();
		}
	}

	takeDamage(): void {
		if (this._invincible) return;

		gameState.health--;
		this._invincible = true;
		this._invincibleTimer = this.invincibilityDuration;

		this.game?.audio.play("hit", { bus: "sfx" });
		this.damaged.emit(gameState.health);

		if (gameState.health <= 0) {
			this.died.emit();
		}
	}
}
