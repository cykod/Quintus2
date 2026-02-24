import { findAllInSnapshot } from "@quintus/core";
import { describe, expect, test } from "vitest";
import { entitySheet, TILE } from "../sprites.js";
import { gameState, POTIONS, SWORDS } from "../state.js";
import { runLevel1 } from "./helpers.js";

describe("Dungeon — HUD", () => {
	test("HUD exists in scene", async () => {
		const result = await runLevel1(undefined, 0.1);
		const hud = result.timeline.findNode(0, "HUD");
		expect(hud).not.toBeNull();
		result.game.stop();
	});

	test("HUD has correct number of health icons", async () => {
		const result = await runLevel1(undefined, 0.1);
		const hud = result.timeline.findNode(0, "HUD");
		expect(hud).not.toBeNull();
		if (!hud) return;
		// HUD should have at least maxHealth Sprite children (hearts + sword + potion)
		const sprites = findAllInSnapshot(hud, "Sprite");
		expect(sprites.length).toBeGreaterThanOrEqual(gameState.maxHealth);
		result.game.stop();
	});

	test("HUD has score label", async () => {
		const result = await runLevel1(undefined, 0.1);
		const hud = result.timeline.findNode(0, "HUD");
		expect(hud).not.toBeNull();
		if (!hud) return;
		const labels = findAllInSnapshot(hud, "Label");
		expect(labels.length).toBeGreaterThanOrEqual(1);
		result.game.stop();
	});

	test("score label updates when score changes", () => {
		gameState.reset();
		let notified = false;
		const conn = gameState.on("score").connect(({ value }) => {
			expect(value).toBe(50);
			notified = true;
		});
		gameState.score = 50;
		expect(notified).toBe(true);
		conn.disconnect();
	});

	test("health signal fires on health change", () => {
		gameState.reset();
		let notified = false;
		const conn = gameState.on("health").connect(({ value }) => {
			expect(value).toBe(2);
			notified = true;
		});
		gameState.health = 2;
		expect(notified).toBe(true);
		conn.disconnect();
	});

	test("weapon signal fires on sword change", () => {
		gameState.reset();
		let notified = false;
		const conn = gameState.on("sword").connect(({ value }) => {
			expect(value.spriteFrame).toBe(SWORDS[1].spriteFrame);
			notified = true;
		});
		gameState.sword = SWORDS[1];
		expect(notified).toBe(true);
		conn.disconnect();
	});

	test("potion signal fires on potion pickup", () => {
		gameState.reset();
		let notified = false;
		const conn = gameState.on("potion").connect(({ value }) => {
			expect(value).not.toBeNull();
			expect(value?.spriteFrame).toBe(POTIONS[0].spriteFrame);
			notified = true;
		});
		gameState.potion = POTIONS[0];
		expect(notified).toBe(true);
		conn.disconnect();
	});

	test("potion signal fires when potion used (set to null)", () => {
		gameState.reset();
		gameState.potion = POTIONS[0];
		let notified = false;
		const conn = gameState.on("potion").connect(({ value }) => {
			expect(value).toBeNull();
			notified = true;
		});
		gameState.potion = null;
		expect(notified).toBe(true);
		conn.disconnect();
	});

	test("health icons use correct tile IDs", () => {
		// Verify the TILE constants match the expected potion tiles
		expect(TILE.HEALTH_FULL).toBe(115); // potion_red
		expect(TILE.HEALTH_EMPTY).toBe(113); // potion_gray

		// Verify entitySheet can resolve these frames without error
		const fullRect = entitySheet.getFrameRect(TILE.HEALTH_FULL);
		const emptyRect = entitySheet.getFrameRect(TILE.HEALTH_EMPTY);
		expect(fullRect).toBeDefined();
		expect(emptyRect).toBeDefined();
		expect(fullRect).not.toEqual(emptyRect);
	});
});
