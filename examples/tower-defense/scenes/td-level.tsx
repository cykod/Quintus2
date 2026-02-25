import { Camera } from "@quintus/camera";
import { Node2D, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Sprite } from "@quintus/sprites";
import { GAME_HEIGHT, GAME_WIDTH, GRID_COLS, GRID_ROWS } from "../config.js";
import type { PathFollower } from "../entities/path-follower.js";
import { PlacementManager } from "../entities/placement-manager.js";
import { WaveManager } from "../entities/wave-manager.js";
import { HUD } from "../hud/hud.js";
import { getPathCells, gridToWorld, type PathDef } from "../path.js";
import { FRAME_GRASS, tileSheet } from "../sprites.js";
import { gameState } from "../state.js";

/**
 * Base class for tower defense levels.
 * Subclasses provide the path definition.
 */
export abstract class TDLevel extends Scene {
	abstract getPath(): PathDef;

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
		const path = this.getPath();

		// Draw terrain grid
		this._drawTerrain();
		this._drawPath(path);

		// Set up placement manager
		this._placementManager = new PlacementManager();
		this._placementManager.pathCells = getPathCells(path);
		this.addChild(this._placementManager);

		// Set up wave manager
		this._waveManager = new WaveManager();
		this._waveManager.pathDef = path;
		this.addChild(this._waveManager);

		this._waveManager.waveStarted.connect((wave) => {
			gameState.wave = wave;
		});

		this._waveManager.enemySpawned.connect((enemy) => {
			this._connectEnemy(enemy);
		});

		this._waveManager.allWavesCleared.connect(() => {
			this.after(1.0, () => this.switchTo("game-over"));
		});

		// Start the first wave
		this._waveManager.startWaves();
	}

	private _connectEnemy(enemy: PathFollower): void {
		enemy.died.connect((e) => {
			gameState.gold += e.goldReward;
			gameState.score += e.goldReward;
		});

		enemy.reachedExit.connect(() => {
			gameState.lives--;
			if (gameState.lives <= 0) {
				this.after(0.5, () => this.switchTo("game-over"));
			}
		});
	}

	private _drawTerrain(): void {
		for (let row = 0; row < GRID_ROWS; row++) {
			for (let col = 0; col < GRID_COLS; col++) {
				const pos = gridToWorld(col, row);
				const tile = new Node2D();
				tile.position = new Vec2(pos.x, pos.y);
				tile.zIndex = -2;
				const sprite = new Sprite();
				sprite.texture = "tileset";
				sprite.sourceRect = tileSheet.getFrameRect(FRAME_GRASS);
				tile.addChild(sprite);
				this.addChild(tile);
			}
		}
	}

	private _drawPath(path: PathDef): void {
		for (const tile of path.tiles) {
			const pos = gridToWorld(tile.col, tile.row);
			const node = new Node2D();
			node.position = new Vec2(pos.x, pos.y);
			node.zIndex = -1;
			const sprite = new Sprite();
			sprite.texture = "tileset";
			sprite.sourceRect = tileSheet.getFrameRect(tile.frame);
			node.addChild(sprite);
			this.addChild(node);
		}
	}

	getWaveManager(): WaveManager {
		return this._waveManager;
	}

	getPlacementManager(): PlacementManager {
		return this._placementManager;
	}
}
