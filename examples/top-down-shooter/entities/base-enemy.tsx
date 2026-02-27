import { Damageable } from "@quintus/ai-prefabs";
import type { Poolable } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, type CollisionInfo, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { ENEMY_CAPSULE_HEIGHT, ENEMY_RADIUS } from "../config.js";
import { CHARACTER_SCALE, charactersAtlas } from "../sprites.js";
import type { BulletManager } from "./bullet-manager.js";
import type { Player } from "./player.js";

const DamageableActor = Damageable(Actor, {
	maxHealth: 50,
	invincibilityDuration: 0,
	deathTween: false,
});

export abstract class BaseEnemy extends DamageableActor implements Poolable {
	override collisionGroup = "enemies";
	override solid = true;
	override gravity = 0;
	override applyGravity = false;
	override upDirection = new Vec2(0, 0);

	abstract override maxHealth: number;
	abstract speed: number;
	abstract contactDamage: number;
	abstract scoreValue: number;
	abstract spriteFrame: string;

	_playerRef: Player | null = null;
	_bulletManager: BulletManager | null = null;

	sprite?: Sprite;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.capsule(ENEMY_RADIUS, ENEMY_CAPSULE_HEIGHT)} />
				<Sprite
					ref="sprite"
					texture="spritesheet_characters"
					sourceRect={charactersAtlas.getFrameOrThrow(this.spriteFrame)}
					scale={[CHARACTER_SCALE, CHARACTER_SCALE]}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("enemy");

		// Deal contact damage to the player when THIS enemy's move() collides
		this.collided.connect((info: CollisionInfo) => {
			if (info.collider.hasTag("player") && this._playerRef) {
				this._playerRef.takeDamage(this.contactDamage);
			}
		});
	}

	// Bypass mixin's takeDamage for lethal hits to prevent auto-destroy.
	// Enemies need pool release (not destroy), so we emit signals manually
	// on lethal damage and let EnemyManager handle recycling.
	override takeDamage(amount: number): void {
		if (this.isDead() || this.isInvincible()) return;

		if (this.health <= amount) {
			this.health = 0;
			this.game.audio.play("enemy_die", { bus: "sfx" });
			this.damaged.emit(0);
			this.died.emit();
			return;
		}

		this.game.audio.play("enemy_hit", { bus: "sfx", volume: 0.5 });
		super.takeDamage(amount);
	}

	reset(): void {
		this._playerRef = null;
		this._bulletManager = null;
	}

	protected _facePlayer(): void {
		if (!this._playerRef) return;
		const dx = this._playerRef.position.x - this.position.x;
		const dy = this._playerRef.position.y - this.position.y;
		this.rotation = Math.atan2(dy, dx);
	}

	protected _distToPlayer(): number {
		if (!this._playerRef) return Infinity;
		const dx = this._playerRef.position.x - this.position.x;
		const dy = this._playerRef.position.y - this.position.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	protected _dirToPlayer(): Vec2 {
		if (!this._playerRef) return new Vec2(0, 0);
		const dx = this._playerRef.position.x - this.position.x;
		const dy = this._playerRef.position.y - this.position.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len < 0.01) return new Vec2(0, 0);
		return new Vec2(dx / len, dy / len);
	}
}
