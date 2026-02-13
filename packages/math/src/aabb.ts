import { Rect } from "./rect.js";
import { Vec2 } from "./vec2.js";

export class AABB {
	readonly min: Vec2;
	readonly max: Vec2;

	constructor(min: Vec2, max: Vec2) {
		this.min = min;
		this.max = max;
	}

	// === Computed ===
	get center(): Vec2 {
		return new Vec2((this.min.x + this.max.x) / 2, (this.min.y + this.max.y) / 2);
	}

	get size(): Vec2 {
		return new Vec2(this.max.x - this.min.x, this.max.y - this.min.y);
	}

	get width(): number {
		return this.max.x - this.min.x;
	}

	get height(): number {
		return this.max.y - this.min.y;
	}

	// === Queries ===
	contains(point: Vec2): boolean {
		return (
			point.x >= this.min.x &&
			point.x <= this.max.x &&
			point.y >= this.min.y &&
			point.y <= this.max.y
		);
	}

	overlaps(other: AABB): boolean {
		return (
			this.min.x < other.max.x &&
			this.max.x > other.min.x &&
			this.min.y < other.max.y &&
			this.max.y > other.min.y
		);
	}

	containsAABB(other: AABB): boolean {
		return (
			other.min.x >= this.min.x &&
			other.max.x <= this.max.x &&
			other.min.y >= this.min.y &&
			other.max.y <= this.max.y
		);
	}

	// === Operations ===
	merge(other: AABB): AABB {
		return new AABB(
			new Vec2(Math.min(this.min.x, other.min.x), Math.min(this.min.y, other.min.y)),
			new Vec2(Math.max(this.max.x, other.max.x), Math.max(this.max.y, other.max.y)),
		);
	}

	expand(amount: number): AABB {
		return new AABB(
			new Vec2(this.min.x - amount, this.min.y - amount),
			new Vec2(this.max.x + amount, this.max.y + amount),
		);
	}

	// === Conversion ===
	toRect(): Rect {
		return new Rect(this.min.x, this.min.y, this.max.x - this.min.x, this.max.y - this.min.y);
	}

	// === Static Factories ===
	static fromRect(rect: Rect): AABB {
		return new AABB(new Vec2(rect.x, rect.y), new Vec2(rect.x + rect.width, rect.y + rect.height));
	}

	static fromPoints(points: Vec2[]): AABB {
		if (points.length === 0) {
			return new AABB(Vec2.ZERO, Vec2.ZERO);
		}
		const first = points[0] as Vec2;
		let minX = first.x;
		let minY = first.y;
		let maxX = first.x;
		let maxY = first.y;
		for (let i = 1; i < points.length; i++) {
			const p = points[i] as Vec2;
			if (p.x < minX) minX = p.x;
			if (p.y < minY) minY = p.y;
			if (p.x > maxX) maxX = p.x;
			if (p.y > maxY) maxY = p.y;
		}
		return new AABB(new Vec2(minX, minY), new Vec2(maxX, maxY));
	}

	static fromCenterSize(center: Vec2, size: Vec2): AABB {
		const half = size.scale(0.5);
		return new AABB(center.sub(half), center.add(half));
	}
}
