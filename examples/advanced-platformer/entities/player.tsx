import { Damageable } from "@quintus/ai-prefabs";
import { Camera } from "@quintus/camera";
import { Actor, CollisionShape, Shape } from "@quintus/physics";
import { AnimatedSprite } from "@quintus/sprites";
import { playerSheet } from "../sprites.js";
import { gameState } from "../state.js";

const DamageableActor = Damageable(Actor, {
	maxHealth: 5,
	invincibilityDuration: 1.5,
	deathTween: true,
});

export class Player extends DamageableActor {
	speed = 250;
	jumpForce = -500;
	doubleJumpForce = -420;
	climbSpeed = 150;
	duckSpeedMultiplier = 0.4;

	override collisionGroup = "player";
	override solid = true;
	override floorMaxAngle = Math.PI / 4 + 0.15;
	override floorSnapLength = 32;

	/** Y position below which the player dies from falling. Set by the level scene. */
	fallDeathY = 2000;

	private _canDoubleJump = false;
	private _facing: "left" | "right" = "right";
	private _isClimbing = false;
	private _isDucking = false;
	private _isOnLadder = false;
	private _ladderMinX = 0;
	private _ladderMaxX = 0;
	private _starPower = false;
	private _starTimer = 0;

	sprite!: AnimatedSprite;

	// ─── Public API (for Phase 5 wiring) ─────────────────────────

	get hasStarPower(): boolean {
		return this._starPower;
	}

	get isDucking(): boolean {
		return this._isDucking;
	}

	get isClimbing(): boolean {
		return this._isClimbing;
	}

	enterLadder(minX: number, maxX: number): void {
		this._isOnLadder = true;
		this._ladderMinX = minX;
		this._ladderMaxX = maxX;
	}

	exitLadder(): void {
		this._isOnLadder = false;
		this._ladderMinX = 0;
		this._ladderMaxX = 0;
		if (this._isClimbing) {
			this._isClimbing = false;
			this.applyGravity = true;
		}
	}

	activateStarPower(duration: number): void {
		this._starPower = true;
		this._starTimer = duration;
		gameState.starPower = true;
		gameState.starTimeRemaining = duration;
	}

	// ─── Lifecycle ───────────────────────────────────────────────

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.rect(40, 56)} />
				<AnimatedSprite
					ref="sprite"
					spriteSheet={playerSheet}
					animation="idle"
					centered
					position={[0, -32]}
				/>
			</>
		);
	}

	override onReady() {
		super.onReady();
		this.tag("player");
		gameState.health = this.health;
	}

	override onFixedUpdate(dt: number) {
		// Damageable mixin ticks invincibility timer
		super.onFixedUpdate(dt);

		// Star power timer
		if (this._starPower) {
			this._starTimer -= dt;
			gameState.starTimeRemaining = Math.max(0, this._starTimer);
			if (this._starTimer <= 0) {
				this._starPower = false;
				this._starTimer = 0;
				gameState.starPower = false;
				gameState.starTimeRemaining = 0;
			}
		}

		// Delegate to movement mode
		if (this._isClimbing) {
			this._updateClimbing(dt);
		} else {
			this._updateNormal(dt);
		}

		this._updateAnimation();

		// Fall death
		if (this.position.y > this.fallDeathY && !this.isDead()) {
			this.takeDamage(this.health);
		}
	}

	override takeDamage(amount: number): void {
		if (this._starPower || this.isDead() || this.isInvincible()) return;
		this.game?.audio.play("hurt", { bus: "sfx" });
		super.takeDamage(amount);
		gameState.health = this.health;
		if (this.isDead()) {
			gameState.lives -= 1;
		}

		// Screen shake — stronger on death
		const camera = this.scene?.findFirst(Camera);
		if (camera) {
			camera.shake(this.isDead() ? 8 : 4, 0.3);
		}
	}

	// ─── Movement Modes ──────────────────────────────────────────

	private _updateNormal(dt: number): void {
		const input = this.game.input;

		// Horizontal movement
		this.velocity.x = 0;
		const speedMult = this._isDucking ? this.duckSpeedMultiplier : 1;

		if (input.isPressed("left")) {
			this.velocity.x = -this.speed * speedMult;
			this._facing = "left";
		}
		if (input.isPressed("right")) {
			this.velocity.x = this.speed * speedMult;
			this._facing = "right";
		}

		// Reset double-jump on landing
		if (this.isOnFloor()) {
			this._canDoubleJump = false;
		}

		// Jump + double-jump
		let jumped = false;
		if (input.isJustPressed("jump")) {
			if (this.isOnFloor()) {
				this.velocity.y = this.jumpForce;
				jumped = true;
				this._canDoubleJump = true;
				this._isDucking = false;
				this.game.audio.play("jump", { bus: "sfx" });
			} else if (this._canDoubleJump) {
				this.velocity.y = this.doubleJumpForce;
				jumped = true;
				this._canDoubleJump = false;
				this.game.audio.play("jump_high", { bus: "sfx", volume: 0.7 });
			}
		}

		// Duck on floor
		if (this.isOnFloor() && input.isPressed("duck")) {
			this._isDucking = true;
		} else if (!input.isPressed("duck")) {
			this._isDucking = false;
		}

		// Enter climbing
		if (this._isOnLadder && (input.isPressed("up") || input.isPressed("down"))) {
			this._isClimbing = true;
			this.applyGravity = false;
			this.velocity.y = 0;
		}

		// Slope-exit launch prevention: when grounded on a slope, move() projects
		// velocity onto the surface, giving velocity.y a negative component. Clear
		// it so the player doesn't launch off slope-to-flat transitions.
		// Only apply on slopes (floor normal has non-zero x component).
		if (this.isOnFloor() && !jumped && this.velocity.y < 0) {
			const fn = this.getFloorNormal();
			if (fn && Math.abs(fn.x) > 0.01) {
				this.velocity.y = 0;
			}
		}

		this.move(dt);
	}

	private _updateClimbing(dt: number): void {
		const input = this.game.input;
		this.applyGravity = false;
		this.velocity.x = 0;
		this.velocity.y = 0;

		if (input.isPressed("up")) {
			this.velocity.y = -this.climbSpeed;
		}
		if (input.isPressed("down")) {
			this.velocity.y = this.climbSpeed;
		}

		// Horizontal movement within ladder bounds
		if (input.isPressed("left")) {
			this.velocity.x = -this.speed;
			this._facing = "left";
		}
		if (input.isPressed("right")) {
			this.velocity.x = this.speed;
			this._facing = "right";
		}

		// Jump exits climbing
		if (input.isJustPressed("jump")) {
			this._isClimbing = false;
			this.applyGravity = true;
			this.velocity.y = this.jumpForce;
			this._canDoubleJump = true;
			this.game.audio.play("jump", { bus: "sfx" });
		}

		// Exit climbing if no longer on ladder
		if (!this._isOnLadder) {
			this._isClimbing = false;
			this.applyGravity = true;
		}

		this.move(dt);

		// Clamp horizontal position to ladder bounds
		if (this._isClimbing && this._ladderMaxX > this._ladderMinX) {
			const halfW = 20; // half of player collision width (40)
			this.position.x = Math.max(
				this._ladderMinX + halfW,
				Math.min(this._ladderMaxX - halfW, this.position.x),
			);
		}
	}

	// ─── Animation ───────────────────────────────────────────────

	private _updateAnimation(): void {
		this.sprite.flipH = this._facing === "left";

		// Priority: climb > hit(invincible) > duck > jump > walk > idle
		if (this._isClimbing) {
			this.sprite.play("climb");
		} else if (this.isInvincible()) {
			this.sprite.play("hit");
		} else if (this._isDucking) {
			this.sprite.play("duck");
		} else if (!this.isOnFloor()) {
			this.sprite.play("jump");
		} else if (Math.abs(this.velocity.x) > 1) {
			this.sprite.play("walk");
		} else {
			this.sprite.play("idle");
		}

		// Invincibility / star blink
		if (this.isInvincible() || this._starPower) {
			this.sprite.alpha = Math.sin(this.game.elapsed * 20) > 0 ? 0.3 : 1;
		} else if (!this.isDead()) {
			this.sprite.alpha = 1;
		}
	}
}
