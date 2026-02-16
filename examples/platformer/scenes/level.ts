import { Camera } from "@quintus/camera";
import { Node, Scene, type SceneConstructor } from "@quintus/core";
import { Rect } from "@quintus/math";
import { CollisionShape, Shape, StaticCollider } from "@quintus/physics";
import { TileMap } from "@quintus/tilemap";
import { Coin } from "../entities/coin.js";
import { FlyingEnemy } from "../entities/flying-enemy.js";
import { HealthPickup } from "../entities/health-pickup.js";
import { LevelExit } from "../entities/level-exit.js";
import { PatrolEnemy } from "../entities/patrol-enemy.js";
import { Player } from "../entities/player.js";
import { HUD } from "../hud/hud.js";

/** Base Level scene with shared setup logic. Subclasses set asset + nextScene. */
export abstract class Level extends Scene {
	abstract readonly levelAsset: string;
	abstract readonly nextScene: SceneConstructor;

	protected player!: Player;

	override onReady() {
		// Register physics factories for TileMap collision generation
		TileMap.registerPhysics({
			StaticCollider: StaticCollider as never,
			CollisionShape: CollisionShape as never,
			shapeRect: Shape.rect,
		});

		// Load tilemap
		const map = this.add(TileMap);
		map.tilesetImage = "tileset";
		map.asset = this.levelAsset;

		// Generate collision from ground layer
		map.generateCollision({
			layer: "ground",
			allSolid: true,
			collisionGroup: "world",
		});

		// Make floating platforms one-way (player can jump through from below)
		// Ground floor tiles are within 3 tile rows of the map bottom
		const groundThreshold = map.bounds.height - map.tileHeight * 3;
		for (const child of map.children) {
			if (child instanceof StaticCollider && child.position.y < groundThreshold) {
				child.oneWay = true;
			}
		}

		// Spawn player at the designated spawn point
		const spawnPos = map.getSpawnPoint("player_start");
		this.player = this.add(Player);
		this.player.position = spawnPos;

		// Spawn entities from the object layer using type mapping
		// Player type is excluded from mapping (already spawned above manually)
		const spawned = map.spawnObjects("entities", {
			Coin: Coin,
			PatrolEnemy: PatrolEnemy,
			FlyingEnemy: FlyingEnemy,
			HealthPickup: HealthPickup,
			LevelExit: LevelExit,
		});

		// Set nextScene on all LevelExit instances
		for (const node of spawned) {
			if (node instanceof LevelExit) {
				node.nextScene = this.nextScene;
			}
		}

		// Setup enemy-player collision (contact-based via physics)
		this.game!.physics.onContact("player", "enemies", (player, enemy, info) => {
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

		// Camera setup
		const camera = this.add(Camera);
		camera.follow = this.player;
		camera.smoothing = 0.1;
		camera.bounds = new Rect(0, 0, map.bounds.width, map.bounds.height);

		// HUD (fixed layer, stays on screen)
		this.add(HUD);

		// Handle player death
		this.player.died.connect(() => this._onPlayerDied());
	}

	private _deathTriggered = false;

	private _onPlayerDied() {
		if (this._deathTriggered) return;
		this._deathTriggered = true;

		// Brief delay before switching to game over screen
		const timer = this.add(Node);
		let elapsed = 0;
		timer.onUpdate = (dt: number) => {
			elapsed += dt;
			if (elapsed > 0.5) {
				timer.destroy();
				this._goToGameOver();
			}
		};
	}

	protected abstract _goToGameOver(): void;
}
