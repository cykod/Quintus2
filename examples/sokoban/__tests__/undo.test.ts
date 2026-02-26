import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { SokobanLevel } from "../scenes/sokoban-level.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

describe("Sokoban — Undo & Reset", () => {
	it("undo reverses a move", async () => {
		const result = await runScene(
			SokobanLevel,
			InputScript.create().wait(6).tap("move_up").wait(6).tap("undo"),
			0.5,
		);
		const scene = result.game.currentScene as SokobanLevel;
		const grid = scene.getGrid();
		expect(grid.player).toEqual({ x: 2, y: 4 });
		expect(gameState.moves).toBe(0);
	});

	it("undo reverses a crate push", async () => {
		const result = await runScene(
			SokobanLevel,
			InputScript.create()
				.wait(6)
				.tap("move_up") // (2,3)
				.wait(6)
				.tap("move_up") // push crate, player at (2,2)
				.wait(6)
				.tap("undo"), // undo push
			1.0,
		);
		const scene = result.game.currentScene as SokobanLevel;
		const grid = scene.getGrid();
		expect(grid.player).toEqual({ x: 2, y: 3 });
		expect(grid.crates[0]).toEqual({ x: 2, y: 2 });
		expect(gameState.moves).toBe(1);
	});

	it("reset restores level to initial state", async () => {
		const result = await runScene(
			SokobanLevel,
			InputScript.create().wait(6).tap("move_up").wait(6).tap("move_up").wait(6).tap("reset"),
			1.0,
		);
		const scene = result.game.currentScene as SokobanLevel;
		const grid = scene.getGrid();
		expect(grid.player).toEqual({ x: 2, y: 4 });
		expect(grid.crates[0]).toEqual({ x: 2, y: 2 });
		expect(gameState.moves).toBe(0);
	});
});
