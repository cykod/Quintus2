import { WaveSpawner } from "@quintus/ai-prefabs";
import { Scene } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { SPAWN_INTERVAL, WAVE_DEFS, WAVE_DELAY } from "../config.js";
import { runScene } from "./helpers.js";

class WaveTestScene extends Scene {}

describe("Waves", () => {
	it("wave spawner emits waveStarted on first wave", async () => {
		const result = await runScene(WaveTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const ws = new WaveSpawner();
		ws.spawnInterval = SPAWN_INTERVAL;
		ws.wavePause = WAVE_DELAY;
		ws.defineWaves(WAVE_DEFS);
		scene.add(ws);
		result.game.step();

		let startedWave = -1;
		ws.waveStarted.connect((w) => {
			startedWave = w;
		});

		ws.start();
		result.game.step();

		expect(startedWave).toBe(0); // WaveSpawner is 0-indexed
	});

	it("wave spawns enemies via spawnRequested", async () => {
		const result = await runScene(WaveTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const ws = new WaveSpawner();
		ws.spawnInterval = SPAWN_INTERVAL;
		ws.wavePause = WAVE_DELAY;
		ws.defineWaves(WAVE_DEFS);
		scene.add(ws);
		result.game.step();

		let spawnCount = 0;
		ws.spawnRequested.connect(() => {
			spawnCount++;
		});

		ws.start();

		// Run enough frames for some enemies to spawn
		for (let i = 0; i < 120; i++) {
			result.game.step();
		}

		expect(spawnCount).toBeGreaterThan(0);
	});

	it("wave cleared triggers waveCleared signal", async () => {
		const result = await runScene(WaveTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const ws = new WaveSpawner();
		ws.spawnInterval = SPAWN_INTERVAL;
		ws.wavePause = WAVE_DELAY;
		ws.defineWaves(WAVE_DEFS);
		scene.add(ws);
		result.game.step();

		let clearedWave = -1;
		ws.waveCleared.connect((w) => {
			clearedWave = w;
		});

		// Kill all enemies as they spawn
		ws.spawnRequested.connect(() => {
			ws.notifyDeath();
		});

		ws.start();

		// Run enough frames for wave 1 to spawn and be killed
		for (let i = 0; i < 300; i++) {
			result.game.step();
		}

		expect(clearedWave).toBe(0); // 0-indexed
	});

	it("wave spawner tracks active enemy count", async () => {
		const result = await runScene(WaveTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const ws = new WaveSpawner();
		ws.spawnInterval = SPAWN_INTERVAL;
		ws.wavePause = WAVE_DELAY;
		ws.defineWaves(WAVE_DEFS);
		scene.add(ws);
		result.game.step();

		ws.start();
		expect(ws.activeCount).toBe(0);

		// Run enough frames for at least one spawn (spawnInterval is 0.8s at 60fps = 48 frames)
		for (let i = 0; i < 60; i++) {
			result.game.step();
		}

		expect(ws.activeCount).toBeGreaterThan(0);
	});
});
