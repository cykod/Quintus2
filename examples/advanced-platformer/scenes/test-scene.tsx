import "@quintus/tilemap/physics";
import { Camera } from "@quintus/camera";
import { type NodeConstructor, Scene } from "@quintus/core";
import { Rect, Vec2 } from "@quintus/math";
import type { Actor } from "@quintus/physics";
import { TileMap } from "@quintus/tilemap";
import {
	BreakableBlock,
	BrickBlock,
	CoinBlock,
	ExclamationBlock,
} from "../entities/breakable-block.js";
import { Coin } from "../entities/coin.js";
import { DoorExit } from "../entities/door-exit.js";
import type { BaseEnemy } from "../entities/enemies/base-enemy.js";
import { Bee } from "../entities/enemies/bee.js";
import { Frog } from "../entities/enemies/frog.js";
import { Saw } from "../entities/enemies/saw.js";
import { Slime } from "../entities/enemies/slime.js";
import { Snail } from "../entities/enemies/snail.js";
import { FallAwayPlatform } from "../entities/fall-away-platform.js";
import { Flag } from "../entities/flag.js";
import { Gem } from "../entities/gem.js";
import { HeartPickup } from "../entities/heart-pickup.js";
import { KeyPickup } from "../entities/key-pickup.js";
import { createLadderZones } from "../entities/ladder-zone.js";
import { LockedDoor } from "../entities/locked-door.js";
import { MovingPlatform } from "../entities/moving-platform.js";
import { Player } from "../entities/player.js";
import { PowerUp } from "../entities/power-up.js";
import { Spike } from "../entities/spike.js";
import { Spring } from "../entities/spring.js";
import { createWaterZones } from "../entities/water-zone.js";
import { HUD } from "../hud/hud.js";
import { ParallaxBackground, ParallaxLayer } from "../parallax/parallax-background.js";
import { gameState } from "../state.js";

/**
 * Level 1 scene: tilemap, collision, interactive tiles, enemies, HUD, and scene transitions.
 */
export class Level1Scene extends Scene {
	protected player!: Player;
	protected map!: TileMap;

	override build() {
		return (
			<>
				<ParallaxBackground>
					<ParallaxLayer texture="bg_solid_sky" scrollFactor={0} tileY zIndex={-100} />
					<ParallaxLayer texture="bg_clouds" scrollFactor={0.05} screenY={0} zIndex={-99} />
					<ParallaxLayer texture="bg_fade_hills" scrollFactor={0.2} screenY={250} zIndex={-98} />
					<ParallaxLayer texture="bg_color_hills" scrollFactor={0.4} screenY={450} zIndex={-97} />
				</ParallaxBackground>
				<TileMap ref="map" tilesetImage="tiles" asset="level1" />
				<Player ref="player" />
				<Camera follow="$player" smoothing={0.08} offset={[0, -30]} zoom={1} />
				<HUD />
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
		const spikeIds = this.map.getTileIdsByType("spike");
		const coinIds = this.map.getTileIdsByType("coin");
		const gemIds = this.map.getTileIdsByType("gem");
		const heartIds = this.map.getTileIdsByType("heart");
		const starIds = this.map.getTileIdsByType("star");
		const keyRedIds = this.map.getTileIdsByType("key_red");
		const keyBlueIds = this.map.getTileIdsByType("key_blue");
		const keyGreenIds = this.map.getTileIdsByType("key_green");
		const keyYellowIds = this.map.getTileIdsByType("key_yellow");
		const lockRedIds = this.map.getTileIdsByType("lock_red");
		const lockBlueIds = this.map.getTileIdsByType("lock_blue");
		const lockGreenIds = this.map.getTileIdsByType("lock_green");
		const lockYellowIds = this.map.getTileIdsByType("lock_yellow");
		const flagIds = this.map.getTileIdsByType("flag");
		const doorIds = this.map.getTileIdsByType("door");

		const mapping: Record<number, NodeConstructor> = {};
		for (const id of brickIds) mapping[id] = BrickBlock;
		for (const id of coinBlockIds) mapping[id] = CoinBlock;
		for (const id of exclamationBlockIds) mapping[id] = ExclamationBlock;
		for (const id of springIds) mapping[id] = Spring;
		for (const id of fallAwayIds) mapping[id] = FallAwayPlatform;
		for (const id of spikeIds) mapping[id] = Spike;
		for (const id of coinIds) mapping[id] = Coin;
		for (const id of gemIds) mapping[id] = Gem;
		for (const id of heartIds) mapping[id] = HeartPickup;
		for (const id of starIds) mapping[id] = PowerUp;
		for (const id of keyRedIds) mapping[id] = KeyPickup;
		for (const id of keyBlueIds) mapping[id] = KeyPickup;
		for (const id of keyGreenIds) mapping[id] = KeyPickup;
		for (const id of keyYellowIds) mapping[id] = KeyPickup;
		for (const id of lockRedIds) mapping[id] = LockedDoor;
		for (const id of lockBlueIds) mapping[id] = LockedDoor;
		for (const id of lockGreenIds) mapping[id] = LockedDoor;
		for (const id of lockYellowIds) mapping[id] = LockedDoor;
		for (const id of flagIds) mapping[id] = Flag;
		for (const id of doorIds) mapping[id] = DoorExit;

		const spawned = this.map.spawnFromTiles("main", mapping, { clearTiles: true });

		// ── Create ladder zones (tiles stay visible) ─────────────────
		createLadderZones(this.map, "main");

		// ── Create water/lava zones (tiles stay visible) ─────────────
		createWaterZones(this.map, "main");

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
			// Locked door → open if player has matching key
			if (other instanceof LockedDoor && gameState.keys[other.color]) {
				other.open();
			}
		});

		// ── Enemy contact ───────────────────────────────────────────
		this.game.physics.onContact("player", "enemies", (player, enemy, info) => {
			const p = player as Player;
			const e = enemy as BaseEnemy;

			// Star power: destroy any enemy on contact
			if (p.hasStarPower) {
				e.stomp();
				return;
			}

			// Stomp: player above and falling
			if (info.normal.y < 0 && p.velocity.y > 0) {
				if (e instanceof Snail) {
					e.direction = Math.sign(e.position.x - p.position.x) || 1;
				}
				e.stomp();
				p.velocity.y = -250; // bounce
			} else {
				// Side/below contact → damage player
				p.takeDamage(1);
			}
		});

		// ── Hazard overlap (saw blades, spikes, water/lava) ─────────
		this.game.physics.onOverlap("player", "hazards", (player, hazard) => {
			const p = player as Player;
			if (hazard.hasTag("water")) {
				p.takeDamage(p.health);
			} else {
				p.takeDamage(1);
			}
		});

		// Position player at checkpoint or spawn point
		if (gameState.checkpoint) {
			this.player.position = gameState.checkpoint.clone();
		} else {
			this.player.position = this.map.getSpawnPoint("player_start");
		}

		// ── Wire player death → game-over or respawn ────────────────
		this.player.died.connect(() => {
			if (gameState.lives <= 0) {
				this.switchTo("game-over");
			} else {
				// Respawn at checkpoint or start
				gameState.checkpoint = null;
				this.switchTo("level1");
			}
		});

		// ── Wire door exit → victory ────────────────────────────────
		for (const node of spawned) {
			if (node instanceof DoorExit) {
				node.levelComplete.connect(() => {
					this.switchTo("victory");
				});
			}
		}

		// ── Spawn enemies ───────────────────────────────────────────
		this._spawnEnemies();

		// Camera bounds
		const camera = this.findFirst(Camera);
		if (camera) {
			camera.bounds = new Rect(0, 0, this.map.bounds.width, this.map.bounds.height);
		}
	}

	/** Spawn enemies at hand-picked positions along the level. */
	private _spawnEnemies(): void {
		// Ground surface is at y=448 (row 7). Enemy centers offset by half-height.

		// Two slimes patrolling the ground
		const slime1 = this.add(Slime);
		slime1.position = new Vec2(550, 430);

		const slime2 = this.add(Slime);
		slime2.position = new Vec2(750, 430);
		slime2.direction = -1;

		// Bee flying above the mid section
		const bee = this.add(Bee);
		bee.position = new Vec2(1000, 320);

		// Snail on the ground past the ladder
		const snail = this.add(Snail);
		snail.position = new Vec2(1200, 430);

		// Frog further along
		const frog = this.add(Frog);
		frog.position = new Vec2(1600, 430);
		frog.jumpInterval = 1.5;

		// Saw patrolling a horizontal path near the gap (columns 27-29)
		const saw = this.add(Saw);
		saw.position = new Vec2(2000, 380);
		saw.pathEnd = new Vec2(2200, 380);

		// Moving platform over a gap
		const movingPlatform = this.add(MovingPlatform);
		movingPlatform.position = new Vec2(1800, 350);
		movingPlatform.direction = "horizontal";
		movingPlatform.distance = 200;
		movingPlatform.speed = 80;
		movingPlatform.waitTime = 0.5;
	}
}

/** @deprecated Use Level1Scene instead. */
export const TestScene = Level1Scene;
