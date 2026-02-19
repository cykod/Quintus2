import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import { gameState } from "../state.js";
import { WeaponHitbox } from "./weapon-hitbox.js";

export type Direction = "up" | "down" | "left" | "right";

const DIRECTION_VECTORS: Record<Direction, Vec2> = {
	up: new Vec2(0, -1),
	down: new Vec2(0, 1),
	left: new Vec2(-1, 0),
	right: new Vec2(1, 0),
};

export class Player extends Actor {
	speed = 80;
	override collisionGroup = "player";
	override solid = true;

	/** Top-down: no gravity, no floor detection. */
	override gravity = 0;
	override applyGravity = false;
	override upDirection = Vec2.ZERO;

	direction: Direction = "down";
	invincibilityDuration = 1.5;

	private _invincible = false;
	private _invincibleTimer = 0;
	private _sprite!: AnimatedSprite;
	private _bobTimer = 0;
	private _moving = false;

	// Combat state
	private _attacking = false;
	private _attackCooldown = 0;
	private _defending = false;

	readonly damaged: Signal<number> = signal<number>();
	readonly died: Signal<void> = signal<void>();

	override onReady() {
		super.onReady();
		// Feet-only hitbox (smaller than full sprite for top-down feel)
		const shape = this.add(CollisionShape);
		shape.shape = Shape.rect(10, 6);
		shape.offset = new Vec2(0, 4);
		this.tag("player");

		this._sprite = this.add(AnimatedSprite);
		this._sprite.spriteSheet = entitySheet;
		this._sprite.play("player_idle");
	}

	override onFixedUpdate(dt: number) {
		const input = this.game.input;

		// Attack cooldown
		if (this._attackCooldown > 0) {
			this._attackCooldown -= dt;
			if (this._attackCooldown <= 0) this._attacking = false;
		}

		// Defend (hold)
		this._defending = input.isPressed("defend");

		// Attack (just pressed, not during cooldown)
		if (input.isJustPressed("attack") && this._attackCooldown <= 0) {
			this._performAttack();
		}

		// Read directional input
		let vx = 0;
		let vy = 0;
		if (input.isPressed("left")) vx -= 1;
		if (input.isPressed("right")) vx += 1;
		if (input.isPressed("up")) vy -= 1;
		if (input.isPressed("down")) vy += 1;

		// Normalize diagonal movement
		if (vx !== 0 && vy !== 0) {
			const inv = 1 / Math.SQRT2;
			vx *= inv;
			vy *= inv;
		}

		// Half speed while defending
		const effectiveSpeed = this._defending ? this.speed * 0.5 : this.speed;
		this.velocity.x = vx * effectiveSpeed;
		this.velocity.y = vy * effectiveSpeed;

		this.move(dt);

		// Track facing direction (dominant axis, prefer horizontal)
		this._moving = vx !== 0 || vy !== 0;
		if (this._moving) {
			if (Math.abs(vx) >= Math.abs(vy)) {
				this.direction = vx > 0 ? "right" : "left";
			} else {
				this.direction = vy > 0 ? "down" : "up";
			}
		}

		// Flip sprite for left direction
		this._sprite.flipH = this.direction === "left";

		// Walk bob animation: offset sprite y by -1 when "stepping"
		if (this._moving) {
			this._bobTimer += dt * 8;
			this._sprite.position.y = Math.sin(this._bobTimer) > 0 ? -1 : 0;
		} else {
			this._bobTimer = 0;
			this._sprite.position.y = 0;
		}

		// Invincibility timer + blink effect
		if (this._invincible) {
			this._invincibleTimer -= dt;
			this._sprite.alpha = Math.sin(this._invincibleTimer * 20) > 0 ? 0.3 : 1;
			if (this._invincibleTimer <= 0) {
				this._invincible = false;
				this._sprite.alpha = 1;
			}
		}
	}

	private _performAttack(): void {
		this._attacking = true;
		this._attackCooldown = 0.4;

		// Spawn weapon hitbox in facing direction
		const dir = DIRECTION_VECTORS[this.direction];
		if (!this.parent) return;
		const hitbox = this.parent.add(WeaponHitbox);

		hitbox.position.x = this.position.x + dir.x * 12;
		hitbox.position.y = this.position.y + dir.y * 12;
		hitbox.damage = gameState.sword.damage;
		hitbox.attackDirection = dir;
	}

	takeDamage(amount: number, fromDirection?: Vec2): void {
		if (this._invincible) return;

		// Defending and facing toward the attack: reduce damage
		let finalAmount = amount;
		if (this._defending && fromDirection && gameState.shield) {
			const facing = DIRECTION_VECTORS[this.direction];
			// Facing toward source if dot product > 0 (facing same direction as attack)
			const dot = facing.x * fromDirection.x + facing.y * fromDirection.y;
			if (dot > 0) {
				finalAmount = Math.max(0, amount - gameState.shield.defense);
				if (finalAmount === 0) return; // Fully blocked
			}
		}

		gameState.health -= finalAmount;
		this._invincible = true;
		this._invincibleTimer = this.invincibilityDuration;

		this.damaged.emit(gameState.health);

		// Knockback
		if (fromDirection) {
			const kb = fromDirection.normalize().scale(40);
			this.velocity.x = kb.x;
			this.velocity.y = kb.y;
		}

		if (gameState.health <= 0) {
			this.died.emit();
		}
	}

	get isInvincible(): boolean {
		return this._invincible;
	}

	get isDefending(): boolean {
		return this._defending;
	}

	get isAttacking(): boolean {
		return this._attacking;
	}

	get sprite(): AnimatedSprite {
		return this._sprite;
	}
}
