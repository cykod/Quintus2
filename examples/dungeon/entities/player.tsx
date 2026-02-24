import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { showToast } from "../hud/toast.js";
import { entitySheet, TILE } from "../sprites.js";
import { gameState, type PotionDef } from "../state.js";
import { EquippedShield } from "./equipped-shield.js";
import { EquippedWeapon } from "./equipped-weapon.js";
import { WeaponHitbox } from "./weapon-hitbox.js";

export type Direction = "up" | "down" | "left" | "right";

const DIRECTION_VECTORS: Record<Direction, Vec2> = {
	up: new Vec2(0, -1),
	down: new Vec2(0, 1),
	left: new Vec2(-1, 0),
	right: new Vec2(1, 0),
};

export class Player extends Actor {
	speed = 80;
	override collisionGroup = "player";
	override solid = true;

	/** Top-down: no gravity, no floor detection. */
	override gravity = 0;
	override applyGravity = false;
	override upDirection = Vec2.ZERO;

	direction: Direction = "down";
	invincibilityDuration = 1.5;

	private _invincible = false;
	private _invincibleTimer = 0;
	private _bobTimer = 0;
	private _moving = false;

	// Combat state
	private _attacking = false;
	private _attackCooldown = 0;
	private _defending = false;
	private _wasDefending = false;

	sprite?: AnimatedSprite;
	weapon?: EquippedWeapon;
	shield?: EquippedShield;

	readonly damaged: Signal<number> = signal<number>();
	readonly died: Signal<void> = signal<void>();

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(10, 6)} position={[0, 4]} />
				<AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="player_idle" />
				<EquippedWeapon ref="weapon" weaponFrame={gameState.sword.spriteFrame} />
				<EquippedShield
					ref="shield"
					shieldFrame={gameState.shield?.spriteFrame ?? TILE.SHIELD_WOODEN}
					visible={gameState.shield !== null}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("player");

		// React to equipment changes from chests
		gameState.on("shield").connect(({ value }) => {
			const shield = this.shield;
			if (!shield) return;
			if (value) {
				shield.visible = true;
				shield.setShield(value.spriteFrame);
			} else {
				shield.visible = false;
			}
		});

		gameState.on("sword").connect(({ value }) => {
			this.weapon?.setWeapon(value.spriteFrame);
		});
	}

	override onFixedUpdate(dt: number) {
		const sprite = this.sprite;
		if (!sprite) return;
		const input = this.game.input;

		// Attack cooldown
		if (this._attackCooldown > 0) {
			this._attackCooldown -= dt;
			if (this._attackCooldown <= 0) this._attacking = false;
		}

		// Defend (hold) — track transitions for shield animation
		const nowDefending = input.isPressed("defend");
		if (nowDefending && !this._wasDefending) {
			this.shield?.raise(this.direction);
			this.game.audio.play("shield-up", { volume: 0.4 });
		} else if (!nowDefending && this._wasDefending) {
			this.shield?.lower();
		}
		this._wasDefending = nowDefending;
		this._defending = nowDefending;

		// Attack (just pressed, not during cooldown, not while defending)
		if (input.isJustPressed("attack") && this._attackCooldown <= 0 && !this._defending) {
			this._performAttack();
		}

		// Use potion
		if (input.isJustPressed("use_potion") && gameState.potion) {
			this._usePotion(gameState.potion);
			gameState.potion = null;
		}

		// Read directional input
		let vx = 0;
		let vy = 0;
		if (input.isPressed("left")) vx -= 1;
		if (input.isPressed("right")) vx += 1;
		if (input.isPressed("up")) vy -= 1;
		if (input.isPressed("down")) vy += 1;

		// Normalize diagonal movement
		if (vx !== 0 && vy !== 0) {
			const inv = 1 / Math.SQRT2;
			vx *= inv;
			vy *= inv;
		}

		// Speed: halved while defending, multiplied by buff
		const speedMul = gameState.activeBuff?.type === "speed" ? gameState.activeBuff.value : 1;
		const effectiveSpeed = (this._defending ? this.speed * 0.5 : this.speed) * speedMul;
		this.velocity.x = vx * effectiveSpeed;
		this.velocity.y = vy * effectiveSpeed;

		this.move(dt);

		// Track facing direction (dominant axis, prefer horizontal)
		this._moving = vx !== 0 || vy !== 0;
		if (this._moving) {
			if (Math.abs(vx) >= Math.abs(vy)) {
				this.direction = vx > 0 ? "right" : "left";
			} else {
				this.direction = vy > 0 ? "down" : "up";
			}
		}

		// Flip sprite for left direction
		const flipH = this.direction === "left";
		sprite.flipH = flipH;

		// Update equipment resting positions
		this.weapon?.updateResting(this.direction, flipH);
		this.shield?.updateResting(this.direction, flipH);

		// Walk bob animation: offset sprite y by -1 when "stepping"
		if (this._moving) {
			this._bobTimer += dt * 8;
			sprite.position.y = Math.sin(this._bobTimer) > 0 ? -1 : 0;
		} else {
			this._bobTimer = 0;
			sprite.position.y = 0;
		}

		// Invincibility timer + blink effect
		if (this._invincible) {
			this._invincibleTimer -= dt;
			sprite.alpha = Math.sin(this._invincibleTimer * 20) > 0 ? 0.3 : 1;
			if (this._invincibleTimer <= 0) {
				this._invincible = false;
				sprite.alpha = 1;
			}
		}

		// Restore sprite alpha when buff expires
		if (!this._invincible && !gameState.activeBuff && sprite.alpha < 1) {
			sprite.alpha = 1;
		}
	}

	private _performAttack(): void {
		this._attacking = true;
		this._attackCooldown = 0.4;

		this.game.audio.play("swing", { volume: 0.5 });

		// Visual: swing weapon child
		this.weapon?.swing(this.direction);

		// Spawn weapon hitbox in facing direction
		const dir = DIRECTION_VECTORS[this.direction];
		if (!this.parent) return;
		const hitbox = this.parent.add(WeaponHitbox);

		hitbox.position.x = this.position.x + dir.x * 12;
		hitbox.position.y = this.position.y + dir.y * 12;
		const damageMul = gameState.activeBuff?.type === "attack" ? gameState.activeBuff.value : 1;
		hitbox.damage = gameState.sword.damage * damageMul;
		hitbox.attackDirection = dir;
	}

	private _usePotion(potion: PotionDef): void {
		const scene = this.scene;
		if (!scene) return;
		this.game.audio.play("use-potion", { volume: 0.5 });
		switch (potion.type) {
			case "health":
				gameState.health = Math.min(gameState.health + potion.value, gameState.maxHealth);
				showToast(scene, `Used ${potion.name}! (+${potion.value} HP)`);
				break;
			case "speed":
				gameState.activeBuff = potion;
				gameState.buffTimeRemaining = potion.duration;
				if (this.sprite) this.sprite.alpha = 0.8;
				showToast(scene, `Used ${potion.name}! (${potion.value}x speed, ${potion.duration}s)`);
				break;
			case "attack":
				gameState.activeBuff = potion;
				gameState.buffTimeRemaining = potion.duration;
				if (this.sprite) this.sprite.alpha = 0.8;
				showToast(scene, `Used ${potion.name}! (${potion.value}x damage, ${potion.duration}s)`);
				break;
		}
	}

	takeDamage(amount: number, fromDirection?: Vec2): void {
		if (this._invincible) return;

		// Defending with a shield blocks all damage
		if (this._defending && gameState.shield) {
			this.game.audio.play("shield-block", { volume: 0.5 });
			return;
		}

		const finalAmount = amount;
		this.game.audio.play("player-hurt", { volume: 0.6 });

		gameState.health -= finalAmount;
		this._invincible = true;
		this._invincibleTimer = this.invincibilityDuration;

		this.damaged.emit(gameState.health);

		// Knockback
		if (fromDirection) {
			const kb = fromDirection.normalize().scale(40);
			this.velocity.x = kb.x;
			this.velocity.y = kb.y;
		}

		if (gameState.health <= 0) {
			this.died.emit();
		}
	}

	get isInvincible(): boolean {
		return this._invincible;
	}

	get isDefending(): boolean {
		return this._defending;
	}

	get isAttacking(): boolean {
		return this._attacking;
	}
}
