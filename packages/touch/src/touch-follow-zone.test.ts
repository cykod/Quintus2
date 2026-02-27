import { Game, type GameOptions, Scene } from "@quintus/core";
import { getInput, InputPlugin } from "@quintus/input";
import { describe, expect, it } from "vitest";
import { TouchFollowZone } from "./touch-follow-zone.js";

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null, ...opts });
}

function setup(followY?: number) {
	const game = createGame();
	game.use(InputPlugin({ actions: {} }));
	const input = getInput(game)!;

	class TestScene extends Scene {
		zone!: TouchFollowZone;
		override onReady() {
			this.zone = new TouchFollowZone(followY !== undefined ? { followY } : undefined);
			this.add(this.zone);
		}
	}

	game.start(TestScene);
	return { game, input, scene: game.currentScene as TestScene };
}

describe("TouchFollowZone", () => {
	it("containsPoint always returns true", () => {
		const { scene } = setup();
		const zone = scene.zone;
		expect(zone.containsPoint(0, 0)).toBe(true);
		expect(zone.containsPoint(400, 300)).toBe(true);
		expect(zone.containsPoint(9999, 9999)).toBe(true);
		expect(zone.containsPoint(-100, -100)).toBe(true);
	});

	it("starts inactive", () => {
		const { scene } = setup();
		expect(scene.zone.active).toBe(false);
	});

	it("becomes active on touch start", () => {
		const { scene } = setup();
		scene.zone._onTouchStart(400, 300);
		expect(scene.zone.active).toBe(true);
	});

	it("becomes inactive on touch end", () => {
		const { scene } = setup();
		scene.zone._onTouchStart(400, 300);
		scene.zone._onTouchEnd();
		expect(scene.zone.active).toBe(false);
	});

	it("sets mouse position on touch start", () => {
		const { input, scene } = setup();
		scene.zone._onTouchStart(250, 300);
		input._beginFrame();
		expect(input.mousePosition.x).toBe(250);
		expect(input.mousePosition.y).toBe(300);
	});

	it("updates mouse position on touch move", () => {
		const { input, scene } = setup();
		scene.zone._onTouchStart(250, 300);
		scene.zone._onTouchMove(400, 350);
		input._beginFrame();
		expect(input.mousePosition.x).toBe(400);
		expect(input.mousePosition.y).toBe(350);
	});

	it("uses fixed followY when configured", () => {
		const { input, scene } = setup(500);
		scene.zone._onTouchStart(250, 300);
		input._beginFrame();
		expect(input.mousePosition.x).toBe(250);
		expect(input.mousePosition.y).toBe(500);
	});

	it("ignores touch move when not active", () => {
		const { input, scene } = setup();
		scene.zone._onTouchMove(400, 300);
		input._beginFrame();
		// Mouse position should remain at default (0, 0)
		expect(input.mousePosition.x).toBe(0);
		expect(input.mousePosition.y).toBe(0);
	});

	it("injects tapAction on touch start and releases on touch end", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { launch: [] } }));
		const input = getInput(game)!;

		class TestScene extends Scene {
			zone!: TouchFollowZone;
			override onReady() {
				this.zone = new TouchFollowZone({ tapAction: "launch" });
				this.add(this.zone);
			}
		}

		game.start(TestScene);
		const scene = game.currentScene as TestScene;

		scene.zone._onTouchStart(200, 300);
		input._beginFrame();
		expect(input.isPressed("launch")).toBe(true);

		scene.zone._onTouchEnd();
		input._beginFrame();
		expect(input.isPressed("launch")).toBe(false);
	});

	it("does not inject when tapAction is not configured", () => {
		const { input, scene } = setup();
		scene.zone._onTouchStart(200, 300);
		input._beginFrame();
		// No action should be pressed — only mouse position updated
		expect(input.mousePosition.x).toBe(200);
	});
});
