import { FRAME } from "../sprites.js";
import { BaseEnemy } from "./base-enemy.js";

const FIRE_COOLDOWN = 2.5;
const BURST_COUNT = 3;
const BURST_INTERVAL = 0.1;
const BULLET_SPEED = 250;
const BULLET_DAMAGE = 15;

export class Soldier extends BaseEnemy {
	maxHealth = 120;
	speed = 50;
	contactDamage = 15;
	scoreValue = 40;
	spriteFrame = FRAME.SOLDIER_GUN;

	private _fireCooldown = FIRE_COOLDOWN;
	private _burstRemaining = 0;
	private _burstTimer = 0;

	override onFixedUpdate(dt: number) {
		this._facePlayer();

		// Advance toward player
		const dir = this._dirToPlayer();
		const dist = this._distToPlayer();
		if (dist > 100) {
			this.velocity.x = dir.x * this.speed;
			this.velocity.y = dir.y * this.speed;
		} else {
			this.velocity.x = 0;
			this.velocity.y = 0;
		}
		this.move(dt);

		// Burst fire
		if (this._burstRemaining > 0) {
			this._burstTimer -= dt;
			if (this._burstTimer <= 0 && this._bulletManager) {
				this._burstTimer = BURST_INTERVAL;
				this._burstRemaining--;
				const angle = Math.atan2(dir.y, dir.x);
				this._bulletManager.spawnEnemyBullet(
					this.position.x + dir.x * 14,
					this.position.y + dir.y * 14,
					angle,
					BULLET_SPEED,
					BULLET_DAMAGE,
				);
			}
		} else {
			this._fireCooldown -= dt;
			if (this._fireCooldown <= 0) {
				this._fireCooldown = FIRE_COOLDOWN;
				this._burstRemaining = BURST_COUNT;
				this._burstTimer = 0;
			}
		}
	}

	override reset(): void {
		super.reset();
		this._fireCooldown = FIRE_COOLDOWN;
		this._burstRemaining = 0;
		this._burstTimer = 0;
	}
}
