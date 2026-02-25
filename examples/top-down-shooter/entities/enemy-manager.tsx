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

export class EnemyManager extends Node {
	playerRef: Player | null = null;
	bulletManager: BulletManager | null = null;

	private _zombiePool = new NodePool(Zombie, 50);
	private _robotPool = new NodePool(Robot, 30);
	private _soldierPool = new NodePool(Soldier, 30);
	private _pickupPool = new NodePool(WeaponPickup, 15);

	private _activeEnemies = new Set<BaseEnemy>();
	private _waveIndex = 0;
	private _remainingInWave = 0;
	private _spawnQueue: Array<() => BaseEnemy> = [];
	private _spawnTimer = 0;

	readonly waveComplete: Signal<number> = signal<number>();
	readonly enemyDied: Signal<BaseEnemy> = signal<BaseEnemy>();

	override onReady() {
		this._zombiePool.prefill(20);
		this._robotPool.prefill(10);
		this._soldierPool.prefill(10);
		this._pickupPool.prefill(5);
	}

	override onFixedUpdate(dt: number) {
		if (this._spawnQueue.length > 0) {
			this._spawnTimer -= dt;
			if (this._spawnTimer <= 0) {
				this._spawnTimer = 0.3;
				const factory = this._spawnQueue.shift();
				if (!factory) return;
				const enemy = factory();
				this._placeEnemy(enemy);
				this._activeEnemies.add(enemy);
			}
		}
	}

	startWave(waveNum: number): void {
		this._waveIndex = waveNum;
		const idx = Math.min(waveNum - 1, WAVES.length - 1);
		const def = WAVES[idx] ?? WAVES[WAVES.length - 1] ?? { zombies: 5, robots: 0, soldiers: 0 };

		// Scale beyond defined waves
		const scale = waveNum > WAVES.length ? 1 + (waveNum - WAVES.length) * 0.3 : 1;
		const z = Math.round(def.zombies * scale);
		const r = Math.round(def.robots * scale);
		const s = Math.round(def.soldiers * scale);

		this._remainingInWave = z + r + s;
		this._spawnQueue = [];
		this._spawnTimer = 0;

		for (let i = 0; i < z; i++) {
			this._spawnQueue.push(() => this._spawnEnemy(this._zombiePool));
		}
		for (let i = 0; i < r; i++) {
			this._spawnQueue.push(() => this._spawnEnemy(this._robotPool));
		}
		for (let i = 0; i < s; i++) {
			this._spawnQueue.push(() => this._spawnEnemy(this._soldierPool));
		}

		// Shuffle spawn order
		const q = this._spawnQueue;
		for (let i = q.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const tmp = q[i] as () => BaseEnemy;
			q[i] = q[j] as () => BaseEnemy;
			q[j] = tmp;
		}

		gameState.wave = waveNum;
	}

	private _spawnEnemy(pool: NodePool<BaseEnemy>): BaseEnemy {
		const enemy = pool.acquire();
		enemy._playerRef = this.playerRef;
		enemy._bulletManager = this.bulletManager;
		enemy._onDied = (e) => this._onEnemyDied(e, pool);
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

		// Maybe spawn pickup
		if (Math.random() < PICKUP_DROP_CHANCE) {
			this._spawnPickup(enemy.position.x, enemy.position.y);
		}

		pool.release(enemy);
		this._remainingInWave--;

		if (this._remainingInWave <= 0 && this._spawnQueue.length === 0) {
			this.waveComplete.emit(this._waveIndex);
		}
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
		pickup.collected.connect((weaponId: string) => {
			this.playerRef?.unlockWeapon(weaponId);
		});
		this.add(pickup);
	}

	get activeEnemyCount(): number {
		return this._activeEnemies.size;
	}
}
