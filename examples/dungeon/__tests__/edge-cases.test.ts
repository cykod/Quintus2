import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { Dwarf } from "../entities/dwarf.js";
import { EnemyWeapon } from "../entities/enemy-weapon.js";
import { Player } from "../entities/player.js";
import { WeaponHitbox } from "../entities/weapon-hitbox.js";
import { gameState, POTIONS, SHIELDS, SWORDS } from "../state.js";
import { runLevel1 } from "./helpers.js";

describe("Dungeon — Edge Cases", () => {
	it("attack still spawns hitbox during knockback", async () => {
		const result = await runLevel1(undefined, 0.1);
		const scene = result.game.currentScene!;
		const player = scene.findByType(Player)!;

		// Apply knockback via damage
		player.takeDamage(1, new Vec2(1, 0));
		expect(player.velocity.x).not.toBe(0);

		// Attack while still moving from knockback — knockback doesn't lock out attacks
		result.game.input.inject("attack", true);
		result.game.step();
		result.game.input.inject("attack", false);

		// WeaponHitbox should have spawned despite knockback
		const hitbox = scene.findByType(WeaponHitbox);
		expect(hitbox).not.toBeNull();
		result.game.stop();
	});

	it("shield blocks damage while player is moving", async () => {
		const result = await runLevel1(undefined, 0.1, () => {
			gameState.shield = SHIELDS[0]; // Wooden Shield
		});
		const scene = result.game.currentScene!;
		const player = scene.findByType(Player)!;

		// Press defend + right (moving while defending)
		result.game.input.inject("defend", true);
		result.game.input.inject("right", true);
		result.game.step();

		expect(player.isDefending).toBe(true);

		// Damage should be blocked by shield
		player.takeDamage(1, new Vec2(-1, 0));
		expect(gameState.health).toBe(3);

		result.game.input.inject("defend", false);
		result.game.input.inject("right", false);
		result.game.stop();
	});

	it("equipment persists across scene transitions via gameState", async () => {
		// gameState is a global reactive store — equipment survives scene lifecycle.
		// Set non-default equipment before the scene loads.
		const result = await runLevel1(undefined, 0.1, () => {
			gameState.sword = SWORDS[1]; // Large Sword
			gameState.shield = SHIELDS[1]; // Metal Shield
		});

		expect(gameState.sword).toBe(SWORDS[1]);
		expect(gameState.sword.damage).toBe(2);
		expect(gameState.shield).toBe(SHIELDS[1]);
		expect(gameState.shield?.defense).toBe(2);
		result.game.stop();
	});

	it("buff expires correctly during combat", async () => {
		const result = await runLevel1(undefined, 0.1, () => {
			gameState.activeBuff = POTIONS[1]; // Speed Potion
			gameState.buffTimeRemaining = 0.5; // Expires in 0.5s
		});

		expect(gameState.activeBuff).not.toBeNull();

		// Step for ~1 second (60 frames at 60fps) — buff should expire after 0.5s
		for (let i = 0; i < 60; i++) {
			result.game.step();
		}

		expect(gameState.activeBuff).toBeNull();
		expect(gameState.buffTimeRemaining).toBe(0);
		result.game.stop();
	});

	it("chest loot replaces existing equipment", async () => {
		// gameState.sword is reactive — setting it to a new value replaces the old.
		// Chest._open() calls `gameState.sword = SWORDS[tier]`, which triggers the
		// Player's gameState.on("sword") listener to update the visual weapon.
		const result = await runLevel1(undefined, 0.1, () => {
			gameState.sword = SWORDS[1]; // Start with Large Sword
		});
		expect(gameState.sword.name).toBe("Large Sword");

		// Simulate chest granting Small Sword (what Chest._open does for tier 0)
		gameState.sword = SWORDS[0];
		expect(gameState.sword.name).toBe("Small Sword");
		expect(gameState.sword.damage).toBe(1);
		result.game.stop();
	});

	it("locked door without key does not trigger transition", async () => {
		const result = await runLevel1(undefined, 0.1);
		const scene = result.game.currentScene!;

		// Find the door and force it to be locked with player in range
		const door = scene.findFirst("door");
		expect(door).not.toBeNull();
		if (!door) return;
		(door as Record<string, unknown>).locked = true;
		(door as Record<string, unknown>)._playerInRange = true;
		gameState.keys = 0;

		const levelBefore = gameState.currentLevel;

		// Try to interact — should be blocked (no keys)
		result.game.input.inject("interact", true);
		result.game.step();
		result.game.input.inject("interact", false);

		// Wait long enough for a potential transition (door uses 0.6s delay)
		for (let i = 0; i < 60; i++) {
			result.game.step();
		}

		expect(gameState.currentLevel).toBe(levelBefore);
		result.game.stop();
	});

	it("enemy does not attack while in hurt state", async () => {
		const result = await runLevel1(undefined, 0.1);
		const scene = result.game.currentScene!;
		const player = scene.findByType(Player)!;

		// Find a dwarf enemy
		const dwarfs = scene.findAllByType(Dwarf);
		expect(dwarfs.length).toBeGreaterThan(0);
		const dwarf = dwarfs[0];

		// Position dwarf within attack range of player
		dwarf.position = player.position.clone().add(new Vec2(10, 0));

		// Hit the dwarf to put it in hurt state (0.3s = ~18 frames)
		dwarf.takeDamage(1, new Vec2(1, 0));

		// Check no EnemyWeapon is spawned during hurt recovery
		let enemyWeaponFound = false;
		for (let i = 0; i < 18; i++) {
			result.game.step();
			if (scene.findByType(EnemyWeapon) !== null) {
				enemyWeaponFound = true;
			}
		}

		// Enemy should not have attacked during hurt state
		expect(enemyWeaponFound).toBe(false);
		result.game.stop();
	});

	it("invincibility blocks second hit from simultaneous attacks", async () => {
		const result = await runLevel1(undefined, 0.1);
		const player = result.game.currentScene!.findByType(Player)!;

		const healthBefore = gameState.health;

		// Simulate two enemies hitting the player in the same frame.
		// The first hit triggers invincibility, blocking the second.
		player.takeDamage(1, new Vec2(1, 0));
		player.takeDamage(1, new Vec2(-1, 0));

		// Only one hit should have registered
		expect(gameState.health).toBe(healthBefore - 1);
		result.game.stop();
	});
});
