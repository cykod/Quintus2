// Tiled JSON types

// Tile collision
export type { MergedRect, PhysicsFactories } from "./tile-collision.js";
export { buildSolidGrid, createColliders, getSolidTileIds, mergeRects } from "./tile-collision.js";

// Parser
export type {
	ParsedMap,
	ParsedObject,
	ParsedObjectLayer,
	ParsedTileLayer,
	ResolvedTile,
} from "./tiled-parser.js";
export { parseProperties, parseTiledMap, resolveGlobalTileId } from "./tiled-parser.js";
export type {
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
export {
	FLIPPED_DIAGONALLY_FLAG,
	FLIPPED_HORIZONTALLY_FLAG,
	FLIPPED_VERTICALLY_FLAG,
	TILE_GID_MASK,
} from "./tiled-types.js";
// TileMap node
export type { TileRayHit } from "./tilemap.js";
export { TileMap } from "./tilemap.js";
// TMX/TSX XML parsers
export { parseTmx } from "./tmx-parser.js";
export { parseTsx } from "./tsx-parser.js";
