import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("three", () => import("../../../packages/three/src/__test-utils__/three-mock.js"));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
	GLTFLoader: class {
		loadAsync() {
			return Promise.resolve({});
		}
	},
}));

import type { Plugin, SceneConstructor } from "@quintus/core";
import { Scene } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import type { InputScript } from "@quintus/test";
import { TestRunner } from "@quintus/test";
import { ThreePlugin } from "@quintus/three";
import {
	COIN_SCORE,
	GAME_HEIGHT,
	GAME_WIDTH,
	INPUT_BINDINGS,
	PLAYER_HEALTH,
	TRAP_DAMAGE,
} from "../config.js";
import { CoinItem } from "../entities/coin-item.js";
import { DungeonGrid } from "../entities/dungeon-grid.js";
import { PlayerCharacter } from "../entities/player.js";
import { TrapTile } from "../entities/trap-tile.js";
import { gameState } from "../state.js";
import { resetState } from "./helpers.js";

// Simple test level: player at (1,1), coin at (2,1), trap at (3,1), exit at (4,1), wall border
const TEST_LEVEL = ["######", "#P.CT#", "#...E#", "######"];

class PlayerTestScene extends Scene {
	override onReady() {
		const grid = this.add(DungeonGrid);
		// Skip _defineTiles by setting _charGrid directly then parseGrid with no tiles
		(grid as unknown as { _charGrid: string[][] })._charGrid = TEST_LEVEL.map((l) => l.split(""));
		// Set the size without calling parseGrid (which calls _defineTiles via parseLevel)
		grid.setSize(6, 4);

		const player = this.add(PlayerCharacter, {
			dungeonGrid: grid,
			gridX: 1,
			gridZ: 1,
		});

		// Coins
		const coins = new Map<string, CoinItem>();
		for (const cell of grid.findAllChars("C")) {
			const coin = this.add(CoinItem, {
				gridX: cell.gridX,
				gridZ: cell.gridZ,
			});
			coins.set(`${cell.gridX},${cell.gridZ}`, coin);
		}

		// Traps
		for (const cell of grid.findAllChars("T")) {
			this.add(TrapTile, { gridX: cell.gridX, gridZ: cell.gridZ });
		}

		// Wire signals
		player.collected.connect(({ gridX, gridZ }) => {
			const key = `${gridX},${gridZ}`;
			const coin = coins.get(key);
			if (coin) {
				gameState.score += COIN_SCORE;
				coin.destroy();
				coins.delete(key);
				grid.clearCell(gridX, gridZ);
			}
		});

		player.reachedExit.connect(() => {
			gameState.level = 99; // sentinel for test
		});

		player.died.connect(() => {
			gameState.level = -1; // sentinel for test
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

describe("PlayerCharacter", () => {
	beforeEach(() => {
		resetState();
	});

	it("starts at correct grid position", async () => {
		const result = await runScene(PlayerTestScene, undefined, 0.1);
		const player = result.game.currentScene!.findByType(PlayerCharacter);
		expect(player).toBeDefined();
		expect(player!.gridX).toBe(1);
		expect(player!.gridZ).toBe(1);
	});

	it("initial health matches config", async () => {
		await runScene(PlayerTestScene, undefined, 0.1);
		expect(gameState.health).toBe(PLAYER_HEALTH);
	});

	it("movement updates gridX", async () => {
		const { InputScript } = await import("@quintus/test");
		// Tap right, then wait for move to complete (MOVE_DURATION=0.2s ~12 frames)
		const input = InputScript.create().tap("move_right", 1).wait(15);
		const result = await runScene(PlayerTestScene, input);
		const player = result.game.currentScene!.findByType(PlayerCharacter);
		expect(player!.gridX).toBe(2);
	});

	it("cannot walk through walls", async () => {
		const { InputScript } = await import("@quintus/test");
		// Try to move up into a wall
		const input = InputScript.create().tap("move_up", 1).wait(15);
		const result = await runScene(PlayerTestScene, input);
		const player = result.game.currentScene!.findByType(PlayerCharacter);
		expect(player!.gridX).toBe(1);
		expect(player!.gridZ).toBe(1); // didn't move
	});

	it("coin collection increases score", async () => {
		const { InputScript } = await import("@quintus/test");
		// Move right twice to reach coin at (3,1): right → wait → right → wait
		const input = InputScript.create().tap("move_right", 1).wait(15).tap("move_right", 1).wait(15);
		await runScene(PlayerTestScene, input);
		expect(gameState.score).toBe(COIN_SCORE);
	});

	it("trap reduces health", async () => {
		const { InputScript } = await import("@quintus/test");
		// Move right 3 times to reach trap at (4,1)
		const input = InputScript.create()
			.tap("move_right", 1)
			.wait(15)
			.tap("move_right", 1)
			.wait(15)
			.tap("move_right", 1)
			.wait(15);
		await runScene(PlayerTestScene, input);
		expect(gameState.health).toBe(PLAYER_HEALTH - TRAP_DAMAGE);
	});

	it("exit triggers reachedExit signal", async () => {
		const { InputScript } = await import("@quintus/test");
		// Move down then right to reach exit at (4,2)
		const input = InputScript.create()
			.tap("move_down", 1)
			.wait(15)
			.tap("move_right", 1)
			.wait(15)
			.tap("move_right", 1)
			.wait(15)
			.tap("move_right", 1)
			.wait(15);
		await runScene(PlayerTestScene, input);
		expect(gameState.level).toBe(99); // sentinel set by reachedExit handler
	});

	it("death at health 0 emits died signal", async () => {
		const { InputScript } = await import("@quintus/test");
		// Move right 3 times to reach trap at (4,1), with health set to 1 after reset
		const input = InputScript.create()
			.tap("move_right", 1)
			.wait(15)
			.tap("move_right", 1)
			.wait(15)
			.tap("move_right", 1)
			.wait(15);
		await runScene(PlayerTestScene, input, undefined, () => {
			gameState.health = 1;
		});
		expect(gameState.level).toBe(-1); // sentinel set by died handler
	});
});
