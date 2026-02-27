import { Game, type GameOptions, Scene } from "@quintus/core";
import { getInput, InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TouchOverlay } from "./touch-overlay.js";
import { VirtualButton } from "./virtual-button.js";

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

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	Object.defineProperty(canvas, "getBoundingClientRect", {
		value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
	});
	return new Game({ width: 800, height: 600, canvas, renderer: null, ...opts });
}

function setup() {
	const game = createGame();
	game.use(InputPlugin({ actions: { jump: ["Space"], fire: ["KeyF"] } }));
	const input = getInput(game)!;

	class TestScene extends Scene {
		overlay!: TouchOverlay;
		btnA!: VirtualButton;
		btnB!: VirtualButton;

		override onReady() {
			this.overlay = new TouchOverlay();
			this.add(this.overlay);
			this.btnA = new VirtualButton({
				position: new Vec2(700, 500),
				radius: 30,
				action: "jump",
				label: "A",
			});
			this.btnB = new VirtualButton({
				position: new Vec2(700, 400),
				radius: 30,
				action: "fire",
				label: "B",
			});
			this.overlay.addControl(this.btnA);
			this.overlay.addControl(this.btnB);
		}
	}

	game.start(TestScene);
	return { game, input, scene: game.currentScene as TestScene };
}

function makePointerEvent(
	type: string,
	opts: {
		clientX: number;
		clientY: number;
		pointerId: number;
		pointerType?: string;
	},
): PointerEvent {
	return new PointerEvent(type, {
		clientX: opts.clientX,
		clientY: opts.clientY,
		pointerId: opts.pointerId,
		pointerType: opts.pointerType ?? "touch",
		bubbles: true,
		cancelable: true,
	});
}

describe("TouchOverlay", () => {
	it("registers event listeners on enter tree", () => {
		const { game } = setup();
		const spy = vi.spyOn(game.canvas, "addEventListener");
		const overlay = new TouchOverlay();
		game.currentScene!.add(overlay);
		const calls = spy.mock.calls.filter(
			(c) =>
				c[0] === "pointerdown" ||
				c[0] === "pointermove" ||
				c[0] === "pointerup" ||
				c[0] === "pointercancel",
		);
		expect(calls.length).toBeGreaterThanOrEqual(4);
		spy.mockRestore();
	});

	it("dispatches touch to correct control on pointerdown", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);
		expect(input.isPressed("fire")).toBe(false);
	});

	it("multi-touch — two pointers on different controls", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 400, pointerId: 2 }),
		);

		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);
		expect(input.isPressed("fire")).toBe(true);
	});

	it("pointer up releases the correct control", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 400, pointerId: 2 }),
		);
		input._beginFrame();

		canvas.dispatchEvent(
			makePointerEvent("pointerup", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);
		expect(input.isPressed("fire")).toBe(true);
	});

	it("pointer cancel releases control", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		canvas.dispatchEvent(
			makePointerEvent("pointercancel", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);
	});

	it("non-touch pointer events are ignored", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		canvas.dispatchEvent(
			makePointerEvent("pointerdown", {
				clientX: 700,
				clientY: 500,
				pointerId: 1,
				pointerType: "mouse",
			}),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);
	});

	it("touch that misses all controls passes through", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		const event = makePointerEvent("pointerdown", {
			clientX: 0,
			clientY: 0,
			pointerId: 1,
		});
		const stopSpy = vi.spyOn(event, "stopImmediatePropagation");
		canvas.dispatchEvent(event);

		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);
		expect(stopSpy).not.toHaveBeenCalled();
	});

	it("sets renderFixed and high zIndex", () => {
		const { scene } = setup();
		expect(scene.overlay.renderFixed).toBe(true);
		expect(scene.overlay.zIndex).toBe(9999);
	});

	it("routes pointermove to tracked control", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		// Touch down on button A
		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		// Move pointer (should be routed to button A's _onTouchMove)
		const moveEvent = makePointerEvent("pointermove", {
			clientX: 710,
			clientY: 510,
			pointerId: 1,
		});
		const stopSpy = vi.spyOn(moveEvent, "stopImmediatePropagation");
		canvas.dispatchEvent(moveEvent);
		expect(stopSpy).toHaveBeenCalled();
	});

	it("ignores pointermove for untracked pointer", () => {
		const { game } = setup();
		const canvas = game.canvas;

		// Move without prior pointerdown — should pass through
		const moveEvent = makePointerEvent("pointermove", {
			clientX: 700,
			clientY: 500,
			pointerId: 99,
		});
		const stopSpy = vi.spyOn(moveEvent, "stopImmediatePropagation");
		canvas.dispatchEvent(moveEvent);
		expect(stopSpy).not.toHaveBeenCalled();
	});

	it("cleans up event listeners on exit tree", () => {
		const { game, scene } = setup();
		const removeSpy = vi.spyOn(game.canvas, "removeEventListener");
		const overlay = scene.overlay;

		overlay.destroy();
		game.step(); // process destroy

		const removedEvents = removeSpy.mock.calls
			.map((c) => c[0])
			.filter(
				(e) =>
					e === "pointerdown" || e === "pointermove" || e === "pointerup" || e === "pointercancel",
			);
		expect(removedEvents).toHaveLength(4);
		removeSpy.mockRestore();
	});

	it("sliding from one button to another releases old and presses new", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		// Touch down on button A (jump) at (700, 500)
		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);
		expect(input.isPressed("fire")).toBe(false);

		// Slide finger to button B (fire) at (700, 400)
		canvas.dispatchEvent(
			makePointerEvent("pointermove", { clientX: 700, clientY: 400, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);
		expect(input.isPressed("fire")).toBe(true);
	});

	it("sliding off a button into dead zone releases the button", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		// Touch down on button A (jump)
		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		// Slide to dead zone (far from both buttons)
		canvas.dispatchEvent(
			makePointerEvent("pointermove", { clientX: 100, clientY: 100, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);
		expect(input.isPressed("fire")).toBe(false);
	});

	it("sliding within the same button does not release it", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		// Touch down on button A (jump)
		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		// Move slightly within the same button
		canvas.dispatchEvent(
			makePointerEvent("pointermove", { clientX: 710, clientY: 510, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);
	});

	it("clears pointer tracking on exit tree", () => {
		const { game, input, scene } = setup();
		const canvas = game.canvas;

		// Touch down
		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		// Destroy overlay
		scene.overlay.destroy();
		game.step();

		// Re-add a new overlay — previous pointer state should not leak
		const newOverlay = new TouchOverlay();
		game.currentScene!.add(newOverlay);
		// Dispatching pointerup for old pointer should not throw or affect anything
		canvas.dispatchEvent(
			makePointerEvent("pointerup", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
	});
});
