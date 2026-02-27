import { Game, type GameOptions, Scene } from "@quintus/core";
import { getInput, InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { VirtualButton } from "./virtual-button.js";

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null, ...opts });
}

function setup() {
	const game = createGame();
	game.use(InputPlugin({ actions: { jump: ["Space"] } }));
	const input = getInput(game)!;

	class TestScene extends Scene {
		btn!: VirtualButton;
		override onReady() {
			this.btn = new VirtualButton({
				position: new Vec2(700, 500),
				radius: 30,
				action: "jump",
				label: "A",
			});
			this.add(this.btn);
		}
	}

	game.start(TestScene);
	return { game, input, scene: game.currentScene as TestScene };
}

describe("VirtualButton", () => {
	it("injects action true on touch start, false on touch end", () => {
		const { input, scene } = setup();
		const btn = scene.btn;

		btn._onTouchStart(700, 500);
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(true);

		btn._onTouchEnd();
		input._beginFrame();
		expect(input.isPressed("jump")).toBe(false);
	});

	it("tracks pressed state", () => {
		const { scene } = setup();
		const btn = scene.btn;
		expect(btn.pressed).toBe(false);
		btn._onTouchStart(700, 500);
		expect(btn.pressed).toBe(true);
		btn._onTouchEnd();
		expect(btn.pressed).toBe(false);
	});

	it("containsPoint — hit inside radius", () => {
		const { scene } = setup();
		const btn = scene.btn;
		expect(btn.containsPoint(700, 500)).toBe(true);
		expect(btn.containsPoint(725, 500)).toBe(true);
	});

	it("containsPoint — generous zone (1.3x)", () => {
		const { scene } = setup();
		const btn = scene.btn;
		// radius=30, generous=39. Point at distance 35 should still hit.
		expect(btn.containsPoint(735, 500)).toBe(true);
	});

	it("containsPoint — miss outside generous zone", () => {
		const { scene } = setup();
		const btn = scene.btn;
		// radius=30, generous=39. Point at distance 50 should miss.
		expect(btn.containsPoint(750, 500)).toBe(false);
	});

	it("onDraw executes without error", () => {
		const { scene } = setup();
		const btn = scene.btn;
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
		btn.onDraw(ctx);
		btn._onTouchStart(700, 500);
		btn.onDraw(ctx);
	});
});
