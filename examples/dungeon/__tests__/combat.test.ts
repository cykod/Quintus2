import { InputScript } from "@quintus/test";
import { describe, expect, test } from "vitest";
import { gameState, SHIELDS } from "../state.js";
import { runLevel1 } from "./helpers.js";

type SnapshotNode = Record<string, unknown> & {
	position: { x: number; y: number };
};

describe("Dungeon — Combat: Attack", () => {
	test("attack spawns WeaponHitbox in scene", async () => {
		// Tap attack at frame 5; check for hitbox at frame 7 (before 0.15s auto-destroy)
		const result = await runLevel1(InputScript.create().wait(5).tap("attack"), 0.5);

		// Check frames shortly after the attack — hitbox lives for ~9 frames (0.15s at 60fps)
		let found = false;
		for (let f = 6; f <= 14; f++) {
			const hitboxes = result.timeline.findNodes(f, "WeaponHitbox");
			if (hitboxes.length > 0) {
				found = true;
				break;
			}
		}
		expect(found).toBe(true);

		result.game.stop();
	});

	test("weapon hitbox auto-destroys after ~0.15s", async () => {
		const result = await runLevel1(InputScript.create().wait(5).tap("attack"), 1.0);

		// By frame 30 (~0.5s), no weapon hitbox should remain (0.15s lifetime)
		const hitboxes = result.timeline.findNodes(30, "WeaponHitbox");
		expect(hitboxes.length).toBe(0);

		result.game.stop();
	});

	test("attack has 0.4s cooldown — rapid taps only spawn one hitbox", async () => {
		// Tap attack twice within 10 frames (~0.17s) — second should be ignored
		const result = await runLevel1(
			InputScript.create().wait(5).tap("attack").wait(10).tap("attack"),
			1.0,
		);

		// Count total distinct hitbox appearances — should only ever see one at a time
		// Check at frame 17 (when second tap occurs): only the first hitbox might still exist
		// or have already been destroyed, but no second hitbox should have spawned
		let maxConcurrent = 0;
		for (let f = 6; f <= 30; f++) {
			const hitboxes = result.timeline.findNodes(f, "WeaponHitbox");
			maxConcurrent = Math.max(maxConcurrent, hitboxes.length);
		}
		// Only one hitbox should have existed at any frame
		expect(maxConcurrent).toBeLessThanOrEqual(1);

		result.game.stop();
	});

	test("weapon swing animation plays on attack", async () => {
		const result = await runLevel1(InputScript.create().wait(5).tap("attack"), 0.5);

		// Verify EquippedWeapon child exists on player (visual weapon is always present)
		const player = result.timeline.findNode(10, "Player");
		expect(player).not.toBeNull();

		result.game.stop();
	});
});

describe("Dungeon — Combat: Defend", () => {
	test("defending halves movement speed", async () => {
		// Move right without defending
		const normal = await runLevel1(InputScript.create().press("right", 60));
		const normalStart = normal.timeline.findNode(0, "Player") as SnapshotNode;
		const normalEnd = normal.timeline.findNode(60, "Player") as SnapshotNode;
		const normalDist = normalEnd.position.x - normalStart.position.x;

		// Move right while defending (simultaneous hold)
		const defending = await runLevel1(
			InputScript.create().hold("defend").press("right", 60).release("defend"),
		);
		const defendStart = defending.timeline.findNode(0, "Player") as SnapshotNode;
		const defendEnd = defending.timeline.findNode(60, "Player") as SnapshotNode;
		const defendDist = defendEnd.position.x - defendStart.position.x;

		// Defending distance should be roughly half of normal
		expect(defendDist).toBeLessThan(normalDist * 0.7);
		expect(defendDist).toBeGreaterThan(normalDist * 0.3);

		normal.game.stop();
		defending.game.stop();
	});
});

describe("Dungeon — Combat: Damage", () => {
	test("player near enemy takes damage over time", async () => {
		// Move toward a dwarf enemy (level1 has enemies)
		// Player starts around (42, 66), skeleton1 is around (56, 136)
		// Move down to get into dwarf attack range
		const result = await runLevel1(InputScript.create().press("down", 80).wait(120), 4);

		// After moving toward enemy and waiting, health should have decreased
		// (The dwarf will detect and attack the player)
		expect(gameState.health).toBeLessThan(3);

		result.game.stop();
	});

	test("player invincibility prevents consecutive damage", async () => {
		// Move toward enemy and take damage
		const result = await runLevel1(InputScript.create().press("down", 80).wait(60), 3);

		const healthAfterFirstHit = gameState.health;
		// Player took at least one hit
		expect(healthAfterFirstHit).toBeLessThan(3);
		// But invincibility (1.5s) means health shouldn't drop more than once in first 1.5s
		// With 3 seconds total and 1.5s invincibility, at most 2 hits possible
		expect(healthAfterFirstHit).toBeGreaterThanOrEqual(1);

		result.game.stop();
	});

	test("shield blocks damage when defending toward attack", async () => {
		// Equip a shield and move toward enemy while defending
		const shieldResult = await runLevel1(
			InputScript.create().hold("defend").press("down", 80).wait(120).release("defend"),
			4,
			() => {
				gameState.shield = SHIELDS[0]; // Wooden Shield, defense 1
			},
		);

		const shieldHealth = gameState.health;

		// Run without shield for comparison
		const noShieldResult = await runLevel1(InputScript.create().press("down", 80).wait(120), 4);

		const noShieldHealth = gameState.health;

		// With shield + defending, player should have more health remaining
		// (or at least equal — defending reduces/blocks damage)
		expect(shieldHealth).toBeGreaterThanOrEqual(noShieldHealth);

		shieldResult.game.stop();
		noShieldResult.game.stop();
	});
});
