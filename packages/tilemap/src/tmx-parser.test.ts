import { describe, expect, it, vi } from "vitest";
import { parseTiledMap } from "./tiled-parser.js";
import { FLIPPED_HORIZONTALLY_FLAG, FLIPPED_VERTICALLY_FLAG } from "./tiled-types.js";
import { parseTmx } from "./tmx-parser.js";

/** Minimal valid TMX with 1 tile layer and 1 inline tileset. */
function minimalTmx(layerData = "0,0,0,0,0,0", width = 3, height = 2): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="${width}" height="${height}" tilewidth="16" tileheight="16">
 <tileset firstgid="1" name="terrain" tilewidth="16" tileheight="16"
          tilecount="100" columns="10">
  <image source="terrain.png" width="160" height="160"/>
 </tileset>
 <layer id="1" name="ground" width="${width}" height="${height}">
  <data encoding="csv">
${layerData}
  </data>
 </layer>
</map>`;
}

describe("parseTmx", () => {
	it("parses a minimal valid TMX", () => {
		const map = parseTmx(minimalTmx());
		expect(map.width).toBe(3);
		expect(map.height).toBe(2);
		expect(map.tilewidth).toBe(16);
		expect(map.tileheight).toBe(16);
		expect(map.layers).toHaveLength(1);
		expect(map.tilesets).toHaveLength(1);
		expect(map.tilesets[0]?.name).toBe("terrain");
	});

	it("parses TMX with multiple tile layers", () => {
		const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="2" height="1" tilewidth="16" tileheight="16">
 <tileset firstgid="1" name="ts" tilewidth="16" tileheight="16"
          tilecount="100" columns="10">
  <image source="ts.png" width="160" height="160"/>
 </tileset>
 <layer id="1" name="bg" width="2" height="1">
  <data encoding="csv">1,2</data>
 </layer>
 <layer id="2" name="fg" width="2" height="1">
  <data encoding="csv">3,4</data>
 </layer>
</map>`;
		const map = parseTmx(tmx);
		expect(map.layers).toHaveLength(2);
		expect(map.layers[0]?.name).toBe("bg");
		expect(map.layers[1]?.name).toBe("fg");
		const bg = map.layers[0] as { type: string; data: number[] };
		const fg = map.layers[1] as { type: string; data: number[] };
		expect(bg.data).toEqual([1, 2]);
		expect(fg.data).toEqual([3, 4]);
	});

	it("parses TMX with object layer", () => {
		const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="2" height="1" tilewidth="16" tileheight="16">
 <tileset firstgid="1" name="ts" tilewidth="16" tileheight="16"
          tilecount="100" columns="10">
  <image source="ts.png" width="160" height="160"/>
 </tileset>
 <layer id="1" name="ground" width="2" height="1">
  <data encoding="csv">1,1</data>
 </layer>
 <objectgroup id="2" name="entities">
  <object id="1" name="player" type="Player" x="100" y="200">
   <point/>
  </object>
  <object id="2" name="coin1" type="Coin" x="150" y="180" width="16" height="16">
   <properties>
    <property name="value" type="int" value="10"/>
   </properties>
  </object>
 </objectgroup>
</map>`;
		const map = parseTmx(tmx);
		expect(map.layers).toHaveLength(2);

		const objLayer = map.layers[1];
		expect(objLayer?.type).toBe("objectgroup");
		if (objLayer?.type !== "objectgroup") return;

		expect(objLayer.objects).toHaveLength(2);
		const player = objLayer.objects[0];
		expect(player?.name).toBe("player");
		expect(player?.type).toBe("Player");
		expect(player?.point).toBe(true);
		expect(player?.x).toBe(100);
		expect(player?.y).toBe(200);

		const coin = objLayer.objects[1];
		expect(coin?.type).toBe("Coin");
		expect(coin?.properties).toEqual([{ name: "value", type: "int", value: 10 }]);
	});

	it("parses CSV data correctly", () => {
		const map = parseTmx(minimalTmx("1,2,3,4,5,6"));
		const layer = map.layers[0] as { type: string; data: number[] };
		expect(layer.data).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it("handles CSV data with trailing comma", () => {
		const map = parseTmx(minimalTmx("1,2,3,4,5,6,"));
		const layer = map.layers[0] as { type: string; data: number[] };
		expect(layer.data).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it("handles CSV data with whitespace and newlines", () => {
		const data = `
1, 2, 3,
4, 5, 6
`;
		// spaces are not in actual Tiled output, but the parser should handle them
		// by stripping all whitespace first
		const map = parseTmx(minimalTmx(data.replace(/ /g, "")));
		const layer = map.layers[0] as { type: string; data: number[] };
		expect(layer.data).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it("throws on CSV data length mismatch", () => {
		expect(() => parseTmx(minimalTmx("1,2,3"))).toThrow(
			"3 values but layer is 3\u00D72 (expected 6)",
		);
	});

	it("parses inline tileset correctly", () => {
		const map = parseTmx(minimalTmx());
		const ts = map.tilesets[0];
		expect(ts?.firstgid).toBe(1);
		expect(ts?.name).toBe("terrain");
		expect(ts?.tilewidth).toBe(16);
		expect(ts?.tileheight).toBe(16);
		expect(ts?.tilecount).toBe(100);
		expect(ts?.columns).toBe(10);
		expect(ts?.image).toBe("terrain.png");
		expect(ts?.imagewidth).toBe(160);
		expect(ts?.imageheight).toBe(160);
	});

	it("resolves external tileset via callback", () => {
		const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="2" height="1" tilewidth="16" tileheight="16">
 <tileset firstgid="1" source="terrain.tsx"/>
 <layer id="1" name="ground" width="2" height="1">
  <data encoding="csv">1,2</data>
 </layer>
</map>`;
		const resolve = vi.fn().mockReturnValue({
			name: "terrain",
			tilewidth: 16,
			tileheight: 16,
			tilecount: 100,
			columns: 10,
			image: "terrain.png",
			imagewidth: 160,
			imageheight: 160,
		});

		const map = parseTmx(tmx, resolve);
		expect(resolve).toHaveBeenCalledWith("terrain.tsx");
		expect(map.tilesets[0]?.firstgid).toBe(1);
		expect(map.tilesets[0]?.name).toBe("terrain");
		expect(map.tilesets[0]?.source).toBe("terrain.tsx");
	});

	it("throws when external tileset referenced without callback", () => {
		const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="2" height="1" tilewidth="16" tileheight="16">
 <tileset firstgid="1" source="terrain.tsx"/>
 <layer id="1" name="ground" width="2" height="1">
  <data encoding="csv">1,2</data>
 </layer>
</map>`;
		expect(() => parseTmx(tmx)).toThrow(
			"External tileset 'terrain.tsx' referenced but no resolveTileset callback provided.",
		);
	});

	it("parses custom properties of all types", () => {
		const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="2" height="1" tilewidth="16" tileheight="16">
 <properties>
  <property name="gravity" type="float" value="9.8"/>
  <property name="title" type="string" value="Level 1"/>
  <property name="solid" type="bool" value="true"/>
  <property name="health" type="int" value="100"/>
  <property name="color" type="color" value="#ff0000"/>
  <property name="file" type="file" value="data.json"/>
  <property name="target" type="object" value="42"/>
 </properties>
 <tileset firstgid="1" name="ts" tilewidth="16" tileheight="16"
          tilecount="100" columns="10">
  <image source="ts.png" width="160" height="160"/>
 </tileset>
 <layer id="1" name="ground" width="2" height="1">
  <data encoding="csv">0,0</data>
 </layer>
</map>`;
		const map = parseTmx(tmx);
		expect(map.properties).toEqual([
			{ name: "gravity", type: "float", value: 9.8 },
			{ name: "title", type: "string", value: "Level 1" },
			{ name: "solid", type: "bool", value: true },
			{ name: "health", type: "int", value: 100 },
			{ name: "color", type: "color", value: "#ff0000" },
			{ name: "file", type: "file", value: "data.json" },
			{ name: "target", type: "object", value: 42 },
		]);
	});

	it("preserves flip flags in tile data", () => {
		const flippedH = (1 | FLIPPED_HORIZONTALLY_FLAG) >>> 0;
		const flippedV = (2 | FLIPPED_VERTICALLY_FLAG) >>> 0;
		const map = parseTmx(minimalTmx(`${flippedH},${flippedV},0,0,0,0`));
		const layer = map.layers[0] as { type: string; data: number[] };
		expect(layer.data[0]).toBe(flippedH);
		expect(layer.data[1]).toBe(flippedV);
	});

	it("parses layer id attributes", () => {
		const map = parseTmx(minimalTmx());
		const layer = map.layers[0] as { id?: number };
		expect(layer.id).toBe(1);
	});

	it("parses tile objects with gid", () => {
		const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="2" height="1" tilewidth="16" tileheight="16">
 <tileset firstgid="1" name="ts" tilewidth="16" tileheight="16"
          tilecount="100" columns="10">
  <image source="ts.png" width="160" height="160"/>
 </tileset>
 <layer id="1" name="ground" width="2" height="1">
  <data encoding="csv">0,0</data>
 </layer>
 <objectgroup id="2" name="objects">
  <object id="1" name="tree" type="Decoration" gid="5" x="32" y="48" width="16" height="16"/>
 </objectgroup>
</map>`;
		const map = parseTmx(tmx);
		const objLayer = map.layers[1];
		if (objLayer?.type !== "objectgroup") throw new Error("expected objectgroup");
		expect(objLayer.objects[0]?.gid).toBe(5);
	});

	it("maps Tiled 1.9+ class attribute to type field", () => {
		const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="2" height="1" tilewidth="16" tileheight="16">
 <tileset firstgid="1" name="ts" tilewidth="16" tileheight="16"
          tilecount="100" columns="10">
  <image source="ts.png" width="160" height="160"/>
 </tileset>
 <layer id="1" name="ground" width="2" height="1">
  <data encoding="csv">0,0</data>
 </layer>
 <objectgroup id="2" name="objects">
  <object id="1" name="enemy" class="Enemy" x="50" y="100"/>
 </objectgroup>
</map>`;
		const map = parseTmx(tmx);
		const objLayer = map.layers[1];
		if (objLayer?.type !== "objectgroup") throw new Error("expected objectgroup");
		expect(objLayer.objects[0]?.type).toBe("Enemy");
	});

	it("throws on missing width attribute", () => {
		const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     height="2" tilewidth="16" tileheight="16">
 <layer id="1" name="ground" width="2" height="1">
  <data encoding="csv">0,0</data>
 </layer>
</map>`;
		expect(() => parseTmx(tmx)).toThrow("Missing required attribute 'width' on <map>.");
	});

	it("throws on malformed XML", () => {
		expect(() => parseTmx("<not>valid<xml")).toThrow("TMX parse error");
	});

	it("handles empty data element", () => {
		const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="2" height="1" tilewidth="16" tileheight="16">
 <tileset firstgid="1" name="ts" tilewidth="16" tileheight="16"
          tilecount="100" columns="10">
  <image source="ts.png" width="160" height="160"/>
 </tileset>
 <layer id="1" name="ground" width="2" height="1">
  <data encoding="csv"></data>
 </layer>
</map>`;
		const map = parseTmx(tmx);
		const layer = map.layers[0] as { type: string; data: number[] };
		expect(layer.data).toEqual([0, 0]);
	});

	it("handles tilesets in non-firstgid order", () => {
		const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="2" height="1" tilewidth="16" tileheight="16">
 <tileset firstgid="101" name="objects" tilewidth="16" tileheight="16"
          tilecount="50" columns="5">
  <image source="objects.png" width="80" height="160"/>
 </tileset>
 <tileset firstgid="1" name="terrain" tilewidth="16" tileheight="16"
          tilecount="100" columns="10">
  <image source="terrain.png" width="160" height="160"/>
 </tileset>
 <layer id="1" name="ground" width="2" height="1">
  <data encoding="csv">1,102</data>
 </layer>
</map>`;
		const map = parseTmx(tmx);
		expect(map.tilesets).toHaveLength(2);
		// Verify GID resolution works with out-of-order tilesets
		const parsed = parseTiledMap(map);
		expect(parsed.tileLayers[0]?.tiles[0]?.tileset.name).toBe("terrain");
		expect(parsed.tileLayers[0]?.tiles[1]?.tileset.name).toBe("objects");
	});

	it("parses objects with polygon shapes", () => {
		const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="2" height="1" tilewidth="16" tileheight="16">
 <tileset firstgid="1" name="ts" tilewidth="16" tileheight="16"
          tilecount="100" columns="10">
  <image source="ts.png" width="160" height="160"/>
 </tileset>
 <layer id="1" name="ground" width="2" height="1">
  <data encoding="csv">0,0</data>
 </layer>
 <objectgroup id="2" name="shapes">
  <object id="1" name="slope" type="Slope" x="0" y="0">
   <polygon points="0,0 16,16 0,16"/>
  </object>
  <object id="2" name="path" type="Path" x="10" y="10">
   <polyline points="0,0 10,0 10,10"/>
  </object>
  <object id="3" name="zone" type="Zone" x="20" y="20" width="30" height="30">
   <ellipse/>
  </object>
 </objectgroup>
</map>`;
		const map = parseTmx(tmx);
		const objLayer = map.layers[1];
		if (objLayer?.type !== "objectgroup") throw new Error("expected objectgroup");

		const slope = objLayer.objects[0];
		expect(slope?.polygon).toEqual([
			{ x: 0, y: 0 },
			{ x: 16, y: 16 },
			{ x: 0, y: 16 },
		]);

		const path = objLayer.objects[1];
		expect(path?.polyline).toEqual([
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 10 },
		]);

		const zone = objLayer.objects[2];
		expect(zone?.ellipse).toBe(true);
	});

	it("parses inline tileset with per-tile collision and animation", () => {
		const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="2" height="1" tilewidth="16" tileheight="16">
 <tileset firstgid="1" name="ts" tilewidth="16" tileheight="16"
          tilecount="100" columns="10">
  <image source="ts.png" width="160" height="160"/>
  <tile id="0" type="Solid">
   <objectgroup>
    <object id="1" x="0" y="0" width="16" height="16"/>
   </objectgroup>
  </tile>
  <tile id="10">
   <animation>
    <frame tileid="10" duration="200"/>
    <frame tileid="11" duration="200"/>
    <frame tileid="12" duration="200"/>
   </animation>
  </tile>
 </tileset>
 <layer id="1" name="ground" width="2" height="1">
  <data encoding="csv">1,11</data>
 </layer>
</map>`;
		const map = parseTmx(tmx);
		const ts = map.tilesets[0];
		expect(ts?.tiles).toHaveLength(2);

		const solidTile = ts?.tiles?.[0];
		expect(solidTile?.id).toBe(0);
		expect(solidTile?.type).toBe("Solid");
		expect(solidTile?.objectgroup?.objects).toHaveLength(1);

		const animTile = ts?.tiles?.[1];
		expect(animTile?.id).toBe(10);
		expect(animTile?.animation).toHaveLength(3);
		expect(animTile?.animation?.[0]).toEqual({ tileid: 10, duration: 200 });
	});

	describe("integration: parseTmx → parseTiledMap", () => {
		it("produces a valid ParsedMap from TMX input", () => {
			const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="3" height="2" tilewidth="16" tileheight="16">
 <tileset firstgid="1" name="terrain" tilewidth="16" tileheight="16"
          tilecount="100" columns="10">
  <image source="terrain.png" width="160" height="160"/>
 </tileset>
 <layer id="1" name="ground" width="3" height="2">
  <data encoding="csv">
1,2,3,
4,5,6
  </data>
 </layer>
 <objectgroup id="2" name="entities">
  <object id="1" name="player" type="Player" x="16" y="32">
   <point/>
  </object>
 </objectgroup>
</map>`;
			const tiledMap = parseTmx(tmx);
			const parsed = parseTiledMap(tiledMap);

			expect(parsed.width).toBe(3);
			expect(parsed.height).toBe(2);
			expect(parsed.tileWidth).toBe(16);
			expect(parsed.tileHeight).toBe(16);
			expect(parsed.bounds.width).toBe(48);
			expect(parsed.bounds.height).toBe(32);
			expect(parsed.tileLayers).toHaveLength(1);
			expect(parsed.objectLayers).toHaveLength(1);

			// Verify tile resolution
			const groundLayer = parsed.tileLayers[0];
			expect(groundLayer?.tiles[0]?.localId).toBe(0); // GID 1 - firstgid 1 = 0
			expect(groundLayer?.tiles[5]?.localId).toBe(5); // GID 6 - firstgid 1 = 5

			// Verify object parsing
			const player = parsed.objectLayers[0]?.objects[0];
			expect(player?.name).toBe("player");
			expect(player?.type).toBe("Player");
			expect(player?.point).toBe(true);
		});
	});

	it("throws on non-csv encoding", () => {
		const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="2" height="1" tilewidth="16" tileheight="16">
 <tileset firstgid="1" name="ts" tilewidth="16" tileheight="16"
          tilecount="100" columns="10">
  <image source="ts.png" width="160" height="160"/>
 </tileset>
 <layer id="1" name="ground" width="2" height="1">
  <data encoding="base64">AQAAAAIAAAA=</data>
 </layer>
</map>`;
		expect(() => parseTmx(tmx)).toThrow("Only CSV encoding is supported by parseTmx()");
	});

	it("parses objectgroup with offset and opacity", () => {
		const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" orientation="orthogonal" renderorder="right-down"
     width="2" height="1" tilewidth="16" tileheight="16">
 <tileset firstgid="1" name="ts" tilewidth="16" tileheight="16"
          tilecount="100" columns="10">
  <image source="ts.png" width="160" height="160"/>
 </tileset>
 <layer id="1" name="ground" width="2" height="1">
  <data encoding="csv">0,0</data>
 </layer>
 <objectgroup id="2" name="entities" offsetx="10" offsety="20" opacity="0.5">
  <object id="1" name="npc" type="NPC" x="0" y="0"/>
 </objectgroup>
</map>`;
		const map = parseTmx(tmx);
		const objLayer = map.layers[1];
		if (objLayer?.type !== "objectgroup") throw new Error("expected objectgroup");
		expect(objLayer.offsetx).toBe(10);
		expect(objLayer.offsety).toBe(20);
		expect(objLayer.opacity).toBe(0.5);
	});
});
