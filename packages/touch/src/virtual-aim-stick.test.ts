import { Game, type GameOptions, Scene } from "@quintus/core";
import { getInput, InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { VirtualAimStick } from "./virtual-aim-stick.js";

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null, ...opts });
}

function setup(fireAction?: string) {
	const game = createGame();
	const actions: Record<string, string[]> = {};
	if (fireAction) {
		actions[fireAction] = [];
	}
	game.use(InputPlugin({ actions }));
	const input = getInput(game)!;

	class TestScene extends Scene {
		aim!: VirtualAimStick;
		override onReady() {
			this.aim = new VirtualAimStick({
				position: new Vec2(700, 500),
				radius: 50,
				deadZone: 0.2,
				fireAction,
			});
			this.add(this.aim);
		}
	}

	game.start(TestScene);
	return { game, input, scene: game.currentScene as TestScene };
}

describe("VirtualAimStick", () => {
	it("starts inactive", () => {
		const { scene } = setup();
		const aim = scene.aim;
		expect(aim.active).toBe(false);
		expect(aim.knobOffset.x).toBe(0);
		expect(aim.knobOffset.y).toBe(0);
	});

	it("containsPoint with generous zone", () => {
		const { scene } = setup();
		const aim = scene.aim;
		expect(aim.containsPoint(700, 500)).toBe(true);
		expect(aim.containsPoint(764, 500)).toBe(true);
		expect(aim.containsPoint(770, 500)).toBe(false);
	});

	it("becomes active on touch start", () => {
		const { scene } = setup();
		const aim = scene.aim;
		aim._onTouchStart(750, 500);
		expect(aim.active).toBe(true);
	});

	it("resets on touch end", () => {
		const { scene } = setup();
		const aim = scene.aim;
		aim._onTouchStart(750, 500);
		aim._onTouchEnd();
		expect(aim.active).toBe(false);
		expect(aim.knobOffset.x).toBe(0);
		expect(aim.knobOffset.y).toBe(0);
	});

	it("injects fire action when outside dead zone", () => {
		const { input, scene } = setup("fire");
		const aim = scene.aim;

		aim._onTouchStart(730, 500);
		input._beginFrame();
		expect(input.isPressed("fire")).toBe(true);
	});

	it("does not inject fire action when inside dead zone", () => {
		const { input, scene } = setup("fire");
		const aim = scene.aim;

		aim._onTouchStart(705, 500);
		input._beginFrame();
		expect(input.isPressed("fire")).toBe(false);
	});

	it("releases fire action on touch end", () => {
		const { input, scene } = setup("fire");
		const aim = scene.aim;

		aim._onTouchStart(730, 500);
		input._beginFrame();
		expect(input.isPressed("fire")).toBe(true);

		aim._onTouchEnd();
		input._beginFrame();
		expect(input.isPressed("fire")).toBe(false);
	});

	it("onDraw executes without error", () => {
		const { scene } = setup();
		const aim = scene.aim;
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
		aim.onDraw(ctx);
		aim._onTouchStart(750, 500);
		aim.onDraw(ctx);
	});
});
