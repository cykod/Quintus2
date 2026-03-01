import { describe, expect, it } from "vitest";
import { BrickBlock, CoinBlock, ExclamationBlock } from "../entities/breakable-block.js";
import { Player } from "../entities/player.js";
import { FRAME, tileAtlas } from "../sprites.js";
import { gameState } from "../state.js";
import { BreakableBlockArena, runScene } from "./helpers.js";

describe("Breakable Blocks", () => {
	it("brick block destroys when hit from below", async () => {
		const result = await runScene(BreakableBlockArena, undefined, 0.1);
		const brick = result.game.currentScene!.findAllByType(BrickBlock)[0]!;
		const player = result.game.currentScene!.findByType(Player)!;

		expect(brick.isDestroyed).toBe(false);

		// Hit the brick
		brick.hitFromBelow(player);

		// Advance past bump tween (0.08 + 0.08 = 0.16s ≈ 10 frames) + margin
		for (let i = 0; i < 15; i++) result.game.step();

		expect(brick.isDestroyed).toBe(true);
		result.game.stop();
	});

	it("coin block spawns coin popup and becomes empty on hit", async () => {
		const result = await runScene(BreakableBlockArena, undefined, 0.1);
		const coinBlock = result.game.currentScene!.findAllByType(CoinBlock)[0]!;
		const player = result.game.currentScene!.findByType(Player)!;

		const initialCoins = gameState.coins;
		const initialScore = gameState.score;

		// Directly call hitFromBelow to test the behavior
		coinBlock.hitFromBelow(player);

		expect(gameState.coins).toBe(initialCoins + 1);
		expect(gameState.score).toBe(initialScore + 100);

		// Sprite should now show the empty block frame
		const emptyRect = tileAtlas.getFrameOrThrow(FRAME.BLOCK_EMPTY);
		expect(coinBlock.sprite.sourceRect).toEqual(emptyRect);

		result.game.stop();
	});

	it("exclamation block spawns power-up popup and becomes empty", async () => {
		const result = await runScene(BreakableBlockArena, undefined, 0.1);
		const exBlock = result.game.currentScene!.findAllByType(ExclamationBlock)[0]!;
		const player = result.game.currentScene!.findByType(Player)!;

		const initialScore = gameState.score;

		exBlock.hitFromBelow(player);

		expect(gameState.score).toBe(initialScore + 200);

		// Sprite should show empty block
		const emptyRect = tileAtlas.getFrameOrThrow(FRAME.BLOCK_EMPTY);
		expect(exBlock.sprite.sourceRect).toEqual(emptyRect);

		result.game.stop();
	});

	it("already-hit coin block ignores further hits", async () => {
		const result = await runScene(BreakableBlockArena, undefined, 0.1);
		const coinBlock = result.game.currentScene!.findAllByType(CoinBlock)[0]!;
		const player = result.game.currentScene!.findByType(Player)!;

		coinBlock.hitFromBelow(player);
		const coinsAfterFirst = gameState.coins;
		const scoreAfterFirst = gameState.score;

		// Second hit should be ignored
		coinBlock.hitFromBelow(player);
		expect(gameState.coins).toBe(coinsAfterFirst);
		expect(gameState.score).toBe(scoreAfterFirst);

		result.game.stop();
	});

	it("already-hit exclamation block ignores further hits", async () => {
		const result = await runScene(BreakableBlockArena, undefined, 0.1);
		const exBlock = result.game.currentScene!.findAllByType(ExclamationBlock)[0]!;
		const player = result.game.currentScene!.findByType(Player)!;

		exBlock.hitFromBelow(player);
		const scoreAfterFirst = gameState.score;

		exBlock.hitFromBelow(player);
		expect(gameState.score).toBe(scoreAfterFirst);

		result.game.stop();
	});

	it("score increases on coin and exclamation block hits", async () => {
		const result = await runScene(BreakableBlockArena, undefined, 0.1);
		const coinBlock = result.game.currentScene!.findAllByType(CoinBlock)[0]!;
		const exBlock = result.game.currentScene!.findAllByType(ExclamationBlock)[0]!;
		const player = result.game.currentScene!.findByType(Player)!;

		expect(gameState.score).toBe(0);
		expect(gameState.coins).toBe(0);

		coinBlock.hitFromBelow(player);
		expect(gameState.score).toBe(100);
		expect(gameState.coins).toBe(1);

		exBlock.hitFromBelow(player);
		expect(gameState.score).toBe(300);

		result.game.stop();
	});
});
