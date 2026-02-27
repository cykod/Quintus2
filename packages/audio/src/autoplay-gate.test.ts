import { describe, expect, it, vi } from "vitest";
import { createMockAudioContext } from "./__test-utils__.js";
import { AutoplayGate } from "./autoplay-gate.js";

describe("AutoplayGate", () => {
	it("is immediately ready when AudioContext state is running", () => {
		const ctx = createMockAudioContext("running");
		const gate = new AutoplayGate(ctx as unknown as AudioContext);
		expect(gate.ready).toBe(true);
	});

	it("is not ready when AudioContext state is suspended", () => {
		const ctx = createMockAudioContext("suspended");
		const gate = new AutoplayGate(ctx as unknown as AudioContext);
		expect(gate.ready).toBe(false);
	});

	it("whenReady calls immediately if already ready", () => {
		const ctx = createMockAudioContext("running");
		const gate = new AutoplayGate(ctx as unknown as AudioContext);

		const fn = vi.fn();
		gate.whenReady(fn);
		expect(fn).toHaveBeenCalledOnce();
	});

	it("whenReady queues function when not ready", () => {
		const ctx = createMockAudioContext("suspended");
		const gate = new AutoplayGate(ctx as unknown as AudioContext);

		const fn = vi.fn();
		gate.whenReady(fn);
		expect(fn).not.toHaveBeenCalled();
	});

	it("resumes context on click and flushes queue", async () => {
		const ctx = createMockAudioContext("suspended");
		const gate = new AutoplayGate(ctx as unknown as AudioContext);

		const fn = vi.fn();
		gate.whenReady(fn);

		// Gate listens for click on document in capture phase
		document.dispatchEvent(new Event("click"));

		await vi.waitFor(() => {
			expect(gate.ready).toBe(true);
		});

		expect(fn).toHaveBeenCalledOnce();
	});

	it("resumes context on keydown", async () => {
		const ctx = createMockAudioContext("suspended");
		const gate = new AutoplayGate(ctx as unknown as AudioContext);

		document.dispatchEvent(new Event("keydown"));

		await vi.waitFor(() => {
			expect(gate.ready).toBe(true);
		});
	});

	it("emits onReady signal when context resumes", async () => {
		const ctx = createMockAudioContext("suspended");
		const gate = new AutoplayGate(ctx as unknown as AudioContext);

		const onReadyFn = vi.fn();
		gate.onReady.connect(onReadyFn);

		document.dispatchEvent(new Event("click"));

		await vi.waitFor(() => {
			expect(gate.ready).toBe(true);
		});

		expect(onReadyFn).toHaveBeenCalledOnce();
	});

	it("retries on subsequent gestures if resume fails", async () => {
		const ctx = createMockAudioContext("suspended");
		// Override resume to fail (state stays suspended)
		ctx.resume = vi.fn(() => Promise.resolve());
		const gate = new AutoplayGate(ctx as unknown as AudioContext);

		// First click — resume called but state stays suspended
		document.dispatchEvent(new Event("click"));
		await vi.waitFor(() => {
			expect(ctx.resume).toHaveBeenCalledTimes(1);
		});
		expect(gate.ready).toBe(false);

		// Second click — retries because still not ready
		document.dispatchEvent(new Event("click"));
		await vi.waitFor(() => {
			expect(ctx.resume).toHaveBeenCalledTimes(2);
		});
		expect(gate.ready).toBe(false);

		// Now make resume succeed
		ctx.resume = vi.fn(() => {
			ctx.state = "running";
			return Promise.resolve();
		});
		document.dispatchEvent(new Event("click"));
		await vi.waitFor(() => {
			expect(gate.ready).toBe(true);
		});
	});

	it("removes event listeners after successful resume", async () => {
		const ctx = createMockAudioContext("suspended");
		const removeSpy = vi.spyOn(document, "removeEventListener");

		const gate = new AutoplayGate(ctx as unknown as AudioContext);
		document.dispatchEvent(new Event("click"));

		await vi.waitFor(() => {
			expect(gate.ready).toBe(true);
		});

		// Should have removed listeners from document for both events (capture phase)
		const docCalls = removeSpy.mock.calls.filter(
			([event]) => event === "click" || event === "keydown",
		);
		expect(docCalls.length).toBe(2);
		removeSpy.mockRestore();
	});
});
