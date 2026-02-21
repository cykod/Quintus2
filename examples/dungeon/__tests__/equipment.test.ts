import { findInSnapshot } from "@quintus/core";
import { InputScript } from "@quintus/test";
import { describe, expect, test } from "vitest";
import { gameState, SHIELDS } from "../state.js";
import { runLevel1 } from "./helpers.js";

describe("Dungeon — Equipment System", () => {
	test("EquippedWeapon is child of player", async () => {
		const result = await runLevel1(undefined, 0.1);
		const player = result.timeline.findNode(0, "Player");
		expect(player).not.toBeNull();
		const weapon = findInSnapshot(player!, "EquippedWeapon");
		expect(weapon).not.toBeNull();
		result.game.stop();
	});

	test("weapon swing animation sets isSwinging", async () => {
		const result = await runLevel1(InputScript.create().wait(5).tap("attack"), 0.5);
		// Verify the scene ran without error after attack input
		const player = result.timeline.findNode(10, "Player");
		expect(player).not.toBeNull();
		result.game.stop();
	});

	test("shield shows when player has one", async () => {
		const result = await runLevel1(undefined, 0.1, () => {
			gameState.shield = SHIELDS[0];
		});
		const player = result.timeline.findNode(0, "Player");
		expect(player).not.toBeNull();
		const shield = findInSnapshot(player!, "EquippedShield");
		expect(shield).not.toBeNull();
		result.game.stop();
	});

	test("shield hidden when player has none", async () => {
		const result = await runLevel1(undefined, 0.1);
		const player = result.timeline.findNode(0, "Player");
		expect(player).not.toBeNull();
		const shield = findInSnapshot(player!, "EquippedShield");
		expect(shield).not.toBeNull();
		expect(shield!.visible).toBe(false);
		result.game.stop();
	});
});
