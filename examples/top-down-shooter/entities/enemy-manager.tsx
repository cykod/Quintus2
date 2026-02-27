import { type WaveEntry, WaveSpawner } from "@quintus/ai-prefabs";
import { Node, NodePool, type Signal, signal } from "@quintus/core";
import {
	ARENA_BOTTOM,
	ARENA_LEFT,
	ARENA_RIGHT,
	ARENA_TOP,
	ENEMY_SPAWN_MIN_DISTANCE,
} from "../config.js";
import { gameState } from "../state.js";
import type { BaseEnemy } from "./base-enemy.js";
import type { BulletManager } from "./bullet-manager.js";
import type { Player } from "./player.js";
import { Robot } from "./robot.js";
import { Soldier } from "./soldier.js";
import { WeaponPickup } from "./weapon-pickup.js";
import { Zombie } from "./zombie.js";

interface WaveDef {
	zombies: number;
	robots: number;
	soldiers: number;
}

const WAVES: WaveDef[] = [
	{ zombies: 5, robots: 0, soldiers: 0 },
	{ zombies: 6, robots: 2, soldiers: 0 },
	{ zombies: 8, robots: 3, soldiers: 1 },
	{ zombies: 10, robots: 4, soldiers: 2 },
	{ zombies: 12, robots: 5, soldiers: 3 },
];

const PICKUP_DROP_CHANCE = 0.3;
const WEAPON_IDS = ["pistol", "machine", "silencer"];

// Separate pools per enemy type because each type has different stats, sprites,
// and behavior. Type-based routing in the spawnRequested handler maps the string
// type name to the correct pool, avoiding a single heterogeneous pool.
export class EnemyManager extends Node {
	playerRef: Player | null = null;
	bulletManager: BulletManager | null = null;

	private _zombiePool = new NodePool(Zombie, 50);
	private _robotPool = new NodePool(Robot, 30);
	private _soldierPool = new NodePool(Soldier, 30);
	private _pickupPool = new NodePool(WeaponPickup, 15);

	private _activeEnemies = new Set<BaseEnemy>();
	private _spawner!: WaveSpawner;

	readonly waveComplete: Signal<number> = signal<number>();
	readonly enemyDied: Signal<BaseEnemy> = signal<BaseEnemy>();

	override onReady() {
		this._zombiePool.prefill(20);
		this._robotPool.prefill(10);
		this._soldierPool.prefill(10);
		this._pickupPool.prefill(5);

		// Set up WaveSpawner as child node
		this._spawner = this.add(WaveSpawner);
		this._spawner.spawnInterval = 0.3;
		this._spawner.wavePause = 2.0;

		this._spawner.spawnRequested.connect(({ type }) => {
			const enemy = this._spawnEnemyByType(type);
			if (enemy) {
				this._placeEnemy(enemy);
				this._activeEnemies.add(enemy);
			}
		});

		this._spawner.waveCleared.connect((wave) => {
			this.waveComplete.emit(wave + 1);
		});
	}

	startWave(waveNum: number): void {
		const entries = this._buildWaveEntries(waveNum);
		this._spawner.defineWaves([entries]);
		this._spawner.start();
		gameState.wave = waveNum;
	}

	private _buildWaveEntries(waveNum: number): WaveEntry[] {
		const idx = Math.min(waveNum - 1, WAVES.length - 1);
		const def = WAVES[idx] ?? WAVES[WAVES.length - 1] ?? { zombies: 5, robots: 0, soldiers: 0 };

		// Scale beyond defined waves
		const scale = waveNum > WAVES.length ? 1 + (waveNum - WAVES.length) * 0.3 : 1;
		const z = Math.round(def.zombies * scale);
		const r = Math.round(def.robots * scale);
		const s = Math.round(def.soldiers * scale);

		const entries: WaveEntry[] = [];
		if (z > 0) entries.push({ type: "zombie", count: z });
		if (r > 0) entries.push({ type: "robot", count: r });
		if (s > 0) entries.push({ type: "soldier", count: s });
		return entries;
	}

	private _spawnEnemyByType(type: string): BaseEnemy | null {
		switch (type) {
			case "zombie":
				return this._spawnEnemy(this._zombiePool);
			case "robot":
				return this._spawnEnemy(this._robotPool);
			case "soldier":
				return this._spawnEnemy(this._soldierPool);
			default:
				return null;
		}
	}

	private _spawnEnemy(pool: NodePool<BaseEnemy>): BaseEnemy {
		const enemy = pool.acquire();
		enemy._playerRef = this.playerRef;
		enemy._bulletManager = this.bulletManager;
		// Connect died signal for pool recycling and score tracking
		enemy.died.connect(() => this._onEnemyDied(enemy, pool));
		this.add(enemy);
		return enemy;
	}

	private _placeEnemy(enemy: BaseEnemy): void {
		const px = this.playerRef?.position.x ?? 400;
		const py = this.playerRef?.position.y ?? 300;

		// Try random edge positions until one is far enough from the player
		for (let attempts = 0; attempts < 20; attempts++) {
			const edge = Math.floor(Math.random() * 4);
			let x: number;
			let y: number;

			switch (edge) {
				case 0: // top
					x = ARENA_LEFT + Math.random() * (ARENA_RIGHT - ARENA_LEFT);
					y = ARENA_TOP + 20;
					break;
				case 1: // bottom
					x = ARENA_LEFT + Math.random() * (ARENA_RIGHT - ARENA_LEFT);
					y = ARENA_BOTTOM - 20;
					break;
				case 2: // left
					x = ARENA_LEFT + 20;
					y = ARENA_TOP + Math.random() * (ARENA_BOTTOM - ARENA_TOP);
					break;
				default: // right
					x = ARENA_RIGHT - 20;
					y = ARENA_TOP + Math.random() * (ARENA_BOTTOM - ARENA_TOP);
					break;
			}

			const dx = x - px;
			const dy = y - py;
			if (dx * dx + dy * dy >= ENEMY_SPAWN_MIN_DISTANCE * ENEMY_SPAWN_MIN_DISTANCE) {
				enemy.position.x = x;
				enemy.position.y = y;
				return;
			}
		}

		// Fallback: top-left corner
		enemy.position.x = ARENA_LEFT + 20;
		enemy.position.y = ARENA_TOP + 20;
	}

	private _onEnemyDied(enemy: BaseEnemy, pool: NodePool<BaseEnemy>): void {
		this._activeEnemies.delete(enemy);
		gameState.score += enemy.scoreValue;
		gameState.kills++;
		this.enemyDied.emit(enemy);
		this._spawner.notifyDeath();

		// Maybe spawn pickup
		if (Math.random() < PICKUP_DROP_CHANCE) {
			this._spawnPickup(enemy.position.x, enemy.position.y);
		}

		pool.release(enemy);
	}

	private _spawnPickup(x: number, y: number): void {
		const pickup = this._pickupPool.acquire();
		// Only drop non-pistol weapons (pistol is always available)
		const dropWeapons = WEAPON_IDS.filter((id) => id !== "pistol");
		pickup.weaponId = dropWeapons[Math.floor(Math.random() * dropWeapons.length)] ?? "machine";
		pickup.position.x = x;
		pickup.position.y = y;
		pickup._onCollected = (p) => this._pickupPool.release(p);
		// Wire pickup to unlock weapon on the player
		pickup.weaponCollected.connect((weaponId: string) => {
			this.playerRef?.unlockWeapon(weaponId);
		});
		this.add(pickup);
	}

	get activeEnemyCount(): number {
		return this._activeEnemies.size;
	}
}
