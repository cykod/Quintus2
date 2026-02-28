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
		expect(player!.position.x).toBeGreaterThan(320);
		result.game.stop();
	});

	it("moves left when left is pressed", async () => {
		const result = await runArena(InputScript.create().press("left", 30), 0.5);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		expect(player!.position.x).toBeLessThan(320);
		result.game.stop();
	});

	it("jumps when on floor and jump is pressed", async () => {
		const result = await runArena(InputScript.create().wait(15).tap("jump").wait(5), 0.5);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		expect(player!.velocity.y).toBeLessThan(0);
		result.game.stop();
	});

	it("can double-jump in the air", async () => {
		const result = await runArena(
			InputScript.create().wait(5).tap("jump").wait(10).tap("jump").wait(10),
			0.5,
		);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		expect(player!.position.y).toBeLessThan(270);
		result.game.stop();
	});

	it("cannot triple-jump", async () => {
		const result = await runArena(
			InputScript.create().wait(5).tap("jump").wait(5).tap("jump").wait(5).tap("jump").wait(5),
			0.5,
		);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		// Record position after triple-jump attempt
		const posAfterTriple = player!.position.y;

		// Compare with double-jump only — third jump should have no effect
		const result2 = await runArena(
			InputScript.create().wait(5).tap("jump").wait(5).tap("jump").wait(10),
			0.5,
		);
		const player2 = result2.game.currentScene?.findByType(Player);
		expect(player2).toBeDefined();
		// Positions should be roughly the same since triple jump did nothing
		expect(Math.abs(posAfterTriple - player2!.position.y)).toBeLessThan(50);
		result.game.stop();
		result2.game.stop();
	});

	it("double-jump resets on landing", async () => {
		// Jump, land, jump again, double-jump again
		const result = await runArena(
			InputScript.create()
				.wait(5)
				.tap("jump")
				.wait(60) // land
				.tap("jump")
				.wait(5)
				.tap("jump") // double-jump should work again
				.wait(5),
			1.5,
		);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		// Player should be airborne after second double-jump
		expect(player!.position.y).toBeLessThan(270);
		result.game.stop();
	});

	it("ducks on floor when duck is pressed", async () => {
		// hold("duck") keeps it pressed until release — script ends with duck still held
		const result = await runArena(InputScript.create().wait(10).hold("duck").wait(10), 0.5);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		expect(player!.isDucking).toBe(true);
		result.game.stop();
	});

	it("moves slower while ducking", async () => {
		// Move right without ducking
		const result1 = await runArena(InputScript.create().wait(5).press("right", 30), 0.6);
		const player1 = result1.game.currentScene?.findByType(Player);
		const normalDist = player1!.position.x - 320;

		// Move right while ducking — hold duck, then press right simultaneously
		const result2 = await runArena(
			InputScript.create().wait(5).hold("duck").press("right", 30),
			0.6,
		);
		const player2 = result2.game.currentScene?.findByType(Player);
		const duckDist = player2!.position.x - 320;

		expect(duckDist).toBeLessThan(normalDist);
		expect(duckDist).toBeGreaterThan(0);
		result1.game.stop();
		result2.game.stop();
	});

	it("takeDamage reduces health and syncs gameState", async () => {
		const result = await runArena(undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();

		let damagedValue = -1;
		player!.damaged.connect((remaining) => {
			damagedValue = remaining;
		});

		player!.takeDamage(1);
		expect(player!.health).toBe(4);
		expect(gameState.health).toBe(4);
		expect(damagedValue).toBe(4);
		result.game.stop();
	});

	it("death triggers died signal and decrements lives", async () => {
		const result = await runArena(undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();

		let didDie = false;
		player!.died.connect(() => {
			didDie = true;
		});

		player!.takeDamage(5);
		expect(didDie).toBe(true);
		expect(player!.isDead()).toBe(true);
		expect(gameState.health).toBe(0);
		expect(gameState.lives).toBe(2);
		result.game.stop();
	});

	it("invincibility prevents damage during window", async () => {
		const result = await runArena(undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();

		// First hit: takes damage, starts invincibility
		player!.takeDamage(1);
		expect(player!.health).toBe(4);
		expect(player!.isInvincible()).toBe(true);

		// Second hit during invincibility: no effect
		player!.takeDamage(1);
		expect(player!.health).toBe(4);
		expect(gameState.health).toBe(4);
		result.game.stop();
	});

	it("fall death when position.y > 800", async () => {
		const result = await runArena(undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();

		let didDie = false;
		player!.died.connect(() => {
			didDie = true;
		});

		// Move player below the death threshold
		player!.position.y = 801;
		// Advance a frame so onFixedUpdate fires
		result.game.step();
		expect(didDie).toBe(true);
		expect(player!.isDead()).toBe(true);
		result.game.stop();
	});

	it("star power blocks damage while active", async () => {
		const result = await runArena(undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();

		player!.activateStarPower(5);
		expect(player!.hasStarPower).toBe(true);
		expect(gameState.starPower).toBe(true);

		// Damage is blocked
		player!.takeDamage(1);
		expect(player!.health).toBe(5);
		expect(gameState.health).toBe(5);
		result.game.stop();
	});
});
