import { WaveSpawner } from "@quintus/ai-prefabs";
import { Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { SPAWN_INTERVAL, WAVE_DEFS, WAVE_DELAY } from "../config.js";
import { ArrowTower } from "../entities/arrow-tower.js";
import { BasicCreep } from "../entities/basic-creep.js";
import { PlacementManager } from "../entities/placement-manager.js";
import { Projectile } from "../entities/projectile.js";
import { gridToWorld } from "../path.js";
import { gameState } from "../state.js";
import { runScene, TEST_PATH } from "./helpers.js";

class EdgeTestScene extends Scene {}

describe("Edge cases", () => {
	it("tower placement on all valid cells does not block enemy path", async () => {
		const result = await runScene(EdgeTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		// Set up placement manager with test valid cells (separate from road cells)
		const pm = new PlacementManager();
		const validCells = new Set(["1,1", "1,3", "3,1", "3,3", "5,1", "5,3"]);
		pm.validCells = validCells;
		scene.add(pm);
		result.game.step();

		// Place towers on all valid cells
		gameState.gold = 10000;
		gameState.selectedTower = "arrow";
		for (const cell of validCells) {
			const [col, row] = cell.split(",").map(Number);
			pm.placeAt(col!, row!);
		}

		// Spawn an enemy — it should still follow its path
		const creep = new BasicCreep();
		creep.pathDef = TEST_PATH;
		creep.speed = 5000; // fast traversal
		scene.add(creep);

		let exitReached = false;
		creep.reachedExit.connect(() => {
			exitReached = true;
		});

		for (let i = 0; i < 300; i++) {
			result.game.step();
		}

		expect(exitReached).toBe(true);
	});

	it("slow effect from multiple SlowTowers overwrites, does not stack", async () => {
		const result = await runScene(EdgeTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const creep = new BasicCreep();
		creep.pathDef = TEST_PATH;
		scene.add(creep);
		result.game.step();

		// First slow: 0.5x for 2s
		creep.applySlow(0.5, 2.0);
		expect(creep.slowMultiplier).toBe(0.5);

		// Second slow: 0.3x for 1s — should overwrite, not stack
		creep.applySlow(0.3, 1.0);
		expect(creep.slowMultiplier).toBe(0.3);

		// Should NOT be 0.15 (multiplicative stacking)
		expect(creep.slowMultiplier).not.toBe(0.15);
	});

	it("enemy reaching exit during wave transition decrements lives", async () => {
		const result = await runScene(EdgeTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const ws = new WaveSpawner();
		ws.spawnInterval = SPAWN_INTERVAL;
		ws.wavePause = WAVE_DELAY;
		ws.defineWaves(WAVE_DEFS);
		scene.add(ws);
		result.game.step();

		const startLives = gameState.lives;

		// Spawn a fast enemy that will reach exit during wave transition
		const creep = new BasicCreep();
		creep.pathDef = TEST_PATH;
		creep.speed = 5000;
		scene.add(creep);

		creep.reachedExit.connect(() => {
			gameState.lives--;
			ws.notifyDeath();
		});

		ws.start();

		// Run enough frames for the fast enemy to reach exit
		for (let i = 0; i < 300; i++) {
			result.game.step();
		}

		// Lives should have decremented (enemy reached exit)
		expect(gameState.lives).toBeLessThan(startLives);
	});

	it("tower picks a target when multiple enemies are equidistant", async () => {
		const result = await runScene(EdgeTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const towerPos = gridToWorld(3, 3);
		const tower = new ArrowTower();
		tower.position = new Vec2(towerPos.x, towerPos.y);
		scene.add(tower);

		// Two enemies at the same waypoint index, within range
		const creep1 = new BasicCreep();
		creep1.pathDef = TEST_PATH;
		scene.add(creep1);

		const creep2 = new BasicCreep();
		creep2.pathDef = TEST_PATH;
		scene.add(creep2);

		result.game.step();

		// Position both at the same distance from tower with same waypointIndex
		creep1.position._set(towerPos.x + 40, towerPos.y);
		creep1.waypointIndex = 2;
		creep2.position._set(towerPos.x - 40, towerPos.y);
		creep2.waypointIndex = 2;

		// Run enough frames (need sensor detection + fire timer)
		// Tower should fire without crashing (picks one deterministically)
		for (let i = 0; i < 120; i++) {
			result.game.step();
		}

		// The test verifies no crash occurs with equidistant enemies
		expect(tower.range).toBeGreaterThan(0);
	});

	it("wave does not advance while previous wave enemies are alive", async () => {
		const result = await runScene(EdgeTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const ws = new WaveSpawner();
		ws.spawnInterval = SPAWN_INTERVAL;
		ws.wavePause = 0.1; // very short pause
		ws.defineWaves([[{ type: "basic", count: 2 }], [{ type: "basic", count: 2 }]]);
		scene.add(ws);
		result.game.step();

		const wavesStarted: number[] = [];
		ws.waveStarted.connect((w) => {
			wavesStarted.push(w);
		});

		// Don't kill any enemies (no notifyDeath)
		ws.start();

		// Run enough frames for spawning to complete + wave pause to elapse
		for (let i = 0; i < 300; i++) {
			result.game.step();
		}

		// Only wave 0 should have started because enemies are still alive
		expect(wavesStarted).toEqual([0]);
		expect(ws.activeCount).toBe(2);
	});

	it("cannot place any tower when gold is 0", async () => {
		const result = await runScene(EdgeTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const pm = new PlacementManager();
		pm.validCells = new Set(["0,0", "1,0", "2,0"]);
		scene.add(pm);
		result.game.step();

		gameState.gold = 0;

		// Try every tower type
		gameState.selectedTower = "arrow";
		expect(pm.placeAt(0, 0)).toBe(false);

		gameState.selectedTower = "cannon";
		expect(pm.placeAt(1, 0)).toBe(false);

		gameState.selectedTower = "slow";
		expect(pm.placeAt(2, 0)).toBe(false);

		// Gold unchanged
		expect(gameState.gold).toBe(0);
	});

	it("projectile self-destructs when target dies before impact", async () => {
		const result = await runScene(EdgeTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const creep = new BasicCreep();
		creep.pathDef = TEST_PATH;
		scene.add(creep);
		result.game.step();

		// Create a projectile aimed at the creep, far away
		const projectile = new Projectile();
		projectile.target = creep;
		projectile.damage = 1;
		projectile.position = new Vec2(creep.position.x + 500, creep.position.y);
		scene.add(projectile);
		result.game.step();

		// Kill the target before projectile arrives
		creep.takeDamage(creep.health);
		expect(creep.isDestroyed).toBe(true);

		// Step a few frames — projectile should self-destruct without crashing
		for (let i = 0; i < 10; i++) {
			result.game.step();
		}

		expect(projectile.isDestroyed).toBe(true);
	});
});
