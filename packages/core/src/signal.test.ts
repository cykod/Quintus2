import { describe, expect, it, vi } from "vitest";
import { Signal, signal } from "./signal.js";

describe("Signal", () => {
	it("connect + emit: handler receives payload", () => {
		const s = signal<number>();
		const handler = vi.fn();
		s.connect(handler);
		s.emit(5);
		expect(handler).toHaveBeenCalledWith(5);
	});

	it("multiple handlers fire in connection order", () => {
		const s = signal<void>();
		const order: number[] = [];
		s.connect(() => order.push(1));
		s.connect(() => order.push(2));
		s.connect(() => order.push(3));
		s.emit();
		expect(order).toEqual([1, 2, 3]);
	});

	it("disconnect removes specific handler", () => {
		const s = signal<void>();
		const a = vi.fn();
		const b = vi.fn();
		s.connect(a);
		s.connect(b);
		s.disconnect(a);
		s.emit();
		expect(a).not.toHaveBeenCalled();
		expect(b).toHaveBeenCalled();
	});

	it("disconnectAll removes all handlers", () => {
		const s = signal<void>();
		s.connect(vi.fn());
		s.connect(vi.fn());
		s.disconnectAll();
		expect(s.listenerCount).toBe(0);
	});

	it("once fires exactly once", () => {
		const s = signal<void>();
		const handler = vi.fn();
		s.once(handler);
		s.emit();
		s.emit();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("typed payloads: complex objects pass through", () => {
		const s = signal<{ name: string; value: number }>();
		const handler = vi.fn();
		s.connect(handler);
		s.emit({ name: "test", value: 42 });
		expect(handler).toHaveBeenCalledWith({ name: "test", value: 42 });
	});

	it("void signals: emit() with no args", () => {
		const s = signal<void>();
		const handler = vi.fn();
		s.connect(handler);
		s.emit();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("listenerCount", () => {
		const s = signal<void>();
		expect(s.listenerCount).toBe(0);
		s.connect(() => {});
		expect(s.listenerCount).toBe(1);
		s.connect(() => {});
		expect(s.listenerCount).toBe(2);
	});

	it("hasListeners", () => {
		const s = signal<void>();
		expect(s.hasListeners).toBe(false);
		const conn = s.connect(() => {});
		expect(s.hasListeners).toBe(true);
		conn.disconnect();
		expect(s.hasListeners).toBe(false);
	});

	it("SignalConnection.disconnect", () => {
		const s = signal<void>();
		const handler = vi.fn();
		const conn = s.connect(handler);
		conn.disconnect();
		s.emit();
		expect(handler).not.toHaveBeenCalled();
	});

	it("SignalConnection.connected", () => {
		const s = signal<void>();
		const conn = s.connect(() => {});
		expect(conn.connected).toBe(true);
		conn.disconnect();
		expect(conn.connected).toBe(false);
	});

	// Emission safety
	it("connect during emit: new handler is NOT called in current emission", () => {
		const s = signal<void>();
		const lateHandler = vi.fn();
		s.connect(() => {
			s.connect(lateHandler);
		});
		s.emit();
		expect(lateHandler).not.toHaveBeenCalled();

		// But fires on next emit
		s.emit();
		expect(lateHandler).toHaveBeenCalledTimes(1);
	});

	it("disconnect during emit: disconnected handler is skipped", () => {
		const s = signal<void>();
		const b = vi.fn();
		s.connect(() => {
			s.disconnect(b);
		});
		s.connect(b);
		s.emit();
		expect(b).not.toHaveBeenCalled();
	});

	it("disconnect during emit with no disconnections: no overhead", () => {
		const s = signal<void>();
		const a = vi.fn();
		const b = vi.fn();
		s.connect(a);
		s.connect(b);
		s.emit();
		expect(a).toHaveBeenCalledTimes(1);
		expect(b).toHaveBeenCalledTimes(1);
	});

	it("disconnect a handler that was already disconnected (no error)", () => {
		const s = signal<void>();
		const handler = vi.fn();
		s.connect(handler);
		s.disconnect(handler);
		s.disconnect(handler); // Should not throw
	});

	it("signal factory creates new Signal", () => {
		const s1 = signal<void>();
		const s2 = signal<void>();
		expect(s1).not.toBe(s2);
		expect(s1).toBeInstanceOf(Signal);
	});
});
