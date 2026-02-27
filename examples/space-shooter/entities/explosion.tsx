import type { Scene } from "@quintus/core";
import { Node2D, NodePool, type Poolable } from "@quintus/core";
import type { Vec2 } from "@quintus/math";
import { AnimatedSprite } from "@quintus/sprites";
import { particleSheet } from "../sprites.js";

const FLASH_DURATION = 9 / 30; // 9 frames at 30fps
const EXPLOSION_DURATION = 9 / 24; // 9 frames at 24fps

export class ParticleEffect extends Node2D implements Poolable {
	_returnPool: NodePool<ParticleEffect> | null = null;
	_elapsed = 0;
	_duration = 0;

	sprite!: AnimatedSprite;

	override build() {
		return <AnimatedSprite ref="sprite" spriteSheet={particleSheet} />;
	}

	override onFixedUpdate(dt: number) {
		this._elapsed += dt;
		if (this._elapsed >= this._duration && this._duration > 0) {
			this._recycle();
		}
	}

	reset(): void {
		this.scale._set(1, 1);
		this._elapsed = 0;
		this._duration = 0;
	}

	private _recycle(): void {
		if (!this.isInsideTree || !this._returnPool) return;
		this._returnPool.release(this);
	}
}

export const flashPool = new NodePool(ParticleEffect, 20);
export const explosionPool = new NodePool(ParticleEffect, 15);

/** Spawn a small hit flash attached to a parent node at a world-space impact point. */
export function spawnFlash(parent: Node2D, worldPoint: Vec2): void {
	const fx = flashPool.acquire();
	fx._returnPool = flashPool;
	// Convert world-space point to parent-local offset
	fx.position._set(worldPoint.x - parent.position.x, worldPoint.y - parent.position.y);
	fx.scale._set(0.5, 0.5);
	parent.add(fx);
	fx.sprite.play("flash", true);
	fx._elapsed = 0;
	fx._duration = FLASH_DURATION;
}

/** Spawn an explosion at the given position, scaled to match enemy size. */
export function spawnExplosion(scene: Scene, pos: Vec2, sizeScale = 1): void {
	const fx = explosionPool.acquire();
	fx._returnPool = explosionPool;
	fx.position._set(pos.x, pos.y);
	fx.scale._set(sizeScale, sizeScale);
	scene.add(fx);
	fx.sprite.play("explosion", true);
	fx._elapsed = 0;
	fx._duration = EXPLOSION_DURATION;
}
