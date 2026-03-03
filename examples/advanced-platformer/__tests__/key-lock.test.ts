import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { KeyPickup } from "../entities/key-pickup.js";
import { LockedDoor } from "../entities/locked-door.js";
import { gameState } from "../state.js";
import { KeyLockArena, runScene } from "./helpers.js";

describe("Key & Lock", () => {
	it("key pickup sets gameState.keys[color]", async () => {
		// Walk right — player will overlap the key at x=300
		const result = await runScene(
			KeyLockArena,
			InputScript.create().wait(10).hold("right").wait(120),
			2.5,
		);

		const scene = result.game.currentScene!;
		const keys = scene.findAllByType(KeyPickup);

		expect(keys.length).toBe(0);
		expect(gameState.keys.red).toBe(true);

		result.game.stop();
	});

	it("key has collectible and key tags", async () => {
		const result = await runScene(KeyLockArena, undefined, 0.1);
		const key = result.game.currentScene!.findByType(KeyPickup)!;

		expect(key.hasTag("collectible")).toBe(true);
		expect(key.hasTag("key")).toBe(true);

		result.game.stop();
	});

	it("locked door has locked_door tag", async () => {
		const result = await runScene(KeyLockArena, undefined, 0.1);
		const door = result.game.currentScene!.findByType(LockedDoor)!;

		expect(door.hasTag("locked_door")).toBe(true);

		result.game.stop();
	});

	it("locked door opens after picking up the matching key", async () => {
		// Walk right through key and into lock
		const result = await runScene(
			KeyLockArena,
			InputScript.create().wait(10).hold("right").wait(300),
			6.0,
		);

		const scene = result.game.currentScene!;

		// Key should be collected
		expect(gameState.keys.red).toBe(true);

		// Door should have been opened and eventually destroyed
		const doors = scene.findAllByType(LockedDoor);
		expect(doors.length).toBe(0);

		result.game.stop();
	});

	it("locked door blocks player without matching key", async () => {
		const result = await runScene(KeyLockArena, undefined, 0.1, () => {
			// Ensure keys are reset for this test (nested object isn't deeply reset)
			gameState.keys.red = false;
			gameState.keys.blue = false;
			gameState.keys.green = false;
			gameState.keys.yellow = false;
		});
		const door = result.game.currentScene!.findByType(LockedDoor)!;

		// Without the key, the door should remain
		expect(door.isDestroyed).toBe(false);

		result.game.stop();
	});
});
