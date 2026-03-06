import type { Poolable } from "@quintus/core";
import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, type CollisionObject } from "@quintus/physics";

export interface BulletConfig {
	speed: number;
	damage: number;
	lifetime: number;
}

const OFF_SCREEN_MARGIN = 32;

export class Bullet extends Actor implements Poolable {
	override collisionGroup = "bullets";
	override solid = false;
	override gravity = 0;
	override applyGravity = false;
	override upDirection = new Vec2(0, 0);

	speed = 400;
	damage = 25;
	lifetime = 3;

	readonly hit: Signal<CollisionObject> = signal<CollisionObject>();

	/** Movement direction in radians. Updated by fire(); can be changed per-frame for homing. */
	angle = 0;

	private _elapsed = 0;
	private _fired = false;
	private _releaser: ((b: Bullet) => void) | null = null;

	fire(pos: Vec2, angle: number, overrides?: Partial<BulletConfig>): void {
		this.position.x = pos.x;
		this.position.y = pos.y;
		this.angle = angle;
		if (overrides) {
			if (overrides.speed !== undefined) this.speed = overrides.speed;
			if (overrides.damage !== undefined) this.damage = overrides.damage;
			if (overrides.lifetime !== undefined) this.lifetime = overrides.lifetime;
		}
		this._fired = true;
		this._elapsed = 0;
	}

	setReleaser(fn: (b: Bullet) => void): void {
		this._releaser = fn;
	}

	override onReady() {
		super.onReady();
		this.collided.connect((info) => {
			this.hit.emit(info.collider);
			this._recycle();
		});
	}

	override onFixedUpdate(dt: number) {
		if (!this._fired) return;
		super.onFixedUpdate(dt);

		this._elapsed += dt;
		if (this.lifetime > 0 && this._elapsed >= this.lifetime) {
			this._recycle();
			return;
		}

		this.velocity.x = Math.cos(this.angle) * this.speed;
		this.velocity.y = Math.sin(this.angle) * this.speed;
		this.move(dt);

		// Bullet may have been recycled during move() collision
		if (!this.isInsideTree) return;
		this._checkOffScreen();
	}

	reset(): void {
		this.speed = 400;
		this.damage = 25;
		this.lifetime = 3;
		this._elapsed = 0;
		this._fired = false;
		this.angle = 0;
		this._releaser = null;
	}

	private _checkOffScreen(): void {
		const g = this.game;
		if (!g) return;
		const { x, y } = this.position;
		if (
			x < -OFF_SCREEN_MARGIN ||
			x > g.width + OFF_SCREEN_MARGIN ||
			y < -OFF_SCREEN_MARGIN ||
			y > g.height + OFF_SCREEN_MARGIN
		) {
			this._recycle();
		}
	}

	private _recycle(): void {
		if (!this.isInsideTree) return;
		if (this._releaser) {
			this._releaser(this);
		} else {
			this.destroy();
		}
	}
}
