import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import {
	GAME_HEIGHT,
	GAME_WIDTH,
	PLAYER_FIRE_RATE,
	PLAYER_INVINCIBILITY_DURATION,
	PLAYER_MAX_HEALTH,
	PLAYER_RAPID_FIRE_RATE,
	PLAYER_SPEED,
} from "../config.js";
import { FRAME, PLAYER_SCALE_X, PLAYER_SCALE_Y, tilesetAtlas } from "../sprites.js";
import { gameState } from "../state.js";
import { playerBulletPool } from "./player-bullet.js";

const HALF_WIDTH = 20;
const HALF_HEIGHT = 15;
const SPREAD_ANGLE = Math.PI / 12; // ~15 degrees

export class Player extends Actor {
	override collisionGroup = "player";
	override solid = true;
	override gravity = 0;
	override applyGravity = false;

	readonly playerHit: Signal<void> = signal<void>();
	readonly playerDied: Signal<void> = signal<void>();

	health = PLAYER_MAX_HEALTH;
	shieldActive = false;
	spreadShot = false;
	rapidFire = false;

	private _fireTimer = 0;
	private _invincibleTimer = 0;

	sprite!: Sprite;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(16, 12)} />
				<Sprite
					ref="sprite"
					texture="tileset"
					sourceRect={tilesetAtlas.getFrameOrThrow(FRAME.PLAYER)}
					scale={[PLAYER_SCALE_X, PLAYER_SCALE_Y]}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("player");
	}

	override onFixedUpdate(dt: number) {
		// --- Movement ---
		const hAxis = this.game.input.getAxis("left", "right");
		const vAxis = this.game.input.getAxis("up", "down");
		this.velocity = new Vec2(hAxis * PLAYER_SPEED, vAxis * PLAYER_SPEED);
		this.move(dt);

		// Clamp to screen
		const px = Math.max(HALF_WIDTH, Math.min(GAME_WIDTH - HALF_WIDTH, this.position.x));
		const py = Math.max(HALF_HEIGHT, Math.min(GAME_HEIGHT - HALF_HEIGHT, this.position.y));
		if (px !== this.position.x || py !== this.position.y) {
			this.position._set(px, py);
			const world = this._getWorld();
			if (world) world.updatePosition(this);
		}

		// --- Invincibility timer ---
		if (this._invincibleTimer > 0) {
			this._invincibleTimer -= dt;
		}

		// --- Auto-fire ---
		this._fireTimer -= dt;
		if (this.game.input.isPressed("fire") && this._fireTimer <= 0) {
			this._fire();
			const rate = this.rapidFire ? PLAYER_RAPID_FIRE_RATE : PLAYER_FIRE_RATE;
			this._fireTimer = rate;
		}
	}

	takeDamage(): void {
		if (this.shieldActive || this._invincibleTimer > 0) return;

		this.health--;
		gameState.lives = this.health;
		this._invincibleTimer = PLAYER_INVINCIBILITY_DURATION;
		this.playerHit.emit();

		if (this.health <= 0) {
			this.playerDied.emit();
		}
	}

	private _fire(): void {
		if (this.spreadShot) {
			// Fire 3 bullets in a spread
			for (const offset of [-SPREAD_ANGLE, 0, SPREAD_ANGLE]) {
				const bullet = playerBulletPool.acquire();
				bullet.angleOffset = offset;
				bullet.isSpread = true;
				bullet.position._set(this.position.x, this.position.y - HALF_HEIGHT);
				this.scene!.add(bullet);
			}
		} else {
			const bullet = playerBulletPool.acquire();
			bullet.position._set(this.position.x, this.position.y - HALF_HEIGHT);
			this.scene!.add(bullet);
		}
	}

	serialize(): Record<string, unknown> {
		return {
			health: this.health,
			shieldActive: this.shieldActive,
			spreadShot: this.spreadShot,
			rapidFire: this.rapidFire,
			x: this.position.x,
			y: this.position.y,
		};
	}
}
