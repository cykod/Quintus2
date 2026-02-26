import { describe, expect, it, vi } from "vitest";
import { Game } from "./game.js";
import { Node } from "./node.js";
import { Node2D } from "./node2d.js";
import { Scene } from "./scene.js";

function createDebugGame(): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 400, height: 300, canvas, debug: true, renderer: null });
}

describe("Debug Instrumentation", () => {
	describe("lifecycle events", () => {
		it("logs onReady when nodes are added to scene", () => {
			const game = createDebugGame();
			class Player extends Node2D {}
			class TestScene extends Scene {
				onReady() {
					const n = new Player();
					n.tag("hero");
					this.add(n);
				}
			}
			game.start(TestScene);

			const events = game.debugLog.peek({ category: "lifecycle" });
			const readyEvents = events.filter((e) => e.message.includes("onReady"));
			expect(readyEvents.length).toBeGreaterThanOrEqual(1);

			const playerReady = readyEvents.find((e) => e.message.includes("Player"));
			expect(playerReady).toBeDefined();
			expect(playerReady?.message).toContain("tags=[hero]");
		});

		it("logs onDestroy when nodes are destroyed", () => {
			const game = createDebugGame();
			class Ephemeral extends Node2D {}
			let node: Ephemeral | undefined;
			class TestScene extends Scene {
				onReady() {
					node = new Ephemeral();
					this.add(node);
				}
			}
			game.start(TestScene);
			game.debugLog.drain(); // clear existing events

			expect(node).toBeDefined();
			node?.destroy();
			game.step(); // Process destroy queue

			const events = game.debugLog.drain({ category: "lifecycle" });
			const destroyEvents = events.filter((e) => e.message.includes("onDestroy"));
			expect(destroyEvents.length).toBeGreaterThanOrEqual(1);
			expect(destroyEvents.some((e) => e.message.includes("Ephemeral"))).toBe(true);
		});
	});

	describe("error events", () => {
		it("logs lifecycle errors", () => {
			const game = createDebugGame();
			const errorHandler = vi.fn();
			game.onError.connect(errorHandler);

			class TestScene extends Scene {
				onReady() {
					class Buggy extends Node {
						override onUpdate(_dt: number) {
							throw new Error("test error");
						}
					}
					this.add(new Buggy());
				}
			}
			game.start(TestScene);
			game.debugLog.drain(); // clear

			game.step();

			const events = game.debugLog.drain({ category: "error" });
			expect(events.length).toBe(1);
			expect(events[0]?.message).toContain("Buggy");
			expect(events[0]?.message).toContain("test error");
		});
	});

	describe("scene events", () => {
		it("logs scene transitions", () => {
			const game = createDebugGame();
			class SceneA extends Scene {}
			class SceneB extends Scene {}
			game.start(SceneA);
			game.debugLog.drain(); // clear

			game._switchScene(SceneB);

			const events = game.debugLog.drain({ category: "scene" });
			expect(events.length).toBe(1);
			expect(events[0]?.message).toContain("SceneA");
			expect(events[0]?.message).toContain("SceneB");
		});
	});

	describe("no debug mode", () => {
		it("does not log events when debug is off", () => {
			const canvas = document.createElement("canvas");
			const game = new Game({ width: 400, height: 300, canvas, debug: false, renderer: null });

			class TestScene extends Scene {
				onReady() {
					const n = new Node2D();
					n.name = "Player";
					this.add(n);
				}
			}
			game.start(TestScene);

			const events = game.debugLog.peek();
			expect(events.length).toBe(0);
		});

		it("game.log is no-op when debug is off", () => {
			const canvas = document.createElement("canvas");
			const game = new Game({ width: 400, height: 300, canvas, debug: false, renderer: null });
			game.start(Scene);

			game.log("should not appear");
			expect(game.debugLog.size).toBe(0);
		});
	});

	describe("game.log", () => {
		it("writes events with category 'game'", () => {
			const game = createDebugGame();
			game.start(Scene);
			game.debugLog.drain(); // clear

			game.log("player scored", { score: 10 });

			const events = game.debugLog.drain({ category: "game" });
			expect(events.length).toBe(1);
			expect(events[0]?.message).toBe("player scored");
			expect(events[0]?.data).toEqual({ score: 10 });
		});
	});

	describe("debug mode startup", () => {
		it("game does not auto-start loop in debug mode", () => {
			const game = createDebugGame();
			game.start(Scene);
			expect(game.running).toBe(false);
		});

		it("game auto-starts loop in non-debug mode", () => {
			const canvas = document.createElement("canvas");
			const game = new Game({ width: 400, height: 300, canvas, debug: false, renderer: null });
			game.start(Scene);
			expect(game.running).toBe(true);
		});

		it("screenshot returns data URL", () => {
			const canvas = document.createElement("canvas");
			const game = new Game({ width: 100, height: 100, canvas, debug: true });
			game.start(Scene);
			const url = game.screenshot();
			expect(url).toMatch(/^data:image\/png/);
		});
	});
});
