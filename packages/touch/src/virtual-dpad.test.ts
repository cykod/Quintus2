import { Game, type GameOptions, Scene } from "@quintus/core";
import { getInput, InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { VirtualDPad } from "./virtual-dpad.js";

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
		dpad!: VirtualDPad;
		override onReady() {
			this.dpad = new VirtualDPad({
				position: new Vec2(100, 500),
				buttonSize: 30,
				actions: {
					left: "move_left",
					right: "move_right",
					up: "move_up",
					down: "move_down",
				},
			});
			this.add(this.dpad);
		}
	}

	game.start(TestScene);
	return { game, input, scene: game.currentScene as TestScene };
}

describe("VirtualDPad", () => {
	it("touch right injects move_right", () => {
		const { input, scene } = setup();
		const dpad = scene.dpad;

		dpad._onTouchStart(140, 500);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);
		expect(dpad.activeDirection).toBe("right");
	});

	it("touch left injects move_left", () => {
		const { input, scene } = setup();
		const dpad = scene.dpad;

		dpad._onTouchStart(60, 500);
		input._beginFrame();
		expect(input.isPressed("move_left")).toBe(true);
		expect(dpad.activeDirection).toBe("left");
	});

	it("touch up injects move_up", () => {
		const { input, scene } = setup();
		const dpad = scene.dpad;

		dpad._onTouchStart(100, 460);
		input._beginFrame();
		expect(input.isPressed("move_up")).toBe(true);
		expect(dpad.activeDirection).toBe("up");
	});

	it("touch down injects move_down", () => {
		const { input, scene } = setup();
		const dpad = scene.dpad;

		dpad._onTouchStart(100, 540);
		input._beginFrame();
		expect(input.isPressed("move_down")).toBe(true);
		expect(dpad.activeDirection).toBe("down");
	});

	it("diagonal touch selects dominant axis", () => {
		const { input, scene } = setup();
		const dpad = scene.dpad;

		// 30px right, 10px up — horizontal dominant → right
		dpad._onTouchStart(130, 490);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);
		expect(input.isPressed("move_up")).toBe(false);
	});

	it("touch move changes direction, releases old and presses new", () => {
		const { input, scene } = setup();
		const dpad = scene.dpad;

		dpad._onTouchStart(140, 500);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);

		dpad._onTouchMove(100, 460);
		input._beginFrame();
		expect(input.isPressed("move_up")).toBe(true);
		expect(input.isPressed("move_right")).toBe(false);
		expect(dpad.activeDirection).toBe("up");
	});

	it("quick tap fires via 1-frame hold (pending release)", () => {
		const { input, scene } = setup();
		const dpad = scene.dpad;

		dpad._onTouchStart(140, 500);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);

		dpad._onTouchEnd();
		// Action should still be pressed (pending release not yet flushed)
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);

		// After fixedUpdate, pending release fires
		dpad.onFixedUpdate(1 / 60);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(false);
	});

	it("continuous hold works without pending release interference", () => {
		const { input, scene } = setup();
		const dpad = scene.dpad;

		dpad._onTouchStart(140, 500);
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);

		input._consumeEdgeFlags();
		input._beginFrame();
		expect(input.isPressed("move_right")).toBe(true);
	});

	it("containsPoint — hit and miss", () => {
		const { scene } = setup();
		const dpad = scene.dpad;
		// buttonSize=30, generous = 30*1.5*1.3 = 58.5
		expect(dpad.containsPoint(150, 500)).toBe(true);
		expect(dpad.containsPoint(170, 500)).toBe(false);
	});

	it("onDraw executes without error", () => {
		const { scene } = setup();
		const dpad = scene.dpad;
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
		dpad.onDraw(ctx);
		dpad._onTouchStart(140, 500);
		dpad.onDraw(ctx);
	});
});
