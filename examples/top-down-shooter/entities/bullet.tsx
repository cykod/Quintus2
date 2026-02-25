import type { DrawContext, Poolable } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import type { CollisionInfo } from "@quintus/physics";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import type { BaseEnemy } from "./base-enemy.js";
import type { BulletManager } from "./bullet-manager.js";
import type { Player } from "./player.js";

const BULLET_RADIUS = 3;
const BULLET_LIFETIME = 3;
const PLAYER_BULLET_COLOR = Color.fromHex("#ffdd44");
const ENEMY_BULLET_COLOR = Color.fromHex("#ff4444");
const _center = new Vec2(0, 0);

export class PlayerBullet extends Actor implements Poolable {
	override collisionGroup = "player_bullets";
	override gravity = 0;
	override applyGravity = false;
	override upDirection = new Vec2(0, 0);

	speed = 400;
	damage = 25;
	private _lifetime = BULLET_LIFETIME;
	private _elapsed = 0;
	private _recycled = false;
	private _collisionConnected = false;

	_manager: BulletManager | null = null;

	override build() {
		return <CollisionShape shape={Shape.circle(BULLET_RADIUS)} />;
	}

	override onReady() {
		super.onReady();
		this._recycled = false;
		if (!this._collisionConnected) {
			this._collisionConnected = true;
			this.collided.connect((info: CollisionInfo) => {
				if (info.collider.hasTag("enemy")) {
					(info.collider as BaseEnemy).takeDamage(this.damage);
				}
				this._recycle();
			});
		}
	}

	override onFixedUpdate(dt: number) {
		if (this._recycled || !this.gameOrNull) return;

		this._elapsed += dt;
		if (this._elapsed >= this._lifetime) {
			this._recycle();
			return;
		}

		this.velocity.x = Math.cos(this.rotation) * this.speed;
		this.velocity.y = Math.sin(this.rotation) * this.speed;
		this.move(dt);
	}

	onDraw(ctx: DrawContext): void {
		ctx.circle(_center, BULLET_RADIUS, { fill: PLAYER_BULLET_COLOR });
	}

	reset(): void {
		// Restore properties that _poolReset() overrides
		this.collisionGroup = "player_bullets";
		this.applyGravity = false;
		this.upDirection._set(0, 0);
		this._collisionConnected = false;

		this.speed = 400;
		this.damage = 25;
		this._lifetime = BULLET_LIFETIME;
		this._elapsed = 0;
		this._recycled = false;
	}

	private _recycle(): void {
		if (this._recycled) return;
		this._recycled = true;
		this._manager?.recyclePlayerBullet(this);
	}
}

export class EnemyBullet extends Actor implements Poolable {
	override collisionGroup = "enemy_bullets";
	override gravity = 0;
	override applyGravity = false;
	override upDirection = new Vec2(0, 0);

	speed = 200;
	damage = 15;
	private _lifetime = BULLET_LIFETIME;
	private _elapsed = 0;
	private _recycled = false;
	private _collisionConnected = false;

	_manager: BulletManager | null = null;

	override build() {
		return <CollisionShape shape={Shape.circle(BULLET_RADIUS)} />;
	}

	override onReady() {
		super.onReady();
		this._recycled = false;
		if (!this._collisionConnected) {
			this._collisionConnected = true;
			this.collided.connect((info: CollisionInfo) => {
				if (info.collider.hasTag("player")) {
					(info.collider as Player).takeDamage(this.damage);
				}
				this._recycle();
			});
		}
	}

	override onFixedUpdate(dt: number) {
		if (this._recycled || !this.gameOrNull) return;

		this._elapsed += dt;
		if (this._elapsed >= this._lifetime) {
			this._recycle();
			return;
		}

		this.velocity.x = Math.cos(this.rotation) * this.speed;
		this.velocity.y = Math.sin(this.rotation) * this.speed;
		this.move(dt);
	}

	onDraw(ctx: DrawContext): void {
		ctx.circle(_center, BULLET_RADIUS, { fill: ENEMY_BULLET_COLOR });
	}

	reset(): void {
		// Restore properties that _poolReset() overrides
		this.collisionGroup = "enemy_bullets";
		this.applyGravity = false;
		this.upDirection._set(0, 0);
		this._collisionConnected = false;

		this.speed = 200;
		this.damage = 15;
		this._lifetime = BULLET_LIFETIME;
		this._elapsed = 0;
		this._recycled = false;
	}

	private _recycle(): void {
		if (this._recycled) return;
		this._recycled = true;
		this._manager?.recycleEnemyBullet(this);
	}
}
