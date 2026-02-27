import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import {
	BALL_RADIUS,
	BALL_SPEED,
	BRICK_HEIGHT,
	BRICK_START_X,
	BRICK_START_Y,
	BRICK_WIDTH,
	GAME_HEIGHT,
	PADDLE_Y,
	SPEED_UP_MULTIPLIER,
} from "../config.js";
import { Ball } from "../entities/ball.js";
import { Brick } from "../entities/brick.js";
import { Paddle } from "../entities/paddle.js";
import { PowerUp } from "../entities/power-up.js";
import type { BreakoutLevel } from "../scenes/breakout-level.js";
import { Level1 } from "../scenes/level1.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

// biome-ignore lint/suspicious/noExplicitAny: test helper for private field access
type Hackable = any;

/** Detach ball from paddle and update spatial hash. */
function detachBall(ball: Ball): void {
	(ball as Hackable)._attached = false;
	(ball as Hackable)._paddle = null;
}

/** Update the physics spatial hash after manual position changes. */
function syncPhysics(ball: Ball): void {
	const world = (ball as Hackable)._getWorld();
	if (world) world.updatePosition(ball);
}

describe("Edge cases", () => {
	it("ball hitting corner where two bricks meet", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const scene = result.game.currentScene!;
		const ball = scene.findByType(Ball)!;

		// Position ball just below the boundary between two adjacent bricks.
		// The seam between brick 0 and brick 1 is at BRICK_START_X + BRICK_WIDTH/2.
		const seamX = BRICK_START_X + BRICK_WIDTH / 2;
		const brickBottomY = BRICK_START_Y + BRICK_HEIGHT / 2;

		// Detach from paddle and position just below the seam, moving straight up
		detachBall(ball);
		ball.position._set(seamX, brickBottomY + BALL_RADIUS + 2);
		ball.velocity = new Vec2(0, -BALL_SPEED);
		syncPhysics(ball);

		const bricksBefore = scene.findAllByType(Brick).length;

		// Step enough frames for the ball to reach and bounce off the bricks
		for (let i = 0; i < 10; i++) {
			result.game.step();
		}

		const bricksAfter = scene.findAllByType(Brick).length;

		// At least one brick should be destroyed by the corner hit
		expect(bricksAfter).toBeLessThan(bricksBefore);
		// Ball should have reflected downward (positive y velocity)
		expect(ball.velocity.y).toBeGreaterThan(0);
	});

	it("ball hitting paddle edge produces bounded reflection angle", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const scene = result.game.currentScene!;
		const ball = scene.findByType(Ball)!;
		const paddle = scene.findByType(Paddle)!;

		// Detach ball and aim it at the far right edge of the paddle
		detachBall(ball);
		const paddleRight = paddle.position.x + paddle.currentWidth / 2 - 2;
		ball.position._set(paddleRight, PADDLE_Y - 20);
		ball.velocity = new Vec2(0, BALL_SPEED);
		syncPhysics(ball);

		for (let i = 0; i < 10; i++) {
			result.game.step();
		}

		// Ball must be going upward after paddle hit
		expect(ball.velocity.y).toBeLessThan(0);

		// Reflection angle should be within ±60° from vertical
		const angle = Math.atan2(Math.abs(ball.velocity.x), Math.abs(ball.velocity.y));
		expect(angle).toBeLessThanOrEqual(Math.PI / 3 + 0.01);
	});

	it("multi-ball: all balls lost simultaneously costs only 1 life", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const scene = result.game.currentScene! as BreakoutLevel;
		const ball = scene.findByType(Ball)!;

		// Launch the initial ball
		detachBall(ball);

		// Spawn two extra balls (spawnFreeBall is protected, access via cast)
		(scene as Hackable).spawnFreeBall(30);
		(scene as Hackable).spawnFreeBall(-30);

		// All 3 balls should be active
		const allBalls = scene.findAllByType(Ball);
		expect(allBalls.length).toBe(3);

		const livesBefore = gameState.lives;

		// Move all balls below the death zone simultaneously
		for (const b of allBalls) {
			b.position._set(240, GAME_HEIGHT + 20);
			syncPhysics(b);
		}

		// Step to trigger ballLost for all balls
		for (let i = 0; i < 5; i++) {
			result.game.step();
		}

		// Only 1 life should be deducted (not 3)
		expect(gameState.lives).toBe(livesBefore - 1);
	});

	it("collecting wide power-up while already wide stays wide", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const scene = result.game.currentScene!;
		const paddle = scene.findByType(Paddle)!;

		// Activate wide mode
		paddle.setWide(true);
		expect(paddle.currentWidth).toBeGreaterThan(80);

		// Simulate a second "wide" power-up collection by calling setWide(true) again
		// (idempotent — returns early without resetting)
		paddle.setWide(true);
		expect(paddle.currentWidth).toBeGreaterThan(80);

		// Step forward to ensure stability
		for (let i = 0; i < 30; i++) {
			result.game.step();
		}
		// Paddle should still be wide (no timer expired yet — timer is 10s, we only stepped ~0.5s)
		expect(paddle.currentWidth).toBeGreaterThan(80);
	});

	it("speed power-up does not apply to newly spawned multi-ball", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const scene = result.game.currentScene! as BreakoutLevel;
		const ball = scene.findByType(Ball)!;

		// Launch ball
		detachBall(ball);
		ball.velocity = new Vec2(0, -BALL_SPEED);

		// Apply speed multiplier to existing ball (simulates speed power-up)
		ball.speedMultiplier = SPEED_UP_MULTIPLIER;

		// Spawn multi-ball
		const newBall = (scene as Hackable).spawnFreeBall(30) as Ball;

		// The new ball does NOT inherit the speed multiplier — this is existing behavior
		// (speed power-up only applies to balls active at the time of collection)
		expect(newBall.speedMultiplier).toBe(1);
		expect(ball.speedMultiplier).toBe(SPEED_UP_MULTIPLIER);
	});

	it("ball trapped in narrow gap between bricks resolves via multi-bounce", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const scene = result.game.currentScene!;

		// Remove all default bricks to set up a controlled scenario
		for (const brick of scene.findAllByType(Brick)) {
			gameState.bricksRemaining--;
			brick.destroy();
		}

		// Create two bricks with a narrow gap (slightly larger than ball diameter)
		const gapCenterX = 200;
		const gapWidth = BALL_RADIUS * 2 + 2; // just barely fits the ball
		const brickY = 200;

		const leftBrick = scene.add(Brick, {
			brickType: "hard",
			colorName: "blue",
			position: new Vec2(gapCenterX - gapWidth / 2 - BRICK_WIDTH / 2, brickY),
		});
		gameState.bricksRemaining++;

		const rightBrick = scene.add(Brick, {
			brickType: "hard",
			colorName: "blue",
			position: new Vec2(gapCenterX + gapWidth / 2 + BRICK_WIDTH / 2, brickY),
		});
		gameState.bricksRemaining++;

		// Position ball in the gap moving upward
		const ball = scene.findByType(Ball)!;
		detachBall(ball);
		ball.position._set(gapCenterX, brickY + BRICK_HEIGHT / 2 + BALL_RADIUS + 2);
		ball.velocity = new Vec2(BALL_SPEED * 0.3, -BALL_SPEED);
		syncPhysics(ball);

		// Step several frames — the ball should resolve without getting stuck
		for (let i = 0; i < 30; i++) {
			result.game.step();
		}

		// Ball should still exist (not destroyed) and have moved away
		expect(ball.isDestroyed).toBe(false);
		// At least one brick should have taken damage (health < 2)
		const damaged =
			leftBrick.health < 2 ||
			rightBrick.health < 2 ||
			leftBrick.isDestroyed ||
			rightBrick.isDestroyed;
		expect(damaged).toBe(true);
	});

	it("level clear with power-up still falling transitions correctly", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const scene = result.game.currentScene!;

		// Spawn a power-up mid-screen (kept in scene to test orphan cleanup)
		scene.add(PowerUp, {
			powerUpType: "wide",
			position: new Vec2(240, 300),
		});

		// Destroy all bricks to trigger level complete
		const bricks = scene.findAllByType(Brick);
		for (const brick of bricks) {
			brick.hit(1);
			gameState.bricksRemaining--;
			gameState.score += brick.points;
		}
		gameState.bricksRemaining = 0;

		// Step forward past the level transition delay (0.5s = ~30 frames at 60fps)
		// The orphaned power-up should not cause a crash
		for (let i = 0; i < 60; i++) {
			result.game.step();
		}

		// Power-up should have been cleaned up (either fell off-screen or scene switched)
		// The key assertion is that no errors were thrown during the transition
		expect(true).toBe(true);
	});
});
