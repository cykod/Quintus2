import { describe, expect, it, vi } from "vitest";
import { createMockAudioContext } from "./__test-utils__.js";
import { AutoplayGate } from "./autoplay-gate.js";

function createCanvas(): HTMLCanvasElement {
	return document.createElement("canvas");
}

describe("AutoplayGate", () => {
	it("is immediately ready when AudioContext state is running", () => {
		const ctx = createMockAudioContext("running");
		const gate = new AutoplayGate(ctx as unknown as AudioContext, createCanvas());
		expect(gate.ready).toBe(true);
	});

	it("is not ready when AudioContext state is suspended", () => {
		const ctx = createMockAudioContext("suspended");
		const gate = new AutoplayGate(ctx as unknown as AudioContext, createCanvas());
		expect(gate.ready).toBe(false);
	});

	it("whenReady calls immediately if already ready", () => {
		const ctx = createMockAudioContext("running");
		const gate = new AutoplayGate(ctx as unknown as AudioContext, createCanvas());

		const fn = vi.fn();
		gate.whenReady(fn);
		expect(fn).toHaveBeenCalledOnce();
	});

	it("whenReady queues function when not ready", () => {
		const ctx = createMockAudioContext("suspended");
		const gate = new AutoplayGate(ctx as unknown as AudioContext, createCanvas());

		const fn = vi.fn();
		gate.whenReady(fn);
		expect(fn).not.toHaveBeenCalled();
	});

	it("resumes context on user interaction and flushes queue", async () => {
		const ctx = createMockAudioContext("suspended");
		const canvas = createCanvas();
		const gate = new AutoplayGate(ctx as unknown as AudioContext, canvas);

		const fn1 = vi.fn();
		const fn2 = vi.fn();
		gate.whenReady(fn1);
		gate.whenReady(fn2);

		// Simulate user interaction
		canvas.dispatchEvent(new Event("pointerdown"));

		// context.resume() returns a promise, need to flush it
		await vi.waitFor(() => {
			expect(gate.ready).toBe(true);
		});

		expect(fn1).toHaveBeenCalledOnce();
		expect(fn2).toHaveBeenCalledOnce();
	});

	it("emits onReady signal when context resumes", async () => {
		const ctx = createMockAudioContext("suspended");
		const canvas = createCanvas();
		const gate = new AutoplayGate(ctx as unknown as AudioContext, canvas);

		const onReadyFn = vi.fn();
		gate.onReady.connect(onReadyFn);

		canvas.dispatchEvent(new Event("pointerdown"));

		await vi.waitFor(() => {
			expect(gate.ready).toBe(true);
		});

		expect(onReadyFn).toHaveBeenCalledOnce();
	});

	it("only resumes once even with multiple interactions", async () => {
		const ctx = createMockAudioContext("suspended");
		const canvas = createCanvas();
		const gate = new AutoplayGate(ctx as unknown as AudioContext, canvas);

		canvas.dispatchEvent(new Event("pointerdown"));
		canvas.dispatchEvent(new Event("keydown"));
		canvas.dispatchEvent(new Event("touchstart"));

		await vi.waitFor(() => {
			expect(gate.ready).toBe(true);
		});

		expect(ctx.resume).toHaveBeenCalledOnce();
	});

	it("removes event listeners after resume", async () => {
		const ctx = createMockAudioContext("suspended");
		const canvas = createCanvas();
		const removeSpy = vi.spyOn(canvas, "removeEventListener");

		const gate = new AutoplayGate(ctx as unknown as AudioContext, canvas);
		canvas.dispatchEvent(new Event("pointerdown"));

		await vi.waitFor(() => {
			expect(gate.ready).toBe(true);
		});

		// Should have removed listeners from canvas for all 3 events
		const canvasCalls = removeSpy.mock.calls.filter(
			([event]) => event === "pointerdown" || event === "keydown" || event === "touchstart",
		);
		expect(canvasCalls.length).toBe(3);
	});
});
