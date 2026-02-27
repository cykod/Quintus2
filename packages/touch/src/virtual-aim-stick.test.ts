import { Game, type GameOptions, Node2D, Scene } from "@quintus/core";
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

	it("clamps knob offset to radius when touch is outside", () => {
		const { scene } = setup();
		const aim = scene.aim;

		// Touch far outside radius (50 units to the right)
		aim._onTouchStart(800, 500); // 100 units right of center (700, 500), radius is 50
		expect(aim.knobOffset.x).toBeCloseTo(50, 0); // clamped to radius
		expect(aim.knobOffset.y).toBeCloseTo(0, 0);
	});

	it("does not clamp knob when touch is within radius", () => {
		const { scene } = setup();
		const aim = scene.aim;

		aim._onTouchStart(730, 500); // 30 units right, within radius of 50
		expect(aim.knobOffset.x).toBeCloseTo(30, 0);
		expect(aim.knobOffset.y).toBeCloseTo(0, 0);
	});

	it("updates knob on touch move", () => {
		const { scene } = setup();
		const aim = scene.aim;

		aim._onTouchStart(730, 500);
		expect(aim.knobOffset.x).toBeCloseTo(30, 0);

		aim._onTouchMove(700, 530); // moved to directly below center
		expect(aim.knobOffset.x).toBeCloseTo(0, 0);
		expect(aim.knobOffset.y).toBeCloseTo(30, 0);
	});

	it("ignores touch move when not active", () => {
		const { scene } = setup();
		const aim = scene.aim;

		aim._onTouchMove(730, 500);
		expect(aim.knobOffset.x).toBe(0);
		expect(aim.knobOffset.y).toBe(0);
	});

	it("releases fire action when moving back into dead zone", () => {
		const { input, scene } = setup("fire");
		const aim = scene.aim;

		// Move outside dead zone (distance > 0.2 * 50 = 10)
		aim._onTouchStart(730, 500); // 30 units, > dead zone
		input._beginFrame();
		expect(input.isPressed("fire")).toBe(true);

		// Move back inside dead zone
		aim._onTouchMove(703, 500); // 3 units, < 10 = dead zone
		input._beginFrame();
		expect(input.isPressed("fire")).toBe(false);
	});

	it("updates aim position from aimFrom node", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { fire: [] } }));
		const input = getInput(game)!;

		class AimTarget extends Node2D {}

		class TestScene extends Scene {
			aim!: VirtualAimStick;
			override onReady() {
				const target = new AimTarget();
				target.name = "Player";
				target.position._set(100, 100);
				this.add(target);

				this.aim = new VirtualAimStick({
					position: new Vec2(700, 500),
					radius: 50,
					deadZone: 0.2,
					fireAction: "fire",
					aimFrom: "Player",
					aimDistance: 200,
				});
				this.add(this.aim);
			}
		}

		game.start(TestScene);
		const scene = game.currentScene as TestScene;
		const aim = scene.aim;

		// Touch outside dead zone to the right
		aim._onTouchStart(750, 500);

		// The mouse position should be updated based on Player position + direction * aimDistance
		// Direction is (1, 0) (pure right), Player is at (100, 100), aimDistance = 200
		// So mouse should be at approximately (300, 100)
		const mousePos = input.mousePosition;
		expect(mousePos.x).toBeCloseTo(300, 0);
		expect(mousePos.y).toBeCloseTo(100, 0);

		game.stop();
	});
});
