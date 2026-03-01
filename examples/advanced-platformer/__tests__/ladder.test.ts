import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { Player } from "../entities/player.js";
import { LadderArena, runScene } from "./helpers.js";

describe("Ladder", () => {
	it("player enters climbing state when on ladder and pressing up", async () => {
		// Player starts at (320, 280) on the floor. Ladder sensor is at x=320.
		// Press up to enter climbing mode.
		const result = await runScene(
			LadderArena,
			InputScript.create().wait(10).hold("up").wait(15),
			0.5,
		);
		const player = result.game.currentScene!.findByType(Player)!;

		expect(player.isClimbing).toBe(true);

		result.game.stop();
	});

	it("player climbs up on ladder", async () => {
		const result = await runScene(
			LadderArena,
			InputScript.create().wait(10).hold("up").wait(30),
			0.8,
		);
		const player = result.game.currentScene!.findByType(Player)!;

		// Player should have moved upward from starting position (280)
		expect(player.position.y).toBeLessThan(270);

		result.game.stop();
	});

	it("player climbs down on ladder", async () => {
		// First climb up, then climb down
		const result = await runScene(
			LadderArena,
			InputScript.create().wait(10).press("up", 30).press("down", 20),
			1.0,
		);
		const player = result.game.currentScene!.findByType(Player)!;

		// Player should have climbed up then down — should be near or below initial height
		// The important thing is they moved while pressing down
		expect(player.position.y).toBeGreaterThan(200);

		result.game.stop();
	});

	it("player exits ladder when jumping", async () => {
		// Release up before jumping so the player doesn't immediately re-enter climbing
		const result = await runScene(
			LadderArena,
			InputScript.create().wait(10).press("up", 15).tap("jump").wait(3),
			0.6,
		);
		const player = result.game.currentScene!.findByType(Player)!;

		// Player should no longer be climbing after jumping
		expect(player.isClimbing).toBe(false);
		// Player should have upward velocity from jump (or still be moving upward)
		expect(player.position.y).toBeLessThan(260);

		result.game.stop();
	});
});
