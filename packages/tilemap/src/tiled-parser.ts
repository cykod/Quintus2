import { Rect } from "@quintus/math";
import type {
	TiledMap,
	TiledObjectGroup,
	TiledProperty,
	TiledTileLayer,
	TiledTileset,
} from "./tiled-types.js";
import {
	FLIPPED_DIAGONALLY_FLAG,
	FLIPPED_HORIZONTALLY_FLAG,
	FLIPPED_VERTICALLY_FLAG,
	TILE_GID_MASK,
} from "./tiled-types.js";

/** Resolved tile data for a single tile in the grid. */
export interface ResolvedTile {
	/** Local tile ID within the tileset (0-based). */
	localId: number;
	/** The tileset this tile belongs to. */
	tileset: TiledTileset;
	/** Horizontal flip. */
	flipH: boolean;
	/** Vertical flip. */
	flipV: boolean;
	/** Diagonal flip (90-degree rotation). */
	flipD: boolean;
}

/** Parsed tile layer with resolved tile data. */
export interface ParsedTileLayer {
	name: string;
	/** Row-major array of resolved tiles. null = empty cell. */
	tiles: Array<ResolvedTile | null>;
	width: number;
	height: number;
	visible: boolean;
	opacity: number;
	offsetX: number;
	offsetY: number;
	properties: Map<string, boolean | number | string>;
}

/** Parsed object from an object layer. */
export interface ParsedObject {
	id: number;
	name: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	visible: boolean;
	point: boolean;
	ellipse: boolean;
	properties: Map<string, boolean | number | string>;
	polygon?: Array<{ x: number; y: number }>;
	polyline?: Array<{ x: number; y: number }>;
	gid?: number;
}

/** Parsed object layer. */
export interface ParsedObjectLayer {
	name: string;
	objects: ParsedObject[];
	properties: Map<string, boolean | number | string>;
}

/** Full parsed map result. */
export interface ParsedMap {
	width: number;
	height: number;
	tileWidth: number;
	tileHeight: number;
	tileLayers: ParsedTileLayer[];
	objectLayers: ParsedObjectLayer[];
	tilesets: TiledTileset[];
	/** Total map bounds in pixels. */
	bounds: Rect;
	properties: Map<string, boolean | number | string>;
}

/**
 * Convert a TiledProperty array to a Map for easy lookup.
 */
export function parseProperties(props?: TiledProperty[]): Map<string, boolean | number | string> {
	const result = new Map<string, boolean | number | string>();
	if (!props) return result;
	for (const p of props) {
		result.set(p.name, p.value);
	}
	return result;
}

/**
 * Resolve a global tile ID to a local tile ID and tileset.
 * Handles flip flag extraction and tileset lookup.
 */
export function resolveGlobalTileId(gid: number, tilesets: TiledTileset[]): ResolvedTile | null {
	if (gid === 0) return null;

	// Extract flip flags from high bits
	const flipH = (gid & FLIPPED_HORIZONTALLY_FLAG) !== 0;
	const flipV = (gid & FLIPPED_VERTICALLY_FLAG) !== 0;
	const flipD = (gid & FLIPPED_DIAGONALLY_FLAG) !== 0;
	const tileId = gid & TILE_GID_MASK;

	// Find the tileset: sort by firstgid descending and pick the first that fits
	// (We don't want to mutate the original so we create a sorted copy)
	const sorted = [...tilesets].sort((a, b) => b.firstgid - a.firstgid);
	for (const ts of sorted) {
		if (tileId >= ts.firstgid) {
			return {
				localId: tileId - ts.firstgid,
				tileset: ts,
				flipH,
				flipV,
				flipD,
			};
		}
	}

	return null;
}

/**
 * Parse a Tiled JSON map into normalized internal structures.
 * Validates required fields and resolves tile GIDs to tileset-local IDs.
 *
 * @throws If the JSON is missing required fields or has invalid data.
 */
export function parseTiledMap(json: TiledMap): ParsedMap {
	// Validation
	if (json.width == null || json.width <= 0) {
		throw new Error("Invalid Tiled map: missing or invalid 'width' property.");
	}
	if (json.height == null || json.height <= 0) {
		throw new Error("Invalid Tiled map: missing or invalid 'height' property.");
	}
	if (json.tilewidth == null || json.tilewidth <= 0) {
		throw new Error("Invalid Tiled map: missing or invalid 'tilewidth' property.");
	}
	if (json.tileheight == null || json.tileheight <= 0) {
		throw new Error("Invalid Tiled map: missing or invalid 'tileheight' property.");
	}
	if (!json.layers || json.layers.length === 0) {
		throw new Error("Invalid Tiled map: missing or empty 'layers' array.");
	}

	const tilesets = json.tilesets ?? [];
	const tileLayers: ParsedTileLayer[] = [];
	const objectLayers: ParsedObjectLayer[] = [];

	for (const layer of json.layers) {
		if (layer.type === "tilelayer") {
			tileLayers.push(parseTileLayer(layer as TiledTileLayer, tilesets));
		} else if (layer.type === "objectgroup") {
			objectLayers.push(parseObjectLayer(layer as TiledObjectGroup));
		}
		// Silently ignore unsupported layer types (group, image, etc.)
	}

	return {
		width: json.width,
		height: json.height,
		tileWidth: json.tilewidth,
		tileHeight: json.tileheight,
		tileLayers,
		objectLayers,
		tilesets,
		bounds: new Rect(0, 0, json.width * json.tilewidth, json.height * json.tileheight),
		properties: parseProperties(json.properties),
	};
}

function parseTileLayer(layer: TiledTileLayer, tilesets: TiledTileset[]): ParsedTileLayer {
	const tiles: Array<ResolvedTile | null> = new Array(layer.data.length);
	for (let i = 0; i < layer.data.length; i++) {
		tiles[i] = resolveGlobalTileId(layer.data[i] as number, tilesets);
	}

	return {
		name: layer.name,
		tiles,
		width: layer.width,
		height: layer.height,
		visible: layer.visible ?? true,
		opacity: layer.opacity ?? 1,
		offsetX: layer.offsetx ?? 0,
		offsetY: layer.offsety ?? 0,
		properties: parseProperties(layer.properties),
	};
}

function parseObjectLayer(layer: TiledObjectGroup): ParsedObjectLayer {
	return {
		name: layer.name,
		objects: layer.objects.map((obj) => ({
			id: obj.id,
			name: obj.name,
			type: obj.type,
			x: obj.x,
			y: obj.y,
			width: obj.width,
			height: obj.height,
			rotation: obj.rotation ?? 0,
			visible: obj.visible ?? true,
			point: obj.point ?? false,
			ellipse: obj.ellipse ?? false,
			properties: parseProperties(obj.properties),
			polygon: obj.polygon,
			polyline: obj.polyline,
			gid: obj.gid,
		})),
		properties: parseProperties(layer.properties),
	};
}
