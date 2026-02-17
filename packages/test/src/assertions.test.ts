import type { Node2DSnapshot, NodeSnapshot } from "@quintus/core";
import { describe, expect, test } from "vitest";
import {
	assertContains,
	assertCountDecreased,
	assertDestroyedByFrame,
	assertExistsAtFrame,
	assertHasTag,
	assertMovedRight,
	assertNodeCount,
	assertNotContains,
	assertNotOnFloor,
	assertOnFloor,
	assertWithinDistance,
	isActorSnapshot,
	isNode2DSnapshot,
} from "./assertions.js";
import { Timeline } from "./timeline.js";

function makeNode2D(overrides?: Partial<Node2DSnapshot>): Node2DSnapshot {
	return {
		id: 1,
		type: "Player",
		name: "Player",
		tags: ["player"],
		children: [],
		position: { x: 100, y: 200 },
		rotation: 0,
		scale: { x: 1, y: 1 },
		globalPosition: { x: 100, y: 200 },
		visible: true,
		zIndex: 0,
		alpha: 1,
		renderFixed: false,
		...overrides,
	};
}

function makeActor(overrides?: Record<string, unknown>): NodeSnapshot {
	return {
		...makeNode2D(),
		velocity: { x: 0, y: 0 },
		gravity: 800,
		isOnFloor: true,
		isOnWall: false,
		isOnCeiling: false,
		collisionGroup: "player",
		bodyType: "actor",
		...overrides,
	} as unknown as NodeSnapshot;
}

function makeScene(children: NodeSnapshot[] = []): NodeSnapshot {
	return { id: 0, type: "Scene", name: "TestScene", tags: [], children };
}

describe("type guards", () => {
	test("isNode2DSnapshot", () => {
		expect(isNode2DSnapshot(makeNode2D())).toBe(true);
		expect(isNode2DSnapshot(makeScene())).toBe(false);
	});

	test("isActorSnapshot", () => {
		expect(isActorSnapshot(makeActor())).toBe(true);
		expect(isActorSnapshot(makeNode2D())).toBe(false);
	});
});

describe("spatial assertions", () => {
	test("assertMovedRight passes when moved", () => {
		const node = makeNode2D({ position: { x: 150, y: 200 } });
		expect(() => assertMovedRight(node, 100)).not.toThrow();
	});

	test("assertMovedRight fails when not moved", () => {
		const node = makeNode2D({ position: { x: 50, y: 200 } });
		expect(() => assertMovedRight(node, 100)).toThrow("move right");
	});

	test("assertMovedRight fails for non-Node2D", () => {
		expect(() => assertMovedRight(makeScene(), 0)).toThrow("not a Node2D");
	});

	test("assertOnFloor passes for grounded actor", () => {
		expect(() => assertOnFloor(makeActor({ isOnFloor: true }))).not.toThrow();
	});

	test("assertOnFloor fails for airborne actor", () => {
		expect(() => assertOnFloor(makeActor({ isOnFloor: false }))).toThrow("isOnFloor=false");
	});

	test("assertNotOnFloor passes for airborne actor", () => {
		expect(() => assertNotOnFloor(makeActor({ isOnFloor: false }))).not.toThrow();
	});

	test("assertNotOnFloor fails for grounded actor", () => {
		expect(() => assertNotOnFloor(makeActor({ isOnFloor: true }))).toThrow("isOnFloor=true");
	});

	test("assertWithinDistance passes when close", () => {
		const a = makeNode2D({ position: { x: 100, y: 100 } });
		const b = makeNode2D({ position: { x: 110, y: 100 } });
		expect(() => assertWithinDistance(a, b, 20)).not.toThrow();
	});

	test("assertWithinDistance fails when far", () => {
		const a = makeNode2D({ position: { x: 0, y: 0 } });
		const b = makeNode2D({ position: { x: 100, y: 100 } });
		expect(() => assertWithinDistance(a, b, 10)).toThrow("distance is");
	});
});

describe("tag assertions", () => {
	test("assertHasTag passes when tag present", () => {
		expect(() => assertHasTag(makeActor(), "player")).not.toThrow();
	});

	test("assertHasTag fails when tag missing", () => {
		expect(() => assertHasTag(makeActor(), "enemy")).toThrow('tag "enemy"');
	});
});

describe("scene assertions", () => {
	test("assertContains finds node by type", () => {
		const scene = makeScene([makeActor()]);
		expect(() => assertContains(scene, "Player")).not.toThrow();
	});

	test("assertContains throws when missing", () => {
		const scene = makeScene([]);
		expect(() => assertContains(scene, "Player")).toThrow('"Player"');
	});

	test("assertNotContains passes when absent", () => {
		const scene = makeScene([]);
		expect(() => assertNotContains(scene, "Player")).not.toThrow();
	});

	test("assertNotContains fails when present", () => {
		const scene = makeScene([makeActor()]);
		expect(() => assertNotContains(scene, "Player")).toThrow("NOT contain");
	});

	test("assertNodeCount passes on exact match", () => {
		const coin1: NodeSnapshot = { id: 2, type: "Coin", name: "Coin", tags: ["coin"], children: [] };
		const coin2: NodeSnapshot = { id: 3, type: "Coin", name: "Coin", tags: ["coin"], children: [] };
		const scene = makeScene([coin1, coin2]);
		expect(() => assertNodeCount(scene, "Coin", 2)).not.toThrow();
	});

	test("assertNodeCount fails on mismatch", () => {
		const scene = makeScene([]);
		expect(() => assertNodeCount(scene, "Coin", 3)).toThrow("Expected 3");
	});
});

describe("timeline assertions", () => {
	function makeTimeline(): Timeline {
		const tl = new Timeline();
		const coin: NodeSnapshot = { id: 2, type: "Coin", name: "Coin", tags: ["coin"], children: [] };
		tl.record(0, 0, makeScene([makeActor(), coin, { ...coin, id: 3 }]));
		tl.record(60, 1, makeScene([makeActor()])); // Coins gone at frame 60
		return tl;
	}

	test("assertExistsAtFrame passes when found", () => {
		expect(() => assertExistsAtFrame(makeTimeline(), 0, "Player")).not.toThrow();
	});

	test("assertExistsAtFrame fails when not found", () => {
		expect(() => assertExistsAtFrame(makeTimeline(), 60, "NonExistent")).toThrow("not found");
	});

	test("assertDestroyedByFrame passes when gone", () => {
		expect(() => assertDestroyedByFrame(makeTimeline(), 60, "Coin")).not.toThrow();
	});

	test("assertDestroyedByFrame fails when still exists", () => {
		expect(() => assertDestroyedByFrame(makeTimeline(), 0, "Coin")).toThrow("still exists");
	});

	test("assertCountDecreased passes when count drops", () => {
		expect(() => assertCountDecreased(makeTimeline(), "Coin", 0, 60)).not.toThrow();
	});

	test("assertCountDecreased fails when count stays same or rises", () => {
		expect(() => assertCountDecreased(makeTimeline(), "Player", 0, 60)).toThrow("went from");
	});
});
