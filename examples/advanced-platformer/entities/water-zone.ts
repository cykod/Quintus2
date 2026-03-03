import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import type { TileMap } from "@quintus/tilemap";

/**
 * Invisible sensor covering water/lava tile regions.
 * Instant death on overlap (handled by the scene's hazard callback).
 */
export class WaterZone extends Sensor {
	override collisionGroup = "hazards";

	/** If true, deals lethal damage (full health). */
	lethal = true;

	override onReady() {
		super.onReady();
		this.tag("hazard");
		this.tag("water");
	}
}

/**
 * Scan a tilemap layer for contiguous rectangular regions of water/lava tiles
 * and create WaterZone sensors for each column run.
 *
 * Water/lava tiles remain visible in the tilemap — only sensors are created.
 *
 * @param map The TileMap to scan.
 * @param layerName The tile layer to scan.
 * @returns Array of created WaterZone nodes.
 */
export function createWaterZones(map: TileMap, layerName: string): WaterZone[] {
	const waterIds = new Set([...map.getTileIdsByType("water"), ...map.getTileIdsByType("lava")]);
	if (waterIds.size === 0) return [];

	const tw = map.tileWidth;
	const th = map.tileHeight;
	const cols = Math.floor(map.bounds.width / tw);
	const rows = Math.floor(map.bounds.height / th);

	const zones: WaterZone[] = [];

	for (let col = 0; col < cols; col++) {
		let runStart = -1;

		for (let row = 0; row <= rows; row++) {
			const tileId = row < rows ? map.getTileAt(col, row, layerName) : 0;
			const isWater = waterIds.has(tileId);

			if (isWater && runStart === -1) {
				runStart = row;
			} else if (!isWater && runStart !== -1) {
				const runHeight = row - runStart;
				const zone = new WaterZone();

				const worldX = col * tw + tw / 2;
				const worldYTop = runStart * th;
				const zoneHeight = runHeight * th;

				zone.position.x = worldX;
				zone.position.y = worldYTop + zoneHeight / 2;

				zone.add(CollisionShape, { shape: Shape.rect(tw, zoneHeight) });
				map.add(zone);
				zones.push(zone);

				runStart = -1;
			}
		}
	}

	return zones;
}
