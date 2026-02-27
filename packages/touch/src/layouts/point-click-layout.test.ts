import { Game, type GameOptions } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import type { VirtualButton } from "../virtual-button.js";
import { pointClickLayout } from "./point-click-layout.js";

function createGame(opts: Partial<GameOptions> = {}): Game {
	const canvas = document.createElement("canvas");
	return new Game({ width: 800, height: 600, canvas, renderer: null, ...opts });
}

describe("pointClickLayout", () => {
	it("creates no controls by default", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: {} }));
		const factory = pointClickLayout();
		const controls = factory(game).createControls(game);
		expect(controls).toHaveLength(0);
	});

	it("creates buttons when configured", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { build: [], sell: [] } }));
		const factory = pointClickLayout({
			buttons: [
				{ action: "build", label: "Build", position: new Vec2(50, 50) },
				{ action: "sell", label: "Sell", position: new Vec2(120, 50) },
			],
		});
		const controls = factory(game).createControls(game);
		expect(controls).toHaveLength(2);
	});

	it("buttons have correct actions and positions", () => {
		const game = createGame();
		game.use(InputPlugin({ actions: { menu: [] } }));
		const factory = pointClickLayout({
			buttons: [{ action: "menu", label: "Menu", position: new Vec2(750, 30) }],
		});
		const controls = factory(game).createControls(game) as VirtualButton[];
		expect(controls[0].action).toBe("menu");
		expect(controls[0].label).toBe("Menu");
		expect(controls[0].position.x).toBe(750);
		expect(controls[0].position.y).toBe(30);
	});
});
