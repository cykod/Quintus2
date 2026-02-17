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

	it("run() handles release action in script", () => {
		const game = createDebugGame();
		const bridge = startWithBridge(game);

		const startFrame = bridge.frame;
		const snapshots = bridge.run([{ release: "jump" }]);

		expect(snapshots.length).toBe(1);
		expect(bridge.frame).toBe(startFrame + 1);
	});

	describe("click()", () => {
		it("dispatches pointer events to clickable node at coordinates", () => {
			const game = createDebugGame();
			let clicked = false;

			// Create a UINode-like clickable node
			class ClickableNode extends Node2D {
				interactive = true;
				visible = true;
				width = 100;
				height = 50;
				zIndex = 0;

				containsPoint(x: number, y: number): boolean {
					const gp = this.globalPosition;
					return x >= gp.x && x <= gp.x + this.width && y >= gp.y && y <= gp.y + this.height;
				}

				_onPointerDown(_x: number, _y: number): void {
					clicked = true;
				}
				_onPointerUp(_x: number, _y: number): void {}
			}

			class TestScene extends Scene {
				onReady() {
					const node = new ClickableNode();
					node.position._set(10, 10);
					this.addChild(node);
				}
			}
			const bridge = startWithBridge(game, TestScene);

			const result = bridge.click(50, 30);
			expect(result).toBe(true);
			expect(clicked).toBe(true);
		});

		it("returns false when no clickable node at coordinates", () => {
			const game = createDebugGame();
			const bridge = startWithBridge(game);

			const result = bridge.click(999, 999);
			expect(result).toBe(false);
		});

		it("returns false when no scene", () => {
			const game = createDebugGame();
			const bridge = startWithBridge(game);
			// Don't add any scene content
			expect(bridge.click(50, 50)).toBe(false);
		});

		it("selects topmost interactive node by zIndex", () => {
			const game = createDebugGame();
			const clickOrder: string[] = [];

			class ClickableNode extends Node2D {
				interactive = true;
				visible = true;
				width = 100;
				height = 100;
				zIndex = 0;
				label = "";

				containsPoint(x: number, y: number): boolean {
					const gp = this.globalPosition;
					return x >= gp.x && x <= gp.x + this.width && y >= gp.y && y <= gp.y + this.height;
				}

				_onPointerDown(_x: number, _y: number): void {
					clickOrder.push(this.label);
				}
				_onPointerUp(_x: number, _y: number): void {}
			}

			class TestScene extends Scene {
				onReady() {
					const a = new ClickableNode();
					a.label = "A";
					a.zIndex = 0;
					this.addChild(a);

					const b = new ClickableNode();
					b.label = "B";
					b.zIndex = 10;
					this.addChild(b);
				}
			}
			const bridge = startWithBridge(game, TestScene);

			bridge.click(50, 50);
			expect(clickOrder).toEqual(["B"]);
		});
	});

	describe("clickButton()", () => {
		it("clicks a clickable node by name", () => {
			const game = createDebugGame();
			let clicked = false;

			class ClickableNode extends Node2D {
				interactive = true;
				visible = true;
				width = 100;
				height = 50;
				zIndex = 0;

				containsPoint(_x: number, _y: number): boolean {
					return true;
				}

				_onPointerDown(_x: number, _y: number): void {
					clicked = true;
				}
				_onPointerUp(_x: number, _y: number): void {}
			}

			class TestScene extends Scene {
				onReady() {
					const node = new ClickableNode();
					node.name = "startButton";
					this.addChild(node);
				}
			}
			const bridge = startWithBridge(game, TestScene);

			const result = bridge.clickButton("startButton");
			expect(result).toBe(true);
			expect(clicked).toBe(true);
		});

		it("clicks a clickable node by text property", () => {
			const game = createDebugGame();
			let clicked = false;

			class TextButton extends Node2D {
				interactive = true;
				visible = true;
				width = 100;
				height = 50;
				zIndex = 0;
				text = "Play";

				containsPoint(_x: number, _y: number): boolean {
					return true;
				}

				_onPointerDown(_x: number, _y: number): void {
					clicked = true;
				}
				_onPointerUp(_x: number, _y: number): void {}
			}

			class TestScene extends Scene {
				onReady() {
					const node = new TextButton();
					this.addChild(node);
				}
			}
			const bridge = startWithBridge(game, TestScene);

			const result = bridge.clickButton("Play");
			expect(result).toBe(true);
			expect(clicked).toBe(true);
		});

		it("returns false when no matching button found", () => {
			const game = createDebugGame();
			const bridge = startWithBridge(game);

			expect(bridge.clickButton("nonexistent")).toBe(false);
		});
	});

	describe("query edge cases", () => {
		it("query returns empty array when no scene", () => {
			const game = createDebugGame();
			const bridge = startWithBridge(game);
			// Scene exists but has no matching nodes
			expect(bridge.query("NonExistentType")).toEqual([]);
		});

		it("query returns multiple matches for same type", () => {
			const game = createDebugGame();
			class TestScene extends Scene {
				onReady() {
					for (let i = 0; i < 5; i++) {
						const n = new Node2D();
						n.tag("enemy");
						this.addChild(n);
					}
				}
			}
			const bridge = startWithBridge(game, TestScene);

			expect(bridge.query("enemy").length).toBe(5);
		});

		it("inspect deeply nested node by name", () => {
			const game = createDebugGame();
			class TestScene extends Scene {
				onReady() {
					const parent = new Node2D();
					parent.name = "parent";
					this.addChild(parent);

					const child = new Node2D();
					child.name = "child";
					parent.addChild(child);

					const grandchild = new Node2D();
					grandchild.name = "grandchild";
					child.addChild(grandchild);
				}
			}
			const bridge = startWithBridge(game, TestScene);

			const snap = bridge.inspect("grandchild");
			expect(snap).not.toBeNull();
			expect(snap?.name).toBe("grandchild");
		});
	});

	describe("events with filter", () => {
		it("events() supports category filter", () => {
			const game = createDebugGame();
			const bridge = startWithBridge(game);

			bridge.log("physics", "collision");
			bridge.log("input", "key pressed");
			bridge.log("physics", "overlap");

			const physics = bridge.events({ category: "physics" });
			expect(physics.length).toBe(2);
			expect(physics.every((e) => e.category === "physics")).toBe(true);
		});

		it("peekEvents() with filter does not drain matching events", () => {
			const game = createDebugGame();
			const bridge = startWithBridge(game);

			bridge.log("test", "one");
			bridge.log("test", "two");

			const peeked = bridge.peekEvents({ category: "test" });
			expect(peeked.length).toBe(2);

			// Drain all
			const all = bridge.events();
			expect(all.length).toBeGreaterThanOrEqual(2);
		});
	});
});
