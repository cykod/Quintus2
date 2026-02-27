import { Game, Node2D, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { CollisionShape, PhysicsPlugin, Shape, StaticCollider } from "@quintus/physics";
import { beforeAll, describe, expect, it } from "vitest";
import type { TiledMap } from "./tiled-types.js";
import { TileMap } from "./tilemap.js";

// Register physics factories for collision generation tests
beforeAll(() => {
	TileMap.registerPhysics({
		StaticCollider: StaticCollider as never,
		CollisionShape: CollisionShape as never,
		shapeRect: Shape.rect,
	});
});

function makeTiledJSON(overrides?: Partial<TiledMap>): TiledMap {
	return {
		width: 5,
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
				width: 5,
				height: 3,
				// Row 0: all empty
				// Row 1: tiles 1,0,0,0,3
				// Row 2: all tile 1 (ground)
				data: [0, 0, 0, 0, 0, 1, 0, 0, 0, 3, 1, 1, 1, 1, 1],
			},
			{
				name: "entities",
				type: "objectgroup",
				objects: [
					{
						id: 1,
						name: "player_start",
						type: "Player",
						x: 32,
						y: 16,
						width: 0,
						height: 0,
						point: true,
					},
					{
						id: 2,
						name: "coin1",
						type: "Coin",
						x: 64,
						y: 24,
						width: 16,
						height: 16,
						properties: [{ name: "value", type: "int", value: 10 }],
					},
					{
						id: 3,
						name: "coin2",
						type: "Coin",
						x: 48,
						y: 24,
						width: 16,
						height: 16,
					},
				],
			},
		],
		...overrides,
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

function setupTileMap(game: Game, json?: TiledMap): TileMap {
	const data = json ?? makeTiledJSON();
	game.assets._storeJSON("level1", data);

	let tileMap: TileMap | undefined;
	class TestScene extends Scene {
		onReady() {
			const map = this.add(TileMap);
			map.asset = "level1";
			tileMap = map;
		}
	}
	game.start(TestScene);
	if (!tileMap) throw new Error("TileMap not created — scene setup failed");
	return tileMap;
}

describe("TileMap", () => {
	describe("loading", () => {
		it("loads JSON from asset loader in onReady", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			expect(map.isLoaded).toBe(true);
			expect(map.mapWidth).toBe(5);
			expect(map.mapHeight).toBe(3);
			expect(map.tileWidth).toBe(16);
			expect(map.tileHeight).toBe(16);
		});

		it("throws on missing asset", () => {
			const game = createTestGame();
			expect(() => {
				class TestScene extends Scene {
					onReady() {
						const map = this.add(TileMap);
						map.asset = "nonexistent";
					}
				}
				game.start(TestScene);
			}).toThrow("Asset 'nonexistent' not found");
		});

		it("reports correct bounds", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			expect(map.bounds.width).toBe(80); // 5 * 16
			expect(map.bounds.height).toBe(48); // 3 * 16
		});
	});

	describe("getTileAt / setTileAt", () => {
		it("returns tile ID for populated cell", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			// Row 2, all tiles are ID 1 -> localId 0
			expect(map.getTileAt(0, 2)).toBe(0); // GID 1 -> localId 0
		});

		it("returns 0 for empty cell", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			expect(map.getTileAt(1, 0)).toBe(0);
		});

		it("returns 0 for out-of-bounds", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			expect(map.getTileAt(-1, 0)).toBe(0);
			expect(map.getTileAt(100, 0)).toBe(0);
			expect(map.getTileAt(0, 100)).toBe(0);
		});

		it("sets tile to a new ID", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			expect(map.getTileAt(1, 0)).toBe(0);
			map.setTileAt(1, 0, 5);
			expect(map.getTileAt(1, 0)).toBe(5);
		});

		it("clears tile when set to 0", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			expect(map.getTileAt(0, 2)).toBe(0); // has a tile
			map.setTileAt(0, 2, 0);
			expect(map.getTileAt(0, 2)).toBe(0);
		});

		it("can read from named layer", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			expect(map.getTileAt(0, 2, "ground")).toBe(0);
		});
	});

	describe("worldToTile / tileToWorld", () => {
		it("converts world position to tile coordinates", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			const tile = map.worldToTile(new Vec2(24, 40));
			expect(tile.x).toBe(1); // 24 / 16 = 1.5 -> floor = 1
			expect(tile.y).toBe(2); // 40 / 16 = 2.5 -> floor = 2
		});

		it("converts tile coordinates to world position", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			const world = map.tileToWorld(2, 1);
			expect(world.x).toBe(32); // 2 * 16
			expect(world.y).toBe(16); // 1 * 16
		});
	});

	describe("getSpawnPoint", () => {
		it("returns correct position", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			const pos = map.getSpawnPoint("player_start");
			expect(pos.x).toBe(32);
			expect(pos.y).toBe(16);
		});

		it("throws on missing spawn point", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			expect(() => map.getSpawnPoint("nonexistent")).toThrow("Spawn point 'nonexistent' not found");
		});
	});

	describe("getObjects", () => {
		it("returns all objects from named layer", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			const objects = map.getObjects("entities");
			expect(objects).toHaveLength(3);
		});

		it("returns empty array for missing layer", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			const objects = map.getObjects("nonexistent");
			expect(objects).toHaveLength(0);
		});
	});

	describe("spawnObjects", () => {
		it("creates nodes from type mapping", () => {
			const game = createTestGame();
			const map = setupTileMap(game);

			class Coin extends Node2D {}

			const spawned = map.spawnObjects("entities", { Coin });
			expect(spawned).toHaveLength(2); // Two Coin objects

			const coin1 = spawned[0] as Node2D;
			expect(coin1).toBeInstanceOf(Coin);
			expect(coin1.position.x).toBe(64);
			expect(coin1.position.y).toBe(24);
		});

		it("applies Tiled properties to nodes", () => {
			const game = createTestGame();
			const map = setupTileMap(game);

			class Coin extends Node2D {
				value = 0;
			}

			const spawned = map.spawnObjects("entities", { Coin }) as Coin[];
			// coin1 has value=10, coin2 has no value property
			const coin1 = spawned.find((c) => c.name === "coin1") as Coin;
			expect(coin1.value).toBe(10);
		});

		it("skips unmapped types", () => {
			const game = createTestGame();
			const map = setupTileMap(game);

			class Coin extends Node2D {}
			// Player type is not in mapping, should be skipped
			const spawned = map.spawnObjects("entities", { Coin });
			expect(spawned).toHaveLength(2);
		});

		it("sets name from Tiled object", () => {
			const game = createTestGame();
			const map = setupTileMap(game);

			class Coin extends Node2D {}
			const spawned = map.spawnObjects("entities", { Coin });
			expect(spawned[0]?.name).toBe("coin1");
		});
	});

	describe("spawnFromTiles", () => {
		it("spawns nodes from tile layer using ID mapping", () => {
			const game = createTestGame();
			const json = makeTiledJSON({
				layers: [
					{
						name: "entities",
						type: "tilelayer",
						width: 5,
						height: 3,
						// A few tiles with GID 3 (localId 2) scattered
						data: [0, 0, 3, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 0, 0],
					},
				],
			});
			const map = setupTileMap(game, json);

			class Enemy extends Node2D {}
			const spawned = map.spawnFromTiles("entities", { 2: Enemy });
			expect(spawned).toHaveLength(3);
			expect(spawned[0]).toBeInstanceOf(Enemy);
		});

		it("positions spawned nodes at tile center", () => {
			const game = createTestGame();
			const json = makeTiledJSON({
				layers: [
					{
						name: "entities",
						type: "tilelayer",
						width: 5,
						height: 3,
						data: [0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					},
				],
			});
			const map = setupTileMap(game, json);

			class Enemy extends Node2D {}
			const spawned = map.spawnFromTiles("entities", { 2: Enemy }) as Node2D[];
			expect(spawned).toHaveLength(1);
			// Tile at col=1, row=0, tileWidth=16
			// Center: (1 * 16 + 8, 0 * 16 + 8) = (24, 8)
			expect(spawned[0]!.position.x).toBe(24);
			expect(spawned[0]!.position.y).toBe(8);
		});

		it("clears tiles after spawning by default", () => {
			const game = createTestGame();
			const json = makeTiledJSON({
				layers: [
					{
						name: "entities",
						type: "tilelayer",
						width: 5,
						height: 3,
						data: [0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					},
				],
			});
			const map = setupTileMap(game, json);

			class Enemy extends Node2D {}
			map.spawnFromTiles("entities", { 2: Enemy });
			// Tile should be cleared
			expect(map.getTileAt(1, 0, "entities")).toBe(0);
		});

		it("preserves tiles when clearTiles is false", () => {
			const game = createTestGame();
			const json = makeTiledJSON({
				layers: [
					{
						name: "entities",
						type: "tilelayer",
						width: 5,
						height: 3,
						data: [0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					},
				],
			});
			const map = setupTileMap(game, json);

			class Enemy extends Node2D {}
			map.spawnFromTiles("entities", { 2: Enemy }, { clearTiles: false });
			// Tile should still be there
			expect(map.getTileAt(1, 0, "entities")).toBe(2);
		});

		it("returns empty array for nonexistent layer", () => {
			const game = createTestGame();
			const map = setupTileMap(game);

			class Enemy extends Node2D {}
			const spawned = map.spawnFromTiles("nonexistent", { 0: Enemy });
			expect(spawned).toHaveLength(0);
		});

		it("skips tiles not in mapping", () => {
			const game = createTestGame();
			const json = makeTiledJSON({
				layers: [
					{
						name: "stuff",
						type: "tilelayer",
						width: 5,
						height: 3,
						data: [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					},
				],
			});
			const map = setupTileMap(game, json);

			class Coin extends Node2D {}
			// Only map localId 1 (GID 2)
			const spawned = map.spawnFromTiles("stuff", { 1: Coin });
			expect(spawned).toHaveLength(1);
		});
	});

	describe("generateCollision", () => {
		it("creates StaticColliders from solid tiles", () => {
			const game = createTestGame();
			game.use(
				PhysicsPlugin({
					collisionGroups: {
						default: { collidesWith: ["default"] },
						world: { collidesWith: ["default"] },
					},
				}),
			);
			const map = setupTileMap(game);

			const count = map.generateCollision({
				layer: "ground",
				allSolid: true,
				collisionGroup: "world",
			});
			expect(count).toBeGreaterThan(0);

			// Should have created StaticCollider children
			const colliders = map.getChildren(StaticCollider);
			expect(colliders.length).toBe(count);
		});

		it("only generates collision once per layer", () => {
			const game = createTestGame();
			game.use(
				PhysicsPlugin({
					collisionGroups: {
						default: { collidesWith: ["default"] },
						world: { collidesWith: ["default"] },
					},
				}),
			);
			const map = setupTileMap(game);

			// Same layer (default) returns 0 on second call
			const count1 = map.generateCollision({ allSolid: true });
			const count2 = map.generateCollision({ allSolid: true });
			expect(count1).toBeGreaterThan(0);
			expect(count2).toBe(0);

			// Different named layer still works
			const count3 = map.generateCollision({ layer: "ground", allSolid: true });
			expect(count3).toBeGreaterThan(0);
		});
	});

	describe("getProperty", () => {
		it("returns map-level property", () => {
			const game = createTestGame();
			const json = makeTiledJSON({
				properties: [{ name: "gravity", type: "float", value: 9.8 }],
			});
			const map = setupTileMap(game, json);
			expect(map.getProperty<number>("gravity")).toBe(9.8);
		});

		it("returns undefined for missing property", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			expect(map.getProperty("nonexistent")).toBeUndefined();
		});
	});

	describe("worldToTile edge cases", () => {
		it("returns (0,0) when map not loaded", () => {
			const map = new TileMap();
			const result = map.worldToTile(new Vec2(100, 200));
			expect(result.x).toBe(0);
			expect(result.y).toBe(0);
		});

		it("accounts for TileMap position offset", () => {
			const game = createTestGame();
			const data = makeTiledJSON();
			game.assets._storeJSON("level1", data);

			let tileMap: TileMap | undefined;
			class TestScene extends Scene {
				onReady() {
					const map = this.add(TileMap);
					map.position._set(100, 100);
					map.asset = "level1";
					tileMap = map;
				}
			}
			game.start(TestScene);
			const map = tileMap as TileMap;

			// World pos (116, 116) with map offset (100, 100) → local (16, 16) → tile (1, 1)
			const tile = map.worldToTile(new Vec2(116, 116));
			expect(tile.x).toBe(1);
			expect(tile.y).toBe(1);
		});
	});

	describe("tileToWorld edge cases", () => {
		it("returns (0,0) when map not loaded", () => {
			const map = new TileMap();
			const result = map.tileToWorld(2, 3);
			expect(result.x).toBe(0);
			expect(result.y).toBe(0);
		});
	});

	describe("setTileAt edge cases", () => {
		it("ignores out-of-bounds set", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			// Should not throw
			map.setTileAt(-1, 0, 5);
			map.setTileAt(0, -1, 5);
			map.setTileAt(999, 0, 5);
			map.setTileAt(0, 999, 5);
		});

		it("ignores set on invalid layer", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			// Should not throw
			map.setTileAt(0, 0, 5, "nonexistent_layer");
		});
	});

	describe("getObjects edge cases", () => {
		it("returns empty when map not loaded", () => {
			const map = new TileMap();
			expect(map.getObjects("entities")).toEqual([]);
		});
	});

	describe("generateCollision with oneWayTileIds", () => {
		it("splits tiles into solid and one-way colliders", () => {
			const game = createTestGame();
			game.use(
				PhysicsPlugin({
					collisionGroups: {
						default: { collidesWith: ["default"] },
						world: { collidesWith: ["default"] },
					},
				}),
			);

			// Build a map with ground tiles (GID 1) and platform tiles (GID 56 = localId 55)
			const json = makeTiledJSON({
				layers: [
					{
						name: "tiles",
						type: "tilelayer",
						width: 5,
						height: 3,
						// Row 0: platform tiles (GID 56)
						// Row 1: empty
						// Row 2: ground tiles (GID 1)
						data: [56, 56, 56, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
					},
				],
			});
			const map = setupTileMap(game, json);

			const count = map.generateCollision({
				layer: "tiles",
				allSolid: true,
				collisionGroup: "world",
				oneWayTileIds: [55], // localId 55 = GID 56
			});

			expect(count).toBeGreaterThan(0);

			// Verify both solid and one-way colliders were created
			const colliders = map.getChildren(StaticCollider);
			const solidColliders = colliders.filter((c) => !c.oneWay);
			const oneWayColliders = colliders.filter((c) => c.oneWay);

			expect(solidColliders.length).toBeGreaterThan(0);
			expect(oneWayColliders.length).toBeGreaterThan(0);
			expect(solidColliders.length + oneWayColliders.length).toBe(count);
		});

		it("works with empty oneWayTileIds (falls back to normal path)", () => {
			const game = createTestGame();
			game.use(
				PhysicsPlugin({
					collisionGroups: {
						default: { collidesWith: ["default"] },
						world: { collidesWith: ["default"] },
					},
				}),
			);
			const map = setupTileMap(game);

			const count = map.generateCollision({
				layer: "ground",
				allSolid: true,
				collisionGroup: "world",
				oneWayTileIds: [],
			});
			expect(count).toBeGreaterThan(0);
		});
	});

	describe("generateCollision edge cases", () => {
		it("throws when map not loaded", () => {
			const map = new TileMap();
			expect(() => map.generateCollision()).toThrow("Map not loaded");
		});

		it("throws when physics plugin not installed", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			expect(() => map.generateCollision({ allSolid: true })).toThrow("PhysicsPlugin");
		});

		it("returns 0 for nonexistent layer", () => {
			const game = createTestGame();
			game.use(
				PhysicsPlugin({
					collisionGroups: {
						default: { collidesWith: ["default"] },
					},
				}),
			);
			const map = setupTileMap(game);
			const count = map.generateCollision({ layer: "nonexistent", allSolid: true });
			expect(count).toBe(0);
		});
	});

	describe("rendering", () => {
		it("onDraw does nothing when map not loaded", () => {
			const map = new TileMap();
			const ctx = {
				text: () => {},
				rect: () => {},
				circle: () => {},
				polygon: () => {},
				line: () => {},
				image: () => {},
				measureText: () => new Vec2(0, 0),
				save: () => {},
				restore: () => {},
				setAlpha: () => {},
				assets: {} as never,
			};
			// Should not throw
			map.onDraw(ctx);
		});

		it("renders tiles with correct source rects", () => {
			const game = createTestGame();
			const map = setupTileMap(game);
			const imageCalls: { name: string; pos: Vec2; opts: unknown }[] = [];
			const ctx = {
				text: () => {},
				rect: () => {},
				circle: () => {},
				polygon: () => {},
				line: () => {},
				image: (name: string, pos: Vec2, opts: unknown) => {
					imageCalls.push({ name, pos, opts });
				},
				measureText: () => new Vec2(0, 0),
				save: () => {},
				restore: () => {},
				setAlpha: () => {},
				assets: {} as never,
			};
			map.onDraw(ctx);
			// Should have drawn tiles (row 1 has 2 tiles, row 2 has 5 tiles = 7 total)
			expect(imageCalls.length).toBe(7);
			// Tileset image name should be derived from "tiles.png" -> "tiles"
			expect(imageCalls[0]!.name).toBe("tiles");
		});
	});

	describe("TMX loading", () => {
		it("loads TMX text from custom asset", () => {
			const game = createTestGame();
			const tmxText = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="3" height="2" tilewidth="16" tileheight="16">
 <tileset firstgid="1" name="terrain" tilewidth="16" tileheight="16"
          tilecount="100" columns="10">
  <image source="terrain.png" width="160" height="160"/>
 </tileset>
 <layer name="ground" width="3" height="2">
  <data encoding="csv">
1,1,1,
1,0,1
</data>
 </layer>
</map>`;
			game.assets._storeCustom("level1", tmxText);

			let tileMap: TileMap | undefined;
			class TestScene extends Scene {
				onReady() {
					const map = this.add(TileMap);
					map.asset = "level1";
					tileMap = map;
				}
			}
			game.start(TestScene);

			expect(tileMap?.isLoaded).toBe(true);
			expect(tileMap?.mapWidth).toBe(3);
			expect(tileMap?.mapHeight).toBe(2);
		});
	});
});
