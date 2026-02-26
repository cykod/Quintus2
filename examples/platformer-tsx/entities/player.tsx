import { Damageable } from "@quintus/ai-prefabs";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";

// Damageable mixin replaces hand-rolled health / invincibility / damage signals.
// It provides: health, maxHealth, damaged, died signals, takeDamage(amount),
// heal(amount), isDead(), isInvincible(), and invincibility timer management.
// deathTween: true gives a 0.3 s shrink animation when health reaches zero.
const DamageableActor = Damageable(Actor, {
	maxHealth: 3,
	invincibilityDuration: 1.5,
	deathTween: true,
});

export class Player extends DamageableActor {
	speed = 120;
	jumpForce = -300;
	doubleJumpForce = -250;
	override collisionGroup = "player";
	override solid = true;

	private _canDoubleJump = false;
	private _facing: "left" | "right" = "right";

	sprite!: AnimatedSprite;

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
		// Sync mixin's initial health → reactive gameState so HUD starts correct
		gameState.health = this.health;
	}

	override onFixedUpdate(dt: number) {
		// Damageable mixin ticks the invincibility timer in super.onFixedUpdate
		super.onFixedUpdate(dt);

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

		// Reset double-jump on landing (must be BEFORE the jump check so that
		// a floor jump can re-enable it in the same frame — isOnFloor() reflects
		// the previous move(), so it's still true on the frame the jump fires).
		if (this.isOnFloor()) {
			this._canDoubleJump = false;
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

		this.move(dt);

		// Animation state
		this.sprite.flipH = this._facing === "left";
		if (!this.isOnFloor()) {
			this.sprite.play("player_jump");
		} else if (Math.abs(this.velocity.x) > 1) {
			this.sprite.play("player_run");
		} else {
			this.sprite.play("player_idle");
		}

		// Invincibility blink effect — uses isInvincible() from Damageable mixin.
		// We use game.elapsed for the oscillation since the mixin's timer is private.
		// sin(elapsed * 20) produces ~3 Hz flicker, matching the original visual.
		if (this.isInvincible()) {
			this.sprite.alpha = Math.sin(this.game.elapsed * 20) > 0 ? 0.3 : 1;
		} else if (!this.isDead()) {
			this.sprite.alpha = 1;
		}

		// Fall death — instant kill via takeDamage with remaining health
		if (this.position.y > 400 && !this.isDead()) {
			this.takeDamage(this.health);
		}
	}

	// Override to play hit SFX and sync mixin health → reactive gameState for HUD
	override takeDamage(amount: number): void {
		if (this.isDead() || this.isInvincible()) return;
		this.game?.audio.play("hit", { bus: "sfx" });
		super.takeDamage(amount);
		gameState.health = this.health;
	}
}
