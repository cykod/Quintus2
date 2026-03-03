import { describe, expect, it } from "vitest";
import { Bee } from "../entities/enemies/bee.js";
import { Frog } from "../entities/enemies/frog.js";
import { Saw } from "../entities/enemies/saw.js";
import { Slime } from "../entities/enemies/slime.js";
import { Snail } from "../entities/enemies/snail.js";
import { Player } from "../entities/player.js";
import { Level1Scene } from "../scenes/test-scene.js";
import { ENEMY_TILE_IDS } from "../scenes/test-scene.js";
import { runSceneWithMaps } from "./helpers.js";

describe("Level1Scene — tile-layer enemy spawning", () => {
	it("spawns enemies from the enemies tile layer", async () => {
		const result = await runSceneWithMaps(Level1Scene, undefined, 0.05);
		const scene = result.game.currentScene!;

		// Verify each enemy type was spawned
		const slimes = scene.findAllByType(Slime);
		const bees = scene.findAllByType(Bee);
		const snails = scene.findAllByType(Snail);
		const frogs = scene.findAllByType(Frog);
		const saws = scene.findAllByType(Saw);

		expect(slimes.length).toBe(2);
		expect(bees.length).toBe(1);
		expect(snails.length).toBe(1);
		expect(frogs.length).toBe(1);
		expect(saws.length).toBe(1);

		result.game.stop();
	});

	it("places enemies near tile-center positions from TMX data", async () => {
		const result = await runSceneWithMaps(Level1Scene, undefined, 0.05);
		const scene = result.game.currentScene!;

		// Enemies are spawned at tile centers (col * 64 + 32, row * 64 + 32)
		// then move slightly due to physics/patrol during the 0.05s simulation.
		// Use ±10px tolerance to account for movement.

		// Slime1 at col 8, row 6 → spawned at (544, 416)
		// Slime2 at col 11, row 6 → spawned at (736, 416)
		const slimes = scene.findAllByType(Slime);
		const slimeXs = slimes.map((s) => s.position.x).sort((a, b) => a - b);
		expect(slimeXs[0]).toBeGreaterThan(534);
		expect(slimeXs[0]).toBeLessThan(554);
		expect(slimeXs[1]).toBeGreaterThan(726);
		expect(slimeXs[1]).toBeLessThan(746);

		// Bee at col 15, row 4 → spawned at (992, 288). No gravity, sine wave.
		const bee = scene.findAllByType(Bee)[0]!;
		expect(bee.position.x).toBeGreaterThan(980);
		expect(bee.position.x).toBeLessThan(1010);

		// Snail at col 18, row 6 → spawned at (1184, 416)
		const snail = scene.findAllByType(Snail)[0]!;
		expect(snail.position.x).toBeGreaterThan(1174);
		expect(snail.position.x).toBeLessThan(1194);

		// Frog at col 24, row 6 → spawned at (1568, 416)
		const frog = scene.findAllByType(Frog)[0]!;
		expect(frog.position.x).toBeGreaterThan(1558);
		expect(frog.position.x).toBeLessThan(1578);

		// Saw at col 31, row 5 → spawned at (2016, 352)
		const saw = scene.findAllByType(Saw)[0]!;
		expect(saw.position.x).toBeGreaterThan(2006);
		expect(saw.position.x).toBeLessThan(2026);

		result.game.stop();
	});

	it("configures saw pathEnd relative to spawn position", async () => {
		const result = await runSceneWithMaps(Level1Scene, undefined, 0.05);
		const scene = result.game.currentScene!;

		const saw = scene.findAllByType(Saw)[0]!;
		// Saw spawned at col 31, row 5 → (2016, 352)
		// pathEnd set to spawn_x + 200 = 2216, spawn_y = 352
		expect(saw.pathEnd.x).toBe(2216);
		expect(saw.pathEnd.y).toBe(352);

		result.game.stop();
	});

	it("player is still spawned at the object-layer spawn point", async () => {
		const result = await runSceneWithMaps(Level1Scene, undefined, 0.05);
		const scene = result.game.currentScene!;

		const player = scene.findByType(Player)!;
		expect(player).toBeDefined();
		// player_start object at (128, 384); getSpawnPoint returns (x, y) directly
		// Player may have moved slightly due to physics, so allow tolerance
		expect(player.position.x).toBeGreaterThan(120);
		expect(player.position.x).toBeLessThan(140);

		result.game.stop();
	});

	it("ENEMY_TILE_IDS exports the correct tile ID constants", () => {
		expect(ENEMY_TILE_IDS.slime).toBe(44);
		expect(ENEMY_TILE_IDS.bee).toBe(3);
		expect(ENEMY_TILE_IDS.snail).toBe(52);
		expect(ENEMY_TILE_IDS.frog).toBe(21);
		expect(ENEMY_TILE_IDS.saw).toBe(31);
	});
});
