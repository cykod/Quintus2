import { Scene } from "@quintus/core";
import { AmbientLight, Camera3D, DirectionalLight } from "@quintus/three";
import { SFX } from "../audio.js";
import {
	COIN_SCORE,
	ENEMY_DAMAGE,
	ENEMY_KILL_SCORE,
	PLAYER_ATTACK_DAMAGE,
	TRANSITION_DEATH_FADE_DURATION,
	TRANSITION_FADE_DURATION,
} from "../config.js";
import { CameraOrbit } from "../entities/camera-orbit.js";
import { CameraShake } from "../entities/camera-shake.js";
import { CoinItem } from "../entities/coin-item.js";
import { DungeonGrid } from "../entities/dungeon-grid.js";
import {
	spawnBloodBurst,
	spawnCoinBurst,
	spawnDustPuff,
	spawnHealBurst,
} from "../entities/effects.js";
import { Enemy } from "../entities/enemy.js";
import { ExitStairs } from "../entities/exit-stairs.js";
import { FogOfWar } from "../entities/fog-of-war.js";
import { HealthPotion } from "../entities/health-potion.js";
import { PlayerCharacter } from "../entities/player.js";
import { Torch } from "../entities/torch.js";
import { TrapTile } from "../entities/trap-tile.js";
import { TurnManager } from "../entities/turn-manager.js";
import { DamageOverlay } from "../hud/damage-overlay.js";
import { HUD } from "../hud/hud.js";
import { TransitionOverlay } from "../hud/transition-overlay.js";
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

		// Camera orbit pivot — child of player, parent of shake node
		const orbit = player.add(CameraOrbit);

		// Camera shake node between orbit and camera
		const shake = orbit.add(CameraShake);

		// Camera — child of shake so it inherits player position/rotation
		// plus orbit offset and shake. High up and tilted steeply down.
		const cam = shake.add(Camera3D, { fov: 50 });
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
		let exitStairs: ExitStairs | null = null;
		if (exitCell) {
			exitStairs = this.add(ExitStairs, {
				gridX: exitCell.gridX,
				gridZ: exitCell.gridZ,
				dungeonGrid: grid,
			});
		}

		// Health potions
		const potions = new Map<string, HealthPotion>();
		for (const cell of grid.findAllChars("H")) {
			const potion = this.add(HealthPotion, {
				gridX: cell.gridX,
				gridZ: cell.gridZ,
			});
			potions.set(`${cell.gridX},${cell.gridZ}`, potion);
		}

		// Enemies
		const enemies = new Set<Enemy>();
		for (const cell of grid.findAllChars("G")) {
			const enemy = this.add(Enemy, {
				gridX: cell.gridX,
				gridZ: cell.gridZ,
				dungeonGrid: grid,
			});
			enemies.add(enemy);
			grid.setOccupied(cell.gridX, cell.gridZ);
		}

		// Fog of war
		const fogOfWar = this.add(FogOfWar);
		const wallGrid = this.levelData.map((line) => line.split("").map((ch) => ch === "#"));
		fogOfWar.init(this.levelData[0].length, this.levelData.length, wallGrid);
		fogOfWar.updatePlayerPosition(player.gridX, player.gridZ);

		// Lighting — reduced ambient for torch atmosphere
		this.add(AmbientLight, { intensity: 0.15 });
		const sun = this.add(DirectionalLight, {
			intensity: 0.8,
			castShadow: true,
			shadowMapSize: 2048,
		});
		sun.position.set(5, 10, -5);

		// Torches — mount on wall tiles facing adjacent floor
		for (const pos of findTorchPositions(grid, this.levelData)) {
			const wallWorld = grid.gridToWorld(pos.x, pos.z);
			// Offset torch toward the floor side so it sits on the wall surface
			const torch = this.add(Torch);
			torch.position.set(wallWorld.x + pos.offsetX * 0.55, 0, wallWorld.z + pos.offsetZ * 0.55);
		}

		// HUD
		const hud = this.add(HUD);

		// Damage overlay
		const damageOverlay = this.add(DamageOverlay);

		// Transition overlay (fade to/from black)
		const transition = this.add(TransitionOverlay);
		let pendingScene: string | null = null;

		transition.fadeOutComplete.connect(() => {
			if (pendingScene) {
				this.switchTo(pendingScene);
			}
		});

		// Turn counter
		turnManager.playerTurnComplete.connect((turn) => {
			gameState.turn = turn;
		});

		// Coin collection
		player.collected.connect(({ gridX, gridZ }) => {
			const key = `${gridX},${gridZ}`;
			const coin = coins.get(key);
			if (coin) {
				gameState.score += COIN_SCORE;
				spawnCoinBurst(this, coin.position.x, 0.15, coin.position.z);
				coin.destroy();
				coins.delete(key);
				grid.clearCell(gridX, gridZ);
				this.game.audio?.play(SFX.coinCollect(), { bus: "sfx" });
			}
		});

		// Health potion collection
		player.collectedPotion.connect(({ gridX, gridZ }) => {
			const key = `${gridX},${gridZ}`;
			const potion = potions.get(key);
			if (potion) {
				if (gameState.health < gameState.maxHealth) {
					gameState.health = Math.min(gameState.health + 1, gameState.maxHealth);
					hud.flash("+1 HP", "#4caf50");
				} else {
					hud.flash("Full HP", "#4caf50");
				}
				spawnHealBurst(this, potion.position.x, 0.1, potion.position.z);
				potion.destroy();
				potions.delete(key);
				grid.clearCell(gridX, gridZ);
				this.game.audio?.play(SFX.healPickup(), { bus: "sfx" });
			}
		});

		// Footstep dust + fog of war update
		player.moved.connect(({ fromX, fromZ }) => {
			const pos = grid.gridToWorld(fromX, fromZ);
			spawnDustPuff(this, pos.x, 0.02, pos.z);
			fogOfWar.updatePlayerPosition(player.gridX, player.gridZ);
		});

		// Enemy turn orchestration
		turnManager.enemyTurnStart.connect(() => {
			if (enemies.size === 0) {
				turnManager.enemyAnimDone();
				return;
			}

			let remaining = enemies.size;
			const onDone = () => {
				remaining--;
				if (remaining <= 0) {
					turnManager.enemyAnimDone();
				}
			};

			for (const enemy of enemies) {
				const action = enemy.takeTurn(player.gridX, player.gridZ);
				enemy.actionComplete.once(onDone);
				enemy.executeAction(action);
			}
		});

		// Find enemy at a given grid position
		const findEnemyAt = (gx: number, gz: number): Enemy | undefined => {
			for (const enemy of enemies) {
				if (enemy.gridX === gx && enemy.gridZ === gz) return enemy;
			}
			return undefined;
		};

		// Player attack → damage enemies
		player.attacked.connect(({ gridX, gridZ }) => {
			const enemy = findEnemyAt(gridX, gridZ);
			if (!enemy) {
				hud.flash("Miss!", "#90a4ae");
				this.game.audio?.play(SFX.swordSwing(), { bus: "sfx" });
				return;
			}

			enemy.takeDamage(PLAYER_ATTACK_DAMAGE);
			enemy.flashHit();
			spawnBloodBurst(this, enemy.position.x, 0.2, enemy.position.z);
			hud.flash("Hit!", "#ffd54f");
			this.game.audio?.play(SFX.swordHit(), { bus: "sfx" });
		});

		// Enemy attacks player / enemy death
		for (const enemy of enemies) {
			enemy.attackedPlayer.connect(() => {
				gameState.health -= ENEMY_DAMAGE;
				hud.flash("Ouch!", "#ef5350");
				this.game.audio?.play(SFX.enemyAttack(), { bus: "sfx" });
				shake.shake(0.08, 0.15);
				damageOverlay.flash();
				spawnBloodBurst(this, player.position.x, 0.2, player.position.z);
				if (gameState.health <= 0) {
					player.died.emit();
				}
			});

			enemy.died.connect(() => {
				enemies.delete(enemy);
				grid.clearOccupied(enemy.gridX, enemy.gridZ);
				gameState.score += ENEMY_KILL_SCORE;
				gameState.kills++;
				this.game.audio?.play(SFX.enemyDeath(), { bus: "sfx" });
				spawnBloodBurst(this, enemy.position.x, 0.2, enemy.position.z);
				enemy.playDeath();
			});
		}

		player.reachedExit.connect(() => {
			this.game.audio?.play(SFX.exitDoor(), { bus: "sfx" });
			if (exitStairs) {
				// Freeze camera in place so it doesn't follow the player down the stairs
				orbit.freezeWorldTransform();

				player.playExitDescent(exitStairs.descentDX, exitStairs.descentDZ, exitStairs.descentAngle);
			} else {
				pendingScene = this.nextScene;
				transition.fadeOut(TRANSITION_FADE_DURATION);
			}
		});

		player.exitDescentComplete.connect(() => {
			pendingScene = this.nextScene;
			transition.fadeOut(TRANSITION_FADE_DURATION);
		});

		player.died.connect(() => {
			shake.shake(0.15, 0.3);
			damageOverlay.flash();
			spawnBloodBurst(this, player.position.x, 0.2, player.position.z);
			player.playDeath();
		});

		player.deathComplete.connect(() => {
			pendingScene = "game-over";
			transition.fadeOut(TRANSITION_DEATH_FADE_DURATION);
		});

		// Health decrease from traps → shake + flash
		gameState.on("health").connect(({ value, previous }) => {
			if (value < previous) {
				shake.shake(0.06, 0.12);
				damageOverlay.flash();
			}
		});

		// Fade in from black on level start
		transition.fadeIn(0.3);
	}
}

/** Neighbor deltas for cardinal directions. */
const DIRS = [
	{ dx: 0, dz: -1 },
	{ dx: 1, dz: 0 },
	{ dx: 0, dz: 1 },
	{ dx: -1, dz: 0 },
];

/**
 * Find wall tiles that have at least one adjacent floor tile.
 * Returns the wall position plus an offset direction pointing toward a floor neighbor.
 * Takes every 3rd for density control.
 */
function findTorchPositions(
	grid: DungeonGrid,
	lines: string[],
): Array<{ x: number; z: number; offsetX: number; offsetZ: number }> {
	const positions: Array<{ x: number; z: number; offsetX: number; offsetZ: number }> = [];
	const height = lines.length;
	for (let z = 0; z < height; z++) {
		const width = lines[z].length;
		for (let x = 0; x < width; x++) {
			if (lines[z][x] !== "#") continue; // only wall tiles
			// Find a neighboring floor tile to face
			for (const { dx, dz } of DIRS) {
				const nx = x + dx;
				const nz = z + dz;
				if (grid.charAt(nx, nz) !== "#") {
					positions.push({ x, z, offsetX: dx, offsetZ: dz });
					break; // one torch per wall tile
				}
			}
		}
	}
	return positions.filter((_, i) => i % 3 === 0);
}
