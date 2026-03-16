import { Scene } from "@quintus/core";
import { AmbientLight, Camera3D, DirectionalLight } from "@quintus/three";
import { COIN_SCORE } from "../config.js";
import { CameraOrbit } from "../entities/camera-orbit.js";
import { CoinItem } from "../entities/coin-item.js";
import { DungeonGrid } from "../entities/dungeon-grid.js";
import { ExitStairs } from "../entities/exit-stairs.js";
import { PlayerCharacter } from "../entities/player.js";
import { TrapTile } from "../entities/trap-tile.js";
import { TurnManager } from "../entities/turn-manager.js";
import { HUD } from "../hud/hud.js";
import { gameState } from "../state.js";

export abstract class DungeonLevel extends Scene {
	abstract readonly levelData: string[];
	abstract readonly nextScene: string;
	abstract readonly levelNumber: number;

	override onReady() {
		gameState.level = this.levelNumber;

		// Turn manager
		const turnManager = this.add(TurnManager);

		// Dungeon grid
		const grid = this.add(DungeonGrid);
		grid.parseLevel(this.levelData);

		// Player
		const spawn = grid.findChar("P");
		const player = this.add(PlayerCharacter, {
			dungeonGrid: grid,
			turnManager,
			gridX: spawn?.gridX ?? 1,
			gridZ: spawn?.gridZ ?? 1,
			castShadow: true,
			receiveShadow: true,
		});

		// Camera orbit pivot — child of player, parent of camera.
		// Q/E rotate this pivot in 90° steps for inspection.
		const orbit = player.add(CameraOrbit);

		// Camera — child of orbit so it inherits player position/rotation
		// plus the orbit offset. High up and tilted steeply down.
		const cam = orbit.add(Camera3D, { fov: 50 });
		cam.position.set(0, 5, 2.5);
		cam.rotation.x = -0.9;

		// Coins
		const coins = new Map<string, CoinItem>();
		for (const cell of grid.findAllChars("C")) {
			const coin = this.add(CoinItem, {
				gridX: cell.gridX,
				gridZ: cell.gridZ,
				castShadow: true,
			});
			coins.set(`${cell.gridX},${cell.gridZ}`, coin);
		}

		// Traps
		for (const cell of grid.findAllChars("T")) {
			this.add(TrapTile, { gridX: cell.gridX, gridZ: cell.gridZ });
		}

		// Exit stairs
		const exitCell = grid.findChar("E");
		if (exitCell) {
			this.add(ExitStairs, {
				gridX: exitCell.gridX,
				gridZ: exitCell.gridZ,
			});
		}

		// Lighting
		this.add(AmbientLight, { intensity: 0.4 });
		const sun = this.add(DirectionalLight, {
			intensity: 0.8,
			castShadow: true,
			shadowMapSize: 2048,
		});
		sun.position.set(5, 10, -5);

		// HUD
		this.add(HUD);

		// Signal wiring
		player.collected.connect(({ gridX, gridZ }) => {
			const key = `${gridX},${gridZ}`;
			const coin = coins.get(key);
			if (coin) {
				gameState.score += COIN_SCORE;
				coin.destroy();
				coins.delete(key);
				grid.clearCell(gridX, gridZ);
			}
		});

		player.reachedExit.connect(() => {
			this.switchTo(this.nextScene);
		});

		player.died.connect(() => {
			this.switchTo("game-over");
		});
	}
}
