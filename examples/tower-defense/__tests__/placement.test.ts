import { Scene } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { GRID_COLS, GRID_ROWS, STARTING_GOLD, TOWER_ARROW_COST } from "../config.js";
import { PlacementManager } from "../entities/placement-manager.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

class PlacementTestScene extends Scene {}

/** A few valid placement cells for testing. */
const TEST_VALID_CELLS = new Set(["0,4", "2,2", "5,1", "6,6"]);

describe("Placement", () => {
	it("can place tower on valid cell", async () => {
		const result = await runScene(PlacementTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const pm = new PlacementManager();
		pm.validCells = TEST_VALID_CELLS;
		scene.add(pm);
		result.game.step();

		gameState.selectedTower = "arrow";
		const placed = pm.placeAt(0, 4);

		expect(placed).toBe(true);
		expect(gameState.gold).toBe(STARTING_GOLD - TOWER_ARROW_COST);
	});

	it("cannot place on non-placement cell", async () => {
		const result = await runScene(PlacementTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const pm = new PlacementManager();
		pm.validCells = TEST_VALID_CELLS;
		scene.add(pm);
		result.game.step();

		gameState.selectedTower = "arrow";
		// (1,0) is not in the valid set
		const placed = pm.placeAt(1, 0);

		expect(placed).toBe(false);
		expect(gameState.gold).toBe(STARTING_GOLD); // gold unchanged
	});

	it("cannot place on occupied cell", async () => {
		const result = await runScene(PlacementTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const pm = new PlacementManager();
		pm.validCells = TEST_VALID_CELLS;
		scene.add(pm);
		result.game.step();

		gameState.selectedTower = "arrow";
		pm.placeAt(0, 4);

		// Try placing again on same cell
		const placed = pm.placeAt(0, 4);
		expect(placed).toBe(false);
	});

	it("cannot place when insufficient gold", async () => {
		const result = await runScene(PlacementTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const pm = new PlacementManager();
		pm.validCells = TEST_VALID_CELLS;
		scene.add(pm);
		result.game.step();

		gameState.gold = 0;
		gameState.selectedTower = "arrow";
		const placed = pm.placeAt(0, 4);

		expect(placed).toBe(false);
	});

	it("cannot place outside grid bounds", async () => {
		const result = await runScene(PlacementTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const pm = new PlacementManager();
		pm.validCells = TEST_VALID_CELLS;
		scene.add(pm);
		result.game.step();

		gameState.selectedTower = "arrow";
		expect(pm.placeAt(-1, 0)).toBe(false);
		expect(pm.placeAt(0, -1)).toBe(false);
		expect(pm.placeAt(GRID_COLS, 0)).toBe(false);
		expect(pm.placeAt(0, GRID_ROWS)).toBe(false);
	});

	it("gold deducted on placement", async () => {
		const result = await runScene(PlacementTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const pm = new PlacementManager();
		pm.validCells = TEST_VALID_CELLS;
		scene.add(pm);
		result.game.step();

		const goldBefore = gameState.gold;
		gameState.selectedTower = "arrow";
		pm.placeAt(0, 4);

		expect(gameState.gold).toBe(goldBefore - TOWER_ARROW_COST);
	});
});
