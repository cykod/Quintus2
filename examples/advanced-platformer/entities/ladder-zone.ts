import { CollisionShape, Sensor, Shape } from "@quintus/physics";
import type { TileMap } from "@quintus/tilemap";
import type { Player } from "./player.js";

/**
 * Invisible sensor that enables ladder climbing when the player overlaps it.
 */
export class LadderZone extends Sensor {
	override collisionGroup = "items";

	/** Top of the ladder in world Y. */
	ladderTop = 0;

	/** Bottom of the ladder in world Y. */
	ladderBottom = 0;

	override onReady() {
		super.onReady();
		this.tag("ladder");

		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) {
				(body as Player).enterLadder();
			}
		});

		this.bodyExited.connect((body) => {
			if (body.hasTag("player")) {
				(body as Player).exitLadder();
			}
		});
	}
}

/**
 * Scan a tilemap layer for contiguous vertical columns of ladder tiles
 * and create LadderZone sensors for each column.
 *
 * Ladder tiles remain visible in the tilemap — only sensors are created.
 *
 * @param map The TileMap to scan.
 * @param layerName The tile layer to scan.
 * @returns Array of created LadderZone nodes.
 */
export function createLadderZones(map: TileMap, layerName: string): LadderZone[] {
	const ladderIds = new Set(map.getTileIdsByType("ladder"));
	if (ladderIds.size === 0) return [];

	const tw = map.tileWidth;
	const th = map.tileHeight;
	const cols = Math.floor(map.bounds.width / tw);
	const rows = Math.floor(map.bounds.height / th);

	const zones: LadderZone[] = [];

	for (let col = 0; col < cols; col++) {
		let runStart = -1;

		for (let row = 0; row <= rows; row++) {
			const tileId = row < rows ? map.getTileAt(col, row, layerName) : 0;
			const isLadder = ladderIds.has(tileId);

			if (isLadder && runStart === -1) {
				// Start a new run
				runStart = row;
			} else if (!isLadder && runStart !== -1) {
				// End of run — create zone
				const runHeight = row - runStart;
				const zone = new LadderZone();

				const worldX = col * tw + tw / 2;
				const worldYTop = runStart * th;
				const worldYBottom = row * th;
				const zoneHeight = runHeight * th;

				zone.position.x = worldX;
				zone.position.y = worldYTop + zoneHeight / 2;
				zone.ladderTop = worldYTop;
				zone.ladderBottom = worldYBottom;

				zone.add(CollisionShape, { shape: Shape.rect(tw, zoneHeight) });
				map.add(zone);
				zones.push(zone);

				runStart = -1;
			}
		}
	}

	return zones;
}
