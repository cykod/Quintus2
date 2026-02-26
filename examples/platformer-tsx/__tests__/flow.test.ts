import { assertDeterministic, InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { Player } from "../entities/player.js";
import { Level1 } from "../scenes/level1.js";
import { TitleScene } from "../scenes/title-scene.js";
import {
	loadPlatformerAssets,
	platformerPlugins,
	resetPlatformerState,
	runLevel1,
	runScene,
} from "./helpers.js";

describe("Game flow", () => {
	it("Level1 loads and player is positioned on map", async () => {
		const result = await runLevel1(undefined, 0.2);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		// Player should be positioned at the spawn point
		expect(player!.position.x).toBeGreaterThan(0);
		expect(player!.position.y).toBeGreaterThan(0);
		result.game.stop();
	});

	it("deterministic replay produces identical final state", async () => {
		const input = InputScript.create()
			.press("right", 60) // walk right for 1 second
			.tap("jump") // jump
			.wait(30);

		await assertDeterministic({
			scene: Level1,
			seed: 42,
			width: 320,
			height: 240,
			plugins: platformerPlugins(),
			input,
			snapshotInterval: 0,
			setup: loadPlatformerAssets,
			beforeRun: resetPlatformerState,
		});
	});
});
