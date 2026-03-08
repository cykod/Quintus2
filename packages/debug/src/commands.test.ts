import type { DebugBridge, NodeSnapshot } from "@quintus/core";
import { describe, expect, it, vi } from "vitest";
import { executeCommand } from "./commands.js";

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

function createMockBridge(overrides: Partial<DebugBridge> = {}): DebugBridge {
	return {
		paused: true,
		frame: 0,
		elapsed: 0,
		pause: vi.fn(),
		resume: vi.fn(),
		step: vi.fn(() => null),
		tree: vi.fn(() => makeSnap({ type: "Scene", name: "Scene" })),
		query: vi.fn(() => []),
		inspect: vi.fn(() => null),
		screenshot: vi.fn(() => "data:image/png;base64,"),
		listActions: vi.fn(() => []),
		press: vi.fn(),
		release: vi.fn(),
		releaseAll: vi.fn(),
		pressAndStep: vi.fn(() => null),
		run: vi.fn(() => []),
		events: vi.fn(() => []),
		peekEvents: vi.fn(() => []),
		clearEvents: vi.fn(),
		log: vi.fn(),
		click: vi.fn(() => false),
		clickButton: vi.fn(() => false),
		switchScene: vi.fn(),
		listScenes: vi.fn(() => []),
		destroy: vi.fn(() => 0),
		setMousePosition: vi.fn(),
		getMousePosition: vi.fn(() => ({ x: 0, y: 0 })),
		track: vi.fn(() => ({ target: "Player", frames: [] })),
		jumpAnalysis: vi.fn(() => "Node not found"),
		moveTo: vi.fn(() => "Node not found"),
		nearby: vi.fn(() => "Node not found"),
		...overrides,
	};
}

describe("executeCommand", () => {
	it("status returns frame info", () => {
		const bridge = createMockBridge();
		const result = executeCommand(bridge, "status");
		expect(result.ok).toBe(true);
		expect(result.output).toContain("Frame: 0");
		expect(result.output).toContain("Paused: true");
	});

	it("tree formats the scene tree", () => {
		const bridge = createMockBridge();
		const result = executeCommand(bridge, "tree");
		expect(result.ok).toBe(true);
		expect(result.output).toContain("Scene");
	});

	it("tree returns (no scene) when null", () => {
		const bridge = createMockBridge({ tree: vi.fn(() => null) });
		const result = executeCommand(bridge, "tree");
		expect(result.output).toBe("(no scene)");
	});

	it("layout formats spatial overview", () => {
		const snap = makeSnap({
			type: "Scene",
			name: "Scene",
			position: { x: 0, y: 0 },
		});
		const bridge = createMockBridge({ tree: vi.fn(() => snap) });
		const result = executeCommand(bridge, "layout");
		expect(result.ok).toBe(true);
		expect(result.output).toContain("Scene");
	});

	it("inspect returns node JSON", () => {
		const snap = makeSnap({ name: "Player", position: { x: 100, y: 200 } });
		const bridge = createMockBridge({ inspect: vi.fn(() => snap) });
		const result = executeCommand(bridge, "inspect", ["Player"]);
		expect(result.ok).toBe(true);
		expect(JSON.parse(result.output).name).toBe("Player");
	});

	it("inspect returns error for missing node", () => {
		const bridge = createMockBridge();
		const result = executeCommand(bridge, "inspect", ["Missing"]);
		expect(result.ok).toBe(false);
		expect(result.output).toContain("Node not found");
	});

	it("inspect without arg returns error", () => {
		const bridge = createMockBridge();
		const result = executeCommand(bridge, "inspect");
		expect(result.ok).toBe(false);
		expect(result.output).toContain("Usage");
	});

	it("query formats results", () => {
		const results = [makeSnap({ type: "Actor", name: "Player", position: { x: 10, y: 20 } })];
		const bridge = createMockBridge({ query: vi.fn(() => results) });
		const result = executeCommand(bridge, "query", ["Actor"]);
		expect(result.ok).toBe(true);
		expect(result.output).toContain("Actor");
	});

	it("physics formats node physics", () => {
		const snap = makeSnap({
			type: "Actor",
			name: "Player",
			position: { x: 100, y: 200 },
			velocity: { x: 0, y: 0 },
		});
		const bridge = createMockBridge({ inspect: vi.fn(() => snap) });
		const result = executeCommand(bridge, "physics", ["Player"]);
		expect(result.ok).toBe(true);
		expect(result.output).toContain('Node: Actor "Player"');
	});

	it("step advances frames", () => {
		const bridge = createMockBridge();
		const result = executeCommand(bridge, "step", ["10"]);
		expect(result.ok).toBe(true);
		expect(bridge.step).toHaveBeenCalledWith(10);
		expect(result.output).toContain("Stepped 10 frame(s)");
	});

	it("step defaults to 1", () => {
		const bridge = createMockBridge();
		executeCommand(bridge, "step");
		expect(bridge.step).toHaveBeenCalledWith(1);
	});

	it("pause calls bridge.pause", () => {
		const bridge = createMockBridge();
		const result = executeCommand(bridge, "pause");
		expect(result.ok).toBe(true);
		expect(bridge.pause).toHaveBeenCalled();
	});

	it("resume calls bridge.resume", () => {
		const bridge = createMockBridge();
		const result = executeCommand(bridge, "resume");
		expect(result.ok).toBe(true);
		expect(bridge.resume).toHaveBeenCalled();
	});

	it("press calls bridge.press", () => {
		const bridge = createMockBridge();
		const result = executeCommand(bridge, "press", ["jump"]);
		expect(result.ok).toBe(true);
		expect(bridge.press).toHaveBeenCalledWith("jump");
	});

	it("release calls bridge.release", () => {
		const bridge = createMockBridge();
		executeCommand(bridge, "release", ["jump"]);
		expect(bridge.release).toHaveBeenCalledWith("jump");
	});

	it("release-all calls bridge.releaseAll", () => {
		const bridge = createMockBridge();
		executeCommand(bridge, "release-all");
		expect(bridge.releaseAll).toHaveBeenCalled();
	});

	it("tap calls bridge.pressAndStep", () => {
		const bridge = createMockBridge();
		executeCommand(bridge, "tap", ["jump", "5"]);
		expect(bridge.pressAndStep).toHaveBeenCalledWith("jump", 5);
	});

	it("click dispatches pointer", () => {
		const bridge = createMockBridge({ click: vi.fn(() => true) });
		const result = executeCommand(bridge, "click", ["100", "200"]);
		expect(result.ok).toBe(true);
		expect(result.output).toContain("Clicked at");
	});

	it("click-button dispatches button click", () => {
		const bridge = createMockBridge({ clickButton: vi.fn(() => true) });
		const result = executeCommand(bridge, "click-button", ["Play"]);
		expect(result.ok).toBe(true);
		expect(result.output).toContain("Clicked button: Play");
	});

	it("destroy removes nodes", () => {
		const bridge = createMockBridge({ destroy: vi.fn(() => 3) });
		const result = executeCommand(bridge, "destroy", ["enemy"]);
		expect(result.ok).toBe(true);
		expect(result.output).toContain("Destroyed 3 node(s)");
	});

	it("destroy by numeric id", () => {
		const bridge = createMockBridge({ destroy: vi.fn(() => 1) });
		executeCommand(bridge, "destroy", ["42"]);
		expect(bridge.destroy).toHaveBeenCalledWith(42);
	});

	it("scenes lists registered scenes", () => {
		const bridge = createMockBridge({ listScenes: vi.fn(() => ["level1", "title"]) });
		const result = executeCommand(bridge, "scenes");
		expect(result.output).toContain("level1");
		expect(result.output).toContain("title");
	});

	it("scene switches scene", () => {
		const bridge = createMockBridge();
		executeCommand(bridge, "scene", ["level2"]);
		expect(bridge.switchScene).toHaveBeenCalledWith("level2");
	});

	it("track calls bridge.track", () => {
		const bridge = createMockBridge();
		const result = executeCommand(bridge, "track", ["Player", "10"]);
		expect(result.ok).toBe(true);
		expect(bridge.track).toHaveBeenCalledWith("Player", 10);
	});

	it("jump-analysis calls bridge.jumpAnalysis", () => {
		const bridge = createMockBridge({
			jumpAnalysis: vi.fn(() => "Not on floor"),
		});
		const result = executeCommand(bridge, "jump-analysis", ["Player"]);
		expect(result.ok).toBe(false);
		expect(result.output).toBe("Not on floor");
	});

	it("move-to calls bridge.moveTo", () => {
		const bridge = createMockBridge({
			moveTo: vi.fn(() => ({
				reached: true,
				frames: 30,
				endX: 200,
				endY: 100,
				endVx: 50,
				endVy: 0,
				onFloor: true,
				bridgeFrame: 45,
			})),
		});
		const result = executeCommand(bridge, "move-to", ["Player", "move_right", "200", "-"]);
		expect(result.ok).toBe(true);
		expect(result.output).toContain("Reached");
		expect(result.output).toContain("[floor]");
	});

	it("nearby calls bridge.nearby", () => {
		const bridge = createMockBridge({
			nearby: vi.fn(() => ({
				targetName: "Player",
				targetPos: "(100.0,200.0)",
				radius: 100,
				nodes: [{ dist: 50, line: "Enemy  pos=(150.0,200.0)  dist=50.0" }],
			})),
		});
		const result = executeCommand(bridge, "nearby", ["Player", "100"]);
		expect(result.ok).toBe(true);
		expect(result.output).toContain("Nearby Player");
	});

	it("run parses JSON and calls bridge.run", () => {
		const bridge = createMockBridge({ run: vi.fn(() => [makeSnap()]) });
		const result = executeCommand(bridge, "run", ['[{"wait":5}]']);
		expect(result.ok).toBe(true);
		expect(result.output).toContain("Ran 1 action(s)");
	});

	it("run returns error for invalid JSON", () => {
		const bridge = createMockBridge();
		const result = executeCommand(bridge, "run", ["not-json"]);
		expect(result.ok).toBe(false);
		expect(result.output).toContain("Invalid JSON");
	});

	it("events with filter args", () => {
		const bridge = createMockBridge();
		executeCommand(bridge, "events", ["--category=physics", "--limit=5"]);
		expect(bridge.events).toHaveBeenCalledWith({ category: "physics", limit: 5 });
	});

	it("clear-events calls bridge.clearEvents", () => {
		const bridge = createMockBridge();
		executeCommand(bridge, "clear-events");
		expect(bridge.clearEvents).toHaveBeenCalled();
	});

	it("mouse sets position", () => {
		const bridge = createMockBridge();
		executeCommand(bridge, "mouse", ["100", "200"]);
		expect(bridge.setMousePosition).toHaveBeenCalledWith(100, 200);
	});

	it("mouse-get returns position", () => {
		const bridge = createMockBridge({ getMousePosition: vi.fn(() => ({ x: 50, y: 75 })) });
		const result = executeCommand(bridge, "mouse-get");
		expect(result.output).toContain("50.00");
		expect(result.output).toContain("75.00");
	});

	it("unknown command returns error", () => {
		const bridge = createMockBridge();
		const result = executeCommand(bridge, "foobar");
		expect(result.ok).toBe(false);
		expect(result.output).toContain("Unknown command");
	});
});
