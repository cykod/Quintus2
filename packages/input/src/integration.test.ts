import { Game, Node2D, Scene } from "@quintus/core";
import { describe, expect, it } from "vitest";
import "./augment.js";
import type { Input } from "./input.js";
import { getInput, InputPlugin } from "./input-plugin.js";

function createGame(): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null });
}

function requireInput(game: Game): Input {
	const input = getInput(game);
	if (!input) throw new Error("InputPlugin not installed");
	return input;
}

describe("Input integration", () => {
	it("keyboard press triggers action, fixedUpdate sees isJustPressed, next step clears it", () => {
		const game = createGame();
		game.use(
			InputPlugin({
				actions: { jump: ["Space"] },
			}),
		);

		let seenJustPressed = false;

		class Tracker extends Node2D {
			onFixedUpdate(_dt: number) {
				if (requireInput(this.game).isJustPressed("jump")) {
					seenJustPressed = true;
				}
			}
		}

		game.start(
			class TestScene extends Scene {
				onReady() {
					this.add(Tracker);
				}
			},
		);

		const input = requireInput(game);

		// Simulate keyboard press
		input._bufferKeyPress("Space");
		game.step();

		expect(seenJustPressed).toBe(true);
		expect(input.isPressed("jump")).toBe(true);

		// Next step: justPressed should not re-fire
		seenJustPressed = false;
		game.step();
		expect(seenJustPressed).toBe(false);
		expect(input.isPressed("jump")).toBe(true);
	});

	it("inject drives game identically to keyboard", () => {
		const game = createGame();
		game.use(
			InputPlugin({
				actions: { jump: ["Space"] },
			}),
		);

		let justPressedSeen = false;
		let justReleasedSeen = false;

		class Tracker extends Node2D {
			onFixedUpdate(_dt: number) {
				const input = requireInput(this.game);
				if (input.isJustPressed("jump")) justPressedSeen = true;
				if (input.isJustReleased("jump")) justReleasedSeen = true;
			}
		}

		game.start(
			class TestScene extends Scene {
				onReady() {
					this.add(Tracker);
				}
			},
		);

		const input = requireInput(game);

		// Inject press
		input.inject("jump", true);
		game.step();

		expect(justPressedSeen).toBe(true);
		expect(input.isPressed("jump")).toBe(true);

		// Next step: justPressed should not re-fire
		justPressedSeen = false;
		game.step();
		expect(justPressedSeen).toBe(false);
		expect(input.isPressed("jump")).toBe(true);

		// Inject release
		input.inject("jump", false);
		game.step();
		expect(justReleasedSeen).toBe(true);
		expect(input.isPressed("jump")).toBe(false);
	});

	it("inject + step timing — justPressed survives _beginFrame clearing", () => {
		const game = createGame();
		game.use(
			InputPlugin({
				actions: { jump: ["Space"] },
			}),
		);

		let seenJustPressed = false;

		class Player extends Node2D {
			onFixedUpdate(_dt: number) {
				const game = this.game;
				if (!game) throw new Error("Node not attached to game");
				const input = requireInput(game);
				if (input.isJustPressed("jump")) {
					seenJustPressed = true;
				}
			}
		}

		game.start(
			class TestScene extends Scene {
				onReady() {
					this.add(Player);
				}
			},
		);

		const input = requireInput(game);
		input.inject("jump", true);
		game.step();

		expect(seenJustPressed).toBe(true);
	});

	it("isJustPressed fires for exactly one fixedUpdate per press", () => {
		const game = createGame();
		game.use(
			InputPlugin({
				actions: { jump: ["Space"] },
			}),
		);

		// Track how many fixedUpdate calls see justPressed
		let justPressedCount = 0;

		class Player extends Node2D {
			onFixedUpdate(_dt: number) {
				const game = this.game;
				if (!game) throw new Error("Node not attached to game");
				const input = requireInput(game);
				if (input.isJustPressed("jump")) {
					justPressedCount++;
				}
			}
		}

		game.start(
			class TestScene extends Scene {
				onReady() {
					this.add(Player);
				}
			},
		);

		const input = requireInput(game);
		input.inject("jump", true);

		// Step runs: beginFrame (flushes injection → justPressed=true),
		// then fixedUpdate (sees it), then postFixedUpdate (consumes it)
		game.step();
		expect(justPressedCount).toBe(1);

		// Second step: justPressed was consumed, so it should not re-fire
		game.step();
		expect(justPressedCount).toBe(1);
	});

	it("scene switch doesn't lose input state", () => {
		const game = createGame();
		game.use(
			InputPlugin({
				actions: { jump: ["Space"] },
			}),
		);

		class Scene1 extends Scene {
			onReady() {}
		}
		class Scene2 extends Scene {
			onReady() {}
		}

		game.start(Scene1);
		const input = requireInput(game);

		input.inject("jump", true);
		game.step();
		expect(input.isPressed("jump")).toBe(true);

		// Switch scene
		const scene = game.currentScene;
		if (!scene) throw new Error("No active scene");
		scene.switchTo(Scene2);

		// Input should still be pressed
		expect(input.isPressed("jump")).toBe(true);
	});

	it("InputPlugin works without DOM (headless)", () => {
		// In this test env we do have document, but this verifies no crashes
		const game = createGame();
		game.use(
			InputPlugin({
				actions: { jump: ["Space"] },
			}),
		);

		game.start(
			class TestScene extends Scene {
				onReady() {}
			},
		);

		const input = requireInput(game);
		input.inject("jump", true);
		game.step();

		expect(input.isPressed("jump")).toBe(true);
	});

	it("game.input accessor works via module augmentation", () => {
		const game = createGame();
		game.use(
			InputPlugin({
				actions: { jump: ["Space"] },
			}),
		);

		game.start(
			class TestScene extends Scene {
				onReady() {}
			},
		);

		// Access via game.input (augmented property)
		expect(game.input).toBeDefined();
		game.input.inject("jump", true);
		game.step();
		expect(game.input.isPressed("jump")).toBe(true);
	});

	it("game.input throws when InputPlugin not installed", () => {
		const game = createGame();
		game.start(
			class TestScene extends Scene {
				onReady() {}
			},
		);

		expect(() => game.input).toThrow(/InputPlugin not installed/);
	});

	it("preFrame signal fires before fixedUpdate", () => {
		const game = createGame();
		const order: string[] = [];

		game.preFrame.connect(() => {
			order.push("preFrame");
		});

		class OrderTracker extends Node2D {
			onFixedUpdate(_dt: number) {
				order.push("fixedUpdate");
			}
			onUpdate(_dt: number) {
				order.push("update");
			}
		}

		game.start(
			class TestScene extends Scene {
				onReady() {
					this.add(OrderTracker);
				}
			},
		);

		game.step();

		expect(order.indexOf("preFrame")).toBeLessThan(order.indexOf("fixedUpdate"));
		expect(order.indexOf("fixedUpdate")).toBeLessThan(order.indexOf("update"));
	});
});
