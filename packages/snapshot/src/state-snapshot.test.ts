import type { NodeSnapshot } from "@quintus/core";
import { describe, expect, test } from "vitest";
import { captureState } from "./state-snapshot.js";

function makeScene(): { serialize(): NodeSnapshot } {
	return {
		serialize: () => ({
			id: 0,
			type: "Scene",
			name: "TestScene",
			tags: [],
			children: [{ id: 1, type: "Player", name: "Player", tags: ["player"], children: [] }],
		}),
	};
}

describe("captureState", () => {
	test("captures full state", () => {
		const game = {
			fixedFrame: 100,
			elapsed: 1.6667,
			random: { seed: 42, state: 12345 },
			currentScene: makeScene(),
		};

		const snap = captureState(game);
		expect(snap).not.toBeNull();
		expect(snap?.frame).toBe(100);
		expect(snap?.time).toBe(1.6667);
		expect(snap?.seed).toBe(42);
		expect(snap?.rngState).toBe(12345);
		expect(snap?.tree.type).toBe("Scene");
		expect(snap?.tree.children).toHaveLength(1);
	});

	test("returns null when no scene", () => {
		const game = {
			fixedFrame: 0,
			elapsed: 0,
			random: { seed: 42, state: 0 },
			currentScene: null,
		};

		expect(captureState(game)).toBeNull();
	});
});
