import type { DrawContext } from "@quintus/core";
import { type Signal, signal } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
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

	readonly damaged: Signal<number> = signal<number>();
	readonly died: Signal<void> = signal<void>();

	override onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(12, 14);
		this.tag("player");
	}

	override onFixedUpdate(dt: number) {
		const input = this.game?.input;
		if (!input) return;

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
				this.game?.audio.play("jump", { bus: "sfx" });
			} else if (this._canDoubleJump) {
				this.velocity.y = this.doubleJumpForce;
				this._canDoubleJump = false;
				this.game?.audio.play("jump", { bus: "sfx", volume: 0.7 });
			}
		}

		// Reset double-jump on landing
		if (this.isOnFloor()) {
			this._canDoubleJump = false;
		}

		this.move(dt);

		// Invincibility timer
		if (this._invincible) {
			this._invincibleTimer -= dt;
			if (this._invincibleTimer <= 0) {
				this._invincible = false;
				this.alpha = 1;
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

		// Flash effect via tween
		this.tween().to({ alpha: 0.2 }, 0.1).to({ alpha: 1 }, 0.1).repeat(3);

		this.game?.audio.play("hit", { bus: "sfx" });
		this.damaged.emit(gameState.health);

		if (gameState.health <= 0) {
			this.died.emit();
		}
	}

	override onDraw(ctx: DrawContext) {
		const flipX = this._facing === "left" ? -1 : 1;
		// Body
		ctx.rect(new Vec2(-6, -8), new Vec2(12, 16), {
			fill: Color.fromHex("#4fc3f7"),
		});
		// Eyes
		ctx.rect(new Vec2(flipX > 0 ? 1 : -4, -5), new Vec2(3, 3), {
			fill: Color.WHITE,
		});
	}
}
