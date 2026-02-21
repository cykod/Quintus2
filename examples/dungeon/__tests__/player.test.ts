import { InputScript } from "@quintus/test";
import { describe, expect, test } from "vitest";
import { runLevel1 } from "./helpers.js";

type SnapshotNode = Record<string, unknown> & {
	position: { x: number; y: number };
};

describe("Dungeon — Player Movement", () => {
	test("player moves right when right is held", async () => {
		const result = await runLevel1(InputScript.create().press("right", 60));
		const start = result.timeline.findNode(0, "Player") as SnapshotNode;
		const end = result.timeline.findNode(60, "Player") as SnapshotNode;

		expect(start).not.toBeNull();
		expect(end).not.toBeNull();
		expect(end.position.x).toBeGreaterThan(start.position.x);

		result.game.stop();
	});

	test("player moves left when left is held", async () => {
		const result = await runLevel1(InputScript.create().press("left", 60));
		const start = result.timeline.findNode(0, "Player") as SnapshotNode;
		const end = result.timeline.findNode(60, "Player") as SnapshotNode;

		expect(start).not.toBeNull();
		expect(end).not.toBeNull();
		expect(end.position.x).toBeLessThan(start.position.x);

		result.game.stop();
	});

	test("player moves up when up is held", async () => {
		const result = await runLevel1(InputScript.create().press("up", 60));
		const start = result.timeline.findNode(0, "Player") as SnapshotNode;
		const end = result.timeline.findNode(60, "Player") as SnapshotNode;

		expect(start).not.toBeNull();
		expect(end).not.toBeNull();
		expect(end.position.y).toBeLessThan(start.position.y);

		result.game.stop();
	});

	test("player moves down when down is held", async () => {
		const result = await runLevel1(InputScript.create().press("down", 60));
		const start = result.timeline.findNode(0, "Player") as SnapshotNode;
		const end = result.timeline.findNode(60, "Player") as SnapshotNode;

		expect(start).not.toBeNull();
		expect(end).not.toBeNull();
		expect(end.position.y).toBeGreaterThan(start.position.y);

		result.game.stop();
	});

	test("diagonal movement is normalized", async () => {
		// Straight right for 20 frames
		const straight = await runLevel1(InputScript.create().press("right", 20));
		// Diagonal right+down for 20 frames using hold()
		const diag = await runLevel1(
			InputScript.create().hold("down").press("right", 20).release("down"),
		);

		const straightStart = straight.timeline.findNode(0, "Player") as SnapshotNode;
		const straightEnd = straight.timeline.findNode(20, "Player") as SnapshotNode;
		const diagStart = diag.timeline.findNode(0, "Player") as SnapshotNode;
		const diagEnd = diag.timeline.findNode(20, "Player") as SnapshotNode;

		const straightDist = Math.abs(straightEnd.position.x - straightStart.position.x);
		const diagDist = Math.abs(diagEnd.position.x - diagStart.position.x);

		// Diagonal X distance should be less than straight X distance (normalized by 1/sqrt(2))
		expect(diagDist).toBeLessThan(straightDist);

		straight.game.stop();
		diag.game.stop();
	});

	test("player stops when no input", async () => {
		const result = await runLevel1(InputScript.create().press("right", 30).wait(30));
		const frame30 = result.timeline.findNode(30, "Player") as SnapshotNode;
		const frame60 = result.timeline.findNode(60, "Player") as SnapshotNode;

		// Position should not change after releasing input
		expect(frame60.position.x).toBeCloseTo(frame30.position.x, 0);

		result.game.stop();
	});

	test("player is blocked by wall collision", async () => {
		// Move left into the wall boundary for extended time
		const result = await runLevel1(InputScript.create().press("left", 120));
		const player = result.timeline.findNode(120, "Player") as SnapshotNode;

		// Should not have gone past the wall (left wall is around x=16-32)
		expect(player.position.x).toBeGreaterThan(10);

		result.game.stop();
	});
});
