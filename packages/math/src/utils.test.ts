// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
	approxEqual,
	clamp,
	DEG2RAD,
	EPSILON,
	inverseLerp,
	lerp,
	RAD2DEG,
	remap,
	snap,
	wrap,
} from "./utils.js";

describe("Math Utilities", () => {
	// === Constants ===
	it("DEG2RAD * 180 === PI", () => {
		expect(DEG2RAD * 180).toBeCloseTo(Math.PI);
	});

	it("RAD2DEG * PI === 180", () => {
		expect(RAD2DEG * Math.PI).toBeCloseTo(180);
	});

	it("EPSILON is 1e-6", () => {
		expect(EPSILON).toBe(1e-6);
	});

	// === clamp ===
	it("clamp within range", () => {
		expect(clamp(5, 0, 10)).toBe(5);
	});

	it("clamp below min", () => {
		expect(clamp(-5, 0, 10)).toBe(0);
	});

	it("clamp above max", () => {
		expect(clamp(15, 0, 10)).toBe(10);
	});

	// === lerp ===
	it("lerp at t=0", () => {
		expect(lerp(10, 20, 0)).toBe(10);
	});

	it("lerp at t=1", () => {
		expect(lerp(10, 20, 1)).toBe(20);
	});

	it("lerp at t=0.5", () => {
		expect(lerp(10, 20, 0.5)).toBe(15);
	});

	it("lerp extrapolation", () => {
		expect(lerp(10, 20, 2)).toBe(30);
	});

	// === inverseLerp ===
	it("inverseLerp basic", () => {
		expect(inverseLerp(10, 20, 15)).toBe(0.5);
	});

	it("inverseLerp same values returns 0", () => {
		expect(inverseLerp(5, 5, 5)).toBe(0);
	});

	// === remap ===
	it("remap value", () => {
		expect(remap(5, 0, 10, 0, 100)).toBe(50);
	});

	it("remap between different ranges", () => {
		expect(remap(0.5, 0, 1, 100, 200)).toBe(150);
	});

	// === wrap ===
	it("wrap positive value within range", () => {
		expect(wrap(5, 0, 10)).toBe(5);
	});

	it("wrap value above range", () => {
		expect(wrap(12, 0, 10)).toBeCloseTo(2);
	});

	it("wrap negative value", () => {
		expect(wrap(-1, 0, 10)).toBeCloseTo(9);
	});

	it("wrap at exact min", () => {
		expect(wrap(0, 0, 10)).toBe(0);
	});

	it("wrap at exact max", () => {
		expect(wrap(10, 0, 10)).toBeCloseTo(0);
	});

	it("wrap with zero range (min === max) returns min", () => {
		expect(wrap(5, 3, 3)).toBe(3);
		expect(wrap(0, 7, 7)).toBe(7);
	});

	// === approxEqual ===
	it("approxEqual within epsilon", () => {
		expect(approxEqual(1.0, 1.0000001)).toBe(true);
	});

	it("approxEqual outside epsilon", () => {
		expect(approxEqual(1.0, 1.001)).toBe(false);
	});

	it("approxEqual exact match", () => {
		expect(approxEqual(5, 5)).toBe(true);
	});

	// === snap ===
	it("snap to step", () => {
		expect(snap(7, 5)).toBe(5);
		expect(snap(8, 5)).toBe(10);
	});

	it("snap to 1", () => {
		expect(snap(3.7, 1)).toBe(4);
	});

	it("snap with step 0 returns value", () => {
		expect(snap(5.5, 0)).toBe(5.5);
	});
});
