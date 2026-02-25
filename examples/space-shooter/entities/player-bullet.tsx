import { NodePool, type Poolable } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, type CollisionInfo, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { GAME_WIDTH, PLAYER_BULLET_SPEED } from "../config.js";
import { FRAME, PLAYER_BULLET_SCALE_X, PLAYER_BULLET_SCALE_Y, tilesetAtlas } from "../sprites.js";

export class PlayerBullet extends Actor implements Poolable {
	override collisionGroup = "pBullets";
	override gravity = 0;
	override applyGravity = false;

	/** Angle offset for spread bullets (radians). */
	angleOffset = 0;

	/** Whether this is a spread bullet (uses green laser sprite). */
	isSpread = false;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(4, 10)} />
				<Sprite
					ref="sprite"
					texture="tileset"
					sourceRect={tilesetAtlas.getFrameOrThrow(FRAME.PLAYER_BULLET)}
					scale={[PLAYER_BULLET_SCALE_X, PLAYER_BULLET_SCALE_Y]}
				/>
			</>
		);
	}

	sprite!: Sprite;

	override onReady() {
		super.onReady();
		// Bullet self-handles collision with enemies
		this.collided.connect((info: CollisionInfo) => {
			if (info.collider.hasTag("enemy")) {
				const enemy = info.collider as { takeDamage(n: number): void };
				enemy.takeDamage(1);
			}
			this._recycle();
		});
	}

	override onFixedUpdate(dt: number) {
		const vx = Math.sin(this.angleOffset) * PLAYER_BULLET_SPEED;
		const vy = -Math.cos(this.angleOffset) * PLAYER_BULLET_SPEED;
		this.velocity = new Vec2(vx, vy);
		this.move(dt);

		// Off-screen cleanup
		if (this.position.y < -20 || this.position.x < -20 || this.position.x > GAME_WIDTH + 20) {
			this._recycle();
		}
	}

	reset(): void {
		this.angleOffset = 0;
		this.isSpread = false;
	}

	private _recycle(): void {
		if (!this.isInsideTree) return;
		playerBulletPool.release(this);
	}
}

export const playerBulletPool = new NodePool(PlayerBullet, 100);
