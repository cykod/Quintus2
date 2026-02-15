import { describe, expect, it } from "vitest";
import { Ease } from "./easing.js";

describe("Ease", () => {
	const nonOvershoot = [
		"linear",
		"quadIn",
		"quadOut",
		"quadInOut",
		"cubicIn",
		"cubicOut",
		"cubicInOut",
		"sineIn",
		"sineOut",
		"sineInOut",
		"expoIn",
		"expoOut",
		"bounceOut",
	] as const;

	for (const name of nonOvershoot) {
		describe(name, () => {
			it("returns 0 at t=0", () => {
				expect(Ease[name](0)).toBeCloseTo(0, 5);
			});

			it("returns 1 at t=1", () => {
				expect(Ease[name](1)).toBeCloseTo(1, 5);
			});

			it("returns a value between 0 and 1 at t=0.5", () => {
				const v = Ease[name](0.5);
				expect(v).toBeGreaterThanOrEqual(0);
				expect(v).toBeLessThanOrEqual(1);
			});
		});
	}

	describe("elasticOut", () => {
		it("returns 0 at t=0", () => {
			expect(Ease.elasticOut(0)).toBe(0);
		});

		it("returns 1 at t=1", () => {
			expect(Ease.elasticOut(1)).toBe(1);
		});

		it("may overshoot between 0 and 1", () => {
			const v = Ease.elasticOut(0.3);
			expect(typeof v).toBe("number");
			expect(Number.isFinite(v)).toBe(true);
		});
	});

	describe("backOut", () => {
		it("returns approximately 0 at t=0", () => {
			expect(Ease.backOut(0)).toBeCloseTo(0, 5);
		});

		it("returns approximately 1 at t=1", () => {
			expect(Ease.backOut(1)).toBeCloseTo(1, 5);
		});

		it("overshoots past 1 mid-animation", () => {
			const v = Ease.backOut(0.5);
			expect(v).toBeGreaterThan(1);
		});
	});

	it("linear is identity", () => {
		for (let t = 0; t <= 1; t += 0.1) {
			expect(Ease.linear(t)).toBeCloseTo(t, 10);
		}
	});

	it("quadIn is monotonically increasing", () => {
		let prev = Ease.quadIn(0);
		for (let t = 0.01; t <= 1; t += 0.01) {
			const v = Ease.quadIn(t);
			expect(v).toBeGreaterThanOrEqual(prev);
			prev = v;
		}
	});
});
