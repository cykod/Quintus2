import { Bullet } from "@quintus/ai-prefabs";
import { NodePool } from "@quintus/core";
import type { CollisionInfo } from "@quintus/physics";
import { CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { ENEMY_BULLET_SCALE_X, ENEMY_BULLET_SCALE_Y, FRAME, tilesetAtlas } from "../sprites.js";
import type { Player } from "./player.js";

export class EnemyBullet extends Bullet {
	override collisionGroup = "eBullets";

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(5, 16)} />
				<Sprite
					texture="tileset"
					sourceRect={tilesetAtlas.getFrameOrThrow(FRAME.ENEMY_BULLET)}
					scale={[ENEMY_BULLET_SCALE_X, ENEMY_BULLET_SCALE_Y]}
				/>
			</>
		);
	}

	override onReady() {
		this.setReleaser((b) => enemyBulletPool.release(b as EnemyBullet));

		// Deal damage to player on collision (before super wires hit+recycle)
		this.collided.connect((info: CollisionInfo) => {
			if (info.collider.hasTag("player")) {
				(info.collider as Player).takeDamage(1);
			}
		});

		super.onReady();
	}
}

export const enemyBulletPool = new NodePool(EnemyBullet, 50);
