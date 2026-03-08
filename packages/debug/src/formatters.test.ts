import type { NodeSnapshot } from "@quintus/core";
import { describe, expect, it } from "vitest";
import {
	formatJumpAnalysis,
	formatLayout,
	formatNearby,
	formatPhysics,
	formatQueryResults,
	formatTrack,
} from "./formatters.js";
import type { JumpAnalysisResult, NearbyResult, TrackResult } from "./types.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSnap(overrides: Partial<NodeSnapshot> & Record<string, unknown> = {}): NodeSnapshot {
	return {
		id: 1,
		type: "Node2D",
		name: "Node2D",
		tags: [],
		children: [],
		...overrides,
	} as NodeSnapshot;
}

// ── formatLayout ────────────────────────────────────────────────────────────

describe("formatLayout", () => {
	it("returns '(no spatial nodes)' when no nodes have position", () => {
		const snap = makeSnap({ position: undefined });
		expect(formatLayout(snap)).toBe("(no spatial nodes)");
	});

	it("shows nodes with position and indentation", () => {
		const snap = makeSnap({
			type: "Scene",
			name: "Scene",
			position: { x: 0, y: 0 },
			children: [
				makeSnap({
					id: 2,
					type: "Actor",
					name: "Player",
					position: { x: 100, y: 200 },
					velocity: { x: 50, y: -100 },
					isOnFloor: true,
				}),
			],
		});
		const result = formatLayout(snap);
		expect(result).toContain("Scene  pos=(0.0,0.0)");
		expect(result).toContain('  Actor "Player"  pos=(100.0,200.0)  vel=(50.0,-100.0)  [floor]');
	});

	it("shows collision group and wall/ceiling flags", () => {
		const snap = makeSnap({
			position: { x: 10, y: 20 },
			collisionGroup: "enemies",
			isOnWall: true,
			isOnCeiling: true,
		});
		const result = formatLayout(snap);
		expect(result).toContain("group=enemies");
		expect(result).toContain("[wall]");
		expect(result).toContain("[ceiling]");
	});
});

// ── formatPhysics ───────────────────────────────────────────────────────────

describe("formatPhysics", () => {
	it("shows basic physics info", () => {
		const snap = makeSnap({
			type: "Actor",
			name: "Player",
			tags: ["player"],
			position: { x: 100.5, y: 200.3 },
			globalPosition: { x: 100.5, y: 200.3 },
			velocity: { x: 50, y: -300 },
			gravity: 980,
			isOnFloor: true,
			isOnWall: false,
			isOnCeiling: false,
		});
		const result = formatPhysics(snap);
		expect(result).toContain('Node: Actor "Player"');
		expect(result).toContain("Position: (100.50, 200.30)");
		expect(result).toContain("Global:   (100.50, 200.30)");
		expect(result).toContain("Velocity: (50.00, -300.00)");
		expect(result).toContain("Gravity:  980");
		expect(result).toContain("OnFloor:  true");
		expect(result).toContain("Tags:     player");
	});

	it("shows rotation in degrees for 2D nodes", () => {
		const snap = makeSnap({
			position: { x: 0, y: 0 },
			rotation: Math.PI / 4,
		});
		const result = formatPhysics(snap);
		expect(result).toContain("Rotation: 45.0 deg");
	});

	it("shows visible: false", () => {
		const snap = makeSnap({
			position: { x: 0, y: 0 },
			visible: false,
		});
		const result = formatPhysics(snap);
		expect(result).toContain("Visible:  false");
	});

	it("omits visible when true", () => {
		const snap = makeSnap({
			position: { x: 0, y: 0 },
			visible: true,
		});
		const result = formatPhysics(snap);
		expect(result).not.toContain("Visible");
	});
});

// ── formatQueryResults ──────────────────────────────────────────────────────

describe("formatQueryResults", () => {
	it("returns no-match message for empty results", () => {
		expect(formatQueryResults([], "Enemy")).toBe("No matches for: Enemy");
	});

	it("formats results as one-liners", () => {
		const results = [
			makeSnap({ type: "Actor", name: "Player", position: { x: 100, y: 200 }, tags: ["player"] }),
			makeSnap({ id: 2, type: "Actor", name: "Enemy", position: { x: 300.5, y: 200.7 } }),
		];
		const result = formatQueryResults(results, "Actor");
		expect(result).toContain('Actor "Player" (100.0,200.0) [player]');
		expect(result).toContain('Actor "Enemy" (300.5,200.7)');
	});
});

// ── formatTrack ─────────────────────────────────────────────────────────────

describe("formatTrack", () => {
	it("formats tracking data as a table", () => {
		const data: TrackResult = {
			target: "Player",
			frames: [
				{
					step: 1,
					frame: 10,
					x: 100,
					y: 200,
					vx: 50,
					vy: 0,
					onFloor: true,
					onWall: false,
					onCeiling: false,
					lost: false,
				},
				{
					step: 2,
					frame: 11,
					x: 100.83,
					y: 200,
					vx: 50,
					vy: 0,
					onFloor: true,
					onWall: false,
					onCeiling: false,
					lost: false,
				},
			],
		};
		const result = formatTrack(data);
		expect(result).toContain("Frame  X");
		expect(result).toContain("---");
		expect(result).toContain("10");
		expect(result).toContain("100.00");
		expect(result).toContain("true");
	});

	it("shows node-lost message", () => {
		const data: TrackResult = {
			target: "Player",
			frames: [
				{
					step: 3,
					frame: 12,
					x: 0,
					y: 0,
					vx: 0,
					vy: 0,
					onFloor: false,
					onWall: false,
					onCeiling: false,
					lost: true,
				},
			],
		};
		const result = formatTrack(data);
		expect(result).toContain("(node lost at step 3)");
	});
});

// ── formatJumpAnalysis ──────────────────────────────────────────────────────

describe("formatJumpAnalysis", () => {
	it("formats jump analysis results", () => {
		const data: JumpAnalysisResult = {
			startY: 200,
			jumpVy: -400,
			gravity: 980,
			jumpHeight: 81.63,
			apexFrame: 24,
			totalFrames: 49,
			airTimeSec: 0.817,
			landed: true,
			landFrame: 59,
			theoreticalHeight: 81.63,
			theoreticalAirFrames: 48.98,
		};
		const result = formatJumpAnalysis(data, "Player");
		expect(result).toContain("=== Jump Analysis: Player ===");
		expect(result).toContain("Start Y:       200.00");
		expect(result).toContain("Jump Vy:       -400.00");
		expect(result).toContain("Jump Height:   81.63 px");
		expect(result).toContain("Landed:        yes (frame 59)");
		expect(result).toContain("Efficiency:");
	});

	it("shows 'still airborne' when not landed", () => {
		const data: JumpAnalysisResult = {
			startY: 200,
			jumpVy: -400,
			gravity: 980,
			jumpHeight: 50,
			apexFrame: 24,
			totalFrames: 300,
			airTimeSec: 5.0,
			landed: false,
			landFrame: 0,
			theoreticalHeight: 81.63,
			theoreticalAirFrames: 48.98,
		};
		const result = formatJumpAnalysis(data, "Player");
		expect(result).toContain("Landed:        no (still airborne)");
	});
});

// ── formatNearby ────────────────────────────────────────────────────────────

describe("formatNearby", () => {
	it("shows no-nodes message when empty", () => {
		const data: NearbyResult = {
			targetName: "Player",
			targetPos: "(100.0,200.0)",
			radius: 100,
			nodes: [],
		};
		expect(formatNearby(data)).toBe("No nodes within 100 of Player at (100.0,200.0)");
	});

	it("formats nearby nodes with header", () => {
		const data: NearbyResult = {
			targetName: "Player",
			targetPos: "(100.0,200.0)",
			radius: 150,
			nodes: [
				{ dist: 50, line: 'Enemy "Goblin"  pos=(150.0,200.0)  dist=50.0' },
				{ dist: 100, line: 'Coin "coin1"  pos=(200.0,200.0)  dist=100.0' },
			],
		};
		const result = formatNearby(data);
		expect(result).toContain("Nearby Player (100.0,200.0) within 150:");
		expect(result).toContain("  Enemy");
		expect(result).toContain("  Coin");
	});
});
