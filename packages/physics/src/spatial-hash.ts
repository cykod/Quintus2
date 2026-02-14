import type { AABB } from "@quintus/math";

/**
 * Grid-based spatial indexing for broad-phase collision detection.
 * Generic — knows nothing about physics types. Reusable for camera culling,
 * particle queries, etc.
 */
export class SpatialHash<T> {
	/** Cell size in pixels. */
	readonly cellSize: number;

	/** Map from cell key to set of items in that cell. */
	private readonly cells: Map<number, Set<T>> = new Map();

	/** Reverse lookup: item → set of cell keys it occupies. */
	private readonly itemToCells: Map<T, Set<number>> = new Map();

	/** Internal numeric IDs for pair deduplication. */
	private readonly itemIds: Map<T, number> = new Map();
	private nextId: number = 0;

	constructor(cellSize: number = 64) {
		this.cellSize = cellSize;
	}

	/** Insert an item into the grid at the given world AABB. */
	insert(item: T, aabb: AABB): void {
		const cellKeys = new Set<number>();
		const minCX = Math.floor(aabb.min.x / this.cellSize);
		const minCY = Math.floor(aabb.min.y / this.cellSize);
		const maxCX = Math.floor(aabb.max.x / this.cellSize);
		const maxCY = Math.floor(aabb.max.y / this.cellSize);

		for (let cx = minCX; cx <= maxCX; cx++) {
			for (let cy = minCY; cy <= maxCY; cy++) {
				const key = this.cellKey(cx, cy);
				cellKeys.add(key);

				let cell = this.cells.get(key);
				if (!cell) {
					cell = new Set();
					this.cells.set(key, cell);
				}
				cell.add(item);
			}
		}

		this.itemToCells.set(item, cellKeys);
		if (!this.itemIds.has(item)) {
			this.itemIds.set(item, this.nextId++);
		}
	}

	/** Remove an item from all cells. */
	remove(item: T): void {
		const cellKeys = this.itemToCells.get(item);
		if (!cellKeys) return;

		for (const key of cellKeys) {
			const cell = this.cells.get(key);
			if (cell) {
				cell.delete(item);
				if (cell.size === 0) {
					this.cells.delete(key);
				}
			}
		}

		this.itemToCells.delete(item);
		this.itemIds.delete(item);
	}

	/**
	 * Update an item's position in the grid.
	 * Only re-hashes if the AABB actually changed cells.
	 */
	update(item: T, aabb: AABB): void {
		const oldCellKeys = this.itemToCells.get(item);
		if (!oldCellKeys) {
			this.insert(item, aabb);
			return;
		}

		// Compute new cell keys
		const newCellKeys = new Set<number>();
		const minCX = Math.floor(aabb.min.x / this.cellSize);
		const minCY = Math.floor(aabb.min.y / this.cellSize);
		const maxCX = Math.floor(aabb.max.x / this.cellSize);
		const maxCY = Math.floor(aabb.max.y / this.cellSize);

		for (let cx = minCX; cx <= maxCX; cx++) {
			for (let cy = minCY; cy <= maxCY; cy++) {
				newCellKeys.add(this.cellKey(cx, cy));
			}
		}

		// Check if cells changed
		if (this.setsEqual(oldCellKeys, newCellKeys)) return;

		// Remove from old cells not in new set
		for (const key of oldCellKeys) {
			if (!newCellKeys.has(key)) {
				const cell = this.cells.get(key);
				if (cell) {
					cell.delete(item);
					if (cell.size === 0) {
						this.cells.delete(key);
					}
				}
			}
		}

		// Add to new cells not in old set
		for (const key of newCellKeys) {
			if (!oldCellKeys.has(key)) {
				let cell = this.cells.get(key);
				if (!cell) {
					cell = new Set();
					this.cells.set(key, cell);
				}
				cell.add(item);
			}
		}

		this.itemToCells.set(item, newCellKeys);
	}

	/** Query all items that might overlap the given AABB. */
	query(aabb: AABB): Set<T> {
		const result = new Set<T>();
		const minCX = Math.floor(aabb.min.x / this.cellSize);
		const minCY = Math.floor(aabb.min.y / this.cellSize);
		const maxCX = Math.floor(aabb.max.x / this.cellSize);
		const maxCY = Math.floor(aabb.max.y / this.cellSize);

		for (let cx = minCX; cx <= maxCX; cx++) {
			for (let cy = minCY; cy <= maxCY; cy++) {
				const key = this.cellKey(cx, cy);
				const cell = this.cells.get(key);
				if (cell) {
					for (const item of cell) {
						result.add(item);
					}
				}
			}
		}

		return result;
	}

	/**
	 * Query all unique pairs of items that share a cell.
	 * Deduplicates using numeric pair keys.
	 */
	queryPairs(): Array<[T, T]> {
		const seen = new Set<number>();
		const pairs: Array<[T, T]> = [];
		// Use a multiplier larger than any possible ID
		const maxId = this.nextId;

		for (const cell of this.cells.values()) {
			if (cell.size < 2) continue;

			const items = Array.from(cell);
			for (let i = 0; i < items.length; i++) {
				const a = items[i]!;
				const idA = this.itemIds.get(a)!;
				for (let j = i + 1; j < items.length; j++) {
					const b = items[j]!;
					const idB = this.itemIds.get(b)!;
					const lo = idA < idB ? idA : idB;
					const hi = idA < idB ? idB : idA;
					const pairKey = lo * maxId + hi;
					if (!seen.has(pairKey)) {
						seen.add(pairKey);
						pairs.push([a, b]);
					}
				}
			}
		}

		return pairs;
	}

	/** Remove all items from the grid. */
	clear(): void {
		this.cells.clear();
		this.itemToCells.clear();
		this.itemIds.clear();
		this.nextId = 0;
	}

	/** Number of items in the grid. */
	get count(): number {
		return this.itemToCells.size;
	}

	/** Hash a cell coordinate pair to a single number (Cantor pairing). */
	private cellKey(cx: number, cy: number): number {
		const a = cx >= 0 ? 2 * cx : -2 * cx - 1;
		const b = cy >= 0 ? 2 * cy : -2 * cy - 1;
		return ((a + b) * (a + b + 1)) / 2 + b;
	}

	/** Check if two sets contain the same elements. */
	private setsEqual(a: Set<number>, b: Set<number>): boolean {
		if (a.size !== b.size) return false;
		for (const key of a) {
			if (!b.has(key)) return false;
		}
		return true;
	}
}
