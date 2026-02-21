import { describe, expect, test } from "vitest";
import { entitySheet, TILE } from "../sprites.js";

const TILESET_SIZE = 132; // 12 cols x 11 rows

describe("Dungeon — Sprite Tile IDs", () => {
	test("all TILE values are within tileset range (0-131)", () => {
		for (const [name, value] of Object.entries(TILE)) {
			expect(value, `TILE.${name} = ${value}`).toBeGreaterThanOrEqual(0);
			expect(value, `TILE.${name} = ${value}`).toBeLessThan(TILESET_SIZE);
		}
	});

	test("all animation frames reference valid tile indices", () => {
		for (const animName of entitySheet.animationNames) {
			const anim = entitySheet.getAnimation(animName);
			expect(anim, `animation "${animName}" should exist`).toBeDefined();
			for (const frame of anim?.frames ?? []) {
				expect(frame, `${animName} frame ${frame}`).toBeGreaterThanOrEqual(0);
				expect(frame, `${animName} frame ${frame}`).toBeLessThan(TILESET_SIZE);
			}
		}
	});

	test("player uses knight tile (96)", () => {
		expect(TILE.PLAYER).toBe(96);
	});

	test("chest tiles are 89/90/91", () => {
		expect(TILE.CHEST_CLOSED).toBe(89);
		expect(TILE.CHEST_OPENING).toBe(90);
		expect(TILE.CHEST_OPEN).toBe(91);
	});

	test("door tiles use small door (45, 9)", () => {
		expect(TILE.DOOR_CLOSED).toBe(45);
		expect(TILE.DOOR_OPEN).toBe(9);
	});

	test("swords in weapon range (103-105)", () => {
		expect(TILE.SWORD_SMALL).toBe(103);
		expect(TILE.SWORD_LARGE).toBe(104);
		expect(TILE.SWORD_BARBARIAN).toBe(105);
	});

	test("shields in shield range (101-102)", () => {
		expect(TILE.SHIELD_WOODEN).toBe(101);
		expect(TILE.SHIELD_METAL).toBe(102);
	});
});
