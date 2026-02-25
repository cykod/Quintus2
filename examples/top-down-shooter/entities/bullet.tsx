import type { DrawContext, Poolable } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import type { CollisionInfo } from "@quintus/physics";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import type { BulletManager } from "./bullet-manager.js";

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

	_manager: BulletManager | null = null;

	override build() {
		return <CollisionShape shape={Shape.circle(BULLET_RADIUS)} />;
	}

	override onReady() {
		super.onReady();
		this._recycled = false;
		this.collided.connect((_info: CollisionInfo) => {
			this._recycle();
		});
	}

	override onFixedUpdate(dt: number) {
		this._elapsed += dt;
		if (this._elapsed >= this._lifetime) {
			this._recycle();
			return;
		}

		const angle = this.rotation - Math.PI / 2;
		this.velocity.x = Math.cos(angle) * this.speed;
		this.velocity.y = Math.sin(angle) * this.speed;
		this.move(dt);
	}

	onDraw(ctx: DrawContext): void {
		ctx.circle(_center, BULLET_RADIUS, { fill: PLAYER_BULLET_COLOR });
	}

	reset(): void {
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

	_manager: BulletManager | null = null;

	override build() {
		return <CollisionShape shape={Shape.circle(BULLET_RADIUS)} />;
	}

	override onReady() {
		super.onReady();
		this._recycled = false;
		this.collided.connect((_info: CollisionInfo) => {
			this._recycle();
		});
	}

	override onFixedUpdate(dt: number) {
		this._elapsed += dt;
		if (this._elapsed >= this._lifetime) {
			this._recycle();
			return;
		}

		const angle = this.rotation - Math.PI / 2;
		this.velocity.x = Math.cos(angle) * this.speed;
		this.velocity.y = Math.sin(angle) * this.speed;
		this.move(dt);
	}

	onDraw(ctx: DrawContext): void {
		ctx.circle(_center, BULLET_RADIUS, { fill: ENEMY_BULLET_COLOR });
	}

	reset(): void {
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
