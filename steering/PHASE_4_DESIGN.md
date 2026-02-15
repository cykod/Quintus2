# Phase 4: Tilemap & Camera — Detailed Design

> **Goal:** Tiled map support and camera system. After this phase, you can build a scrolling platformer level designed in the Tiled editor, with a camera that follows the player.
> **Duration:** ~1.5 weeks
> **Outcome:** A scrolling platformer demo runs in the browser with a Tiled-designed level, auto-generated tile collision, entity spawning from object layers, and a smooth camera following the player within level bounds. `@quintus/tilemap` + `@quintus/camera` ship as valid ESM/CJS bundles. All tests pass.

---

## Table of Contents

1. [Core Changes](#1-core-changes)
   - [Scene.viewTransform](#11-sceneviewtransform)
   - [Canvas2DRenderer Update](#12-canvas2drenderer-update)
2. [Package: @quintus/tilemap](#2-package-quintustilemap)
   - [Tiled JSON Types](#21-tiled-json-types)
   - [Tiled Parser](#22-tiled-parser)
   - [TileMap Node](#23-tilemap-node)
   - [Tile Collision Generation](#24-tile-collision-generation)
   - [File Structure](#25-file-structure)
3. [Package: @quintus/camera](#3-package-quintuscamera)
   - [Camera Node](#31-camera-node)
   - [View Transform Computation](#32-view-transform-computation)
   - [Coordinate Conversion](#33-coordinate-conversion)
   - [File Structure](#34-file-structure)
4. [Cross-Cutting Concerns](#4-cross-cutting-concerns)
   - [Dependency Direction](#41-dependency-direction)
   - [Performance](#42-performance)
   - [Determinism](#43-determinism)
   - [Error Handling](#44-error-handling)
5. [Test Plan](#5-test-plan)
6. [Demo: Scrolling Platformer](#6-demo-scrolling-platformer)
7. [Definition of Done](#7-definition-of-done)
8. [Execution Order](#8-execution-order)

---

## 1. Core Changes

Phase 4 requires two small changes to `@quintus/core`. Both are additive and backward-compatible.

### 1.1 Scene.viewTransform

**File:** `packages/core/src/scene.ts`

Add a public `viewTransform` property to `Scene`. The renderer uses this to transform all rendered nodes from world space to screen space. Default is `Matrix2D.IDENTITY` (no transform — the world origin is the screen origin, matching Phase 1–3 behavior).

```typescript
import { Matrix2D } from "@quintus/math";

export class Scene extends Node {
	// ... existing code ...

	/**
	 * View transform applied during rendering.
	 * Converts world coordinates to screen coordinates.
	 * Set by Camera node or custom code. Default: identity (no transform).
	 */
	viewTransform: Matrix2D = Matrix2D.IDENTITY;
}
```

**Why on Scene, not on Renderer?**
- Scene is the natural owner — different scenes can have different view transforms.
- No new interface methods or core abstractions needed.
- Camera sets it from `onUpdate()`; renderer reads it during `render()` — clean separation.
- Custom code can set it without using Camera at all (cutscenes, screen transitions, etc.).
- When scenes switch, each scene's viewTransform resets to identity automatically.

### 1.2 Canvas2DRenderer Update

**File:** `packages/core/src/canvas2d-renderer.ts`

Update the `render()` method to apply `scene.viewTransform` when drawing nodes. When `viewTransform` is identity (default), the per-node transform is unchanged.

```typescript
render(scene: Scene): void {
	const ctx = this.ctx;

	// 1. Clear
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, this.gameWidth, this.gameHeight);
	if (this.backgroundColor) {
		ctx.fillStyle = this.backgroundColor;
		ctx.fillRect(0, 0, this.gameWidth, this.gameHeight);
	}

	// 2. Rebuild render list only when dirty
	if (this._renderListDirty) {
		this.renderList.length = 0;
		this.collectVisible(scene, this.renderList);
		this.renderList.sort((a, b) => a.zIndex - b.zIndex);
		this._renderListDirty = false;
	}

	// 3. Get the view transform (set by Camera or custom code)
	const vt = scene.viewTransform;
	const hasView = vt !== Matrix2D.IDENTITY;

	// 4. Draw each node
	for (const node of this.renderList) {
		ctx.save();

		if (hasView) {
			// Compose view × node global transform
			const t = vt.multiply(node.globalTransform);
			ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
		} else {
			// Fast path: no camera, same as before
			const t = node.globalTransform;
			ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
		}

		try {
			node.onDraw(this.drawContext);
		} catch (_err) {
			// Lifecycle error handling is done by scene
		}

		ctx.restore();
	}
}
```

**Performance note:** When no Camera is used, `scene.viewTransform` is `Matrix2D.IDENTITY` and the reference-equality check (`vt !== Matrix2D.IDENTITY`) avoids the per-node matrix multiply entirely. Zero overhead for games that don't use camera.

When a Camera is active, one `Matrix2D.multiply()` per visible node is ~6 multiply + 6 add operations. For 500 visible nodes, that's ~6000 FLOPs — negligible.

---

## 2. Package: `@quintus/tilemap`

Size budget: **~5KB gzipped**

Dependencies: `@quintus/core`, `@quintus/math`, `@quintus/physics` (workspace deps)

### 2.1 Tiled JSON Types

**File:** `packages/tilemap/src/tiled-types.ts`

Type definitions for the Tiled JSON export format. We support a focused subset of Tiled's features — enough for 2D platformers, top-down RPGs, and puzzle games. Unsupported features (infinite maps, Wang tiles, terrain) are silently ignored.

```typescript
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
```

**Design decisions:**
- **Subset only.** We don't support infinite maps, external tilesets (.tsx), image layers, group layers, or Wang tiles. These can be added later if needed.
- **Flip flags as constants.** Tiled packs flip/rotate state into the high 3 bits of each tile GID. We export named constants for clarity and mask them in the parser.
- **Per-tile collision.** Tiled allows defining collision shapes per tile in the tileset editor. We support this for cases where the greedy rect merge isn't sufficient (e.g. slopes, irregular shapes).

### 2.2 Tiled Parser

**File:** `packages/tilemap/src/tiled-parser.ts`

Parses and validates Tiled JSON data. Converts raw Tiled JSON into normalized internal structures that TileMap uses.

```typescript
import type { Rect } from "@quintus/math";
import type {
	TiledMap,
	TiledObject,
	TiledObjectGroup,
	TiledProperty,
	TiledTileLayer,
	TiledTileset,
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
	properties: Map<string, boolean | number | string>;
	polygon?: Array<{ x: number; y: number }>;
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
 * Parse a Tiled JSON map into normalized internal structures.
 * Validates required fields and resolves tile GIDs to tileset-local IDs.
 *
 * @throws If the JSON is missing required fields or has invalid data.
 */
export function parseTiledMap(json: TiledMap): ParsedMap;

/**
 * Resolve a global tile ID to a local tile ID and tileset.
 * Handles flip flag extraction and tileset lookup.
 */
export function resolveGlobalTileId(
	gid: number,
	tilesets: TiledTileset[],
): ResolvedTile | null;

/**
 * Convert a TiledProperty array to a Map for easy lookup.
 */
export function parseProperties(
	props?: TiledProperty[],
): Map<string, boolean | number | string>;
```

**Implementation details:**

1. **GID resolution:** Tilesets are sorted by `firstgid` descending. For a given GID, find the first tileset where `firstgid <= gid`. Local ID = `gid - firstgid`.

2. **Flip flag extraction:** Before GID resolution, extract the high 3 bits:
   ```typescript
   const flipH = (gid & FLIPPED_HORIZONTALLY_FLAG) !== 0;
   const flipV = (gid & FLIPPED_VERTICALLY_FLAG) !== 0;
   const flipD = (gid & FLIPPED_DIAGONALLY_FLAG) !== 0;
   const tileId = gid & TILE_GID_MASK;
   ```

3. **Validation:** Throw on missing `width`, `height`, `tilewidth`, `tileheight`, or empty `layers`. Warn (don't throw) on unsupported layer types.

### 2.3 TileMap Node

**File:** `packages/tilemap/src/tilemap.ts`

The main user-facing class. TileMap extends `Node2D` — it has a position in the scene tree and renders tiles via `onDraw`. It owns the parsed map data, provides query APIs, and can generate collision shapes from tile layers.

```typescript
import { Node2D, type DrawContext } from "@quintus/core";
import { Rect, Vec2 } from "@quintus/math";
import type { NodeConstructor, Node } from "@quintus/core";
import type { ParsedMap, ParsedObject, ParsedTileLayer, ParsedObjectLayer } from "./tiled-parser.js";

export class TileMap extends Node2D {
	// === Map Data ===

	/** Asset key for the Tiled JSON file (loaded via game.assets). */
	asset = "";

	/** Override tileset image key. Default: uses the image path from the Tiled JSON. */
	tilesetImage: string | null = null;

	// === Internal State ===
	private _parsed: ParsedMap | null = null;
	private _collisionGenerated = false;

	// === Lifecycle ===

	/**
	 * Called when the node enters the tree.
	 * Loads and parses the Tiled JSON from the asset loader.
	 */
	onReady(): void {
		if (this.asset) {
			this._loadMap();
		}
	}

	// === Map Properties ===

	/** Map width in tiles. */
	get mapWidth(): number;

	/** Map height in tiles. */
	get mapHeight(): number;

	/** Tile width in pixels. */
	get tileWidth(): number;

	/** Tile height in pixels. */
	get tileHeight(): number;

	/** Total map bounds in pixels. */
	get bounds(): Rect;

	/** Whether the map has been loaded and parsed. */
	get isLoaded(): boolean;

	// === Tile Queries ===

	/**
	 * Get the tile ID at a grid position.
	 * @param col Column index (0-based).
	 * @param row Row index (0-based).
	 * @param layer Layer name. Default: first tile layer.
	 * @returns Tile ID (local, 0-based) or 0 if empty/out of bounds.
	 */
	getTileAt(col: number, row: number, layer?: string): number;

	/**
	 * Set the tile ID at a grid position.
	 * Useful for destructible terrain, tile-based puzzles, etc.
	 * @param col Column index.
	 * @param row Row index.
	 * @param tileId Local tile ID (0 = empty).
	 * @param layer Layer name. Default: first tile layer.
	 */
	setTileAt(col: number, row: number, tileId: number, layer?: string): void;

	/**
	 * Convert a world position to tile grid coordinates.
	 * Accounts for the TileMap's position in the scene.
	 */
	worldToTile(worldPos: Vec2): Vec2;

	/**
	 * Convert tile grid coordinates to world position (center of tile).
	 */
	tileToWorld(col: number, row: number): Vec2;

	// === Object Layer Queries ===

	/**
	 * Get a named spawn point from any object layer.
	 * Spawn points are point objects with a specific name.
	 * @returns World position of the spawn point.
	 * @throws If the spawn point is not found.
	 */
	getSpawnPoint(name: string): Vec2;

	/**
	 * Get all objects from a named object layer.
	 */
	getObjects(layerName: string): ParsedObject[];

	/**
	 * Spawn nodes from an object layer using a type → constructor mapping.
	 *
	 * For each object in the named layer whose `type` matches a key in `mapping`,
	 * the corresponding Node class is instantiated, positioned, and added as a
	 * child of this TileMap.
	 *
	 * Object properties from Tiled are passed as constructor-less direct assignment:
	 * each property key is set on the node if the node has a matching public property.
	 *
	 * @param layerName The object layer to spawn from.
	 * @param mapping Type name → Node constructor.
	 * @returns Array of spawned nodes.
	 *
	 * @example
	 * ```typescript
	 * const spawned = tileMap.spawnObjects("entities", {
	 *   Player: Player,
	 *   Coin: Coin,
	 *   Enemy: PatrolEnemy,
	 * });
	 * ```
	 */
	spawnObjects(
		layerName: string,
		mapping: Record<string, NodeConstructor>,
	): Node[];

	// === Tile Collision ===

	/**
	 * Generate StaticCollider + CollisionShape children from solid tiles.
	 *
	 * Solid tiles are identified by:
	 * 1. Tiles with a `solid: true` custom property in the tileset, OR
	 * 2. All non-empty tiles in the specified layer (if `allSolid` is true).
	 *
	 * Adjacent solid tiles are merged into larger rectangles using a greedy
	 * algorithm to minimize the number of collision shapes (see §2.4).
	 *
	 * Requires PhysicsPlugin to be installed.
	 *
	 * @param options.layer Tile layer name to generate collision from. Default: first tile layer.
	 * @param options.allSolid Treat all non-empty tiles as solid. Default: false.
	 * @param options.collisionGroup Collision group for generated colliders. Default: "default".
	 * @returns Number of StaticCollider nodes created.
	 */
	generateCollision(options?: {
		layer?: string;
		allSolid?: boolean;
		collisionGroup?: string;
	}): number;

	// === Rendering ===

	/**
	 * Render visible tiles. Uses viewport culling to only draw tiles
	 * within the camera's visible area.
	 */
	onDraw(ctx: DrawContext): void;

	// === Map Properties ===

	/**
	 * Get a map-level custom property.
	 */
	getProperty<T extends boolean | number | string>(name: string): T | undefined;
}
```

**Design decisions:**

- **Extends Node2D.** TileMap is a visual node with a position in the world. This allows placing multiple tilemaps at different positions (e.g. a foreground and background map) and applying transforms.

- **Asset-based loading.** The Tiled JSON must be pre-loaded via `game.assets.load({ json: ["level1.json"] })`. TileMap reads it from the asset loader in `onReady()`. This matches the engine's asset loading pattern.

- **Collision is opt-in.** `generateCollision()` must be called explicitly. This avoids forcing a `@quintus/physics` dependency at runtime for games that use tilemaps without collision (e.g. visual-only background maps). The import is present in the package but tree-shaking eliminates unused code.

- **spawnObjects uses direct property assignment.** Instead of passing Tiled properties through constructors, we set them as properties on the created node. This works because our nodes use property initialization (`speed = 200`), and Tiled properties can override those defaults. Unknown properties are silently ignored.

- **setTileAt enables dynamic maps.** Destructible terrain, tile-based puzzles, and procedural generation all require runtime tile modification. Modifying a tile marks the render cache dirty.

### 2.4 Tile Collision Generation

**File:** `packages/tilemap/src/tile-collision.ts`

The collision generation algorithm merges adjacent solid tiles into larger rectangular collision shapes. This dramatically reduces the number of StaticCollider nodes (and therefore physics objects) compared to one-collider-per-tile.

**Algorithm: Greedy Rectangle Merge**

```
Input:  solid[height][width] — boolean grid (true = solid tile)
Output: List of { col, row, spanW, spanH } rectangles

1. Create visited[height][width], all false.
2. For each cell (row, col) in row-major order:
   a. If !solid[row][col] OR visited[row][col], skip.
   b. Extend RIGHT: find maxW = number of consecutive solid, unvisited
      tiles starting at (row, col).
   c. Extend DOWN: for each subsequent row below, check if the entire
      span [col, col+maxW) is solid and unvisited. Count maxH rows.
   d. Mark all cells in the rectangle [col..col+maxW, row..row+maxH)
      as visited.
   e. Emit rectangle { col, row, spanW: maxW, spanH: maxH }.
```

**Example:**

```
Solid tiles (X = solid, . = empty):
X X X X .
X X X X .
. . X X .
. . X X .

Step 1: Start at (0,0). Extend right: 4. Extend down: 2 rows. → Rect(0,0,4,2)
Step 2: Start at (2,2). Extend right: 2. Extend down: 2 rows. → Rect(2,2,2,2)

Result: 2 collision shapes instead of 12 individual tiles.
```

**Typical reduction:** A level with 1000 solid tiles might produce 50–100 merged rectangles (~10–20× reduction).

```typescript
import type { StaticCollider } from "@quintus/physics";

/** A merged rectangle of solid tiles. */
export interface MergedRect {
	/** Top-left column. */
	col: number;
	/** Top-left row. */
	row: number;
	/** Width in tiles. */
	spanW: number;
	/** Height in tiles. */
	spanH: number;
}

/**
 * Run greedy rectangle merging on a solid tile grid.
 *
 * @param solid Row-major boolean array (true = solid).
 * @param width Grid width in tiles.
 * @param height Grid height in tiles.
 * @returns Array of merged rectangles.
 */
export function mergeRects(
	solid: boolean[],
	width: number,
	height: number,
): MergedRect[];

/**
 * Build a solid-tile grid from a parsed tile layer.
 *
 * @param layer Parsed tile layer.
 * @param solidTileIds Set of local tile IDs that are solid.
 *        If null, all non-empty tiles are treated as solid.
 * @returns Row-major boolean array.
 */
export function buildSolidGrid(
	layer: ParsedTileLayer,
	solidTileIds: Set<number> | null,
): boolean[];

/**
 * Create StaticCollider + CollisionShape nodes from merged rectangles.
 *
 * Each merged rectangle becomes one StaticCollider child of the TileMap,
 * with a single rect CollisionShape sized to cover the merged area.
 *
 * @param rects Merged rectangles from mergeRects().
 * @param tileWidth Tile width in pixels.
 * @param tileHeight Tile height in pixels.
 * @param collisionGroup Collision group name.
 * @param parent Node to add colliders to (the TileMap).
 * @returns Array of created StaticCollider nodes.
 */
export function createColliders(
	rects: MergedRect[],
	tileWidth: number,
	tileHeight: number,
	collisionGroup: string,
	parent: Node2D,
): StaticCollider[];
```

**Per-tile collision shapes:** When tiles define collision shapes in Tiled's collision editor (via `tiles[n].objectgroup`), we use those shapes directly instead of full-tile rectangles. Per-tile collision shapes are not merged — each tile with custom collision gets its own StaticCollider. This supports slopes, half-tiles, and irregular shapes.

### 2.5 File Structure

```
packages/tilemap/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts               # Public exports
    ├── tiled-types.ts         # Tiled JSON type definitions + flip flag constants
    ├── tiled-parser.ts        # parseTiledMap(), resolveGlobalTileId(), parseProperties()
    ├── tilemap.ts             # TileMap node class
    ├── tile-collision.ts      # mergeRects(), buildSolidGrid(), createColliders()
    │
    ├── tiled-parser.test.ts   # Parser: GID resolution, flip flags, validation, properties
    ├── tilemap.test.ts        # TileMap: loading, queries, spawning, setTileAt
    ├── tile-collision.test.ts # Collision: greedy merge, solid grid, collider creation
    └── integration.test.ts    # Full map load → collision → camera → render
```

Size budget: **~5KB gzipped**. Dependencies: `@quintus/core`, `@quintus/math`, `@quintus/physics`.

---

## 3. Package: `@quintus/camera`

Size budget: **~3KB gzipped**

Dependencies: `@quintus/core`, `@quintus/math`

### 3.1 Camera Node

**File:** `packages/camera/src/camera.ts`

Camera extends `Node` (not `Node2D`). It does not render visually and does not participate in the scene tree's transform cascade. Instead, it computes a `viewTransform` matrix that the renderer applies to all Node2D nodes.

```typescript
import { Node, type Signal, signal } from "@quintus/core";
import { Matrix2D, Rect, Vec2 } from "@quintus/math";

export class Camera extends Node {
	// === Position ===

	/**
	 * Camera position in world space (what the camera is centered on).
	 * Auto-updated when following a target. Can be set manually for
	 * cutscenes or fixed cameras.
	 */
	readonly position: Vec2 = new Vec2(0, 0);

	// === Follow ===

	/**
	 * Node to follow. When set, the camera interpolates toward
	 * this node's globalPosition each frame. Set to null for
	 * manual camera control.
	 */
	follow: Node2D | null = null;

	/**
	 * Offset from the follow target in world space.
	 * Useful for looking ahead in the direction of movement.
	 */
	readonly offset: Vec2 = new Vec2(0, 0);

	/**
	 * Smoothing factor for following. Controls how quickly the camera
	 * catches up to the target.
	 *
	 * - `0` = instant snap (no smoothing)
	 * - `0.1` = fast follow (responsive, slight lag)
	 * - `0.5` = moderate smoothing
	 * - `0.9` = very slow, cinematic follow
	 *
	 * Uses framerate-independent exponential decay:
	 * `pos = lerp(pos, target, 1 - smoothing^(dt * 60))`
	 */
	smoothing = 0;

	// === Zoom ===

	/**
	 * Zoom level. 1 = 100% (no zoom), 2 = 200% (2x magnification).
	 * For pixel-art games, use integer values (2, 3, 4) for crisp scaling.
	 */
	zoom = 1;

	/**
	 * When true, zoom snaps to the nearest integer for pixel-perfect
	 * rendering. Default: false.
	 */
	pixelPerfectZoom = false;

	// === Bounds ===

	/**
	 * World-space bounds that the camera view cannot exceed.
	 * Set to the map bounds to prevent showing outside the level.
	 * null = no bounds (camera can go anywhere).
	 */
	bounds: Rect | null = null;

	// === Dead Zone ===

	/**
	 * Dead zone rectangle in screen-space pixels, centered on screen.
	 * When the follow target is within the dead zone, the camera doesn't
	 * move. This prevents the camera from jittering on small movements.
	 *
	 * null = no dead zone (camera always follows).
	 *
	 * Example: `new Rect(-32, -32, 64, 64)` creates a 64×64 pixel
	 * dead zone at the center of the screen.
	 */
	deadZone: Rect | null = null;

	// === Shake ===

	/**
	 * Trigger a camera shake effect.
	 *
	 * @param intensity Maximum shake offset in pixels.
	 * @param duration Duration in seconds.
	 */
	shake(intensity: number, duration: number): void;

	/** Whether the camera is currently shaking. */
	get isShaking(): boolean;

	// === Signals ===

	/** Emitted when the camera finishes a shake. */
	readonly shakeFinished: Signal<void> = signal<void>();

	// === Computed Properties ===

	/**
	 * The view transform matrix that converts world → screen coordinates.
	 * Applied by the renderer to transform all visible nodes.
	 *
	 * Composed as: translate(viewport/2) × scale(zoom) × translate(-cameraPos)
	 */
	get viewTransform(): Matrix2D;

	/**
	 * The visible world-space rectangle (what the camera can see).
	 * Useful for culling, spawn triggers, etc.
	 */
	get visibleRect(): Rect;

	// === Coordinate Conversion ===

	/**
	 * Convert a screen-space position to world-space.
	 * Useful for mouse/touch input in a scrolling game.
	 */
	screenToWorld(screenPos: Vec2): Vec2;

	/**
	 * Convert a world-space position to screen-space.
	 * Useful for UI positioning relative to game objects.
	 */
	worldToScreen(worldPos: Vec2): Vec2;

	// === Lifecycle ===

	/**
	 * Update camera position, shake, and set the scene's viewTransform.
	 * Runs once per frame after all nodes' onUpdate.
	 */
	onUpdate(dt: number): void;
}
```

**Design decisions:**

- **Extends Node, not Node2D.** Camera's "position" is a logical concept — where the camera looks — not a scene-graph transform that cascades to children. If Camera extended Node2D, its position would participate in the parent→child transform chain, which is semantically wrong (children of the camera shouldn't move when the camera moves). Using Node also avoids unnecessary dirty-flag overhead.

- **position is a Vec2, not inherited from Node2D.** Direct control over the camera's world position. When following a target, `onUpdate()` writes to it. Users can also write to it directly for manual camera control.

- **Smoothing via exponential decay.** `pos = lerp(pos, target, 1 - smoothing^(dt * 60))` provides framerate-independent interpolation. The `* 60` normalization means a smoothing value feels the same at 30fps, 60fps, and 144fps. At 60fps, `smoothing = 0.1` means the camera covers 90% of the distance each frame.

- **Dead zone in screen space.** The dead zone is defined in pixels relative to the screen center. This is more intuitive than world-space dead zones because it's independent of zoom level.

- **Deterministic shake.** Shake offsets are computed from the game's `SeededRandom`, not `Math.random()`. Same seed + same shake call = identical visual result. Shake uses linear decay: `currentIntensity = intensity × (1 - elapsed/duration)`.

- **Only one camera per scene.** The last Camera to call `scene.viewTransform = ...` wins. No multi-camera system — that's an advanced feature for a future phase.

### 3.2 View Transform Computation

The view transform converts world coordinates to screen coordinates. It's composed of three operations applied in order:

```
World point → translate(-cameraPos) → scale(zoom) → translate(viewport/2) → Screen point
```

Or as a matrix:

```
viewTransform = T(viewportW/2, viewportH/2) × S(zoom, zoom) × T(-camX, -camY)
```

**Implementation:**

```typescript
private _viewTransformDirty = true;
private _cachedViewTransform = Matrix2D.IDENTITY;

get viewTransform(): Matrix2D {
	if (this._viewTransformDirty) {
		const game = this.game;
		if (!game) return Matrix2D.IDENTITY;

		// Effective position = base position + shake offset
		const px = this.position.x + this._shakeOffsetX;
		const py = this.position.y + this._shakeOffsetY;

		const hw = game.width / 2;
		const hh = game.height / 2;
		const z = this.pixelPerfectZoom ? Math.round(this.zoom) : this.zoom;

		// T(viewport/2) × S(zoom) × T(-camPos)
		// Expanded directly into matrix components for zero allocation:
		this._cachedViewTransform = new Matrix2D(
			z,       // a: scaleX
			0,       // b
			0,       // c
			z,       // d: scaleY
			-px * z + hw,  // e: translateX
			-py * z + hh,  // f: translateY
		);
		this._viewTransformDirty = false;
	}
	return this._cachedViewTransform;
}
```

**Design decision — direct matrix construction:** Instead of chaining `translate().scale().translate()` (which allocates 3 intermediate matrices), we compute the final matrix components directly. For the common case of no rotation, the math simplifies to just scale + translate.

**Bounds clamping algorithm (in onUpdate):**

```typescript
private _clampToBounds(): void {
	if (!this.bounds || !this.game) return;

	const z = this.pixelPerfectZoom ? Math.round(this.zoom) : this.zoom;
	const halfViewW = this.game.width / (2 * z);
	const halfViewH = this.game.height / (2 * z);

	// Camera position is the center of the view.
	// Clamp so the view rect stays inside bounds.
	const minX = this.bounds.x + halfViewW;
	const maxX = this.bounds.x + this.bounds.width - halfViewW;
	const minY = this.bounds.y + halfViewH;
	const maxY = this.bounds.y + this.bounds.height - halfViewH;

	// If the level is smaller than the viewport, center it
	if (minX > maxX) {
		this.position.x = this.bounds.x + this.bounds.width / 2;
	} else {
		this.position.x = clamp(this.position.x, minX, maxX);
	}

	if (minY > maxY) {
		this.position.y = this.bounds.y + this.bounds.height / 2;
	} else {
		this.position.y = clamp(this.position.y, minY, maxY);
	}
}
```

**Edge case — level smaller than viewport:** When the level bounds are smaller than the camera's visible area (e.g. a tiny level on a big screen), the camera centers the level on screen instead of clamping. This prevents the camera from oscillating between min and max bounds.

### 3.3 Coordinate Conversion

```typescript
screenToWorld(screenPos: Vec2): Vec2 {
	// Invert the view transform: screen → world
	const inv = this.viewTransform.invert();
	return inv.transformPoint(screenPos);
}

worldToScreen(worldPos: Vec2): Vec2 {
	return this.viewTransform.transformPoint(worldPos);
}
```

**Optimization note:** `screenToWorld` is called infrequently (mouse clicks, touch events), so the matrix inversion is acceptable. If profiling shows this is hot, we can cache the inverse alongside the view transform.

### 3.4 File Structure

```
packages/camera/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts              # Public exports
    ├── camera.ts             # Camera node class
    │
    ├── camera.test.ts        # Camera: follow, smoothing, bounds, shake, zoom, dead zone
    └── integration.test.ts   # Camera + Scene.viewTransform + renderer
```

Size budget: **~3KB gzipped**. Dependencies: `@quintus/core`, `@quintus/math`.

---

## 4. Cross-Cutting Concerns

### 4.1 Dependency Direction

```
@quintus/math       (no dependencies)
     ↑
@quintus/core       (depends on math)
     ↑
@quintus/physics    (depends on core, math)
     ↑
@quintus/tilemap    (depends on core, math, physics)

@quintus/camera     (depends on core, math — NO physics dependency)
```

- `@quintus/tilemap` → `@quintus/physics`: Required for `generateCollision()` which creates StaticCollider + CollisionShape nodes. Games that use tilemaps without collision still import the package, but tree-shaking eliminates unused physics code paths.

- `@quintus/camera` has **no physics dependency**. Camera is a pure view-transform node.

- Neither package modifies `@quintus/core` exports. The only core changes are the `Scene.viewTransform` property addition and the Canvas2DRenderer update (§1).

### 4.2 Performance

**Tile rendering budget:** 60fps with a 200×100 tile map at 2× zoom on a mid-range device.

**Hot paths and mitigations:**

1. **TileMap.onDraw (called once per frame per tile layer)**
   - **Viewport culling** is critical. Without it, a 200×100 map = 20,000 `drawImage` calls per layer. With culling at 400×300 viewport and 16×16 tiles, only ~500 draw calls per layer.
   - Visible tile range is computed from `scene.viewTransform` + game viewport size. The inverse transform is computed once per frame, not per tile.
   - Tiles are drawn with `ctx.image()` using `sourceRect` to select the correct tile from the tileset image.

2. **Camera.onUpdate (called once per frame)**
   - View transform is cached with dirty flagging. Only recomputed when position, zoom, or shake changes.
   - Direct matrix component computation (no intermediate allocations).
   - Bounds clamping uses simple comparisons — no allocation.

3. **Collision generation (called once at map load)**
   - Greedy rectangle merge is O(width × height) — one pass over the grid.
   - Typical 200×100 map with 30% solid tiles: ~6000 solid tiles → ~200 merged rects → ~200 StaticCollider nodes. Well within the spatial hash's budget.

4. **Object spawning (called once at map load)**
   - Linear scan of objects, hash lookup for type mapping. Negligible.

**Allocation targets:**
- TileMap.onDraw: Zero per-frame allocations after the first frame (visible rect cached, tile source rects pre-computed).
- Camera.onUpdate: Zero per-frame allocations (Vec2 position is mutated in-place, view transform matrix cached).

### 4.3 Determinism

- **Camera shake** uses `game.random` (SeededRandom), not `Math.random()`. Same seed + same shake parameters = identical shake pattern.
- **Camera smoothing** uses deterministic math (`lerp`, `clamp`). Framerate-independent formula ensures identical results at different frame rates: `1 - smoothing^(dt * 60)`.
- **Tile collision generation** is deterministic: same map JSON = same merged rects = same colliders, always.
- **No `Date.now()` or `Math.random()` anywhere** in either package.

### 4.4 Error Handling

- **Missing asset:** If `TileMap.asset` references a JSON file not loaded via `game.assets`, throw: `"TileMap: Asset 'level1' not found. Load it via game.assets.load({ json: ['level1.json'] }) before starting the scene."`
- **Invalid Tiled JSON:** `parseTiledMap()` throws on missing required fields with descriptive messages: `"Invalid Tiled map: missing 'width' property."`
- **Missing tileset image:** If the tileset image isn't loaded, tiles render as empty (no error). A warning is logged: `"TileMap: Tileset image 'tiles' not found. Tiles will not render."`
- **Missing spawn point:** `getSpawnPoint(name)` throws if the named point object doesn't exist: `"TileMap: Spawn point 'player_start' not found in any object layer."`
- **Unmatched object types:** `spawnObjects()` silently skips objects whose type has no entry in the mapping. This is intentional — not every Tiled object type needs a game entity.
- **Physics not installed:** `generateCollision()` throws if PhysicsPlugin isn't installed: `"TileMap.generateCollision() requires PhysicsPlugin. Call game.use(PhysicsPlugin()) first."`
- **Camera without game:** `camera.viewTransform` returns `Matrix2D.IDENTITY` if the camera isn't in a scene tree yet. No error.
- **Camera follow destroyed node:** If the follow target is destroyed, `follow` is automatically set to `null`. Camera holds position at the last followed location.

---

## 5. Test Plan

### @quintus/tilemap Tests

| Category | Tests | Details |
|----------|-------|---------|
| **Tiled Parser** | GID resolution | Correct local ID from global ID, multi-tileset lookup |
| | Flip flag extraction | Horizontal, vertical, diagonal, combinations |
| | Property parsing | bool, int, float, string types; empty properties |
| | Validation | Missing width throws, missing layers throws, extra fields ignored |
| | Multi-layer | Tile layers and object layers parsed correctly |
| **TileMap Node** | Asset loading | Loads JSON from asset loader, sets map dimensions |
| | getTileAt/setTileAt | Read/write tiles, out-of-bounds returns 0 |
| | worldToTile/tileToWorld | Coordinate conversion with TileMap at origin and offset |
| | getSpawnPoint | Returns correct Vec2, throws on missing |
| | getObjects | Returns all objects from named layer |
| | spawnObjects | Creates correct node types, sets positions, applies properties |
| | Rendering | onDraw calls ctx.image with correct source rects |
| | Viewport culling | Only draws tiles in visible area |
| | Flip rendering | Horizontally/vertically flipped tiles render correctly |
| **Tile Collision** | Greedy merge: single rect | One solid area → one rect |
| | Greedy merge: L-shape | L-shaped solids → 2 rects |
| | Greedy merge: scattered | Scattered solids → one rect per tile |
| | Greedy merge: full grid | All-solid grid → 1 rect |
| | Greedy merge: empty grid | No solids → 0 rects |
| | Greedy merge: checkerboard | Alternating solids → one rect per tile |
| | Collider creation | StaticCollider + CollisionShape positioned correctly |
| | Solid tile detection | Reads `solid: true` property from tileset |
| | allSolid mode | Treats all non-empty tiles as solid |
| | Per-tile collision | Custom shapes from tileset collision editor |
| **Integration** | Full map load | Load JSON → parse → render → collision → spawn |
| | Dynamic tiles | setTileAt changes tile, re-renders correctly |

### @quintus/camera Tests

| Category | Tests | Details |
|----------|-------|---------|
| **Follow** | Instant follow | smoothing=0: camera snaps to target position |
| | Smooth follow | smoothing>0: camera interpolates toward target |
| | Offset | Camera centers on target + offset |
| | Follow destroyed | Camera stops following, holds position |
| | No follow | Manual position control works |
| **Bounds** | Clamp inside | Camera doesn't show outside bounds |
| | Small level | Level smaller than viewport: camera centers level |
| | Edge cases | Camera at exact bounds corner, bounds with zoom |
| **Zoom** | Zoom in | Zoom=2: visible area halved, objects appear 2× larger |
| | Zoom out | Zoom=0.5: visible area doubled |
| | Pixel-perfect zoom | Snaps to nearest integer when enabled |
| | Zoom + bounds | Bounds clamping correct at different zoom levels |
| **Dead Zone** | Inside dead zone | Target within dead zone: camera doesn't move |
| | Exit dead zone | Target exits dead zone: camera follows to edge |
| | No dead zone | null dead zone: camera always follows |
| **Shake** | Duration | Shake decays to zero over specified duration |
| | Intensity | Shake offset within intensity bounds |
| | Determinism | Same seed produces identical shake pattern |
| | Signal | shakeFinished emits when shake ends |
| | During follow | Shake adds to follow position, doesn't interfere |
| **View Transform** | Identity | No camera: viewTransform is identity |
| | Translation | Camera at (100,50): world shifts left and up |
| | Zoom | Zoom=2: view transform scales by 2 |
| | Composition | Camera + zoom: correct combined transform |
| | Dirty flagging | Only recomputes when position/zoom/shake changes |
| **Coordinate Conversion** | screenToWorld | Correct inverse at various zoom/position |
| | worldToScreen | Correct forward transform |
| | Round-trip | screenToWorld(worldToScreen(p)) ≈ p |
| **Scene Integration** | viewTransform set | Camera.onUpdate sets scene.viewTransform |
| | Scene switch | New scene has identity viewTransform |
| | Renderer applies | Canvas2DRenderer uses scene.viewTransform |

---

## 6. Demo: Scrolling Platformer

The Phase 4 demo extends the Phase 2 platformer demo into a scrolling level with Tiled-designed maps. This assumes Phase 3 (sprites & input) is complete — if Phase 3 isn't finished, the demo falls back to raw keyboard input and rectangle rendering.

### Map Design

A simple Tiled map with:
- **"ground" tile layer:** Platform tiles with collision
- **"background" tile layer:** Decorative background (no collision)
- **"entities" object layer:** Player start, coins, and spawn points

Map size: 40×15 tiles at 16×16 pixels = 640×240 pixel level.

### Tileset

A minimal tileset image (`tiles.png`) with:
- Solid ground tiles (marked with `solid: true` property)
- Background decoration tiles
- Coin markers (for object layer reference)

### Demo Code

```typescript
import { Game, Scene } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { Actor, CollisionShape, PhysicsPlugin, Sensor, Shape } from "@quintus/physics";
import { Camera } from "@quintus/camera";
import { TileMap } from "@quintus/tilemap";
// Phase 3 imports (if available):
// import { InputPlugin } from "@quintus/input";
// import { AnimatedSprite } from "@quintus/sprites";

const game = new Game({
	width: 320,
	height: 240,
	pixelArt: true,
	backgroundColor: "#1a1a2e",
});

game.use(PhysicsPlugin({
	gravity: new Vec2(0, 800),
	collisionGroups: {
		player: { collidesWith: ["world", "coins"] },
		world: { collidesWith: ["player"] },
		coins: { collidesWith: ["player"] },
	},
}));

// === Player ===
class Player extends Actor {
	speed = 120;
	jumpForce = -280;
	collisionGroup = "player";

	onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.rect(12, 16);
		this.tag("player");
	}

	onFixedUpdate(dt: number) {
		this.velocity.x = 0;
		// Raw input (Phase 3 replaces with game.input)
		if (this._leftPressed) this.velocity.x = -this.speed;
		if (this._rightPressed) this.velocity.x = this.speed;
		if (this._jumpPressed && this.isOnFloor()) {
			this.velocity.y = this.jumpForce;
		}
		this.move(dt);
	}

	onDraw(ctx: DrawContext) {
		ctx.rect(new Vec2(-6, -8), new Vec2(12, 16), {
			fill: Color.fromHex("#4fc3f7"),
		});
	}

	_leftPressed = false;
	_rightPressed = false;
	_jumpPressed = false;
}

// === Coin ===
class Coin extends Sensor {
	collisionGroup = "coins";

	onReady() {
		super.onReady();
		this.addChild(CollisionShape).shape = Shape.circle(6);
		this.bodyEntered.connect((body) => {
			if (body.hasTag("player")) this.destroy();
		});
	}

	onDraw(ctx: DrawContext) {
		ctx.circle(Vec2.ZERO, 6, { fill: Color.fromHex("#ffd54f") });
	}
}

// === Main Scene ===
class Level1 extends Scene {
	onReady() {
		// Load tilemap
		const map = this.add(TileMap);
		map.asset = "level1";

		// Generate collision from ground layer
		map.generateCollision({
			layer: "ground",
			allSolid: true,
			collisionGroup: "world",
		});

		// Spawn entities from object layer
		map.spawnObjects("entities", {
			Coin: Coin,
		});

		// Spawn player at designated start point
		const player = this.add(Player);
		player.position = map.getSpawnPoint("player_start");

		// Camera follows player
		const camera = this.add(Camera);
		camera.follow = player;
		camera.smoothing = 0.1;
		camera.zoom = 2;
		camera.bounds = map.bounds;

		// Keyboard input (temporary, replaced by @quintus/input)
		const kd = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft") player._leftPressed = true;
			if (e.key === "ArrowRight") player._rightPressed = true;
			if (e.key === "ArrowUp" || e.key === " ") player._jumpPressed = true;
		};
		const ku = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft") player._leftPressed = false;
			if (e.key === "ArrowRight") player._rightPressed = false;
			if (e.key === "ArrowUp" || e.key === " ") player._jumpPressed = false;
		};
		document.addEventListener("keydown", kd);
		document.addEventListener("keyup", ku);
		this.sceneDestroyed.connect(() => {
			document.removeEventListener("keydown", kd);
			document.removeEventListener("keyup", ku);
		});
	}
}

// Pre-load assets, then start
game.assets.load({
	images: ["tiles.png"],
	json: ["level1.json"],
}).then(() => {
	game.start(Level1);
});
```

### What This Demo Exercises

| System | How It's Used |
|--------|---------------|
| **TileMap** | Load Tiled JSON, render tile layers, generate collision |
| **Tile collision** | Greedy merge reduces ~200 solid tiles to ~20 StaticColliders |
| **Object spawning** | Coins spawned from Tiled object layer |
| **Spawn points** | Player positioned via `getSpawnPoint("player_start")` |
| **Camera follow** | Smooth follow with zoom and bounds clamping |
| **Camera bounds** | Camera can't see outside the level |
| **Pixel-art zoom** | 2× zoom with `pixelArt: true` for crisp scaling |
| **Viewport culling** | Only visible tiles are drawn (scrolling level) |
| **Physics integration** | Player collides with merged tile colliders |

---

## 7. Definition of Done

All of these must be true before Phase 4 is complete:

### Core Changes
- [ ] `Scene.viewTransform` property added to `@quintus/core`
- [ ] `Canvas2DRenderer` applies `scene.viewTransform` when rendering
- [ ] No-camera fast path verified: identity check skips matrix multiply
- [ ] Existing Phase 1–3 tests still pass (backward compatible)

### @quintus/tilemap
- [ ] `@quintus/tilemap` builds and exports as ESM + CJS + `.d.ts`
- [ ] Parse Tiled JSON: tile layers, object layers, tilesets, properties
- [ ] Handle tile flip/rotate flags (bits 29–31)
- [ ] `getTileAt()` / `setTileAt()` work correctly, including out-of-bounds
- [ ] `worldToTile()` / `tileToWorld()` coordinate conversion is accurate
- [ ] `getSpawnPoint()` returns correct position from object layer
- [ ] `getObjects()` returns all objects from a named layer
- [ ] `spawnObjects()` creates correct node types with correct positions
- [ ] `generateCollision()` produces merged StaticCollider rects
- [ ] Greedy rectangle merge reduces 1000 solid tiles to <100 colliders
- [ ] Viewport culling: only visible tiles are drawn (verified by draw call count)
- [ ] `setTileAt()` updates rendering correctly
- [ ] Per-tile collision shapes from tileset editor work
- [ ] All tilemap tests pass

### @quintus/camera
- [ ] `@quintus/camera` builds and exports as ESM + CJS + `.d.ts`
- [ ] Camera follows target with instant snap (smoothing=0)
- [ ] Camera follows target with smooth interpolation
- [ ] Bounds clamping prevents camera from showing outside level
- [ ] Small-level centering works (level smaller than viewport)
- [ ] Zoom works correctly (visible area scales, bounds clamp adjusts)
- [ ] Pixel-perfect zoom snaps to integer when enabled
- [ ] Camera shake works with deterministic pattern (same seed = same result)
- [ ] Dead zone prevents camera movement on small target movements
- [ ] `screenToWorld()` / `worldToScreen()` are correct at various zoom/position
- [ ] Camera auto-stops following destroyed targets
- [ ] `shakeFinished` signal fires correctly
- [ ] All camera tests pass

### Demo
- [ ] Scrolling platformer level runs in browser
- [ ] Level designed in Tiled, loaded as JSON
- [ ] Player can run and jump on tile-collision platforms
- [ ] Camera follows player with smooth scrolling
- [ ] Camera stays within map bounds
- [ ] 2× pixel-art zoom renders crisply
- [ ] Coins spawn from object layer and can be collected

### Quality
- [ ] All tests pass, Biome lint clean, `pnpm build` succeeds
- [ ] Combined tilemap + camera bundle under 8KB gzipped
- [ ] No regressions in Phase 1–3 tests

---

## 8. Execution Order

Build bottom-up. Each step produces testable output.

```
Days 1–2: Core changes + Tiled parser
───────────────────────────────────────
Step 1: Scene.viewTransform + Canvas2DRenderer update        (0.5 day)
        → Core tests pass, existing demos still work
Step 2: Tiled JSON types + parser                            (1 day)
        → parseTiledMap() works with sample Tiled JSON
Step 3: Tile collision generation (greedy merge)             (0.5 day)
        → mergeRects() tested with various grid patterns

Days 3–4: TileMap node
───────────────────────────────────────
Step 4: TileMap node (loading, queries, rendering)           (1 day)
        → TileMap renders a Tiled level in the browser
Step 5: Object spawning + spawn points                       (0.5 day)
        → spawnObjects() and getSpawnPoint() work
Step 6: Collision integration + viewport culling             (0.5 day)
        → generateCollision() produces merged colliders
        → Viewport culling verified with draw call instrumentation

Days 5–6: Camera
───────────────────────────────────────
Step 7: Camera node (follow, smoothing, bounds, zoom)        (1 day)
        → Camera follows a target, clamps to bounds, zooms
Step 8: Shake, dead zone, coordinate conversion              (0.5 day)
        → Shake is deterministic, dead zone works, conversions correct

Day 7: Integration + Demo
───────────────────────────────────────
Step 9: Integration tests + scrolling platformer demo        (0.5 day)
        → Full demo runs: Tiled map + camera + physics

Day 8: Polish
───────────────────────────────────────
Step 10: Edge cases, performance verification, cleanup       (0.5 day)
         → All Definition of Done items checked off
```

**Total: ~8 working days (~1.5 weeks)**

### Parallelism Notes

- Steps 2–6 (tilemap) and Steps 7–8 (camera) can be developed in parallel since they have no code dependencies on each other. Camera depends only on `Scene.viewTransform` from Step 1.
- Step 9 (integration) requires both tilemap and camera.
