import "@quintus/tilemap/physics";
import { Camera } from "@quintus/camera";
import { type NodeConstructor, Scene } from "@quintus/core";
import { Color, Rect, Vec2 } from "@quintus/math";
import type { Actor } from "@quintus/physics";
import { TileMap } from "@quintus/tilemap";
import { Ease } from "@quintus/tween";
import { Layer, Panel } from "@quintus/ui";
import { GAME_HEIGHT, GAME_WIDTH } from "../config.js";
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
import { Player } from "../entities/player.js";
import { PowerUp } from "../entities/power-up.js";
import { Spike } from "../entities/spike.js";
import { Spring } from "../entities/spring.js";
import { createWaterZones } from "../entities/water-zone.js";
import { HUD } from "../hud/hud.js";
import { showScorePopup } from "../hud/score-popup.js";
import { ParallaxBackground, ParallaxLayer } from "../parallax/parallax-background.js";
import { gameState } from "../state.js";

/**
 * Enemy tile IDs in the enemies-tileset (local tile IDs).
 * These correspond to positions in the enemies.png spritesheet grid (8 cols, 64x64+1px spacing).
 */
export const ENEMY_TILE_IDS = {
	bee: 3, // bee_a
	frog: 21, // frog_idle
	saw: 31, // saw_a
	slime: 44, // slime_normal_walk_a
	snail: 52, // snail_walk_a
} as const;

/**
 * Abstract base class for all gameplay levels.
 * Handles: collision generation, interactive tile spawning, enemy spawning,
 * contact callbacks, player death/respawn, door transitions, and camera setup.
 *
 * Subclasses provide: TMX asset, scene routing, parallax textures, and
 * optional per-level overrides (e.g. moving platforms).
 */
export abstract class BaseLevelScene extends Scene {
	/** TMX asset name (without .tmx extension). */
	abstract readonly tmxAsset: string;
	/** Scene key for respawn routing. */
	abstract readonly sceneName: string;
	/** Scene key for door-exit transition. */
	abstract readonly nextSceneName: string;
	/** Level number (1-3) for gameState.currentLevel. */
	abstract readonly levelNumber: number;

	/** Parallax sky fill texture (tileY, scrollFactor=0). */
	protected readonly bgSkyTexture: string = "bg_solid_sky";
	/** Parallax clouds texture (scrollFactor=0.05). */
	protected readonly bgCloudsTexture: string = "bg_clouds";
	/** Parallax far hills texture (scrollFactor=0.2). */
	protected readonly bgFarTexture: string = "bg_fade_hills";
	/** Parallax near hills texture (scrollFactor=0.4). */
	protected readonly bgNearTexture: string = "bg_color_hills";

	protected player!: Player;
	protected map!: TileMap;
	private _fadeOverlay!: Panel;

	override build() {
		return (
			<>
				<ParallaxBackground>
					<ParallaxLayer texture={this.bgSkyTexture} scrollFactor={0} tileY zIndex={-100} />
					<ParallaxLayer
						texture={this.bgCloudsTexture}
						scrollFactor={0.05}
						screenY={0}
						zIndex={-99}
					/>
					<ParallaxLayer
						texture={this.bgFarTexture}
						scrollFactor={0.2}
						screenY={250}
						zIndex={-98}
					/>
					<ParallaxLayer
						texture={this.bgNearTexture}
						scrollFactor={0.4}
						screenY={450}
						zIndex={-97}
					/>
				</ParallaxBackground>
				<TileMap ref="map" tilesetImage="tiles" asset={this.tmxAsset} />
				<Player ref="player" />
				<Camera follow="$player" smoothing={0.08} offset={[0, -30]} zoom={1} />
				<HUD />
			</>
		);
	}

	override onReady() {
		// Track current level
		gameState.currentLevel = this.levelNumber;

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

		const spawned = this.map.spawnFromTiles("main", mapping, {
			clearTiles: true,
		});

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
				showScorePopup(this, e.position.clone(), `+${e.scoreValue}`);
				e.stomp();
				return;
			}

			// Stomp: player above the enemy (normal points up into player)
			if (info.normal.y < 0) {
				if (e instanceof Snail) {
					e.direction = Math.sign(e.position.x - p.position.x) || 1;
				}
				showScorePopup(this, e.position.clone(), `+${e.scoreValue}`);
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

		// Set fall-death boundary below the map bottom
		this.player.fallDeathY = this.map.bounds.height + 200;

		// ── Wire player death → game-over or respawn ────────────────
		this.player.died.connect(() => {
			if (gameState.lives <= 0) {
				this._fadeToScene("game-over");
			} else {
				// Respawn at checkpoint or start
				gameState.checkpoint = null;
				this._fadeToScene(this.sceneName);
			}
		});

		// ── Wire door exit → next level ─────────────────────────────
		for (const node of spawned) {
			if (node instanceof DoorExit) {
				node.levelComplete.connect(() => {
					// Clear per-level state, preserve score/coins/lives
					gameState.keys = {
						red: false,
						blue: false,
						green: false,
						yellow: false,
					};
					gameState.checkpoint = null;
					this._fadeToScene(this.nextSceneName);
				});
			}
		}

		// ── Spawn enemies from tile layer ───────────────────────────
		this._spawnEnemiesFromTiles();

		// Camera bounds
		const camera = this.findFirst(Camera);
		if (camera) {
			camera.bounds = new Rect(0, 0, this.map.bounds.width, this.map.bounds.height);
		}

		// ── Fade overlay — fade in from black ────────────────────────
		this._setupFadeOverlay();
	}

	/** Create the full-screen black overlay used for fade transitions. */
	private _setupFadeOverlay(): void {
		const fadeLayer = this.add(Layer, { fixed: true, zIndex: 200 });
		this._fadeOverlay = fadeLayer.add(Panel, {
			size: new Vec2(GAME_WIDTH, GAME_HEIGHT),
			backgroundColor: Color.BLACK,
		});
		// Fade in from black
		this._fadeOverlay.alpha = 1;
		this._fadeOverlay.tween().to({ alpha: 0 }, 0.3, Ease.easeOutQuad);
	}

	/** Fade to black then switch to the target scene. */
	private _fadeToScene(target: string): void {
		this._fadeOverlay.alpha = 0;
		this._fadeOverlay
			.tween()
			.to({ alpha: 1 }, 0.4, Ease.easeInQuad)
			.onComplete(() => this.switchTo(target));
	}

	/** Spawn enemies from the "enemies" tile layer. Override to add moving platforms. */
	protected _spawnEnemiesFromTiles(): void {
		const enemyMapping: Record<number, NodeConstructor> = {
			[ENEMY_TILE_IDS.slime]: Slime,
			[ENEMY_TILE_IDS.bee]: Bee,
			[ENEMY_TILE_IDS.snail]: Snail,
			[ENEMY_TILE_IDS.frog]: Frog,
			[ENEMY_TILE_IDS.saw]: Saw,
		};

		const spawned = this.map.spawnFromTiles("enemies", enemyMapping, {
			clearTiles: true,
		});

		// Post-spawn configuration for enemies that need extra setup
		for (const node of spawned) {
			if (node instanceof Saw) {
				// Default saw path: 200px to the right at the same Y
				node.pathEnd = new Vec2(node.position.x + 200, node.position.y);
			}
		}
	}
}
