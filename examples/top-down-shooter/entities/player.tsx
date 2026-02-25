import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { CollisionInfo } from "@quintus/physics";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import {
	PLAYER_INVINCIBILITY_DURATION,
	PLAYER_MAX_HEALTH,
	PLAYER_RADIUS,
	PLAYER_SPEED,
} from "../config.js";
import { CHARACTER_SCALE, charactersAtlas, FRAME } from "../sprites.js";
import { gameState } from "../state.js";
import type { BulletManager } from "./bullet-manager.js";
import { WEAPONS, type WeaponDef } from "./weapons.js";

export class Player extends Actor {
	override collisionGroup = "player";
	override solid = true;
	override gravity = 0;
	override applyGravity = false;
	override upDirection = new Vec2(0, 0);

	bulletManager: BulletManager | null = null;

	private _speed = PLAYER_SPEED;
	private _health = PLAYER_MAX_HEALTH;
	private _invincible = false;
	private _invincibleTimer = 0;

	// Weapon state
	private _currentWeaponId = "pistol";
	private _weapon: WeaponDef = WEAPONS.pistol as WeaponDef;
	private _ammo = Infinity;
	private _fireCooldown = 0;
	private _reloadTimer = 0;
	private _isReloading = false;

	sprite?: Sprite;

	readonly damaged: Signal<number> = signal<number>();
	readonly died: Signal<void> = signal<void>();

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.circle(PLAYER_RADIUS)} />
				<Sprite
					ref="sprite"
					texture="spritesheet_characters"
					sourceRect={charactersAtlas.getFrameOrThrow(FRAME.PLAYER_GUN)}
					scale={[CHARACTER_SCALE, CHARACTER_SCALE]}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("player");

		this.collided.connect((info: CollisionInfo) => {
			const other = info.collider;
			if (other.hasTag("enemy")) {
				this.takeDamage(10);
			}
		});
	}

	override onFixedUpdate(dt: number) {
		const input = this.game.input;

		// Movement
		let vx = 0;
		let vy = 0;
		if (input.isPressed("move_left")) vx -= 1;
		if (input.isPressed("move_right")) vx += 1;
		if (input.isPressed("move_up")) vy -= 1;
		if (input.isPressed("move_down")) vy += 1;

		if (vx !== 0 && vy !== 0) {
			const inv = 1 / Math.SQRT2;
			vx *= inv;
			vy *= inv;
		}

		this.velocity.x = vx * this._speed;
		this.velocity.y = vy * this._speed;
		this.move(dt);

		// Mouse aim
		const mouse = input.mousePosition;
		this.rotation = Math.atan2(mouse.y - this.position.y, mouse.x - this.position.x) + Math.PI / 2;

		// Fire cooldown
		if (this._fireCooldown > 0) {
			this._fireCooldown -= dt;
		}

		// Reload timer
		if (this._isReloading) {
			this._reloadTimer -= dt;
			if (this._reloadTimer <= 0) {
				this._isReloading = false;
				this._ammo = this._weapon.maxAmmo;
				gameState.ammo = this._ammo;
				gameState.isReloading = false;
			}
		}

		// Fire (held)
		if (input.isPressed("fire") && !this._isReloading) {
			this._tryFire();
		}

		// Reload
		if (input.isJustPressed("reload")) {
			this._startReload();
		}

		// Weapon switching
		if (input.isJustPressed("weapon1")) this.switchWeapon("pistol");
		if (input.isJustPressed("weapon2")) this.switchWeapon("machine");
		if (input.isJustPressed("weapon3")) this.switchWeapon("silencer");

		// Invincibility blink
		if (this._invincible) {
			this._invincibleTimer -= dt;
			if (this.sprite) {
				this.sprite.alpha = Math.sin(this._invincibleTimer * 20) > 0 ? 0.3 : 1;
			}
			if (this._invincibleTimer <= 0) {
				this._invincible = false;
				if (this.sprite) this.sprite.alpha = 1;
			}
		}
	}

	private _tryFire(): void {
		if (this._fireCooldown > 0) return;
		if (this._ammo <= 0) {
			this._startReload();
			return;
		}

		this._fireCooldown = this._weapon.fireRate;

		// Consume ammo
		if (this._ammo !== Infinity) {
			this._ammo--;
			gameState.ammo = this._ammo;
		}

		// Spawn bullet
		if (this.bulletManager) {
			const aimAngle = this.rotation - Math.PI / 2;
			const spread = (Math.random() - 0.5) * this._weapon.spread;
			const fireAngle = aimAngle + spread;

			const spawnDist = PLAYER_RADIUS + 4;
			const spawnX = this.position.x + Math.cos(aimAngle) * spawnDist;
			const spawnY = this.position.y + Math.sin(aimAngle) * spawnDist;

			this.bulletManager.spawnPlayerBullet(
				spawnX,
				spawnY,
				fireAngle,
				this._weapon.bulletSpeed,
				this._weapon.damage,
			);
		}
	}

	private _startReload(): void {
		if (this._isReloading) return;
		if (this._weapon.reloadTime <= 0) return;
		if (this._ammo === this._weapon.maxAmmo) return;

		this._isReloading = true;
		this._reloadTimer = this._weapon.reloadTime;
		gameState.isReloading = true;
	}

	switchWeapon(weaponId: string): void {
		const weapon = WEAPONS[weaponId];
		if (!weapon) return;
		if (weaponId === this._currentWeaponId) return;

		this._currentWeaponId = weaponId;
		this._weapon = weapon;
		this._ammo = weapon.ammo;
		this._fireCooldown = 0;
		this._isReloading = false;
		this._reloadTimer = 0;

		// Update sprite frame
		if (this.sprite) {
			this.sprite.sourceRect = charactersAtlas.getFrameOrThrow(weapon.playerFrame);
		}

		// Update state
		gameState.currentWeapon = weaponId;
		gameState.ammo = this._ammo;
		gameState.maxAmmo = weapon.maxAmmo;
		gameState.isReloading = false;
	}

	takeDamage(amount: number): void {
		if (this._invincible) return;

		this._health -= amount;
		this._invincible = true;
		this._invincibleTimer = PLAYER_INVINCIBILITY_DURATION;

		gameState.health = Math.max(0, this._health);
		this.damaged.emit(this._health);

		if (this._health <= 0) {
			this.died.emit();
		}
	}

	get health(): number {
		return this._health;
	}

	get currentWeaponId(): string {
		return this._currentWeaponId;
	}
}
