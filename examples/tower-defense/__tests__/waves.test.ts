import { Scene } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { WaveManager } from "../entities/wave-manager.js";
import { LEVEL1_PATH } from "../path.js";
import { runScene } from "./helpers.js";

class WaveTestScene extends Scene {}

describe("Waves", () => {
	it("wave manager emits waveStarted on first wave", async () => {
		const result = await runScene(WaveTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const wm = new WaveManager();
		wm.pathDef = LEVEL1_PATH;
		scene.add(wm);
		result.game.step();

		let startedWave = 0;
		wm.waveStarted.connect((w) => {
			startedWave = w;
		});

		wm.startWaves();
		result.game.step();

		expect(startedWave).toBe(1);
	});

	it("wave spawns enemies", async () => {
		const result = await runScene(WaveTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const wm = new WaveManager();
		wm.pathDef = LEVEL1_PATH;
		scene.add(wm);
		result.game.step();

		let spawnCount = 0;
		wm.enemySpawned.connect(() => {
			spawnCount++;
		});

		wm.startWaves();

		// Run enough frames for some enemies to spawn
		for (let i = 0; i < 120; i++) {
			result.game.step();
		}

		expect(spawnCount).toBeGreaterThan(0);
	});

	it("wave cleared triggers waveCleared signal", async () => {
		const result = await runScene(WaveTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const wm = new WaveManager();
		wm.pathDef = LEVEL1_PATH;
		scene.add(wm);
		result.game.step();

		let clearedWave = 0;
		wm.waveCleared.connect((w) => {
			clearedWave = w;
		});

		wm.startWaves();

		// Kill all enemies as they spawn (give them 0 hp)
		wm.enemySpawned.connect((enemy) => {
			enemy.takeDamage(enemy.hp);
		});

		// Run enough frames for wave 1 to spawn and be killed
		for (let i = 0; i < 300; i++) {
			result.game.step();
		}

		expect(clearedWave).toBe(1);
	});

	it("wave manager tracks active enemy count", async () => {
		const result = await runScene(WaveTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const wm = new WaveManager();
		wm.pathDef = LEVEL1_PATH;
		scene.add(wm);
		result.game.step();

		wm.startWaves();
		expect(wm.activeEnemies).toBe(0);

		// Run some frames for spawning
		for (let i = 0; i < 10; i++) {
			result.game.step();
		}

		expect(wm.activeEnemies).toBeGreaterThan(0);
	});
});
