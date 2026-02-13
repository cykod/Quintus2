// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Color } from "./color.js";

describe("Color", () => {
	// === Construction ===
	it("constructs with r, g, b, a", () => {
		const c = new Color(0.5, 0.6, 0.7, 0.8);
		expect(c.r).toBe(0.5);
		expect(c.g).toBe(0.6);
		expect(c.b).toBe(0.7);
		expect(c.a).toBe(0.8);
	});

	it("defaults alpha to 1", () => {
		const c = new Color(1, 0, 0);
		expect(c.a).toBe(1);
	});

	// === Named Constants ===
	it("WHITE", () => {
		expect(Color.WHITE.equals(new Color(1, 1, 1, 1))).toBe(true);
	});

	it("BLACK", () => {
		expect(Color.BLACK.equals(new Color(0, 0, 0, 1))).toBe(true);
	});

	it("RED", () => {
		expect(Color.RED.equals(new Color(1, 0, 0, 1))).toBe(true);
	});

	it("GREEN", () => {
		expect(Color.GREEN.equals(new Color(0, 1, 0, 1))).toBe(true);
	});

	it("BLUE", () => {
		expect(Color.BLUE.equals(new Color(0, 0, 1, 1))).toBe(true);
	});

	it("TRANSPARENT", () => {
		expect(Color.TRANSPARENT.equals(new Color(0, 0, 0, 0))).toBe(true);
	});

	// === fromHex ===
	it("fromHex 6-char", () => {
		const c = Color.fromHex("#ff0000");
		expect(c.r).toBeCloseTo(1);
		expect(c.g).toBeCloseTo(0);
		expect(c.b).toBeCloseTo(0);
		expect(c.a).toBe(1);
	});

	it("fromHex 3-char", () => {
		const c = Color.fromHex("#f00");
		expect(c.r).toBeCloseTo(1);
		expect(c.g).toBeCloseTo(0);
		expect(c.b).toBeCloseTo(0);
	});

	it("fromHex 8-char with alpha", () => {
		const c = Color.fromHex("#ff000080");
		expect(c.r).toBeCloseTo(1);
		expect(c.g).toBeCloseTo(0);
		expect(c.b).toBeCloseTo(0);
		expect(c.a).toBeCloseTo(128 / 255);
	});

	it("fromHex without #", () => {
		const c = Color.fromHex("00ff00");
		expect(c.g).toBeCloseTo(1);
	});

	// === fromHSL ===
	it("fromHSL red", () => {
		const c = Color.fromHSL(0, 1, 0.5);
		expect(c.r).toBeCloseTo(1);
		expect(c.g).toBeCloseTo(0);
		expect(c.b).toBeCloseTo(0);
	});

	it("fromHSL gray (s=0)", () => {
		const c = Color.fromHSL(0, 0, 0.5);
		expect(c.r).toBeCloseTo(0.5);
		expect(c.g).toBeCloseTo(0.5);
		expect(c.b).toBeCloseTo(0.5);
	});

	// === fromBytes ===
	it("fromBytes", () => {
		const c = Color.fromBytes(255, 128, 0);
		expect(c.r).toBeCloseTo(1);
		expect(c.g).toBeCloseTo(128 / 255);
		expect(c.b).toBeCloseTo(0);
		expect(c.a).toBeCloseTo(1);
	});

	it("fromBytes with alpha", () => {
		const c = Color.fromBytes(255, 0, 0, 128);
		expect(c.a).toBeCloseTo(128 / 255);
	});

	// === toHex ===
	it("toHex without alpha", () => {
		expect(Color.RED.toHex()).toBe("#ff0000");
	});

	it("toHex with alpha", () => {
		const c = new Color(1, 0, 0, 0.5);
		const hex = c.toHex();
		expect(hex).toMatch(/^#ff0000[0-9a-f]{2}$/);
	});

	// === toCSS ===
	it("toCSS", () => {
		expect(Color.RED.toCSS()).toBe("rgba(255, 0, 0, 1)");
	});

	// === toArray ===
	it("toArray", () => {
		expect(Color.RED.toArray()).toEqual([1, 0, 0, 1]);
	});

	// === lerp ===
	it("lerp at t=0", () => {
		const result = Color.RED.lerp(Color.BLUE, 0);
		expect(result.r).toBeCloseTo(1);
		expect(result.b).toBeCloseTo(0);
	});

	it("lerp at t=1", () => {
		const result = Color.RED.lerp(Color.BLUE, 1);
		expect(result.r).toBeCloseTo(0);
		expect(result.b).toBeCloseTo(1);
	});

	it("lerp at t=0.5", () => {
		const result = Color.RED.lerp(Color.BLUE, 0.5);
		expect(result.r).toBeCloseTo(0.5);
		expect(result.b).toBeCloseTo(0.5);
	});

	// === multiply ===
	it("multiply for tinting", () => {
		const tint = new Color(1, 0.5, 0.5, 1);
		const base = Color.WHITE;
		const result = tint.multiply(base);
		expect(result.r).toBe(1);
		expect(result.g).toBe(0.5);
		expect(result.b).toBe(0.5);
	});

	it("multiply with alpha", () => {
		const a = new Color(1, 1, 1, 0.5);
		const b = new Color(1, 1, 1, 0.8);
		const result = a.multiply(b);
		expect(result.a).toBeCloseTo(0.4);
	});

	// === withAlpha ===
	it("withAlpha", () => {
		const c = Color.RED.withAlpha(0.5);
		expect(c.r).toBe(1);
		expect(c.a).toBe(0.5);
	});

	// === equals ===
	it("equals", () => {
		expect(Color.RED.equals(new Color(1, 0, 0, 1))).toBe(true);
		expect(Color.RED.equals(Color.BLUE)).toBe(false);
	});

	// === Immutability ===
	it("operations return new instances", () => {
		const c = Color.RED;
		const result = c.lerp(Color.BLUE, 0.5);
		expect(result).not.toBe(c);
		expect(c.r).toBe(1); // unchanged
	});
});
