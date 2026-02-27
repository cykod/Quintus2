import { Node } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import {
	GRID_COLS,
	GRID_ROWS,
	TOWER_ARROW_COST,
	TOWER_CANNON_COST,
	TOWER_SLOW_COST,
} from "../config.js";
import { gridToWorld } from "../path.js";
import { gameState, type TowerType } from "../state.js";
import { ArrowTower } from "./arrow-tower.js";
import { CannonTower } from "./cannon-tower.js";
import { SlowTower } from "./slow-tower.js";
import type { TowerBase } from "./tower-base.js";

const TOWER_COSTS: Record<TowerType, number> = {
	arrow: TOWER_ARROW_COST,
	cannon: TOWER_CANNON_COST,
	slow: TOWER_SLOW_COST,
};

export class PlacementManager extends Node {
	/** Grid cells where towers can be placed (whitelist). */
	validCells: Set<string> = new Set();
	/** Grid cells occupied by placed towers. */
	occupiedCells: Set<string> = new Set();

	override onFixedUpdate(_dt: number) {
		if (!this.game.input.isJustPressed("select")) return;

		const mousePos = this.game.input.mousePosition;
		if (!mousePos) return;

		// Convert screen position to grid coordinates using GRID_OFFSET (16) and CELL_SIZE (64)
		const col = Math.floor((mousePos.x - 16) / 64);
		const row = Math.floor((mousePos.y - 16) / 64);

		this._tryPlace(col, row);
	}

	private _tryPlace(col: number, row: number): boolean {
		// Validate grid bounds
		if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;

		const key = `${col},${row}`;

		// Can only place on designated placement cells
		if (!this.validCells.has(key)) return false;

		// Cannot place on occupied cell
		if (this.occupiedCells.has(key)) return false;

		const towerType = gameState.selectedTower;
		if (!towerType) return false;

		// Check gold
		const cost = TOWER_COSTS[towerType];
		if (gameState.gold < cost) return false;

		// Place the tower
		const tower = this._createTower(towerType);
		const worldPos = gridToWorld(col, row);
		tower.position = new Vec2(worldPos.x, worldPos.y);
		this.scene?.add(tower);

		this.occupiedCells.add(key);
		gameState.gold -= cost;

		this.game.audio.play("place", { volume: 0.5 });

		return true;
	}

	private _createTower(type: TowerType): TowerBase {
		switch (type) {
			case "cannon":
				return new CannonTower();
			case "slow":
				return new SlowTower();
			default:
				return new ArrowTower();
		}
	}

	/** Attempt to place a tower at a grid cell (used by tests). */
	placeAt(col: number, row: number): boolean {
		return this._tryPlace(col, row);
	}
}
