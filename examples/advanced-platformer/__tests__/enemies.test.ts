import { Vec2 } from "@quintus/math";
import { Sensor } from "@quintus/physics";
import { describe, expect, it } from "vitest";
import { Bee } from "../entities/enemies/bee.js";
import { Frog } from "../entities/enemies/frog.js";
import { Saw } from "../entities/enemies/saw.js";
import { Slime } from "../entities/enemies/slime.js";
import { Snail } from "../entities/enemies/snail.js";
import { Player } from "../entities/player.js";
import { gameState } from "../state.js";
import { HalfFloorEnemyArena, runEnemyArena, runScene } from "./helpers.js";

// ── Slime tests ─────────────────────────────────────────────────

describe("Slime", () => {
	it("patrols and reverses at wall", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const slime = scene.add(Slime);
		// Place slime away from player (player is at 320,280) to avoid collision
		slime.position = new Vec2(450, 270);
		slime.direction = 1;

		// Let it settle on floor first
		for (let i = 0; i < 30; i++) result.game.step();

		const xBefore = slime.position.x;
		// Step for slime to move right
		for (let i = 0; i < 30; i++) result.game.step();
		expect(slime.position.x).toBeGreaterThan(xBefore);

		// Push slime near the right wall (wall center at x=632, half-width=8)
		slime.position.x = 605;
		for (let i = 0; i < 30; i++) result.game.step();

		// Should have reversed direction
		expect(slime.direction).toBe(-1);
		result.game.stop();
	});

	it("reverses at platform edge", async () => {
		const result = await runScene(HalfFloorEnemyArena, undefined, 0.1);
		const scene = result.game.currentScene!;
		const slime = scene.add(Slime);
		// Place near the right edge of the half floor (extends from -50 to 350)
		slime.position = new Vec2(280, 280);
		slime.direction = 1;

		// Step frames — slime should detect edge and reverse
		for (let i = 0; i < 60; i++) result.game.step();

		expect(slime.direction).toBe(-1);
		result.game.stop();
	});

	it("stomp() awards 100 pts, emits died, and destroys after tween", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const slime = scene.add(Slime);
		slime.position = new Vec2(400, 280);

		// Let it settle
		for (let i = 0; i < 5; i++) result.game.step();

		const initialScore = gameState.score;
		let diedEmitted = false;
		slime.died.connect(() => {
			diedEmitted = true;
		});

		slime.stomp();

		expect(gameState.score).toBe(initialScore + 100);
		expect(diedEmitted).toBe(true);

		// Advance past tween (0.15s ≈ 9 frames at 60fps) + margin
		for (let i = 0; i < 15; i++) result.game.step();

		expect(slime.isDestroyed).toBe(true);
		result.game.stop();
	});

	it("double stomp is ignored", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const slime = scene.add(Slime);
		slime.position = new Vec2(400, 280);

		for (let i = 0; i < 5; i++) result.game.step();

		const initialScore = gameState.score;
		slime.stomp();
		expect(gameState.score).toBe(initialScore + 100);

		// Second stomp should be ignored
		slime.stomp();
		expect(gameState.score).toBe(initialScore + 100);

		result.game.stop();
	});
});

// ── Bee tests ───────────────────────────────────────────────────

describe("Bee", () => {
	it("oscillates vertically while moving horizontally", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const bee = scene.add(Bee);
		bee.position = new Vec2(320, 150);

		const startY = bee.position.y;
		let minY = startY;
		let maxY = startY;

		// Run 90 frames (~1.5s at 60fps) — enough for a full sine cycle
		for (let i = 0; i < 90; i++) {
			result.game.step();
			minY = Math.min(minY, bee.position.y);
			maxY = Math.max(maxY, bee.position.y);
		}

		// Should have oscillated at least ±20 pixels (amplitude is 40)
		const range = maxY - minY;
		expect(range).toBeGreaterThan(20);

		result.game.stop();
	});

	it("reverses horizontal direction at wall", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const bee = scene.add(Bee);
		// Place near left wall, moving left
		bee.position = new Vec2(40, 150);
		bee.direction = -1;

		for (let i = 0; i < 30; i++) result.game.step();

		expect(bee.direction).toBe(1);
		result.game.stop();
	});

	it("stomp() awards 150 pts", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const bee = scene.add(Bee);
		bee.position = new Vec2(300, 150);

		for (let i = 0; i < 5; i++) result.game.step();

		const initialScore = gameState.score;
		bee.stomp();
		expect(gameState.score).toBe(initialScore + 150);

		result.game.stop();
	});
});

// ── Snail tests ─────────────────────────────────────────────────

describe("Snail", () => {
	it("walking → shell on first stomp (awards score)", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const snail = scene.add(Snail);
		snail.position = new Vec2(400, 280);

		for (let i = 0; i < 5; i++) result.game.step();

		expect(snail.state).toBe("walking");
		const initialScore = gameState.score;

		snail.stomp();

		expect(snail.state).toBe("shell");
		expect(gameState.score).toBe(initialScore + 200);
		expect(snail.isDestroyed).toBe(false);

		result.game.stop();
	});

	it("shell → kicked on second stomp (velocity = shellSpeed)", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const snail = scene.add(Snail);
		snail.position = new Vec2(400, 280);
		snail.direction = 1;

		for (let i = 0; i < 5; i++) result.game.step();

		snail.stomp(); // walking → shell
		snail.stomp(); // shell → kicked

		expect(snail.state).toBe("kicked");
		expect(snail.velocity.x).toBe(snail.shellSpeed * snail.direction);

		result.game.stop();
	});

	it("kicked → stopped on third stomp (velocity = 0)", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const snail = scene.add(Snail);
		snail.position = new Vec2(400, 280);

		for (let i = 0; i < 5; i++) result.game.step();

		snail.stomp(); // walking → shell
		snail.stomp(); // shell → kicked
		snail.stomp(); // kicked → stopped

		expect(snail.state).toBe("stopped");
		expect(snail.velocity.x).toBe(0);

		result.game.stop();
	});

	it("kicked shell bounces off wall", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const snail = scene.add(Snail);
		// Place near right wall, kick rightward
		snail.position = new Vec2(600, 280);
		snail.direction = 1;

		for (let i = 0; i < 5; i++) result.game.step();

		snail.stomp(); // walking → shell
		snail.stomp(); // shell → kicked (rightward)

		expect(snail.state).toBe("kicked");

		// Run frames until it hits the wall and reverses
		for (let i = 0; i < 30; i++) result.game.step();

		expect(snail.direction).toBe(-1);
		result.game.stop();
	});
});

// ── Frog tests ──────────────────────────────────────────────────

describe("Frog", () => {
	it("jumps upward after jumpInterval elapses", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const frog = scene.add(Frog);
		frog.position = new Vec2(200, 270);
		frog.jumpInterval = 0.3; // short interval for testing

		// Track minimum y (highest point) over many frames
		let minY = frog.position.y;
		for (let i = 0; i < 120; i++) {
			result.game.step();
			minY = Math.min(minY, frog.position.y);
		}

		// Frog should have jumped at least once, reaching a y significantly above start
		// jumpForce = -400 should launch it well above 270
		expect(minY).toBeLessThan(250);

		result.game.stop();
	});

	it("jumps toward player direction", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const player = scene.findByType(Player)!;
		const frog = scene.add(Frog);

		// Place frog to the right of player
		player.position = new Vec2(200, 280);
		frog.position = new Vec2(450, 280);
		frog.jumpInterval = 0.3;

		// Let settle
		for (let i = 0; i < 10; i++) result.game.step();

		// Advance past jump timer
		for (let i = 0; i < 25; i++) result.game.step();

		// Frog should jump leftward (toward player)
		expect(frog.position.x).toBeLessThan(450);

		result.game.stop();
	});

	it("stomp() awards 250 pts", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const frog = scene.add(Frog);
		frog.position = new Vec2(200, 280);

		for (let i = 0; i < 5; i++) result.game.step();

		const initialScore = gameState.score;
		frog.stomp();
		expect(gameState.score).toBe(initialScore + 250);

		result.game.stop();
	});
});

// ── Saw tests ───────────────────────────────────────────────────

describe("Saw", () => {
	it("moves along path and reverses at endpoints", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const saw = scene.add(Saw);
		saw.position = new Vec2(200, 200);
		saw.pathEnd = new Vec2(250, 200); // very short path (50px)
		saw.speed = 300; // very fast for testing (50px / 300px/s = 0.167s ≈ 10 frames)

		// Let onReady run to capture pathStart
		result.game.step();

		// Track min and max x to verify oscillation
		let minX = saw.position.x;
		let maxX = saw.position.x;
		for (let i = 0; i < 60; i++) {
			result.game.step();
			minX = Math.min(minX, saw.position.x);
			maxX = Math.max(maxX, saw.position.x);
		}

		// Should have traveled forward and back
		expect(minX).toBeLessThanOrEqual(210); // near start
		expect(maxX).toBeGreaterThanOrEqual(235); // near end

		result.game.stop();
	});

	it("has sensor with enemy tag and hazards collision group", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const saw = scene.add(Saw);
		saw.position = new Vec2(500, 200);
		saw.pathEnd = new Vec2(600, 200);

		// Let saw enter tree and onReady fire
		result.game.step();

		// Verify the SawSensor child exists with correct configuration
		const sawSensor = saw.findAllByType(Sensor)[0]!;
		expect(sawSensor).toBeDefined();
		expect(sawSensor.collisionGroup).toBe("hazards");
		expect(sawSensor.hasTag("enemy")).toBe(true);
		expect(sawSensor.hasTag("saw_blade")).toBe(true);
		expect(sawSensor.monitoring).toBe(true);

		// Verify the saw itself is tagged
		expect(saw.hasTag("saw")).toBe(true);

		result.game.stop();
	});

	it("damages player on overlap", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const player = scene.findByType(Player)!;

		// Place saw directly on top of the player
		const saw = scene.add(Saw);
		saw.position = player.position.clone();
		saw.pathEnd = player.position.clone();

		const healthBefore = player.health;

		// Step frames for overlap detection to fire
		for (let i = 0; i < 10; i++) result.game.step();

		expect(player.health).toBeLessThan(healthBefore);

		result.game.stop();
	});
});

// ── Contact wiring tests ────────────────────────────────────────

describe("Enemy contact wiring (EnemyArena)", () => {
	it("star power kills enemy on any contact", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const player = scene.findByType(Player)!;
		const slime = scene.add(Slime);

		player.position = new Vec2(320, 280);
		slime.position = new Vec2(340, 280);

		// Activate star power
		player.activateStarPower(5);

		// Step to process contact
		for (let i = 0; i < 15; i++) result.game.step();

		// The slime should have been stomped via star power
		expect(slime._isDead || slime.isDestroyed).toBe(true);

		result.game.stop();
	});

	it("stomp from above bounces player", async () => {
		const result = await runEnemyArena(undefined, 0.1);
		const scene = result.game.currentScene!;
		const player = scene.findByType(Player)!;
		const slime = scene.add(Slime);

		// Place slime on floor, player above it falling down
		slime.position = new Vec2(320, 280);
		player.position = new Vec2(320, 220);
		player.velocity.y = 300;

		for (let i = 0; i < 30; i++) {
			result.game.step();
			if (slime._isDead) break;
		}

		expect(slime._isDead || slime.isDestroyed).toBe(true);
		expect(gameState.score).toBeGreaterThanOrEqual(100);

		result.game.stop();
	});
});
