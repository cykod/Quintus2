import { type Poolable, type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import { ENEMY_RADIUS } from "../config.js";
import { CHARACTER_SCALE, charactersAtlas } from "../sprites.js";
import type { BulletManager } from "./bullet-manager.js";
import type { Player } from "./player.js";

export abstract class BaseEnemy extends Actor implements Poolable {
	override collisionGroup = "enemies";
	override solid = true;
	override gravity = 0;
	override applyGravity = false;
	override upDirection = new Vec2(0, 0);

	abstract maxHealth: number;
	abstract speed: number;
	abstract contactDamage: number;
	abstract scoreValue: number;
	abstract spriteFrame: string;

	protected _health = 0;

	_playerRef: Player | null = null;
	_bulletManager: BulletManager | null = null;
	_onDied: ((enemy: BaseEnemy) => void) | null = null;

	sprite?: Sprite;

	readonly died: Signal<BaseEnemy> = signal<BaseEnemy>();

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.circle(ENEMY_RADIUS)} />
				<Sprite
					ref="sprite"
					texture="spritesheet_characters"
					sourceRect={charactersAtlas.getFrameOrThrow(this.spriteFrame)}
					scale={[CHARACTER_SCALE, CHARACTER_SCALE]}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("enemy");
		this._health = this.maxHealth;
	}

	takeDamage(amount: number): void {
		this._health -= amount;
		if (this._health <= 0) {
			this.died.emit(this);
			this._onDied?.(this);
		}
	}

	reset(): void {
		this._health = this.maxHealth;
		this._playerRef = null;
		this._bulletManager = null;
		this._onDied = null;
	}

	protected _facePlayer(): void {
		if (!this._playerRef) return;
		const dx = this._playerRef.position.x - this.position.x;
		const dy = this._playerRef.position.y - this.position.y;
		this.rotation = Math.atan2(dy, dx) + Math.PI / 2;
	}

	protected _distToPlayer(): number {
		if (!this._playerRef) return Infinity;
		const dx = this._playerRef.position.x - this.position.x;
		const dy = this._playerRef.position.y - this.position.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	protected _dirToPlayer(): Vec2 {
		if (!this._playerRef) return new Vec2(0, 0);
		const dx = this._playerRef.position.x - this.position.x;
		const dy = this._playerRef.position.y - this.position.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len < 0.01) return new Vec2(0, 0);
		return new Vec2(dx / len, dy / len);
	}
}
