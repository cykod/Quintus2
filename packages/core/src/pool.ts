import type { Node, NodeConstructor } from "./node.js";

/**
 * Interface for nodes that can be pooled.
 * Implement reset() to restore instance-specific state when reacquired.
 */
export interface Poolable {
	reset(): void;
}

/**
 * Object pool for reusable Node instances.
 * Eliminates GC pressure by recycling nodes across spawn/destroy cycles.
 *
 * Usage:
 * ```ts
 * class Bullet extends Actor implements Poolable {
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

	/**
	 * @param NodeClass The node class to pool. Must implement Poolable.
	 * @param maxSize Maximum pool capacity. Excess releases are dropped. Default: 64.
	 */
	constructor(NodeClass: NodeConstructor<T>, maxSize = 64) {
		this._factory = () => new NodeClass();
		this._maxSize = maxSize;
	}

	/**
	 * Get a node from the pool (or create one if empty).
	 * The node is reset via _poolReset() and user reset().
	 * It is NOT added to the scene tree — caller must do scene.add(node).
	 */
	acquire(): T {
		const node = this._pool.pop();
		if (node) {
			// Reset engine state, then user state
			(node as unknown as { _poolReset(): void })._poolReset();
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
