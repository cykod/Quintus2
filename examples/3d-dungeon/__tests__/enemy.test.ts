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
import {
	ENEMY_DAMAGE,
	ENEMY_HEALTH,
	ENEMY_KILL_SCORE,
	GAME_HEIGHT,
	GAME_WIDTH,
	INPUT_BINDINGS,
	PLAYER_ATTACK_DAMAGE,
} from "../config.js";
import { DungeonGrid } from "../entities/dungeon-grid.js";
import { Enemy } from "../entities/enemy.js";
import { PlayerCharacter } from "../entities/player.js";
import { TurnManager } from "../entities/turn-manager.js";
import { gameState } from "../state.js";
import { resetState } from "./helpers.js";

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

describe("Enemy", () => {
	beforeEach(() => {
		resetState();
	});

	describe("AI decisions", () => {
		it("attacks when adjacent to player", async () => {
			// Enemy at (2,1), player at (1,1) — adjacent
			const enemy = new Enemy();
			enemy.gridX = 2;
			enemy.gridZ = 1;
			enemy.dungeonGrid = { isWalkableAndFree: () => true } as unknown as DungeonGrid;

			const action = enemy.takeTurn(1, 1);
			expect(action.type).toBe("attack");
			if (action.type === "attack") {
				expect(action.targetX).toBe(1);
				expect(action.targetZ).toBe(1);
			}
		});

		it("moves toward player when not adjacent", async () => {
			// Enemy at (4,1), player at (1,1) — distance 3
			const enemy = new Enemy();
			enemy.gridX = 4;
			enemy.gridZ = 1;
			enemy.dungeonGrid = {
				isWalkableAndFree: () => true,
			} as unknown as DungeonGrid;

			const action = enemy.takeTurn(1, 1);
			expect(action.type).toBe("move");
			if (action.type === "move") {
				// Should move toward player (decrease X)
				expect(action.toX).toBe(3);
				expect(action.toZ).toBe(1);
			}
		});

		it("stays idle when surrounded by walls", async () => {
			const enemy = new Enemy();
			enemy.gridX = 3;
			enemy.gridZ = 3;
			enemy.dungeonGrid = {
				isWalkableAndFree: () => false,
			} as unknown as DungeonGrid;

			const action = enemy.takeTurn(1, 1);
			expect(action.type).toBe("idle");
		});

		it("idles when all directions are blocked or worse", async () => {
			// Enemy at (3,1), player at (1,1). Direct path west is blocked.
			// All other directions increase Manhattan distance, so enemy idles.
			const enemy = new Enemy();
			enemy.gridX = 3;
			enemy.gridZ = 1;
			enemy.dungeonGrid = {
				isWalkableAndFree: (gx: number, gz: number) => {
					// Block west (2,1) — the only direction that would reduce distance
					if (gx === 2 && gz === 1) return false;
					return true;
				},
			} as unknown as DungeonGrid;

			const action = enemy.takeTurn(1, 1);
			// Current dist = |1-3|+|1-1| = 2
			// North (3,0): dist=3, South (3,2): dist=3, East (4,1): dist=3 — all worse
			// West blocked → no improving move → idle
			expect(action.type).toBe("idle");
		});
	});

	describe("takeDamage", () => {
		it("reduces health", () => {
			const enemy = new Enemy();
			enemy.health = ENEMY_HEALTH;
			enemy.takeDamage(1);
			expect(enemy.health).toBe(ENEMY_HEALTH - 1);
		});

		it("emits died when health reaches 0", () => {
			const enemy = new Enemy();
			enemy.health = 1;
			let diedEmitted = false;
			enemy.died.connect(() => {
				diedEmitted = true;
			});
			enemy.takeDamage(1);
			expect(enemy.health).toBe(0);
			expect(diedEmitted).toBe(true);
		});

		it("does not emit died when health remains above 0", () => {
			const enemy = new Enemy();
			enemy.health = ENEMY_HEALTH;
			let diedEmitted = false;
			enemy.died.connect(() => {
				diedEmitted = true;
			});
			enemy.takeDamage(1);
			expect(diedEmitted).toBe(false);
		});
	});

	describe("integrated scene", () => {
		// Test level: player at (1,1), enemy at (3,1), wall border
		const ENEMY_TEST_LEVEL = ["######", "#P.G.#", "#....#", "######"];

		class EnemyTestScene extends Scene {
			override onReady() {
				const turnManager = this.add(TurnManager);

				const grid = this.add(DungeonGrid);
				(grid as unknown as { _charGrid: string[][] })._charGrid = ENEMY_TEST_LEVEL.map((l) =>
					l.split(""),
				);
				grid.setSize(6, 4);

				const player = this.add(PlayerCharacter, {
					dungeonGrid: grid,
					turnManager,
					gridX: 1,
					gridZ: 1,
				});

				const enemies = new Set<Enemy>();
				for (const cell of grid.findAllChars("G")) {
					const enemy = this.add(Enemy, {
						gridX: cell.gridX,
						gridZ: cell.gridZ,
						dungeonGrid: grid,
					});
					enemies.add(enemy);
					grid.setOccupied(cell.gridX, cell.gridZ);
				}

				const findEnemyAt = (gx: number, gz: number): Enemy | undefined => {
					for (const e of enemies) {
						if (e.gridX === gx && e.gridZ === gz) return e;
					}
					return undefined;
				};

				// Enemy turn orchestration
				turnManager.enemyTurnStart.connect(() => {
					if (enemies.size === 0) {
						turnManager.enemyAnimDone();
						return;
					}

					let remaining = enemies.size;
					const onDone = () => {
						remaining--;
						if (remaining <= 0) {
							turnManager.enemyAnimDone();
						}
					};

					for (const enemy of enemies) {
						const action = enemy.takeTurn(player.gridX, player.gridZ);
						enemy.actionComplete.once(onDone);
						enemy.executeAction(action);
					}
				});

				// Player attack → damage enemies
				player.attacked.connect(({ gridX, gridZ }) => {
					const enemy = findEnemyAt(gridX, gridZ);
					if (!enemy) return;
					enemy.takeDamage(PLAYER_ATTACK_DAMAGE);
				});

				// Enemy attacks / death
				for (const enemy of enemies) {
					enemy.attackedPlayer.connect(() => {
						gameState.health -= ENEMY_DAMAGE;
						if (gameState.health <= 0) {
							player.died.emit();
						}
					});

					enemy.died.connect(() => {
						enemies.delete(enemy);
						grid.clearOccupied(enemy.gridX, enemy.gridZ);
						gameState.score += ENEMY_KILL_SCORE;
						gameState.kills++;
						enemy.destroy();
					});
				}

				player.died.connect(() => {
					gameState.level = -1;
				});
			}
		}

		it("player cannot walk into enemy-occupied tile", async () => {
			const { InputScript } = await import("@quintus/test");
			// Turn left (face east), move forward — enemy is at (3,1), tile (2,1) is free
			// Move forward once to (2,1), then try again into (3,1) which is occupied
			// Move anim 12f + enemy attack anim 18f = 30f needed after move
			const input = InputScript.create()
				.tap("turn_left", 1)
				.wait(12)
				.tap("move_forward", 1)
				.wait(35)
				.tap("move_forward", 1)
				.wait(15);
			const result = await runScene(EnemyTestScene, input);
			const player = result.game.currentScene!.findByType(PlayerCharacter);
			// Should be blocked at (2,1), not (3,1)
			expect(player!.gridX).toBe(2);
			expect(player!.gridZ).toBe(1);
		});

		it("killing enemy awards score and increments kills", async () => {
			const { InputScript } = await import("@quintus/test");
			// Turn left (face east), move to (2,1), then attack twice to kill enemy at (3,1)
			// ENEMY_HEALTH=2, PLAYER_ATTACK_DAMAGE=1, so need 2 attacks
			// Turn anim ~9f, move anim 12f + enemy attack anim 18f = 30f,
			// attack anim ~27f, second attack + enemy turn ~27f + 18f
			const input = InputScript.create()
				.tap("turn_left", 1)
				.wait(12)
				.tap("move_forward", 1)
				.wait(35)
				.tap("interact", 1)
				.wait(30)
				.tap("interact", 1)
				.wait(50);
			await runScene(EnemyTestScene, input);
			expect(gameState.score).toBe(ENEMY_KILL_SCORE);
			expect(gameState.kills).toBe(1);
		});

		it("enemy spawns at correct grid position", async () => {
			const result = await runScene(EnemyTestScene, undefined, 0.1);
			const enemy = result.game.currentScene!.findByType(Enemy);
			expect(enemy).toBeDefined();
			expect(enemy!.gridX).toBe(3);
			expect(enemy!.gridZ).toBe(1);
		});
	});
});
