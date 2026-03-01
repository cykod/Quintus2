import "@quintus/tilemap/physics";
import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import { Rect } from "@quintus/math";
import { TileMap } from "@quintus/tilemap";
import { Player } from "../entities/player.js";

/**
 * Test scene: tilemap rendering, collision, and player character.
 */
export class TestScene extends Scene {
	protected player!: Player;
	protected map!: TileMap;

	override build() {
		return (
			<>
				<TileMap ref="map" tilesetImage="tiles" asset="level1" />
				<Player ref="player" />
				<Camera follow="$player" smoothing={0.1} zoom={1} />
			</>
		);
	}

	override onReady() {
		// Generate collision from the main tile layer
		const oneWayIds = this.map.getTileIdsByProperty("oneWay", true);
		this.map.generateCollision({
			layer: "main",
			allSolid: true,
			collisionGroup: "world",
			oneWayTileIds: oneWayIds,
			tileShapeColliders: true,
		});

		// Position player at the spawn point
		this.player.position = this.map.getSpawnPoint("player_start");

		// Camera bounds
		const camera = this.findFirst(Camera);
		if (camera) {
			camera.bounds = new Rect(0, 0, this.map.bounds.width, this.map.bounds.height);
		}
	}
}
