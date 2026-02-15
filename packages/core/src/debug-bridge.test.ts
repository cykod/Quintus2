import { describe, expect, it } from "vitest";
import type { DebugBridge } from "./debug-bridge.js";
import { Game } from "./game.js";
import { Node2D } from "./node2d.js";
import { Scene } from "./scene.js";

function createDebugGame(): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 400, height: 300, canvas, debug: true, renderer: null });
}

/** Start game in debug mode and return the bridge directly. */
function startWithBridge(game: Game, SceneClass: typeof Scene = Scene): DebugBridge {
	game.start(SceneClass);
	// installDebugBridge is called inside start() for debug mode,
	// but we can also get the bridge from the return of installDebugBridge
	// Since start() already calls it, just verify window has it
	const bridge = window.__quintusDebug;
	expect(bridge).toBeDefined();
	return bridge as DebugBridge;
}

describe("DebugBridge", () => {
	it("paused is true when game is not running", () => {
		const game = createDebugGame();
		const bridge = startWithBridge(game);
		expect(bridge.paused).toBe(true);
	});

	it("frame and elapsed track correctly", () => {
		const game = createDebugGame();
		const bridge = startWithBridge(game);
		expect(bridge.frame).toBe(0);
		expect(bridge.elapsed).toBe(0);

		bridge.step(3);
		expect(bridge.frame).toBe(3);
		expect(bridge.elapsed).toBeGreaterThan(0);
	});

	it("step advances frames and returns tree", () => {
		const game = createDebugGame();
		class TestScene extends Scene {
			onReady() {
				const n = new Node2D();
				n.name = "Player";
				this.addChild(n);
			}
		}
		const bridge = startWithBridge(game, TestScene);

		const result = bridge.step(1);
		expect(result).not.toBeNull();
		expect(game.fixedFrame).toBe(1);
	});

	it("tree() returns scene snapshot", () => {
		const game = createDebugGame();
		class TestScene extends Scene {
			onReady() {
				const a = new Node2D();
				a.name = "NodeA";
				const b = new Node2D();
				b.name = "NodeB";
				this.addChild(a);
				this.addChild(b);
			}
		}
		const bridge = startWithBridge(game, TestScene);

		const tree = bridge.tree();
		expect(tree).not.toBeNull();
		expect(tree?.children.length).toBe(2);
		expect(tree?.children[0]?.name).toBe("NodeA");
	});

	it("query matches by type, name, and tag", () => {
		const game = createDebugGame();
		class TestScene extends Scene {
			onReady() {
				const a = new Node2D();
				a.name = "Player";
				a.tag("hero");
				this.addChild(a);
				const b = new Node2D();
				b.name = "Enemy";
				this.addChild(b);
			}
		}
		const bridge = startWithBridge(game, TestScene);

		// By name
		expect(bridge.query("Player").length).toBe(1);
		// By tag
		expect(bridge.query("hero").length).toBe(1);
		// By type
		expect(bridge.query("Node2D").length).toBe(2);
	});

	it("inspect by name returns snapshot", () => {
		const game = createDebugGame();
		class TestScene extends Scene {
			onReady() {
				const a = new Node2D();
				a.name = "Player";
				a.position._set(100, 200);
				this.addChild(a);
			}
		}
		const bridge = startWithBridge(game, TestScene);

		const snap = bridge.inspect("Player");
		expect(snap).not.toBeNull();
		expect(snap?.name).toBe("Player");
	});

	it("inspect by id returns snapshot", () => {
		const game = createDebugGame();
		let nodeId = -1;
		class TestScene extends Scene {
			onReady() {
				const a = new Node2D();
				a.name = "Target";
				this.addChild(a);
				nodeId = a.id;
			}
		}
		const bridge = startWithBridge(game, TestScene);

		const snap = bridge.inspect(nodeId);
		expect(snap).not.toBeNull();
		expect(snap?.name).toBe("Target");
	});

	it("inspect returns null for missing node", () => {
		const game = createDebugGame();
		const bridge = startWithBridge(game);
		expect(bridge.inspect("NonExistent")).toBeNull();
		expect(bridge.inspect(99999)).toBeNull();
	});

	it("screenshot returns data URL", () => {
		const canvas = document.createElement("canvas");
		const game = new Game({ width: 100, height: 100, canvas, debug: true });
		const bridge = startWithBridge(game);

		const url = bridge.screenshot();
		expect(url).toMatch(/^data:image\/png/);
	});

	it("events drain and peek work through bridge", () => {
		const game = createDebugGame();
		const bridge = startWithBridge(game);

		bridge.log("test", "hello", { key: "value" });

		const events = bridge.events();
		expect(events.length).toBeGreaterThan(0);
		const testEvents = events.filter((e) => e.category === "test");
		expect(testEvents.length).toBe(1);
		expect(testEvents[0]?.message).toBe("hello");

		// Second drain should be empty (no new events)
		expect(bridge.events().length).toBe(0);
	});

	it("peekEvents does not drain", () => {
		const game = createDebugGame();
		const bridge = startWithBridge(game);

		bridge.log("test", "peek-test");

		bridge.peekEvents();
		const events = bridge.events();
		const testEvents = events.filter((e) => e.category === "test");
		expect(testEvents.length).toBe(1);
	});

	it("clearEvents resets log", () => {
		const game = createDebugGame();
		const bridge = startWithBridge(game);

		bridge.log("test", "will be cleared");
		bridge.clearEvents();
		expect(bridge.peekEvents().length).toBe(0);
	});

	it("pause and resume control game loop", () => {
		const game = createDebugGame();
		const bridge = startWithBridge(game);

		expect(bridge.paused).toBe(true);
		bridge.resume();
		expect(bridge.paused).toBe(false);
		bridge.pause();
		expect(bridge.paused).toBe(true);
	});

	it("listActions returns empty when no input plugin", () => {
		const game = createDebugGame();
		const bridge = startWithBridge(game);
		expect(bridge.listActions()).toEqual([]);
	});

	it("press/release no-op when no input plugin", () => {
		const game = createDebugGame();
		const bridge = startWithBridge(game);
		// Should not throw
		bridge.press("jump");
		bridge.release("jump");
		bridge.releaseAll();
	});

	it("pressAndStep combines press, step, release", () => {
		const game = createDebugGame();
		const bridge = startWithBridge(game);

		const startFrame = bridge.frame;
		bridge.pressAndStep("jump", 5);
		expect(bridge.frame).toBe(startFrame + 5);
	});

	it("run() executes script and returns snapshots", () => {
		const game = createDebugGame();
		const bridge = startWithBridge(game);

		const snapshots = bridge.run([{ wait: 5 }, { press: "right", frames: 10 }, { wait: 3 }]);

		expect(snapshots.length).toBe(3);
		expect(bridge.frame).toBe(5 + 10 + 3);
	});
});
