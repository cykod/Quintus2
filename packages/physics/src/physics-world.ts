import { AABB, Matrix2D, Vec2 } from "@quintus/math";
import { CollisionGroups } from "./collision-groups.js";
import type { CollisionInfo } from "./collision-info.js";
import type { CollisionObject } from "./collision-object.js";
import { computeContactPoint } from "./contact-point.js";
import { findTOI, sweptAABB, testOverlap } from "./sat.js";
import type { RectShape, Shape2D } from "./shapes.js";
import { SpatialHash } from "./spatial-hash.js";

export interface PhysicsWorldConfig {
	gravity?: Vec2;
	cellSize?: number;
	groups?: CollisionGroups;
}

export class PhysicsWorld {
	/** World gravity vector. Default: (0, 800). */
	readonly gravity: Vec2;

	/** Compiled collision groups. */
	readonly groups: CollisionGroups;

	/** Spatial hash for broad-phase queries. */
	private readonly hash: SpatialHash<CollisionObject>;

	/** Current sensor overlaps for enter/exit tracking. */
	private readonly sensorOverlaps = new Map<CollisionObject, Set<CollisionObject>>();

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
		// Initialize sensor overlap tracking
		if (body.bodyType === "sensor") {
			this.sensorOverlaps.set(body, new Set());
		}
	}

	/** Remove a body from the spatial hash. Cleans up sensor overlaps. */
	unregister(body: CollisionObject): void {
		this.hash.remove(body);
		// Clean up sensor overlap tracking for this body (if it was a sensor)
		this.sensorOverlaps.delete(body);
		// Fire exit events and remove from other sensors' overlap sets
		for (const [sensor, overlaps] of this.sensorOverlaps) {
			if (overlaps.delete(body)) {
				sensor._onBodyExited(body);
			}
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
	castMotion(body: CollisionObject, motion: Vec2): CollisionInfo | null {
		const bodyAABB = body.getWorldAABB();
		if (!bodyAABB) return null;

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

		const bodyShapes = body.getShapeTransforms();
		if (bodyShapes.length === 0) return null;

		for (const candidate of candidates) {
			// 3. Filter by collision groups
			if (!this.groups.shouldCollide(body.collisionGroup, candidate.collisionGroup)) {
				continue;
			}
			// Don't collide actor with sensors (sensors handle their own overlap)
			if (candidate.bodyType === "sensor") continue;

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

	// === Sensor Overlap Detection ===

	/**
	 * Run the global sensor overlap pass. Called by PhysicsPlugin
	 * after each fixedUpdate via the postFixedUpdate hook.
	 */
	stepSensors(): void {
		for (const [sensor, prevOverlaps] of this.sensorOverlaps) {
			if (!sensor._monitoring) continue;

			const bodyAABB = sensor.getWorldAABB();
			if (!bodyAABB) continue;

			// Compute current overlaps
			const candidates = this.hash.query(bodyAABB);
			candidates.delete(sensor);

			const currentOverlaps = new Set<CollisionObject>();
			const sensorShapes = sensor.getShapeTransforms();

			for (const candidate of candidates) {
				if (!this.groups.shouldCollide(sensor.collisionGroup, candidate.collisionGroup)) {
					continue;
				}

				const candidateShapes = candidate.getShapeTransforms();
				let overlaps = false;

				for (const ss of sensorShapes) {
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
					sensor._onBodyEntered(body);
				}
			}

			// Diff: fire exited for removed overlaps
			for (const body of prevOverlaps) {
				if (!currentOverlaps.has(body)) {
					sensor._onBodyExited(body);
				}
			}

			// Update stored overlaps
			this.sensorOverlaps.set(sensor, currentOverlaps);
		}
	}

	// === Sensor Queries ===

	/** Get bodies currently overlapping a sensor. */
	getOverlappingBodies(sensor: CollisionObject): CollisionObject[] {
		const overlaps = this.sensorOverlaps.get(sensor);
		if (!overlaps) return [];
		return Array.from(overlaps).filter((b) => b.bodyType !== "sensor");
	}

	/** Get sensors currently overlapping a sensor. */
	getOverlappingSensors(sensor: CollisionObject): CollisionObject[] {
		const overlaps = this.sensorOverlaps.get(sensor);
		if (!overlaps) return [];
		return Array.from(overlaps).filter((b) => b.bodyType === "sensor");
	}

	// === Private Helpers ===

	/**
	 * Find TOI for a single shape pair. Uses sweptAABB fast path for
	 * axis-aligned rect-vs-rect, binary search SAT otherwise.
	 * Normal convention: points away from the collider (obstacle) into the mover.
	 */
	private _findShapePairTOI(
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
			const hitTransform = this._translateTransform(
				bodyTransform,
				new Vec2(motion.x * result.toi, motion.y * result.toi),
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
