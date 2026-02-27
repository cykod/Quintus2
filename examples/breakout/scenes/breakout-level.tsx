import { Camera } from "@quintus/camera";
import { Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import type { CollisionObject } from "@quintus/physics";
import {
	BALL_RADIUS,
	BALL_SPEED,
	BRICK_COLS,
	BRICK_START_X,
	BRICK_START_Y,
	BRICK_STEP_X,
	BRICK_STEP_Y,
	GAME_HEIGHT,
	GAME_WIDTH,
	PADDLE_HEIGHT,
	PADDLE_Y,
	POWERUP_DROP_CHANCE,
	SPEED_UP_DURATION,
	SPEED_UP_MULTIPLIER,
} from "../config.js";
import { Ball } from "../entities/ball.js";
import { Brick, type BrickType } from "../entities/brick.js";
import { Paddle } from "../entities/paddle.js";
import { PowerUp, type PowerUpType } from "../entities/power-up.js";
import { Walls } from "../entities/walls.js";
import { HUD } from "../hud/hud.js";
import { gameState } from "../state.js";

/** Row definition: [color, brickType]. */
export type BrickRow = [string, BrickType];

/** Base class for all breakout levels. Subclasses implement buildBrickGrid(). */
export abstract class BreakoutLevel extends Scene {
	protected paddle!: Paddle;
	protected activeBalls = new Set<Ball>();
	private _levelComplete = false;

	/** Name of the next scene to switch to (or empty for victory). */
	abstract get nextScene(): string;

	/** Build the brick layout. Must call addBrick() for each brick. */
	abstract buildBrickGrid(): void;

	override build() {
		return (
			<>
				<Walls />
				<Paddle ref="paddle" position={[GAME_WIDTH / 2, PADDLE_Y]} />
				<HUD />
				<Camera position={[GAME_WIDTH / 2, GAME_HEIGHT / 2]} />
			</>
		);
	}

	override onReady() {
		this._spawnAttachedBall();
		this.buildBrickGrid();
	}

	/** Add a brick to the scene. */
	protected addBrick(type: BrickType, color: string, x: number, y: number): Brick {
		const brick = this.add(Brick, {
			brickType: type,
			colorName: color,
			position: new Vec2(x, y),
		});
		gameState.bricksRemaining++;
		return brick;
	}

	/** Build a standard grid from row definitions (BRICK_COLS wide). */
	protected buildBrickRows(rows: BrickRow[]): void {
		for (let row = 0; row < rows.length; row++) {
			const [color, type] = rows[row]!;
			for (let col = 0; col < BRICK_COLS; col++) {
				const x = BRICK_START_X + col * BRICK_STEP_X;
				const y = BRICK_START_Y + row * BRICK_STEP_Y;
				this.addBrick(type, color, x, y);
			}
		}
	}

	/** Spawn a ball attached to the paddle (pre-launch). */
	private _spawnAttachedBall(): Ball {
		const ball = this.add(Ball);
		ball.attachToPaddle(this.paddle);
		this._connectBallSignals(ball);
		this.activeBalls.add(ball);
		return ball;
	}

	/** Spawn a free-flying ball at an angle (for multi-ball power-up). */
	protected spawnFreeBall(angleDeg: number): Ball {
		const pos = new Vec2(
			this.paddle.position.x,
			this.paddle.position.y - PADDLE_HEIGHT / 2 - BALL_RADIUS - 1,
		);
		const angle = (angleDeg * Math.PI) / 180;
		const vel = new Vec2(Math.sin(angle) * BALL_SPEED, -Math.cos(angle) * BALL_SPEED);
		const ball = this.add(Ball, { position: pos, velocity: vel });
		this._connectBallSignals(ball);
		this.activeBalls.add(ball);
		return ball;
	}

	private _connectBallSignals(ball: Ball): void {
		ball.hitBrick.connect((collider) => this._onBrickHit(collider));
		ball.hitPaddle.connect(() => {
			this.game.audio.play("paddle");
		});
		ball.hitWall.connect(() => {
			this.game.audio.play("wall");
		});
		ball.ballLost.connect(() => this._onBallLost(ball));
	}

	private _onBrickHit(collider: CollisionObject): void {
		if (this._levelComplete) return;
		if (!(collider instanceof Brick)) return;

		const destroyed = collider.hit(1);
		if (destroyed) {
			gameState.score += collider.points;
			gameState.bricksRemaining--;

			this.game.audio.play("brick");

			// Maybe spawn power-up
			if (this.game.random.next() < POWERUP_DROP_CHANCE) {
				this._spawnPowerUp(collider.position);
			}

			// Check level complete
			if (gameState.bricksRemaining <= 0) {
				this._onLevelComplete();
			}
		} else {
			this.game.audio.play("brick-strong");
		}
	}

	private _onBallLost(ball: Ball): void {
		this.activeBalls.delete(ball);
		ball.destroy();

		if (this._levelComplete) return;

		if (this.activeBalls.size === 0) {
			gameState.lives--;
			if (gameState.lives <= 0) {
				this.after(0.3, () => this.switchTo("game-over"));
			} else {
				// Respawn ball on paddle
				this._spawnAttachedBall();
			}
		}
	}

	private _onLevelComplete(): void {
		if (this._levelComplete) return;
		this._levelComplete = true;

		this.after(0.5, () => {
			if (this.nextScene) {
				gameState.level++;
				this.switchTo(this.nextScene);
			} else {
				this.switchTo("victory");
			}
		});
	}

	private _spawnPowerUp(pos: Vec2): void {
		const types: PowerUpType[] = ["wide", "multi", "speed"];
		const type = types[this.game.random.int(0, types.length - 1)]!;
		const powerUp = this.add(PowerUp, {
			powerUpType: type,
			position: new Vec2(pos.x, pos.y),
		});
		powerUp.collected.connect(() => this._activatePowerUp(type));
	}

	/**
	 * Power-up state management:
	 * - "wide" and "speed" use independent fire-and-forget timers. Collecting
	 *   a second pickup starts a new timer without cancelling the first, so
	 *   the first timer may expire while the second is still running. This
	 *   trades perfect timer-extension behavior for simplicity.
	 * - "multi" is additive: each collection spawns 2 new balls regardless
	 *   of how many are already in play.
	 * - "speed" only affects balls that exist at the time of collection —
	 *   balls spawned later via multi-ball will have the default multiplier.
	 */
	private _activatePowerUp(type: PowerUpType): void {
		this.game.audio.play("powerup");

		switch (type) {
			case "wide":
				this.paddle.setWide(true);
				this.after(10, () => this.paddle.setWide(false));
				break;
			case "multi":
				this.spawnFreeBall(30);
				this.spawnFreeBall(-30);
				break;
			case "speed":
				for (const ball of this.activeBalls) {
					ball.speedMultiplier = SPEED_UP_MULTIPLIER;
				}
				this.after(SPEED_UP_DURATION, () => {
					for (const ball of this.activeBalls) {
						ball.speedMultiplier = 1;
					}
				});
				break;
		}
	}
}
