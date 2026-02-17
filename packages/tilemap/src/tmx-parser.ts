import type {
	TiledAnimationFrame,
	TiledLayer,
	TiledMap,
	TiledObject,
	TiledObjectGroup,
	TiledProperty,
	TiledTileDefinition,
	TiledTileLayer,
	TiledTileset,
} from "./tiled-types.js";

/**
 * Parse a TMX XML string into a TiledMap object (same shape as Tiled JSON).
 * Only supports CSV-encoded tile data. Throws if base64 data is encountered
 * (use `parseTmxAsync` from a future phase for compressed data).
 *
 * @param xml The TMX file content as a string.
 * @param resolveTileset Callback to load external .tsx files by path.
 *        Returns the parsed TiledTileset (without firstgid, which comes from the TMX).
 * @returns TiledMap object compatible with parseTiledMap().
 */
export function parseTmx(
	xml: string,
	resolveTileset?: (source: string) => Omit<TiledTileset, "firstgid">,
): TiledMap {
	const doc = parseXml(xml);
	const mapEl = doc.documentElement;

	if (mapEl.tagName !== "map") {
		throw new Error(`Expected root <map> element, got <${mapEl.tagName}>.`);
	}

	const width = Number.parseInt(reqAttr(mapEl, "width"), 10);
	const height = Number.parseInt(reqAttr(mapEl, "height"), 10);
	const tilewidth = Number.parseInt(reqAttr(mapEl, "tilewidth"), 10);
	const tileheight = Number.parseInt(reqAttr(mapEl, "tileheight"), 10);

	const tilesets: TiledTileset[] = [];
	const layers: TiledLayer[] = [];

	for (const child of mapEl.children) {
		switch (child.tagName) {
			case "tileset":
				tilesets.push(parseTilesetElement(child, resolveTileset));
				break;
			case "layer":
				layers.push(parseTileLayerElement(child));
				break;
			case "objectgroup":
				layers.push(parseObjectGroupElement(child));
				break;
		}
	}

	const result: TiledMap = {
		width,
		height,
		tilewidth,
		tileheight,
		layers,
		tilesets,
	};

	const props = parsePropertiesXml(mapEl);
	if (props) {
		result.properties = props;
	}

	return result;
}

// ─── XML Parsing ────────────────────────────────────────────────

function parseXml(xml: string): Document {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, "text/xml");
	const err = doc.querySelector("parsererror");
	if (err) {
		throw new Error(`TMX parse error: ${err.textContent}`);
	}
	return doc;
}

// ─── DOM Helpers ────────────────────────────────────────────────

/** Find the first direct child element with the given tag name. */
function childByTag(el: Element, tag: string): Element | null {
	for (const child of el.children) {
		if (child.tagName === tag) return child;
	}
	return null;
}

/** Find all direct child elements with the given tag name. */
function childrenByTag(el: Element, tag: string): Element[] {
	const result: Element[] = [];
	for (const child of el.children) {
		if (child.tagName === tag) result.push(child);
	}
	return result;
}

// ─── Attribute Helpers ──────────────────────────────────────────

function reqAttr(el: Element, name: string): string {
	const val = el.getAttribute(name);
	if (val === null) throw new Error(`Missing required attribute '${name}' on <${el.tagName}>.`);
	return val;
}

function optInt(el: Element, name: string, def: number): number {
	const val = el.getAttribute(name);
	return val !== null ? Number.parseInt(val, 10) : def;
}

function optFloat(el: Element, name: string, def: number): number {
	const val = el.getAttribute(name);
	return val !== null ? Number.parseFloat(val) : def;
}

function optBool(el: Element, name: string, def: boolean): boolean {
	const val = el.getAttribute(name);
	return val !== null ? val !== "0" && val !== "false" : def;
}

// ─── Tileset Parsing ────────────────────────────────────────────

function parseTilesetElement(
	el: Element,
	resolveTileset?: (source: string) => Omit<TiledTileset, "firstgid">,
): TiledTileset {
	const firstgid = Number.parseInt(reqAttr(el, "firstgid"), 10);
	const source = el.getAttribute("source");

	if (source !== null) {
		// External tileset reference
		if (!resolveTileset) {
			throw new Error(
				`External tileset '${source}' referenced but no resolveTileset callback provided.`,
			);
		}
		const resolved = resolveTileset(source);
		return { ...resolved, firstgid, source } as TiledTileset;
	}

	// Inline tileset
	return parseInlineTileset(el, firstgid);
}

function parseInlineTileset(el: Element, firstgid: number): TiledTileset {
	const name = reqAttr(el, "name");
	const tilewidth = Number.parseInt(reqAttr(el, "tilewidth"), 10);
	const tileheight = Number.parseInt(reqAttr(el, "tileheight"), 10);
	const tilecount = Number.parseInt(reqAttr(el, "tilecount"), 10);
	const columns = Number.parseInt(reqAttr(el, "columns"), 10);
	const spacing = optInt(el, "spacing", 0);
	const margin = optInt(el, "margin", 0);

	// <image> element
	const imageEl = childByTag(el, "image");
	if (!imageEl) {
		throw new Error(`Tileset '${name}' is missing an <image> element.`);
	}
	const image = reqAttr(imageEl, "source");
	const imagewidth = Number.parseInt(reqAttr(imageEl, "width"), 10);
	const imageheight = Number.parseInt(reqAttr(imageEl, "height"), 10);

	const tileset: TiledTileset = {
		firstgid,
		name,
		tilewidth,
		tileheight,
		tilecount,
		columns,
		image,
		imagewidth,
		imageheight,
	};

	if (spacing !== 0) tileset.spacing = spacing;
	if (margin !== 0) tileset.margin = margin;

	// Per-tile definitions
	const tiles = parseTileDefinitions(el);
	if (tiles.length > 0) {
		tileset.tiles = tiles;
	}

	return tileset;
}

function parseTileDefinitions(tilesetEl: Element): TiledTileDefinition[] {
	const tiles: TiledTileDefinition[] = [];

	for (const tileEl of childrenByTag(tilesetEl, "tile")) {
		const id = Number.parseInt(reqAttr(tileEl, "id"), 10);
		const tileDef: TiledTileDefinition = { id };

		// type or class attribute
		const typeAttr = tileEl.getAttribute("type") ?? tileEl.getAttribute("class");
		if (typeAttr) {
			tileDef.type = typeAttr;
		}

		// Properties
		const props = parsePropertiesXml(tileEl);
		if (props) {
			tileDef.properties = props;
		}

		// Collision objectgroup
		const objGroupEl = childByTag(tileEl, "objectgroup");
		if (objGroupEl) {
			tileDef.objectgroup = parseObjectGroupElement(objGroupEl);
		}

		// Animation
		const animEl = childByTag(tileEl, "animation");
		if (animEl) {
			tileDef.animation = parseAnimation(animEl);
		}

		tiles.push(tileDef);
	}

	return tiles;
}

function parseAnimation(animEl: Element): TiledAnimationFrame[] {
	const frames: TiledAnimationFrame[] = [];
	for (const frameEl of childrenByTag(animEl, "frame")) {
		frames.push({
			tileid: Number.parseInt(reqAttr(frameEl, "tileid"), 10),
			duration: Number.parseInt(reqAttr(frameEl, "duration"), 10),
		});
	}
	return frames;
}

// ─── Layer Parsing ──────────────────────────────────────────────

function parseTileLayerElement(el: Element): TiledTileLayer {
	const name = reqAttr(el, "name");
	const width = Number.parseInt(reqAttr(el, "width"), 10);
	const height = Number.parseInt(reqAttr(el, "height"), 10);

	const dataEl = childByTag(el, "data");
	if (!dataEl) {
		throw new Error(`Tile layer '${name}' is missing a <data> element.`);
	}

	const encoding = dataEl.getAttribute("encoding") ?? "csv";
	if (encoding !== "csv") {
		throw new Error(
			`Tile layer '${name}' uses '${encoding}' encoding. ` +
				"Only CSV encoding is supported by parseTmx(). " +
				"Use parseTmxAsync() for base64/compressed data (Phase 2).",
		);
	}

	const data = parseCsvData(dataEl.textContent ?? "", width, height);

	const layer: TiledTileLayer = {
		name,
		type: "tilelayer",
		width,
		height,
		data,
	};

	const id = el.getAttribute("id");
	if (id !== null) layer.id = Number.parseInt(id, 10);

	const visible = el.getAttribute("visible");
	if (visible !== null) layer.visible = visible !== "0" && visible !== "false";

	const opacity = el.getAttribute("opacity");
	if (opacity !== null) layer.opacity = Number.parseFloat(opacity);

	const offsetx = el.getAttribute("offsetx");
	if (offsetx !== null) layer.offsetx = Number.parseFloat(offsetx);

	const offsety = el.getAttribute("offsety");
	if (offsety !== null) layer.offsety = Number.parseFloat(offsety);

	const props = parsePropertiesXml(el);
	if (props) layer.properties = props;

	return layer;
}

function parseObjectGroupElement(el: Element): TiledObjectGroup {
	const name = el.getAttribute("name") ?? "";

	const group: TiledObjectGroup = {
		name,
		type: "objectgroup",
		objects: [],
	};

	const id = el.getAttribute("id");
	if (id !== null) group.id = Number.parseInt(id, 10);

	const visible = el.getAttribute("visible");
	if (visible !== null) group.visible = visible !== "0" && visible !== "false";

	const opacity = el.getAttribute("opacity");
	if (opacity !== null) group.opacity = Number.parseFloat(opacity);

	const offsetx = el.getAttribute("offsetx");
	if (offsetx !== null) group.offsetx = Number.parseFloat(offsetx);

	const offsety = el.getAttribute("offsety");
	if (offsety !== null) group.offsety = Number.parseFloat(offsety);

	for (const objEl of childrenByTag(el, "object")) {
		group.objects.push(parseObject(objEl));
	}

	const props = parsePropertiesXml(el);
	if (props) group.properties = props;

	return group;
}

// ─── Object Parsing ─────────────────────────────────────────────

function parseObject(objEl: Element): TiledObject {
	const obj: TiledObject = {
		id: optInt(objEl, "id", 0),
		name: objEl.getAttribute("name") ?? "",
		// Tiled 1.9 renamed "type" to "class" in TMX; later versions reverted.
		// Support both: prefer "type", fall back to "class".
		type: objEl.getAttribute("type") ?? objEl.getAttribute("class") ?? "",
		x: optFloat(objEl, "x", 0),
		y: optFloat(objEl, "y", 0),
		width: optFloat(objEl, "width", 0),
		height: optFloat(objEl, "height", 0),
		rotation: optFloat(objEl, "rotation", 0),
		visible: optBool(objEl, "visible", true),
	};

	const props = parsePropertiesXml(objEl);
	if (props) obj.properties = props;

	// Tile object: an object that references a tile via its GID
	const gidAttr = objEl.getAttribute("gid");
	if (gidAttr !== null) {
		obj.gid = Number.parseInt(gidAttr, 10);
	}

	// Shape detection via child elements
	if (childByTag(objEl, "point")) {
		obj.point = true;
	}
	if (childByTag(objEl, "ellipse")) {
		obj.ellipse = true;
	}
	const polygonEl = childByTag(objEl, "polygon");
	if (polygonEl) {
		obj.polygon = parsePoints(reqAttr(polygonEl, "points"));
	}
	const polylineEl = childByTag(objEl, "polyline");
	if (polylineEl) {
		obj.polyline = parsePoints(reqAttr(polylineEl, "points"));
	}

	return obj;
}

function parsePoints(pointsStr: string): Array<{ x: number; y: number }> {
	return pointsStr
		.trim()
		.split(/\s+/)
		.map((pair) => {
			const [x, y] = pair.split(",");
			return { x: Number.parseFloat(x as string), y: Number.parseFloat(y as string) };
		});
}

// ─── Property Parsing ───────────────────────────────────────────

function parsePropertiesXml(el: Element): TiledProperty[] | undefined {
	const propsEl = childByTag(el, "properties");
	if (!propsEl) return undefined;

	const result: TiledProperty[] = [];
	for (const prop of childrenByTag(propsEl, "property")) {
		const name = reqAttr(prop, "name");
		const type = (prop.getAttribute("type") ?? "string") as TiledProperty["type"];
		const rawValue = prop.getAttribute("value") ?? prop.textContent ?? "";

		let value: boolean | number | string;
		switch (type) {
			case "bool":
				value = rawValue === "true";
				break;
			case "int":
				value = Number.parseInt(rawValue, 10);
				break;
			case "float":
				value = Number.parseFloat(rawValue);
				break;
			case "object":
				value = Number.parseInt(rawValue, 10);
				break;
			default:
				value = rawValue;
		}

		result.push({ name, type, value });
	}
	return result.length > 0 ? result : undefined;
}

// ─── CSV Data Parsing ───────────────────────────────────────────

/**
 * Parse CSV tile data from a <data encoding="csv"> element.
 * Strips all whitespace, splits on commas, filters empty tokens
 * (handles trailing commas), and validates length.
 */
function parseCsvData(text: string, width: number, height: number): number[] {
	const stripped = text.replace(/\s/g, "");
	if (stripped === "") {
		return new Array(width * height).fill(0) as number[];
	}

	const tokens = stripped.split(",").filter((s) => s.length > 0);
	const expected = width * height;
	if (tokens.length !== expected) {
		throw new Error(
			`CSV tile data has ${tokens.length} values but layer is ${width}\u00D7${height} (expected ${expected}).`,
		);
	}

	return tokens.map((s) => {
		const n = Number.parseInt(s, 10);
		if (Number.isNaN(n)) throw new Error(`Invalid tile GID in CSV data: '${s}'.`);
		return n;
	});
}
