import type {
	TiledAnimationFrame,
	TiledObjectGroup,
	TiledProperty,
	TiledTileDefinition,
	TiledTileset,
} from "./tiled-types.js";

/**
 * Parse a TSX XML string into a TiledTileset object.
 * Note: `firstgid` is NOT included — it's map-specific, stored in the TMX.
 *
 * @param xml The TSX file content as a string.
 * @returns TiledTileset (without firstgid) compatible with parseTmx's resolveTileset callback.
 */
export function parseTsx(xml: string): Omit<TiledTileset, "firstgid"> {
	const doc = parseXml(xml);
	const tsEl = doc.documentElement;

	if (tsEl.tagName !== "tileset") {
		throw new Error(`Expected root <tileset> element, got <${tsEl.tagName}>.`);
	}

	const name = reqAttr(tsEl, "name");
	const tilewidth = Number.parseInt(reqAttr(tsEl, "tilewidth"), 10);
	const tileheight = Number.parseInt(reqAttr(tsEl, "tileheight"), 10);
	const tilecount = Number.parseInt(reqAttr(tsEl, "tilecount"), 10);
	const columns = Number.parseInt(reqAttr(tsEl, "columns"), 10);

	const imageEl = childByTag(tsEl, "image");
	if (!imageEl) {
		throw new Error(`Tileset '${name}' is missing an <image> element.`);
	}
	const image = reqAttr(imageEl, "source");
	const imagewidth = Number.parseInt(reqAttr(imageEl, "width"), 10);
	const imageheight = Number.parseInt(reqAttr(imageEl, "height"), 10);

	const tileset: Omit<TiledTileset, "firstgid"> = {
		name,
		tilewidth,
		tileheight,
		tilecount,
		columns,
		image,
		imagewidth,
		imageheight,
	};

	const spacing = optInt(tsEl, "spacing", 0);
	if (spacing !== 0) (tileset as TiledTileset).spacing = spacing;

	const margin = optInt(tsEl, "margin", 0);
	if (margin !== 0) (tileset as TiledTileset).margin = margin;

	const tiles = parseTileDefinitions(tsEl);
	if (tiles.length > 0) {
		(tileset as TiledTileset).tiles = tiles;
	}

	return tileset;
}

// ─── XML Parsing ────────────────────────────────────────────────

function parseXml(xml: string): Document {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, "text/xml");
	const err = doc.querySelector("parsererror");
	if (err) {
		throw new Error(`TSX parse error: ${err.textContent}`);
	}
	return doc;
}

// ─── DOM Helpers ────────────────────────────────────────────────

function childByTag(el: Element, tag: string): Element | null {
	for (const child of el.children) {
		if (child.tagName === tag) return child;
	}
	return null;
}

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

// ─── Tile Definitions ───────────────────────────────────────────

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

// ─── Object Group Parsing (for tile collision shapes) ───────────

function parseObjectGroupElement(el: Element): TiledObjectGroup {
	const name = el.getAttribute("name") ?? "";

	const group: TiledObjectGroup = {
		name,
		type: "objectgroup",
		objects: [],
	};

	const id = el.getAttribute("id");
	if (id !== null) group.id = Number.parseInt(id, 10);

	for (const objEl of childrenByTag(el, "object")) {
		group.objects.push(parseObject(objEl));
	}

	return group;
}

function parseObject(objEl: Element): {
	id: number;
	name: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation?: number;
	visible?: boolean;
	point?: boolean;
	ellipse?: boolean;
	polygon?: Array<{ x: number; y: number }>;
	polyline?: Array<{ x: number; y: number }>;
	properties?: TiledProperty[];
} {
	const obj: {
		id: number;
		name: string;
		type: string;
		x: number;
		y: number;
		width: number;
		height: number;
		rotation?: number;
		visible?: boolean;
		point?: boolean;
		ellipse?: boolean;
		polygon?: Array<{ x: number; y: number }>;
		polyline?: Array<{ x: number; y: number }>;
		properties?: TiledProperty[];
	} = {
		id: optInt(objEl, "id", 0),
		name: objEl.getAttribute("name") ?? "",
		type: objEl.getAttribute("type") ?? objEl.getAttribute("class") ?? "",
		x: optFloat(objEl, "x", 0),
		y: optFloat(objEl, "y", 0),
		width: optFloat(objEl, "width", 0),
		height: optFloat(objEl, "height", 0),
	};

	const rotation = optFloat(objEl, "rotation", 0);
	if (rotation !== 0) obj.rotation = rotation;

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

	const props = parsePropertiesXml(objEl);
	if (props) obj.properties = props;

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
