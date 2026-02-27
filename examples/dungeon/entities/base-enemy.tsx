import { Damageable } from "@quintus/ai-prefabs";
import { Vec2 } from "@quintus/math";
import { Actor } from "@quintus/physics";
import type { AnimatedSprite } from "@quintus/sprites";
import { Ease } from "@quintus/tween";
import { gameState } from "../state.js";
import type { EquippedWeapon } from "./equipped-weapon.js";
import type { Direction } from "./player.js";

export type EnemyState = "patrol" | "chase" | "attack" | "hurt" | "guard";

// Damageable mixin replaces hand-rolled health / died signal.
// invincibilityDuration: 0 — enemies use a hurt-state timer instead of invincibility frames.
// deathTween: false — BaseEnemy has a custom _die() with score, audio, and shrink+fade tween.
// Subclasses (Dwarf, Barbarian) override health/maxHealth via class fields; the mixin's
// onReady() sets this.health = this.maxHealth, so overridden values are picked up correctly.
const DamageableActor = Damageable(Actor, {
	maxHealth: 2,
	invincibilityDuration: 0,
	deathTween: false,
});

export abstract class BaseEnemy extends DamageableActor {
	override health = 2;
	override maxHealth = 2;
	damage = 1;
	override collisionGroup = "enemies";
	override solid = true;
	override gravity = 0;
	override applyGravity = false;
	override upDirection = Vec2.ZERO;

	enemySpeed = 40;
	detectionRange = 80;
	attackRange = 14;
	attackCooldown = 1.0;
	points = 50;

	// State machine: patrol/guard → chase → attack → hurt.
	// The hurt state blocks ALL other state transitions for its duration (0.3s),
	// acting as a brief stun. This prevents enemies from attacking or chasing
	// while recovering from a hit, giving the player a tactical window.
	protected state: EnemyState = "patrol";
	protected _attackTimer = 0;
	protected _hurtTimer = 0;
	protected _bobTimer = 0;
	protected _facingDir: Direction = "right";

	/** Populated by subclass build() via ref="sprite". */
	sprite?: AnimatedSprite;
	/** Populated by subclass build() via ref="weapon". */
	weapon?: EquippedWeapon;

	protected abstract get idleAnimation(): string;
	protected abstract get walkAnimation(): string;

	override onReady() {
		super.onReady();
		this.tag("enemy");

		// Wire mixin's died signal to custom death logic (score + audio + tween)
		this.died.connect(() => this._die());
	}

	takeDamage(amount: number, fromDirection?: Vec2): void {
		if (this.health <= 0) return;

		this.state = "hurt";
		this._hurtTimer = 0.3;

		// Flash effect
		if (this.sprite) this.sprite.alpha = 0.5;

		// Knockback — scale factor (60) gives a noticeable push without
		// launching the enemy across the room. The 0.9x deceleration in
		// the hurt-state update loop brings them to a stop within ~0.3s.
		if (fromDirection) {
			const kb = fromDirection.normalize().scale(60);
			this.velocity.x = kb.x;
			this.velocity.y = kb.y;
		}

		// Bypass mixin's takeDamage for lethal hits to preserve custom death tween.
		// The mixin's deathTween:false would call destroy() immediately, but we need
		// the shrink+fade animation to play out first (0.2s).
		if (this.health <= amount) {
			this.health = 0;
			this.damaged.emit(0);
			this.died.emit();
			return;
		}

		// Non-lethal: delegate to mixin (health decrement + damaged signal)
		super.takeDamage(amount);
	}

	private _die(): void {
		gameState.score += this.points;
		this.game.audio.play("enemy-die", { volume: 0.4 });

		// Death animation: shrink + fade
		this.killTweens();
		this.tween()
			.to({ scale: { x: 0, y: 0 } }, 0.2, Ease.quadIn)
			.onComplete(() => this.destroy());
		if (this.sprite) {
			this.sprite.killTweens();
			this.sprite.tween().to({ alpha: 0 }, 0.2);
		}
	}

	protected _findPlayer(): Actor | null {
		return this.scene.findFirst("player") as Actor | null;
	}

	protected _distanceToPlayer(): number {
		const player = this._findPlayer();
		if (!player) return Number.POSITIVE_INFINITY;
		return this.position.distanceTo(player.position);
	}

	protected _directionToPlayer(): Vec2 {
		const player = this._findPlayer();
		if (!player) return Vec2.ZERO;
		return player.position.sub(this.position);
	}

	protected _moveToward(target: Vec2, speed: number, dt: number): void {
		const dir = target.sub(this.position);
		const dist = dir.length();
		if (dist < 1) return;
		const norm = dir.scale(1 / dist);
		this.velocity.x = norm.x * speed;
		this.velocity.y = norm.y * speed;
		this.move(dt);

		// Flip sprite based on horizontal direction
		if (this.sprite && Math.abs(norm.x) > 0.1) {
			this.sprite.flipH = norm.x < 0;
		}
	}

	protected _updateBob(dt: number, isMoving: boolean): void {
		if (!this.sprite) return;
		if (isMoving) {
			this._bobTimer += dt * 6;
			this.sprite.position.y = Math.sin(this._bobTimer) > 0 ? -1 : 0;
		} else {
			this._bobTimer = 0;
			this.sprite.position.y = 0;
		}
	}
}
