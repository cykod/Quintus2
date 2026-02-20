import { Game, Node2D, Scene } from "@quintus/core";
import { describe, expect, it, vi } from "vitest";
import type { Input } from "./input.js";
import type { InputEvent } from "./input-event.js";
import { getInput, InputPlugin } from "./input-plugin.js";
import type { InputReceiver } from "./input-receiver.js";

function createGame(): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null });
}

describe("InputPlugin", () => {
	describe("propagateInputEvent", () => {
		it("fires InputEvent through scene tree on action transition", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));

			const received: InputEvent[] = [];

			class Receiver extends Node2D implements InputReceiver {
				onInput(event: InputEvent): void {
					received.push(event);
				}
			}

			class TestScene extends Scene {
				onReady() {
					this.add(Receiver);
				}
			}
			game.start(TestScene);

			const input = getInput(game) as Input;
			input.inject("jump", true);
			game.step();

			expect(received.length).toBe(1);
			expect(received[0]?.action).toBe("jump");
			expect(received[0]?.pressed).toBe(true);

			game.stop();
		});

		it("propagates leaf-to-root (deepest child first)", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));

			const order: string[] = [];

			class Parent extends Node2D implements InputReceiver {
				onInput(_event: InputEvent): void {
					order.push("parent");
				}
			}
			class Child extends Node2D implements InputReceiver {
				onInput(_event: InputEvent): void {
					order.push("child");
				}
			}

			class TestScene extends Scene {
				onReady() {
					const parent = this.add(Parent);
					parent.addChild(new Child());
				}
			}
			game.start(TestScene);

			const input = getInput(game) as Input;
			input.inject("jump", true);
			game.step();

			expect(order[0]).toBe("child");
			expect(order[1]).toBe("parent");

			game.stop();
		});

		it("stops propagation when event is consumed", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));

			const order: string[] = [];

			class Parent extends Node2D implements InputReceiver {
				onInput(_event: InputEvent): void {
					order.push("parent");
				}
			}
			class Child extends Node2D implements InputReceiver {
				onInput(event: InputEvent): void {
					order.push("child");
					event.consume();
				}
			}

			class TestScene extends Scene {
				onReady() {
					const parent = this.add(Parent);
					parent.addChild(new Child());
				}
			}
			game.start(TestScene);

			const input = getInput(game) as Input;
			input.inject("jump", true);
			game.step();

			expect(order).toEqual(["child"]);

			game.stop();
		});

		it("fires release event on action transition to released", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));

			const received: InputEvent[] = [];

			class Receiver extends Node2D implements InputReceiver {
				onInput(event: InputEvent): void {
					received.push(event);
				}
			}

			class TestScene extends Scene {
				onReady() {
					this.add(Receiver);
				}
			}
			game.start(TestScene);

			const input = getInput(game) as Input;
			input.inject("jump", true);
			game.step();
			received.length = 0;

			input.inject("jump", false);
			game.step();

			expect(received.length).toBe(1);
			expect(received[0]?.action).toBe("jump");
			expect(received[0]?.pressed).toBe(false);

			game.stop();
		});

		it("does not fire events for non-transitioning actions", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));

			const received: InputEvent[] = [];

			class Receiver extends Node2D implements InputReceiver {
				onInput(event: InputEvent): void {
					received.push(event);
				}
			}

			class TestScene extends Scene {
				onReady() {
					this.add(Receiver);
				}
			}
			game.start(TestScene);

			const input = getInput(game) as Input;
			input.inject("jump", true);
			game.step();
			received.length = 0;

			// Step without any changes — no new transitions
			game.step();

			expect(received.length).toBe(0);

			game.stop();
		});
	});

	describe("blur handling", () => {
		it("releaseAll is called on window blur", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));

			class TestScene extends Scene {}
			game.start(TestScene);

			const input = getInput(game) as Input;
			input.inject("jump", true);
			game.step();
			expect(input.isPressed("jump")).toBe(true);

			// Simulate window blur
			window.dispatchEvent(new Event("blur"));

			// The blur handler calls _releaseAll which immediately updates state
			expect(input.isPressed("jump")).toBe(false);

			game.stop();
		});
	});

	describe("DOM event binding", () => {
		it("keyboard events drive actions", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);

			const input = getInput(game) as Input;

			document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
			game.step();
			expect(input.isPressed("jump")).toBe(true);

			document.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
			game.step();
			expect(input.isPressed("jump")).toBe(false);

			game.stop();
		});

		it("repeated key events are ignored", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));

			let justPressedCount = 0;

			class Tracker extends Node2D {
				onFixedUpdate(_dt: number) {
					const input = getInput(this.game) as Input;
					if (input.isJustPressed("jump")) justPressedCount++;
				}
			}

			class TestScene extends Scene {
				onReady() {
					this.add(Tracker);
				}
			}
			game.start(TestScene);

			document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
			game.step();
			expect(justPressedCount).toBe(1);

			// Repeated keydown should not re-trigger justPressed
			document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", repeat: true }));
			game.step();
			expect(justPressedCount).toBe(1); // still 1, not 2

			game.stop();
		});

		it("mouse events drive actions", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { attack: ["mouse:left"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);

			const input = getInput(game) as Input;

			game.canvas.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
			game.step();
			expect(input.isPressed("attack")).toBe(true);

			document.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
			game.step();
			expect(input.isPressed("attack")).toBe(false);

			game.stop();
		});
	});

	describe("cleanup", () => {
		it("removes all DOM listeners on game.stop()", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);

			const docRemoveSpy = vi.spyOn(document, "removeEventListener");
			const winRemoveSpy = vi.spyOn(window, "removeEventListener");

			game.stop();

			// Should have removed keydown, keyup, mouseup from document
			const docEvents = docRemoveSpy.mock.calls.map(([e]) => e);
			expect(docEvents).toContain("keydown");
			expect(docEvents).toContain("keyup");
			expect(docEvents).toContain("mouseup");

			// Should have removed blur from window
			const winEvents = winRemoveSpy.mock.calls.map(([e]) => e);
			expect(winEvents).toContain("blur");

			docRemoveSpy.mockRestore();
			winRemoveSpy.mockRestore();
		});

		it("getInput returns null after game.stop()", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);

			expect(getInput(game)).not.toBeNull();
			game.stop();
			expect(getInput(game)).toBeNull();
		});
	});
});
