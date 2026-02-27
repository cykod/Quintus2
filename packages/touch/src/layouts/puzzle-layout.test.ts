import { Game, type GameOptions } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { describe, expect, it } from "vitest";
import type { VirtualButton } from "../virtual-button.js";
import type { VirtualDPad } from "../virtual-dpad.js";
import { puzzleLayout } from "./puzzle-layout.js";

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null, ...opts });
}

describe("puzzleLayout", () => {
	it("creates 1 D-pad by default", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { move_left: [] } }));
		const factory = puzzleLayout();
		const controls = factory(game).createControls(game);
		expect(controls).toHaveLength(1);
	});

	it("D-pad is on lower-right", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: {} }));
		const factory = puzzleLayout();
		const controls = factory(game).createControls(game);
		const dpad = controls[0] as VirtualDPad;

		expect(dpad.position.x).toBeGreaterThan(game.width / 2);
		expect(dpad.position.y).toBeGreaterThan(game.height / 2);
	});

	it("D-pad uses move_ directional actions", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: {} }));
		const factory = puzzleLayout();
		const controls = factory(game).createControls(game);
		const dpad = controls[0] as VirtualDPad;

		expect(dpad.actions.left).toBe("move_left");
		expect(dpad.actions.right).toBe("move_right");
		expect(dpad.actions.up).toBe("move_up");
		expect(dpad.actions.down).toBe("move_down");
	});

	it("adds utility buttons on lower-left", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { undo: [], reset: [] } }));
		const factory = puzzleLayout({
			buttons: [
				{ action: "undo", label: "Undo" },
				{ action: "reset", label: "Reset" },
			],
		});
		const controls = factory(game).createControls(game);
		// 1 D-pad + 2 buttons
		expect(controls).toHaveLength(3);
		expect((controls[1] as VirtualButton).action).toBe("undo");
		expect((controls[2] as VirtualButton).action).toBe("reset");
	});

	it("utility buttons are on the left side", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { undo: [] } }));
		const factory = puzzleLayout({
			buttons: [{ action: "undo", label: "U" }],
		});
		const controls = factory(game).createControls(game);
		const btn = controls[1] as VirtualButton;

		expect(btn.position.x).toBeLessThan(game.width / 2);
		expect(btn.position.y).toBeGreaterThan(game.height / 2);
	});
});
