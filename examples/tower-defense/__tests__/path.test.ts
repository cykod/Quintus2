import { Scene } from "@quintus/core";
import { describe, expect, it } from "vitest";
import { BASIC_CREEP_SPEED } from "../config.js";
import { BasicCreep } from "../entities/basic-creep.js";
import { gridToWorld, LEVEL1_PATH } from "../path.js";
import { runScene } from "./helpers.js";

class PathTestScene extends Scene {}

describe("Path following", () => {
	it("enemy starts at first waypoint", async () => {
		const result = await runScene(PathTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const creep = new BasicCreep();
		creep.pathDef = LEVEL1_PATH;
		scene.add(creep);
		result.game.step();

		const start = gridToWorld(LEVEL1_PATH.waypoints[0]?.x, LEVEL1_PATH.waypoints[0]?.y);
		expect(Math.abs(creep.position.x - start.x)).toBeLessThan(5);
		expect(Math.abs(creep.position.y - start.y)).toBeLessThan(5);
	});

	it("enemy follows waypoints in order", async () => {
		const result = await runScene(PathTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const creep = new BasicCreep();
		creep.pathDef = LEVEL1_PATH;
		scene.add(creep);
		result.game.step();

		expect(creep.waypointIndex).toBe(1);

		// Run enough frames to reach second waypoint
		for (let i = 0; i < 300; i++) {
			result.game.step();
		}

		// Should have advanced past waypoint 1
		expect(creep.waypointIndex).toBeGreaterThan(1);
	});

	it("enemy signals reachedExit when path complete", async () => {
		const result = await runScene(PathTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const creep = new BasicCreep();
		creep.pathDef = LEVEL1_PATH;
		// Give it a very high speed to traverse quickly
		creep.speed = 5000;
		scene.add(creep);

		let exitReached = false;
		creep.reachedExit.connect(() => {
			exitReached = true;
		});

		// Run enough frames for the speedy creep to traverse the whole path
		for (let i = 0; i < 300; i++) {
			result.game.step();
		}

		expect(exitReached).toBe(true);
	});

	it("speed affects traversal time", async () => {
		const result = await runScene(PathTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		// Normal speed creep
		const slow = new BasicCreep();
		slow.pathDef = LEVEL1_PATH;
		scene.add(slow);

		// Fast creep
		const fast = new BasicCreep();
		fast.pathDef = LEVEL1_PATH;
		fast.speed = BASIC_CREEP_SPEED * 3;
		scene.add(fast);

		result.game.step();

		for (let i = 0; i < 120; i++) {
			result.game.step();
		}

		// Fast creep should be further along
		expect(fast.waypointIndex).toBeGreaterThanOrEqual(slow.waypointIndex);
	});
});
