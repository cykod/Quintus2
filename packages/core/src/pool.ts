import type { Node, NodeConstructor } from "./node.js";

/**
 * Interface for nodes that can be pooled.
 * Implement reset() to restore instance-specific state when reacquired.
 */
export interface Poolable {
	reset(): void;
}

// === Class Defaults Snapshot ===

/** Duck-typed Vec2 for reading x/y components. */
type Vec2Read = { readonly x: number; readonly y: number };

/** Duck-typed Vec2 for writing via _set(). */
type Vec2Write = { _set(x: number, y: number): void };

/**
 * Captured class-level property overrides for automatic pool restoration.
 * Stores scalar values and Vec2 components so that subclass `override`
 * declarations survive `_poolReset()` without manual `reset()` boilerplate.
 * @internal
 */
export interface ClassDefaultsSnapshot {
	// CollisionObject
	collisionGroup?: string;
	monitoring?: boolean;
	// Actor
	solid?: boolean;
	applyGravity?: boolean;
	upDirection_x?: number;
	upDirection_y?: number;
	gravity?: number;
	floorMaxAngle?: number;
	maxSlides?: number;
	// StaticCollider
	oneWay?: boolean;
	oneWayDirection_x?: number;
	oneWayDirection_y?: number;
}

/**
 * Capture class-level defaults from a freshly-constructed node.
 * Uses duck-typed `"prop" in node` checks so core doesn't depend on physics types.
 * Returns null if the node has no physics properties to snapshot (plain Node/Node2D).
 * @internal
 */
export function _captureClassDefaults(node: Node): ClassDefaultsSnapshot | null {
	if (!("collisionGroup" in node)) return null;

	const snap: ClassDefaultsSnapshot = {};
	snap.collisionGroup = (node as unknown as { collisionGroup: string }).collisionGroup;
	snap.monitoring = (node as unknown as { monitoring: boolean }).monitoring;

	if ("solid" in node) {
		snap.solid = (node as unknown as { solid: boolean }).solid;
	}

	if ("applyGravity" in node) {
		snap.applyGravity = (node as unknown as { applyGravity: boolean }).applyGravity;
		snap.gravity = (node as unknown as { gravity: number }).gravity;
		snap.floorMaxAngle = (node as unknown as { floorMaxAngle: number }).floorMaxAngle;
		snap.maxSlides = (node as unknown as { maxSlides: number }).maxSlides;
		const up = (node as unknown as { upDirection: Vec2Read }).upDirection;
		snap.upDirection_x = up.x;
		snap.upDirection_y = up.y;
	}

	if ("oneWay" in node) {
		snap.oneWay = (node as unknown as { oneWay: boolean }).oneWay;
		const dir = (node as unknown as { oneWayDirection: Vec2Read }).oneWayDirection;
		snap.oneWayDirection_x = dir.x;
		snap.oneWayDirection_y = dir.y;
	}

	return snap;
}

/**
 * Restore class-level defaults after `_poolReset()` has run.
 * Only touches properties present in the snapshot.
 * @internal
 */
export function _applyClassDefaults(node: Node, snap: ClassDefaultsSnapshot): void {
	if (snap.collisionGroup !== undefined) {
		(node as unknown as { collisionGroup: string }).collisionGroup = snap.collisionGroup;
	}
	if (snap.monitoring !== undefined) {
		(node as unknown as { monitoring: boolean }).monitoring = snap.monitoring;
	}
	if (snap.solid !== undefined) {
		(node as unknown as { solid: boolean }).solid = snap.solid;
	}
	if (snap.applyGravity !== undefined) {
		(node as unknown as { applyGravity: boolean }).applyGravity = snap.applyGravity;
	}
	if (snap.gravity !== undefined) {
		(node as unknown as { gravity: number }).gravity = snap.gravity;
	}
	if (snap.floorMaxAngle !== undefined) {
		(node as unknown as { floorMaxAngle: number }).floorMaxAngle = snap.floorMaxAngle;
	}
	if (snap.maxSlides !== undefined) {
		(node as unknown as { maxSlides: number }).maxSlides = snap.maxSlides;
	}
	if (snap.upDirection_x !== undefined && snap.upDirection_y !== undefined) {
		(node as unknown as { upDirection: Vec2Write }).upDirection._set(
			snap.upDirection_x,
			snap.upDirection_y,
		);
	}
	if (snap.oneWay !== undefined) {
		(node as unknown as { oneWay: boolean }).oneWay = snap.oneWay;
	}
	if (snap.oneWayDirection_x !== undefined && snap.oneWayDirection_y !== undefined) {
		(node as unknown as { oneWayDirection: Vec2Write }).oneWayDirection._set(
			snap.oneWayDirection_x,
			snap.oneWayDirection_y,
		);
	}
}

/**
 * Object pool for reusable Node instances.
 * Eliminates GC pressure by recycling nodes across spawn/destroy cycles.
 *
 * Automatically captures class-level property overrides (e.g. `collisionGroup`,
 * `applyGravity`, `upDirection`) from a freshly-constructed exemplar and restores
 * them after `_poolReset()` on every acquire. This means subclass `override`
 * declarations are preserved without manual restoration in `reset()`.
 *
 * Usage:
 * ```ts
 * class Bullet extends Actor implements Poolable {
 *   override collisionGroup = "bullets";
 *   speed = 500;
 *   reset() { this.speed = 500; }
 * }
 *
 * const pool = new NodePool(Bullet, 20);
 * const bullet = pool.acquire();   // reuses or creates
 * scene.add(bullet);
 * // later:
 * pool.release(bullet);            // returns to pool
 * ```
 */
export class NodePool<T extends Node & Poolable> {
	private readonly _pool: T[] = [];
	private readonly _factory: () => T;
	private readonly _maxSize: number;
	private readonly _classDefaults: ClassDefaultsSnapshot | null;

	/**
	 * @param NodeClass The node class to pool. Must implement Poolable.
	 * @param maxSize Maximum pool capacity. Excess releases are dropped. Default: 64.
	 */
	constructor(NodeClass: NodeConstructor<T>, maxSize = 64) {
		this._factory = () => new NodeClass();
		this._maxSize = maxSize;

		// Create an exemplar to capture class-level defaults, then pool it
		const exemplar = this._factory();
		this._classDefaults = _captureClassDefaults(exemplar);
		this._pool.push(exemplar);
	}

	/**
	 * Get a node from the pool (or create one if empty).
	 * The node is reset via _poolReset(), class defaults are restored,
	 * then user reset() is called.
	 * It is NOT added to the scene tree — caller must do scene.add(node).
	 */
	acquire(): T {
		const node = this._pool.pop();
		if (node) {
			// Reset engine state, restore class overrides, then user state
			(node as unknown as { _poolReset(): void })._poolReset();
			if (this._classDefaults) {
				_applyClassDefaults(node, this._classDefaults);
			}
			node.reset();
			return node;
		}
		return this._factory();
	}

	/**
	 * Return a node to the pool.
	 * Removes it from the scene tree if attached.
	 * Drops silently if pool is at maxSize.
	 */
	release(node: T): void {
		// Remove from tree if attached
		node.removeSelf();

		if (this._pool.length < this._maxSize) {
			this._pool.push(node);
		}
	}

	/** Number of available (idle) nodes in the pool. */
	get available(): number {
		return this._pool.length;
	}

	/** Maximum pool capacity. */
	get maxSize(): number {
		return this._maxSize;
	}

	/** Pre-create instances to avoid allocation during gameplay. */
	prefill(count: number): void {
		const toCreate = Math.min(count, this._maxSize) - this._pool.length;
		for (let i = 0; i < toCreate; i++) {
			this._pool.push(this._factory());
		}
	}

	/** Drop all pooled instances. */
	clear(): void {
		this._pool.length = 0;
	}
}
