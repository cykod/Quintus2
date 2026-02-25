import { Node, type Signal, signal } from "@quintus/core";
import { SPAWN_INTERVAL, WAVE_COUNT, WAVE_DELAY } from "../config.js";
import type { PathDef } from "../path.js";
import { BasicCreep } from "./basic-creep.js";
import { FastCreep } from "./fast-creep.js";
import type { PathFollower } from "./path-follower.js";
import { TankCreep } from "./tank-creep.js";

interface WaveEntry {
	type: "basic" | "fast" | "tank";
	count: number;
}

export class WaveManager extends Node {
	pathDef!: PathDef;

	readonly waveStarted: Signal<number> = signal<number>();
	readonly waveCleared: Signal<number> = signal<number>();
	readonly allWavesCleared: Signal<void> = signal<void>();
	readonly enemySpawned: Signal<PathFollower> = signal<PathFollower>();

	private _currentWave = 0;
	private _spawnQueue: WaveEntry[] = [];
	private _currentEntry: WaveEntry | null = null;
	private _spawnedInEntry = 0;
	private _spawnTimer = 0;
	private _activeEnemies = 0;
	private _waveInProgress = false;
	private _betweenWaves = false;
	private _betweenWaveTimer = 0;
	private _allDone = false;

	get currentWave(): number {
		return this._currentWave;
	}

	get activeEnemies(): number {
		return this._activeEnemies;
	}

	startWaves(): void {
		this._currentWave = 0;
		this._allDone = false;
		this._startNextWave();
	}

	override onFixedUpdate(dt: number) {
		if (this._allDone) return;

		// Between waves delay
		if (this._betweenWaves) {
			this._betweenWaveTimer -= dt;
			if (this._betweenWaveTimer <= 0) {
				this._betweenWaves = false;
				this._startNextWave();
			}
			return;
		}

		if (!this._waveInProgress) return;

		this._processSpawnQueue(dt);

		// Check if wave is clear
		if (this._activeEnemies <= 0 && this._spawnQueue.length === 0 && this._currentEntry === null) {
			this._waveInProgress = false;
			this.waveCleared.emit(this._currentWave);

			if (this._currentWave >= WAVE_COUNT) {
				this._allDone = true;
				this.allWavesCleared.emit();
			} else {
				this._betweenWaves = true;
				this._betweenWaveTimer = WAVE_DELAY;
			}
		}
	}

	private _startNextWave(): void {
		this._currentWave++;
		this._spawnQueue = this._buildWave(this._currentWave);
		this._currentEntry = null;
		this._spawnedInEntry = 0;
		this._spawnTimer = 0;
		this._waveInProgress = true;
		this.waveStarted.emit(this._currentWave);
	}

	private _buildWave(wave: number): WaveEntry[] {
		const entries: WaveEntry[] = [];

		switch (wave) {
			case 1:
				entries.push({ type: "basic", count: 5 });
				break;
			case 2:
				entries.push({ type: "basic", count: 4 });
				entries.push({ type: "fast", count: 3 });
				break;
			case 3:
				entries.push({ type: "basic", count: 5 });
				entries.push({ type: "fast", count: 4 });
				entries.push({ type: "tank", count: 1 });
				break;
			case 4:
				entries.push({ type: "fast", count: 5 });
				entries.push({ type: "tank", count: 3 });
				break;
			case 5:
				entries.push({ type: "basic", count: 6 });
				entries.push({ type: "fast", count: 5 });
				entries.push({ type: "tank", count: 4 });
				break;
			default:
				entries.push({ type: "tank", count: wave });
				break;
		}

		return entries;
	}

	private _processSpawnQueue(dt: number): void {
		if (this._spawnQueue.length === 0 && this._currentEntry === null) return;

		this._spawnTimer -= dt;
		if (this._spawnTimer > 0) return;

		if (this._currentEntry === null) {
			this._currentEntry = this._spawnQueue.shift()!;
			this._spawnedInEntry = 0;
		}

		this._spawnEnemy(this._currentEntry.type);
		this._spawnedInEntry++;
		this._spawnTimer = SPAWN_INTERVAL;

		if (this._spawnedInEntry >= this._currentEntry.count) {
			this._currentEntry = null;
		}
	}

	private _spawnEnemy(type: string): void {
		let enemy: PathFollower;

		switch (type) {
			case "fast":
				enemy = new FastCreep();
				break;
			case "tank":
				enemy = new TankCreep();
				break;
			default:
				enemy = new BasicCreep();
				break;
		}

		enemy.pathDef = this.pathDef;
		this.scene?.addChild(enemy);
		this._activeEnemies++;

		enemy.died.connect(() => {
			this._activeEnemies--;
		});

		enemy.reachedExit.connect(() => {
			this._activeEnemies--;
		});

		this.enemySpawned.emit(enemy);
	}
}
