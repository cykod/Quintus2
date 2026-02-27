import { WaveSpawner } from "@quintus/ai-prefabs";
import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { TileMap } from "@quintus/tilemap";
import {
	GAME_HEIGHT,
	GAME_WIDTH,
	GRID_OFFSET_X,
	GRID_OFFSET_Y,
	SPAWN_INTERVAL,
	WAVE_DEFS,
	WAVE_DELAY,
} from "../config.js";
import { BasicCreep } from "../entities/basic-creep.js";
import { FastCreep } from "../entities/fast-creep.js";
import type { PathFollower } from "../entities/path-follower.js";
import { PlacementManager } from "../entities/placement-manager.js";
import { TankCreep } from "../entities/tank-creep.js";
import { HUD } from "../hud/hud.js";
import { type PathDef, readPathFromMap } from "../path.js";
import { gameState } from "../state.js";

/**
 * Base class for tower defense levels.
 * Path, placement, and terrain are all driven by the TMX map.
 */
export abstract class TDLevel extends Scene {
	abstract getMapAsset(): string;

	private _waveSpawner!: WaveSpawner;
	private _placementManager!: PlacementManager;
	private _pathDef!: PathDef;

	override build() {
		return (
			<>
				<Camera position={[GAME_WIDTH / 2, GAME_HEIGHT / 2]} />
				<HUD />
			</>
		);
	}

	override onReady() {
		// Load tilemap from TMX
		const map = this.add(TileMap);
		map.tilesetImage = "tileset";
		map.asset = this.getMapAsset();
		map.position = new Vec2(GRID_OFFSET_X, GRID_OFFSET_Y);
		// Tilemap renders behind all gameplay entities (towers, enemies, projectiles)
		map.zIndex = -2;

		// Read path data from the TMX path layer
		const mapData = readPathFromMap(map);
		this._pathDef = { waypoints: mapData.waypoints };

		// Set up placement manager
		this._placementManager = new PlacementManager();
		this._placementManager.validCells = mapData.placementCells;
		this.add(this._placementManager);

		// Set up wave spawner
		this._waveSpawner = new WaveSpawner();
		this._waveSpawner.spawnInterval = SPAWN_INTERVAL;
		this._waveSpawner.wavePause = WAVE_DELAY;
		this._waveSpawner.defineWaves(WAVE_DEFS);
		this.add(this._waveSpawner);

		this._waveSpawner.waveStarted.connect((wave) => {
			gameState.wave = wave + 1; // WaveSpawner is 0-indexed, display is 1-indexed
			this.game.audio.play("wave-start", { volume: 0.5 });
		});

		this._waveSpawner.spawnRequested.connect(({ type }) => {
			const enemy = this._createEnemy(type);
			enemy.pathDef = this._pathDef;
			this.add(enemy);
			this._connectEnemy(enemy);

			enemy.died.connect(() => {
				this._waveSpawner.notifyDeath();
			});
			enemy.reachedExit.connect(() => {
				this._waveSpawner.notifyDeath();
			});
		});

		this._waveSpawner.allCleared.connect(() => {
			this.game.audio.play("victory", { volume: 0.7 });
			// 1s delay before scene switch allows victory sound to play
			this.after(1.0, () => this.switchTo("game-over"));
		});

		// Start the first wave
		this._waveSpawner.start();
	}

	private _createEnemy(type: string): PathFollower {
		switch (type) {
			case "fast":
				return new FastCreep();
			case "tank":
				return new TankCreep();
			default:
				return new BasicCreep();
		}
	}

	private _connectEnemy(enemy: PathFollower): void {
		enemy.died.connect(() => {
			gameState.gold += enemy.goldReward;
			// score += goldReward is intentional — gold earned serves as the score metric
			gameState.score += enemy.goldReward;
			this.game.audio.play("enemy-die", { volume: 0.4 });
		});

		enemy.reachedExit.connect(() => {
			gameState.lives--;
			this.game.audio.play("life-lost", { volume: 0.5 });
			if (gameState.lives <= 0) {
				this.game.audio.play("gameover", { volume: 0.7 });
				this.after(0.5, () => this.switchTo("game-over"));
			}
		});
	}

	getWaveSpawner(): WaveSpawner {
		return this._waveSpawner;
	}

	getPlacementManager(): PlacementManager {
		return this._placementManager;
	}
}
