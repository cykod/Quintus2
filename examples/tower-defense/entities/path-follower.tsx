import { Damageable } from "@quintus/ai-prefabs";
import { type Signal, signal } from "@quintus/core";
import type { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { CELL_SIZE } from "../config.js";
import { gridToWorld, type PathDef } from "../path.js";
import { tileSheet } from "../sprites.js";

const DamageableActor = Damageable(Actor, {
	invincibilityDuration: 0,
	deathTween: false,
});

/**
 * Base class for enemies that follow a waypoint path.
 * Subclasses set speed, maxHealth, gold, and frame index.
 */
export abstract class PathFollower extends DamageableActor {
	override collisionGroup = "enemies";
	// solid = true so tower Sensors can detect enemies via bodyEntered/bodyExited
	override solid = true;
	override gravity = 0;
	override applyGravity = false;

	abstract speed: number;
	abstract override maxHealth: number;
	abstract goldReward: number;
	abstract frameIndex: number;

	/** Current slowdown multiplier (1 = normal, <1 = slowed). */
	slowMultiplier = 1;
	private _slowTimer = 0;

	/** Current target waypoint index. */
	waypointIndex = 0;
	private _worldWaypoints: Vec2[] = [];

	/** Timer for walking shimmy animation. */
	private _shimmyTime = 0;

	readonly reachedExit: Signal<PathFollower> = signal<PathFollower>();

	/** Must be set before adding to scene. */
	pathDef!: PathDef;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.circle(CELL_SIZE * 0.35)} />
				<Sprite
					texture="tileset"
					sourceRect={tileSheet.getFrameRect(this.frameIndex)}
					scale={0.7}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("enemy");

		// Convert grid waypoints to world positions
		this._worldWaypoints = this.pathDef.waypoints.map((wp) => gridToWorld(wp.x, wp.y));

		// Start at first waypoint
		if (this._worldWaypoints.length > 0) {
			const start = this._worldWaypoints[0]!;
			this.position._set(start.x, start.y);
			this.waypointIndex = 1;
		}
	}

	// Manual position updates instead of Actor.move() — path followers don't need
	// physics-based collision response, they simply lerp between waypoints.
	override onFixedUpdate(dt: number) {
		super.onFixedUpdate(dt);

		// Update slow timer
		if (this._slowTimer > 0) {
			this._slowTimer -= dt;
			if (this._slowTimer <= 0) {
				this.slowMultiplier = 1;
			}
		}

		if (this.waypointIndex >= this._worldWaypoints.length) {
			// Reached the exit
			this.reachedExit.emit(this);
			this.destroy();
			return;
		}

		const target = this._worldWaypoints[this.waypointIndex]!;
		const dx = target.x - this.position.x;
		const dy = target.y - this.position.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		const effectiveSpeed = this.speed * this.slowMultiplier;
		const step = effectiveSpeed * dt;

		if (dist <= step) {
			// Reached waypoint
			this.position._set(target.x, target.y);
			this.waypointIndex++;
		} else {
			// Move toward waypoint
			this.position._set(
				this.position.x + (dx / dist) * step,
				this.position.y + (dy / dist) * step,
			);

			// Face movement direction with walking shimmy animation:
			// 14 = oscillation frequency (cycles/sec), 0.12 = amplitude in radians (~7°)
			const baseAngle = Math.atan2(dy, dx);
			this._shimmyTime += dt;
			const shimmy = Math.sin(this._shimmyTime * 14) * 0.12;
			this.rotation = baseAngle + shimmy;
		}

		// Required to keep the physics spatial hash in sync with manual position changes
		const world = this._getWorld();
		if (world) world.updatePosition(this);
	}

	applySlow(multiplier: number, duration: number): void {
		this.slowMultiplier = multiplier;
		this._slowTimer = duration;
	}

	serialize(): Record<string, unknown> {
		return {
			health: this.health,
			waypointIndex: this.waypointIndex,
			x: this.position.x,
			y: this.position.y,
			slowMultiplier: this.slowMultiplier,
		};
	}
}
