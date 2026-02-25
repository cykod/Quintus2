import { Node, NodePool } from "@quintus/core";
import { EnemyBullet, PlayerBullet } from "./bullet.js";
import { MuzzleFlash } from "./muzzle-flash.js";

export interface PoolStats {
	playerBullets: { available: number; max: number };
	enemyBullets: { available: number; max: number };
}

export class BulletManager extends Node {
	private _playerPool = new NodePool(PlayerBullet, 300);
	private _enemyPool = new NodePool(EnemyBullet, 200);
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
	): PlayerBullet {
		const bullet = this._playerPool.acquire();
		bullet._manager = this;
		bullet.speed = speed;
		bullet.damage = damage;
		bullet.position.x = x;
		bullet.position.y = y;
		bullet.rotation = angle;
		bullet.velocity.x = Math.cos(angle) * speed;
		bullet.velocity.y = Math.sin(angle) * speed;
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
	): EnemyBullet {
		const bullet = this._enemyPool.acquire();
		bullet._manager = this;
		bullet.speed = speed;
		bullet.damage = damage;
		bullet.position.x = x;
		bullet.position.y = y;
		bullet.rotation = angle;
		bullet.velocity.x = Math.cos(angle) * speed;
		bullet.velocity.y = Math.sin(angle) * speed;
		this.add(bullet);

		return bullet;
	}

	recyclePlayerBullet(bullet: PlayerBullet): void {
		this._playerPool.release(bullet);
	}

	recycleEnemyBullet(bullet: EnemyBullet): void {
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
