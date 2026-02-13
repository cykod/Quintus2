import { EPSILON } from "./utils.js";
import { Vec2 } from "./vec2.js";

/**
 * 3x3 affine transform matrix (2D):
 * | a  c  e |
 * | b  d  f |
 * | 0  0  1 |
 *
 * Maps directly to Canvas2D's setTransform(a, b, c, d, e, f).
 */
export class Matrix2D {
	readonly a: number;
	readonly b: number;
	readonly c: number;
	readonly d: number;
	readonly e: number; // translateX
	readonly f: number; // translateY

	constructor(a: number, b: number, c: number, d: number, e: number, f: number) {
		this.a = a;
		this.b = b;
		this.c = c;
		this.d = d;
		this.e = e;
		this.f = f;
	}

	// === Static Constants ===
	static readonly IDENTITY = new Matrix2D(1, 0, 0, 1, 0, 0);

	// === Static Factories ===
	static translate(x: number, y: number): Matrix2D {
		return new Matrix2D(1, 0, 0, 1, x, y);
	}

	static rotate(angle: number): Matrix2D {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		return new Matrix2D(cos, sin, -sin, cos, 0, 0);
	}

	static scale(sx: number, sy: number): Matrix2D {
		return new Matrix2D(sx, 0, 0, sy, 0, 0);
	}

	/**
	 * Compose a full TRS transform. This is the primary factory for Node2D.
	 * Order: translate x rotate x scale (applied right-to-left: scale first, then rotate, then translate)
	 */
	static compose(position: Vec2, rotation: number, scale: Vec2): Matrix2D {
		const cos = Math.cos(rotation);
		const sin = Math.sin(rotation);
		return new Matrix2D(
			cos * scale.x, // a
			sin * scale.x, // b
			-sin * scale.y, // c
			cos * scale.y, // d
			position.x, // e
			position.y, // f
		);
	}

	// === Operations ===
	multiply(other: Matrix2D): Matrix2D {
		return new Matrix2D(
			this.a * other.a + this.c * other.b,
			this.b * other.a + this.d * other.b,
			this.a * other.c + this.c * other.d,
			this.b * other.c + this.d * other.d,
			this.a * other.e + this.c * other.f + this.e,
			this.b * other.e + this.d * other.f + this.f,
		);
	}

	premultiply(other: Matrix2D): Matrix2D {
		return other.multiply(this);
	}

	// === Transform Points ===
	transformPoint(p: Vec2): Vec2 {
		return new Vec2(this.a * p.x + this.c * p.y + this.e, this.b * p.x + this.d * p.y + this.f);
	}

	transformVector(v: Vec2): Vec2 {
		return new Vec2(this.a * v.x + this.c * v.y, this.b * v.x + this.d * v.y);
	}

	inverseTransformPoint(p: Vec2): Vec2 {
		const inv = this.inverse();
		return inv.transformPoint(p);
	}

	// === Decomposition ===
	decompose(): { position: Vec2; rotation: number; scale: Vec2 } {
		const position = new Vec2(this.e, this.f);
		const sx = Math.sqrt(this.a * this.a + this.b * this.b);
		const sy = Math.sqrt(this.c * this.c + this.d * this.d);
		const det = this.determinant();
		const rotation = Math.atan2(this.b, this.a);
		return {
			position,
			rotation,
			scale: new Vec2(sx, det < 0 ? -sy : sy),
		};
	}

	getTranslation(): Vec2 {
		return new Vec2(this.e, this.f);
	}

	getRotation(): number {
		return Math.atan2(this.b, this.a);
	}

	getScale(): Vec2 {
		const sx = Math.sqrt(this.a * this.a + this.b * this.b);
		const sy = Math.sqrt(this.c * this.c + this.d * this.d);
		const det = this.determinant();
		return new Vec2(sx, det < 0 ? -sy : sy);
	}

	// === Inverse ===
	inverse(): Matrix2D {
		const det = this.determinant();
		if (det === 0) return Matrix2D.IDENTITY;
		const invDet = 1 / det;
		return new Matrix2D(
			this.d * invDet,
			-this.b * invDet,
			-this.c * invDet,
			this.a * invDet,
			(this.c * this.f - this.d * this.e) * invDet,
			(this.b * this.e - this.a * this.f) * invDet,
		);
	}

	determinant(): number {
		return this.a * this.d - this.b * this.c;
	}

	// === Comparison ===
	equals(m: Matrix2D): boolean {
		return (
			this.a === m.a &&
			this.b === m.b &&
			this.c === m.c &&
			this.d === m.d &&
			this.e === m.e &&
			this.f === m.f
		);
	}

	approxEquals(m: Matrix2D, epsilon: number = EPSILON): boolean {
		return (
			Math.abs(this.a - m.a) <= epsilon &&
			Math.abs(this.b - m.b) <= epsilon &&
			Math.abs(this.c - m.c) <= epsilon &&
			Math.abs(this.d - m.d) <= epsilon &&
			Math.abs(this.e - m.e) <= epsilon &&
			Math.abs(this.f - m.f) <= epsilon
		);
	}

	// === Utility ===
	toArray(): [number, number, number, number, number, number] {
		return [this.a, this.b, this.c, this.d, this.e, this.f];
	}

	toString(): string {
		return `Matrix2D(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
	}
}
