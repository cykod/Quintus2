import { AABB, Matrix2D, Vec2 } from "@quintus/math";
import type { Actor } from "./actor.js";
import { CollisionGroups } from "./collision-groups.js";
import type { CollisionInfo } from "./collision-info.js";
import type { CollisionObject } from "./collision-object.js";
import { computeContactPoint } from "./contact-point.js";
import { matchesQuery } from "./query-filter.js";
import type { QueryOptions, RaycastHit, ShapeCastHit } from "./query-types.js";
import { pointInShape, rayIntersectShape } from "./ray.js";
import { findTOI, sweptAABB, testOverlap } from "./sat.js";
import type { RectShape, Shape2D } from "./shapes.js";
import { shapeAABB } from "./shapes.js";
import { SpatialHash } from "./spatial-hash.js";

export interface PhysicsWorldConfig {
	gravity?: Vec2;
	cellSize?: number;
	groups?: CollisionGroups;
}

/** Internal type for onOverlap() registered callbacks. */
interface OverlapRegistration {
	groupA: string;
	groupB: string;
	onEnter: (bodyA: CollisionObject, bodyB: CollisionObject) => void;
	onExit?: (bodyA: CollisionObject, bodyB: CollisionObject) => void;
	/** Tracks active overlaps. Key: "idA:idB", Value: [bodyA, bodyB]. */
	overlaps: Map<string, [CollisionObject, CollisionObject]>;
}

/** Internal type for onContact() registered callbacks. */
interface ContactRegistration {
	groupA: string;
	groupB: string;
	callback: (bodyA: CollisionObject, bodyB: CollisionObject, info: CollisionInfo) => void;
}

/**
 * Find TOI for a single shape pair. Uses sweptAABB fast path for
 * axis-aligned rect-vs-rect, binary search SAT otherwise.
 * Normal convention: points away from the collider (obstacle) into the mover.
 */
export function findShapePairTOI(
	bodyShape: Shape2D,
	bodyTransform: Matrix2D,
	motion: Vec2,
	otherShape: Shape2D,
	otherTransform: Matrix2D,
): { toi: number; normal: Vec2; depth: number } | null {
	// Fast path: axis-aligned rect vs rect
	if (
		bodyShape.type === "rect" &&
		otherShape.type === "rect" &&
		bodyTransform.isTranslationOnly() &&
		otherTransform.isTranslationOnly()
	) {
		const result = sweptAABB(
			bodyShape as RectShape,
			bodyTransform,
			motion,
			otherShape as RectShape,
			otherTransform,
		);
		if (!result) return null;
		// sweptAABB normal points from mover toward obstacle — flip for our convention
		// (normal should point away from collider into mover)
		const normal = result.normal.negate();
		// Estimate depth from SAT at collision point
		const hitTransform = new Matrix2D(
			bodyTransform.a,
			bodyTransform.b,
			bodyTransform.c,
			bodyTransform.d,
			bodyTransform.e + motion.x * result.toi,
			bodyTransform.f + motion.y * result.toi,
		);
		const satResult = testOverlap(bodyShape, hitTransform, otherShape, otherTransform);
		return { toi: result.toi, normal, depth: satResult?.depth ?? 0 };
	}

	// General case: binary search TOI with SAT
	const result = findTOI(bodyShape, bodyTransform, motion, otherShape, otherTransform);
	if (!result) return null;

	// SAT normal points from A (body) toward B (other).
	// Our convention: normal points away from collider (B) into mover (A).
	// So we need to negate it.
	const normal = result.result.normal.negate();
	return { toi: result.toi, normal, depth: result.result.depth };
}

export class PhysicsWorld {
	/** World gravity vector. Default: (0, 800). */
	readonly gravity: Vec2;

	/** Compiled collision groups. */
	readonly groups: CollisionGroups;

	/** Spatial hash for broad-phase queries. */
	private readonly hash: SpatialHash<CollisionObject>;

	/** Current overlaps for bodies with monitoring = true (enter/exit tracking). */
	private readonly monitoredOverlaps = new Map<CollisionObject, Set<CollisionObject>>();

	/** Group-to-bodies index for efficient queries. */
	private readonly groupIndex = new Map<string, Set<CollisionObject>>();

	/** Registered onOverlap() callbacks. */
	private readonly overlapRegistrations: OverlapRegistration[] = [];

	/** Registered onContact() callbacks. */
	private readonly contactRegistrations: ContactRegistration[] = [];

	/** Signal connections for actor collided signals (for onContact dispatching). */
	private readonly contactConnections = new Map<CollisionObject, { disconnect(): void }>();

	constructor(config?: PhysicsWorldConfig) {
		this.gravity = config?.gravity ?? new Vec2(0, 800);
		this.groups =
			config?.groups ??
			new CollisionGroups({
				default: { collidesWith: ["default"] },
			});
		this.hash = new SpatialHash<CollisionObject>(config?.cellSize ?? 64);
	}

	// === Body Registration ===

	/** Register a body in the spatial hash. Validates collision group. */
	register(body: CollisionObject): void {
		this.groups.validate(body.collisionGroup);
		const aabb = body.getWorldAABB();
		if (aabb) {
			this.hash.insert(body, aabb);
		}

		// Auto-enable monitoring if needed by onOverlap registrations
		for (const reg of this.overlapRegistrations) {
			if (body.collisionGroup === reg.groupA || body.collisionGroup === reg.groupB) {
				body.monitoring = true;
				break;
			}
		}

		// Initialize overlap tracking for any monitoring body
		if (body.monitoring) {
			this.monitoredOverlaps.set(body, new Set());
		}

		// Add to group index
		let group = this.groupIndex.get(body.collisionGroup);
		if (!group) {
			group = new Set();
			this.groupIndex.set(body.collisionGroup, group);
		}
		group.add(body);

		// Connect actor's collided signal for onContact() dispatching
		if (body.bodyType === "actor") {
			const collided = (body as Actor).collided;
			if (collided) {
				const conn = collided.connect((info: CollisionInfo) => {
					for (const reg of this.contactRegistrations) {
						// Forward match: mover is groupA, collider is groupB
						if (body.collisionGroup === reg.groupA && info.collider.collisionGroup === reg.groupB) {
							reg.callback(body, info.collider, info);
						}
						// Reverse match: mover is groupB, collider is groupA
						// This handles when B moves into A (e.g. enemy walks into stationary player)
						else if (
							body.collisionGroup === reg.groupB &&
							info.collider.collisionGroup === reg.groupA
						) {
							// Flip normal so it points into groupA (the first callback arg) as expected
							const flipped: CollisionInfo = {
								...info,
								normal: new Vec2(-info.normal.x, -info.normal.y),
								collider: body,
							};
							reg.callback(info.collider, body, flipped);
						}
					}
				});
				this.contactConnections.set(body, conn);
			}
		}
	}

	/** Remove a body from the spatial hash. Cleans up overlaps and group index. */
	unregister(body: CollisionObject): void {
		this.hash.remove(body);

		// Clean up overlap tracking for this body (if it was monitored)
		this.monitoredOverlaps.delete(body);

		// Fire exit events and remove from other monitored bodies' overlap sets
		for (const [monitor, overlaps] of this.monitoredOverlaps) {
			if (overlaps.delete(body)) {
				monitor.onBodyExited(body);
			}
		}

		// Remove from group index
		const group = this.groupIndex.get(body.collisionGroup);
		if (group) {
			group.delete(body);
			if (group.size === 0) {
				this.groupIndex.delete(body.collisionGroup);
			}
		}

		// Clean up onOverlap() overlap tracking and fire exit callbacks for this body
		for (const reg of this.overlapRegistrations) {
			const toDelete: string[] = [];
			for (const [key, [a, b]] of reg.overlaps) {
				if (a === body || b === body) {
					toDelete.push(key);
				}
			}
			for (const key of toDelete) {
				const pair = reg.overlaps.get(key);
				reg.overlaps.delete(key);
				if (reg.onExit && pair) {
					reg.onExit(pair[0], pair[1]);
				}
			}
		}

		// Clean up contact signal connection
		const conn = this.contactConnections.get(body);
		if (conn) {
			conn.disconnect();
			this.contactConnections.delete(body);
		}
	}

	/** Update a body's position in the spatial hash. Called after move(). */
	updatePosition(body: CollisionObject): void {
		const aabb = body.getWorldAABB();
		if (aabb) {
			this.hash.update(body, aabb);
		}
	}

	// === Collision Queries ===

	/**
	 * Cast a body along a motion vector. Returns the first collision, or null.
	 * This is the core query used by Actor.moveAndCollide().
	 *
	 * Algorithm:
	 * 1. Compute swept AABB (body AABB expanded along motion)
	 * 2. Broad phase: query spatial hash with swept AABB
	 * 3. Filter by collision groups
	 * 4. For each candidate, iterate all shape pairs to find earliest TOI
	 * 5. Build CollisionInfo with travel, remainder, contact point
	 */
	castMotion(body: CollisionObject, motion: Vec2, bodyOffset?: Vec2): CollisionInfo | null {
		let bodyAABB = body.getWorldAABB();
		if (!bodyAABB) return null;

		// Apply body offset (used by Actor slide loop for batched displacement)
		let bodyShapes = body.getShapeTransforms();
		if (bodyShapes.length === 0) return null;

		if (bodyOffset) {
			bodyAABB = new AABB(
				new Vec2(bodyAABB.min.x + bodyOffset.x, bodyAABB.min.y + bodyOffset.y),
				new Vec2(bodyAABB.max.x + bodyOffset.x, bodyAABB.max.y + bodyOffset.y),
			);
			bodyShapes = bodyShapes.map((s) => ({
				shape: s.shape,
				transform: this._translateTransform(s.transform, bodyOffset),
			}));
		}

		// 1. Compute swept AABB
		const sweptMin = new Vec2(
			Math.min(bodyAABB.min.x, bodyAABB.min.x + motion.x),
			Math.min(bodyAABB.min.y, bodyAABB.min.y + motion.y),
		);
		const sweptMax = new Vec2(
			Math.max(bodyAABB.max.x, bodyAABB.max.x + motion.x),
			Math.max(bodyAABB.max.y, bodyAABB.max.y + motion.y),
		);
		const sweptRegion = new AABB(sweptMin, sweptMax);

		// 2. Broad phase
		const candidates = this.hash.query(sweptRegion);
		candidates.delete(body); // Don't collide with self

		// Track best (earliest) collision across all candidates and shape pairs
		let bestTOI = Infinity;
		let bestNormal: Vec2 | null = null;
		let bestDepth = 0;
		let bestCollider: CollisionObject | null = null;
		let bestBodyShapeData: { shape: Shape2D; transform: Matrix2D } | null = null;
		let bestColliderShapeData: { shape: Shape2D; transform: Matrix2D } | null = null;

		for (const candidate of candidates) {
			// 3. Filter by collision groups
			if (!this.groups.shouldCollide(body.collisionGroup, candidate.collisionGroup)) {
				continue;
			}
			// Don't collide actor with sensors (sensors handle their own overlap)
			if (candidate.bodyType === "sensor") continue;
			// Skip non-solid actors (solid actors are treated as obstacles)
			if (candidate.bodyType === "actor" && !(candidate as Actor).solid) continue;

			const candidateShapes = candidate.getShapeTransforms();

			// 4. For each shape pair, find TOI
			for (const bodyShapeInfo of bodyShapes) {
				for (const candidateShapeInfo of candidateShapes) {
					const hit = this._findShapePairTOI(
						bodyShapeInfo.shape,
						bodyShapeInfo.transform,
						motion,
						candidateShapeInfo.shape,
						candidateShapeInfo.transform,
					);

					if (hit && hit.toi < bestTOI) {
						// One-way platform filtering
						if (candidate._shouldSkipCollision(hit.normal)) continue;

						bestTOI = hit.toi;
						bestNormal = hit.normal;
						bestDepth = hit.depth;
						bestCollider = candidate;
						bestBodyShapeData = bodyShapeInfo;
						bestColliderShapeData = candidateShapeInfo;
					}
				}
			}
		}

		if (!bestCollider || !bestNormal || !bestBodyShapeData || !bestColliderShapeData) {
			return null;
		}

		// 5. Compute travel, remainder, and contact point
		const travel = new Vec2(motion.x * bestTOI, motion.y * bestTOI);
		const remainder = new Vec2(motion.x - travel.x, motion.y - travel.y);

		// Find the CollisionShape node that matched the hit shape.
		// bestCollider is guaranteed to have shapes since we found a collision.
		const colliderShapes = bestCollider.getShapes();
		const matchedShape = bestColliderShapeData.shape;
		const colliderShapeNode = colliderShapes.find((s) => s.shape === matchedShape);
		if (!colliderShapeNode) return null;

		// Compute contact point at the collision position
		const bodyTransformAtHit = this._translateTransform(bestBodyShapeData.transform, travel);
		const point = computeContactPoint(
			bestBodyShapeData.shape,
			bodyTransformAtHit,
			bestColliderShapeData.shape,
			bestColliderShapeData.transform,
			bestNormal,
		);

		return {
			collider: bestCollider,
			colliderShape: colliderShapeNode,
			normal: bestNormal,
			depth: bestDepth,
			point,
			travel,
			remainder,
		};
	}

	/**
	 * Test if a body overlaps anything at its current position.
	 * Used for sensor detection and post-separation validation.
	 */
	testOverlap(body: CollisionObject): CollisionObject[] {
		const bodyAABB = body.getWorldAABB();
		if (!bodyAABB) return [];

		const candidates = this.hash.query(bodyAABB);
		candidates.delete(body);

		const overlapping: CollisionObject[] = [];
		const bodyShapes = body.getShapeTransforms();
		if (bodyShapes.length === 0) return [];

		for (const candidate of candidates) {
			if (!this.groups.shouldCollide(body.collisionGroup, candidate.collisionGroup)) {
				continue;
			}

			const candidateShapes = candidate.getShapeTransforms();
			let found = false;

			for (const bs of bodyShapes) {
				if (found) break;
				for (const cs of candidateShapes) {
					if (testOverlap(bs.shape, bs.transform, cs.shape, cs.transform)) {
						overlapping.push(candidate);
						found = true;
						break;
					}
				}
			}
		}

		return overlapping;
	}

	// === Overlap Detection (Monitoring) ===

	/**
	 * Run the global overlap detection pass for all monitored bodies.
	 * Called by PhysicsPlugin after each fixedUpdate via the postFixedUpdate hook.
	 */
	stepMonitoring(): void {
		this._stepBodyMonitoring();
		this._stepOverlapCallbacks();
	}

	/** @deprecated Use stepMonitoring() instead. Kept for backward compatibility. */
	stepSensors(): void {
		this.stepMonitoring();
	}

	/**
	 * Per-body monitoring: fire bodyEntered/bodyExited for bodies with monitoring = true.
	 */
	private _stepBodyMonitoring(): void {
		// Handle monitoring toggle-off: clear overlaps and fire exit events
		const toClean: CollisionObject[] = [];
		for (const [monitor] of this.monitoredOverlaps) {
			if (!monitor.monitoring) {
				toClean.push(monitor);
			}
		}
		for (const monitor of toClean) {
			const overlaps = this.monitoredOverlaps.get(monitor);
			if (overlaps) {
				for (const body of overlaps) {
					monitor.onBodyExited(body);
				}
			}
			this.monitoredOverlaps.delete(monitor);
		}

		// Ensure any body whose monitoring was toggled on is tracked
		for (const bodies of this.groupIndex.values()) {
			for (const body of bodies) {
				if (body.monitoring && !this.monitoredOverlaps.has(body)) {
					this.monitoredOverlaps.set(body, new Set());
				}
			}
		}

		for (const [monitor, prevOverlaps] of this.monitoredOverlaps) {
			if (!monitor.monitoring) continue;

			const bodyAABB = monitor.getWorldAABB();
			if (!bodyAABB) continue;

			// Compute current overlaps
			const candidates = this.hash.query(bodyAABB);
			candidates.delete(monitor);

			const currentOverlaps = new Set<CollisionObject>();
			const monitorShapes = monitor.getShapeTransforms();

			for (const candidate of candidates) {
				if (!this.groups.shouldCollide(monitor.collisionGroup, candidate.collisionGroup)) {
					continue;
				}

				const candidateShapes = candidate.getShapeTransforms();
				let overlaps = false;

				for (const ss of monitorShapes) {
					if (overlaps) break;
					for (const cs of candidateShapes) {
						if (testOverlap(ss.shape, ss.transform, cs.shape, cs.transform)) {
							overlaps = true;
							break;
						}
					}
				}

				if (overlaps) {
					currentOverlaps.add(candidate);
				}
			}

			// Diff: fire entered for new overlaps
			for (const body of currentOverlaps) {
				if (!prevOverlaps.has(body)) {
					monitor.onBodyEntered(body);

					// Debug instrumentation
					const game = monitor.gameOrNull;
					if (game?.debug) {
						game.debugLog.write(
							{
								category: "physics",
								message: `${monitor.constructor.name}#${monitor.id} bodyEntered ${body.constructor.name}#${body.id}`,
							},
							game.fixedFrame,
							game.elapsed,
						);
					}
				}
			}

			// Diff: fire exited for removed overlaps
			for (const body of prevOverlaps) {
				if (!currentOverlaps.has(body)) {
					monitor.onBodyExited(body);

					// Debug instrumentation
					const game = monitor.gameOrNull;
					if (game?.debug) {
						game.debugLog.write(
							{
								category: "physics",
								message: `${monitor.constructor.name}#${monitor.id} bodyExited ${body.constructor.name}#${body.id}`,
							},
							game.fixedFrame,
							game.elapsed,
						);
					}
				}
			}

			// Update stored overlaps
			this.monitoredOverlaps.set(monitor, currentOverlaps);
		}
	}

	/**
	 * Process onOverlap() callbacks.
	 */
	private _stepOverlapCallbacks(): void {
		for (const reg of this.overlapRegistrations) {
			const bodiesA = this.groupIndex.get(reg.groupA);
			const bodiesB = this.groupIndex.get(reg.groupB);
			if (!bodiesA || !bodiesB) continue;

			// Track current overlaps this frame
			const currentOverlaps = new Map<string, [CollisionObject, CollisionObject]>();

			for (const a of bodiesA) {
				const aAABB = a.getWorldAABB();
				if (!aAABB) continue;
				const aShapes = a.getShapeTransforms();
				if (aShapes.length === 0) continue;

				for (const b of bodiesB) {
					if (a === b) continue;

					const bAABB = b.getWorldAABB();
					if (!bAABB) continue;

					// Quick AABB rejection
					if (!aAABB.overlaps(bAABB)) continue;

					const bShapes = b.getShapeTransforms();
					if (bShapes.length === 0) continue;

					// Narrow-phase overlap test
					let overlaps = false;
					for (const as of aShapes) {
						if (overlaps) break;
						for (const bs of bShapes) {
							if (testOverlap(as.shape, as.transform, bs.shape, bs.transform)) {
								overlaps = true;
								break;
							}
						}
					}

					if (overlaps) {
						const key = `${a.id}:${b.id}`;
						currentOverlaps.set(key, [a, b]);

						// Fire callback on first frame of overlap
						if (!reg.overlaps.has(key)) {
							reg.onEnter(a, b);
						}
					}
				}
			}

			// Fire exit callbacks for pairs that are no longer overlapping
			if (reg.onExit) {
				for (const [key, [a, b]] of reg.overlaps) {
					if (!currentOverlaps.has(key)) {
						reg.onExit(a, b);
					}
				}
			}

			// Replace overlap map with current frame's overlaps
			reg.overlaps = currentOverlaps;
		}
	}

	// === onOverlap API ===

	/**
	 * Register a callback that fires when bodies in groupA first overlap bodies in groupB.
	 * Built on top of the monitoring system — automatically enables monitoring on target bodies.
	 * Returns a dispose function.
	 */
	onOverlap(
		groupA: string,
		groupB: string,
		onEnter: (bodyA: CollisionObject, bodyB: CollisionObject) => void,
		onExit?: (bodyA: CollisionObject, bodyB: CollisionObject) => void,
	): () => void {
		const entry: OverlapRegistration = {
			groupA,
			groupB,
			onEnter,
			onExit,
			overlaps: new Map(),
		};
		this.overlapRegistrations.push(entry);

		// Auto-enable monitoring on current bodies in target groups
		for (const groupName of [groupA, groupB]) {
			const bodies = this.groupIndex.get(groupName);
			if (bodies) {
				for (const body of bodies) {
					if (!body.monitoring) {
						body.monitoring = true;
					}
					if (!this.monitoredOverlaps.has(body)) {
						this.monitoredOverlaps.set(body, new Set());
					}
				}
			}
		}

		return () => {
			const idx = this.overlapRegistrations.indexOf(entry);
			if (idx !== -1) {
				this.overlapRegistrations.splice(idx, 1);
			}
		};
	}

	// === onContact API ===

	/**
	 * Register a callback that fires when bodies in groupA physically collide
	 * with bodies in groupB during move(). Provides collision info (normal, etc).
	 * Returns a dispose function.
	 */
	onContact(
		groupA: string,
		groupB: string,
		callback: (bodyA: CollisionObject, bodyB: CollisionObject, info: CollisionInfo) => void,
	): () => void {
		const entry: ContactRegistration = { groupA, groupB, callback };
		this.contactRegistrations.push(entry);

		return () => {
			const idx = this.contactRegistrations.indexOf(entry);
			if (idx !== -1) {
				this.contactRegistrations.splice(idx, 1);
			}
		};
	}

	// === Overlap Queries ===

	/** Get bodies currently overlapping a monitored body (excludes sensors). */
	getOverlappingBodies(body: CollisionObject): CollisionObject[] {
		const overlaps = this.monitoredOverlaps.get(body);
		if (!overlaps) return [];
		return Array.from(overlaps).filter((b) => b.bodyType !== "sensor");
	}

	/** Get sensors currently overlapping a monitored body. */
	getOverlappingSensors(body: CollisionObject): CollisionObject[] {
		const overlaps = this.monitoredOverlaps.get(body);
		if (!overlaps) return [];
		return Array.from(overlaps).filter((b) => b.bodyType === "sensor");
	}

	// === Scene Query API ===

	/**
	 * Cast a ray and return the first hit, or null.
	 * Direction is automatically normalized.
	 */
	raycast(
		origin: Vec2,
		direction: Vec2,
		maxDistance = 10000,
		options?: QueryOptions,
	): RaycastHit | null {
		const hits = this._raycastInternal(origin, direction, maxDistance, options, true);
		return hits[0] ?? null;
	}

	/**
	 * Cast a ray and return ALL hits, sorted by distance (nearest first).
	 * Direction is automatically normalized.
	 */
	raycastAll(
		origin: Vec2,
		direction: Vec2,
		maxDistance = 10000,
		options?: QueryOptions,
	): RaycastHit[] {
		return this._raycastInternal(origin, direction, maxDistance, options, false);
	}

	/**
	 * Find all bodies containing a world-space point.
	 */
	queryPoint(point: Vec2, options?: QueryOptions): CollisionObject[] {
		// Use a tiny AABB around the point for broad phase
		const tiny = new AABB(
			new Vec2(point.x - 0.5, point.y - 0.5),
			new Vec2(point.x + 0.5, point.y + 0.5),
		);
		const candidates = this.hash.query(tiny);
		const results: CollisionObject[] = [];

		for (const body of candidates) {
			if (!matchesQuery(body, options)) continue;
			if (options?.maxResults && results.length >= options.maxResults) break;

			const shapes = body.getShapeTransforms();
			for (const { shape, transform } of shapes) {
				if (pointInShape(point, shape, transform)) {
					results.push(body);
					break;
				}
			}
		}

		return results;
	}

	/**
	 * Find all bodies overlapping an axis-aligned rectangle.
	 */
	queryRect(aabb: AABB, options?: QueryOptions): CollisionObject[] {
		const candidates = this.hash.query(aabb);
		const results: CollisionObject[] = [];
		const queryShape: Shape2D = {
			type: "rect",
			width: aabb.max.x - aabb.min.x,
			height: aabb.max.y - aabb.min.y,
		};
		const queryTransform = Matrix2D.translate(
			(aabb.min.x + aabb.max.x) / 2,
			(aabb.min.y + aabb.max.y) / 2,
		);

		for (const body of candidates) {
			if (!matchesQuery(body, options)) continue;
			if (options?.maxResults && results.length >= options.maxResults) break;

			const shapes = body.getShapeTransforms();
			for (const { shape, transform } of shapes) {
				if (testOverlap(queryShape, queryTransform, shape, transform)) {
					results.push(body);
					break;
				}
			}
		}

		return results;
	}

	/**
	 * Find all bodies overlapping a circle.
	 */
	queryCircle(center: Vec2, radius: number, options?: QueryOptions): CollisionObject[] {
		const queryAABB = new AABB(
			new Vec2(center.x - radius, center.y - radius),
			new Vec2(center.x + radius, center.y + radius),
		);
		const candidates = this.hash.query(queryAABB);
		const results: CollisionObject[] = [];
		const queryShape: Shape2D = { type: "circle", radius };
		const queryTransform = Matrix2D.translate(center.x, center.y);

		for (const body of candidates) {
			if (!matchesQuery(body, options)) continue;
			if (options?.maxResults && results.length >= options.maxResults) break;

			const shapes = body.getShapeTransforms();
			for (const { shape, transform } of shapes) {
				if (testOverlap(queryShape, queryTransform, shape, transform)) {
					results.push(body);
					break;
				}
			}
		}

		return results;
	}

	/**
	 * Find all bodies overlapping an arbitrary shape at a given transform.
	 */
	queryShape(shape: Shape2D, transform: Matrix2D, options?: QueryOptions): CollisionObject[] {
		const queryAABB = shapeAABB(shape, transform);
		const candidates = this.hash.query(queryAABB);
		const results: CollisionObject[] = [];

		for (const body of candidates) {
			if (!matchesQuery(body, options)) continue;
			if (options?.maxResults && results.length >= options.maxResults) break;

			const shapes = body.getShapeTransforms();
			for (const { shape: bodyShape, transform: bodyTransform } of shapes) {
				if (testOverlap(shape, transform, bodyShape, bodyTransform)) {
					results.push(body);
					break;
				}
			}
		}

		return results;
	}

	/**
	 * Sweep a shape along a motion vector. Returns the first hit, or null.
	 * Like castMotion() but doesn't require a registered body.
	 */
	shapeCast(
		shape: Shape2D,
		transform: Matrix2D,
		motion: Vec2,
		options?: QueryOptions,
	): ShapeCastHit | null {
		const queryAABB = shapeAABB(shape, transform);
		const sweptMin = new Vec2(
			Math.min(queryAABB.min.x, queryAABB.min.x + motion.x),
			Math.min(queryAABB.min.y, queryAABB.min.y + motion.y),
		);
		const sweptMax = new Vec2(
			Math.max(queryAABB.max.x, queryAABB.max.x + motion.x),
			Math.max(queryAABB.max.y, queryAABB.max.y + motion.y),
		);
		const sweptRegion = new AABB(sweptMin, sweptMax);
		const candidates = this.hash.query(sweptRegion);

		let bestTOI = Infinity;
		let bestNormal: Vec2 | null = null;
		let bestDepth = 0;
		let bestCollider: CollisionObject | null = null;
		let bestColliderShapeData: { shape: Shape2D; transform: Matrix2D } | null = null;

		for (const candidate of candidates) {
			if (!matchesQuery(candidate, options)) continue;
			const candidateShapes = candidate.getShapeTransforms();

			for (const candidateShapeInfo of candidateShapes) {
				const hit = findShapePairTOI(
					shape,
					transform,
					motion,
					candidateShapeInfo.shape,
					candidateShapeInfo.transform,
				);

				if (hit && hit.toi < bestTOI) {
					bestTOI = hit.toi;
					bestNormal = hit.normal;
					bestDepth = hit.depth;
					bestCollider = candidate;
					bestColliderShapeData = candidateShapeInfo;
				}
			}
		}

		if (!bestCollider || !bestNormal || !bestColliderShapeData) return null;

		const travel = new Vec2(motion.x * bestTOI, motion.y * bestTOI);
		const remainder = new Vec2(motion.x - travel.x, motion.y - travel.y);

		// Find the CollisionShape node that matched
		const colliderShapes = bestCollider.getShapes();
		const matchedShape = bestColliderShapeData.shape;
		const colliderShapeNode = colliderShapes.find((s) => s.shape === matchedShape);
		if (!colliderShapeNode) return null;

		const bodyTransformAtHit = this._translateTransform(transform, travel);
		const point = computeContactPoint(
			shape,
			bodyTransformAtHit,
			bestColliderShapeData.shape,
			bestColliderShapeData.transform,
			bestNormal,
		);

		return {
			collider: bestCollider,
			colliderShape: colliderShapeNode,
			normal: bestNormal,
			depth: bestDepth,
			point,
			travel,
			remainder,
		};
	}

	/** Internal raycast implementation shared by raycast() and raycastAll(). */
	private _raycastInternal(
		origin: Vec2,
		direction: Vec2,
		maxDistance: number,
		options: QueryOptions | undefined,
		firstOnly: boolean,
	): RaycastHit[] {
		// Normalize direction
		const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
		if (len < 1e-10) return [];
		const dirX = direction.x / len;
		const dirY = direction.y / len;
		const normalizedDir = new Vec2(dirX, dirY);

		// Compute AABB encompassing the full ray
		const endX = origin.x + dirX * maxDistance;
		const endY = origin.y + dirY * maxDistance;
		const rayAABB = new AABB(
			new Vec2(Math.min(origin.x, endX) - 1, Math.min(origin.y, endY) - 1),
			new Vec2(Math.max(origin.x, endX) + 1, Math.max(origin.y, endY) + 1),
		);

		const candidates = this.hash.query(rayAABB);
		const hits: RaycastHit[] = [];

		for (const body of candidates) {
			if (!matchesQuery(body, options)) continue;

			const bodyAABB = body.getWorldAABB();
			if (!bodyAABB) continue;

			// Quick AABB rejection for the body
			if (!rayAABB.overlaps(bodyAABB)) continue;

			const shapes = body.getShapeTransforms();
			const shapeNodes = body.getShapes();

			for (let i = 0; i < shapes.length; i++) {
				const shapeEntry = shapes[i] as { shape: Shape2D; transform: Matrix2D };
				const result = rayIntersectShape(
					origin,
					normalizedDir,
					maxDistance,
					shapeEntry.shape,
					shapeEntry.transform,
				);

				if (result) {
					const hitPoint = new Vec2(origin.x + dirX * result.t, origin.y + dirY * result.t);
					hits.push({
						collider: body,
						colliderShape: shapeNodes[i] as (typeof shapeNodes)[number],
						point: hitPoint,
						normal: result.normal,
						distance: result.t,
					});
				}
			}
		}

		// Sort by distance
		hits.sort((a, b) => a.distance - b.distance);

		if (firstOnly && hits.length > 1) {
			return [hits[0] as RaycastHit];
		}

		return hits;
	}

	// === Internal: Dynamic Monitoring Toggle ===

	/**
	 * @internal Called when a body's monitoring state might have changed.
	 * Ensures the body is tracked/untracked in monitoredOverlaps accordingly.
	 */
	ensureMonitoringState(body: CollisionObject): void {
		if (body.monitoring && !this.monitoredOverlaps.has(body)) {
			this.monitoredOverlaps.set(body, new Set());
		}
	}

	// === Private Helpers ===

	/** Delegate to the standalone findShapePairTOI function. */
	private _findShapePairTOI(
		bodyShape: Shape2D,
		bodyTransform: Matrix2D,
		motion: Vec2,
		otherShape: Shape2D,
		otherTransform: Matrix2D,
	): { toi: number; normal: Vec2; depth: number } | null {
		return findShapePairTOI(bodyShape, bodyTransform, motion, otherShape, otherTransform);
	}

	/** Create a new transform translated by a delta vector. */
	private _translateTransform(transform: Matrix2D, delta: Vec2): Matrix2D {
		return new Matrix2D(
			transform.a,
			transform.b,
			transform.c,
			transform.d,
			transform.e + delta.x,
			transform.f + delta.y,
		);
	}
}
