import { Game, type GameOptions } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { describe, expect, it } from "vitest";
import type { VirtualAimStick } from "../virtual-aim-stick.js";
import type { VirtualButton } from "../virtual-button.js";
import type { VirtualJoystick } from "../virtual-joystick.js";
import { dualStickLayout } from "./dual-stick-layout.js";

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null, ...opts });
}

describe("dualStickLayout", () => {
	it("creates 2 controls by default (move stick + aim stick)", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { move_left: [], move_right: [] } }));
		const factory = dualStickLayout();
		const controls = factory(game).createControls(game);
		expect(controls).toHaveLength(2);
	});

	it("move joystick is on lower-left", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: {} }));
		const factory = dualStickLayout();
		const controls = factory(game).createControls(game);
		const moveStick = controls[0] as VirtualJoystick;

		expect(moveStick.position.x).toBeLessThan(game.width / 2);
		expect(moveStick.position.y).toBeGreaterThan(game.height / 2);
	});

	it("aim stick is on lower-right", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: {} }));
		const factory = dualStickLayout();
		const controls = factory(game).createControls(game);
		const aimStick = controls[1] as VirtualAimStick;

		expect(aimStick.position.x).toBeGreaterThan(game.width / 2);
		expect(aimStick.position.y).toBeGreaterThan(game.height / 2);
	});

	it("passes fireAction to aim stick", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { fire: [] } }));
		const factory = dualStickLayout({ fireAction: "fire" });
		const controls = factory(game).createControls(game);
		const aimStick = controls[1] as VirtualAimStick;

		expect(aimStick.fireAction).toBe("fire");
	});

	it("passes aimFrom and aimDistance to aim stick", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: {} }));
		const factory = dualStickLayout({ aimFrom: "Player", aimDistance: 300 });
		const controls = factory(game).createControls(game);
		const aimStick = controls[1] as VirtualAimStick;

		expect(aimStick.aimFrom).toBe("Player");
		expect(aimStick.aimDistance).toBe(300);
	});

	it("adds weapon buttons above move stick", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { weapon1: [], weapon2: [] } }));
		const factory = dualStickLayout({
			weaponButtons: [
				{ action: "weapon1", label: "1" },
				{ action: "weapon2", label: "2" },
			],
		});
		const controls = factory(game).createControls(game);
		// 2 sticks + 2 buttons
		expect(controls).toHaveLength(4);
		expect((controls[2] as VirtualButton).action).toBe("weapon1");
		expect((controls[3] as VirtualButton).action).toBe("weapon2");
	});

	it("weapon buttons are positioned above the move stick area", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { w1: [] } }));
		const factory = dualStickLayout({
			weaponButtons: [{ action: "w1", label: "W" }],
		});
		const controls = factory(game).createControls(game);
		const moveStick = controls[0] as VirtualJoystick;
		const weaponBtn = controls[2] as VirtualButton;

		// Weapon button should be above the joystick
		expect(weaponBtn.position.y).toBeLessThan(moveStick.position.y);
		// And on the left side
		expect(weaponBtn.position.x).toBeLessThan(game.width / 2);
	});

	it("move joystick uses move_ directional actions", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: {} }));
		const factory = dualStickLayout();
		const controls = factory(game).createControls(game);
		const moveStick = controls[0] as VirtualJoystick;

		expect(moveStick.actions.left).toBe("move_left");
		expect(moveStick.actions.right).toBe("move_right");
		expect(moveStick.actions.up).toBe("move_up");
		expect(moveStick.actions.down).toBe("move_down");
	});
});
