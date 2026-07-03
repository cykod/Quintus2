import { AudioPlugin, InputPlugin, PhysicsPlugin, Vec2 } from "quintus2";
import { TestRunner } from "quintus2/testing";
import { describe, expect, it } from "vitest";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "../config.js";
import { Player } from "../entities/player.js";
import { Level1 } from "../scenes/level1.js";
import { gameState } from "../state.js";

describe("Player", () => {
	it("falls under gravity and lands on the floor", async () => {
		gameState.reset();
		const result = await TestRunner.run({
			scene: Level1,
			seed: 42,
			width: 320,
			height: 240,
			plugins: [
				PhysicsPlugin({ gravity: new Vec2(0, 800), collisionGroups: COLLISION_GROUPS }),
				InputPlugin({ actions: INPUT_BINDINGS }),
				AudioPlugin(),
			],
			duration: 1,
		});

		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		expect(player!.isOnFloor()).toBe(true);

		result.game.stop();
	});
});
