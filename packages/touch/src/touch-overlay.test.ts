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
});
