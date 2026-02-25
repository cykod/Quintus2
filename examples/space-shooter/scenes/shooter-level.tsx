import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { CollisionInfo } from "@quintus/physics";
import {
	BOSS_WAVE_INTERVAL,
	GAME_HEIGHT,
	GAME_WIDTH,
	POWERUP_DROP_CHANCE,
	RAPID_FIRE_DURATION,
	SHIELD_DURATION,
	SPREAD_SHOT_DURATION,
} from "../config.js";
import { BasicEnemy } from "../entities/basic-enemy.js";
import { BomberEnemy } from "../entities/bomber-enemy.js";
import { Boss } from "../entities/boss.js";
import { explosionPool } from "../entities/explosion.js";
import { Player } from "../entities/player.js";
import { PowerUp, type PowerUpType } from "../entities/power-up.js";
import { Starfield } from "../entities/starfield.js";
import { WeaverEnemy } from "../entities/weaver-enemy.js";
import { HUD } from "../hud/hud.js";
import { gameState } from "../state.js";

/** Enemy types by class for collision checking. */
type AnyEnemy = BasicEnemy | WeaverEnemy | BomberEnemy | Boss;

interface WaveEntry {
	type: "basic" | "weaver" | "bomber" | "boss";
	count: number;
}

export class ShooterLevel extends Scene {
	private _player!: Player;
	private _spawnQueue: WaveEntry[] = [];
	private _spawnTimer = 0;
	private _spawnDelay = 0.6;
	private _currentSpawnEntry: WaveEntry | null = null;
	private _spawnedInEntry = 0;
	private _activeEnemies = 0;
	private _waveComplete = false;

	override build() {
		return (
			<>
				<Starfield />
				<Player ref="_player" position={[GAME_WIDTH / 2, GAME_HEIGHT - 60]} />
				<HUD />
				<Camera position={[GAME_WIDTH / 2, GAME_HEIGHT / 2]} />
			</>
		);
	}

	override onReady() {
		// Player signals
		this._player.playerHit.connect(() => this._onPlayerHit());
		this._player.playerDied.connect(() => this._onPlayerDied());

		// Player→enemy contact damage (when player's move() hits a solid enemy)
		this._player.collided.connect((info: CollisionInfo) => {
			if (info.collider.collisionGroup === "enemies") {
				this._onEnemyContactPlayer(info.collider as AnyEnemy);
			}
		});

		this._startWave(gameState.wave);
	}

	override onFixedUpdate(dt: number) {
		this._processSpawnQueue(dt);

		// Check wave completion
		if (
			!this._waveComplete &&
			this._activeEnemies <= 0 &&
			this._spawnQueue.length === 0 &&
			this._currentSpawnEntry === null
		) {
			this._waveComplete = true;
			this.after(1.0, () => this._nextWave());
		}
	}

	private _startWave(wave: number): void {
		this._waveComplete = false;
		this._spawnQueue = this._buildWave(wave);
		this._currentSpawnEntry = null;
		this._spawnedInEntry = 0;
		this._spawnTimer = 0;
	}

	private _buildWave(wave: number): WaveEntry[] {
		const entries: WaveEntry[] = [];

		// Boss wave?
		if (wave > 1 && wave % BOSS_WAVE_INTERVAL === 0) {
			entries.push({ type: "boss", count: 1 });
		}

		if (wave === 1) {
			entries.push({ type: "basic", count: 5 });
		} else if (wave === 2) {
			entries.push({ type: "basic", count: 3 });
			entries.push({ type: "weaver", count: 3 });
		} else {
			// Wave 3+: escalating mix
			const basicCount = 2 + wave;
			const weaverCount = Math.floor(wave / 2) + 1;
			const bomberCount = Math.max(0, wave - 2);
			entries.push({ type: "basic", count: basicCount });
			entries.push({ type: "weaver", count: weaverCount });
			if (bomberCount > 0) {
				entries.push({ type: "bomber", count: bomberCount });
			}
		}

		return entries;
	}

	private _processSpawnQueue(dt: number): void {
		if (this._spawnQueue.length === 0 && this._currentSpawnEntry === null) return;

		this._spawnTimer -= dt;
		if (this._spawnTimer > 0) return;

		// Get next spawn entry if needed
		if (this._currentSpawnEntry === null) {
			this._currentSpawnEntry = this._spawnQueue.shift()!;
			this._spawnedInEntry = 0;
		}

		// Spawn one enemy from current entry
		this._spawnEnemy(this._currentSpawnEntry.type);
		this._spawnedInEntry++;
		this._spawnTimer = this._spawnDelay;

		// Move to next entry if done
		if (this._spawnedInEntry >= this._currentSpawnEntry.count) {
			this._currentSpawnEntry = null;
		}
	}

	private _spawnEnemy(type: string): void {
		const x = 40 + this.game.random.next() * (GAME_WIDTH - 80);

		switch (type) {
			case "basic": {
				const e = this.add(BasicEnemy, { position: new Vec2(x, -30) });
				this._connectEnemy(e);
				break;
			}
			case "weaver": {
				const e = this.add(WeaverEnemy, { position: new Vec2(x, -30) });
				this._connectEnemy(e);
				break;
			}
			case "bomber": {
				const e = this.add(BomberEnemy, { position: new Vec2(x, -30) });
				this._connectEnemy(e);
				break;
			}
			case "boss": {
				const e = this.add(Boss, {
					position: new Vec2(GAME_WIDTH / 2, 60),
				});
				this._connectEnemy(e);
				break;
			}
		}
	}

	private _connectEnemy(enemy: AnyEnemy): void {
		this._activeEnemies++;

		// Enemy killed → score, explosion, maybe power-up
		enemy.died.connect((e) => {
			this._activeEnemies--;
			gameState.score += e.points;
			this._spawnExplosion(e.position);

			// Maybe drop power-up
			if (this.game.random.next() < POWERUP_DROP_CHANCE) {
				this._spawnPowerUp(e.position);
			}
		});

		// Enemy→player contact damage (when enemy's move() hits the solid player)
		enemy.collided.connect((info: CollisionInfo) => {
			if (info.collider.hasTag("player")) {
				this._onEnemyContactPlayer(enemy);
			}
		});
	}

	private _spawnExplosion(pos: Vec2): void {
		const exp = explosionPool.acquire();
		exp.position._set(pos.x, pos.y);
		this.add(exp);
	}

	private _spawnPowerUp(pos: Vec2): void {
		const types: PowerUpType[] = ["shield", "rapid", "spread"];
		const type = types[this.game.random.int(0, types.length - 1)]!;
		const powerUp = this.add(PowerUp, {
			powerUpType: type,
			position: new Vec2(pos.x, pos.y),
		});
		powerUp.collected.connect((t) => this._activatePowerUp(t));
	}

	private _activatePowerUp(type: PowerUpType): void {
		switch (type) {
			case "shield":
				this._player.shieldActive = true;
				gameState.shieldActive = true;
				this.after(SHIELD_DURATION, () => {
					this._player.shieldActive = false;
					gameState.shieldActive = false;
				});
				break;
			case "rapid":
				this._player.rapidFire = true;
				gameState.rapidFire = true;
				this.after(RAPID_FIRE_DURATION, () => {
					this._player.rapidFire = false;
					gameState.rapidFire = false;
				});
				break;
			case "spread":
				this._player.spreadShot = true;
				gameState.spreadShot = true;
				this.after(SPREAD_SHOT_DURATION, () => {
					this._player.spreadShot = false;
					gameState.spreadShot = false;
				});
				break;
		}
	}

	private _onEnemyContactPlayer(enemy: AnyEnemy): void {
		enemy.takeDamage(enemy.hp); // destroy enemy on contact
		this._player.takeDamage();
	}

	private _onPlayerHit(): void {
		this._spawnExplosion(this._player.position);
	}

	private _onPlayerDied(): void {
		this.after(0.5, () => this.switchTo("game-over"));
	}

	private _nextWave(): void {
		gameState.wave++;
		this._startWave(gameState.wave);
	}
}
