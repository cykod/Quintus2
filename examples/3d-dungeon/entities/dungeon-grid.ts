import { TileMap3D } from "@quintus/three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { TILE_SIZE } from "../config.js";

const TILE_FLOOR = 1;
const TILE_WALL = 2;

/** Maps level-data characters → tile IDs for the instanced grid.
 *  Non-wall characters all place a floor tile. */
const CHAR_MAP: Record<string, number> = {
	".": TILE_FLOOR,
	"#": TILE_WALL,
	P: TILE_FLOOR,
	C: TILE_FLOOR,
	T: TILE_FLOOR,
	E: TILE_FLOOR,
};

export class DungeonGrid extends TileMap3D {
	override tileSize = TILE_SIZE;

	/** Original character grid for game-logic lookups. */
	private _charGrid: string[][] = [];

	/**
	 * Parse a level from string lines.
	 * Defines tile types (from GLTF or fallback), fills grid, and rebuilds.
	 */
	parseLevel(lines: string[]): void {
		this._charGrid = lines.map((l) => l.split(""));
		this._defineTiles();
		this.parseGrid(lines, CHAR_MAP);
	}

	/** Get the original character at a grid position. */
	charAt(gx: number, gz: number): string {
		return this._charGrid[gz]?.[gx] ?? "#";
	}

	/** Check if a grid position is walkable (not a wall, in bounds). */
	isWalkable(gx: number, gz: number): boolean {
		return this.isInBounds(gx, gz) && this.charAt(gx, gz) !== "#";
	}

	/** Find the first occurrence of a character. */
	findChar(ch: string): { gridX: number; gridZ: number } | null {
		for (let z = 0; z < this._charGrid.length; z++) {
			const row = this._charGrid[z];
			if (!row) continue;
			for (let x = 0; x < row.length; x++) {
				if (row[x] === ch) return { gridX: x, gridZ: z };
			}
		}
		return null;
	}

	/** Find all occurrences of a character. */
	findAllChars(ch: string): Array<{ gridX: number; gridZ: number }> {
		const results: Array<{ gridX: number; gridZ: number }> = [];
		for (let z = 0; z < this._charGrid.length; z++) {
			const row = this._charGrid[z];
			if (!row) continue;
			for (let x = 0; x < row.length; x++) {
				if (row[x] === ch) {
					results.push({ gridX: x, gridZ: z });
				}
			}
		}
		return results;
	}

	/** Mark a cell as plain floor (e.g. after collecting a coin). */
	clearCell(gx: number, gz: number): void {
		const row = this._charGrid[gz];
		if (row && gx >= 0 && gx < row.length) {
			row[gx] = ".";
		}
	}

	private _defineTiles(): void {
		const floorGltf = this.game.assets.get<GLTF>("floor");
		const wallGltf = this.game.assets.get<GLTF>("wall");
		if (floorGltf) {
			this.defineTileFromGLTF(TILE_FLOOR, floorGltf.scene, {
				receiveShadow: true,
			});
		}
		if (wallGltf) {
			this.defineTileFromGLTF(TILE_WALL, wallGltf.scene, {
				castShadow: true,
				receiveShadow: true,
			});
		}
	}
}
