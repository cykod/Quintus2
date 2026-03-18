import { Node3D } from "@quintus/three";
import { TILE_SIZE } from "../config.js";

/**
 * Base class for grid-positioned entities in the dungeon.
 * Manages the mapping between grid coordinates (gridX, gridZ) and world position.
 */
export class GridEntity3D extends Node3D {
	/** Tile size in world units. Default matches TILE_SIZE from config. */
	tileSize = TILE_SIZE;

	private _gridX = 0;
	private _gridZ = 0;

	/** Grid X coordinate. Setting this auto-updates world position.x. */
	get gridX(): number {
		return this._gridX;
	}

	set gridX(value: number) {
		this._gridX = value;
		this.position.x = value * this.tileSize;
	}

	/** Grid Z coordinate. Setting this auto-updates world position.z. */
	get gridZ(): number {
		return this._gridZ;
	}

	set gridZ(value: number) {
		this._gridZ = value;
		this.position.z = value * this.tileSize;
	}

	/**
	 * Set both grid coordinates at once. Updates world position.
	 */
	setGridPosition(x: number, z: number): void {
		this._gridX = x;
		this._gridZ = z;
		this.position.x = x * this.tileSize;
		this.position.z = z * this.tileSize;
	}

	/**
	 * Manhattan distance to another grid entity.
	 */
	gridDistanceTo(other: { gridX: number; gridZ: number }): number {
		return Math.abs(this._gridX - other.gridX) + Math.abs(this._gridZ - other.gridZ);
	}
}
