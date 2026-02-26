import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { TileMap } from "@quintus/tilemap";
import { GAME_HEIGHT, GAME_WIDTH, GRID_OFFSET_X, GRID_OFFSET_Y } from "../config.js";
import type { PathFollower } from "../entities/path-follower.js";
import { PlacementManager } from "../entities/placement-manager.js";
import { WaveManager } from "../entities/wave-manager.js";
import { HUD } from "../hud/hud.js";
import { readPathFromMap } from "../path.js";
import { gameState } from "../state.js";

/**
 * Base class for tower defense levels.
 * Path, placement, and terrain are all driven by the TMX map.
 */
export abstract class TDLevel extends Scene {
	abstract getMapAsset(): string;

	private _waveManager!: WaveManager;
	private _placementManager!: PlacementManager;

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
		map.zIndex = -2;

		// Read path data from the TMX path layer
		const mapData = readPathFromMap(map);

		// Set up placement manager
		this._placementManager = new PlacementManager();
		this._placementManager.validCells = mapData.placementCells;
		this.addChild(this._placementManager);

		// Set up wave manager
		this._waveManager = new WaveManager();
		this._waveManager.pathDef = { waypoints: mapData.waypoints };
		this.addChild(this._waveManager);

		this._waveManager.waveStarted.connect((wave) => {
			gameState.wave = wave;
			this.game.audio.play("wave-start", { volume: 0.5 });
		});

		this._waveManager.enemySpawned.connect((enemy) => {
			this._connectEnemy(enemy);
		});

		this._waveManager.allWavesCleared.connect(() => {
			this.game.audio.play("victory", { volume: 0.7 });
			this.after(1.0, () => this.switchTo("game-over"));
		});

		// Start the first wave
		this._waveManager.startWaves();
	}

	private _connectEnemy(enemy: PathFollower): void {
		enemy.died.connect((e) => {
			gameState.gold += e.goldReward;
			gameState.score += e.goldReward;
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

	getWaveManager(): WaveManager {
		return this._waveManager;
	}

	getPlacementManager(): PlacementManager {
		return this._placementManager;
	}
}
