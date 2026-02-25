import { NodePool, type Poolable } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, type CollisionInfo, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { ENEMY_BULLET_SPEED, GAME_HEIGHT, GAME_WIDTH } from "../config.js";
import { ENEMY_BULLET_SCALE_X, ENEMY_BULLET_SCALE_Y, FRAME, tilesetAtlas } from "../sprites.js";
import type { Player } from "./player.js";

export class EnemyBullet extends Actor implements Poolable {
	override collisionGroup = "eBullets";
	override gravity = 0;
	override applyGravity = false;

	/** Direction angle (radians). 0 = straight down. */
	angle = 0;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(4, 10)} />
				<Sprite
					texture="tileset"
					sourceRect={tilesetAtlas.getFrameOrThrow(FRAME.ENEMY_BULLET)}
					scale={[ENEMY_BULLET_SCALE_X, ENEMY_BULLET_SCALE_Y]}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		// Bullet self-handles collision with player
		this.collided.connect((info: CollisionInfo) => {
			if (info.collider.hasTag("player")) {
				(info.collider as Player).takeDamage();
			}
			this._recycle();
		});
	}

	override onFixedUpdate(dt: number) {
		const vx = Math.sin(this.angle) * ENEMY_BULLET_SPEED;
		const vy = Math.cos(this.angle) * ENEMY_BULLET_SPEED;
		this.velocity = new Vec2(vx, vy);
		this.move(dt);

		// Off-screen cleanup
		if (
			this.position.y > GAME_HEIGHT + 20 ||
			this.position.y < -20 ||
			this.position.x < -20 ||
			this.position.x > GAME_WIDTH + 20
		) {
			this._recycle();
		}
	}

	reset(): void {
		this.angle = 0;
	}

	private _recycle(): void {
		if (!this.isInsideTree) return;
		enemyBulletPool.release(this);
	}
}

export const enemyBulletPool = new NodePool(EnemyBullet, 50);
