import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { CollisionInfo } from "./collision-info.js";
import { type BodyType, CollisionObject } from "./collision-object.js";
import type { ActorSnapshot } from "./snapshot-types.js";
import { StaticCollider } from "./static-collider.js";

/** Stop slightly before contact to prevent float-precision embedding. */
const SAFE_MARGIN = 0.01;

/** Small gravity applied when already on floor to maintain floor detection. */
const FLOOR_SNAP_GRAVITY = 1;

/** Squared epsilon for motion length cutoff. */
const EPSILON_SQ = 0.0001;

export class Actor extends CollisionObject {
	readonly bodyType: BodyType = "actor";

	/**
	 * When true, other actors' move() treats this actor as a physical obstacle.
	 * Their castMotion() will detect this actor, slide against it, and fire onCollided.
	 * Default: false (actors pass through each other).
	 */
	solid = false;

	/** Current velocity in pixels/second. Modified by move(). */
	velocity: Vec2 = new Vec2(0, 0);

	/**
	 * Gravity in pixels/second^2 applied during move().
	 * Initialized to PhysicsWorld.gravity.y in onReady().
	 * Set to 0 for zero-gravity actors (top-down games, flying enemies).
	 */
	gravity = 0;

	/**
	 * Whether move() should apply gravity automatically.
	 * When true (default), velocity.y += gravity * dt before collision detection.
	 * Set to false for fully manual velocity control.
	 */
	applyGravity = true;

	/**
	 * The "up" direction for floor/ceiling detection.
	 * Default: Vec2.UP (0, -1) for standard side-view platformer.
	 * Set to Vec2.ZERO for a top-down game (no floor concept).
	 */
	upDirection: Vec2 = new Vec2(0, -1);

	/**
	 * Maximum angle (radians) between a surface normal and upDirection
	 * for the surface to count as "floor". Default: PI/4 (45 deg).
	 */
	floorMaxAngle: number = Math.PI / 4;

	/**
	 * Maximum number of slide iterations per move() call.
	 * Higher = more accurate corner handling. Default: 4.
	 */
	maxSlides = 4;

	// === Contact State (updated by move()) ===

	private _onFloor = false;
	private _onWall = false;
	private _onCeiling = false;
	private _floorNormal = new Vec2(0, 0);
	private _wallNormal = new Vec2(0, 0);
	private _floorCollider: CollisionObject | null = null;
	private _slideCollisions: CollisionInfo[] = [];

	/** Emitted when this actor collides with another CollisionObject during move(). */
	readonly collided: Signal<CollisionInfo> = signal<CollisionInfo>();

	// === Contact Queries ===

	/** True if the last move() detected floor contact. */
	isOnFloor(): boolean {
		return this._onFloor;
	}

	/** True if the last move() detected wall contact. */
	isOnWall(): boolean {
		return this._onWall;
	}

	/** True if the last move() detected ceiling contact. */
	isOnCeiling(): boolean {
		return this._onCeiling;
	}

	/** Normal of the floor surface. Zero if not on floor. */
	getFloorNormal(): Vec2 {
		return this._floorNormal;
	}

	/** Normal of the wall surface. Zero if not on wall. */
	getWallNormal(): Vec2 {
		return this._wallNormal;
	}

	/** The CollisionObject the actor is standing on, or null. */
	getFloorCollider(): CollisionObject | null {
		return this._floorCollider;
	}

	/** All collisions from the last move() call. Only valid until the next move(). */
	getSlideCollisions(): readonly CollisionInfo[] {
		return this._slideCollisions;
	}

	// === Serialization ===

	override serialize(): ActorSnapshot {
		return {
			...super.serialize(),
			velocity: { x: this.velocity.x, y: this.velocity.y },
			gravity: this.gravity,
			isOnFloor: this._onFloor,
			isOnWall: this._onWall,
			isOnCeiling: this._onCeiling,
			collisionGroup: this.collisionGroup,
			bodyType: "actor" as const,
		};
	}

	// === Lifecycle ===

	override onReady(): void {
		super.onReady();
		// Default gravity from world
		const world = this._getWorld();
		if (world) {
			this.gravity = world.gravity.y;
		}
	}

	override onDestroy(): void {
		this.collided.disconnectAll();
		super.onDestroy();
	}

	/** Override for self-handling of physics contacts. Default emits collided signal. */
	onCollided(info: CollisionInfo): void {
		this.collided.emit(info);
	}

	// === Movement API ===

	/**
	 * The primary movement method. Moves this actor by velocity * dt,
	 * sliding along surfaces on collision.
	 *
	 * 1. Applies gravity (if applyGravity is true)
	 * 2. Casts collision shape along motion vector
	 * 3. On collision: separates, slides along surface, repeats
	 * 4. Updates floor/wall/ceiling flags
	 * 5. Zeroes velocity component into collision surfaces
	 *
	 * Call this in onFixedUpdate().
	 */
	move(dt: number): void {
		const world = this._getWorld();
		if (!world) return;

		// 1. Apply gravity
		if (this.applyGravity) {
			if (this._onFloor) {
				// Only snap if not jumping upward — preserve negative velocity from jumps
				if (this.velocity.y >= 0) {
					this.velocity.y = FLOOR_SNAP_GRAVITY;
				}
			} else {
				this.velocity.y += this.gravity * dt;
			}
		}

		// 2. Initial motion
		let motionX = this.velocity.x * dt;
		let motionY = this.velocity.y * dt;
		this._slideCollisions.length = 0;
		let totalDx = 0;
		let totalDy = 0;

		// 3. Slide loop (up to maxSlides iterations)
		for (let i = 0; i < this.maxSlides; i++) {
			if (motionX * motionX + motionY * motionY < EPSILON_SQ) break;

			const motion = new Vec2(motionX, motionY);
			const offset = totalDx !== 0 || totalDy !== 0 ? new Vec2(totalDx, totalDy) : undefined;
			const collision = world.castMotion(this, motion, offset);

			if (!collision) {
				totalDx += motionX;
				totalDy += motionY;
				break;
			}

			// Depenetration: toi=0 means shapes already overlap
			if (collision.travel.lengthSquared() < EPSILON_SQ && collision.depth > 0) {
				totalDx += collision.normal.x * collision.depth;
				totalDy += collision.normal.y * collision.depth;
				continue;
			}

			// Resolve collision with safe margin
			// Normal points away from collider into mover. Adding normal * margin
			// backs the actor off the surface to prevent float-precision embedding.
			const nx = collision.normal.x;
			const ny = collision.normal.y;
			const safeTravelX = collision.travel.x + nx * SAFE_MARGIN;
			const safeTravelY = collision.travel.y + ny * SAFE_MARGIN;
			totalDx += safeTravelX;
			totalDy += safeTravelY;

			this._slideCollisions.push(collision);
			this.onCollided(collision);

			// Debug instrumentation: log collision
			const game = this.game;
			if (game?.debug) {
				game.debugLog.write(
					{
						category: "physics",
						message: `${this.constructor.name}#${this.id} collision normal=(${nx.toFixed(2)},${ny.toFixed(2)}) with=${collision.collider.constructor.name}#${collision.collider.id}`,
						data: { normal: { x: nx, y: ny }, depth: collision.depth },
					},
					game.fixedFrame,
					game.elapsed,
				);
			}

			// Slide: project remainder onto surface
			// Subtract the margin from remainder to preserve total motion.
			const remX = collision.remainder.x - nx * SAFE_MARGIN;
			const remY = collision.remainder.y - ny * SAFE_MARGIN;
			const remDotN = remX * nx + remY * ny;
			motionX = remX - nx * remDotN;
			motionY = remY - ny * remDotN;

			// Kill velocity into surface
			const velDotN = this.velocity.x * nx + this.velocity.y * ny;
			if (velDotN < 0) {
				this.velocity.x -= nx * velDotN;
				this.velocity.y -= ny * velDotN;
			}
		}

		// 4. Apply displacement (single position write)
		this.position._set(this.position.x + totalDx, this.position.y + totalDy);

		// 5. Update contact flags
		const wasOnFloor = this._onFloor;
		const wasOnWall = this._onWall;
		const wasOnCeiling = this._onCeiling;

		this._onFloor = false;
		this._onWall = false;
		this._onCeiling = false;
		this._floorCollider = null;
		this._floorNormal = new Vec2(0, 0);
		this._wallNormal = new Vec2(0, 0);

		const upLen = this.upDirection.length();
		if (upLen > 0) {
			for (const col of this._slideCollisions) {
				const cosAngle = col.normal.dot(this.upDirection) / upLen;
				const angle = Math.acos(Math.min(1, Math.max(-1, cosAngle)));

				if (angle <= this.floorMaxAngle) {
					this._onFloor = true;
					this._floorNormal = col.normal;
					this._floorCollider = col.collider;
				} else if (angle >= Math.PI - this.floorMaxAngle) {
					this._onCeiling = true;
				} else {
					this._onWall = true;
					this._wallNormal = col.normal;
				}
			}
		}

		// Debug instrumentation: log contact flag changes
		{
			const game = this.game;
			if (game?.debug) {
				if (wasOnFloor !== this._onFloor) {
					game.debugLog.write(
						{
							category: "physics",
							message: `${this.constructor.name}#${this.id} floor_contact ${this._onFloor ? "entered" : "exited"}`,
						},
						game.fixedFrame,
						game.elapsed,
					);
				}
				if (wasOnWall !== this._onWall) {
					game.debugLog.write(
						{
							category: "physics",
							message: `${this.constructor.name}#${this.id} wall_contact ${this._onWall ? "entered" : "exited"}`,
						},
						game.fixedFrame,
						game.elapsed,
					);
				}
				if (wasOnCeiling !== this._onCeiling) {
					game.debugLog.write(
						{
							category: "physics",
							message: `${this.constructor.name}#${this.id} ceiling_contact ${this._onCeiling ? "entered" : "exited"}`,
						},
						game.fixedFrame,
						game.elapsed,
					);
				}
			}
		}

		// 6. Moving platform carry
		if (this._floorCollider instanceof StaticCollider) {
			const platform = this._floorCollider;
			if (platform.constantVelocity.lengthSquared() > 0) {
				const carryX = platform.constantVelocity.x * dt;
				const carryY = platform.constantVelocity.y * dt;
				const carryMotion = new Vec2(carryX, carryY);
				const carryCollision = world.castMotion(this, carryMotion);
				if (carryCollision) {
					this.position._set(
						this.position.x + carryCollision.travel.x,
						this.position.y + carryCollision.travel.y,
					);
				} else {
					this.position._set(this.position.x + carryX, this.position.y + carryY);
				}
			}
		}

		// 7. Re-hash
		world.updatePosition(this);
	}

	/**
	 * Lower-level movement. Moves by an explicit motion vector (not velocity * dt).
	 * Returns the first collision, or null if no collision.
	 * Does NOT slide — stops at the first collision.
	 * Does NOT apply gravity or update contact flags.
	 */
	moveAndCollide(motion: Vec2): CollisionInfo | null {
		const world = this._getWorld();
		if (!world) return null;

		const collision = world.castMotion(this, motion);
		if (collision) {
			this.position._set(
				this.position.x + collision.travel.x,
				this.position.y + collision.travel.y,
			);
		} else {
			this.position._set(this.position.x + motion.x, this.position.y + motion.y);
		}
		world.updatePosition(this);
		return collision;
	}
}
