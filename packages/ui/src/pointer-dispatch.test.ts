import { Game, Scene } from "@quintus/core";
import { describe, expect, it, vi } from "vitest";
import { getPointerDispatcher } from "./pointer-dispatch.js";

// jsdom doesn't have PointerEvent — polyfill as MouseEvent subclass
if (typeof globalThis.PointerEvent === "undefined") {
	(globalThis as Record<string, unknown>).PointerEvent = class PointerEvent extends MouseEvent {
		readonly pointerId: number;
		constructor(type: string, init?: PointerEventInit) {
			super(type, init);
			this.pointerId = init?.pointerId ?? 0;
		}
	};
}

import { UINode } from "./ui-node.js";

function createGame(): Game {
	const canvas = document.createElement("canvas");
	canvas.width = 800;
	canvas.height = 600;
	// Mock getBoundingClientRect for coordinate conversion
	vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
		left: 0,
		top: 0,
		width: 800,
		height: 600,
		right: 800,
		bottom: 600,
		x: 0,
		y: 0,
		toJSON: () => {},
	});
	return new Game({ width: 800, height: 600, canvas, renderer: null });
}

describe("PointerDispatcher", () => {
	it("getPointerDispatcher returns same instance for same game", () => {
		const game = createGame();
		const d1 = getPointerDispatcher(game);
		const d2 = getPointerDispatcher(game);
		expect(d1).toBe(d2);
	});

	it("getPointerDispatcher returns different instance for different game", () => {
		const game1 = createGame();
		const game2 = createGame();
		expect(getPointerDispatcher(game1)).not.toBe(getPointerDispatcher(game2));
	});

	describe("pointer events through UINode registration", () => {
		it("pointerdown dispatches to interactive UINode under cursor", () => {
			const game = createGame();

			let receivedDown = false;
			class TestNode extends UINode {
				override _onPointerDown(_x: number, _y: number): void {
					receivedDown = true;
				}
			}

			class TestScene extends Scene {
				onReady() {
					const node = this.add(TestNode);
					node.width = 100;
					node.height = 50;
					node.position._set(10, 10);
				}
			}
			game.start(TestScene);

			// Dispatch pointerdown on canvas at position inside the node
			const event = new PointerEvent("pointerdown", { clientX: 50, clientY: 30 });
			game.canvas.dispatchEvent(event);

			expect(receivedDown).toBe(true);
			game.stop();
		});

		it("pointerdown does not dispatch to non-interactive nodes", () => {
			const game = createGame();

			let receivedDown = false;
			class TestNode extends UINode {
				override _onPointerDown(_x: number, _y: number): void {
					receivedDown = true;
				}
			}

			class TestScene extends Scene {
				onReady() {
					const node = this.add(TestNode);
					node.width = 100;
					node.height = 50;
					node.interactive = false;
				}
			}
			game.start(TestScene);

			const event = new PointerEvent("pointerdown", { clientX: 50, clientY: 30 });
			game.canvas.dispatchEvent(event);

			expect(receivedDown).toBe(false);
			game.stop();
		});

		it("pointerup dispatches to all interactive nodes", () => {
			const game = createGame();
			const upCalls: string[] = [];

			class NodeA extends UINode {
				override _onPointerUp(_x: number, _y: number): void {
					upCalls.push("A");
				}
			}
			class NodeB extends UINode {
				override _onPointerUp(_x: number, _y: number): void {
					upCalls.push("B");
				}
			}

			class TestScene extends Scene {
				onReady() {
					const a = this.add(NodeA);
					a.width = 100;
					a.height = 50;
					const b = this.add(NodeB);
					b.width = 100;
					b.height = 50;
					b.position._set(0, 60);
				}
			}
			game.start(TestScene);

			const event = new PointerEvent("pointerup", { clientX: 50, clientY: 30 });
			game.canvas.dispatchEvent(event);

			expect(upCalls).toContain("A");
			expect(upCalls).toContain("B");
			game.stop();
		});

		it("pointermove dispatches enter/exit events on hover changes", () => {
			const game = createGame();
			const events: string[] = [];

			class TestNode extends UINode {
				override _onPointerEnter(): void {
					events.push("enter");
				}
				override _onPointerExit(): void {
					events.push("exit");
				}
				override _onPointerMove(_x: number, _y: number): void {
					events.push("move");
				}
			}

			class TestScene extends Scene {
				onReady() {
					const node = this.add(TestNode);
					node.width = 100;
					node.height = 50;
				}
			}
			game.start(TestScene);

			// Move into the node
			game.canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: 50, clientY: 25 }));
			expect(events).toContain("enter");
			expect(events).toContain("move");

			events.length = 0;

			// Move outside the node
			game.canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: 500, clientY: 500 }));
			expect(events).toContain("exit");

			game.stop();
		});

		it("selects topmost node by zIndex for pointerdown", () => {
			const game = createGame();
			const downCalls: string[] = [];

			class NodeA extends UINode {
				override _onPointerDown(_x: number, _y: number): void {
					downCalls.push("A");
				}
			}
			class NodeB extends UINode {
				override _onPointerDown(_x: number, _y: number): void {
					downCalls.push("B");
				}
			}

			class TestScene extends Scene {
				onReady() {
					const a = this.add(NodeA);
					a.width = 100;
					a.height = 100;
					a.zIndex = 0;

					const b = this.add(NodeB);
					b.width = 100;
					b.height = 100;
					b.zIndex = 10;
				}
			}
			game.start(TestScene);

			game.canvas.dispatchEvent(new PointerEvent("pointerdown", { clientX: 50, clientY: 50 }));

			// Only B should receive the event (higher zIndex)
			expect(downCalls).toEqual(["B"]);
			game.stop();
		});

		it("cleans up listeners when all nodes unregistered", () => {
			const game = createGame();
			const removeSpy = vi.spyOn(game.canvas, "removeEventListener");

			class TestScene extends Scene {
				onReady() {
					const node = this.add(UINode);
					node.width = 50;
					node.height = 50;
				}
			}
			game.start(TestScene);

			// Destroy the node (triggers onExitTree → unregister)
			const scene = game.currentScene as NonNullable<typeof game.currentScene>;
			for (const child of [...scene.children]) {
				child.destroy();
			}
			game.step();

			const pointerCalls = removeSpy.mock.calls.filter(
				([event]) => event === "pointerdown" || event === "pointerup" || event === "pointermove",
			);
			expect(pointerCalls.length).toBe(3);
			game.stop();
		});

		it("skips invisible nodes for pointer dispatch", () => {
			const game = createGame();
			let received = false;

			class TestNode extends UINode {
				override _onPointerDown(_x: number, _y: number): void {
					received = true;
				}
			}

			class TestScene extends Scene {
				onReady() {
					const node = this.add(TestNode);
					node.width = 100;
					node.height = 100;
					node.visible = false;
				}
			}
			game.start(TestScene);

			game.canvas.dispatchEvent(new PointerEvent("pointerdown", { clientX: 50, clientY: 50 }));
			expect(received).toBe(false);
			game.stop();
		});
	});

	describe("coordinate conversion", () => {
		it("converts scaled canvas coordinates to game coordinates", () => {
			const canvas = document.createElement("canvas");
			canvas.width = 400;
			canvas.height = 300;
			// Canvas is displayed at 2x size
			vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
				left: 0,
				top: 0,
				width: 800,
				height: 600,
				right: 800,
				bottom: 600,
				x: 0,
				y: 0,
				toJSON: () => {},
			});
			const game = new Game({ width: 400, height: 300, canvas, renderer: null });

			let receivedX = -1;
			let receivedY = -1;
			class TestNode extends UINode {
				override _onPointerDown(x: number, y: number): void {
					receivedX = x;
					receivedY = y;
				}
			}

			class TestScene extends Scene {
				onReady() {
					const node = this.add(TestNode);
					node.width = 400;
					node.height = 300;
				}
			}
			game.start(TestScene);

			// Click at CSS pixel (400, 300) on an 800x600 viewport → game pixel (200, 150)
			game.canvas.dispatchEvent(new PointerEvent("pointerdown", { clientX: 400, clientY: 300 }));

			expect(receivedX).toBeCloseTo(200);
			expect(receivedY).toBeCloseTo(150);
			game.stop();
		});
	});
});
