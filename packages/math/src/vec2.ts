import { EPSILON } from "./utils.js";

export class Vec2 {
	x: number;
	y: number;

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}

	// === Static Constants ===
	static readonly ZERO = Object.freeze(new Vec2(0, 0));
	static readonly ONE = Object.freeze(new Vec2(1, 1));
	static readonly UP = Object.freeze(new Vec2(0, -1));
	static readonly DOWN = Object.freeze(new Vec2(0, 1));
	static readonly LEFT = Object.freeze(new Vec2(-1, 0));
	static readonly RIGHT = Object.freeze(new Vec2(1, 0));

	// === Arithmetic ===
	add(v: Vec2): Vec2 {
		return new Vec2(this.x + v.x, this.y + v.y);
	}

	sub(v: Vec2): Vec2 {
		return new Vec2(this.x - v.x, this.y - v.y);
	}

	mul(v: Vec2): Vec2 {
		return new Vec2(this.x * v.x, this.y * v.y);
	}

	div(v: Vec2): Vec2 {
		return new Vec2(this.x / v.x, this.y / v.y);
	}

	scale(scalar: number): Vec2 {
		return new Vec2(this.x * scalar, this.y * scalar);
	}

	negate(): Vec2 {
		return new Vec2(-this.x, -this.y);
	}

	// === Geometry ===
	dot(v: Vec2): number {
		return this.x * v.x + this.y * v.y;
	}

	cross(v: Vec2): number {
		return this.x * v.y - this.y * v.x;
	}

	length(): number {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}

	lengthSquared(): number {
		return this.x * this.x + this.y * this.y;
	}

	normalize(): Vec2 {
		const len = this.length();
		if (len === 0) return Vec2.ZERO;
		return new Vec2(this.x / len, this.y / len);
	}

	withLength(len: number): Vec2 {
		const currentLen = this.length();
		if (currentLen === 0) return Vec2.ZERO;
		const scale = len / currentLen;
		return new Vec2(this.x * scale, this.y * scale);
	}

	// === Distance ===
	distanceTo(v: Vec2): number {
		return this.sub(v).length();
	}

	distanceSquaredTo(v: Vec2): number {
		return this.sub(v).lengthSquared();
	}

	// === Rotation ===
	angle(): number {
		return Math.atan2(this.y, this.x);
	}

	angleTo(v: Vec2): number {
		return Math.atan2(this.cross(v), this.dot(v));
	}

	rotate(angle: number): Vec2 {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		return new Vec2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
	}

	// === Interpolation ===
	lerp(v: Vec2, t: number): Vec2 {
		return new Vec2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t);
	}

	moveToward(target: Vec2, maxDelta: number): Vec2 {
		const diff = target.sub(this);
		const dist = diff.length();
		if (dist <= maxDelta || dist === 0) return target;
		return this.add(diff.scale(maxDelta / dist));
	}

	// === Comparison ===
	equals(v: Vec2): boolean {
		return this.x === v.x && this.y === v.y;
	}

	approxEquals(v: Vec2, epsilon: number = EPSILON): boolean {
		return Math.abs(this.x - v.x) <= epsilon && Math.abs(this.y - v.y) <= epsilon;
	}

	// === Utility ===
	abs(): Vec2 {
		return new Vec2(Math.abs(this.x), Math.abs(this.y));
	}

	floor(): Vec2 {
		return new Vec2(Math.floor(this.x), Math.floor(this.y));
	}

	ceil(): Vec2 {
		return new Vec2(Math.ceil(this.x), Math.ceil(this.y));
	}

	round(): Vec2 {
		return new Vec2(Math.round(this.x), Math.round(this.y));
	}

	clamp(min: Vec2, max: Vec2): Vec2 {
		return new Vec2(
			Math.max(min.x, Math.min(max.x, this.x)),
			Math.max(min.y, Math.min(max.y, this.y)),
		);
	}

	clone(): Vec2 {
		return new Vec2(this.x, this.y);
	}

	toString(): string {
		return `Vec2(${this.x}, ${this.y})`;
	}

	toArray(): [number, number] {
		return [this.x, this.y];
	}

	// === Static Factories ===
	static from(obj: { x: number; y: number }): Vec2 {
		return new Vec2(obj.x, obj.y);
	}

	static fromAngle(angle: number): Vec2 {
		return new Vec2(Math.cos(angle), Math.sin(angle));
	}
}
