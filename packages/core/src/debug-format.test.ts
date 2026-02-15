import { describe, expect, it } from "vitest";
import { formatEvents, formatTree } from "./debug-format.js";
import type { DebugEvent } from "./debug-log.js";
import type { NodeSnapshot } from "./snapshot-types.js";

describe("formatTree", () => {
	it("formats a single node", () => {
		const snap: NodeSnapshot = {
			id: 0,
			type: "Scene",
			name: "Scene",
			tags: [],
			children: [],
		};
		const result = formatTree(snap);
		expect(result).toBe("[0] Scene");
	});

	it("formats tree with connectors", () => {
		const snap: NodeSnapshot = {
			id: 0,
			type: "Scene",
			name: "Scene",
			tags: [],
			children: [
				{ id: 1, type: "Node2D", name: "Player", tags: ["player"], children: [] },
				{ id: 2, type: "Node2D", name: "Enemy", tags: [], children: [] },
			],
		};
		const result = formatTree(snap);
		expect(result).toContain('├── [1] Node2D "Player"');
		expect(result).toContain("[player]");
		expect(result).toContain('└── [2] Node2D "Enemy"');
	});

	it("shows position for Node2DSnapshot-like data", () => {
		const snap: NodeSnapshot & { position: { x: number; y: number } } = {
			id: 1,
			type: "Player",
			name: "Player",
			tags: [],
			children: [],
			position: { x: 100.5, y: 200.3 },
		};
		const result = formatTree(snap);
		expect(result).toContain("(101, 200)");
	});

	it("shows velocity for ActorSnapshot-like data", () => {
		const snap = {
			id: 1,
			type: "Player",
			name: "Player",
			tags: [],
			children: [],
			position: { x: 100, y: 200 },
			velocity: { x: 150, y: -300 },
			isOnFloor: true,
		};
		const result = formatTree(snap as unknown as NodeSnapshot);
		expect(result).toContain("vel=(150,-300)");
		expect(result).toContain("onFloor");
	});

	it("shows camera info for CameraSnapshot-like data", () => {
		const snap = {
			id: 5,
			type: "Camera",
			name: "Camera",
			tags: [],
			children: [],
			position: { x: 200, y: 150 },
			zoom: 2,
			smoothing: 0.15,
			followTarget: "Player",
			bounds: { x: 0, y: 0, width: 640, height: 240 },
			isShaking: false,
			deadZone: null,
			pixelPerfectZoom: false,
		};
		const result = formatTree(snap as unknown as NodeSnapshot);
		expect(result).toContain("(200, 150)");
		expect(result).toContain("zoom=2");
		expect(result).toContain("follow=Player");
		expect(result).toContain("smooth=0.15");
		expect(result).toContain("bounds=640x240");
		expect(result).not.toContain("SHAKING");
	});

	it("shows SHAKING when camera is shaking", () => {
		const snap = {
			id: 5,
			type: "Camera",
			name: "Camera",
			tags: [],
			children: [],
			position: { x: 100, y: 50 },
			zoom: 1,
			smoothing: 0,
			followTarget: null,
			bounds: null,
			isShaking: true,
			deadZone: null,
			pixelPerfectZoom: false,
		};
		const result = formatTree(snap as unknown as NodeSnapshot);
		expect(result).toContain("SHAKING");
		expect(result).not.toContain("follow=");
		expect(result).not.toContain("smooth=");
		expect(result).not.toContain("bounds=");
	});
});

describe("formatEvents", () => {
	it("returns '(no events)' for empty array", () => {
		expect(formatEvents([])).toBe("(no events)");
	});

	it("formats events with aligned columns", () => {
		const events: DebugEvent[] = [
			{ frame: 1, time: 0.016, category: "physics", message: "collision detected" },
			{ frame: 10, time: 0.166, category: "lifecycle", message: "Player.onReady" },
		];
		const result = formatEvents(events);
		const lines = result.split("\n");

		expect(lines.length).toBe(2);
		expect(lines[0]).toContain("[f: 1 t:0.016s]");
		expect(lines[0]).toContain("physics");
		expect(lines[0]).toContain("collision detected");
		expect(lines[1]).toContain("[f:10 t:0.166s]");
		expect(lines[1]).toContain("lifecycle");
	});

	it("includes data as key=value pairs", () => {
		const events: DebugEvent[] = [
			{
				frame: 5,
				time: 0.083,
				category: "physics",
				message: "collision",
				data: { depth: 2.5, normal: { x: 0, y: -1 } },
			},
		];
		const result = formatEvents(events);
		expect(result).toContain("depth=2.5");
		expect(result).toContain("normal=(0,-1)");
	});
});
