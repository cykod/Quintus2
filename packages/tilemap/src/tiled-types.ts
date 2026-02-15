/** Root structure of a Tiled JSON map file. */
export interface TiledMap {
	/** Map width in tiles. */
	width: number;
	/** Map height in tiles. */
	height: number;
	/** Tile width in pixels. */
	tilewidth: number;
	/** Tile height in pixels. */
	tileheight: number;
	/** Ordered list of layers. */
	layers: TiledLayer[];
	/** Tileset references. */
	tilesets: TiledTileset[];
	/** Custom properties set in Tiled. */
	properties?: TiledProperty[];
}

/** Union of supported layer types. */
export type TiledLayer = TiledTileLayer | TiledObjectGroup;

/** A grid of tile IDs. */
export interface TiledTileLayer {
	name: string;
	type: "tilelayer";
	/** Layer width in tiles (usually equals map width). */
	width: number;
	/** Layer height in tiles (usually equals map height). */
	height: number;
	/** Row-major array of global tile IDs. 0 = empty. */
	data: number[];
	visible?: boolean;
	opacity?: number;
	/** Pixel offset for parallax/decoration layers. */
	offsetx?: number;
	offsety?: number;
	properties?: TiledProperty[];
}

/** A collection of freeform objects (spawn points, triggers, etc). */
export interface TiledObjectGroup {
	name: string;
	type: "objectgroup";
	objects: TiledObject[];
	visible?: boolean;
	properties?: TiledProperty[];
}

/** A freeform object placed in the map (entity, spawn point, trigger zone). */
export interface TiledObject {
	id: number;
	/** User-assigned name (e.g. "player_start"). */
	name: string;
	/** User-assigned type (e.g. "Enemy", "Coin"). Maps to Node classes. */
	type: string;
	/** Position in pixels (top-left corner). */
	x: number;
	y: number;
	/** Size in pixels (0 for point objects). */
	width: number;
	height: number;
	rotation?: number;
	visible?: boolean;
	properties?: TiledProperty[];
	/** True if this is a point object (spawn points, markers). */
	point?: boolean;
	/** True if this is an ellipse. */
	ellipse?: boolean;
	/** Polygon vertices (relative to x, y). */
	polygon?: Array<{ x: number; y: number }>;
}

/** A tileset definition. */
export interface TiledTileset {
	/** First global tile ID for this tileset. */
	firstgid: number;
	name: string;
	tilewidth: number;
	tileheight: number;
	/** Tileset image path (relative to map file). */
	image: string;
	imagewidth: number;
	imageheight: number;
	/** Number of columns in the tileset image. */
	columns: number;
	/** Total number of tiles. */
	tilecount: number;
	/** Spacing between tiles in pixels. */
	spacing?: number;
	/** Margin around the tileset image in pixels. */
	margin?: number;
	/** Per-tile properties and collision shapes. */
	tiles?: TiledTileDefinition[];
}

/** Per-tile metadata (properties, collision shapes). */
export interface TiledTileDefinition {
	/** Local tile ID (0-based within the tileset). */
	id: number;
	properties?: TiledProperty[];
	/** Per-tile collision shapes defined in Tiled's collision editor. */
	objectgroup?: TiledObjectGroup;
}

/** A custom property defined in Tiled. */
export interface TiledProperty {
	name: string;
	type: "bool" | "int" | "float" | "string" | "color" | "file" | "object";
	value: boolean | number | string;
}

/**
 * Tiled encodes flip/rotate flags in the high bits of tile GIDs.
 * These must be masked off before looking up the tile in the tileset.
 */
export const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
export const FLIPPED_VERTICALLY_FLAG = 0x40000000;
export const FLIPPED_DIAGONALLY_FLAG = 0x20000000;
export const TILE_GID_MASK = 0x1fffffff;
