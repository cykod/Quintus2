import { Node2D } from "@quintus/core";
import { Sprite } from "@quintus/sprites";
import { CELL_SIZE } from "../config.js";
import type { SokobanGrid } from "../grid.js";
import { FRAME_FLOOR, FRAME_TARGET, FRAME_WALL, tileSheet } from "../sprites.js";

/**
 * Renders the static grid: floor, wall, and target tiles.
 * Positioned so that (0,0) is the top-left of the grid.
 */
export class GridRenderer extends Node2D {
	private _grid: SokobanGrid | null = null;

	setGrid(grid: SokobanGrid): void {
		this._grid = grid;
		this._buildTiles();
	}

	private _buildTiles(): void {
		const grid = this._grid;
		if (!grid) return;

		// Remove any previous tiles
		for (const child of [...this.children]) {
			child.destroy();
		}

		for (let y = 0; y < grid.height; y++) {
			for (let x = 0; x < grid.width; x++) {
				const pos = { x, y };
				const worldX = x * CELL_SIZE + CELL_SIZE / 2;
				const worldY = y * CELL_SIZE + CELL_SIZE / 2;

				if (grid.isWall(pos)) {
					this._addTile(worldX, worldY, FRAME_WALL);
				} else {
					// Floor under everything
					this._addTile(worldX, worldY, FRAME_FLOOR);
					// Target marker on top
					if (grid.isTarget(pos)) {
						this._addTile(worldX, worldY, FRAME_TARGET);
					}
				}
			}
		}
	}

	private _addTile(x: number, y: number, frame: number): void {
		const sprite = new Sprite();
		sprite.texture = "tileset";
		sprite.sourceRect = tileSheet.getFrameRect(frame);
		sprite.position._set(x, y);
		this.add(sprite);
	}
}
