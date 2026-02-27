import { Bullet } from "@quintus/ai-prefabs";
import { NodePool } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { type Actor, type CollisionInfo, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { FRAME, PLAYER_BULLET_SCALE_X, PLAYER_BULLET_SCALE_Y, tilesetAtlas } from "../sprites.js";

export class PlayerBullet extends Bullet {
	override collisionGroup = "pBullets";

	/** Angle offset for spread bullets (radians). Informational only -- angle is set via fire(). */
	angleOffset = 0;

	/** Whether this is a spread bullet. */
	isSpread = false;

	sprite!: Sprite;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(5, 16)} />
				<Sprite
					ref="sprite"
					texture="tileset"
					sourceRect={tilesetAtlas.getFrameOrThrow(FRAME.PLAYER_BULLET)}
					scale={[PLAYER_BULLET_SCALE_X, PLAYER_BULLET_SCALE_Y]}
				/>
			</>
		);
	}

	override onReady() {
		this.setReleaser((b) => playerBulletPool.release(b as PlayerBullet));

		// Deal damage to enemies on collision (before super wires hit+recycle)
		this.collided.connect((info: CollisionInfo) => {
			if (info.collider.hasTag("enemy")) {
				const enemy = info.collider as { takeDamage(n: number, hitPoint?: Vec2): void };
				// Lerp bullet position slightly toward enemy center so flash sits just inside the edge
				const ex = (info.collider as Actor).position.x;
				const ey = (info.collider as Actor).position.y;
				const t = 0.15;
				enemy.takeDamage(
					1,
					new Vec2(
						this.position.x + (ex - this.position.x) * t,
						this.position.y + (ey - this.position.y) * t,
					),
				);
			}
		});

		super.onReady();
	}

	override reset(): void {
		super.reset();
		this.angleOffset = 0;
		this.isSpread = false;
	}
}

export const playerBulletPool = new NodePool(PlayerBullet, 100);
