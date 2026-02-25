import { type Signal, signal } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, type CollisionObject, CollisionShape, Shape } from "@quintus/physics";
import { Sprite } from "@quintus/sprites";
import {
	AUTO_LAUNCH_DELAY,
	BALL_RADIUS,
	BALL_SPEED,
	GAME_HEIGHT,
	MAX_BOUNCES,
	PADDLE_HEIGHT,
} from "../config.js";
import { BALL_SCALE, ballsAtlas, FRAME } from "../sprites.js";
import type { Paddle } from "./paddle.js";

export class Ball extends Actor {
	/** Emitted when the ball hits a brick. Payload is the brick CollisionObject. */
	readonly hitBrick: Signal<CollisionObject> = signal<CollisionObject>();

	/** Emitted when the ball hits the paddle. */
	readonly hitPaddle: Signal<CollisionObject> = signal<CollisionObject>();

	/** Emitted when the ball hits a wall. */
	readonly hitWall: Signal<CollisionObject> = signal<CollisionObject>();

	/** Emitted when the ball falls below the screen. */
	readonly ballLost: Signal<void> = signal<void>();

	/** Speed multiplier (for speed-up power-up). */
	speedMultiplier = 1;

	override collisionGroup = "ball";
	override gravity = 0;
	override applyGravity = false;

	private _paddle: Paddle | null = null;
	private _attached = false;
	private _attachedTimer = 0;

	override build() {
		return (
			<>
				<CollisionShape shape={Shape.circle(BALL_RADIUS)} />
				<Sprite
					texture="balls"
					sourceRect={ballsAtlas.getFrameOrThrow(FRAME.BALL)}
					scale={[BALL_SCALE, BALL_SCALE]}
				/>
			</>
		);
	}

	/** Attach ball to paddle (pre-launch mode). */
	attachToPaddle(paddle: Paddle): void {
		this._paddle = paddle;
		this._attached = true;
		this._attachedTimer = 0;
		this._syncToPaddle();
	}

	/** Whether the ball is still attached to the paddle. */
	get attached(): boolean {
		return this._attached;
	}

	override onFixedUpdate(dt: number) {
		if (this._attached) {
			this._syncToPaddle();
			this._attachedTimer += dt;
			if (this.game.input.isJustPressed("launch") || this._attachedTimer >= AUTO_LAUNCH_DELAY) {
				this._launch();
			}
			return;
		}

		this._moveWithReflection(dt);

		// Death zone check
		if (this.position.y > GAME_HEIGHT + 10) {
			this.ballLost.emit();
		}
	}

	private _syncToPaddle(): void {
		if (!this._paddle) return;
		this.position._set(
			this._paddle.position.x,
			this._paddle.position.y - PADDLE_HEIGHT / 2 - BALL_RADIUS - 1,
		);
		// Keep spatial hash updated
		const world = this._getWorld();
		if (world) world.updatePosition(this);
	}

	private _launch(): void {
		this._attached = false;
		this._paddle = null;
		// Launch at ~20° from vertical for natural breakout gameplay
		const angle = Math.PI / 9;
		this.velocity = new Vec2(Math.sin(angle) * BALL_SPEED, -Math.cos(angle) * BALL_SPEED);
	}

	private _moveWithReflection(dt: number): void {
		const speed = this.speedMultiplier;
		let motion = new Vec2(this.velocity.x * dt * speed, this.velocity.y * dt * speed);

		for (let bounce = 0; bounce < MAX_BOUNCES; bounce++) {
			if (motion.x * motion.x + motion.y * motion.y < 0.0001) break;

			const collision = this.moveAndCollide(motion);
			if (!collision) break;

			// Reflect velocity off the surface normal
			const dot = this.velocity.x * collision.normal.x + this.velocity.y * collision.normal.y;
			this.velocity = new Vec2(
				this.velocity.x - 2 * dot * collision.normal.x,
				this.velocity.y - 2 * dot * collision.normal.y,
			);

			// Reflect remainder for next iteration
			const rDot =
				collision.remainder.x * collision.normal.x + collision.remainder.y * collision.normal.y;
			motion = new Vec2(
				collision.remainder.x - 2 * rDot * collision.normal.x,
				collision.remainder.y - 2 * rDot * collision.normal.y,
			);

			// Dispatch collision events
			const group = collision.collider.collisionGroup;
			if (group === "bricks") {
				this.hitBrick.emit(collision.collider);
			} else if (group === "paddle") {
				const paddle = collision.collider as Paddle;
				const travelSq = collision.travel.x ** 2 + collision.travel.y ** 2;
				const cleanTopHit = collision.normal.y < 0 && travelSq > 0.001;

				if (cleanTopHit) {
					// Normal top hit — apply paddle angle mechanic
					this._handlePaddleHit(paddle);
					this.hitPaddle.emit(paddle);
				} else {
					// Side hit or embedded (paddle moved into ball): reposition
					// the ball clear of the paddle to prevent getting stuck.
					const aboveMidpoint = this.position.y < paddle.position.y;
					if (aboveMidpoint) {
						this.position._set(
							this.position.x,
							paddle.position.y - PADDLE_HEIGHT / 2 - BALL_RADIUS - 1,
						);
						this._handlePaddleHit(paddle);
					} else {
						this.position._set(
							this.position.x,
							paddle.position.y + PADDLE_HEIGHT / 2 + BALL_RADIUS + 1,
						);
						this.velocity = new Vec2(this.velocity.x, Math.abs(this.velocity.y) || BALL_SPEED);
					}
					const world = this._getWorld();
					if (world) world.updatePosition(this);
					this.hitPaddle.emit(paddle);
					break;
				}
			} else if (group === "walls") {
				this.hitWall.emit(collision.collider);
			}
		}
	}

	/**
	 * Paddle-angle mechanic: the ball's outgoing angle depends on
	 * where it hits the paddle. Center → straight up, edges → angled.
	 */
	private _handlePaddleHit(paddle: Paddle): void {
		const offset = (this.position.x - paddle.position.x) / (paddle.currentWidth / 2);
		const clamped = Math.max(-1, Math.min(1, offset));
		const angle = clamped * (Math.PI / 3); // ±60° from vertical
		const currentSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2) || BALL_SPEED;
		this.velocity = new Vec2(
			Math.sin(angle) * currentSpeed,
			-Math.abs(Math.cos(angle) * currentSpeed),
		);
	}
}
