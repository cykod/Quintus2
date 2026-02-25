import { FRAME } from "../sprites.js";
import { BaseEnemy } from "./base-enemy.js";

const PREFERRED_DIST_MIN = 150;
const PREFERRED_DIST_MAX = 250;
const FIRE_COOLDOWN = 1.5;
const BULLET_SPEED = 200;
const BULLET_DAMAGE = 10;

export class Robot extends BaseEnemy {
	maxHealth = 80;
	speed = 40;
	contactDamage = 10;
	scoreValue = 25;
	spriteFrame = FRAME.ROBOT_GUN;

	private _fireCooldown = FIRE_COOLDOWN;

	override onFixedUpdate(dt: number) {
		this._facePlayer();

		// Maintain preferred distance
		const dist = this._distToPlayer();
		const dir = this._dirToPlayer();

		if (dist > PREFERRED_DIST_MAX) {
			// Too far — approach
			this.velocity.x = dir.x * this.speed;
			this.velocity.y = dir.y * this.speed;
		} else if (dist < PREFERRED_DIST_MIN) {
			// Too close — retreat
			this.velocity.x = -dir.x * this.speed;
			this.velocity.y = -dir.y * this.speed;
		} else {
			// In range — strafe
			this.velocity.x = -dir.y * this.speed * 0.5;
			this.velocity.y = dir.x * this.speed * 0.5;
		}
		this.move(dt);

		// Fire
		this._fireCooldown -= dt;
		if (this._fireCooldown <= 0 && this._bulletManager) {
			this._fireCooldown = FIRE_COOLDOWN;
			const angle = Math.atan2(dir.y, dir.x);
			this._bulletManager.spawnEnemyBullet(
				this.position.x + dir.x * 14,
				this.position.y + dir.y * 14,
				angle,
				BULLET_SPEED,
				BULLET_DAMAGE,
			);
		}
	}

	override reset(): void {
		super.reset();
		this._fireCooldown = FIRE_COOLDOWN;
	}
}
