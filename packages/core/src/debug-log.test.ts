import { describe, expect, it } from "vitest";
import { DebugLog } from "./debug-log.js";

describe("DebugLog", () => {
	it("write and peek return events", () => {
		const log = new DebugLog();
		log.write({ category: "test", message: "hello" }, 0, 0);
		log.write({ category: "test", message: "world" }, 1, 0.016);

		const events = log.peek();
		expect(events.length).toBe(2);
		expect(events[0]?.message).toBe("hello");
		expect(events[1]?.message).toBe("world");
		expect(events[1]?.frame).toBe(1);
	});

	it("drain returns events since last drain", () => {
		const log = new DebugLog();
		log.write({ category: "a", message: "first" }, 0, 0);
		log.write({ category: "a", message: "second" }, 1, 0.016);

		const batch1 = log.drain();
		expect(batch1.length).toBe(2);

		log.write({ category: "a", message: "third" }, 2, 0.032);
		const batch2 = log.drain();
		expect(batch2.length).toBe(1);
		expect(batch2[0]?.message).toBe("third");
	});

	it("peek does not advance drain cursor", () => {
		const log = new DebugLog();
		log.write({ category: "a", message: "event" }, 0, 0);

		log.peek();
		const drained = log.drain();
		expect(drained.length).toBe(1);
	});

	it("clear resets everything", () => {
		const log = new DebugLog();
		log.write({ category: "a", message: "event" }, 0, 0);
		log.clear();

		expect(log.size).toBe(0);
		expect(log.peek()).toEqual([]);
		expect(log.drain()).toEqual([]);
	});

	it("size tracks buffer length", () => {
		const log = new DebugLog();
		expect(log.size).toBe(0);
		log.write({ category: "a", message: "1" }, 0, 0);
		expect(log.size).toBe(1);
		log.write({ category: "a", message: "2" }, 1, 0.016);
		expect(log.size).toBe(2);
	});

	it("ring buffer drops oldest when full", () => {
		const log = new DebugLog(3);
		log.write({ category: "a", message: "1" }, 0, 0);
		log.write({ category: "a", message: "2" }, 1, 1);
		log.write({ category: "a", message: "3" }, 2, 2);
		log.write({ category: "a", message: "4" }, 3, 3);

		expect(log.size).toBe(3);
		const events = log.peek();
		expect(events[0]?.message).toBe("2");
		expect(events[2]?.message).toBe("4");
	});

	it("ring buffer adjusts drain cursor on overflow", () => {
		const log = new DebugLog(3);
		log.write({ category: "a", message: "1" }, 0, 0);
		// Drain after first event
		const first = log.drain();
		expect(first.length).toBe(1);

		// Fill buffer past capacity
		log.write({ category: "a", message: "2" }, 1, 1);
		log.write({ category: "a", message: "3" }, 2, 2);
		log.write({ category: "a", message: "4" }, 3, 3);

		// Drain should still return only new events
		const batch = log.drain();
		expect(batch.length).toBe(3);
	});

	describe("filters", () => {
		function createLogWithEvents(): DebugLog {
			const log = new DebugLog();
			log.write({ category: "physics", message: "collision detected" }, 1, 0.016);
			log.write({ category: "lifecycle", message: "Player#1.onReady" }, 1, 0.016);
			log.write({ category: "physics", message: "floor_contact entered" }, 2, 0.032);
			log.write({ category: "scene", message: "scene switch" }, 5, 0.083);
			log.write({ category: "error", message: "oops something bad" }, 10, 0.166);
			return log;
		}

		it("filters by category", () => {
			const log = createLogWithEvents();
			const events = log.peek({ category: "physics" });
			expect(events.length).toBe(2);
			expect(events.every((e) => e.category === "physics")).toBe(true);
		});

		it("filters by comma-separated categories", () => {
			const log = createLogWithEvents();
			const events = log.peek({ category: "physics, scene" });
			expect(events.length).toBe(3);
		});

		it("filters by frame range", () => {
			const log = createLogWithEvents();
			const events = log.peek({ fromFrame: 2, toFrame: 5 });
			expect(events.length).toBe(2);
		});

		it("filters by time range", () => {
			const log = createLogWithEvents();
			const events = log.peek({ fromTime: 0.03, toTime: 0.1 });
			expect(events.length).toBe(2);
		});

		it("filters by search substring (case-insensitive)", () => {
			const log = createLogWithEvents();
			const events = log.peek({ search: "PLAYER" });
			expect(events.length).toBe(1);
			expect(events[0]?.message).toContain("Player");
		});

		it("filters with limit (from end)", () => {
			const log = createLogWithEvents();
			const events = log.peek({ limit: 2 });
			expect(events.length).toBe(2);
			expect(events[0]?.category).toBe("scene");
			expect(events[1]?.category).toBe("error");
		});

		it("filters work with drain", () => {
			const log = createLogWithEvents();
			const events = log.drain({ category: "error" });
			expect(events.length).toBe(1);
			expect(events[0]?.message).toBe("oops something bad");
		});
	});
});
