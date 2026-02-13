import { Vec2 } from "./vec2.js";

export class Rect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;

	constructor(x: number, y: number, width: number, height: number) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	}

	// === Computed Properties ===
	get left(): number {
		return this.x;
	}

	get right(): number {
		return this.x + this.width;
	}

	get top(): number {
		return this.y;
	}

	get bottom(): number {
		return this.y + this.height;
	}

	get center(): Vec2 {
		return new Vec2(this.x + this.width / 2, this.y + this.height / 2);
	}

	get size(): Vec2 {
		return new Vec2(this.width, this.height);
	}

	get topLeft(): Vec2 {
		return new Vec2(this.x, this.y);
	}

	get topRight(): Vec2 {
		return new Vec2(this.x + this.width, this.y);
	}

	get bottomLeft(): Vec2 {
		return new Vec2(this.x, this.y + this.height);
	}

	get bottomRight(): Vec2 {
		return new Vec2(this.x + this.width, this.y + this.height);
	}

	// === Queries ===
	contains(point: Vec2): boolean {
		return (
			point.x >= this.x && point.x <= this.right && point.y >= this.y && point.y <= this.bottom
		);
	}

	containsRect(other: Rect): boolean {
		return (
			other.x >= this.x &&
			other.right <= this.right &&
			other.y >= this.y &&
			other.bottom <= this.bottom
		);
	}

	intersects(other: Rect): boolean {
		return (
			this.x < other.right && this.right > other.x && this.y < other.bottom && this.bottom > other.y
		);
	}

	// === Operations ===
	intersection(other: Rect): Rect | null {
		const x = Math.max(this.x, other.x);
		const y = Math.max(this.y, other.y);
		const right = Math.min(this.right, other.right);
		const bottom = Math.min(this.bottom, other.bottom);
		if (right <= x || bottom <= y) return null;
		return new Rect(x, y, right - x, bottom - y);
	}

	union(other: Rect): Rect {
		const x = Math.min(this.x, other.x);
		const y = Math.min(this.y, other.y);
		const right = Math.max(this.right, other.right);
		const bottom = Math.max(this.bottom, other.bottom);
		return new Rect(x, y, right - x, bottom - y);
	}

	expand(amount: number): Rect {
		return new Rect(
			this.x - amount,
			this.y - amount,
			this.width + amount * 2,
			this.height + amount * 2,
		);
	}

	expandToInclude(point: Vec2): Rect {
		const x = Math.min(this.x, point.x);
		const y = Math.min(this.y, point.y);
		const right = Math.max(this.right, point.x);
		const bottom = Math.max(this.bottom, point.y);
		return new Rect(x, y, right - x, bottom - y);
	}

	// === Utility ===
	equals(other: Rect): boolean {
		return (
			this.x === other.x &&
			this.y === other.y &&
			this.width === other.width &&
			this.height === other.height
		);
	}

	clone(): Rect {
		return new Rect(this.x, this.y, this.width, this.height);
	}

	toString(): string {
		return `Rect(${this.x}, ${this.y}, ${this.width}, ${this.height})`;
	}

	// === Static Factories ===
	static fromCenter(center: Vec2, size: Vec2): Rect {
		return new Rect(center.x - size.x / 2, center.y - size.y / 2, size.x, size.y);
	}

	static fromPoints(p1: Vec2, p2: Vec2): Rect {
		const x = Math.min(p1.x, p2.x);
		const y = Math.min(p1.y, p2.y);
		return new Rect(x, y, Math.max(p1.x, p2.x) - x, Math.max(p1.y, p2.y) - y);
	}

	static fromMinMax(min: Vec2, max: Vec2): Rect {
		return new Rect(min.x, min.y, max.x - min.x, max.y - min.y);
	}
}
