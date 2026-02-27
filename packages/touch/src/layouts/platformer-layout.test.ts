import { Game, type GameOptions, Scene } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { describe, expect, it } from "vitest";
import { TouchOverlay } from "../touch-overlay.js";
import type { VirtualButton } from "../virtual-button.js";
import { platformerLayout } from "./platformer-layout.js";

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null, ...opts });
}

describe("platformerLayout", () => {
	it("creates 3 controls (left, right, jump)", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { left: [], right: [], jump: [] } }));
		const factory = platformerLayout();
		const layout = factory(game);
		const controls = layout.createControls(game);
		expect(controls).toHaveLength(3);
	});

	it("positions arrows on lower-left, jump on lower-right", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { left: [], right: [], jump: [] } }));
		const factory = platformerLayout();
		const layout = factory(game);
		const controls = layout.createControls(game) as VirtualButton[];

		const leftBtn = controls[0];
		const rightBtn = controls[1];
		const jumpBtn = controls[2];

		// Left and right should be in the left half
		expect(leftBtn.position.x).toBeLessThan(game.width / 2);
		expect(rightBtn.position.x).toBeLessThan(game.width / 2);

		// Jump should be in the right half
		expect(jumpBtn.position.x).toBeGreaterThan(game.width / 2);

		// All should be in the lower half
		expect(leftBtn.position.y).toBeGreaterThan(game.height / 2);
		expect(rightBtn.position.y).toBeGreaterThan(game.height / 2);
		expect(jumpBtn.position.y).toBeGreaterThan(game.height / 2);
	});

	it("uses default jump action", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { left: [], right: [], jump: [] } }));
		const factory = platformerLayout();
		const layout = factory(game);
		const controls = layout.createControls(game) as VirtualButton[];
		expect(controls[2].action).toBe("jump");
	});

	it("respects custom jumpAction", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { left: [], right: [], leap: [] } }));
		const factory = platformerLayout({ jumpAction: "leap" });
		const layout = factory(game);
		const controls = layout.createControls(game) as VirtualButton[];
		expect(controls[2].action).toBe("leap");
	});

	it("scales proportionally to game dimensions", () => {
		const small = createGame({ width: 320, height: 240 });
		small.use(InputPlugin({ actions: { left: [], right: [], jump: [] } }));
		const big = createGame({ width: 1920, height: 1080 });
		big.use(InputPlugin({ actions: { left: [], right: [], jump: [] } }));

		const factory = platformerLayout();
		const smallControls = factory(small).createControls(small) as VirtualButton[];
		const bigControls = factory(big).createControls(big) as VirtualButton[];

		// Bigger game should have larger buttons
		expect(bigControls[0].radius).toBeGreaterThan(smallControls[0].radius);
	});

	it("works inside a TouchOverlay in a scene", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { left: [], right: [], jump: [] } }));
		const factory = platformerLayout();
		const layout = factory(game);

		class TestScene extends Scene {
			overlay!: TouchOverlay;
			override onReady() {
				this.overlay = new TouchOverlay();
				const controls = layout.createControls(game);
				for (const ctrl of controls) {
					this.overlay.addControl(ctrl as import("../virtual-control.js").VirtualControl);
				}
				this.add(this.overlay);
			}
		}

		game.start(TestScene);
		const scene = game.currentScene as TestScene;
		expect(scene.overlay.controls).toHaveLength(3);
	});
});
