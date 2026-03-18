import { FogOverlay3D } from "@quintus/three";
import { FOG_HIDDEN_OPACITY, FOG_SIGHT_RANGE, FOG_VISITED_OPACITY } from "../config.js";

/** Height of fog cubes — tall enough to cover wall tops. */
const FOG_CUBE_HEIGHT = 2.0;

/**
 * Fog of war overlay — hides tiles beyond the player's sight range.
 * Extends FogOverlay3D from the engine.
 */
export class FogOfWar extends FogOverlay3D {
	override sightRange = FOG_SIGHT_RANGE;
	override hiddenOpacity = FOG_HIDDEN_OPACITY;
	override visitedOpacity = FOG_VISITED_OPACITY;
	override height = FOG_CUBE_HEIGHT;

	/**
	 * Initialize the fog grid. Call once after the dungeon grid is parsed.
	 * Fog covers interior tiles (including interior walls) but skips edge walls.
	 * @param width Grid width in tiles
	 * @param height Grid height in tiles
	 */
	init(width: number, height: number, _wallGrid?: boolean[][]): void {
		// Build an edge-only exclusion grid: skip only the border tiles
		const edgeGrid = Array.from({ length: height }, (_, z) =>
			Array.from(
				{ length: width },
				(_, x) => z === 0 || z === height - 1 || x === 0 || x === width - 1,
			),
		);
		this.setSize(width, height, edgeGrid);
	}

	/**
	 * Update fog based on the player's current grid position.
	 */
	updatePlayerPosition(gridX: number, gridZ: number): void {
		this.updateVisibility(gridX, gridZ);
	}
}
