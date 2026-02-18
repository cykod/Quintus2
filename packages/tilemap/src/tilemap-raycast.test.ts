import { Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { describe, expect, it, vi } from "vitest";
import type { TiledMap } from "./tiled-types.js";
import { TileMap } from "./tilemap.js";

/**
 * 5x5 grid, 16px tiles:
 * Row 0: 0 0 0 0 0
 * Row 1: 0 0 1 0 0
 * Row 2: 0 1 1 1 0
 * Row 3: 0 0 1 0 0
 * Row 4: 0 0 0 0 0
 */
function makeTiledJSON(): TiledMap {
	return {
		width: 5,
		height: 5,
		tilewidth: 16,
		tileheight: 16,
		tilesets: [
			{
				firstgid: 1,
				name: "terrain",
				tilewidth: 16,
				tileheight: 16,
				image: "tiles.png",
				imagewidth: 160,
				imageheight: 160,
				columns: 10,
				tilecount: 100,
			},
		],
		layers: [
			{
				name: "ground",
				type: "tilelayer",
				width: 5,
				height: 5,
				data: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
			},
		],
	};
}

/** Fully solid 3x3 grid */
function makeSolidJSON(): TiledMap {
	return {
		width: 3,
		height: 3,
		tilewidth: 16,
		tileheight: 16,
		tilesets: [
			{
				firstgid: 1,
				name: "terrain",
				tilewidth: 16,
				tileheight: 16,
				image: "tiles.png",
				imagewidth: 160,
				imageheight: 160,
				columns: 10,
				tilecount: 100,
			},
		],
		layers: [
			{
				name: "ground",
				type: "tilelayer",
				width: 3,
				height: 3,
				data: [1, 1, 1, 1, 1, 1, 1, 1, 1],
			},
		],
	};
}

function createTestGame(): Game {
	return new Game({
		width: 320,
		height: 240,
		canvas: document.createElement("canvas"),
		renderer: null,
	});
}

function setupTileMap(game: Game, json?: TiledMap, pos?: Vec2): TileMap {
	const data = json ?? makeTiledJSON();
	game.assets._storeJSON("level1", data);

	let tileMap: TileMap | undefined;
	const offset = pos;
	class TestScene extends Scene {
		onReady() {
			const map = this.add(TileMap);
			if (offset) map.position = offset;
			map.asset = "level1";
			tileMap = map;
		}
	}
	game.start(TestScene);
	if (!tileMap) throw new Error("TileMap not created");
	return tileMap;
}

describe("TileMap.raycast (DDA)", () => {
	it("horizontal ray hits first solid tile", () => {
		const game = createTestGame();
		const map = setupTileMap(game);

		// Cast from left side of row 2 heading right
		// Row 2: 0 1 1 1 0 → first solid at col=1 (x=16..32)
		const hit = map.raycast(new Vec2(0, 2 * 16 + 8), new Vec2(1, 0));
		expect(hit).not.toBeNull();
		expect(hit?.col).toBe(1);
		expect(hit?.row).toBe(2);
		expect(hit?.tileId).toBe(0); // localId = data(1) - firstgid(1) = 0
	});

	it("vertical ray hits first solid tile", () => {
		const game = createTestGame();
		const map = setupTileMap(game);

		// Cast downward through col=2 → first solid at row=1
		const hit = map.raycast(new Vec2(2 * 16 + 8, 0), new Vec2(0, 1));
		expect(hit).not.toBeNull();
		expect(hit?.col).toBe(2);
		expect(hit?.row).toBe(1);
	});

	it("diagonal ray traverses correctly", () => {
		const game = createTestGame();
		const map = setupTileMap(game);

		// Cast diagonally from top-left toward center
		const hit = map.raycast(new Vec2(0, 0), new Vec2(1, 1));
		expect(hit).not.toBeNull();
		// Should hit one of the solid tiles (localId = 0)
		expect(hit?.tileId).toBe(0);
	});

	it("ray misses (no solid tiles in path) returns null", () => {
		const game = createTestGame();
		const map = setupTileMap(game);

		// Cast along row 0 (all empty) heading right
		const hit = map.raycast(new Vec2(0, 4), new Vec2(1, 0), 200);
		expect(hit).toBeNull();
	});

	it("ray respects maxDistance", () => {
		const game = createTestGame();
		const map = setupTileMap(game);

		// First solid in row 2 is at col=1 (x=16), but limit to 10px
		const hit = map.raycast(new Vec2(0, 2 * 16 + 8), new Vec2(1, 0), 10);
		expect(hit).toBeNull();
	});

	it("hit point is on the tile boundary (not tile center)", () => {
		const game = createTestGame();
		const map = setupTileMap(game);

		// Cast from left into col=1 at row=2
		const hit = map.raycast(new Vec2(0, 2 * 16 + 8), new Vec2(1, 0));
		expect(hit).not.toBeNull();
		// Hit point x should be at the left edge of col=1 = 16
		expect(hit?.point.x).toBeCloseTo(16, 1);
	});

	it("normal points outward from the hit tile face", () => {
		const game = createTestGame();
		const map = setupTileMap(game);

		// Hitting from the left → normal should be (-1, 0)
		const hit = map.raycast(new Vec2(0, 2 * 16 + 8), new Vec2(1, 0));
		expect(hit).not.toBeNull();
		expect(hit?.normal.x).toBe(-1);
		expect(hit?.normal.y).toBe(0);
	});

	it("custom solidCheck filters specific tile types", () => {
		const game = createTestGame();

		// Use a map with different tile IDs
		const json: TiledMap = {
			...makeTiledJSON(),
			layers: [
				{
					name: "ground",
					type: "tilelayer",
					width: 5,
					height: 5,
					// Row 2: 0, 2, 1, 3, 0 → id=2 at col=1, id=1 at col=2, id=3 at col=3
					data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				},
			],
		};
		const map = setupTileMap(game, json);

		// Only treat localId=2 (data=3) as solid
		// data: 0→-1, 2→1, 1→0, 3→2
		const hit = map.raycast(
			new Vec2(0, 2 * 16 + 8),
			new Vec2(1, 0),
			10000,
			(tileId) => tileId === 2,
		);
		expect(hit).not.toBeNull();
		expect(hit?.col).toBe(3);
		expect(hit?.tileId).toBe(2);
	});

	it("ray starting inside a solid tile returns that tile at distance 0", () => {
		const game = createTestGame();
		const map = setupTileMap(game, makeSolidJSON());

		// Start inside tile (1,1)
		const hit = map.raycast(new Vec2(1 * 16 + 8, 1 * 16 + 8), new Vec2(1, 0));
		expect(hit).not.toBeNull();
		expect(hit?.col).toBe(1);
		expect(hit?.row).toBe(1);
		expect(hit?.distance).toBe(0);
	});

	it("works with non-zero TileMap position offset", () => {
		const game = createTestGame();
		// Offset tilemap by (100, 50)
		const map = setupTileMap(game, undefined, new Vec2(100, 50));

		// Row 2 in world space: y = 50 + 2*16 + 8 = 90
		// First solid at col=1: x = 100 + 16 = 116
		const hit = map.raycast(new Vec2(100, 50 + 2 * 16 + 8), new Vec2(1, 0));
		expect(hit).not.toBeNull();
		expect(hit?.col).toBe(1);
		expect(hit?.row).toBe(2);
	});

	it("returns null and warns when TileMap has rotation transform", () => {
		const game = createTestGame();
		const map = setupTileMap(game);
		map.rotation = Math.PI / 4;

		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const hit = map.raycast(new Vec2(0, 0), new Vec2(1, 0));
		expect(hit).toBeNull();
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("only supports translation transforms"),
		);
		warnSpy.mockRestore();
	});

	it("returns null and warns when TileMap has non-uniform scale", () => {
		const game = createTestGame();
		const map = setupTileMap(game);
		map.scale = new Vec2(2, 1);

		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const hit = map.raycast(new Vec2(0, 0), new Vec2(1, 0));
		expect(hit).toBeNull();
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("only supports translation transforms"),
		);
		warnSpy.mockRestore();
	});
});
