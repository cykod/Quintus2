import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { DoorExit } from "../entities/door-exit.js";
import { Flag } from "../entities/flag.js";
import { Player } from "../entities/player.js";
import { gameState } from "../state.js";
import { CheckpointArena, DoorExitArena, runScene } from "./helpers.js";

describe("Checkpoint & Exit", () => {
	describe("Flag (checkpoint)", () => {
		it("sets gameState.checkpoint when player touches it", async () => {
			const result = await runScene(
				CheckpointArena,
				InputScript.create().wait(10).hold("right").wait(120),
				2.5,
			);

			expect(gameState.checkpoint).not.toBeNull();
			expect(gameState.checkpoint!.x).toBeCloseTo(400, 0);

			result.game.stop();
		});

		it("has flag tag", async () => {
			const result = await runScene(CheckpointArena, undefined, 0.1);
			const flag = result.game.currentScene!.findByType(Flag)!;

			expect(flag.hasTag("flag")).toBe(true);

			result.game.stop();
		});

		it("flag is not destroyed after activation", async () => {
			const result = await runScene(
				CheckpointArena,
				InputScript.create().wait(10).hold("right").wait(120),
				2.5,
			);

			// Flag should still exist (not destroyed)
			const flag = result.game.currentScene!.findByType(Flag)!;
			expect(flag).toBeDefined();
			expect(flag.isDestroyed).toBe(false);

			result.game.stop();
		});
	});

	describe("DoorExit", () => {
		it("player can reach the door", async () => {
			const result = await runScene(
				DoorExitArena,
				InputScript.create().wait(10).hold("right").wait(120),
				2.5,
			);

			const scene = result.game.currentScene!;
			const player = scene.findByType(Player)!;
			// Player walked right for ~2 seconds at speed 250 — should have reached the door area
			expect(player.position.x).toBeGreaterThan(350);

			result.game.stop();
		});

		it("has door_exit tag", async () => {
			const result = await runScene(DoorExitArena, undefined, 0.1);
			const door = result.game.currentScene!.findByType(DoorExit)!;

			expect(door.hasTag("door_exit")).toBe(true);

			result.game.stop();
		});
	});
});
