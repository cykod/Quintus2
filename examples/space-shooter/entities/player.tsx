import { Damageable } from "@quintus/ai-prefabs";
import { Vec2 } from "@quintus/math";
import type { Shape2D } from "@quintus/physics";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import {
	GAME_HEIGHT,
	GAME_WIDTH,
	PLAYER_BULLET_SPEED,
	PLAYER_FIRE_RATE,
	PLAYER_INVINCIBILITY_DURATION,
	PLAYER_MAX_HEALTH,
	PLAYER_RAPID_FIRE_RATE,
	PLAYER_SPEED,
} from "../config.js";
import { FRAME, PLAYER_SCALE_X, PLAYER_SCALE_Y, tilesetAtlas } from "../sprites.js";
import { gameState } from "../state.js";
import { playerBulletPool } from "./player-bullet.js";

const DamageableActor = Damageable(Actor, {
	maxHealth: PLAYER_MAX_HEALTH,
	invincibilityDuration: PLAYER_INVINCIBILITY_DURATION,
	deathTween: false,
});

const HALF_WIDTH = 20;
const HALF_HEIGHT = 15;
const SPREAD_ANGLE = Math.PI / 12; // ~15 degrees

/** Convex hull approximating the player ship silhouette (~40x30 visual). */
const PLAYER_SHAPE: Shape2D = Shape.polygon([
	new Vec2(0, -14), // nose
	new Vec2(18, 4), // right wing
	new Vec2(10, 14), // right engine
	new Vec2(-10, 14), // left engine
	new Vec2(-18, 4), // left wing
]);

export class Player extends DamageableActor {
	override collisionGroup = "player";
	override solid = true;
	override gravity = 0;
	override applyGravity = false;

	shieldActive = false;
	spreadShot = false;
	rapidFire = false;

	private _fireTimer = 0;

	sprite!: Sprite;

	override build() {
		return (
			<>
				<CollisionShape shape={PLAYER_SHAPE} />
				<Sprite
					ref="sprite"
					texture="tileset"
					sourceRect={tilesetAtlas.getFrameOrThrow(FRAME.PLAYER)}
					scale={[PLAYER_SCALE_X, PLAYER_SCALE_Y]}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("player");
	}

	override onFixedUpdate(dt: number) {
		super.onFixedUpdate(dt); // tick Damageable invincibility timer

		// --- Movement ---
		const hAxis = this.game.input.getAxis("left", "right");
		const vAxis = this.game.input.getAxis("up", "down");
		this.velocity = new Vec2(hAxis * PLAYER_SPEED, vAxis * PLAYER_SPEED);
		this.move(dt);

		// Clamp to screen
		const px = Math.max(HALF_WIDTH, Math.min(GAME_WIDTH - HALF_WIDTH, this.position.x));
		const py = Math.max(HALF_HEIGHT, Math.min(GAME_HEIGHT - HALF_HEIGHT, this.position.y));
		if (px !== this.position.x || py !== this.position.y) {
			this.position._set(px, py);
			const world = this._getWorld();
			if (world) world.updatePosition(this);
		}

		// --- Auto-fire ---
		this._fireTimer -= dt;
		if (this.game.input.isPressed("fire") && this._fireTimer <= 0) {
			this._fire();
			const rate = this.rapidFire ? PLAYER_RAPID_FIRE_RATE : PLAYER_FIRE_RATE;
			this._fireTimer = rate;
		}
	}

	override takeDamage(amount: number): void {
		if (this.shieldActive) return;
		if (this.isDead() || this.isInvincible()) return;
		this.game.audio.play("player_hit", { bus: "sfx" });
		super.takeDamage(amount);
		gameState.lives = this.health;
	}

	/**
	 * Design decision -- Spread shot angle mapping:
	 * -PI/2 = straight up in the Bullet rotation frame. The offset rotates
	 * from vertical: -SPREAD_ANGLE goes left, +SPREAD_ANGLE goes right.
	 */
	private _fire(): void {
		this.game.audio.play("player_shoot", { bus: "sfx" });
		const spawnPos = new Vec2(this.position.x, this.position.y - HALF_HEIGHT);
		const bulletCfg = { speed: PLAYER_BULLET_SPEED, damage: 1, lifetime: 0 };

		if (this.spreadShot) {
			// Fire 3 bullets in a spread
			for (const offset of [-SPREAD_ANGLE, 0, SPREAD_ANGLE]) {
				const bullet = playerBulletPool.acquire();
				bullet.isSpread = true;
				bullet.angleOffset = offset;
				bullet.fire(spawnPos, -Math.PI / 2 + offset, bulletCfg);
				this.scene!.add(bullet);
			}
		} else {
			const bullet = playerBulletPool.acquire();
			bullet.fire(spawnPos, -Math.PI / 2, bulletCfg);
			this.scene!.add(bullet);
		}
	}
}
