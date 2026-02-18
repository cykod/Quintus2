import { describe, expect, it } from "vitest";
import { parseTsx } from "./tsx-parser.js";

function minimalTsx(): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="16" tileheight="16"
         tilecount="256" columns="16">
 <image source="terrain.png" width="256" height="256"/>
</tileset>`;
}

describe("parseTsx", () => {
	it("parses image source and dimensions", () => {
		const ts = parseTsx(minimalTsx());
		expect(ts.name).toBe("terrain");
		expect(ts.tilewidth).toBe(16);
		expect(ts.tileheight).toBe(16);
		expect(ts.tilecount).toBe(256);
		expect(ts.columns).toBe(16);
		expect(ts.image).toBe("terrain.png");
		expect(ts.imagewidth).toBe(256);
		expect(ts.imageheight).toBe(256);
	});

	it("parses per-tile collision shapes", () => {
		const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="16" tileheight="16"
         tilecount="256" columns="16">
 <image source="terrain.png" width="256" height="256"/>
 <tile id="15">
  <objectgroup draworder="index">
   <object id="1" x="0" y="0" width="16" height="16"/>
   <object id="2" x="4" y="4" width="8" height="8"/>
  </objectgroup>
 </tile>
</tileset>`;
		const ts = parseTsx(tsx);
		expect(ts.tiles).toHaveLength(1);
		const tile = ts.tiles?.[0];
		expect(tile?.id).toBe(15);
		expect(tile?.objectgroup?.objects).toHaveLength(2);
		expect(tile?.objectgroup?.objects[0]?.x).toBe(0);
		expect(tile?.objectgroup?.objects[0]?.width).toBe(16);
		expect(tile?.objectgroup?.objects[1]?.x).toBe(4);
		expect(tile?.objectgroup?.objects[1]?.width).toBe(8);
	});

	it("parses tile animation", () => {
		const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="water" tilewidth="16" tileheight="16"
         tilecount="256" columns="16">
 <image source="water.png" width="256" height="256"/>
 <tile id="0">
  <animation>
   <frame tileid="0" duration="200"/>
   <frame tileid="1" duration="200"/>
   <frame tileid="2" duration="300"/>
  </animation>
 </tile>
</tileset>`;
		const ts = parseTsx(tsx);
		const tile = ts.tiles?.[0];
		expect(tile?.animation).toHaveLength(3);
		expect(tile?.animation?.[0]).toEqual({ tileid: 0, duration: 200 });
		expect(tile?.animation?.[1]).toEqual({ tileid: 1, duration: 200 });
		expect(tile?.animation?.[2]).toEqual({ tileid: 2, duration: 300 });
	});

	it("parses tile type/class attribute", () => {
		const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="16" tileheight="16"
         tilecount="256" columns="16">
 <image source="terrain.png" width="256" height="256"/>
 <tile id="10" type="Water"/>
 <tile id="20" class="Lava"/>
</tileset>`;
		const ts = parseTsx(tsx);
		expect(ts.tiles).toHaveLength(2);
		expect(ts.tiles?.[0]?.type).toBe("Water");
		expect(ts.tiles?.[1]?.type).toBe("Lava");
	});

	it("parses spacing and margin", () => {
		const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="spaced" tilewidth="16" tileheight="16"
         tilecount="100" columns="10" spacing="2" margin="1">
 <image source="spaced.png" width="178" height="178"/>
</tileset>`;
		const ts = parseTsx(tsx);
		expect(ts.spacing).toBe(2);
		expect(ts.margin).toBe(1);
	});

	it("parses per-tile properties", () => {
		const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="16" tileheight="16"
         tilecount="256" columns="16">
 <image source="terrain.png" width="256" height="256"/>
 <tile id="5">
  <properties>
   <property name="solid" type="bool" value="true"/>
   <property name="damage" type="int" value="10"/>
   <property name="label" type="string" value="spike"/>
  </properties>
 </tile>
</tileset>`;
		const ts = parseTsx(tsx);
		const tile = ts.tiles?.[0];
		expect(tile?.id).toBe(5);
		expect(tile?.properties).toEqual([
			{ name: "solid", type: "bool", value: true },
			{ name: "damage", type: "int", value: 10 },
			{ name: "label", type: "string", value: "spike" },
		]);
	});

	it("does not include firstgid in result", () => {
		const ts = parseTsx(minimalTsx());
		expect("firstgid" in ts).toBe(false);
	});

	it("throws on invalid XML", () => {
		expect(() => parseTsx("<not-valid-xml><<<")).toThrow();
	});

	it("throws on non-tileset root element", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?><map/>`;
		expect(() => parseTsx(xml)).toThrow("Expected root <tileset>");
	});

	it("throws on missing <image> element", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="test" tilewidth="16" tileheight="16" tilecount="1" columns="1"/>`;
		expect(() => parseTsx(xml)).toThrow("missing an <image> element");
	});

	it("throws on missing required attribute", () => {
		// Missing 'name' on tileset
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tileset tilewidth="16" tileheight="16" tilecount="1" columns="1">
 <image source="test.png" width="16" height="16"/>
</tileset>`;
		expect(() => parseTsx(xml)).toThrow("Missing required attribute 'name'");
	});

	it("parses polygon collision shape on tile", () => {
		const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="16" tileheight="16"
         tilecount="256" columns="16">
 <image source="terrain.png" width="256" height="256"/>
 <tile id="3">
  <objectgroup draworder="index">
   <object id="1" x="0" y="0">
    <polygon points="0,0 16,0 16,16 0,16"/>
   </object>
  </objectgroup>
 </tile>
</tileset>`;
		const ts = parseTsx(tsx);
		const tile = ts.tiles?.[0];
		expect(tile?.id).toBe(3);
		const obj = tile?.objectgroup?.objects[0];
		expect(obj?.polygon).toEqual([
			{ x: 0, y: 0 },
			{ x: 16, y: 0 },
			{ x: 16, y: 16 },
			{ x: 0, y: 16 },
		]);
	});

	it("parses ellipse collision shape on tile", () => {
		const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="16" tileheight="16"
         tilecount="256" columns="16">
 <image source="terrain.png" width="256" height="256"/>
 <tile id="7">
  <objectgroup draworder="index">
   <object id="1" x="2" y="2" width="12" height="12">
    <ellipse/>
   </object>
  </objectgroup>
 </tile>
</tileset>`;
		const ts = parseTsx(tsx);
		const obj = ts.tiles?.[0]?.objectgroup?.objects[0];
		expect(obj?.ellipse).toBe(true);
		expect(obj?.width).toBe(12);
		expect(obj?.height).toBe(12);
	});

	it("parses point object on tile", () => {
		const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="16" tileheight="16"
         tilecount="256" columns="16">
 <image source="terrain.png" width="256" height="256"/>
 <tile id="9">
  <objectgroup draworder="index">
   <object id="1" x="8" y="8">
    <point/>
   </object>
  </objectgroup>
 </tile>
</tileset>`;
		const ts = parseTsx(tsx);
		const obj = ts.tiles?.[0]?.objectgroup?.objects[0];
		expect(obj?.point).toBe(true);
		expect(obj?.x).toBe(8);
	});

	it("parses object rotation", () => {
		const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="16" tileheight="16"
         tilecount="256" columns="16">
 <image source="terrain.png" width="256" height="256"/>
 <tile id="11">
  <objectgroup draworder="index">
   <object id="1" x="0" y="0" width="16" height="16" rotation="45"/>
  </objectgroup>
 </tile>
</tileset>`;
		const ts = parseTsx(tsx);
		const obj = ts.tiles?.[0]?.objectgroup?.objects[0];
		expect(obj?.rotation).toBe(45);
	});

	it("parses float property type", () => {
		const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="16" tileheight="16"
         tilecount="256" columns="16">
 <image source="terrain.png" width="256" height="256"/>
 <tile id="1">
  <properties>
   <property name="friction" type="float" value="0.5"/>
  </properties>
 </tile>
</tileset>`;
		const ts = parseTsx(tsx);
		const tile = ts.tiles?.[0];
		expect(tile?.properties?.[0]).toEqual({
			name: "friction",
			type: "float",
			value: 0.5,
		});
	});

	it("parses object type property", () => {
		const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="16" tileheight="16"
         tilecount="256" columns="16">
 <image source="terrain.png" width="256" height="256"/>
 <tile id="2">
  <properties>
   <property name="linked" type="object" value="42"/>
  </properties>
 </tile>
</tileset>`;
		const ts = parseTsx(tsx);
		const tile = ts.tiles?.[0];
		expect(tile?.properties?.[0]).toEqual({
			name: "linked",
			type: "object",
			value: 42,
		});
	});

	it("parses multiple tiles with mixed features", () => {
		const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="16" tileheight="16"
         tilecount="256" columns="16">
 <image source="terrain.png" width="256" height="256"/>
 <tile id="0" type="Solid">
  <properties>
   <property name="walkable" type="bool" value="false"/>
  </properties>
  <objectgroup draworder="index">
   <object id="1" x="0" y="0" width="16" height="16"/>
  </objectgroup>
 </tile>
 <tile id="1">
  <animation>
   <frame tileid="1" duration="100"/>
   <frame tileid="2" duration="100"/>
  </animation>
 </tile>
</tileset>`;
		const ts = parseTsx(tsx);
		expect(ts.tiles).toHaveLength(2);

		const solid = ts.tiles?.[0];
		expect(solid?.type).toBe("Solid");
		expect(solid?.properties?.[0]?.value).toBe(false);
		expect(solid?.objectgroup?.objects).toHaveLength(1);

		const animated = ts.tiles?.[1];
		expect(animated?.animation).toHaveLength(2);
	});

	it("parses objectgroup with id attribute", () => {
		const tsx = `<?xml version="1.0" encoding="UTF-8"?>
<tileset name="terrain" tilewidth="16" tileheight="16"
         tilecount="256" columns="16">
 <image source="terrain.png" width="256" height="256"/>
 <tile id="5">
  <objectgroup id="99" draworder="index">
   <object id="1" x="0" y="0" width="16" height="16"/>
  </objectgroup>
 </tile>
</tileset>`;
		const ts = parseTsx(tsx);
		expect(ts.tiles?.[0]?.objectgroup?.id).toBe(99);
	});
});
