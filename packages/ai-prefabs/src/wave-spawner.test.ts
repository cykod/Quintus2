import { _resetNodeIdCounter, Game, Scene } from "@quintus/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type WaveEntry, WaveSpawner } from "./wave-spawner.js";

function setup(waves?: WaveEntry[][], opts?: { autoStart?: boolean }) {
	_resetNodeIdCounter();
	const canvas = document.createElement("canvas");
	const game = new Game({ width: 100, height: 100, canvas, renderer: null });

	let spawner!: WaveSpawner;
	class TestScene extends Scene {
		override onReady() {
			spawner = this.add(WaveSpawner);
			spawner.spawnInterval = 0.1;
			spawner.wavePause = 0.2;
			if (opts?.autoStart) spawner.autoStart = true;
			if (waves) spawner.defineWaves(waves);
		}
	}
	game.registerScenes({ test: TestScene });
	game.start("test");
	game.step();

	return { game, spawner };
}

// Advance N frames
function step(game: Game, n: number) {
	for (let i = 0; i < n; i++) game.step();
}

describe("WaveSpawner", () => {
	beforeEach(() => _resetNodeIdCounter());

	it("emits waveStarted on start()", () => {
		const waves: WaveEntry[][] = [[{ type: "basic", count: 2 }]];
		const { spawner } = setup(waves);
		const handler = vi.fn();
		spawner.waveStarted.connect(handler);
		spawner.start();
		expect(handler).toHaveBeenCalledWith(0);
	});

	it("emits spawnRequested for each enemy", () => {
		const waves: WaveEntry[][] = [[{ type: "basic", count: 3 }]];
		const { game, spawner } = setup(waves);
		const handler = vi.fn();
		spawner.spawnRequested.connect(handler);
		spawner.start();
		// spawnInterval = 0.1s → at 60fps, ~6 frames per spawn
		step(game, 30);
		expect(handler).toHaveBeenCalledTimes(3);
		expect(handler).toHaveBeenCalledWith({ type: "basic", wave: 0, index: 0 });
		expect(handler).toHaveBeenCalledWith({ type: "basic", wave: 0, index: 1 });
		expect(handler).toHaveBeenCalledWith({ type: "basic", wave: 0, index: 2 });
	});

	it("tracks active count and clears wave on all deaths", () => {
		const waves: WaveEntry[][] = [[{ type: "basic", count: 2 }]];
		const { game, spawner } = setup(waves);
		const waveCleared = vi.fn();
		spawner.waveCleared.connect(waveCleared);
		spawner.start();
		step(game, 20); // spawn all
		expect(spawner.activeCount).toBe(2);

		spawner.notifyDeath();
		expect(spawner.activeCount).toBe(1);
		expect(waveCleared).not.toHaveBeenCalled();

		spawner.notifyDeath();
		expect(waveCleared).toHaveBeenCalledWith(0);
	});

	it("progresses through multiple waves", () => {
		const waves: WaveEntry[][] = [[{ type: "basic", count: 1 }], [{ type: "fast", count: 1 }]];
		const { game, spawner } = setup(waves);
		const waveStarted = vi.fn();
		const spawnRequested = vi.fn();
		spawner.waveStarted.connect(waveStarted);
		spawner.spawnRequested.connect(spawnRequested);

		spawner.start();
		step(game, 10); // spawn wave 0
		spawner.notifyDeath(); // clear wave 0

		// wavePause = 0.2s → ~12 frames
		step(game, 15);
		expect(waveStarted).toHaveBeenCalledWith(1);
		step(game, 10); // spawn wave 1
		expect(spawnRequested).toHaveBeenCalledWith(expect.objectContaining({ type: "fast", wave: 1 }));
	});

	it("emits allCleared after last wave", () => {
		const waves: WaveEntry[][] = [[{ type: "basic", count: 1 }]];
		const { game, spawner } = setup(waves);
		const allCleared = vi.fn();
		spawner.allCleared.connect(allCleared);

		spawner.start();
		step(game, 10);
		spawner.notifyDeath();
		expect(allCleared).toHaveBeenCalledOnce();
		expect(spawner.isComplete()).toBe(true);
	});

	it("handles multiple entry types in one wave", () => {
		const waves: WaveEntry[][] = [
			[
				{ type: "basic", count: 2 },
				{ type: "fast", count: 1 },
			],
		];
		const { game, spawner } = setup(waves);
		const handler = vi.fn();
		spawner.spawnRequested.connect(handler);
		spawner.start();
		step(game, 40);
		expect(handler).toHaveBeenCalledTimes(3);

		const types = handler.mock.calls.map(
			(c: [{ type: string; wave: number; index: number }]) => c[0].type,
		);
		expect(types).toEqual(["basic", "basic", "fast"]);
	});

	it("supports per-entry delay override", () => {
		const waves: WaveEntry[][] = [
			[{ type: "slow", count: 2, delay: 0.5 }], // 0.5s between spawns
		];
		const { game, spawner } = setup(waves);
		const handler = vi.fn();
		spawner.spawnRequested.connect(handler);
		spawner.start();

		// 0.5s delay at 60fps = 30 frames per spawn
		// After 15 frames (~0.25s), no spawn yet
		step(game, 15);
		expect(handler).toHaveBeenCalledTimes(0);

		// After 31 frames total (~0.517s), first spawn
		step(game, 16);
		expect(handler).toHaveBeenCalledTimes(1);

		// After 62 frames total (~1.03s), second spawn
		step(game, 31);
		expect(handler).toHaveBeenCalledTimes(2);
	});

	it("autoStart begins on ready", () => {
		const waves: WaveEntry[][] = [[{ type: "basic", count: 1 }]];
		_resetNodeIdCounter();
		const canvas = document.createElement("canvas");
		const game2 = new Game({ width: 100, height: 100, canvas, renderer: null });
		let spawner2!: WaveSpawner;

		class TestScene2 extends Scene {
			override onReady() {
				// Create, configure, then add — so autoStart fires with waves defined
				const s = new WaveSpawner();
				s.autoStart = true;
				s.spawnInterval = 0.1;
				s.defineWaves(waves);
				this.add(s);
				spawner2 = s;
			}
		}
		game2.registerScenes({ test: TestScene2 });
		game2.start("test");
		game2.step();
		// autoStart should have started — spawner is now spawning
		expect(spawner2.currentWave).toBe(0);
	});

	it("does nothing with empty waves", () => {
		const { spawner } = setup([]);
		const waveStarted = vi.fn();
		spawner.waveStarted.connect(waveStarted);
		spawner.start();
		expect(waveStarted).not.toHaveBeenCalled();
	});

	it("reports currentWave and totalWaves", () => {
		const waves: WaveEntry[][] = [
			[{ type: "a", count: 1 }],
			[{ type: "b", count: 1 }],
			[{ type: "c", count: 1 }],
		];
		const { spawner } = setup(waves);
		expect(spawner.totalWaves).toBe(3);
		expect(spawner.currentWave).toBe(-1);
		spawner.start();
		expect(spawner.currentWave).toBe(0);
	});

	it("notifyDeath does not go below 0", () => {
		const waves: WaveEntry[][] = [[{ type: "basic", count: 1 }]];
		const { game, spawner } = setup(waves);
		spawner.start();
		step(game, 10);
		spawner.notifyDeath();
		spawner.notifyDeath(); // extra
		expect(spawner.activeCount).toBe(0);
	});

	it("stops ticking after allCleared", () => {
		const waves: WaveEntry[][] = [[{ type: "basic", count: 1 }]];
		const { game, spawner } = setup(waves);
		const handler = vi.fn();
		spawner.spawnRequested.connect(handler);
		spawner.start();
		step(game, 10);
		spawner.notifyDeath();
		expect(spawner.isComplete()).toBe(true);

		// Further steps should not emit
		handler.mockClear();
		step(game, 60);
		expect(handler).not.toHaveBeenCalled();
	});

	it("handles wave with zero-count entries", () => {
		const waves: WaveEntry[][] = [
			[
				{ type: "empty", count: 0 },
				{ type: "basic", count: 1 },
			],
		];
		const { game, spawner } = setup(waves);
		const handler = vi.fn();
		spawner.spawnRequested.connect(handler);
		spawner.start();
		step(game, 20);
		// Should skip the empty entry and spawn the basic one
		const types = handler.mock.calls.map(
			(c: [{ type: string; wave: number; index: number }]) => c[0].type,
		);
		expect(types).toContain("basic");
	});
});
