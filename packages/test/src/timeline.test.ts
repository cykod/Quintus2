import type { NodeSnapshot } from "@quintus/core";
import { describe, expect, test } from "vitest";
import { Timeline } from "./timeline.js";

function makeSnapshot(id: number, children: NodeSnapshot[] = []): NodeSnapshot {
	return {
		id,
		type: "Scene",
		name: "TestScene",
		tags: [],
		children,
	};
}

function makePlayer(x: number): NodeSnapshot {
	return {
		id: 1,
		type: "Player",
		name: "Player",
		tags: ["player"],
		children: [],
		position: { x, y: 200 },
	} as unknown as NodeSnapshot;
}

function makeCoin(id: number): NodeSnapshot {
	return {
		id,
		type: "Coin",
		name: "Coin",
		tags: ["coin"],
		children: [],
	};
}

describe("Timeline", () => {
	test("record and length", () => {
		const tl = new Timeline();
		expect(tl.length).toBe(0);
		tl.record(0, 0, makeSnapshot(0));
		tl.record(1, 1 / 60, makeSnapshot(0));
		expect(tl.length).toBe(2);
	});

	test("atFrame returns entry at or before frame", () => {
		const tl = new Timeline();
		tl.record(0, 0, makeSnapshot(0));
		tl.record(60, 1, makeSnapshot(0));
		tl.record(120, 2, makeSnapshot(0));

		expect(tl.atFrame(0)?.frame).toBe(0);
		expect(tl.atFrame(30)?.frame).toBe(0);
		expect(tl.atFrame(60)?.frame).toBe(60);
		expect(tl.atFrame(90)?.frame).toBe(60);
		expect(tl.atFrame(120)?.frame).toBe(120);
	});

	test("atFrame returns null for empty timeline", () => {
		expect(new Timeline().atFrame(0)).toBeNull();
	});

	test("atTime returns entry at or before time", () => {
		const tl = new Timeline();
		tl.record(0, 0, makeSnapshot(0));
		tl.record(60, 1.0, makeSnapshot(0));

		expect(tl.atTime(0.5)?.frame).toBe(0);
		expect(tl.atTime(1.0)?.frame).toBe(60);
	});

	test("findNode locates nodes by type", () => {
		const tl = new Timeline();
		tl.record(0, 0, makeSnapshot(0, [makePlayer(100)]));

		const node = tl.findNode(0, "Player");
		expect(node).not.toBeNull();
		expect(node?.type).toBe("Player");
	});

	test("findNode locates nodes by tag", () => {
		const tl = new Timeline();
		tl.record(0, 0, makeSnapshot(0, [makePlayer(100)]));

		expect(tl.findNode(0, "player")).not.toBeNull();
	});

	test("findNode returns null when not found", () => {
		const tl = new Timeline();
		tl.record(0, 0, makeSnapshot(0));
		expect(tl.findNode(0, "Player")).toBeNull();
	});

	test("findNodes returns all matches", () => {
		const tl = new Timeline();
		tl.record(0, 0, makeSnapshot(0, [makeCoin(2), makeCoin(3), makeCoin(4)]));
		expect(tl.findNodes(0, "Coin")).toHaveLength(3);
	});

	test("countNodes counts matches", () => {
		const tl = new Timeline();
		tl.record(0, 0, makeSnapshot(0, [makeCoin(2), makeCoin(3)]));
		expect(tl.countNodes(0, "Coin")).toBe(2);
		expect(tl.countNodes(0, "Player")).toBe(0);
	});

	test("range returns entries in frame range", () => {
		const tl = new Timeline();
		tl.record(0, 0, makeSnapshot(0));
		tl.record(60, 1, makeSnapshot(0));
		tl.record(120, 2, makeSnapshot(0));
		tl.record(180, 3, makeSnapshot(0));

		const range = tl.range(60, 120);
		expect(range).toHaveLength(2);
		expect(range[0]?.frame).toBe(60);
		expect(range[1]?.frame).toBe(120);
	});

	test("first and last", () => {
		const tl = new Timeline();
		expect(tl.first).toBeNull();
		expect(tl.last).toBeNull();

		tl.record(0, 0, makeSnapshot(0));
		tl.record(60, 1, makeSnapshot(1));

		expect(tl.first?.frame).toBe(0);
		expect(tl.last?.frame).toBe(60);
	});
});
