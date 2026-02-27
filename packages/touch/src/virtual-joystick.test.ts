import { Game, type GameOptions, Scene } from "@quintus/core";
import { getInput, InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { VirtualJoystick } from "./virtual-joystick.js";

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null, ...opts });
}

function setup() {
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
		joy!: VirtualJoystick;
		override onReady() {
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
			this.add(this.joy);
		}
	}

	game.start(TestScene);
	return { game, input, scene: game.currentScene as TestScene };
}

describe("VirtualJoystick", () => {
	it("starts centered and inactive", () => {
		const { scene } = setup();
		const joy = scene.joy;
		expect(joy.active).toBe(false);
		expect(joy.knobOffset.x).toBe(0);
		expect(joy.knobOffset.y).toBe(0);
	});

	it("touch right of center injects move_right", () => {
		const { input, scene } = setup();
		const joy = scene.joy;

		joy._onTouchStart(150, 500);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);
		expect(input.isPressed("move_left")).toBe(false);
		expect(joy.active).toBe(true);
	});

	it("touch left of center injects move_left", () => {
		const { input, scene } = setup();
		const joy = scene.joy;

		joy._onTouchStart(50, 500);
		input._beginFrame();
		expect(input.isPressed("move_left")).toBe(true);
		expect(input.isPressed("move_right")).toBe(false);
	});

	it("touch above center injects move_up", () => {
		const { input, scene } = setup();
		const joy = scene.joy;

		joy._onTouchStart(100, 450);
		input._beginFrame();
		expect(input.isPressed("move_up")).toBe(true);
		expect(input.isPressed("move_down")).toBe(false);
	});

	it("dead zone prevents injection for small movements", () => {
		const { input, scene } = setup();
		const joy = scene.joy;

		// Move only 5px right of center — 5/50 = 0.1, below dead zone of 0.2
		joy._onTouchStart(105, 500);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(false);
	});

	it("touch end releases all injected actions and resets knob", () => {
		const { input, scene } = setup();
		const joy = scene.joy;

		joy._onTouchStart(150, 500);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);

		joy._onTouchEnd();
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(false);
		expect(joy.active).toBe(false);
		expect(joy.knobOffset.x).toBe(0);
		expect(joy.knobOffset.y).toBe(0);
	});

	it("touch move updates direction", () => {
		const { input, scene } = setup();
		const joy = scene.joy;

		joy._onTouchStart(150, 500);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);

		joy._onTouchMove(50, 500);
		input._beginFrame();
		expect(input.isPressed("move_left")).toBe(true);
		expect(input.isPressed("move_right")).toBe(false);
	});

	it("containsPoint — generous zone (1.3x radius)", () => {
		const { scene } = setup();
		const joy = scene.joy;
		expect(joy.containsPoint(165, 500)).toBe(true);
		expect(joy.containsPoint(170, 500)).toBe(false);
	});

	it("clamps knob offset to radius", () => {
		const { scene } = setup();
		const joy = scene.joy;

		joy._onTouchStart(300, 500);
		expect(joy.knobOffset.x).toBeCloseTo(50, 0);
		expect(joy.knobOffset.y).toBeCloseTo(0, 0);
	});

	it("onDraw executes without error", () => {
		const { scene } = setup();
		const joy = scene.joy;
		const ctx = {
			circle: () => {},
			text: () => {},
			line: () => {},
			rect: () => {},
			polygon: () => {},
			measureText: () => Vec2.ZERO,
			image: () => {},
			save: () => {},
			restore: () => {},
			setAlpha: () => {},
		};
		joy.onDraw(ctx);
		joy._onTouchStart(150, 500);
		joy.onDraw(ctx);
	});
});
