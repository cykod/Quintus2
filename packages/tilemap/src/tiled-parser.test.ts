import { describe, expect, it } from "vitest";
import { parseProperties, parseTiledMap, resolveGlobalTileId } from "./tiled-parser.js";
import type { TiledMap, TiledTileset } from "./tiled-types.js";
import {
	FLIPPED_DIAGONALLY_FLAG,
	FLIPPED_HORIZONTALLY_FLAG,
	FLIPPED_VERTICALLY_FLAG,
} from "./tiled-types.js";

function makeTileset(firstgid: number, name = "tileset"): TiledTileset {
	return {
		firstgid,
		name,
		tilewidth: 16,
		tileheight: 16,
		image: "tiles.png",
		imagewidth: 160,
		imageheight: 160,
		columns: 10,
		tilecount: 100,
	};
}

function makeMinimalMap(overrides?: Partial<TiledMap>): TiledMap {
	return {
		width: 10,
		height: 5,
		tilewidth: 16,
		tileheight: 16,
		layers: [
			{
				name: "ground",
				type: "tilelayer",
				width: 10,
				height: 5,
				data: new Array(50).fill(0),
			},
		],
		tilesets: [makeTileset(1)],
		...overrides,
	};
}

describe("parseProperties", () => {
	it("returns empty map for undefined", () => {
		expect(parseProperties(undefined).size).toBe(0);
	});

	it("returns empty map for empty array", () => {
		expect(parseProperties([]).size).toBe(0);
	});

	it("converts bool, int, float, string types", () => {
		const result = parseProperties([
			{ name: "solid", type: "bool", value: true },
			{ name: "health", type: "int", value: 100 },
			{ name: "speed", type: "float", value: 3.5 },
			{ name: "label", type: "string", value: "hello" },
		]);
		expect(result.get("solid")).toBe(true);
		expect(result.get("health")).toBe(100);
		expect(result.get("speed")).toBe(3.5);
		expect(result.get("label")).toBe("hello");
	});
});

describe("resolveGlobalTileId", () => {
	it("returns null for GID 0 (empty tile)", () => {
		expect(resolveGlobalTileId(0, [makeTileset(1)])).toBeNull();
	});

	it("resolves correct local ID from single tileset", () => {
		const result = resolveGlobalTileId(5, [makeTileset(1)]);
		expect(result).not.toBeNull();
		expect(result?.localId).toBe(4); // 5 - 1 = 4
		expect(result?.flipH).toBe(false);
		expect(result?.flipV).toBe(false);
		expect(result?.flipD).toBe(false);
	});

	it("resolves correct tileset from multiple tilesets", () => {
		const ts1 = makeTileset(1, "terrain");
		const ts2 = makeTileset(101, "objects");

		const result1 = resolveGlobalTileId(50, [ts1, ts2]);
		expect(result1?.tileset.name).toBe("terrain");
		expect(result1?.localId).toBe(49);

		const result2 = resolveGlobalTileId(105, [ts1, ts2]);
		expect(result2?.tileset.name).toBe("objects");
		expect(result2?.localId).toBe(4);
	});

	it("extracts horizontal flip flag", () => {
		const gid = 5 | FLIPPED_HORIZONTALLY_FLAG;
		const result = resolveGlobalTileId(gid, [makeTileset(1)]);
		expect(result?.localId).toBe(4);
		expect(result?.flipH).toBe(true);
		expect(result?.flipV).toBe(false);
		expect(result?.flipD).toBe(false);
	});

	it("extracts vertical flip flag", () => {
		const gid = 5 | FLIPPED_VERTICALLY_FLAG;
		const result = resolveGlobalTileId(gid, [makeTileset(1)]);
		expect(result?.localId).toBe(4);
		expect(result?.flipH).toBe(false);
		expect(result?.flipV).toBe(true);
	});

	it("extracts diagonal flip flag", () => {
		const gid = 5 | FLIPPED_DIAGONALLY_FLAG;
		const result = resolveGlobalTileId(gid, [makeTileset(1)]);
		expect(result?.flipD).toBe(true);
	});

	it("extracts all flip flags combined", () => {
		const gid = 5 | FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG;
		const result = resolveGlobalTileId(gid, [makeTileset(1)]);
		expect(result?.localId).toBe(4);
		expect(result?.flipH).toBe(true);
		expect(result?.flipV).toBe(true);
		expect(result?.flipD).toBe(true);
	});

	it("returns null for unresolvable GID", () => {
		// GID below all tilesets' firstgid should never happen, but handle gracefully
		const result = resolveGlobalTileId(0, [makeTileset(10)]);
		expect(result).toBeNull();
	});
});

describe("parseTiledMap", () => {
	it("parses a minimal valid map", () => {
		const map = makeMinimalMap();
		const result = parseTiledMap(map);
		expect(result.width).toBe(10);
		expect(result.height).toBe(5);
		expect(result.tileWidth).toBe(16);
		expect(result.tileHeight).toBe(16);
		expect(result.tileLayers).toHaveLength(1);
		expect(result.objectLayers).toHaveLength(0);
		expect(result.bounds.width).toBe(160); // 10 * 16
		expect(result.bounds.height).toBe(80); // 5 * 16
	});

	it("throws on missing width", () => {
		expect(() => parseTiledMap({ ...makeMinimalMap(), width: 0 })).toThrow(
			"missing or invalid 'width'",
		);
	});

	it("throws on missing height", () => {
		expect(() => parseTiledMap({ ...makeMinimalMap(), height: 0 })).toThrow(
			"missing or invalid 'height'",
		);
	});

	it("throws on missing tilewidth", () => {
		expect(() => parseTiledMap({ ...makeMinimalMap(), tilewidth: 0 })).toThrow(
			"missing or invalid 'tilewidth'",
		);
	});

	it("throws on missing tileheight", () => {
		expect(() => parseTiledMap({ ...makeMinimalMap(), tileheight: 0 })).toThrow(
			"missing or invalid 'tileheight'",
		);
	});

	it("throws on missing layers", () => {
		expect(() => parseTiledMap({ ...makeMinimalMap(), layers: [] })).toThrow(
			"missing or empty 'layers'",
		);
	});

	it("parses tile layer with resolved tiles", () => {
		const map = makeMinimalMap({
			layers: [
				{
					name: "ground",
					type: "tilelayer",
					width: 2,
					height: 1,
					data: [1, 3],
				},
			],
		});
		const result = parseTiledMap(map);
		const layer = result.tileLayers[0];
		expect(layer?.tiles[0]?.localId).toBe(0);
		expect(layer?.tiles[1]?.localId).toBe(2);
	});

	it("parses tile layer properties", () => {
		const map = makeMinimalMap({
			layers: [
				{
					name: "ground",
					type: "tilelayer",
					width: 2,
					height: 1,
					data: [0, 0],
					visible: false,
					opacity: 0.5,
					offsetx: 10,
					offsety: 20,
					properties: [{ name: "parallax", type: "float", value: 0.5 }],
				},
			],
		});
		const result = parseTiledMap(map);
		const layer = result.tileLayers[0];
		expect(layer?.visible).toBe(false);
		expect(layer?.opacity).toBe(0.5);
		expect(layer?.offsetX).toBe(10);
		expect(layer?.offsetY).toBe(20);
		expect(layer?.properties.get("parallax")).toBe(0.5);
	});

	it("parses object layer", () => {
		const map = makeMinimalMap({
			layers: [
				{
					name: "ground",
					type: "tilelayer",
					width: 2,
					height: 1,
					data: [0, 0],
				},
				{
					name: "entities",
					type: "objectgroup",
					objects: [
						{
							id: 1,
							name: "player_start",
							type: "Player",
							x: 100,
							y: 200,
							width: 0,
							height: 0,
							point: true,
						},
						{
							id: 2,
							name: "",
							type: "Coin",
							x: 150,
							y: 180,
							width: 16,
							height: 16,
							properties: [{ name: "value", type: "int", value: 10 }],
						},
					],
				},
			],
		});
		const result = parseTiledMap(map);
		expect(result.objectLayers).toHaveLength(1);
		const layer = result.objectLayers[0];
		expect(layer?.name).toBe("entities");
		expect(layer?.objects).toHaveLength(2);

		const player = layer?.objects[0];
		expect(player?.name).toBe("player_start");
		expect(player?.type).toBe("Player");
		expect(player?.point).toBe(true);
		expect(player?.x).toBe(100);
		expect(player?.y).toBe(200);

		const coin = layer?.objects[1];
		expect(coin?.type).toBe("Coin");
		expect(coin?.properties.get("value")).toBe(10);
	});

	it("parses map-level properties", () => {
		const map = makeMinimalMap({
			properties: [
				{ name: "gravity", type: "float", value: 9.8 },
				{ name: "title", type: "string", value: "Level 1" },
			],
		});
		const result = parseTiledMap(map);
		expect(result.properties.get("gravity")).toBe(9.8);
		expect(result.properties.get("title")).toBe("Level 1");
	});

	it("ignores unsupported layer types", () => {
		const map = makeMinimalMap({
			layers: [
				{
					name: "ground",
					type: "tilelayer",
					width: 2,
					height: 1,
					data: [0, 0],
				},
				// Fake unsupported layer type
				{ name: "group1", type: "group" as "tilelayer" } as never,
			],
		});
		const result = parseTiledMap(map);
		expect(result.tileLayers).toHaveLength(1);
		expect(result.objectLayers).toHaveLength(0);
	});

	it("handles multiple tile layers", () => {
		const map = makeMinimalMap({
			layers: [
				{
					name: "background",
					type: "tilelayer",
					width: 2,
					height: 1,
					data: [1, 2],
				},
				{
					name: "foreground",
					type: "tilelayer",
					width: 2,
					height: 1,
					data: [3, 4],
				},
			],
		});
		const result = parseTiledMap(map);
		expect(result.tileLayers).toHaveLength(2);
		expect(result.tileLayers[0]?.name).toBe("background");
		expect(result.tileLayers[1]?.name).toBe("foreground");
	});

	it("preserves tileset info", () => {
		const map = makeMinimalMap();
		const result = parseTiledMap(map);
		expect(result.tilesets).toHaveLength(1);
		expect(result.tilesets[0]?.name).toBe("tileset");
	});

	it("handles object with polygon", () => {
		const map = makeMinimalMap({
			layers: [
				{
					name: "shapes",
					type: "objectgroup",
					objects: [
						{
							id: 1,
							name: "slope",
							type: "Slope",
							x: 0,
							y: 0,
							width: 0,
							height: 0,
							polygon: [
								{ x: 0, y: 0 },
								{ x: 16, y: 16 },
								{ x: 0, y: 16 },
							],
						},
					],
				},
			],
		});
		const result = parseTiledMap(map);
		const obj = result.objectLayers[0]?.objects[0];
		expect(obj?.polygon).toHaveLength(3);
		expect(obj?.polygon?.[0]).toEqual({ x: 0, y: 0 });
	});
});
