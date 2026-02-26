import { Node2D } from "@quintus/core";
import { Sprite } from "@quintus/sprites";
import { PROJECTILE_SPEED } from "../config.js";
import { tileSheet } from "../sprites.js";
import type { PathFollower } from "./path-follower.js";

/**
 * A homing projectile that moves toward its target enemy.
 * Not physics-driven — purely positional movement.
 * Rotates to face its direction of travel.
 */
export class Projectile extends Node2D {
	target!: PathFollower;
	damage = 1;
	splashRadius = 0;
	slowEffect = 0;
	slowDuration = 0;
	frameIndex = 0;

	override build() {
		return (
			<Sprite texture="tileset" sourceRect={tileSheet.getFrameRect(this.frameIndex)} scale={0.5} />
		);
	}

	override onReady() {
		this.tag("projectile");
		this.zIndex = -1;
	}

	override onFixedUpdate(dt: number) {
		// If target is destroyed, self-destruct
		if (this.target.isDestroyed) {
			this.destroy();
			return;
		}

		const dx = this.target.position.x - this.position.x;
		const dy = this.target.position.y - this.position.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		const step = PROJECTILE_SPEED * dt;

		// Rotate to face movement direction (sprites face up by default)
		this.rotation = Math.atan2(dy, dx) + Math.PI / 2;

		if (dist <= step) {
			// Hit the target
			this._onHit();
		} else {
			this.position._set(
				this.position.x + (dx / dist) * step,
				this.position.y + (dy / dist) * step,
			);
		}
	}

	private _onHit(): void {
		if (this.splashRadius > 0) {
			// Splash damage: find all enemies within radius
			this._applySplashDamage();
		} else {
			// Single target
			if (!this.target.isDestroyed) {
				this.target.takeDamage(this.damage);
				if (this.slowEffect > 0) {
					this.target.applySlow(this.slowEffect, this.slowDuration);
				}
			}
		}
		this.destroy();
	}

	private _applySplashDamage(): void {
		const enemies = this.scene?.findAll("enemy");
		for (const node of enemies) {
			const enemy = node as PathFollower;
			if (enemy.isDestroyed) continue;
			const dx = enemy.position.x - this.position.x;
			const dy = enemy.position.y - this.position.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist <= this.splashRadius) {
				enemy.takeDamage(this.damage);
				if (this.slowEffect > 0) {
					enemy.applySlow(this.slowEffect, this.slowDuration);
				}
			}
		}
	}
}
