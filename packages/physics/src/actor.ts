import { type Node2D, type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { CollisionInfo } from "./collision-info.js";
import { type BodyType, CollisionObject } from "./collision-object.js";
import type { QueryOptions, RaycastHit } from "./query-types.js";
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

	// === Query Convenience Methods ===

	/**
	 * Cast a ray from this actor's global position.
	 * Automatically excludes self from results.
	 */
	raycast(direction: Vec2, maxDistance = 10000, options?: QueryOptions): RaycastHit | null {
		const world = this._getWorld();
		if (!world) return null;
		const merged: QueryOptions = {
			...options,
			exclude: [this, ...(options?.exclude ?? [])],
		};
		return world.raycast(this.globalPosition, direction, maxDistance, merged);
	}

	/**
	 * Check if there is a floor edge ahead in the given direction.
	 * Used for patrol AI: walk until isEdgeAhead() returns true, then reverse.
	 */
	isEdgeAhead(direction: Vec2, probeDistance?: number, dropThreshold?: number): boolean {
		const world = this._getWorld();
		if (!world) return false;

		const aabb = this.getWorldAABB();
		if (!aabb) return false;

		const actorWidth = aabb.max.x - aabb.min.x;
		const actorHeight = aabb.max.y - aabb.min.y;
		const probeDist = probeDistance ?? 2;
		const dropThresh = dropThreshold ?? actorHeight;

		// Normalize direction to horizontal
		const dirX = direction.x > 0 ? 1 : direction.x < 0 ? -1 : 0;
		if (dirX === 0) return false;

		// Probe origin: bottom-front corner + probeDistance ahead
		const probeX = (aabb.min.x + aabb.max.x) / 2 + (actorWidth / 2 + probeDist) * dirX;
		const probeY = aabb.max.y;
		const probeOrigin = new Vec2(probeX, probeY);

		const hit = world.raycast(probeOrigin, new Vec2(0, 1), dropThresh, {
			exclude: [this],
		});

		// If ray hits nothing, there's an edge
		return hit === null;
	}

	/**
	 * Check if this actor has an unobstructed line of sight to a target.
	 * Returns true if nothing blocks the ray from self to target.
	 */
	hasLineOfSight(target: Vec2 | Node2D, options?: QueryOptions, originOffset?: Vec2): boolean {
		const world = this._getWorld();
		if (!world) return false;

		const rayOrigin = originOffset
			? new Vec2(this.globalPosition.x + originOffset.x, this.globalPosition.y + originOffset.y)
			: this.globalPosition;

		const isNode =
			"globalPosition" in target && typeof (target as Node2D).globalPosition !== "undefined";
		const targetPos = isNode ? (target as Node2D).globalPosition : (target as Vec2);

		const dx = targetPos.x - rayOrigin.x;
		const dy = targetPos.y - rayOrigin.y;
		const maxDistance = Math.sqrt(dx * dx + dy * dy);
		if (maxDistance < 1e-6) return true;

		const dir = new Vec2(dx / maxDistance, dy / maxDistance);
		// Exclude self and the target (if it's a CollisionObject) so the ray only detects blockers
		const excludeList: CollisionObject[] = [this, ...(options?.exclude ?? [])];
		if (isNode && target instanceof CollisionObject) {
			excludeList.push(target);
		}
		const merged: QueryOptions = {
			...options,
			exclude: excludeList,
		};
		const hit = world.raycast(rayOrigin, dir, maxDistance, merged);
		return hit === null;
	}

	/**
	 * Find the nearest body within maxDistance.
	 * Uses queryCircle + linear scan.
	 */
	findNearest(maxDistance = 10000, options?: QueryOptions): CollisionObject | null {
		const world = this._getWorld();
		if (!world) return null;

		const merged: QueryOptions = {
			...options,
			exclude: [this, ...(options?.exclude ?? [])],
		};
		const candidates = world.queryCircle(this.globalPosition, maxDistance, merged);
		if (candidates.length === 0) return null;

		let bestDist = Infinity;
		let best: CollisionObject | null = null;
		const pos = this.globalPosition;

		for (const body of candidates) {
			const dx = body.globalPosition.x - pos.x;
			const dy = body.globalPosition.y - pos.y;
			const distSq = dx * dx + dy * dy;
			if (distSq < bestDist) {
				bestDist = distSq;
				best = body;
			}
		}

		return best;
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
				const dnx = collision.normal.x;
				const dny = collision.normal.y;
				totalDx += dnx * collision.depth;
				totalDy += dny * collision.depth;

				// Fire contact signal so onContact callbacks work for depenetration too
				this._slideCollisions.push(collision);
				this.onCollided(collision);

				// Debug instrumentation
				const dGame = this.game;
				if (dGame?.debug) {
					dGame.debugLog.write(
						{
							category: "physics",
							message: `${this.constructor.name}#${this.id} collision normal=(${dnx.toFixed(2)},${dny.toFixed(2)}) with=${collision.collider.constructor.name}#${collision.collider.id}`,
							data: { normal: { x: dnx, y: dny }, depth: collision.depth },
						},
						dGame.fixedFrame,
						dGame.elapsed,
					);
				}
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
