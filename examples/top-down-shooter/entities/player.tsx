import { Damageable } from "@quintus/ai-prefabs";
import { Vec2 } from "@quintus/math";
import type { CollisionInfo } from "@quintus/physics";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import {
	PLAYER_CAPSULE_HEIGHT,
	PLAYER_INVINCIBILITY_DURATION,
	PLAYER_MAX_HEALTH,
	PLAYER_RADIUS,
	PLAYER_SPEED,
} from "../config.js";
import { CHARACTER_SCALE, charactersAtlas, FRAME } from "../sprites.js";
import { gameState } from "../state.js";
import type { BulletManager } from "./bullet-manager.js";
import { WEAPONS, type WeaponDef } from "./weapons.js";

const WEAPON_IDS = Object.keys(WEAPONS);

const DamageableActor = Damageable(Actor, {
	maxHealth: PLAYER_MAX_HEALTH,
	invincibilityDuration: PLAYER_INVINCIBILITY_DURATION,
	deathTween: false,
});

export class Player extends DamageableActor {
	override collisionGroup = "player";
	override solid = true;
	override gravity = 0;
	override applyGravity = false;
	override upDirection = new Vec2(0, 0);
	bulletManager: BulletManager | null = null;

	private _speed = PLAYER_SPEED;

	// Weapon state
	private _currentWeaponId = "pistol";
	private _weapon: WeaponDef = WEAPONS.pistol as WeaponDef;
	private _ammo = Infinity;
	private _fireCooldown = 0;

	// Tracks which weapons the player has unlocked, and their remaining ammo
	private _unlockedWeapons = new Set<string>(["pistol"]);
	private _weaponAmmo = new Map<string, number>([["pistol", Infinity]]);

	// Scroll wheel weapon cycling
	private _onWheel: ((e: WheelEvent) => void) | null = null;

	sprite?: Sprite;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.capsule(PLAYER_RADIUS, PLAYER_CAPSULE_HEIGHT)} />
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

		// Damage when the player moves into an enemy
		this.collided.connect((info: CollisionInfo) => {
			const other = info.collider;
			if (other.hasTag("enemy")) {
				this.takeDamage(10);
			}
		});

		// Mouse wheel weapon cycling (only cycles unlocked weapons)
		this._onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const unlocked = WEAPON_IDS.filter((id) => this._unlockedWeapons.has(id));
			if (unlocked.length <= 1) return;
			const idx = unlocked.indexOf(this._currentWeaponId);
			const dir = e.deltaY > 0 ? 1 : -1;
			const next = (idx + dir + unlocked.length) % unlocked.length;
			this.switchWeapon(unlocked[next] as string);
		};
		this.game.canvas.addEventListener("wheel", this._onWheel);
	}

	override onFixedUpdate(dt: number) {
		// Damageable mixin ticks the invincibility timer in super.onFixedUpdate
		super.onFixedUpdate(dt);

		const input = this.game.input;

		// Movement (getAxis returns analog values from gamepad sticks, -1/0/1 from keyboard)
		let vx = input.getAxis("move_left", "move_right");
		let vy = input.getAxis("move_up", "move_down");

		const mag = Math.sqrt(vx * vx + vy * vy);
		if (mag > 1) {
			vx /= mag;
			vy /= mag;
		}

		this.velocity.x = vx * this._speed;
		this.velocity.y = vy * this._speed;
		this.move(dt);

		// Aiming: prefer right stick if active, otherwise fall back to mouse
		const aimX = input.getAxis("aim_left", "aim_right");
		const aimY = input.getAxis("aim_up", "aim_down");
		if (Math.abs(aimX) > 0.1 || Math.abs(aimY) > 0.1) {
			this.rotation = Math.atan2(aimY, aimX);
		} else {
			const mouse = input.mousePosition;
			this.rotation = Math.atan2(mouse.y - this.position.y, mouse.x - this.position.x);
		}

		// Fire cooldown
		if (this._fireCooldown > 0) {
			this._fireCooldown -= dt;
		}

		// Fire (held)
		if (input.isPressed("fire")) {
			this._tryFire();
		}

		// Weapon switching (only unlocked weapons)
		if (input.isJustPressed("weapon1")) this.switchWeapon("pistol");
		if (input.isJustPressed("weapon2")) this.switchWeapon("machine");
		if (input.isJustPressed("weapon3")) this.switchWeapon("silencer");

		// Invincibility blink — uses isInvincible() from Damageable mixin.
		// sin(elapsed * 20) produces ~3 Hz flicker, matching the dungeon visual.
		if (this.isInvincible()) {
			if (this.sprite) {
				this.sprite.alpha = Math.sin(this.game.elapsed * 20) > 0 ? 0.3 : 1;
			}
		} else if (this.sprite && this.sprite.alpha < 1) {
			this.sprite.alpha = 1;
		}
	}

	private _tryFire(): void {
		if (this._fireCooldown > 0) return;
		if (this._ammo <= 0) {
			// Out of ammo — switch back to pistol (infinite ammo)
			if (this._currentWeaponId !== "pistol") {
				this.switchWeapon("pistol");
			}
			return;
		}

		this._fireCooldown = this._weapon.fireRate;

		// Play weapon sound
		this.game.audio.play(this._weapon.sound, { bus: "sfx" });

		// Consume ammo
		if (this._ammo !== Infinity) {
			this._ammo--;
			this._weaponAmmo.set(this._currentWeaponId, this._ammo);
			gameState.ammo = this._ammo;
		}

		// Spawn bullet
		if (this.bulletManager) {
			const aimAngle = this.rotation;
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

	/** Unlock a weapon (e.g. from a pickup) and switch to it with a full clip. */
	unlockWeapon(weaponId: string): void {
		const weapon = WEAPONS[weaponId];
		if (!weapon) return;
		this._unlockedWeapons.add(weaponId);
		this.game.audio.play("pickup", { bus: "sfx" });
		// Save current weapon's ammo, give a full clip of the new one
		this._weaponAmmo.set(this._currentWeaponId, this._ammo);
		this._currentWeaponId = weaponId;
		this._weapon = weapon;
		this._ammo = weapon.maxAmmo;
		this._weaponAmmo.set(weaponId, this._ammo);
		this._fireCooldown = 0;

		if (this.sprite) {
			this.sprite.sourceRect = charactersAtlas.getFrameOrThrow(weapon.playerFrame);
		}

		// Update state — set maxAmmo BEFORE currentWeapon so the HUD reads correct values
		gameState.maxAmmo = weapon.maxAmmo;
		gameState.ammo = this._ammo;
		gameState.currentWeapon = weaponId;
	}

	switchWeapon(weaponId: string): void {
		const weapon = WEAPONS[weaponId];
		if (!weapon) return;
		if (weaponId === this._currentWeaponId) return;
		if (!this._unlockedWeapons.has(weaponId)) return;

		// Save current weapon's ammo, restore target weapon's ammo
		this._weaponAmmo.set(this._currentWeaponId, this._ammo);
		this._currentWeaponId = weaponId;
		this._weapon = weapon;
		this._ammo = this._weaponAmmo.get(weaponId) ?? weapon.ammo;
		this._fireCooldown = 0;
		this.game.audio.play("weapon_switch", { bus: "sfx" });

		// Update sprite frame
		if (this.sprite) {
			this.sprite.sourceRect = charactersAtlas.getFrameOrThrow(weapon.playerFrame);
		}

		// Update state — set maxAmmo BEFORE currentWeapon so the HUD reads correct values
		gameState.maxAmmo = weapon.maxAmmo;
		gameState.ammo = this._ammo;
		gameState.currentWeapon = weaponId;
	}

	override onDestroy(): void {
		if (this._onWheel) {
			this.game.canvas.removeEventListener("wheel", this._onWheel);
			this._onWheel = null;
		}
		super.onDestroy();
	}

	// Bypass mixin's takeDamage for lethal hits to prevent auto-destroy.
	// ArenaScene manages death via died signal (0.5s delay + scene switch),
	// so we emit the signals manually without triggering _playDeathEffect().
	override takeDamage(amount: number): void {
		if (this.isDead() || this.isInvincible()) return;

		this.game.audio.play("player_hit", { bus: "sfx" });

		if (this.health <= amount) {
			this.health = 0;
			gameState.health = 0;
			this.damaged.emit(0);
			this.died.emit();
			return;
		}

		super.takeDamage(amount);
		gameState.health = this.health;
	}

	get currentWeaponId(): string {
		return this._currentWeaponId;
	}
}
