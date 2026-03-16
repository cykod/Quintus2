import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("../../../packages/three/src/__test-utils__/three-mock.js"));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
	GLTFLoader: class {
		loadAsync() {
			return Promise.resolve({});
		}
	},
}));
vi.mock("three/addons/utils/SkeletonUtils.js", () => ({
	clone: (scene: unknown) => scene ?? {},
}));

import type { Plugin, SceneConstructor } from "@quintus/core";
import { Scene } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import type { InputScript } from "@quintus/test";
import { TestRunner } from "@quintus/test";
import { ThreePlugin } from "@quintus/three";
import { GAME_HEIGHT, GAME_WIDTH, INPUT_BINDINGS, PLAYER_HEALTH } from "../config.js";
import { DungeonGrid } from "../entities/dungeon-grid.js";
import { HealthPotion } from "../entities/health-potion.js";
import { PlayerCharacter } from "../entities/player.js";
import { TurnManager } from "../entities/turn-manager.js";
import { gameState } from "../state.js";
import { resetState } from "./helpers.js";

// Test level: player at (1,1), health potion at (2,1)
const POTION_TEST_LEVEL = ["####", "#PH#", "####"];

class PotionTestScene extends Scene {
	override onReady() {
		const turnManager = this.add(TurnManager);

		const grid = this.add(DungeonGrid);
		(grid as unknown as { _charGrid: string[][] })._charGrid = POTION_TEST_LEVEL.map((l) =>
			l.split(""),
		);
		grid.setSize(4, 3);

		const player = this.add(PlayerCharacter, {
			dungeonGrid: grid,
			turnManager,
			gridX: 1,
			gridZ: 1,
		});

		const potions = new Map<string, HealthPotion>();
		for (const cell of grid.findAllChars("H")) {
			const potion = this.add(HealthPotion, {
				gridX: cell.gridX,
				gridZ: cell.gridZ,
			});
			potions.set(`${cell.gridX},${cell.gridZ}`, potion);
		}

		player.collectedPotion.connect(({ gridX, gridZ }) => {
			const key = `${gridX},${gridZ}`;
			const potion = potions.get(key);
			if (potion) {
				if (gameState.health < gameState.maxHealth) {
					gameState.health = Math.min(gameState.health + 1, gameState.maxHealth);
				}
				potion.destroy();
				potions.delete(key);
				grid.clearCell(gridX, gridZ);
			}
		});
	}
}

const PLUGINS: Plugin[] = [
	ThreePlugin({ antialias: false, background: 0x000000 }),
	InputPlugin({ actions: INPUT_BINDINGS }),
];

function runScene(
	scene: SceneConstructor,
	input?: InputScript,
	duration?: number,
	afterReset?: () => void,
) {
	return TestRunner.run({
		scene,
		seed: 42,
		width: GAME_WIDTH,
		height: GAME_HEIGHT,
		plugins: PLUGINS,
		input,
		duration,
		snapshotInterval: 0,
		beforeRun: () => {
			resetState();
			afterReset?.();
		},
	});
}

describe("HealthPotion", () => {
	beforeEach(() => {
		resetState();
	});

	it("stepping on H tile with missing health restores 1 HP", async () => {
		const { InputScript } = await import("@quintus/test");
		// Turn left (face east), move forward to (2,1) with health potion
		const input = InputScript.create().tap("turn_left", 1).wait(12).tap("move_forward", 1).wait(15);
		await runScene(PotionTestScene, input, undefined, () => {
			gameState.health = PLAYER_HEALTH - 1;
		});
		expect(gameState.health).toBe(PLAYER_HEALTH);
	});

	it("stepping on H tile at full health does not increase health", async () => {
		const { InputScript } = await import("@quintus/test");
		const input = InputScript.create().tap("turn_left", 1).wait(12).tap("move_forward", 1).wait(15);
		await runScene(PotionTestScene, input);
		expect(gameState.health).toBe(PLAYER_HEALTH);
	});

	it("health never exceeds maxHealth", async () => {
		const { InputScript } = await import("@quintus/test");
		const input = InputScript.create().tap("turn_left", 1).wait(12).tap("move_forward", 1).wait(15);
		await runScene(PotionTestScene, input, undefined, () => {
			gameState.health = PLAYER_HEALTH;
		});
		expect(gameState.health).toBe(PLAYER_HEALTH);
		expect(gameState.health).toBeLessThanOrEqual(gameState.maxHealth);
	});

	it("potion removed from grid after collection", async () => {
		const { InputScript } = await import("@quintus/test");
		const input = InputScript.create().tap("turn_left", 1).wait(12).tap("move_forward", 1).wait(15);
		const result = await runScene(PotionTestScene, input, undefined, () => {
			gameState.health = PLAYER_HEALTH - 1;
		});
		const grid = result.game.currentScene!.findByType(DungeonGrid)!;
		expect(grid.charAt(2, 1)).toBe(".");
	});
});
