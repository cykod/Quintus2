import { type WaveEntry, WaveSpawner } from "@quintus/ai-prefabs";
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
import { spawnExplosion } from "../entities/explosion.js";
import { Player } from "../entities/player.js";
import { PowerUp, type PowerUpType } from "../entities/power-up.js";
import { Starfield } from "../entities/starfield.js";
import { WeaverEnemy } from "../entities/weaver-enemy.js";
import { HUD } from "../hud/hud.js";
import { gameState } from "../state.js";

/** Enemy types by class for collision checking. */
type AnyEnemy = BasicEnemy | WeaverEnemy | BomberEnemy | Boss;

export class ShooterLevel extends Scene {
	private _player!: Player;
	private _spawner!: WaveSpawner;

	override build() {
		return (
			<>
				<Starfield />
				<Player ref="_player" position={[GAME_WIDTH / 2, GAME_HEIGHT - 60]} />
				<WaveSpawner ref="_spawner" />
				<HUD />
				<Camera position={[GAME_WIDTH / 2, GAME_HEIGHT / 2]} />
			</>
		);
	}

	override onReady() {
		// Player signals
		this._player.damaged.connect(() => this._onPlayerHit());
		this._player.died.connect(() => this._onPlayerDied());

		// Player->enemy contact damage (when player's move() hits a solid enemy)
		this._player.collided.connect((info: CollisionInfo) => {
			if (info.collider.collisionGroup === "enemies") {
				this._onEnemyContactPlayer(info.collider as AnyEnemy);
			}
		});

		// WaveSpawner signals
		this._spawner.spawnInterval = 0.6;
		this._spawner.spawnRequested.connect(({ type }) => this._spawnEnemy(type));
		this._spawner.waveCleared.connect(() => this._nextWave());

		this._launchWave(gameState.wave);
	}

	private _launchWave(wave: number): void {
		const entries = this._buildWave(wave);
		this._spawner.defineWaves([entries]);
		this._spawner.start();
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
		// Enemy killed -> score, explosion, maybe power-up
		enemy.died.connect(() => {
			this._spawner.notifyDeath();
			gameState.score += enemy.points;
			this._spawnExplosion(enemy.position, enemy.hasTag("boss"));

			// Maybe drop power-up
			if (this.game.random.next() < POWERUP_DROP_CHANCE) {
				this._spawnPowerUp(enemy.position);
			}
		});

		// Enemy->player contact damage (when enemy's move() hits the solid player)
		enemy.collided.connect((info: CollisionInfo) => {
			if (info.collider.hasTag("player")) {
				this._onEnemyContactPlayer(enemy);
			}
		});
	}

	private _spawnExplosion(pos: Vec2, boss = false): void {
		const scale = boss ? 1.5 : 0.6;
		spawnExplosion(this, pos, scale);
	}

	private _spawnPowerUp(pos: Vec2): void {
		const types: PowerUpType[] = ["shield", "rapid", "spread"];
		const type = types[this.game.random.int(0, types.length - 1)] ?? "shield";
		const powerUp = this.add(PowerUp, {
			powerUpType: type,
			position: new Vec2(pos.x, pos.y),
		});
		powerUp.collected.connect(() => this._activatePowerUp(powerUp.powerUpType));
	}

	/**
	 * Design decision -- Timed buff implementation:
	 * Power-up buffs are flags on Player + gameState, deactivated by an `after()`
	 * timer on the scene. A second same-type buff does NOT extend the timer --
	 * it sets the flag again but the original timer still fires to deactivate.
	 */
	private _activatePowerUp(type: PowerUpType): void {
		this.game.audio.play("powerup", { bus: "sfx" });
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
		enemy.takeDamage(enemy.health); // destroy enemy on contact
		this._player.takeDamage(1);
	}

	private _onPlayerHit(): void {
		this._spawnExplosion(this._player.position);
	}

	private _onPlayerDied(): void {
		this.after(0.5, () => this.switchTo("game-over"));
	}

	private _nextWave(): void {
		gameState.wave++;
		this.after(1.0, () => this._launchWave(gameState.wave));
	}
}
