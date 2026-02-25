import { describe, expect, it } from "vitest";
import { Player } from "../entities/player.js";
import { ArenaScene } from "../scenes/arena-scene.js";
import { gameState } from "../state.js";
import { runScene } from "./helpers.js";

describe("Weapons", () => {
	it("starts with pistol equipped", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		expect(player?.currentWeaponId).toBe("pistol");
		expect(gameState.currentWeapon).toBe("pistol");
	});

	it("unlocking weapon updates state and switches to it", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();

		player?.unlockWeapon("machine");
		expect(player?.currentWeaponId).toBe("machine");
		expect(gameState.currentWeapon).toBe("machine");
		expect(gameState.ammo).toBe(60);
		expect(gameState.maxAmmo).toBe(60);
	});

	it("unlocking silencer sets correct ammo", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);

		player?.unlockWeapon("silencer");
		expect(gameState.ammo).toBe(12);
		expect(gameState.maxAmmo).toBe(12);
	});

	it("switching to same weapon is no-op", async () => {
		const result = await runScene(ArenaScene, undefined, 0.1);
		const player = result.game.currentScene?.findByType(Player);

		player?.switchWeapon("pistol");
		// Should remain with infinite ammo (pistol default)
		expect(gameState.ammo).toBe(Infinity);
	});
});
