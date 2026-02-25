import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import {
	BOMBER_ENEMY_HP,
	BOMBER_ENEMY_POINTS,
	BOMBER_ENEMY_SPEED,
	BOMBER_FIRE_INTERVAL,
	GAME_HEIGHT,
} from "../config.js";
import { BOMBER_ENEMY_SCALE_X, BOMBER_ENEMY_SCALE_Y, FRAME, tilesetAtlas } from "../sprites.js";
import { enemyBulletPool } from "./enemy-bullet.js";

export class BomberEnemy extends Actor {
	override collisionGroup = "enemies";
	override solid = true;
	override gravity = 0;
	override applyGravity = false;

	hp = BOMBER_ENEMY_HP;
	points = BOMBER_ENEMY_POINTS;

	readonly died: Signal<BomberEnemy> = signal<BomberEnemy>();

	private _fireTimer = 0;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(16, 14)} />
				<Sprite
					texture="tileset"
					sourceRect={tilesetAtlas.getFrameOrThrow(FRAME.BOMBER_ENEMY)}
					scale={[BOMBER_ENEMY_SCALE_X, BOMBER_ENEMY_SCALE_Y]}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("enemy");
	}

	override onFixedUpdate(dt: number) {
		this.velocity = new Vec2(0, BOMBER_ENEMY_SPEED);
		this.move(dt);

		// Drop bombs periodically
		this._fireTimer += dt;
		if (this._fireTimer >= BOMBER_FIRE_INTERVAL) {
			this._fireTimer -= BOMBER_FIRE_INTERVAL;
			this._dropBomb();
		}

		// Wrap to top when off-screen bottom
		if (this.position.y > GAME_HEIGHT + 40) {
			this.position._set(this.position.x, -30);
			const world = this._getWorld();
			if (world) world.updatePosition(this);
		}
	}

	takeDamage(amount: number): void {
		this.hp -= amount;
		if (this.hp <= 0) {
			this.died.emit(this);
			this.destroy();
		}
	}

	private _dropBomb(): void {
		if (!this.isInsideTree) return;
		const bullet = enemyBulletPool.acquire();
		bullet.position._set(this.position.x, this.position.y + 16);
		this.scene!.add(bullet);
	}

	serialize(): Record<string, unknown> {
		return { hp: this.hp, x: this.position.x, y: this.position.y };
	}
}
