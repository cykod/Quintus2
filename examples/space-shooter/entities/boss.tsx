import { Damageable } from "@quintus/ai-prefabs";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import {
	BOSS_FIRE_INTERVAL,
	BOSS_HP,
	BOSS_POINTS,
	BOSS_SPEED,
	ENEMY_BULLET_SPEED,
	GAME_WIDTH,
} from "../config.js";
import { BOSS_SCALE, FRAME, tilesetAtlas } from "../sprites.js";
import { enemyBulletPool } from "./enemy-bullet.js";
import { spawnFlash } from "./explosion.js";

const DamageableActor = Damageable(Actor, { invincibilityDuration: 0, deathTween: false });

const BOSS_HALF_WIDTH = 30;
const BOSS_RADIUS = 28;

/**
 * Design decision -- Boss patrol + spread fire pattern:
 * Horizontal patrol bounces between screen edges at BOSS_SPEED. On each
 * BOSS_FIRE_INTERVAL tick, fires a 3-bullet spread at angles [-0.3, 0, 0.3]
 * radians (~34-degree fan). The spread is symmetric about straight-down
 * (PI/2 in the Bullet rotation frame).
 */
export class Boss extends DamageableActor {
	override collisionGroup = "enemies";
	override solid = true;
	override gravity = 0;
	override applyGravity = false;

	override maxHealth = BOSS_HP;
	points = BOSS_POINTS;

	private _fireTimer = 0;
	private _movingRight = true;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.circle(BOSS_RADIUS)} />
				<Sprite
					texture="tileset"
					sourceRect={tilesetAtlas.getFrameOrThrow(FRAME.BOSS)}
					scale={[BOSS_SCALE, BOSS_SCALE]}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("enemy");
		this.tag("boss");
	}

	override onFixedUpdate(dt: number) {
		// Horizontal patrol
		if (this._movingRight) {
			this.velocity = new Vec2(BOSS_SPEED, 0);
			if (this.position.x >= GAME_WIDTH - BOSS_HALF_WIDTH) {
				this._movingRight = false;
			}
		} else {
			this.velocity = new Vec2(-BOSS_SPEED, 0);
			if (this.position.x <= BOSS_HALF_WIDTH) {
				this._movingRight = true;
			}
		}
		this.move(dt);

		// Fire spread patterns
		this._fireTimer += dt;
		if (this._fireTimer >= BOSS_FIRE_INTERVAL) {
			this._fireTimer -= BOSS_FIRE_INTERVAL;
			this._fireSpread();
		}
	}

	override takeDamage(amount: number, hitPoint?: Vec2): void {
		if (this.isDead() || this.isInvincible()) return;
		const willDie = this.health <= amount;
		if (willDie) {
			this.game.audio.play("boss_die", { bus: "sfx" });
		} else {
			this.game.audio.play("enemy_hit", { bus: "sfx", volume: 0.5 });
			spawnFlash(this, hitPoint ?? this.position);
		}
		super.takeDamage(amount);
	}

	private _fireSpread(): void {
		if (!this.isInsideTree) return;
		this.game.audio.play("enemy_shoot", { bus: "sfx" });
		const spawnPos = new Vec2(this.position.x, this.position.y + 30);
		const bulletCfg = { speed: ENEMY_BULLET_SPEED, damage: 1, lifetime: 0 };
		// Fire 3 bullets in a spread pattern
		for (const spreadAngle of [-0.3, 0, 0.3]) {
			const bullet = enemyBulletPool.acquire();
			bullet.fire(spawnPos, Math.PI / 2 - spreadAngle, bulletCfg);
			this.scene!.add(bullet);
		}
	}
}
