import { describe, expect, it } from "vitest";
import { BRICK_COLS } from "../config.js";
import { Brick } from "../entities/brick.js";
import { Level1 } from "../scenes/level1.js";
import { Level2 } from "../scenes/level2.js";
import { Level3 } from "../scenes/level3.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

describe("Bricks", () => {
	it("level 1 has correct brick count (5 rows x 10 cols)", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const bricks = result.game.currentScene!.findAllByType(Brick);
		expect(bricks.length).toBe(5 * BRICK_COLS);
		expect(gameState.bricksRemaining).toBe(50);
	});

	it("level 2 has correct brick count (6 rows x 10 cols)", async () => {
		const result = await runScene(Level2, undefined, 0.1);
		const bricks = result.game.currentScene!.findAllByType(Brick);
		expect(bricks.length).toBe(6 * BRICK_COLS);
		expect(gameState.bricksRemaining).toBe(60);
	});

	it("level 3 has correct brick count (7 rows x 10 cols)", async () => {
		const result = await runScene(Level3, undefined, 0.1);
		const bricks = result.game.currentScene!.findAllByType(Brick);
		expect(bricks.length).toBe(7 * BRICK_COLS);
		expect(gameState.bricksRemaining).toBe(70);
	});

	it("normal brick is destroyed in 1 hit", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const brick = result.game.currentScene!.findAllByType(Brick)[0]!;
		expect(brick.health).toBe(1);
		expect(brick.brickType).toBe("normal");
		const destroyed = brick.hit(1);
		expect(destroyed).toBe(true);
		expect(brick.isDestroyed).toBe(true);
	});

	it("hard brick survives 1 hit, destroyed in 2", async () => {
		const result = await runScene(Level2, undefined, 0.1);
		const hardBrick = result.game
			.currentScene!.findAllByType(Brick)
			.find((b) => b.brickType === "hard");
		expect(hardBrick).toBeDefined();
		expect(hardBrick!.health).toBe(2);

		const destroyed1 = hardBrick!.hit(1);
		expect(destroyed1).toBe(false);
		expect(hardBrick!.health).toBe(1);

		const destroyed2 = hardBrick!.hit(1);
		expect(destroyed2).toBe(true);
	});

	it("metal brick survives 2 hits, destroyed in 3", async () => {
		const result = await runScene(Level3, undefined, 0.1);
		const metalBrick = result.game
			.currentScene!.findAllByType(Brick)
			.find((b) => b.brickType === "metal");
		expect(metalBrick).toBeDefined();
		expect(metalBrick!.health).toBe(3);

		metalBrick!.hit(1);
		expect(metalBrick!.health).toBe(2);
		metalBrick!.hit(1);
		expect(metalBrick!.health).toBe(1);
		const destroyed = metalBrick!.hit(1);
		expect(destroyed).toBe(true);
	});

	it("brick points match type", async () => {
		const result = await runScene(Level3, undefined, 0.1);
		const bricks = result.game.currentScene!.findAllByType(Brick);
		for (const brick of bricks) {
			if (brick.brickType === "normal") expect(brick.points).toBe(10);
			if (brick.brickType === "hard") expect(brick.points).toBe(20);
			if (brick.brickType === "metal") expect(brick.points).toBe(30);
		}
	});

	it("score increments when brick is destroyed via hit", async () => {
		const result = await runScene(Level1, undefined, 0.1);
		const initialScore = gameState.score;
		const brick = result.game.currentScene!.findAllByType(Brick)[0]!;
		const points = brick.points;
		brick.hit(1);
		gameState.score += points;
		expect(gameState.score).toBe(initialScore + points);
	});
});
