import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { Player } from "../entities/player.js";
import { gameState } from "../state.js";
import { runArena } from "./helpers.js";

describe("Player", () => {
	it("moves right when right is pressed", async () => {
		const result = await runArena(InputScript.create().press("right", 30), 0.5);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		expect(player!.position.x).toBeGreaterThan(160);
		result.game.stop();
	});

	it("moves left when left is pressed", async () => {
		const result = await runArena(InputScript.create().press("left", 30), 0.5);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		expect(player!.position.x).toBeLessThan(160);
		result.game.stop();
	});

	it("jumps when on floor and jump is pressed", async () => {
		// Let the player settle for more frames to ensure on floor, then jump
		const result = await runArena(InputScript.create().wait(15).tap("jump").wait(5), 0.5);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		// After jumping, player should have upward velocity
		expect(player!.velocity.y).toBeLessThan(0);
		result.game.stop();
	});

	it("can double-jump in the air", async () => {
		// Jump, wait some frames in the air, then jump again
		const result = await runArena(
			InputScript.create().wait(5).tap("jump").wait(10).tap("jump").wait(10),
			0.5,
		);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		// After double-jump, player should be well above the floor
		expect(player!.position.y).toBeLessThan(180);
		result.game.stop();
	});

	it("takeDamage reduces health and emits damaged signal", async () => {
		const result = await runArena(undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();

		let damagedValue = -1;
		player!.damaged.connect((remaining) => {
			damagedValue = remaining;
		});

		player!.takeDamage(1);
		expect(player!.health).toBe(2);
		expect(gameState.health).toBe(2);
		expect(damagedValue).toBe(2);
		result.game.stop();
	});

	it("death triggers died signal and syncs gameState", async () => {
		const result = await runArena(undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();

		let didDie = false;
		player!.died.connect(() => {
			didDie = true;
		});

		player!.takeDamage(3);
		expect(didDie).toBe(true);
		expect(player!.isDead()).toBe(true);
		expect(gameState.health).toBe(0);
		result.game.stop();
	});

	it("invincibility prevents damage during window", async () => {
		const result = await runArena(undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();

		// First hit: takes damage, starts invincibility
		player!.takeDamage(1);
		expect(player!.health).toBe(2);
		expect(player!.isInvincible()).toBe(true);

		// Second hit during invincibility: no effect
		player!.takeDamage(1);
		expect(player!.health).toBe(2);
		expect(gameState.health).toBe(2);
		result.game.stop();
	});
});
