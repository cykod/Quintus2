import type { SpriteSheet } from "@quintus/sprites";
import { entitySheet } from "../sprites.js";
import { BaseEnemy } from "./base-enemy.js";
import { EnemyWeapon } from "./enemy-weapon.js";

/**
 * Orc: guard enemy. Stands still until player is close, then chases and attacks.
 * Slower but stronger than skeleton.
 */
export class Orc extends BaseEnemy {
	override health = 4;
	override maxHealth = 4;
	override damage = 2;
	override enemySpeed = 35;
	override detectionRange = 60;
	override attackRange = 18;
	override attackCooldown = 1.2;
	override points = 100;

	protected override get idleAnimation() {
		return "orc_idle";
	}
	protected override get walkAnimation() {
		return "orc_walk";
	}
	protected override get spriteSheet(): SpriteSheet {
		return entitySheet;
	}

	override onFixedUpdate(dt: number) {
		// Hurt recovery
		if (this.state === "hurt") {
			this._hurtTimer -= dt;
			this.velocity.x *= 0.9;
			this.velocity.y *= 0.9;
			this.move(dt);
			if (this._hurtTimer <= 0) {
				this._sprite.alpha = 1;
				this.state = "guard";
			}
			return;
		}

		if (this._attackTimer > 0) this._attackTimer -= dt;

		const dist = this._distanceToPlayer();

		// State transitions
		if (dist <= this.attackRange && this._attackTimer <= 0) {
			this.state = "attack";
		} else if (dist <= this.detectionRange) {
			this.state = "chase";
		} else {
			this.state = "guard";
		}

		let isMoving = false;

		switch (this.state) {
			case "guard": {
				// Stand still, face toward player if somewhat close
				this.velocity.x = 0;
				this.velocity.y = 0;
				if (dist < this.detectionRange * 1.5) {
					const dir = this._directionToPlayer();
					if (Math.abs(dir.x) > 0.1) {
						this._sprite.flipH = dir.x < 0;
					}
				}
				break;
			}
			case "chase": {
				const dir = this._directionToPlayer();
				if (dir.length() > 1) {
					const target = this.position.add(dir);
					this._moveToward(target, this.enemySpeed, dt);
					isMoving = true;
				}
				break;
			}
			case "attack": {
				this._performAttack();
				this.velocity.x = 0;
				this.velocity.y = 0;
				break;
			}
		}

		this._sprite.play(isMoving ? this.walkAnimation : this.idleAnimation);
		this._updateBob(dt, isMoving);
	}

	private _performAttack(): void {
		if (this._attackTimer > 0) return;
		this._attackTimer = this.attackCooldown;

		const dir = this._directionToPlayer();
		if (dir.length() < 1) return;
		const norm = dir.normalize();

		if (!this.parent) return;
		const weapon = this.parent.add(EnemyWeapon);
		weapon.position.x = this.position.x + norm.x * 12;
		weapon.position.y = this.position.y + norm.y * 12;
		weapon.damage = this.damage;
		weapon.attackDirection = norm;
	}
}
