import { Scene } from "@quintus/core";
import { AmbientLight, Camera3D, DirectionalLight } from "@quintus/three";
import * as THREE from "three";
import { COIN_SCORE } from "../config.js";
import { CoinItem } from "../entities/coin-item.js";
import { DungeonGrid } from "../entities/dungeon-grid.js";
import { ExitStairs } from "../entities/exit-stairs.js";
import { PlayerCharacter } from "../entities/player.js";
import { TrapTile } from "../entities/trap-tile.js";
import { HUD } from "../hud/hud.js";
import { gameState } from "../state.js";

export abstract class DungeonLevel extends Scene {
	abstract readonly levelData: string[];
	abstract readonly nextScene: string;
	abstract readonly levelNumber: number;

	override onReady() {
		gameState.level = this.levelNumber;

		// Dungeon grid
		const grid = this.add(DungeonGrid);
		grid.parseLevel(this.levelData);

		// Player
		const spawn = grid.findChar("P");
		const player = this.add(PlayerCharacter, {
			dungeonGrid: grid,
			gridX: spawn?.gridX ?? 1,
			gridZ: spawn?.gridZ ?? 1,
		});

		// Camera — start at follow target so there's no convergence delay
		const startWorld = grid.gridToWorld(player.gridX, player.gridZ);
		const cam = this.add(Camera3D, {
			fov: 50,
			follow: player,
			followOffset: new THREE.Vector3(0, 12, 8),
			followSmoothing: 4,
		});
		cam.position.set(startWorld.x, startWorld.y + 12, startWorld.z + 8);

		// Coins
		const coins = new Map<string, CoinItem>();
		for (const cell of grid.findAllChars("C")) {
			const coin = this.add(CoinItem, {
				gridX: cell.gridX,
				gridZ: cell.gridZ,
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
		const sun = this.add(DirectionalLight, { intensity: 0.8 });
		sun.position.set(startWorld.x + 3, 8, startWorld.z - 3);

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
