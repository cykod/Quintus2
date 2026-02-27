import { Game, type GameOptions } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { describe, expect, it } from "vitest";
import type { VirtualButton } from "../virtual-button.js";
import type { VirtualJoystick } from "../virtual-joystick.js";
import { topDownLayout } from "./top-down-layout.js";

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null, ...opts });
}

describe("topDownLayout", () => {
	it("creates joystick + 1 default action button", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { move_left: [], move_right: [], fire: [] } }));
		const factory = topDownLayout();
		const controls = factory(game).createControls(game);
		expect(controls).toHaveLength(2);
	});

	it("joystick is on lower-left", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { move_left: [], move_right: [] } }));
		const factory = topDownLayout();
		const controls = factory(game).createControls(game);
		const joystick = controls[0] as VirtualJoystick;

		expect(joystick.position.x).toBeLessThan(game.width / 2);
		expect(joystick.position.y).toBeGreaterThan(game.height / 2);
	});

	it("action buttons are on lower-right", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { move_left: [], fire: [] } }));
		const factory = topDownLayout();
		const controls = factory(game).createControls(game);
		const btn = controls[1] as VirtualButton;

		expect(btn.position.x).toBeGreaterThan(game.width / 2);
		expect(btn.position.y).toBeGreaterThan(game.height / 2);
	});

	it("respects custom action list", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { move_left: [], attack: [], block: [] } }));
		const factory = topDownLayout({
			actions: [
				{ action: "attack", label: "ATK" },
				{ action: "block", label: "BLK" },
			],
		});
		const controls = factory(game).createControls(game);
		// 1 joystick + 2 buttons
		expect(controls).toHaveLength(3);
		expect((controls[1] as VirtualButton).action).toBe("attack");
		expect((controls[2] as VirtualButton).action).toBe("block");
	});

	it("arranges 4 buttons in a 2x2 grid", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { a: [], b: [], c: [], d: [] } }));
		const factory = topDownLayout({
			actions: [
				{ action: "a", label: "A" },
				{ action: "b", label: "B" },
				{ action: "c", label: "C" },
				{ action: "d", label: "D" },
			],
		});
		const controls = factory(game).createControls(game);
		// 1 joystick + 4 buttons
		expect(controls).toHaveLength(5);

		// All buttons should be in the right half
		for (let i = 1; i <= 4; i++) {
			expect((controls[i] as VirtualButton).position.x).toBeGreaterThan(game.width / 2);
		}
	});

	it("joystick uses move_ directional actions", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { move_left: [] } }));
		const factory = topDownLayout();
		const controls = factory(game).createControls(game);
		const joystick = controls[0] as VirtualJoystick;

		expect(joystick.actions.left).toBe("move_left");
		expect(joystick.actions.right).toBe("move_right");
		expect(joystick.actions.up).toBe("move_up");
		expect(joystick.actions.down).toBe("move_down");
	});

	it("respects custom moveActions", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { left: [], right: [], up: [], down: [] } }));
		const factory = topDownLayout({
			moveActions: { left: "left", right: "right", up: "up", down: "down" },
		});
		const controls = factory(game).createControls(game);
		const joystick = controls[0] as VirtualJoystick;

		expect(joystick.actions.left).toBe("left");
		expect(joystick.actions.right).toBe("right");
		expect(joystick.actions.up).toBe("up");
		expect(joystick.actions.down).toBe("down");
	});

	it("partially overrides moveActions with defaults for the rest", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { left: [], move_right: [] } }));
		const factory = topDownLayout({
			moveActions: { left: "left" },
		});
		const controls = factory(game).createControls(game);
		const joystick = controls[0] as VirtualJoystick;

		expect(joystick.actions.left).toBe("left");
		expect(joystick.actions.right).toBe("move_right");
		expect(joystick.actions.up).toBe("move_up");
		expect(joystick.actions.down).toBe("move_down");
	});
});
