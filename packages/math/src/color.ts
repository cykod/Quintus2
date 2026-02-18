import { clamp } from "./utils.js";

export class Color {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly a: number;

	constructor(r: number, g: number, b: number, a: number = 1) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
	}

	// === Named Constants ===
	static readonly WHITE = new Color(1, 1, 1, 1);
	static readonly BLACK = new Color(0, 0, 0, 1);
	static readonly RED = new Color(1, 0, 0, 1);
	static readonly GREEN = new Color(0, 1, 0, 1);
	static readonly BLUE = new Color(0, 0, 1, 1);
	static readonly YELLOW = new Color(1, 1, 0, 1);
	static readonly CYAN = new Color(0, 1, 1, 1);
	static readonly MAGENTA = new Color(1, 0, 1, 1);
	static readonly TRANSPARENT = new Color(0, 0, 0, 0);

	// === Operations ===
	lerp(other: Color, t: number): Color {
		return new Color(
			this.r + (other.r - this.r) * t,
			this.g + (other.g - this.g) * t,
			this.b + (other.b - this.b) * t,
			this.a + (other.a - this.a) * t,
		);
	}

	multiply(other: Color): Color {
		return new Color(this.r * other.r, this.g * other.g, this.b * other.b, this.a * other.a);
	}

	withAlpha(a: number): Color {
		return new Color(this.r, this.g, this.b, a);
	}

	// === Conversion ===
	toHex(): string {
		const r = Math.round(clamp(this.r, 0, 1) * 255);
		const g = Math.round(clamp(this.g, 0, 1) * 255);
		const b = Math.round(clamp(this.b, 0, 1) * 255);
		const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
		if (this.a < 1) {
			const a = Math.round(clamp(this.a, 0, 1) * 255);
			return `${hex}${a.toString(16).padStart(2, "0")}`;
		}
		return hex;
	}

	toCSS(): string {
		const r = Math.round(clamp(this.r, 0, 1) * 255);
		const g = Math.round(clamp(this.g, 0, 1) * 255);
		const b = Math.round(clamp(this.b, 0, 1) * 255);
		return `rgba(${r}, ${g}, ${b}, ${this.a})`;
	}

	toArray(): [number, number, number, number] {
		return [this.r, this.g, this.b, this.a];
	}

	// === Comparison ===
	equals(other: Color): boolean {
		return this.r === other.r && this.g === other.g && this.b === other.b && this.a === other.a;
	}

	// === Static Factories ===
	static fromHex(hex: string): Color {
		let h = hex.startsWith("#") ? hex.slice(1) : hex;

		// Expand 3-char hex to 6-char
		if (h.length === 3) {
			const c0 = h.charAt(0);
			const c1 = h.charAt(1);
			const c2 = h.charAt(2);
			h = c0 + c0 + c1 + c1 + c2 + c2;
		}
		// Expand 4-char hex to 8-char
		if (h.length === 4) {
			const c0 = h.charAt(0);
			const c1 = h.charAt(1);
			const c2 = h.charAt(2);
			const c3 = h.charAt(3);
			h = c0 + c0 + c1 + c1 + c2 + c2 + c3 + c3;
		}

		const r = Number.parseInt(h.slice(0, 2), 16) / 255;
		const g = Number.parseInt(h.slice(2, 4), 16) / 255;
		const b = Number.parseInt(h.slice(4, 6), 16) / 255;
		const a = h.length >= 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : 1;

		return new Color(r, g, b, a);
	}

	static fromHSL(h: number, s: number, l: number, a: number = 1): Color {
		// h in [0, 1], s in [0, 1], l in [0, 1]
		if (s === 0) {
			return new Color(l, l, l, a);
		}

		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;

		const hueToRgb = (p: number, q: number, t: number): number => {
			let tt = t;
			if (tt < 0) tt += 1;
			if (tt > 1) tt -= 1;
			if (tt < 1 / 6) return p + (q - p) * 6 * tt;
			if (tt < 1 / 2) return q;
			if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
			return p;
		};

		return new Color(hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3), a);
	}

	static fromBytes(r: number, g: number, b: number, a: number = 255): Color {
		return new Color(r / 255, g / 255, b / 255, a / 255);
	}
}
