import { Game, Node2D, Scene } from "@quintus/core";
import { beforeAll, describe, expect, it, vi } from "vitest";

// jsdom does not provide PointerEvent — polyfill for tests
beforeAll(() => {
	if (typeof globalThis.PointerEvent === "undefined") {
		(globalThis as Record<string, unknown>).PointerEvent = class PointerEvent extends MouseEvent {
			readonly pointerId: number;
			readonly pointerType: string;
			constructor(type: string, init: PointerEventInit & { pointerId?: number } = {}) {
				super(type, init);
				this.pointerId = init.pointerId ?? 0;
				this.pointerType = init.pointerType ?? "";
			}
		};
	}
});

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
					parent.add(new Child());
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
					parent.add(new Child());
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

		it("pointer events drive actions", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { attack: ["mouse:left"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);

			const input = getInput(game) as Input;

			// jsdom lacks PointerEvent; use MouseEvent with pointer event names
			// (PointerEvent extends MouseEvent, so the handler properties match)
			game.canvas.dispatchEvent(new MouseEvent("pointerdown", { button: 0 }));
			game.step();
			expect(input.isPressed("attack")).toBe(true);

			document.dispatchEvent(new MouseEvent("pointerup", { button: 0 }));
			game.step();
			expect(input.isPressed("attack")).toBe(false);

			game.stop();
		});

		it("pointerdown sets mouse position for all pointers", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { select: ["mouse:left"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);

			const input = getInput(game) as Input;

			// Mock getBoundingClientRect so coordinate transform works in jsdom
			game.canvas.getBoundingClientRect = () =>
				({ left: 0, top: 0, width: 800, height: 600 }) as DOMRect;

			// Simulate a mouse click: pointerdown with no pointerType (defaults to non-touch)
			game.canvas.dispatchEvent(
				new MouseEvent("pointerdown", { button: 0, clientX: 200, clientY: 150 }),
			);
			expect(input.mousePosition.x).toBe(200);
			expect(input.mousePosition.y).toBe(150);

			game.stop();
		});

		it("touch pointer events update mousePosition like any other pointer", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { fire: ["mouse:left"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);

			const input = getInput(game) as Input;

			game.canvas.getBoundingClientRect = () =>
				({ left: 0, top: 0, width: 800, height: 600 }) as DOMRect;

			// Touch pointerdown should set mousePosition
			const touchDown = new PointerEvent("pointerdown", {
				button: 0,
				clientX: 50,
				clientY: 500,
				pointerType: "touch",
				bubbles: true,
			});
			game.canvas.dispatchEvent(touchDown);
			expect(input.mousePosition.x).toBe(50);
			expect(input.mousePosition.y).toBe(500);

			// Touch pointermove should also update mousePosition
			const touchMove = new PointerEvent("pointermove", {
				clientX: 60,
				clientY: 510,
				pointerType: "touch",
				bubbles: true,
			});
			game.canvas.dispatchEvent(touchMove);
			expect(input.mousePosition.x).toBe(60);
			expect(input.mousePosition.y).toBe(510);

			// Touch pointerdown should also buffer the mouse button press
			game.step();
			expect(input.isPressed("fire")).toBe(true);

			game.stop();
		});
	});

	describe("keyTarget scoping", () => {
		it("binds key listeners to the configured element, not document", () => {
			const keyTarget = document.createElement("div");
			document.body.appendChild(keyTarget);

			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] }, keyTarget }));
			class TestScene extends Scene {}
			game.start(TestScene);
			const input = getInput(game) as Input;

			// A key event on the document never reaches the scoped target.
			document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
			game.step();
			expect(input.isPressed("jump")).toBe(false);

			keyTarget.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
			game.step();
			expect(input.isPressed("jump")).toBe(true);

			keyTarget.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
			game.step();
			expect(input.isPressed("jump")).toBe(false);

			game.stop();
			keyTarget.remove();
		});

		it("gives a tabIndex-less keyTarget tabIndex = -1 so it can be focused", () => {
			const keyTarget = document.createElement("div");
			document.body.appendChild(keyTarget);
			expect(keyTarget.hasAttribute("tabindex")).toBe(false);

			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] }, keyTarget }));
			class TestScene extends Scene {}
			game.start(TestScene);

			expect(keyTarget.tabIndex).toBe(-1);
			expect(keyTarget.hasAttribute("tabindex")).toBe(true);

			game.stop();
			keyTarget.remove();
		});

		it("leaves an explicit tabIndex alone", () => {
			const keyTarget = document.createElement("div");
			keyTarget.tabIndex = 3;
			document.body.appendChild(keyTarget);

			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] }, keyTarget }));
			class TestScene extends Scene {}
			game.start(TestScene);

			expect(keyTarget.tabIndex).toBe(3);

			game.stop();
			keyTarget.remove();
		});

		it("warns when the keyTarget is detached from the document", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const keyTarget = document.createElement("div"); // never appended

			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] }, keyTarget }));
			class TestScene extends Scene {}
			game.start(TestScene);

			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0]?.[0]).toContain("not attached to the document");
			// It still gets a tabIndex, so attaching it later just works.
			expect(keyTarget.tabIndex).toBe(-1);

			game.stop();
			warn.mockRestore();
		});

		it("does not warn for an attached keyTarget", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const keyTarget = document.createElement("div");
			document.body.appendChild(keyTarget);

			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] }, keyTarget }));
			class TestScene extends Scene {}
			game.start(TestScene);

			expect(warn).not.toHaveBeenCalled();

			game.stop();
			keyTarget.remove();
			warn.mockRestore();
		});

		it("does not touch tabIndex when keyTarget defaults to document", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);

			expect((document as unknown as { tabIndex?: number }).tabIndex).toBeUndefined();

			game.stop();
		});
	});

	describe("preventDefault policy", () => {
		// `bubbles: true` matches a real key event, so a test cannot pass merely
		// because a mis-targeted listener never saw the event.
		function dispatchKey(target: EventTarget, code: string): KeyboardEvent {
			const event = new KeyboardEvent("keydown", { code, cancelable: true, bubbles: true });
			target.dispatchEvent(event);
			return event;
		}

		it('defaults to "always": bound keys prevent default regardless of focus', () => {
			const outside = document.createElement("input");
			document.body.appendChild(outside);

			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);

			outside.focus();
			expect(dispatchKey(document, "Space").defaultPrevented).toBe(true);

			game.stop();
			outside.remove();
		});

		it("never prevents default for unbound keys", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);

			expect(dispatchKey(document, "KeyQ").defaultPrevented).toBe(false);

			game.stop();
		});

		it('"focused" does not prevent default while keyTarget is unfocused, but still drives the action', () => {
			const keyTarget = document.createElement("div");
			const outside = document.createElement("input");
			document.body.append(keyTarget, outside);

			const game = createGame();
			game.use(
				InputPlugin({
					actions: { jump: ["Space"] },
					keyTarget,
					preventDefaultPolicy: "focused",
				}),
			);
			class TestScene extends Scene {}
			game.start(TestScene);
			const input = getInput(game) as Input;

			outside.focus();
			// The host page keeps its Space-scrolls-the-page behavior.
			expect(dispatchKey(keyTarget, "Space").defaultPrevented).toBe(false);
			// …and the handler demonstrably ran and *chose* not to prevent default,
			// so this cannot pass just because the event reached no listener.
			game.step();
			expect(input.isPressed("jump")).toBe(true);

			game.stop();
			keyTarget.remove();
			outside.remove();
		});

		it('"focused" prevents default while keyTarget is focused', () => {
			const keyTarget = document.createElement("div");
			document.body.appendChild(keyTarget);

			const game = createGame();
			game.use(
				InputPlugin({
					actions: { jump: ["Space"] },
					keyTarget,
					preventDefaultPolicy: "focused",
				}),
			);
			class TestScene extends Scene {}
			game.start(TestScene);

			keyTarget.focus();
			expect(document.activeElement).toBe(keyTarget);
			expect(dispatchKey(keyTarget, "Space").defaultPrevented).toBe(true);

			game.stop();
			keyTarget.remove();
		});

		it('warns when "focused" is set without a keyTarget, where it is a no-op', () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] }, preventDefaultPolicy: "focused" }));
			class TestScene extends Scene {}
			game.start(TestScene);

			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0]?.[0]).toContain("preventDefaultPolicy");

			game.stop();
			warn.mockRestore();
		});

		it("does not warn when the policy is paired with a keyTarget", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const keyTarget = document.createElement("div");
			document.body.appendChild(keyTarget);

			const game = createGame();
			game.use(
				InputPlugin({
					actions: { jump: ["Space"] },
					keyTarget,
					preventDefaultPolicy: "focused",
				}),
			);
			class TestScene extends Scene {}
			game.start(TestScene);

			expect(warn).not.toHaveBeenCalled();

			game.stop();
			keyTarget.remove();
			warn.mockRestore();
		});
	});

	describe("editable targets", () => {
		function dispatchKeyFrom(target: EventTarget, code: string): KeyboardEvent {
			const event = new KeyboardEvent("keydown", { code, cancelable: true, bubbles: true });
			target.dispatchEvent(event);
			return event;
		}

		for (const tag of ["input", "textarea", "select"] as const) {
			it(`ignores keys typed into a <${tag}> inside the keyTarget`, () => {
				const keyTarget = document.createElement("div");
				const field = document.createElement(tag);
				keyTarget.appendChild(field);
				document.body.appendChild(keyTarget);

				const game = createGame();
				game.use(
					InputPlugin({
						actions: { jump: ["Space"] },
						keyTarget,
						preventDefaultPolicy: "focused",
					}),
				);
				class TestScene extends Scene {}
				game.start(TestScene);
				const input = getInput(game) as Input;

				field.focus();
				// Real key events bubble from the focused field up to the keyTarget.
				const event = dispatchKeyFrom(field, "Space");
				game.step();

				expect(event.defaultPrevented).toBe(false);
				expect(input.isPressed("jump")).toBe(false);

				game.stop();
				keyTarget.remove();
			});
		}

		it("ignores keys typed into a contenteditable element", () => {
			const editable = document.createElement("div");
			editable.setAttribute("contenteditable", "true");
			// jsdom does not implement isContentEditable from the attribute.
			Object.defineProperty(editable, "isContentEditable", { value: true });
			document.body.appendChild(editable);

			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);
			const input = getInput(game) as Input;

			const event = dispatchKeyFrom(editable, "Space");
			game.step();

			expect(event.defaultPrevented).toBe(false);
			expect(input.isPressed("jump")).toBe(false);

			game.stop();
			editable.remove();
		});

		it("still releases a key whose keyup lands in a field, so actions never stick", () => {
			const field = document.createElement("input");
			document.body.appendChild(field);

			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);
			const input = getInput(game) as Input;

			// Pressed on the game surface…
			document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
			game.step();
			expect(input.isPressed("jump")).toBe(true);

			// …released after focus moved into a field: the release must still land.
			field.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", bubbles: true }));
			game.step();
			expect(input.isPressed("jump")).toBe(false);

			game.stop();
			field.remove();
		});

		it("still drives the game for keys typed outside any field", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);
			const input = getInput(game) as Input;

			const event = dispatchKeyFrom(document.body, "Space");
			game.step();

			expect(event.defaultPrevented).toBe(true);
			expect(input.isPressed("jump")).toBe(true);

			game.stop();
		});
	});

	describe("setEnabled", () => {
		it("skips preventDefault and ignores keys while disabled", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);
			const input = getInput(game) as Input;

			input.setEnabled(false);

			const event = new KeyboardEvent("keydown", { code: "Space", cancelable: true });
			document.dispatchEvent(event);
			game.step();

			expect(event.defaultPrevented).toBe(false);
			expect(input.isPressed("jump")).toBe(false);

			input.setEnabled(true);
			const event2 = new KeyboardEvent("keydown", { code: "Space", cancelable: true });
			document.dispatchEvent(event2);
			game.step();

			expect(event2.defaultPrevented).toBe(true);
			expect(input.isPressed("jump")).toBe(true);

			game.stop();
		});

		it("does not buffer pointer presses while disabled", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { attack: ["mouse:left"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);
			const input = getInput(game) as Input;

			game.canvas.getBoundingClientRect = () =>
				({ left: 0, top: 0, width: 800, height: 600 }) as DOMRect;
			input.setEnabled(false);

			game.canvas.dispatchEvent(
				new MouseEvent("pointerdown", { button: 0, clientX: 200, clientY: 150 }),
			);
			game.step();

			expect(input.isPressed("attack")).toBe(false);
			// Pointer position is not tracked while disabled either.
			expect(input.mousePosition.x).toBe(0);

			input.setEnabled(true);
			game.canvas.dispatchEvent(
				new MouseEvent("pointerdown", { button: 0, clientX: 200, clientY: 150 }),
			);
			game.step();
			expect(input.isPressed("attack")).toBe(true);
			expect(input.mousePosition.x).toBe(200);

			game.stop();
		});

		it("drops injected actions while disabled and releases held ones", () => {
			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] } }));
			class TestScene extends Scene {}
			game.start(TestScene);
			const input = getInput(game) as Input;

			input.inject("jump", true);
			game.step();
			expect(input.isPressed("jump")).toBe(true);

			input.setEnabled(false);
			expect(input.isPressed("jump")).toBe(false);

			input.inject("jump", true);
			game.step();
			expect(input.isPressed("jump")).toBe(false);

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

			// Should have removed keydown, keyup, pointerup from document
			const docEvents = docRemoveSpy.mock.calls.map(([e]) => e);
			expect(docEvents).toContain("keydown");
			expect(docEvents).toContain("keyup");
			expect(docEvents).toContain("pointerup");

			// Should have removed blur from window
			const winEvents = winRemoveSpy.mock.calls.map(([e]) => e);
			expect(winEvents).toContain("blur");

			docRemoveSpy.mockRestore();
			winRemoveSpy.mockRestore();
		});

		it("removes key listeners from a custom keyTarget, not document", () => {
			const keyTarget = document.createElement("div");
			document.body.appendChild(keyTarget);

			const game = createGame();
			game.use(InputPlugin({ actions: { jump: ["Space"] }, keyTarget }));
			class TestScene extends Scene {}
			game.start(TestScene);

			const targetRemoveSpy = vi.spyOn(keyTarget, "removeEventListener");
			const docRemoveSpy = vi.spyOn(document, "removeEventListener");

			game.stop();

			const targetEvents = targetRemoveSpy.mock.calls.map(([e]) => e);
			expect(targetEvents).toContain("keydown");
			expect(targetEvents).toContain("keyup");

			const docEvents = docRemoveSpy.mock.calls.map(([e]) => e);
			expect(docEvents).not.toContain("keydown");
			expect(docEvents).not.toContain("keyup");

			targetRemoveSpy.mockRestore();
			docRemoveSpy.mockRestore();
			keyTarget.remove();
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
