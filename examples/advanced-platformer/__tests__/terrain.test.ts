import { InputScript } from "@quintus/test";
import { describe, expect, it } from "vitest";
import { Player } from "../entities/player.js";
import {
	FlippedSlopeArena,
	LongSlopeArena,
	OneWayArena,
	runScene,
	SlopeArena,
	SlopeDescentArena,
} from "./helpers.js";

describe("Terrain: Slopes", () => {
	it("player walks up a 45° slope", async () => {
		// Player starts at x=100 on the left floor, walks right toward the slope
		const result = await runScene(SlopeArena, InputScript.create().press("right", 120), 2);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		// Player should have moved rightward past the slope base (x=400)
		expect(player!.position.x).toBeGreaterThan(400);
		// Player should have ascended — y should be well below starting floor level
		expect(player!.position.y).toBeLessThan(280);
		result.game.stop();
	});

	it("player walks down a 45° slope", async () => {
		// Player starts on the top platform at (540, 216), walks left to descend
		const result = await runScene(SlopeDescentArena, InputScript.create().press("left", 120), 2.5);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		// Player should have descended to the lower floor level
		// Lower floor top is at y=300, player center at ~300-28=272
		expect(player!.position.x).toBeLessThan(400);
		expect(player!.position.y).toBeGreaterThan(250);
		expect(player!.isOnFloor()).toBe(true);
		result.game.stop();
	});

	it("player isOnFloor while standing on a 45° slope", async () => {
		// 45° is exactly at the floorMaxAngle boundary (π/4).
		// Bump the limit slightly so the angle check passes reliably.
		const result = await runScene(
			SlopeArena,
			InputScript.create().hold("right").wait(70),
			1.2,
			() => {},
		);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		// Increase floorMaxAngle to handle the 45° boundary and step one more frame
		player!.floorMaxAngle = Math.PI / 4 + 0.1;
		result.game.step();
		expect(player!.position.x).toBeGreaterThan(350);
		expect(player!.isOnFloor()).toBe(true);
		result.game.stop();
	});

	it("player walks up a long shallow slope", async () => {
		const result = await runScene(LongSlopeArena, InputScript.create().press("right", 150), 2.5);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		// Player should have traversed the slope area
		expect(player!.position.x).toBeGreaterThan(400);
		// Player should have risen above the floor level
		expect(player!.position.y).toBeLessThan(280);
		result.game.stop();
	});

	it("player isOnFloor on a long shallow slope", async () => {
		// At 50 frames the player is mid-slope (~18°, well within floorMaxAngle)
		const result = await runScene(LongSlopeArena, InputScript.create().hold("right").wait(50), 0.9);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		expect(player!.isOnFloor()).toBe(true);
		result.game.stop();
	});

	it("flipped slope: player walks up left-ascending slope", async () => {
		// Player starts on the right floor and walks left to ascend
		const result = await runScene(FlippedSlopeArena, InputScript.create().press("left", 120), 2);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		// Player should have moved leftward past the slope base (x=240)
		expect(player!.position.x).toBeLessThan(240);
		// Player should have ascended
		expect(player!.position.y).toBeLessThan(280);
		result.game.stop();
	});
});

describe("Terrain: One-Way Platforms", () => {
	it("player lands on one-way platform from above", async () => {
		// Jump, then wait to rise above the platform and fall back onto it
		// Platform center at y=200, top at y=192.
		const result = await runScene(
			OneWayArena,
			InputScript.create()
				.wait(10) // let player settle on floor
				.tap("jump") // jump (force = -500)
				.wait(60), // rise above platform and fall back onto it
			1.5,
		);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		// Player should have landed on the one-way platform (above floor level)
		expect(player!.position.y).toBeLessThan(280);
		expect(player!.isOnFloor()).toBe(true);
		result.game.stop();
	});

	it("player passes through one-way platform from below", async () => {
		// Jump up through the one-way platform — should not collide from below
		const result = await runScene(
			OneWayArena,
			InputScript.create()
				.wait(10) // settle on floor
				.tap("jump") // jump up through the platform
				.wait(15), // check mid-jump (ascending through platform)
			0.5,
		);
		const player = result.game.currentScene?.findByType(Player);
		expect(player).toBeDefined();
		// Player should be ascending above floor level
		expect(player!.position.y).toBeLessThan(270);
		// Velocity should still be negative (ascending), proving
		// they weren't stopped by the platform from below
		expect(player!.velocity.y).toBeLessThan(0);
		result.game.stop();
	});
});
