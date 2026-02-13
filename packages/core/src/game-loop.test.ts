import { describe, expect, it } from "vitest";
import { GameLoop } from "./game-loop.js";

describe("GameLoop", () => {
	it("step() calls fixedUpdate + update + render + cleanup in order", () => {
		const order: string[] = [];
		const loop = new GameLoop(
			{ fixedDeltaTime: 1 / 60, maxAccumulator: 0.25 },
			{
				fixedUpdate: () => order.push("fixedUpdate"),
				update: () => order.push("update"),
				render: () => order.push("render"),
				cleanup: () => order.push("cleanup"),
			},
		);
		loop.step();
		expect(order).toEqual(["fixedUpdate", "update", "render", "cleanup"]);
	});

	it("step() passes fixedDeltaTime to both by default", () => {
		const fixedDt = 1 / 60;
		const fixedDts: number[] = [];
		const updateDts: number[] = [];
		const loop = new GameLoop(
			{ fixedDeltaTime: fixedDt, maxAccumulator: 0.25 },
			{
				fixedUpdate: (dt) => fixedDts.push(dt),
				update: (dt) => updateDts.push(dt),
				render: () => {},
				cleanup: () => {},
			},
		);
		loop.step();
		expect(fixedDts[0]).toBe(fixedDt);
		expect(updateDts[0]).toBe(fixedDt);
	});

	it("step(variableDt) passes variableDt to update, fixedDeltaTime to fixedUpdate", () => {
		const fixedDt = 1 / 60;
		const fixedDts: number[] = [];
		const updateDts: number[] = [];
		const loop = new GameLoop(
			{ fixedDeltaTime: fixedDt, maxAccumulator: 0.25 },
			{
				fixedUpdate: (dt) => fixedDts.push(dt),
				update: (dt) => updateDts.push(dt),
				render: () => {},
				cleanup: () => {},
			},
		);
		loop.step(1 / 30);
		expect(fixedDts[0]).toBe(fixedDt);
		expect(updateDts[0]).toBeCloseTo(1 / 30);
	});

	it("multiple step() calls accumulate elapsed time", () => {
		const fixedDt = 1 / 60;
		const loop = new GameLoop(
			{ fixedDeltaTime: fixedDt, maxAccumulator: 0.25 },
			{
				fixedUpdate: () => {},
				update: () => {},
				render: () => {},
				cleanup: () => {},
			},
		);
		loop.step();
		loop.step();
		loop.step();
		expect(loop.elapsed).toBeCloseTo(3 * fixedDt);
	});

	it("fixedFrame increments on each step", () => {
		const loop = new GameLoop(
			{ fixedDeltaTime: 1 / 60, maxAccumulator: 0.25 },
			{
				fixedUpdate: () => {},
				update: () => {},
				render: () => {},
				cleanup: () => {},
			},
		);
		expect(loop.fixedFrame).toBe(0);
		loop.step();
		expect(loop.fixedFrame).toBe(1);
		loop.step();
		expect(loop.fixedFrame).toBe(2);
	});

	it("running is false initially", () => {
		const loop = new GameLoop(
			{ fixedDeltaTime: 1 / 60, maxAccumulator: 0.25 },
			{
				fixedUpdate: () => {},
				update: () => {},
				render: () => {},
				cleanup: () => {},
			},
		);
		expect(loop.running).toBe(false);
	});
});
