import { EPSILON } from "./utils.js";

export class Vec2 {
	private _x: number;
	private _y: number;

	/** @internal Callback for dirty-flagging (used by Node2D). */
	_onChange?: () => void;

	constructor(x: number, y: number) {
		this._x = x;
		this._y = y;
	}

	get x(): number {
		return this._x;
	}

	set x(v: number) {
		if (this._x !== v) {
			this._x = v;
			this._onChange?.();
		}
	}

	get y(): number {
		return this._y;
	}

	set y(v: number) {
		if (this._y !== v) {
			this._y = v;
			this._onChange?.();
		}
	}

	// === Static Constants ===
	// Cast back to Vec2 — freeze still prevents mutation at runtime,
	// but Readonly<Vec2> is incompatible due to private fields.
	static readonly ZERO = Object.freeze(new Vec2(0, 0)) as Vec2;
	static readonly ONE = Object.freeze(new Vec2(1, 1)) as Vec2;
	static readonly UP = Object.freeze(new Vec2(0, -1)) as Vec2;
	static readonly DOWN = Object.freeze(new Vec2(0, 1)) as Vec2;
	static readonly LEFT = Object.freeze(new Vec2(-1, 0)) as Vec2;
	static readonly RIGHT = Object.freeze(new Vec2(1, 0)) as Vec2;

	// === Arithmetic ===
	add(v: Vec2): Vec2 {
		return new Vec2(this._x + v._x, this._y + v._y);
	}

	sub(v: Vec2): Vec2 {
		return new Vec2(this._x - v._x, this._y - v._y);
	}

	mul(v: Vec2): Vec2 {
		return new Vec2(this._x * v._x, this._y * v._y);
	}

	div(v: Vec2): Vec2 {
		return new Vec2(this._x / v._x, this._y / v._y);
	}

	scale(scalar: number): Vec2 {
		return new Vec2(this._x * scalar, this._y * scalar);
	}

	negate(): Vec2 {
		return new Vec2(-this._x, -this._y);
	}

	// === Geometry ===
	dot(v: Vec2): number {
		return this._x * v._x + this._y * v._y;
	}

	cross(v: Vec2): number {
		return this._x * v._y - this._y * v._x;
	}

	length(): number {
		return Math.sqrt(this._x * this._x + this._y * this._y);
	}

	lengthSquared(): number {
		return this._x * this._x + this._y * this._y;
	}

	normalize(): Vec2 {
		const len = this.length();
		if (len === 0) return Vec2.ZERO;
		return new Vec2(this._x / len, this._y / len);
	}

	withLength(len: number): Vec2 {
		const currentLen = this.length();
		if (currentLen === 0) return Vec2.ZERO;
		const scale = len / currentLen;
		return new Vec2(this._x * scale, this._y * scale);
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
		return Math.atan2(this._y, this._x);
	}

	angleTo(v: Vec2): number {
		return Math.atan2(this.cross(v), this.dot(v));
	}

	rotate(angle: number): Vec2 {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		return new Vec2(this._x * cos - this._y * sin, this._x * sin + this._y * cos);
	}

	// === Interpolation ===
	lerp(v: Vec2, t: number): Vec2 {
		return new Vec2(this._x + (v._x - this._x) * t, this._y + (v._y - this._y) * t);
	}

	moveToward(target: Vec2, maxDelta: number): Vec2 {
		const diff = target.sub(this);
		const dist = diff.length();
		if (dist <= maxDelta || dist === 0) return target;
		return this.add(diff.scale(maxDelta / dist));
	}

	// === Comparison ===
	equals(v: Vec2): boolean {
		return this._x === v._x && this._y === v._y;
	}

	approxEquals(v: Vec2, epsilon: number = EPSILON): boolean {
		return Math.abs(this._x - v._x) <= epsilon && Math.abs(this._y - v._y) <= epsilon;
	}

	// === Utility ===
	abs(): Vec2 {
		return new Vec2(Math.abs(this._x), Math.abs(this._y));
	}

	floor(): Vec2 {
		return new Vec2(Math.floor(this._x), Math.floor(this._y));
	}

	ceil(): Vec2 {
		return new Vec2(Math.ceil(this._x), Math.ceil(this._y));
	}

	round(): Vec2 {
		return new Vec2(Math.round(this._x), Math.round(this._y));
	}

	clamp(min: Vec2, max: Vec2): Vec2 {
		return new Vec2(
			Math.max(min._x, Math.min(max._x, this._x)),
			Math.max(min._y, Math.min(max._y, this._y)),
		);
	}

	clone(): Vec2 {
		return new Vec2(this._x, this._y);
	}

	toString(): string {
		return `Vec2(${this._x}, ${this._y})`;
	}

	toArray(): [number, number] {
		return [this._x, this._y];
	}

	// === Static Factories ===
	static from(obj: { x: number; y: number }): Vec2 {
		return new Vec2(obj.x, obj.y);
	}

	static fromAngle(angle: number): Vec2 {
		return new Vec2(Math.cos(angle), Math.sin(angle));
	}
}
