import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("GameLoop start/stop/tick", () => {
	let rafCallback: ((timestamp: number) => void) | null = null;
	let latestRafId = 0;

	beforeEach(() => {
		rafCallback = null;
		latestRafId = 0;
		vi.spyOn(performance, "now").mockReturnValue(0);
		vi.stubGlobal(
			"requestAnimationFrame",
			vi.fn((cb: FrameRequestCallback) => {
				rafCallback = cb as (timestamp: number) => void;
				return ++latestRafId;
			}),
		);
		vi.stubGlobal("cancelAnimationFrame", vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function fireRaf(timestampMs: number): void {
		const cb = rafCallback;
		rafCallback = null;
		cb?.(timestampMs);
	}

	function makeCallbacks() {
		return {
			fixedUpdate: vi.fn(),
			update: vi.fn(),
			render: vi.fn(),
			cleanup: vi.fn(),
		};
	}

	it("start() sets running to true", () => {
		const loop = new GameLoop({ fixedDeltaTime: 1 / 60, maxAccumulator: 0.25 }, makeCallbacks());
		loop.start();
		expect(loop.running).toBe(true);
	});

	it("start() while already running does not schedule another RAF", () => {
		const loop = new GameLoop({ fixedDeltaTime: 1 / 60, maxAccumulator: 0.25 }, makeCallbacks());
		loop.start();
		loop.start();
		expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
	});

	it("stop() sets running to false", () => {
		const loop = new GameLoop({ fixedDeltaTime: 1 / 60, maxAccumulator: 0.25 }, makeCallbacks());
		loop.start();
		loop.stop();
		expect(loop.running).toBe(false);
	});

	it("stop() cancels the pending RAF", () => {
		const loop = new GameLoop({ fixedDeltaTime: 1 / 60, maxAccumulator: 0.25 }, makeCallbacks());
		loop.start();
		loop.stop();
		expect(cancelAnimationFrame).toHaveBeenCalled();
	});

	it("tick() calls fixedUpdate the correct number of times for elapsed time", () => {
		const cbs = makeCallbacks();
		const fixedDt = 1 / 60;
		const loop = new GameLoop({ fixedDeltaTime: fixedDt, maxAccumulator: 0.25 }, cbs);

		loop.start(); // lastTimestamp = performance.now() = 0
		// Simulate 2 fixedDt elapsed (in ms)
		fireRaf(2 * fixedDt * 1000);

		expect(cbs.fixedUpdate).toHaveBeenCalledTimes(2);
		expect(cbs.fixedUpdate).toHaveBeenCalledWith(fixedDt);
		expect(loop.fixedFrame).toBe(2);
	});

	it("tick() calls update/render/cleanup exactly once per frame even with multiple fixedUpdates", () => {
		const cbs = makeCallbacks();
		const fixedDt = 1 / 60;
		const loop = new GameLoop({ fixedDeltaTime: fixedDt, maxAccumulator: 0.25 }, cbs);

		loop.start();
		// Simulate 3 fixedDt elapsed — fixedUpdate 3x, but update/render/cleanup only 1x
		fireRaf(3 * fixedDt * 1000);

		expect(cbs.fixedUpdate).toHaveBeenCalledTimes(3);
		expect(cbs.update).toHaveBeenCalledTimes(1);
		expect(cbs.render).toHaveBeenCalledTimes(1);
		expect(cbs.cleanup).toHaveBeenCalledTimes(1);
	});

	it("tick() clamps accumulator to maxAccumulator on huge dt", () => {
		const cbs = makeCallbacks();
		const fixedDt = 1 / 60;
		const maxAcc = 0.25;
		const loop = new GameLoop({ fixedDeltaTime: fixedDt, maxAccumulator: maxAcc }, cbs);

		loop.start();
		// Simulate 2 seconds elapsed — way beyond maxAccumulator
		fireRaf(2000);

		// frameDt clamped to 0.25s → floor(0.25 / (1/60)) = 15 fixedUpdate calls
		const expectedCalls = Math.floor(maxAcc / fixedDt);
		expect(cbs.fixedUpdate).toHaveBeenCalledTimes(expectedCalls);
	});

	it("tick() passes clamped frameDt to update, not raw dt", () => {
		const cbs = makeCallbacks();
		const loop = new GameLoop({ fixedDeltaTime: 1 / 60, maxAccumulator: 0.25 }, cbs);

		loop.start();
		// 500ms = 0.5s, exceeds maxAccumulator of 0.25s
		fireRaf(500);

		expect(cbs.update).toHaveBeenCalledWith(0.25);
	});

	it("tick() updates elapsed time", () => {
		const cbs = makeCallbacks();
		const loop = new GameLoop({ fixedDeltaTime: 1 / 60, maxAccumulator: 0.25 }, cbs);

		loop.start();
		fireRaf(16); // 16ms ≈ 0.016s
		expect(loop.elapsed).toBeCloseTo(0.016);
	});

	it("tick() schedules next RAF after processing", () => {
		const cbs = makeCallbacks();
		const loop = new GameLoop({ fixedDeltaTime: 1 / 60, maxAccumulator: 0.25 }, cbs);

		loop.start();
		expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

		fireRaf(16);
		expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
	});

	it("tick() early-returns if stopped before RAF fires", () => {
		const cbs = makeCallbacks();
		const loop = new GameLoop({ fixedDeltaTime: 1 / 60, maxAccumulator: 0.25 }, cbs);

		loop.start();
		const savedCallback = rafCallback!;
		loop.stop();

		// Manually fire the saved callback (simulating RAF firing after cancel)
		savedCallback(16);

		expect(cbs.fixedUpdate).not.toHaveBeenCalled();
		expect(cbs.update).not.toHaveBeenCalled();
		expect(cbs.render).not.toHaveBeenCalled();
	});

	it("stopping during a callback prevents further ticks", () => {
		const cbs = makeCallbacks();
		const fixedDt = 1 / 60;
		let loop: GameLoop;

		cbs.fixedUpdate.mockImplementation(() => {
			loop.stop();
		});

		loop = new GameLoop({ fixedDeltaTime: fixedDt, maxAccumulator: 0.25 }, cbs);

		loop.start();
		fireRaf(fixedDt * 1000); // Triggers 1 fixedUpdate which calls stop()

		// Current tick still completes (update/render/cleanup called)
		expect(cbs.update).toHaveBeenCalledTimes(1);
		expect(cbs.render).toHaveBeenCalledTimes(1);
		expect(cbs.cleanup).toHaveBeenCalledTimes(1);

		// A new RAF was scheduled at the end of tick()
		// Firing it should be a no-op since running is false
		if (rafCallback) {
			fireRaf(2 * fixedDt * 1000);
		}

		// No additional calls beyond the first tick
		expect(cbs.update).toHaveBeenCalledTimes(1);
	});
});
