import { Game, type GameOptions, Scene } from "@quintus/core";
import { getInput, InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TouchOverlay } from "./touch-overlay.js";
import { VirtualButton } from "./virtual-button.js";
import { VirtualJoystick } from "./virtual-joystick.js";

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
		const pointerCalls = spy.mock.calls.filter(
			(c) =>
				c[0] === "pointerdown" ||
				c[0] === "pointermove" ||
				c[0] === "pointerup" ||
				c[0] === "pointercancel",
		);
		const touchCalls = spy.mock.calls.filter(
			(c) =>
				c[0] === "touchstart" ||
				c[0] === "touchmove" ||
				c[0] === "touchend" ||
				c[0] === "touchcancel",
		);
		expect(pointerCalls.length).toBeGreaterThanOrEqual(4);
		expect(touchCalls.length).toBeGreaterThanOrEqual(4);
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

		const removedPointer = removeSpy.mock.calls
			.map((c) => c[0])
			.filter(
				(e) =>
					e === "pointerdown" || e === "pointermove" || e === "pointerup" || e === "pointercancel",
			);
		const removedTouch = removeSpy.mock.calls
			.map((c) => c[0])
			.filter(
				(e) => e === "touchstart" || e === "touchmove" || e === "touchend" || e === "touchcancel",
			);
		expect(removedPointer).toHaveLength(4);
		expect(removedTouch).toHaveLength(4);
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

	it("sliding from dead zone onto a button activates it", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		// Touch down on button A (jump) at (700, 500)
		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		// Slide to dead zone
		canvas.dispatchEvent(
			makePointerEvent("pointermove", { clientX: 100, clientY: 100, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);

		// Slide from dead zone onto button B (fire)
		canvas.dispatchEvent(
			makePointerEvent("pointermove", { clientX: 700, clientY: 400, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("fire")).toBe(true);
	});

	it("sliding from dead zone back onto original button re-activates it", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		// Touch down on button A (jump)
		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		// Slide to dead zone
		canvas.dispatchEvent(
			makePointerEvent("pointermove", { clientX: 100, clientY: 100, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);

		// Slide back onto button A (jump)
		canvas.dispatchEvent(
			makePointerEvent("pointermove", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);
	});

	it("rapid slide across three controls", () => {
		const { game, input, scene } = setup();
		const canvas = game.canvas;

		// Add a third button
		const btnC = new VirtualButton({
			position: new Vec2(700, 300),
			radius: 30,
			action: "fire",
			label: "C",
		});
		// Override action to a distinct one — use "fire" for btnB
		// btnA = jump at (700,500), btnB = fire at (700,400), btnC = fire at (700,300)
		// We'll test transitions: A → dead zone → B → dead zone → C
		scene.overlay.addControl(btnC);

		// Touch down on button A (jump)
		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		// Slide to dead zone between A and B
		canvas.dispatchEvent(
			makePointerEvent("pointermove", { clientX: 700, clientY: 450, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);

		// Slide to button B (fire)
		canvas.dispatchEvent(
			makePointerEvent("pointermove", { clientX: 700, clientY: 400, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("fire")).toBe(true);
	});

	it("pointer in dead zone still tracked for pointermove", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		// Touch down on button A (jump)
		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();

		// Slide to dead zone
		canvas.dispatchEvent(
			makePointerEvent("pointermove", { clientX: 100, clientY: 100, pointerId: 1 }),
		);

		// Move further in dead zone — should not throw, event should still be consumed
		const moveEvent = makePointerEvent("pointermove", {
			clientX: 200,
			clientY: 200,
			pointerId: 1,
		});
		const stopSpy = vi.spyOn(moveEvent, "stopImmediatePropagation");
		canvas.dispatchEvent(moveEvent);
		expect(stopSpy).toHaveBeenCalled();
	});

	it("pointerup in dead zone cleans up without error", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		// Touch down on button A (jump)
		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		// Slide to dead zone
		canvas.dispatchEvent(
			makePointerEvent("pointermove", { clientX: 100, clientY: 100, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);

		// Pointer up in dead zone — should not throw
		const upEvent = makePointerEvent("pointerup", {
			clientX: 100,
			clientY: 100,
			pointerId: 1,
		});
		const stopSpy = vi.spyOn(upEvent, "stopImmediatePropagation");
		canvas.dispatchEvent(upEvent);
		expect(stopSpy).toHaveBeenCalled();

		// Subsequent move should not be tracked
		const moveEvent = makePointerEvent("pointermove", {
			clientX: 700,
			clientY: 500,
			pointerId: 1,
		});
		const moveStopSpy = vi.spyOn(moveEvent, "stopImmediatePropagation");
		canvas.dispatchEvent(moveEvent);
		expect(moveStopSpy).not.toHaveBeenCalled();
	});

	it("sliding between adjacent buttons with overlapping hit zones switches control", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { move_left: ["KeyA"], move_right: ["KeyD"] } }));
		const input = getInput(game)!;

		class OverlapScene extends Scene {
			overlay!: TouchOverlay;
			override onReady() {
				this.overlay = new TouchOverlay();
				this.add(this.overlay);
				// Two buttons 50px apart, radius 30, generous = 39. Zones overlap.
				this.overlay.addControl(
					new VirtualButton({
						position: new Vec2(100, 500),
						radius: 30,
						action: "move_left",
						label: "L",
					}),
				);
				this.overlay.addControl(
					new VirtualButton({
						position: new Vec2(150, 500),
						radius: 30,
						action: "move_right",
						label: "R",
					}),
				);
			}
		}

		game.start(OverlapScene);
		const canvas = game.canvas;

		// Touch down on left button center
		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 100, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("move_left")).toBe(true);
		expect(input.isPressed("move_right")).toBe(false);

		// Slide to midpoint (125, 500) — overlap zone, but closer to right button
		canvas.dispatchEvent(
			makePointerEvent("pointermove", { clientX: 126, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("move_left")).toBe(false);
		expect(input.isPressed("move_right")).toBe(true);

		// Slide to right button center
		canvas.dispatchEvent(
			makePointerEvent("pointermove", { clientX: 150, clientY: 500, pointerId: 1 }),
		);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);
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

// --- Native touch event tests (simulating real iOS behavior) ---

function makeTouchEvent(
	type: string,
	touches: { identifier: number; clientX: number; clientY: number }[],
	opts: { cancelable?: boolean } = {},
): TouchEvent {
	const touchObjs = touches.map(
		(t) =>
			({
				identifier: t.identifier,
				clientX: t.clientX,
				clientY: t.clientY,
				target: null,
			}) as unknown as Touch,
	);
	const event = new TouchEvent(type, {
		changedTouches: touchObjs,
		bubbles: true,
		cancelable: opts.cancelable ?? true,
	});
	return event;
}

describe("TouchOverlay (native touch events)", () => {
	it("activates control on touchstart", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		canvas.dispatchEvent(
			makeTouchEvent("touchstart", [{ identifier: 0, clientX: 700, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);
		expect(input.isPressed("fire")).toBe(false);
	});

	it("deactivates control on touchend", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		canvas.dispatchEvent(
			makeTouchEvent("touchstart", [{ identifier: 0, clientX: 700, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		canvas.dispatchEvent(
			makeTouchEvent("touchend", [{ identifier: 0, clientX: 700, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);
	});

	it("sliding off button deactivates, sliding back reactivates", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		// Touch down on jump button
		canvas.dispatchEvent(
			makeTouchEvent("touchstart", [{ identifier: 0, clientX: 700, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		// Slide off into dead zone
		canvas.dispatchEvent(
			makeTouchEvent("touchmove", [{ identifier: 0, clientX: 100, clientY: 100 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);

		// Slide back onto jump button
		canvas.dispatchEvent(
			makeTouchEvent("touchmove", [{ identifier: 0, clientX: 700, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);
	});

	it("sliding between two buttons switches control", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		// Touch down on jump button (700, 500)
		canvas.dispatchEvent(
			makeTouchEvent("touchstart", [{ identifier: 0, clientX: 700, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);
		expect(input.isPressed("fire")).toBe(false);

		// Slide to fire button (700, 400)
		canvas.dispatchEvent(
			makeTouchEvent("touchmove", [{ identifier: 0, clientX: 700, clientY: 400 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);
		expect(input.isPressed("fire")).toBe(true);

		// Slide back to jump button
		canvas.dispatchEvent(
			makeTouchEvent("touchmove", [{ identifier: 0, clientX: 700, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("fire")).toBe(false);
		expect(input.isPressed("jump")).toBe(true);
	});

	it("multi-touch: two fingers on different buttons simultaneously", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		// Finger 1 on jump
		canvas.dispatchEvent(
			makeTouchEvent("touchstart", [{ identifier: 0, clientX: 700, clientY: 500 }]),
		);
		// Finger 2 on fire
		canvas.dispatchEvent(
			makeTouchEvent("touchstart", [{ identifier: 1, clientX: 700, clientY: 400 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);
		expect(input.isPressed("fire")).toBe(true);

		// Lift finger 1
		canvas.dispatchEvent(
			makeTouchEvent("touchend", [{ identifier: 0, clientX: 700, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);
		expect(input.isPressed("fire")).toBe(true);
	});

	it("touch events prevent pointer events from double-handling", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		// Touch event fires first (like real iOS)
		canvas.dispatchEvent(
			makeTouchEvent("touchstart", [{ identifier: 0, clientX: 700, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		// Corresponding pointer event fires — should be skipped
		canvas.dispatchEvent(
			makePointerEvent("pointerdown", { clientX: 700, clientY: 400, pointerId: 1 }),
		);
		input._beginFrame();
		// fire should NOT activate because pointer events are skipped after touch
		expect(input.isPressed("fire")).toBe(false);
	});

	it("touchcancel releases control", () => {
		const { game, input } = setup();
		const canvas = game.canvas;

		canvas.dispatchEvent(
			makeTouchEvent("touchstart", [{ identifier: 0, clientX: 700, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		canvas.dispatchEvent(
			makeTouchEvent("touchcancel", [{ identifier: 0, clientX: 700, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);
	});

	it("full user scenario: slide between direction buttons + jump with other finger", () => {
		const game = createGame();
		game.use(
			InputPlugin({
				actions: { move_left: ["KeyA"], move_right: ["KeyD"], jump: ["Space"] },
			}),
		);
		const input = getInput(game)!;

		class DirectionScene extends Scene {
			overlay!: TouchOverlay;
			override onReady() {
				this.overlay = new TouchOverlay();
				this.add(this.overlay);
				// Left and right buttons close together (like platformer layout)
				this.overlay.addControl(
					new VirtualButton({
						position: new Vec2(60, 550),
						radius: 30,
						action: "move_left",
						label: "L",
					}),
				);
				this.overlay.addControl(
					new VirtualButton({
						position: new Vec2(150, 550),
						radius: 30,
						action: "move_right",
						label: "R",
					}),
				);
				this.overlay.addControl(
					new VirtualButton({
						position: new Vec2(700, 550),
						radius: 40,
						action: "jump",
						label: "A",
					}),
				);
			}
		}

		game.start(DirectionScene);
		const canvas = game.canvas;

		// 1. Touch right button with finger 0
		canvas.dispatchEvent(
			makeTouchEvent("touchstart", [{ identifier: 0, clientX: 150, clientY: 550 }]),
		);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);

		// 2. Slide finger 0 up off the button
		canvas.dispatchEvent(
			makeTouchEvent("touchmove", [{ identifier: 0, clientX: 150, clientY: 400 }]),
		);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(false);

		// 3. Slide finger 0 back onto right button
		canvas.dispatchEvent(
			makeTouchEvent("touchmove", [{ identifier: 0, clientX: 150, clientY: 550 }]),
		);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);

		// 4. Slide finger 0 left to left button
		canvas.dispatchEvent(
			makeTouchEvent("touchmove", [{ identifier: 0, clientX: 60, clientY: 550 }]),
		);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(false);
		expect(input.isPressed("move_left")).toBe(true);

		// 5. Meanwhile, tap jump with finger 1
		canvas.dispatchEvent(
			makeTouchEvent("touchstart", [{ identifier: 1, clientX: 700, clientY: 550 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);
		expect(input.isPressed("move_left")).toBe(true); // still held

		// 6. Slide finger 1 off jump
		canvas.dispatchEvent(
			makeTouchEvent("touchmove", [{ identifier: 1, clientX: 700, clientY: 300 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);
		expect(input.isPressed("move_left")).toBe(true); // finger 0 still on left

		// 7. Slide finger 1 back onto jump
		canvas.dispatchEvent(
			makeTouchEvent("touchmove", [{ identifier: 1, clientX: 700, clientY: 550 }]),
		);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		// 8. Slide finger 0 back to right
		canvas.dispatchEvent(
			makeTouchEvent("touchmove", [{ identifier: 0, clientX: 150, clientY: 550 }]),
		);
		input._beginFrame();
		expect(input.isPressed("move_left")).toBe(false);
		expect(input.isPressed("move_right")).toBe(true);
		expect(input.isPressed("jump")).toBe(true); // finger 1 still on jump

		// 9. Lift both fingers
		canvas.dispatchEvent(
			makeTouchEvent("touchend", [{ identifier: 0, clientX: 150, clientY: 550 }]),
		);
		canvas.dispatchEvent(
			makeTouchEvent("touchend", [{ identifier: 1, clientX: 700, clientY: 550 }]),
		);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(false);
		expect(input.isPressed("jump")).toBe(false);
	});
});

describe("TouchOverlay (sticky controls)", () => {
	function setupWithJoystick() {
		const game = createGame();
		game.use(
			InputPlugin({
				actions: {
					move_left: ["ArrowLeft"],
					move_right: ["ArrowRight"],
					move_up: ["ArrowUp"],
					move_down: ["ArrowDown"],
				},
			}),
		);
		const input = getInput(game)!;
		class TestScene extends Scene {
			overlay!: TouchOverlay;
			joy!: VirtualJoystick;

			override onReady() {
				this.overlay = new TouchOverlay();
				this.add(this.overlay);
				this.joy = new VirtualJoystick({
					position: new Vec2(100, 500),
					radius: 50,
					deadZone: 0.2,
					actions: {
						left: "move_left",
						right: "move_right",
						up: "move_up",
						down: "move_down",
					},
				});
				this.overlay.addControl(this.joy);
			}
		}

		game.start(TestScene);
		return { game, input, scene: game.currentScene as TestScene };
	}

	it("sticky joystick keeps tracking when finger moves far outside hit zone", () => {
		const { game, input, scene } = setupWithJoystick();
		const canvas = game.canvas;

		// Touch starts on the joystick (center at 100, 500, radius 50)
		canvas.dispatchEvent(
			makeTouchEvent("touchstart", [{ identifier: 0, clientX: 130, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);

		// Move finger far outside joystick radius (way to the right, well beyond 1.3x radius)
		canvas.dispatchEvent(
			makeTouchEvent("touchmove", [{ identifier: 0, clientX: 400, clientY: 500 }]),
		);
		input._beginFrame();
		// Joystick should still be active and clamped to max right
		expect(input.isPressed("move_right")).toBe(true);
		expect(scene.joy.active).toBe(true);

		// Move back inside
		canvas.dispatchEvent(
			makeTouchEvent("touchmove", [{ identifier: 0, clientX: 130, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);

		// Only touchend releases
		canvas.dispatchEvent(
			makeTouchEvent("touchend", [{ identifier: 0, clientX: 130, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(false);
		expect(scene.joy.active).toBe(false);
	});

	it("sticky joystick does not release when finger drifts into dead zone", () => {
		const { game, input, scene } = setupWithJoystick();
		const canvas = game.canvas;

		// Start on joystick moving right
		canvas.dispatchEvent(
			makeTouchEvent("touchstart", [{ identifier: 0, clientX: 140, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);

		// Move to center (dead zone) — direction drops but joystick stays active
		canvas.dispatchEvent(
			makeTouchEvent("touchmove", [{ identifier: 0, clientX: 100, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(false); // in dead zone
		expect(scene.joy.active).toBe(true); // still tracking

		// Move right again — should resume
		canvas.dispatchEvent(
			makeTouchEvent("touchmove", [{ identifier: 0, clientX: 140, clientY: 500 }]),
		);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);
	});
});
