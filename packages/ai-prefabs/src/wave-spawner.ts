import { Node, type Signal, signal } from "@quintus/core";

export interface WaveEntry {
	type: string;
	count: number;
	delay?: number;
}

export class WaveSpawner extends Node {
	spawnInterval = 0.6;
	wavePause = 2.0;
	autoStart = false;

	readonly spawnRequested: Signal<{ type: string; wave: number; index: number }> = signal<{
		type: string;
		wave: number;
		index: number;
	}>();
	readonly waveStarted: Signal<number> = signal<number>();
	readonly waveCleared: Signal<number> = signal<number>();
	readonly allCleared: Signal<void> = signal<void>();

	private _waves: WaveEntry[][] = [];
	private _currentWave = -1;
	private _spawnQueue: WaveEntry[] = [];
	private _currentEntry: WaveEntry | null = null;
	private _spawnedInEntry = 0;
	private _spawnTimer = 0;
	private _activeCount = 0;
	private _spawning = false;
	private _betweenWaves = false;
	private _betweenWaveTimer = 0;
	private _complete = false;
	private _totalSpawnedInWave = 0;

	defineWaves(waves: WaveEntry[][]): void {
		this._waves = waves;
		this._complete = false;
		this._currentWave = -1;
	}

	start(): void {
		if (this._waves.length === 0) return;
		this._complete = false;
		this._startNextWave();
	}

	notifyDeath(): void {
		this._activeCount--;
		if (this._activeCount < 0) this._activeCount = 0;
		this._checkWaveCleared();
	}

	isComplete(): boolean {
		return this._complete;
	}

	get currentWave(): number {
		return this._currentWave;
	}

	get totalWaves(): number {
		return this._waves.length;
	}

	get activeCount(): number {
		return this._activeCount;
	}

	override onReady() {
		super.onReady();
		if (this.autoStart) this.start();
	}

	override onFixedUpdate(dt: number) {
		if (this._complete) return;

		if (this._betweenWaves) {
			this._betweenWaveTimer -= dt;
			if (this._betweenWaveTimer <= 0) {
				this._betweenWaves = false;
				this._startNextWave();
			}
			return;
		}

		if (!this._spawning) return;
		this._processSpawnQueue(dt);
	}

	private _startNextWave(): void {
		this._currentWave++;
		if (this._currentWave >= this._waves.length) {
			this._complete = true;
			this.allCleared.emit();
			return;
		}
		const wave = this._waves[this._currentWave];
		this._spawnQueue = wave ? [...wave] : [];
		this._currentEntry = null;
		this._spawnedInEntry = 0;
		this._spawnTimer = 0;
		this._spawning = true;
		this._totalSpawnedInWave = 0;
		this.waveStarted.emit(this._currentWave);
		this._advanceEntry();
	}

	private _advanceEntry(): void {
		if (this._spawnQueue.length === 0) {
			this._currentEntry = null;
			this._spawning = false;
			this._checkWaveCleared();
			return;
		}
		this._currentEntry = this._spawnQueue.shift() ?? null;
		this._spawnedInEntry = 0;
		this._spawnTimer = 0;
	}

	private _processSpawnQueue(dt: number): void {
		if (!this._currentEntry) return;
		this._spawnTimer += dt;

		const interval = this._currentEntry.delay ?? this.spawnInterval;
		while (this._spawnTimer >= interval && this._currentEntry) {
			this._spawnTimer -= interval;
			this._activeCount++;
			this.spawnRequested.emit({
				type: this._currentEntry.type,
				wave: this._currentWave,
				index: this._totalSpawnedInWave,
			});
			this._totalSpawnedInWave++;
			this._spawnedInEntry++;

			if (this._spawnedInEntry >= this._currentEntry.count) {
				this._advanceEntry();
			}
		}
	}

	private _checkWaveCleared(): void {
		if (this._activeCount > 0) return;
		if (this._spawning) return;
		if (this._currentEntry !== null) return;

		this.waveCleared.emit(this._currentWave);

		if (this._currentWave >= this._waves.length - 1) {
			this._complete = true;
			this.allCleared.emit();
		} else {
			this._betweenWaves = true;
			this._betweenWaveTimer = this.wavePause;
		}
	}
}
