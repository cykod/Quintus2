import { Scene } from "@quintus/core";
import { describe, expect, it } from "vitest";
import {
	BASIC_CREEP_GOLD,
	BASIC_CREEP_HP,
	BASIC_CREEP_SPEED,
	FAST_CREEP_SPEED,
	TANK_CREEP_HP,
	TANK_CREEP_SPEED,
} from "../config.js";
import { BasicCreep } from "../entities/basic-creep.js";
import { FastCreep } from "../entities/fast-creep.js";
import { TankCreep } from "../entities/tank-creep.js";
import { runScene, TEST_PATH } from "./helpers.js";

class EnemyTestScene extends Scene {}

describe("Enemies", () => {
	it("BasicCreep has correct stats", async () => {
		const result = await runScene(EnemyTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const creep = new BasicCreep();
		creep.pathDef = TEST_PATH;
		scene.add(creep);
		result.game.step();

		expect(creep.hp).toBe(BASIC_CREEP_HP);
		expect(creep.speed).toBe(BASIC_CREEP_SPEED);
		expect(creep.goldReward).toBe(BASIC_CREEP_GOLD);
	});

	it("FastCreep moves faster than BasicCreep", async () => {
		const result = await runScene(EnemyTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const fast = new FastCreep();
		fast.pathDef = TEST_PATH;
		scene.add(fast);
		result.game.step();

		expect(fast.speed).toBe(FAST_CREEP_SPEED);
		expect(FAST_CREEP_SPEED).toBeGreaterThan(BASIC_CREEP_SPEED);
	});

	it("TankCreep has more HP", async () => {
		const result = await runScene(EnemyTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const tank = new TankCreep();
		tank.pathDef = TEST_PATH;
		scene.add(tank);
		result.game.step();

		expect(tank.hp).toBe(TANK_CREEP_HP);
		expect(TANK_CREEP_HP).toBeGreaterThan(BASIC_CREEP_HP);
		expect(tank.speed).toBe(TANK_CREEP_SPEED);
	});

	it("enemy emits died signal and is destroyed when hp reaches 0", async () => {
		const result = await runScene(EnemyTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const creep = new BasicCreep();
		creep.pathDef = TEST_PATH;
		scene.add(creep);
		result.game.step();

		let diedEmitted = false;
		creep.died.connect(() => {
			diedEmitted = true;
		});

		creep.takeDamage(creep.hp);
		expect(diedEmitted).toBe(true);
	});

	it("enemy slow effect reduces speed", async () => {
		const result = await runScene(EnemyTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const creep = new BasicCreep();
		creep.pathDef = TEST_PATH;
		scene.add(creep);
		result.game.step();

		creep.applySlow(0.5, 2.0);
		expect(creep.slowMultiplier).toBe(0.5);
	});

	it("slow effect wears off after duration", async () => {
		const result = await runScene(EnemyTestScene, undefined, 0.01);
		const scene = result.game.currentScene!;

		const creep = new BasicCreep();
		creep.pathDef = TEST_PATH;
		scene.add(creep);
		result.game.step();

		creep.applySlow(0.5, 0.5); // 0.5 second duration

		// Run for ~1 second (60 frames at 60fps)
		for (let i = 0; i < 60; i++) {
			result.game.step();
		}

		expect(creep.slowMultiplier).toBe(1);
	});
});
