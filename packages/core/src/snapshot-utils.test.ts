import { describe, expect, test } from "vitest";
import type { NodeSnapshot } from "./snapshot-types.js";
import { countInSnapshot, findAllInSnapshot, findInSnapshot } from "./snapshot-utils.js";

function makeTree(): NodeSnapshot {
	return {
		id: 0,
		type: "Scene",
		name: "Level1",
		tags: [],
		children: [
			{
				id: 1,
				type: "Player",
				name: "Player",
				tags: ["player"],
				children: [],
			},
			{
				id: 2,
				type: "Coin",
				name: "Coin",
				tags: ["coin", "collectible"],
				children: [],
			},
			{
				id: 3,
				type: "Coin",
				name: "Coin",
				tags: ["coin", "collectible"],
				children: [],
			},
			{
				id: 4,
				type: "PatrolEnemy",
				name: "PatrolEnemy",
				tags: ["enemy"],
				children: [
					{
						id: 5,
						type: "CollisionShape",
						name: "CollisionShape",
						tags: [],
						children: [],
					},
				],
			},
		],
	};
}

describe("findInSnapshot", () => {
	test("finds by type", () => {
		const result = findInSnapshot(makeTree(), "Player");
		expect(result).not.toBeNull();
		expect(result!.id).toBe(1);
	});

	test("finds by name", () => {
		const result = findInSnapshot(makeTree(), "Level1");
		expect(result).not.toBeNull();
		expect(result!.id).toBe(0);
	});

	test("finds by tag", () => {
		const result = findInSnapshot(makeTree(), "enemy");
		expect(result).not.toBeNull();
		expect(result!.id).toBe(4);
	});

	test("finds nested children", () => {
		const result = findInSnapshot(makeTree(), "CollisionShape");
		expect(result).not.toBeNull();
		expect(result!.id).toBe(5);
	});

	test("returns null when not found", () => {
		expect(findInSnapshot(makeTree(), "NonExistent")).toBeNull();
	});

	test("returns first match", () => {
		const result = findInSnapshot(makeTree(), "Coin");
		expect(result).not.toBeNull();
		expect(result!.id).toBe(2);
	});
});

describe("findAllInSnapshot", () => {
	test("finds all by type", () => {
		const results = findAllInSnapshot(makeTree(), "Coin");
		expect(results).toHaveLength(2);
	});

	test("finds all by tag", () => {
		const results = findAllInSnapshot(makeTree(), "collectible");
		expect(results).toHaveLength(2);
	});

	test("returns empty array when not found", () => {
		expect(findAllInSnapshot(makeTree(), "NonExistent")).toHaveLength(0);
	});
});

describe("countInSnapshot", () => {
	test("counts by type", () => {
		expect(countInSnapshot(makeTree(), "Coin")).toBe(2);
	});

	test("counts by tag", () => {
		expect(countInSnapshot(makeTree(), "enemy")).toBe(1);
	});

	test("counts zero when not found", () => {
		expect(countInSnapshot(makeTree(), "NonExistent")).toBe(0);
	});

	test("counts root if it matches", () => {
		expect(countInSnapshot(makeTree(), "Scene")).toBe(1);
	});
});
