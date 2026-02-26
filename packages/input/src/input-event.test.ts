import { Game, Node2D, Scene } from "@quintus/core";
import { describe, expect, it } from "vitest";
import type { Input } from "./input.js";
import { InputEvent } from "./input-event.js";
import { getInput, InputPlugin } from "./input-plugin.js";
import type { InputReceiver } from "./input-receiver.js";
import { isInputReceiver } from "./input-receiver.js";

function requireInput(game: Game): Input {
	const input = getInput(game);
	if (!input) throw new Error("InputPlugin not installed");
	return input;
}

describe("InputEvent", () => {
	it("creates with action, pressed, and value", () => {
		const event = new InputEvent("jump", true, 1);
		expect(event.action).toBe("jump");
		expect(event.pressed).toBe(true);
		expect(event.value).toBe(1);
		expect(event.consumed).toBe(false);
	});

	it("consume() marks event as consumed", () => {
		const event = new InputEvent("jump", true, 1);
		event.consume();
		expect(event.consumed).toBe(true);
	});
});

describe("isInputReceiver", () => {
	it("returns true for objects with onInput method", () => {
		const receiver = { onInput: () => {} };
		expect(isInputReceiver(receiver)).toBe(true);
	});

	it("returns false for objects without onInput", () => {
		expect(isInputReceiver({})).toBe(false);
		expect(isInputReceiver(null)).toBe(false);
		expect(isInputReceiver(undefined)).toBe(false);
		expect(isInputReceiver(42)).toBe(false);
	});

	it("returns false for objects where onInput is not a function", () => {
		expect(isInputReceiver({ onInput: "not a function" })).toBe(false);
	});
});

describe("InputEvent propagation", () => {
	function createGame(): Game {
		const canvas = document.createElement("canvas");
		return new Game({ width: 800, height: 600, canvas, renderer: null });
	}

	it("propagates input events leaf-to-root", () => {
		const game = createGame();
		game.use(
			InputPlugin({
				actions: { jump: ["Space"] },
			}),
		);

		const order: string[] = [];

		class ParentNode extends Node2D implements InputReceiver {
			onInput(_event: InputEvent) {
				order.push("parent");
			}
		}

		class ChildNode extends Node2D implements InputReceiver {
			onInput(_event: InputEvent) {
				order.push("child");
			}
		}

		game.start(
			class TestScene extends Scene {
				onReady() {
					const parent = this.add(ParentNode);
					parent.add(ChildNode);
				}
			},
		);

		const input = requireInput(game);
		input.inject("jump", true);
		game.step();

		// Leaf-to-root: child first, then parent
		expect(order).toEqual(["child", "parent"]);
	});

	it("consume stops propagation", () => {
		const game = createGame();
		game.use(
			InputPlugin({
				actions: { jump: ["Space"] },
			}),
		);

		const order: string[] = [];

		class ParentNode extends Node2D implements InputReceiver {
			onInput(_event: InputEvent) {
				order.push("parent");
			}
		}

		class ChildNode extends Node2D implements InputReceiver {
			onInput(event: InputEvent) {
				order.push("child");
				event.consume(); // Stop propagation
			}
		}

		game.start(
			class TestScene extends Scene {
				onReady() {
					const parent = this.add(ParentNode);
					parent.add(ChildNode);
				}
			},
		);

		const input = requireInput(game);
		input.inject("jump", true);
		game.step();

		// Only child receives the event
		expect(order).toEqual(["child"]);
	});

	it("only InputReceiver nodes receive events", () => {
		const game = createGame();
		game.use(
			InputPlugin({
				actions: { jump: ["Space"] },
			}),
		);

		const order: string[] = [];

		// This node does NOT implement InputReceiver
		class PlainNode extends Node2D {}

		class ReceiverNode extends Node2D implements InputReceiver {
			onInput(_event: InputEvent) {
				order.push("receiver");
			}
		}

		game.start(
			class TestScene extends Scene {
				onReady() {
					const plain = this.add(PlainNode);
					plain.add(ReceiverNode);
				}
			},
		);

		const input = requireInput(game);
		input.inject("jump", true);
		game.step();

		// Only the ReceiverNode gets called
		expect(order).toEqual(["receiver"]);
	});

	it("fires for both justPressed and justReleased", () => {
		const game = createGame();
		game.use(
			InputPlugin({
				actions: { jump: ["Space"] },
			}),
		);

		const events: Array<{ action: string; pressed: boolean }> = [];

		class ReceiverNode extends Node2D implements InputReceiver {
			onInput(event: InputEvent) {
				events.push({ action: event.action, pressed: event.pressed });
			}
		}

		game.start(
			class TestScene extends Scene {
				onReady() {
					this.add(ReceiverNode);
				}
			},
		);

		const input = requireInput(game);

		// Press
		input.inject("jump", true);
		game.step();
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({ action: "jump", pressed: true });

		// Release
		input.inject("jump", false);
		game.step();
		expect(events).toHaveLength(2);
		expect(events[1]).toEqual({ action: "jump", pressed: false });
	});
});
