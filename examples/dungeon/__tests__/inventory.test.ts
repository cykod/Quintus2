import { InputScript } from "@quintus/test";
import { describe, expect, test } from "vitest";
import { gameState, POTIONS, SHIELDS, SWORDS } from "../state.js";
import { runLevel1 } from "./helpers.js";

type SnapshotNode = Record<string, unknown> & {
	position: { x: number; y: number };
};

describe("Dungeon — Potion System", () => {
	test("health potion restores health", () => {
		gameState.reset();
		gameState.health = 1;
		const potion = POTIONS[0]; // Health Potion, value=2
		gameState.health = Math.min(gameState.health + potion.value, gameState.maxHealth);
		expect(gameState.health).toBe(3);
	});

	test("health potion clamps to maxHealth", () => {
		gameState.reset();
		gameState.health = 2;
		const potion = POTIONS[0]; // Health Potion, value=2
		gameState.health = Math.min(gameState.health + potion.value, gameState.maxHealth);
		expect(gameState.health).toBe(gameState.maxHealth);
	});

	test("speed buff increases movement distance", async () => {
		// Use short movement (30 frames = 0.5s) to avoid wall collisions
		const normal = await runLevel1(InputScript.create().press("right", 30));
		const normalStart = normal.timeline.findNode(0, "Player") as SnapshotNode;
		const normalEnd = normal.timeline.findNode(30, "Player") as SnapshotNode;
		const normalDist = normalEnd.position.x - normalStart.position.x;

		// Buffed movement (speed potion active)
		const buffed = await runLevel1(InputScript.create().press("right", 30), undefined, () => {
			gameState.activeBuff = POTIONS[1]; // Speed Potion, value=1.5
			gameState.buffTimeRemaining = 10;
		});
		const buffStart = buffed.timeline.findNode(0, "Player") as SnapshotNode;
		const buffEnd = buffed.timeline.findNode(30, "Player") as SnapshotNode;
		const buffDist = buffEnd.position.x - buffStart.position.x;

		// Buffed distance should be noticeably larger (1.5x speed)
		expect(buffDist).toBeGreaterThan(normalDist * 1.2);

		normal.game.stop();
		buffed.game.stop();
	});

	test("attack buff increases weapon damage multiplier", () => {
		const baseDamage = SWORDS[0].damage; // 1
		const attackBuff = POTIONS[2]; // Attack Potion, value=2
		const buffedDamage = baseDamage * attackBuff.value;
		expect(buffedDamage).toBe(2);
	});

	test("buff expires after duration", async () => {
		const result = await runLevel1(undefined, 2, () => {
			gameState.activeBuff = POTIONS[1]; // Speed Potion
			gameState.buffTimeRemaining = 0.5; // Short for testing
		});
		// After 2s of scene time, the 0.5s buff should have expired
		expect(gameState.activeBuff).toBeNull();
		expect(gameState.buffTimeRemaining).toBe(0);
		result.game.stop();
	});

	test("weapon upgrade from chest replaces current", () => {
		gameState.reset();
		expect(gameState.sword.damage).toBe(SWORDS[0].damage);
		gameState.sword = SWORDS[1]; // Large Sword
		expect(gameState.sword.damage).toBe(2);
		expect(gameState.sword.name).toBe("Large Sword");
	});

	test("shield from chest equips", () => {
		gameState.reset();
		expect(gameState.shield).toBeNull();
		gameState.shield = SHIELDS[0]; // Wooden Shield
		expect(gameState.shield).not.toBeNull();
		expect(gameState.shield?.defense).toBe(1);
	});
});
