import "@quintus/tilemap/physics";
import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import { Rect } from "@quintus/math";
import { TileMap } from "@quintus/tilemap";
import { Coin } from "../entities/coin.js";
import { FlyingEnemy } from "../entities/flying-enemy.js";
import { HealthPickup } from "../entities/health-pickup.js";
import { LevelExit } from "../entities/level-exit.js";
import { PatrolEnemy } from "../entities/patrol-enemy.js";
import { Player } from "../entities/player.js";
import { Spike } from "../entities/spike.js";
import { HUD } from "../hud/hud.js";

/** Base Level scene with shared setup logic. Subclasses set asset + nextScene. */
export abstract class Level extends Scene {
	abstract readonly levelAsset: string;
	abstract readonly nextScene: string;

	protected player?: Player;
	protected map?: TileMap;
	protected camera?: Camera;

	override build() {
		return (
			<>
				<TileMap ref="map" tilesetImage="tileset" asset={this.levelAsset} />
				<Player ref="player" />
				<Camera ref="camera" follow="$player" smoothing={0.1} zoom={2} />
				<HUD />
			</>
		);
	}

	override onReady() {
		// Generate collision from ground layer
		this.map!.generateCollision({
			layer: "ground",
			allSolid: true,
			collisionGroup: "world",
		});

		// Position player at the designated spawn point
		this.player!.position = this.map!.getSpawnPoint("player_start");

		// Spawn entities from the object layer using type mapping
		const spawned = this.map!.spawnObjects("entities", {
			Coin: Coin,
			PatrolEnemy: PatrolEnemy,
			FlyingEnemy: FlyingEnemy,
			HealthPickup: HealthPickup,
			LevelExit: LevelExit,
			Spike: Spike,
		});

		// Set nextScene on all LevelExit instances
		for (const node of spawned) {
			if (node instanceof LevelExit) {
				node.nextScene = this.nextScene;
			}
		}

		// Setup enemy-player collision (contact-based via physics)
		this.game.physics.onContact("player", "enemies", (player, enemy, info) => {
			const p = player as Player;
			const e = enemy as PatrolEnemy | FlyingEnemy;

			// Normal points into the player. y < 0 means player landed on enemy from above.
			if (info.normal.y < 0) {
				e.stomp();
				p.velocity.y = -200; // Bounce up after stomp
			} else {
				p.takeDamage();
			}
		});

		// Camera bounds from map dimensions
		this.camera!.bounds = new Rect(0, 0, this.map!.bounds.width, this.map!.bounds.height);

		// Handle player death
		this.player!.died.connect(() => this._onPlayerDied());
	}

	private _deathTriggered = false;

	private _onPlayerDied() {
		if (this._deathTriggered) return;
		this._deathTriggered = true;

		// Brief delay before switching to game over screen
		this.after(0.5, () => this._goToGameOver());
	}

	protected abstract _goToGameOver(): void;
}
