import { describe, expect, test } from "vitest";
import { InputScript } from "./input-script.js";

describe("InputScript", () => {
	test("create() returns empty script", () => {
		const script = InputScript.create();
		expect(script.steps).toHaveLength(0);
		expect(script.totalFrames).toBe(0);
	});

	test("press() adds hold step", () => {
		const script = InputScript.create().press("right", 60);
		expect(script.steps).toHaveLength(1);
		expect(script.steps[0]).toEqual({ type: "press", action: "right", frames: 60 });
		expect(script.totalFrames).toBe(60);
	});

	test("tap() adds single-frame step", () => {
		const script = InputScript.create().tap("jump");
		expect(script.steps).toHaveLength(1);
		expect(script.steps[0]).toEqual({ type: "tap", action: "jump" });
		expect(script.totalFrames).toBe(1);
	});

	test("wait() adds idle step", () => {
		const script = InputScript.create().wait(30);
		expect(script.steps).toHaveLength(1);
		expect(script.steps[0]).toEqual({ type: "wait", frames: 30 });
		expect(script.totalFrames).toBe(30);
	});

	test("release() adds instant step (0 frames)", () => {
		const script = InputScript.create().release("right");
		expect(script.steps).toHaveLength(1);
		expect(script.steps[0]).toEqual({ type: "release", action: "right" });
		expect(script.totalFrames).toBe(0);
	});

	test("analog() adds analog step", () => {
		const script = InputScript.create().analog("move_x", 0.5, 30);
		expect(script.steps).toHaveLength(1);
		expect(script.steps[0]).toEqual({ type: "analog", action: "move_x", value: 0.5, frames: 30 });
		expect(script.totalFrames).toBe(30);
	});

	test("totalFrames sums all steps", () => {
		const script = InputScript.create()
			.wait(30)
			.press("right", 120)
			.tap("jump")
			.press("right", 60)
			.release("right");
		expect(script.totalFrames).toBe(30 + 120 + 1 + 60);
	});

	test("secondsToFrames() converts correctly", () => {
		expect(InputScript.secondsToFrames(1.0)).toBe(60);
		expect(InputScript.secondsToFrames(0.5)).toBe(30);
		expect(InputScript.secondsToFrames(2.0, 30)).toBe(60);
	});

	test("waitSeconds() converts seconds to frames", () => {
		const script = InputScript.create().waitSeconds(1.0);
		expect(script.totalFrames).toBe(60);
	});

	test("pressSeconds() converts seconds to frames", () => {
		const script = InputScript.create().pressSeconds("right", 2.0);
		expect(script.totalFrames).toBe(120);
	});

	test("chained builder returns this", () => {
		const script = InputScript.create();
		const result = script.wait(10).press("right", 20).tap("jump").release("right");
		expect(result).toBe(script);
	});

	test("steps returns immutable copy", () => {
		const script = InputScript.create().tap("jump");
		const steps1 = script.steps;
		const steps2 = script.steps;
		expect(steps1).not.toBe(steps2);
		expect(steps1).toEqual(steps2);
	});
});
