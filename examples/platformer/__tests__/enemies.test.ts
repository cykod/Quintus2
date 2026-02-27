import { Vec2 } from "@quintus/math";
import { describe, expect, it } from "vitest";
import { FlyingEnemy } from "../entities/flying-enemy.js";
import { PatrolEnemy } from "../entities/patrol-enemy.js";
import { gameState } from "../state.js";
import { runArena, Wall } from "./helpers.js";

describe("PatrolEnemy", () => {
	it("patrols and reverses at walls", async () => {
		const result = await runArena(undefined, 0.1);
		const scene = result.game.currentScene!;

		// Add a patrol enemy on the floor
		const enemy = scene.add(PatrolEnemy);
		enemy.position = new Vec2(160, 192);
		enemy.direction = 1;

		// Add a wall to the right (collisionGroup set in class override)
		const wall = scene.add(Wall);
		wall.position = new Vec2(200, 192);

		// Step several frames so enemy hits the wall and reverses
		for (let i = 0; i < 120; i++) {
			result.game.step();
		}

		// Enemy should have reversed direction
		expect(enemy.direction).toBe(-1);
		result.game.stop();
	});

	it("stomp destroys enemy and awards score", async () => {
		const result = await runArena(undefined, 0.1);
		const scene = result.game.currentScene!;

		const enemy = scene.add(PatrolEnemy);
		enemy.position = new Vec2(160, 192);

		let diedEmitted = false;
		enemy.died.connect(() => {
			diedEmitted = true;
		});

		const initialScore = gameState.score;
		enemy.stomp();

		expect(diedEmitted).toBe(true);
		expect(gameState.score).toBe(initialScore + 100);

		// Let the death tween complete
		for (let i = 0; i < 30; i++) {
			result.game.step();
		}
		result.game.stop();
	});
});

describe("FlyingEnemy", () => {
	it("oscillates vertically via sine wave", async () => {
		const result = await runArena(undefined, 0.1);
		const scene = result.game.currentScene!;

		const enemy = scene.add(FlyingEnemy);
		enemy.position = new Vec2(100, 100);

		const yValues: number[] = [];

		// Collect y values over 60 frames (1 second)
		for (let i = 0; i < 60; i++) {
			result.game.step();
			yValues.push(enemy.position.y);
		}

		// The y position should oscillate (not stay constant)
		const minY = Math.min(...yValues);
		const maxY = Math.max(...yValues);
		expect(maxY - minY).toBeGreaterThan(5); // Noticeable oscillation
		result.game.stop();
	});

	it("stomp awards 200 points and emits died", async () => {
		const result = await runArena(undefined, 0.1);
		const scene = result.game.currentScene!;

		const enemy = scene.add(FlyingEnemy);
		enemy.position = new Vec2(100, 100);

		let diedEmitted = false;
		enemy.died.connect(() => {
			diedEmitted = true;
		});

		const initialScore = gameState.score;
		enemy.stomp();

		expect(diedEmitted).toBe(true);
		expect(gameState.score).toBe(initialScore + 200);

		// Let the death tween complete
		for (let i = 0; i < 30; i++) {
			result.game.step();
		}
		result.game.stop();
	});
});
