import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { SokobanLevel } from "../scenes/sokoban-level.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

describe("Sokoban — Crate Push", () => {
	it("pushing crate updates grid state", async () => {
		// Level 1: crate at (2,2), player at (2,4)
		// Move up twice: first to (2,3), then push crate to (2,1)
		const result = await runScene(
			SokobanLevel,
			InputScript.create().wait(6).tap("move_up").wait(6).tap("move_up"),
			0.5,
		);
		const scene = result.game.currentScene as SokobanLevel;
		const grid = scene.getGrid();
		expect(grid.player).toEqual({ x: 2, y: 2 });
		expect(grid.crates[0]).toEqual({ x: 2, y: 1 });
		expect(gameState.moves).toBe(2);
	});

	it("cannot push crate into wall", async () => {
		// Level 1: push crate to (2,1) then try to push to (2,0) which is wall
		const result = await runScene(
			SokobanLevel,
			InputScript.create()
				.wait(6)
				.tap("move_up")
				.wait(6)
				.tap("move_up") // push to (2,1)
				.wait(6)
				.tap("move_up"), // blocked
			1.0,
		);
		const scene = result.game.currentScene as SokobanLevel;
		const grid = scene.getGrid();
		expect(grid.player).toEqual({ x: 2, y: 2 });
		expect(grid.crates[0]).toEqual({ x: 2, y: 1 });
		expect(gameState.moves).toBe(2); // only 2 successful moves
	});
});
