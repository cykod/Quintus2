import { Game, Node2D, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { CollisionShape, PhysicsPlugin, Shape, StaticCollider } from "@quintus/physics";
import { beforeAll, describe, expect, it } from "vitest";
import type { TiledMap } from "./tiled-types.js";
import { TileMap } from "./tilemap.js";

beforeAll(() => {
	TileMap.registerPhysics({
		StaticCollider: StaticCollider as never,
		CollisionShape: CollisionShape as never,
		shapeRect: Shape.rect,
	});
});

function makeLevel(): TiledMap {
	return {
		width: 10,
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
				width: 10,
				height: 5,
				data: [
					0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
					0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
				],
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
						y: 48,
						width: 0,
						height: 0,
						point: true,
					},
					{
						id: 2,
						name: "coin1",
						type: "Coin",
						x: 80,
						y: 48,
						width: 16,
						height: 16,
					},
					{
						id: 3,
						name: "coin2",
						type: "Coin",
						x: 128,
						y: 48,
						width: 16,
						height: 16,
					},
				],
			},
		],
	};
}

describe("Tilemap Integration", () => {
	it("full map load → collision → spawn → query workflow", () => {
		const game = new Game({
			width: 320,
			height: 240,
			canvas: document.createElement("canvas"),
			renderer: null,
		});
		game.use(
			PhysicsPlugin({
				collisionGroups: {
					default: { collidesWith: ["default"] },
					world: { collidesWith: ["default"] },
				},
			}),
		);

		game.assets._storeJSON("level", makeLevel());

		class Coin extends Node2D {
			value = 5;
		}

		let tileMap!: TileMap;
		class TestScene extends Scene {
			onReady() {
				const map = this.add(TileMap);
				map.asset = "level";
				tileMap = map;
			}
		}
		game.start(TestScene);

		// Verify map loaded
		expect(tileMap.isLoaded).toBe(true);
		expect(tileMap.mapWidth).toBe(10);
		expect(tileMap.mapHeight).toBe(5);
		expect(tileMap.bounds.width).toBe(160);
		expect(tileMap.bounds.height).toBe(80);

		// Generate collision
		const colliderCount = tileMap.generateCollision({
			layer: "ground",
			allSolid: true,
			collisionGroup: "world",
		});
		expect(colliderCount).toBe(1); // 10 tiles in a row → 1 merged rect

		// Spawn entities
		const spawned = tileMap.spawnObjects("entities", { Coin });
		expect(spawned).toHaveLength(2);

		// Get spawn point
		const playerStart = tileMap.getSpawnPoint("player_start");
		expect(playerStart.x).toBe(32);
		expect(playerStart.y).toBe(48);

		// Query tiles
		expect(tileMap.getTileAt(0, 4)).toBe(0); // GID 1 → localId 0
		expect(tileMap.getTileAt(0, 0)).toBe(0); // empty

		// Dynamic tile modification
		tileMap.setTileAt(0, 0, 5);
		expect(tileMap.getTileAt(0, 0)).toBe(5);
		tileMap.setTileAt(0, 0, 0);
		expect(tileMap.getTileAt(0, 0)).toBe(0);

		// Coordinate conversion
		const tileCoord = tileMap.worldToTile(new Vec2(24, 68));
		expect(tileCoord.x).toBe(1);
		expect(tileCoord.y).toBe(4);

		const worldCoord = tileMap.tileToWorld(3, 2);
		expect(worldCoord.x).toBe(48);
		expect(worldCoord.y).toBe(32);
	});

	it("stepping the game loop with tilemap works", () => {
		const game = new Game({
			width: 320,
			height: 240,
			canvas: document.createElement("canvas"),
			renderer: null,
		});
		game.use(
			PhysicsPlugin({
				collisionGroups: {
					default: { collidesWith: ["default"] },
					world: { collidesWith: ["default"] },
				},
			}),
		);

		game.assets._storeJSON("level", makeLevel());

		class TestScene extends Scene {
			onReady() {
				const map = this.add(TileMap);
				map.asset = "level";
				map.generateCollision({ allSolid: true, collisionGroup: "world" });
			}
		}
		game.start(TestScene);

		// Should be able to step without errors
		for (let i = 0; i < 10; i++) {
			game.step();
		}

		expect(game.fixedFrame).toBe(10);
	});
});
