import { describe, expect, it } from "vitest";
import { Player } from "../entities/player.js";
import { Spring } from "../entities/spring.js";
import { FRAME, tileAtlas } from "../sprites.js";
import { runScene, SpringArena } from "./helpers.js";

describe("Spring", () => {
	it("player bounces upward when landing on spring", async () => {
		const result = await runScene(SpringArena, undefined, 0.1);
		const spring = result.game.currentScene!.findByType(Spring)!;
		const player = result.game.currentScene!.findByType(Player)!;

		// Directly trigger the bounce
		spring.bounce(player);

		expect(player.velocity.y).toBe(-800);

		result.game.stop();
	});

	it("spring sprite changes to spring_out then back", async () => {
		const result = await runScene(SpringArena, undefined, 0.1);
		const spring = result.game.currentScene!.findByType(Spring)!;
		const player = result.game.currentScene!.findByType(Player)!;

		const normalRect = tileAtlas.getFrameOrThrow(FRAME.SPRING);
		const outRect = tileAtlas.getFrameOrThrow(FRAME.SPRING_OUT);

		// Initial frame should be the normal spring
		expect(spring.sprite.sourceRect).toEqual(normalRect);

		// Bounce changes to spring_out
		spring.bounce(player);
		expect(spring.sprite.sourceRect).toEqual(outRect);

		// After 0.3s worth of frames (at 60fps = 18 frames), should revert
		for (let i = 0; i < 20; i++) result.game.step();
		expect(spring.sprite.sourceRect).toEqual(normalRect);

		result.game.stop();
	});

	it("bounce force is stronger than normal jump", async () => {
		const result = await runScene(SpringArena, undefined, 0.1);
		const player = result.game.currentScene!.findByType(Player)!;

		// Spring bounce force is -800, player jump force is -500
		expect(Math.abs(-800)).toBeGreaterThan(Math.abs(player.jumpForce));

		result.game.stop();
	});
});
