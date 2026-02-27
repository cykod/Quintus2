import { Game, type GameOptions, Scene } from "@quintus/core";
import { getInput, InputPlugin } from "@quintus/input";
import { describe, expect, it } from "vitest";
import { TouchFollowZone } from "../touch-follow-zone.js";
import type { VirtualButton } from "../virtual-button.js";
import { breakoutLayout } from "./breakout-layout.js";

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 480, height: 640, canvas, renderer: null, ...opts });
}

describe("breakoutLayout", () => {
	it("creates 3 controls (left, right, follow zone)", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { left: [], right: [], launch: [] } }));
		const factory = breakoutLayout();
		const controls = factory(game).createControls(game);
		expect(controls).toHaveLength(3);
	});

	it("TouchFollowZone is the last control", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { left: [], right: [], launch: [] } }));
		const factory = breakoutLayout();
		const controls = factory(game).createControls(game);
		expect(controls[controls.length - 1]).toBeInstanceOf(TouchFollowZone);
	});

	it("uses default action names", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { left: [], right: [], launch: [] } }));
		const factory = breakoutLayout();
		const controls = factory(game).createControls(game);

		expect((controls[0] as VirtualButton).action).toBe("left");
		expect((controls[1] as VirtualButton).action).toBe("right");
	});

	it("respects custom action names", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { move_l: [], move_r: [], fire: [] } }));
		const factory = breakoutLayout({
			leftAction: "move_l",
			rightAction: "move_r",
			launchAction: "fire",
		});
		const controls = factory(game).createControls(game);

		expect((controls[0] as VirtualButton).action).toBe("move_l");
		expect((controls[1] as VirtualButton).action).toBe("move_r");
		expect((controls[2] as TouchFollowZone).tapAction).toBe("fire");
	});

	it("left button is on lower-left, right on lower-right", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { left: [], right: [], launch: [] } }));
		const factory = breakoutLayout();
		const controls = factory(game).createControls(game);

		const leftBtn = controls[0] as VirtualButton;
		const rightBtn = controls[1] as VirtualButton;

		expect(leftBtn.position.x).toBeLessThan(game.width / 2);
		expect(rightBtn.position.x).toBeGreaterThan(game.width / 2);
	});

	it("passes followY to TouchFollowZone", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { left: [], right: [], launch: [] } }));
		const factory = breakoutLayout({ followY: 550 });
		const controls = factory(game).createControls(game);

		const zone = controls[2] as TouchFollowZone;
		expect(zone.followY).toBe(550);
	});

	it("follow zone tapAction defaults to launch", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { left: [], right: [], launch: [] } }));
		const factory = breakoutLayout();
		const controls = factory(game).createControls(game);

		const zone = controls[2] as TouchFollowZone;
		expect(zone.tapAction).toBe("launch");
	});

	it("TouchFollowZone sets mouse position and injects launch on tap", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { left: [], right: [], launch: [] } }));
		const input = getInput(game)!;

		class TestScene extends Scene {
			override onReady() {
				const factory = breakoutLayout({ followY: 550 });
				const layout = factory(game);
				const controls = layout.createControls(game);
				for (const ctrl of controls) this.add(ctrl);
			}
		}

		game.start(TestScene);

		const scene = game.currentScene as TestScene;
		const children = scene.children;
		const zone = children.find((c) => c instanceof TouchFollowZone) as TouchFollowZone;

		zone._onTouchStart(200, 300);
		input._beginFrame();
		expect(input.mousePosition.x).toBe(200);
		expect(input.mousePosition.y).toBe(550);
		expect(input.isPressed("launch")).toBe(true);

		zone._onTouchEnd();
		input._beginFrame();
		expect(input.isPressed("launch")).toBe(false);
	});
});
