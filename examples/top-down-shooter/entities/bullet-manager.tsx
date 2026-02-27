import { Node, NodePool } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { ENEMY_BULLET_COLOR, PLAYER_BULLET_COLOR, ShooterBullet } from "./bullet.js";
import { MuzzleFlash } from "./muzzle-flash.js";

export interface PoolStats {
	playerBullets: { available: number; max: number };
	enemyBullets: { available: number; max: number };
}

export class BulletManager extends Node {
	private _playerPool = new NodePool(ShooterBullet, 300);
	private _enemyPool = new NodePool(ShooterBullet, 200);
	private _flashPool = new NodePool(MuzzleFlash, 60);

	override onReady() {
		this._playerPool.prefill(100);
		this._enemyPool.prefill(50);
		this._flashPool.prefill(30);
	}

	spawnPlayerBullet(
		x: number,
		y: number,
		angle: number,
		speed: number,
		damage: number,
	): ShooterBullet {
		const bullet = this._playerPool.acquire();
		bullet.collisionGroup = "player_bullets";
		bullet.drawColor = PLAYER_BULLET_COLOR;
		bullet.damageTag = "enemy";
		bullet.setReleaser((b) => this._playerPool.release(b as ShooterBullet));
		bullet.fire(new Vec2(x, y), angle, { speed, damage });
		this.add(bullet);

		this._spawnFlash(x, y);

		return bullet;
	}

	spawnEnemyBullet(
		x: number,
		y: number,
		angle: number,
		speed: number,
		damage: number,
	): ShooterBullet {
		const bullet = this._enemyPool.acquire();
		bullet.collisionGroup = "enemy_bullets";
		bullet.drawColor = ENEMY_BULLET_COLOR;
		bullet.damageTag = "player";
		bullet.setReleaser((b) => this._enemyPool.release(b as ShooterBullet));
		bullet.fire(new Vec2(x, y), angle, { speed, damage });
		this.add(bullet);

		return bullet;
	}

	recyclePlayerBullet(bullet: ShooterBullet): void {
		this._playerPool.release(bullet);
	}

	recycleEnemyBullet(bullet: ShooterBullet): void {
		this._enemyPool.release(bullet);
	}

	getPoolStats(): PoolStats {
		return {
			playerBullets: {
				available: this._playerPool.available,
				max: this._playerPool.maxSize,
			},
			enemyBullets: {
				available: this._enemyPool.available,
				max: this._enemyPool.maxSize,
			},
		};
	}

	private _spawnFlash(x: number, y: number): void {
		const flash = this._flashPool.acquire();
		flash._recycle = () => this._flashPool.release(flash);
		flash.position.x = x;
		flash.position.y = y;
		this.add(flash);
	}
}
