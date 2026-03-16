import { Color } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { evaluateCurve, evaluateGradient } from "./curve.js";

describe("evaluateCurve", () => {
	it("returns constant for a number", () => {
		expect(evaluateCurve(5, 0)).toBe(5);
		expect(evaluateCurve(5, 0.5)).toBe(5);
		expect(evaluateCurve(5, 1)).toBe(5);
	});

	it("returns 0 for empty array", () => {
		expect(evaluateCurve([], 0.5)).toBe(0);
	});

	it("returns value for single-key curve", () => {
		expect(evaluateCurve([{ time: 0.5, value: 10 }], 0)).toBe(10);
		expect(evaluateCurve([{ time: 0.5, value: 10 }], 1)).toBe(10);
	});

	it("interpolates linearly between two keys", () => {
		const curve = [
			{ time: 0, value: 0 },
			{ time: 1, value: 100 },
		];
		expect(evaluateCurve(curve, 0)).toBe(0);
		expect(evaluateCurve(curve, 0.5)).toBe(50);
		expect(evaluateCurve(curve, 1)).toBe(100);
	});

	it("interpolates multi-key curve", () => {
		const curve = [
			{ time: 0, value: 0 },
			{ time: 0.5, value: 100 },
			{ time: 1, value: 0 },
		];
		expect(evaluateCurve(curve, 0)).toBe(0);
		expect(evaluateCurve(curve, 0.25)).toBe(50);
		expect(evaluateCurve(curve, 0.5)).toBe(100);
		expect(evaluateCurve(curve, 0.75)).toBe(50);
		expect(evaluateCurve(curve, 1)).toBe(0);
	});

	it("clamps before first key", () => {
		const curve = [
			{ time: 0.2, value: 10 },
			{ time: 0.8, value: 90 },
		];
		expect(evaluateCurve(curve, 0)).toBe(10);
		expect(evaluateCurve(curve, 0.1)).toBe(10);
	});

	it("clamps after last key", () => {
		const curve = [
			{ time: 0.2, value: 10 },
			{ time: 0.8, value: 90 },
		];
		expect(evaluateCurve(curve, 0.9)).toBe(90);
		expect(evaluateCurve(curve, 1)).toBe(90);
	});

	it("grow-hold-shrink curve", () => {
		const curve = [
			{ time: 0, value: 0 },
			{ time: 0.1, value: 1 },
			{ time: 0.7, value: 1 },
			{ time: 1, value: 0 },
		];
		expect(evaluateCurve(curve, 0)).toBe(0);
		expect(evaluateCurve(curve, 0.1)).toBe(1);
		expect(evaluateCurve(curve, 0.4)).toBe(1);
		expect(evaluateCurve(curve, 0.7)).toBe(1);
		expect(evaluateCurve(curve, 0.85)).toBeCloseTo(0.5);
		expect(evaluateCurve(curve, 1)).toBe(0);
	});
});

describe("evaluateGradient", () => {
	it("returns white for empty gradient", () => {
		const c = evaluateGradient([], 0.5);
		expect(c.r).toBe(1);
		expect(c.g).toBe(1);
		expect(c.b).toBe(1);
	});

	it("returns single stop color at any time", () => {
		const c = evaluateGradient([{ time: 0, color: "#ff0000" }], 0.5);
		expect(c.r).toBeCloseTo(1);
		expect(c.g).toBeCloseTo(0);
		expect(c.b).toBeCloseTo(0);
	});

	it("interpolates between two stops", () => {
		const gradient = [
			{ time: 0, color: "#ff0000" },
			{ time: 1, color: "#0000ff" },
		];
		const mid = evaluateGradient(gradient, 0.5);
		expect(mid.r).toBeCloseTo(0.5, 1);
		expect(mid.b).toBeCloseTo(0.5, 1);
	});

	it("accepts Color instances", () => {
		const gradient = [
			{ time: 0, color: new Color(1, 0, 0) },
			{ time: 1, color: new Color(0, 0, 1) },
		];
		const mid = evaluateGradient(gradient, 0.5);
		expect(mid.r).toBeCloseTo(0.5, 1);
	});

	it("handles multi-stop gradient", () => {
		const gradient = [
			{ time: 0, color: "#ffff00" },
			{ time: 0.5, color: "#ff0000" },
			{ time: 1, color: "#000000" },
		];
		const c1 = evaluateGradient(gradient, 0);
		expect(c1.r).toBeCloseTo(1);
		expect(c1.g).toBeCloseTo(1);

		const c2 = evaluateGradient(gradient, 0.5);
		expect(c2.r).toBeCloseTo(1);
		expect(c2.g).toBeCloseTo(0);

		const c3 = evaluateGradient(gradient, 1);
		expect(c3.r).toBeCloseTo(0);
	});

	it("clamps before first stop", () => {
		const gradient = [
			{ time: 0.3, color: "#ff0000" },
			{ time: 0.7, color: "#0000ff" },
		];
		const c = evaluateGradient(gradient, 0);
		expect(c.r).toBeCloseTo(1);
	});

	it("clamps after last stop", () => {
		const gradient = [
			{ time: 0.3, color: "#ff0000" },
			{ time: 0.7, color: "#0000ff" },
		];
		const c = evaluateGradient(gradient, 1);
		expect(c.b).toBeCloseTo(1);
	});

	it("interpolates alpha channel", () => {
		const gradient = [
			{ time: 0, color: new Color(1, 1, 1, 1) },
			{ time: 1, color: new Color(1, 1, 1, 0) },
		];
		const mid = evaluateGradient(gradient, 0.5);
		expect(mid.a).toBeCloseTo(0.5, 1);
	});
});
