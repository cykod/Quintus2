import "@quintus/tilemap/physics";
import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import { Rect } from "@quintus/math";
import type { Actor, StaticCollider } from "@quintus/physics";
import { TileMap } from "@quintus/tilemap";
import {
	BreakableBlock,
	BrickBlock,
	CoinBlock,
	ExclamationBlock,
} from "../entities/breakable-block.js";
import { FallAwayPlatform } from "../entities/fall-away-platform.js";
import { createLadderZones } from "../entities/ladder-zone.js";
import { Player } from "../entities/player.js";
import { Spring } from "../entities/spring.js";

/**
 * Test scene: tilemap rendering, collision, interactive tiles, and player character.
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
			collisionGroup: "world",
			oneWayTileIds: oneWayIds,
			tileShapeColliders: true,
		});

		// ── Spawn interactive tile entities ──────────────────────────
		const brickIds = this.map.getTileIdsByType("breakable");
		const coinBlockIds = this.map.getTileIdsByType("coin_block");
		const exclamationBlockIds = this.map.getTileIdsByType("exclamation_block");
		const springIds = this.map.getTileIdsByType("spring");
		const fallAwayIds = this.map.getTileIdsByType("fall_away");

		const mapping: Record<number, new () => StaticCollider> = {};
		for (const id of brickIds) mapping[id] = BrickBlock;
		for (const id of coinBlockIds) mapping[id] = CoinBlock;
		for (const id of exclamationBlockIds) mapping[id] = ExclamationBlock;
		for (const id of springIds) mapping[id] = Spring;
		for (const id of fallAwayIds) mapping[id] = FallAwayPlatform;

		this.map.spawnFromTiles("main", mapping, { clearTiles: true });

		// ── Create ladder zones (tiles stay visible) ─────────────────
		createLadderZones(this.map, "main");

		// ── Contact callbacks ────────────────────────────────────────
		this.game.physics.onContact("player", "world", (player, other, info) => {
			// Hit from below → breakable block
			if (info.normal.y > 0 && other instanceof BreakableBlock) {
				other.hitFromBelow(player as Actor);
			}
			// Land on top → spring bounce
			if (info.normal.y < 0 && other instanceof Spring) {
				other.bounce(player as Actor);
			}
			// Land on top → fall-away trigger
			if (info.normal.y < 0 && other instanceof FallAwayPlatform) {
				other.trigger();
			}
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
