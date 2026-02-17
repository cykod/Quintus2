import type { NodeSnapshot } from "@quintus/core";
import { describe, expect, test } from "vitest";
import { diffSnapshots, formatDiffs } from "./snapshot-diff.js";

function makeNode(overrides?: Partial<NodeSnapshot>): NodeSnapshot {
	return {
		id: 0,
		type: "Scene",
		name: "TestScene",
		tags: [],
		children: [],
		...overrides,
	};
}

function makeNode2D(
	overrides?: Record<string, unknown>,
): NodeSnapshot & { position: { x: number; y: number } } {
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
	} as NodeSnapshot & { position: { x: number; y: number } };
}

describe("diffSnapshots", () => {
	test("returns empty for identical trees", () => {
		const a = makeNode({ children: [makeNode2D()] });
		const b = makeNode({ children: [makeNode2D()] });
		expect(diffSnapshots(a, b)).toEqual([]);
	});

	test("detects type change", () => {
		const a = makeNode({ type: "Scene" });
		const b = makeNode({ type: "Level" });
		const diffs = diffSnapshots(a, b);
		expect(diffs).toHaveLength(1);
		expect(diffs[0]?.path).toBe("root.type");
	});

	test("detects position change", () => {
		const a = makeNode({ children: [makeNode2D({ position: { x: 100, y: 200 } })] });
		const b = makeNode({ children: [makeNode2D({ position: { x: 150, y: 200 } })] });
		const diffs = diffSnapshots(a, b);
		expect(diffs.some((d) => d.path.includes("position.x"))).toBe(true);
	});

	test("detects added child", () => {
		const a = makeNode({ children: [] });
		const b = makeNode({
			children: [makeNode2D()],
		});
		const diffs = diffSnapshots(a, b);
		expect(diffs).toHaveLength(1);
		expect(diffs[0]?.path).toBe("root.children[0]");
		expect(diffs[0]?.a).toBeUndefined();
	});

	test("detects removed child", () => {
		const a = makeNode({
			children: [makeNode2D()],
		});
		const b = makeNode({ children: [] });
		const diffs = diffSnapshots(a, b);
		expect(diffs).toHaveLength(1);
		expect(diffs[0]?.path).toBe("root.children[0]");
		expect(diffs[0]?.b).toBeUndefined();
	});

	test("respects positionTolerance", () => {
		const a = makeNode({ children: [makeNode2D({ position: { x: 100, y: 200 } })] });
		const b = makeNode({ children: [makeNode2D({ position: { x: 100.5, y: 200 } })] });

		// Without tolerance — should detect diff
		const diffs1 = diffSnapshots(a, b);
		expect(diffs1.some((d) => d.path.includes("position.x"))).toBe(true);

		// With tolerance — should ignore
		const diffs2 = diffSnapshots(a, b, { positionTolerance: 1.0 });
		expect(diffs2.some((d) => d.path.includes("position.x"))).toBe(false);
	});

	test("respects maxDiffs", () => {
		const a = makeNode({
			children: [
				makeNode2D({ position: { x: 1, y: 1 }, scale: { x: 2, y: 2 } }),
				makeNode2D({ id: 2, position: { x: 3, y: 3 } }),
			],
		});
		const b = makeNode({
			children: [
				makeNode2D({ position: { x: 10, y: 10 }, scale: { x: 20, y: 20 } }),
				makeNode2D({ id: 2, position: { x: 30, y: 30 } }),
			],
		});
		const diffs = diffSnapshots(a, b, { maxDiffs: 2 });
		expect(diffs).toHaveLength(2);
	});

	test("respects ignorePaths", () => {
		const a = makeNode({ type: "A", name: "X" });
		const b = makeNode({ type: "B", name: "Y" });
		const diffs = diffSnapshots(a, b, { ignorePaths: ["root.type"] });
		expect(diffs.some((d) => d.path === "root.type")).toBe(false);
		expect(diffs.some((d) => d.path === "root.name")).toBe(true);
	});

	test("detects tag changes", () => {
		const a = makeNode({ tags: ["player", "alive"] });
		const b = makeNode({ tags: ["player", "dead"] });
		const diffs = diffSnapshots(a, b);
		expect(diffs.some((d) => d.path === "root.tags")).toBe(true);
	});

	test("compares all enumerable properties generically", () => {
		const a = makeNode({
			children: [
				makeNode2D({ velocity: { x: 0, y: 0 }, isOnFloor: true } as Record<string, unknown>),
			],
		});
		const b = makeNode({
			children: [
				makeNode2D({ velocity: { x: 10, y: 0 }, isOnFloor: false } as Record<string, unknown>),
			],
		});
		const diffs = diffSnapshots(a, b);
		expect(diffs.some((d) => d.path.includes("velocity.x"))).toBe(true);
		expect(diffs.some((d) => d.path.includes("isOnFloor"))).toBe(true);
	});
});

describe("formatDiffs", () => {
	test("returns 'identical' message for empty diffs", () => {
		expect(formatDiffs([])).toBe("Snapshots are identical.");
	});

	test("produces readable output", () => {
		const diffs = [
			{ path: "root.children[0].position.x", a: 100, b: 150 },
			{ path: "root.children[1]", a: { type: "Coin", name: "Coin" }, b: undefined },
		];
		const output = formatDiffs(diffs);
		expect(output).toContain("2 difference(s)");
		expect(output).toContain("root.children[0].position.x");
		expect(output).toContain("100");
		expect(output).toContain("150");
	});
});
