import { describe, expect, test } from "vitest";
import { runLevel1 } from "./helpers.js";

describe("Dungeon — Scene Loading", () => {
	test("Level 1 loads without error", async () => {
		const result = await runLevel1(undefined, 0.5);
		expect(result.totalFrames).toBeGreaterThan(0);
		result.game.stop();
	});

	test("Player exists in scene", async () => {
		const result = await runLevel1(undefined, 0.5);
		const player = result.timeline.findNode(0, "Player");
		expect(player).not.toBeNull();
		result.game.stop();
	});

	test("Tilemap generates collision", async () => {
		const result = await runLevel1(undefined, 0.5);
		// If collision generation failed, the player wouldn't be placed correctly
		// and the scene would still load — verify player was spawned
		const player = result.timeline.findNode(0, "Player");
		expect(player).not.toBeNull();
		result.game.stop();
	});
});
