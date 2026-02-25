import { Node2D, type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { tileSheet } from "../sprites.js";
import type { PathFollower } from "./path-follower.js";
import { Projectile } from "./projectile.js";

/**
 * Base class for all tower types.
 * Uses a child Sensor for range detection (no physics on the tower itself).
 */
export abstract class TowerBase extends Node2D {
	abstract range: number;
	abstract damage: number;
	abstract fireRate: number;
	abstract baseFrame: number;
	abstract turretFrame: number;
	abstract projectileFrame: number;

	/** Splash radius for area-of-effect towers. 0 = single target. */
	splashRadius = 0;
	/** Slow multiplier for slow towers. 0 = no slow effect. */
	slowEffect = 0;
	/** Duration of slow effect in seconds. */
	slowDuration = 0;

	readonly fired: Signal<void> = signal<void>();

	private _fireTimer = 0;
	private _enemiesInRange: Set<PathFollower> = new Set();
	private _rangeSensor!: Sensor;

	override build() {
		return (
			<>
				<Sprite texture="tileset" sourceRect={tileSheet.getFrameRect(this.baseFrame)} scale={0.9} />
				<Sprite
					texture="tileset"
					sourceRect={tileSheet.getFrameRect(this.turretFrame)}
					scale={0.7}
				/>
			</>
		);
	}

	override onReady() {
		this.tag("tower");

		// Create range sensor as a child
		this._rangeSensor = new Sensor();
		this._rangeSensor.collisionGroup = "towers";
		this._rangeSensor.monitoring = true;
		const shape = new CollisionShape();
		shape.shape = Shape.circle(this.range);
		this._rangeSensor.addChild(shape);
		this.addChild(this._rangeSensor);

		this._rangeSensor.bodyEntered.connect((body) => {
			if (body.collisionGroup === "enemies") {
				this._enemiesInRange.add(body as PathFollower);
			}
		});

		this._rangeSensor.bodyExited.connect((body) => {
			this._enemiesInRange.delete(body as PathFollower);
		});
	}

	override onFixedUpdate(dt: number) {
		// Clean up destroyed enemies
		for (const enemy of this._enemiesInRange) {
			if (enemy.isDestroyed) {
				this._enemiesInRange.delete(enemy);
			}
		}

		this._fireTimer -= dt;
		if (this._fireTimer > 0) return;
		if (this._enemiesInRange.size === 0) return;

		const target = this._pickTarget();
		if (!target) return;

		this._fire(target);
		this._fireTimer = this.fireRate;
	}

	/** Pick the enemy closest to the exit (highest waypointIndex). */
	private _pickTarget(): PathFollower | null {
		let best: PathFollower | null = null;
		let bestIndex = -1;

		for (const enemy of this._enemiesInRange) {
			if (enemy.isDestroyed) continue;
			if (enemy.waypointIndex > bestIndex) {
				bestIndex = enemy.waypointIndex;
				best = enemy;
			}
		}

		return best;
	}

	private _fire(target: PathFollower): void {
		const projectile = new Projectile();
		projectile.target = target;
		projectile.damage = this.damage;
		projectile.splashRadius = this.splashRadius;
		projectile.slowEffect = this.slowEffect;
		projectile.slowDuration = this.slowDuration;
		projectile.frameIndex = this.projectileFrame;
		projectile.position = new Vec2(this.position.x, this.position.y);
		this.scene?.addChild(projectile);

		this.fired.emit();
	}

	getEnemiesInRange(): Set<PathFollower> {
		return this._enemiesInRange;
	}

	serialize(): Record<string, unknown> {
		return {
			x: this.position.x,
			y: this.position.y,
			enemiesInRange: this._enemiesInRange.size,
		};
	}
}
