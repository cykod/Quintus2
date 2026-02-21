import { CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { entitySheet, TILE } from "../sprites.js";
import { BaseEnemy } from "./base-enemy.js";
import { EnemyWeapon } from "./enemy-weapon.js";
import { vec2ToDirection } from "./equipment-utils.js";
import { EquippedWeapon } from "./equipped-weapon.js";

/**
 * Dwarf: melee patrol enemy.
 * States: patrol (walk back and forth) -> chase (pursue player) -> attack (swing)
 */
export class Dwarf extends BaseEnemy {
	override health = 2;
	override maxHealth = 2;
	override damage = 1;
	override enemySpeed = 40;
	override detectionRange = 80;
	override attackRange = 16;
	override attackCooldown = 1.0;
	override points = 50;

	private _patrolDir = 1;
	private _patrolTimer = 0;
	private _patrolDuration = 2;

	protected override get idleAnimation() {
		return "dwarf_idle";
	}
	protected override get walkAnimation() {
		return "dwarf_walk";
	}

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(10, 10)} />
				<AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="dwarf_idle" />
				<EquippedWeapon ref="weapon" weaponFrame={TILE.HAND_AXE} />
			</>
		);
	}

	override onFixedUpdate(dt: number) {
		// Hurt recovery
		if (this.state === "hurt") {
			this._hurtTimer -= dt;
			this.velocity.x *= 0.9;
			this.velocity.y *= 0.9;
			this.move(dt);
			if (this._hurtTimer <= 0) {
				if (this.sprite) this.sprite.alpha = 1;
				this.state = "patrol";
			}
			return;
		}

		// Attack cooldown
		if (this._attackTimer > 0) this._attackTimer -= dt;

		const dist = this._distanceToPlayer();

		// State transitions
		if (dist <= this.attackRange && this._attackTimer <= 0) {
			this.state = "attack";
		} else if (dist <= this.detectionRange) {
			this.state = "chase";
		} else {
			this.state = "patrol";
		}

		let isMoving = false;

		switch (this.state) {
			case "patrol": {
				this._patrolTimer += dt;
				if (this._patrolTimer >= this._patrolDuration) {
					this._patrolTimer = 0;
					this._patrolDir *= -1;
				}
				this.velocity.x = this.enemySpeed * 0.5 * this._patrolDir;
				this.velocity.y = 0;
				this.move(dt);
				isMoving = true;
				this._facingDir = this._patrolDir > 0 ? "right" : "left";
				if (this.sprite) this.sprite.flipH = this._patrolDir < 0;

				// Reverse on wall
				if (this.isOnWall()) {
					this._patrolDir *= -1;
					this._patrolTimer = 0;
				}
				break;
			}
			case "chase": {
				const playerPos = this._directionToPlayer();
				if (playerPos.length() > 1) {
					this._facingDir = vec2ToDirection(playerPos);
					const target = this.position.add(playerPos);
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

		if (this.sprite) {
			this.sprite.play(isMoving ? this.walkAnimation : this.idleAnimation);
		}
		this._updateBob(dt, isMoving);

		// Update weapon resting position
		const flipH = this._facingDir === "left";
		this.weapon?.updateResting(this._facingDir, flipH);
	}

	private _performAttack(): void {
		if (this._attackTimer > 0) return;
		this._attackTimer = this.attackCooldown;

		const dir = this._directionToPlayer();
		if (dir.length() < 1) return;
		const norm = dir.normalize();

		this._facingDir = vec2ToDirection(dir);
		this.weapon?.swing(this._facingDir);
		this.game.audio.play("enemy-swing", { volume: 0.3 });

		if (!this.parent) return;
		const weapon = this.parent.add(EnemyWeapon);
		weapon.position.x = this.position.x + norm.x * 10;
		weapon.position.y = this.position.y + norm.y * 10;
		weapon.damage = this.damage;
		weapon.attackDirection = norm;
	}
}
