# 3D Dungeon Explorer — Detailed Design

> **Goal:** Build a complete 3D example game using Kenney's "Mini Dungeon" asset pack, showcasing the `@quintus/three` API (TileMap3D, GLTFModel, Camera3D, lights, Node3D movement) with real gameplay.
> **Outcome:** A playable 3D dungeon explorer where the player navigates grid-based rooms, collects treasure, avoids traps, and reaches the exit. Ships as `examples/3d-dungeon/` with bundled Kenney assets and automated tests.

---

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | TileMap3D engine class (prerequisite) | DONE |
| 1 | Asset pipeline + project setup | DONE |
| 2 | Dungeon grid + instanced floor/wall rendering | DONE |
| 3 | Player character + movement + camera | Pending |
| 4 | Items, traps, and scoring | Pending |
| 5 | HUD overlay + game flow (title/win/lose) | Pending |
| 6 | Tests + polish | Pending |

---

## Table of Contents

1. [Asset Pack: Kenney Mini Dungeon](#1-asset-pack-kenney-mini-dungeon)
2. [Game Design](#2-game-design)
3. [Architecture Overview](#3-architecture-overview)
4. [Phase 0: TileMap3D Engine Class](#4-phase-0-tilemap3d-engine-class)
5. [Phase 1: Asset Pipeline + Project Setup](#5-phase-1-asset-pipeline--project-setup)
6. [Phase 2: Dungeon Grid + Instanced Rendering](#6-phase-2-dungeon-grid--instanced-rendering)
7. [Phase 3: Player Character + Movement + Camera](#7-phase-3-player-character--movement--camera)
8. [Phase 4: Items, Traps, and Scoring](#8-phase-4-items-traps-and-scoring)
9. [Phase 5: HUD Overlay + Game Flow](#9-phase-5-hud-overlay--game-flow)
10. [Phase 6: Tests + Polish](#10-phase-6-tests--polish)
11. [Test Plan](#11-test-plan)
12. [Definition of Done](#12-definition-of-done)

---

## 1. Asset Pack: Kenney Mini Dungeon

**Pack:** [Kenney Mini Dungeon](https://kenney.nl/assets/mini-dungeon) (CC0 Public Domain)
**Format:** GLB (GLTF Binary) — loaded natively via `GLTFLoader`
**Style:** Low-poly, clean-shaded dungeon tiles, characters, weapons, and shields

### Available Models (25 GLB files)

The pack is downloaded at `tmp/kenney_mini-dungeon/`. These are the actual file names:

| Category | Files | Sizes |
|----------|-------|-------|
| **Floor** | `floor.glb`, `floor-detail.glb`, `dirt.glb` | 1.8KB, 12KB, 2.8KB |
| **Walls** | `wall.glb`, `wall-half.glb`, `wall-narrow.glb`, `wall-opening.glb` | 18KB, 16KB, 23KB, 19KB |
| **Characters** | `character-human.glb`, `character-orc.glb` | 218KB, 200KB |
| **Props** | `barrel.glb`, `chest.glb`, `column.glb`, `gate.glb`, `banner.glb` | 14-25KB each |
| **Items** | `coin.glb`, `trap.glb`, `stairs.glb` | 22KB, 19KB, 12KB |
| **Weapons** | `weapon-sword.glb`, `weapon-spear.glb`, `shield-round.glb`, `shield-rectangle.glb` | 7-16KB each |
| **Decoration** | `rocks.glb`, `stones.glb`, `wood-structure.glb`, `wood-support.glb` | 6-24KB each |

### Asset Inclusion

Assets are **checked into the repo** — the selected GLB files total ~350KB (well under concern for bloat). Only the files actually used by the game are copied in:

```
examples/3d-dungeon/assets/models/
├── floor.glb              ← instanced tile (TileMap3D)
├── wall.glb               ← instanced tile (TileMap3D)
├── character-human.glb    ← player (GLTFModel, animated)
├── coin.glb               ← collectible (GLTFModel)
├── trap.glb               ← spike hazard (GLTFModel)
├── stairs.glb             ← level exit (GLTFModel)
├── chest.glb              ← bonus treasure (GLTFModel)
└── barrel.glb             ← decoration (GLTFModel)
```

A `LICENSE-KENNEY.txt` crediting Kenney (CC0) is placed alongside.

> **Fallback:** If GLB assets fail to load, colored cube/plane meshes render instead. Full gameplay still works.

---

## 2. Game Design

### Concept

A grid-based 3D dungeon explorer. The player moves tile-by-tile through dungeon rooms, collects treasure (coins/chests), avoids spike traps, and reaches the exit stairs. Three small levels of increasing complexity.

### Gameplay Loop

```
Start → Title Scene → Level 1 → Level 2 → Level 3 → Win Scene
                                                ↓ (health=0)
                                          Game Over Scene
```

### Controls

| Action | Keys | Gamepad |
|--------|------|---------|
| Move up | W / ArrowUp | Left stick up |
| Move down | S / ArrowDown | Left stick down |
| Move left | A / ArrowLeft | Left stick left |
| Move right | D / ArrowRight | Left stick right |
| Interact | E / Space | A button |

### Core Mechanics

- **Grid movement:** Player moves one tile per input (smooth interpolated animation, ~0.2s per move)
- **Turn-based feel:** Movement is discrete, one tile at a time, with animation lerp
- **Treasure:** Coins (+10 points) and chests (+50 points) scattered in rooms
- **Traps:** Spike tiles that deal damage when stepped on (visible, player must navigate around)
- **Health:** 3 hearts, displayed in HUD overlay — lose all hearts → game over
- **Exit:** Stairs tile — step on it to advance to next level

### Level Design

Levels are defined as 2D string grids in code (no external tilemap editor needed):

```
Level 1 (8x8):        Level 2 (10x10):      Level 3 (12x12):
########               ##########            ############
#P.....#               #P.......#            #P.........#
#..C...#               #..##.C..#            #..###..C..#
#......#               #..##....#            #..#.T..#..#
#...T..#               #...T....#            #....C..#..#
#......#               #....##..#            #.####.....#
#....CE#               #.C..##.E#            #......T...#
########               #........#            #..##.##...#
                        ##########            #..##......#
                                              #.....C..T.#
                                              #.........E#
                                              ############

Legend: # = wall, . = floor, P = player start,
        C = coin, T = trap, E = exit stairs
```

---

## 3. Architecture Overview

### Efficient Tile Rendering via TileMap3D

The dungeon grid uses `TileMap3D` — a new engine class in `@quintus/three` that renders tile grids via `THREE.InstancedMesh`. Instead of creating one `GLTFModel` per floor/wall tile (which would mean 144 GLTF clones for a 12x12 grid), TileMap3D extracts the geometry and material from each GLTF model **once**, then renders all instances of that tile type in a **single draw call**.

```
Naive approach:  144 tiles × 1 GLTFModel each = 144 draw calls + 144 clones
TileMap3D:       2 tile types × 1 InstancedMesh each = 2 draw calls + 0 clones
```

### Scene Tree (Level Scene)

```
Scene (DungeonLevel)
├── DungeonGrid (extends TileMap3D)      ← 2 InstancedMesh (floor + wall)
├── CoinItem × N (Node3D)               ← spinning coins (few instances)
├── TrapTile × N (Node3D)               ← spike visuals
├── ExitStairs (GLTFModel | MeshNode)    ← single instance
├── PlayerCharacter (GLTFModel)          ← knight model + animations
├── Camera3D                             ← follows player
├── AmbientLight                         ← base illumination
├── DirectionalLight                     ← sun/main light + shadows
└── HUD (Layer, renderFixed=true)        ← 2D overlay on 3D scene
    ├── ScoreLabel (Label)
    ├── HealthLabel (Label)
    └── LevelLabel (Label)
```

### File Structure

```
examples/3d-dungeon/
├── index.html
├── main.ts                 ← Game setup, plugins, asset loading
├── config.ts               ← Constants, input bindings
├── state.ts                ← reactiveState for score/health/level
├── assets.ts               ← Model manifest + fallback factory
├── tsconfig.json
├── vitest.config.ts
├── assets/
│   ├── models/             ← Kenney GLB files (checked in)
│   └── LICENSE-KENNEY.txt
├── entities/
│   ├── player.ts           ← PlayerCharacter (grid movement, animation)
│   ├── dungeon-grid.ts     ← DungeonGrid extends TileMap3D
│   ├── coin-item.ts        ← CoinItem (spinning collectible)
│   └── trap-tile.ts        ← TrapTile (spike damage visual)
├── scenes/
│   ├── dungeon-level.ts    ← Base level scene
│   ├── level1.ts           ← Level 1 (grid data)
│   ├── level2.ts           ← Level 2 (grid data)
│   ├── level3.ts           ← Level 3 (grid data)
│   ├── title-scene.ts      ← Title screen
│   ├── win-scene.ts        ← Victory screen
│   └── game-over-scene.ts  ← Game over screen
├── hud/
│   └── hud.ts              ← HUD overlay (health, score, level)
└── __tests__/
    ├── helpers.ts           ← Test utilities
    ├── grid.test.ts         ← DungeonGrid parsing tests
    ├── player.test.ts       ← Movement + collection tests
    └── flow.test.ts         ← Level progression tests
```

### Key Dependencies

```
@quintus/core       ← Game, Scene, Node, signals, reactiveState
@quintus/three      ← ThreePlugin, TileMap3D, GLTFModel, Camera3D, lights, MeshNode
@quintus/input      ← InputPlugin, keyboard/gamepad bindings
@quintus/ui         ← Label, Layer for HUD
@quintus/math       ← Vec2, Color
three               ← Three.js peer dep
```

---

## 4. Phase 0: TileMap3D Engine Class

**This phase adds a reusable `TileMap3D` class to `@quintus/three`** — an instanced 3D tile grid renderer analogous to the 2D `TileMap` in `@quintus/tilemap`.

- [ ] Add `Matrix4` and `InstancedMesh` mocks to `packages/three/src/__test-utils__/three-mock.ts`
- [ ] Create `packages/three/src/tilemap3d.ts` with `TileMap3D` class and `TileDef3D` interface
- [ ] Create `packages/three/src/tilemap3d.test.ts` with ~15 tests
- [ ] Export `TileMap3D` and `TileDef3D` from `packages/three/src/index.ts`
- [ ] Build and test `@quintus/three`

### `TileDef3D` Interface

```typescript
export interface TileDef3D {
	geometry: THREE.BufferGeometry;
	material: THREE.Material;
	offsetY?: number;       // Y placement offset (e.g. walls are taller)
	rotationY?: number;     // Y-axis rotation in radians
	castShadow?: boolean;
	receiveShadow?: boolean;
}
```

### `TileMap3D` Class

```typescript
export class TileMap3D extends Node3D {
	/** World units per grid cell. */
	tileSize = 2;
	/** Grid width in tiles. */
	width = 0;
	/** Grid height (depth) in tiles. */
	height = 0;

	private _grid: number[] = [];                      // flat row-major, 0 = empty
	private _tileDefs = new Map<number, TileDef3D>();
	private _instancedMeshes: THREE.InstancedMesh[] = [];

	// --- Tile registration ---

	/** Register a tile type with geometry + material. */
	defineTile(id: number, def: TileDef3D): void;

	/**
	 * Register a tile type from a GLTF scene.
	 * Extracts the first Mesh found, sharing its geometry and material
	 * (no clone — the asset system owns the data).
	 */
	defineTileFromGLTF(
		id: number,
		gltfScene: THREE.Object3D,
		options?: Partial<Omit<TileDef3D, "geometry" | "material">>,
	): void;

	// --- Grid manipulation ---

	/** Allocate grid of given dimensions, filled with 0 (empty). */
	setSize(width: number, height: number): void;

	/** Set tile ID at grid position. 0 = empty. */
	setTile(col: number, row: number, tileId: number): void;

	/** Get tile ID at grid position. Returns 0 for out-of-bounds. */
	getTile(col: number, row: number): number;

	/** Fill entire grid with a single tile ID. */
	fill(tileId: number): void;

	/**
	 * Parse string-array level data with character-to-id mapping.
	 * Sets size from the input dimensions, fills grid, and calls rebuild().
	 */
	parseGrid(lines: string[], charMap: Record<string, number>): void;

	// --- Rendering ---

	/**
	 * Rebuild all InstancedMesh objects from current grid state.
	 * Creates one THREE.InstancedMesh per tile type, sets instance matrices
	 * from grid positions. Old meshes are removed first.
	 */
	rebuild(): void;

	// --- Coordinate helpers ---

	/** Convert grid coords to world position. */
	gridToWorld(col: number, row: number): THREE.Vector3;

	/** Convert world position to grid coords (nearest tile). */
	worldToGrid(worldPos: THREE.Vector3): { col: number; row: number };

	/** Check if grid coords are within bounds. */
	isInBounds(col: number, row: number): boolean;

	// --- Lifecycle ---

	/** Disposes InstancedMesh wrappers but NOT shared geometry/material. */
	override onDestroy(): void;
}
```

### `rebuild()` Algorithm

```
1. Remove all existing InstancedMesh children from this.object3d
2. Count how many times each tile ID appears in grid
3. For each tile type with count > 0:
   a. Look up TileDef3D (geometry, material, offsetY, rotationY)
   b. Create THREE.InstancedMesh(geometry, material, count)
   c. Iterate grid, set instance matrix per occurrence:
      - matrix = makeTranslation(col * tileSize, offsetY, row * tileSize)
      - if rotationY: multiply by makeRotationY(rotationY)
      - mesh.setMatrixAt(idx, matrix)
   d. Set castShadow/receiveShadow
   e. Mark instanceMatrix.needsUpdate = true
   f. Add mesh to this.object3d
4. Store meshes in _instancedMeshes for cleanup tracking
```

### `defineTileFromGLTF()` Implementation

```typescript
defineTileFromGLTF(
	id: number,
	gltfScene: THREE.Object3D,
	options?: Partial<Omit<TileDef3D, "geometry" | "material">>,
): void {
	let foundMesh: THREE.Mesh | null = null;
	gltfScene.traverse((child) => {
		if (!foundMesh && child instanceof THREE.Mesh) {
			foundMesh = child;
		}
	});
	if (!foundMesh) {
		console.warn(`TileMap3D: no Mesh found for tile ${id}`);
		return;
	}
	this.defineTile(id, {
		geometry: foundMesh.geometry,
		material: Array.isArray(foundMesh.material)
			? foundMesh.material[0]
			: foundMesh.material,
		...options,
	});
}
```

### Renderer Integration

No changes needed. TileMap3D extends Node3D, so `ThreeRenderer._walkSync()` handles it like any other Node3D. The InstancedMesh children added by `rebuild()` are part of the Three.js scene graph automatically.

### Three.js Mock Additions

Add to `packages/three/src/__test-utils__/three-mock.ts`:

```typescript
export class Matrix4 {
	elements: number[] = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

	makeTranslation(x: number, y: number, z: number): Matrix4 {
		this.elements = [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1];
		return this;
	}

	makeRotationY(theta: number): Matrix4 {
		const c = Math.cos(theta);
		const s = Math.sin(theta);
		this.elements = [c,0,s,0, 0,1,0,0, -s,0,c,0, 0,0,0,1];
		return this;
	}

	multiply(_m: Matrix4): Matrix4 {
		return this;
	}

	clone(): Matrix4 {
		const m = new Matrix4();
		m.elements = [...this.elements];
		return m;
	}
}

export class InstancedMesh extends Mesh {
	count: number;
	instanceMatrix: { needsUpdate: boolean; array: Float32Array };
	private _matrices: Matrix4[] = [];

	constructor(geometry?: BufferGeometry, material?: Material, count = 0) {
		super(geometry, material);
		this.count = count;
		this.instanceMatrix = {
			needsUpdate: false,
			array: new Float32Array(count * 16),
		};
		this._matrices = Array.from({ length: count }, () => new Matrix4());
	}

	setMatrixAt(index: number, matrix: Matrix4): void {
		this._matrices[index] = matrix;
		this.instanceMatrix.array.set(matrix.elements, index * 16);
	}
}
```

### TileMap3D Tests

~15 test cases in `packages/three/src/tilemap3d.test.ts`:

- `setSize` initializes grid dimensions and zeroed array
- `setTile`/`getTile` round-trip
- Out-of-bounds `getTile` returns 0
- `fill` sets all cells
- `defineTile` stores definition
- `defineTileFromGLTF` extracts mesh from mock Object3D
- `defineTileFromGLTF` warns on empty scene
- `rebuild` creates one InstancedMesh per tile type
- `rebuild` sets correct instance count per type
- `rebuild` removes old meshes on re-call (no accumulation)
- Empty tiles (id=0) produce no InstancedMesh
- `parseGrid` sets size and tile IDs from string + charMap
- `parseGrid` auto-calls rebuild
- `gridToWorld`/`worldToGrid` coordinate math
- `isInBounds` edges and out-of-bounds

---

## 5. Phase 1: Asset Pipeline + Project Setup

- [x] Copy needed GLB files from `tmp/kenney_mini-dungeon/Models/GLB format/` to `examples/3d-dungeon/assets/models/`
- [x] Add `LICENSE-KENNEY.txt` crediting Kenney (CC0) to the assets directory
- [x] Create `examples/3d-dungeon/` directory structure
- [x] Create `index.html` with canvas, mobile viewport, dark background
- [x] Create `tsconfig.json` extending `../../tsconfig.base.json`
- [x] Create `assets.ts` with model manifest and fallback mesh factory
- [x] Create `config.ts` with game constants and input bindings
- [x] Create `state.ts` with reactive game state
- [x] Create `main.ts` with game initialization (placeholder scene)
- [ ] Verify `pnpm dev` serves the example at `http://localhost:3050/3d-dungeon/`

### `config.ts`

```typescript
export const TILE_SIZE = 2;        // World units per grid cell
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const MOVE_DURATION = 0.2;  // Seconds per grid move (animated)
export const COIN_SCORE = 10;
export const CHEST_SCORE = 50;
export const TRAP_DAMAGE = 1;
export const PLAYER_HEALTH = 3;
export const PLAYER_INVINCIBILITY = 1.0; // Seconds after taking damage

export const INPUT_BINDINGS: Record<string, string[]> = {
	move_up:    ["KeyW", "ArrowUp",    "gamepad:left-stick-up"],
	move_down:  ["KeyS", "ArrowDown",  "gamepad:left-stick-down"],
	move_left:  ["KeyA", "ArrowLeft",  "gamepad:left-stick-left"],
	move_right: ["KeyD", "ArrowRight", "gamepad:left-stick-right"],
	interact:   ["KeyE", "Space",      "gamepad:a"],
};
```

### `state.ts`

```typescript
import { reactiveState } from "@quintus/core";

export const gameState = reactiveState({
	score: 0,
	health: 3,
	maxHealth: 3,
	level: 1,
});
```

### `assets.ts` — Model Manifest + Fallback

```typescript
import type { Game } from "@quintus/core";
import * as THREE from "three";

/** Maps logical model names to GLB file paths for asset loading. */
export const MODEL_PATHS = [
	"assets/models/floor.glb",
	"assets/models/wall.glb",
	"assets/models/character-human.glb",
	"assets/models/coin.glb",
	"assets/models/trap.glb",
	"assets/models/stairs.glb",
	"assets/models/chest.glb",
	"assets/models/barrel.glb",
];

/**
 * Create a colored cube fallback when a model asset is missing.
 * Allows the game to run without downloaded assets.
 */
export function createFallbackMesh(
	color: number,
	width = 1,
	height = 1,
	depth = 1,
): THREE.Mesh {
	return new THREE.Mesh(
		new THREE.BoxGeometry(width, height, depth),
		new THREE.MeshStandardMaterial({ color }),
	);
}

/**
 * Check whether Kenney GLB assets loaded successfully.
 * Asset names are stripped from path: "assets/models/floor.glb" → "floor".
 */
export function hasModels(game: Game): boolean {
	return game.assets.get("floor") != null;
}
```

### `main.ts`

```typescript
import { Game } from "@quintus/core";
import { InputPlugin } from "@quintus/input";
import { ThreePlugin } from "@quintus/three";
import { GAME_WIDTH, GAME_HEIGHT, INPUT_BINDINGS } from "./config.js";
import { MODEL_PATHS } from "./assets.js";
import { TitleScene } from "./scenes/title-scene.js";
import { Level1 } from "./scenes/level1.js";
import { Level2 } from "./scenes/level2.js";
import { Level3 } from "./scenes/level3.js";
import { WinScene } from "./scenes/win-scene.js";
import { GameOverScene } from "./scenes/game-over-scene.js";

const game = new Game({
	width: GAME_WIDTH,
	height: GAME_HEIGHT,
	canvas: "game",
	renderer: null,       // Full 3D mode
	scale: "fit",
	seed: 42,
});

game.use(ThreePlugin({
	antialias: true,
	background: 0x111122,
	shadows: true,
}));
game.use(InputPlugin({ actions: INPUT_BINDINGS }));

game.registerScenes({
	title: TitleScene,
	level1: Level1,
	level2: Level2,
	level3: Level3,
	win: WinScene,
	"game-over": GameOverScene,
});

// Log individual asset load failures (load() always resolves)
game.assets.error.connect(({ asset }) => {
	console.warn(
		`Could not load "${asset}". Using fallback cubes.`,
	);
});

game.assets.load({ glb: MODEL_PATHS }).then(() => {
	game.start("title");
});
```

---

## 6. Phase 2: Dungeon Grid + Instanced Rendering

- [x] Create `entities/dungeon-grid.ts` — extends `TileMap3D`, defines floor/wall tiles from GLTF or fallback
- [x] Implement `parseLevel()` that defines tiles, parses grid, and auto-rebuilds
- [x] Add game-logic helpers (isWalkable, findChar, findAllChars) on top of TileMap3D base
- [ ] Verify dungeon renders in browser (2 draw calls for all floor+wall tiles)

### Why TileMap3D?

A 12x12 grid has 144 cells. The naive approach (one `GLTFModel` per cell) would create 144 `SkeletonUtils.clone()` calls and 144 draw calls. With `TileMap3D`, the grid renders in **2 draw calls** (one `InstancedMesh` for floors, one for walls) using shared geometry — zero clones.

### Wall Orientation

Kenney's `wall.glb` is a full-tile box model that looks correct from all angles. Room shapes emerge naturally from which cells are walls vs. floors — no per-wall rotation needed.

### `entities/dungeon-grid.ts`

```typescript
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { TileMap3D } from "@quintus/three";
import * as THREE from "three";
import { TILE_SIZE } from "../config.js";
import { hasModels } from "../assets.js";

/** Tile type IDs for the instanced grid. */
const TILE_FLOOR = 1;
const TILE_WALL = 2;

/** Maps level-data characters → tile IDs for the instanced grid.
 *  Non-wall characters all place a floor tile. */
const CHAR_MAP: Record<string, number> = {
	".": TILE_FLOOR,
	"#": TILE_WALL,
	P: TILE_FLOOR,
	C: TILE_FLOOR,
	T: TILE_FLOOR,
	E: TILE_FLOOR,
};

export class DungeonGrid extends TileMap3D {
	override tileSize = TILE_SIZE;

	/** Original character grid for game-logic lookups. */
	private _charGrid: string[][] = [];

	/**
	 * Parse a level from string lines.
	 * Defines tile types (from GLTF or fallback), fills grid, and rebuilds.
	 */
	parseLevel(lines: string[]): void {
		this._charGrid = lines.map((l) => l.split(""));
		this._defineTiles();
		this.parseGrid(lines, CHAR_MAP);
	}

	// --- Game-logic helpers ---

	/** Get the original character at a grid position. */
	charAt(gx: number, gz: number): string {
		return this._charGrid[gz]?.[gx] ?? "#";
	}

	/** Check if a grid position is walkable (not a wall, in bounds). */
	isWalkable(gx: number, gz: number): boolean {
		return this.isInBounds(gx, gz) && this.charAt(gx, gz) !== "#";
	}

	/** Find the first occurrence of a character. */
	findChar(ch: string): { gridX: number; gridZ: number } | null {
		for (let z = 0; z < this._charGrid.length; z++) {
			for (let x = 0; x < (this._charGrid[z]?.length ?? 0); x++) {
				if (this._charGrid[z][x] === ch) return { gridX: x, gridZ: z };
			}
		}
		return null;
	}

	/** Find all occurrences of a character. */
	findAllChars(ch: string): Array<{ gridX: number; gridZ: number }> {
		const results: Array<{ gridX: number; gridZ: number }> = [];
		for (let z = 0; z < this._charGrid.length; z++) {
			for (let x = 0; x < (this._charGrid[z]?.length ?? 0); x++) {
				if (this._charGrid[z][x] === ch) {
					results.push({ gridX: x, gridZ: z });
				}
			}
		}
		return results;
	}

	/** Mark a cell as plain floor (e.g. after collecting a coin). */
	clearCell(gx: number, gz: number): void {
		if (this._charGrid[gz]?.[gx]) {
			this._charGrid[gz][gx] = ".";
		}
	}

	// --- Internal ---

	private _defineTiles(): void {
		if (hasModels(this.game)) {
			const floorGltf = this.game.assets.get<GLTF>("floor");
			const wallGltf = this.game.assets.get<GLTF>("wall");
			if (floorGltf) {
				this.defineTileFromGLTF(TILE_FLOOR, floorGltf.scene, {
					receiveShadow: true,
				});
			}
			if (wallGltf) {
				this.defineTileFromGLTF(TILE_WALL, wallGltf.scene, {
					castShadow: true,
					receiveShadow: true,
				});
			}
		} else {
			this.defineTile(TILE_FLOOR, {
				geometry: new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE),
				material: new THREE.MeshStandardMaterial({ color: 0x555566 }),
				receiveShadow: true,
				rotationY: -Math.PI / 2,
			});
			this.defineTile(TILE_WALL, {
				geometry: new THREE.BoxGeometry(
					TILE_SIZE, TILE_SIZE * 1.5, TILE_SIZE,
				),
				material: new THREE.MeshStandardMaterial({ color: 0x665544 }),
				offsetY: TILE_SIZE * 0.75,
				castShadow: true,
				receiveShadow: true,
			});
		}
	}
}
```

---

## 7. Phase 3: Player Character + Movement + Camera

- [ ] Create `entities/player.ts` with grid-based movement
- [ ] Implement smooth position interpolation (ease in-out) in `onFixedUpdate`
- [ ] Integrate GLTFModel with `character-human.glb` (or fallback cube)
- [ ] Set up Camera3D with follow behavior
- [ ] Handle input: move one tile per keypress (`isJustPressed`, not held)
- [ ] Play walk animation during movement, idle when stopped
- [ ] Add reachedExit, collected, died signals

### `entities/player.ts`

```typescript
import { signal, type Signal } from "@quintus/core";
import { GLTFModel } from "@quintus/three";
import * as THREE from "three";
import {
	TILE_SIZE, MOVE_DURATION, TRAP_DAMAGE,
	PLAYER_INVINCIBILITY,
} from "../config.js";
import { gameState } from "../state.js";
import { hasModels, createFallbackMesh } from "../assets.js";
import type { DungeonGrid } from "./dungeon-grid.js";

export class PlayerCharacter extends GLTFModel {
	override src = "character-human";
	override modelScale = 1;
	override autoplay = false;

	/** Current grid position. */
	gridX = 0;
	gridZ = 0;

	/** Reference to dungeon grid for walkability checks. */
	dungeonGrid!: DungeonGrid;

	/** Fires when player reaches the exit. */
	readonly reachedExit: Signal<void> = signal<void>();
	/** Fires when player collects an item. */
	readonly collected: Signal<{ gridX: number; gridZ: number }> =
		signal<{ gridX: number; gridZ: number }>();
	/** Fires when player dies. */
	readonly died: Signal<void> = signal<void>();

	private _moving = false;
	private _moveStart = new THREE.Vector3();
	private _moveEnd = new THREE.Vector3();
	private _moveTime = 0;
	private _moveDuration = MOVE_DURATION;
	private _invincibleTimer = 0;

	override onReady(): void {
		if (hasModels(this.game)) {
			super.onReady();
			if (this.loaded && this.animationNames.includes("idle")) {
				this.play("idle");
			}
		} else {
			const mesh = createFallbackMesh(0x4488ff, 0.8, 1.2, 0.8);
			this.object3d.add(mesh);
			mesh.position.y = 0.6;
		}

		this.position.set(
			this.gridX * TILE_SIZE,
			0,
			this.gridZ * TILE_SIZE,
		);
	}

	override onFixedUpdate(dt: number): void {
		super.onUpdate(dt);

		if (this._invincibleTimer > 0) {
			this._invincibleTimer -= dt;
			this.visible = Math.floor(this._invincibleTimer * 10) % 2 === 0;
			if (this._invincibleTimer <= 0) {
				this.visible = true;
			}
		}

		if (this._moving) {
			this._updateMove(dt);
			return;
		}

		const input = this.game.input;
		let dx = 0;
		let dz = 0;

		if (input.isJustPressed("move_up")) dz = -1;
		else if (input.isJustPressed("move_down")) dz = 1;
		else if (input.isJustPressed("move_left")) dx = -1;
		else if (input.isJustPressed("move_right")) dx = 1;

		if (dx !== 0 || dz !== 0) {
			this._tryMove(dx, dz);
		}
	}

	private _tryMove(dx: number, dz: number): void {
		const newGx = this.gridX + dx;
		const newGz = this.gridZ + dz;

		if (!this.dungeonGrid.isWalkable(newGx, newGz)) return;

		this.gridX = newGx;
		this.gridZ = newGz;

		this._moving = true;
		this._moveTime = 0;
		this._moveStart.copy(this.position);
		this._moveEnd.set(newGx * TILE_SIZE, 0, newGz * TILE_SIZE);

		this.rotation.y = Math.atan2(dx, dz);

		if (this.loaded && this.animationNames.includes("walk")) {
			this.play("walk");
		}
	}

	private _updateMove(dt: number): void {
		this._moveTime += dt;
		const t = Math.min(this._moveTime / this._moveDuration, 1);
		const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

		this.position.set(
			this._moveStart.x + (this._moveEnd.x - this._moveStart.x) * ease,
			0,
			this._moveStart.z + (this._moveEnd.z - this._moveStart.z) * ease,
		);

		if (t >= 1) {
			this._moving = false;
			this.position.copy(this._moveEnd);

			if (this.loaded && this.animationNames.includes("idle")) {
				this.play("idle");
			}

			this._checkTile();
		}
	}

	private _checkTile(): void {
		const ch = this.dungeonGrid.charAt(this.gridX, this.gridZ);

		switch (ch) {
			case "C":
				this.collected.emit({
					gridX: this.gridX,
					gridZ: this.gridZ,
				});
				break;
			case "T":
				if (this._invincibleTimer <= 0) {
					this._takeDamage(TRAP_DAMAGE);
				}
				break;
			case "E":
				this.reachedExit.emit();
				break;
		}
	}

	private _takeDamage(amount: number): void {
		gameState.health = Math.max(0, gameState.health - amount);
		this._invincibleTimer = PLAYER_INVINCIBILITY;

		if (gameState.health <= 0) {
			this.died.emit();
		}
	}
}
```

### Camera Setup

```typescript
// In DungeonLevel.onReady():
const cam = this.add(Camera3D, {
	fov: 50,
	follow: this.player,
	followOffset: new THREE.Vector3(0, 12, 8),
	followSmoothing: 4,
});
cam.position.set(startCell.gridX * TILE_SIZE, 12, startCell.gridZ * TILE_SIZE + 8);
```

---

## 8. Phase 4: Items, Traps, and Scoring

- [ ] Create `entities/coin-item.ts` — spinning coin model, removed on collect
- [ ] Create `entities/trap-tile.ts` — spike model with visual indicator
- [ ] Place exit stairs (GLTFModel or MeshNode) at "E" tiles
- [ ] Wire coin collection → score update → coin destroy
- [ ] Wire trap → damage → invincibility flash

### `entities/coin-item.ts`

```typescript
import { Node3D, GLTFModel, MeshNode } from "@quintus/three";
import * as THREE from "three";
import { TILE_SIZE } from "../config.js";
import { hasModels } from "../assets.js";

export class CoinItem extends Node3D {
	gridX = 0;
	gridZ = 0;

	private _elapsed = 0;

	override onReady(): void {
		if (hasModels(this.game)) {
			this.add(GLTFModel, { src: "coin" });
		} else {
			this.add(MeshNode, {
				geometry: new THREE.BoxGeometry(0.4, 0.1, 0.4),
				material: new THREE.MeshStandardMaterial({ color: 0xffdd44 }),
				castShadow: true,
			});
		}

		this.position.set(
			this.gridX * TILE_SIZE,
			0.5,
			this.gridZ * TILE_SIZE,
		);
	}

	override onUpdate(dt: number): void {
		this._elapsed += dt;
		this.rotation.y += dt * 2;
		this.position.y = 0.5 + Math.sin(this._elapsed * 3) * 0.1;
	}
}
```

### `entities/trap-tile.ts`

```typescript
import { Node3D, GLTFModel, MeshNode } from "@quintus/three";
import * as THREE from "three";
import { TILE_SIZE } from "../config.js";
import { hasModels } from "../assets.js";

export class TrapTile extends Node3D {
	gridX = 0;
	gridZ = 0;

	override onReady(): void {
		if (hasModels(this.game)) {
			this.add(GLTFModel, { src: "trap" });
		} else {
			this.add(MeshNode, {
				geometry: new THREE.BoxGeometry(
					TILE_SIZE * 0.8, 0.3, TILE_SIZE * 0.8,
				),
				material: new THREE.MeshStandardMaterial({ color: 0xcc2222 }),
			});
		}

		this.position.set(
			this.gridX * TILE_SIZE,
			0.15,
			this.gridZ * TILE_SIZE,
		);
	}
}
```

### Item Wiring in DungeonLevel

```typescript
// In DungeonLevel.onReady(), after grid.parseLevel():

// Spawn coins
for (const cell of grid.findAllChars("C")) {
	const coin = this.add(CoinItem, {
		gridX: cell.gridX,
		gridZ: cell.gridZ,
	});
	this._coins.set(`${cell.gridX},${cell.gridZ}`, coin);
}

// Spawn traps (visual only — damage is checked by player)
for (const cell of grid.findAllChars("T")) {
	this.add(TrapTile, {
		gridX: cell.gridX,
		gridZ: cell.gridZ,
	});
}

// Spawn exit stairs
const exitCell = grid.findChar("E");
if (exitCell) {
	if (hasModels(this.game)) {
		const stairs = this.add(GLTFModel, { src: "stairs" });
		stairs.position.set(
			exitCell.gridX * TILE_SIZE, 0, exitCell.gridZ * TILE_SIZE,
		);
	} else {
		const stairs = this.add(MeshNode, {
			geometry: new THREE.BoxGeometry(
				TILE_SIZE * 0.8, 0.5, TILE_SIZE * 0.8,
			),
			material: new THREE.MeshStandardMaterial({ color: 0x44cc44 }),
		});
		stairs.position.set(
			exitCell.gridX * TILE_SIZE, 0.25, exitCell.gridZ * TILE_SIZE,
		);
	}
}

// Wire player collection
this.player.collected.connect(({ gridX, gridZ }) => {
	const key = `${gridX},${gridZ}`;
	const coin = this._coins.get(key);
	if (coin) {
		gameState.score += COIN_SCORE;
		coin.destroy();
		this._coins.delete(key);
		grid.clearCell(gridX, gridZ);
	}
});
```

---

## 9. Phase 5: HUD Overlay + Game Flow

- [ ] Create `hud/hud.ts` — renderFixed Layer with health hearts, score, level
- [ ] Create `scenes/dungeon-level.ts` — abstract base scene
- [ ] Create `scenes/level1.ts`, `level2.ts`, `level3.ts` with grid data
- [ ] Create `scenes/title-scene.ts` — 3D visual with "Press Space" overlay
- [ ] Create `scenes/win-scene.ts` — victory display with final score
- [ ] Create `scenes/game-over-scene.ts` — game over with restart
- [ ] Wire player.reachedExit → next level
- [ ] Wire player.died → game over scene

### `hud/hud.ts`

```typescript
import { Color, Vec2 } from "@quintus/math";
import { Label, Layer } from "@quintus/ui";
import { GAME_WIDTH } from "../config.js";
import { gameState } from "../state.js";

export class HUD extends Layer {
	override zIndex = 100;
	override renderFixed = true;

	private scoreLabel!: Label;
	private healthLabel!: Label;
	private levelLabel!: Label;

	override onReady(): void {
		this.scoreLabel = this.add(Label, {
			text: `Score: ${gameState.score}`,
			fontSize: 20,
			color: Color.WHITE,
			position: new Vec2(10, 10),
			align: "left",
		});

		this.healthLabel = this.add(Label, {
			text: this._healthText(),
			fontSize: 20,
			color: Color.fromHex("#ff4444"),
			position: new Vec2(GAME_WIDTH / 2, 10),
			align: "center",
		});

		this.levelLabel = this.add(Label, {
			text: `Level ${gameState.level}`,
			fontSize: 20,
			color: Color.fromHex("#44aaff"),
			position: new Vec2(GAME_WIDTH - 10, 10),
			align: "right",
		});

		gameState.on("score").connect(({ value }) => {
			this.scoreLabel.text = `Score: ${value}`;
		});

		gameState.on("health").connect(() => {
			this.healthLabel.text = this._healthText();
		});

		gameState.on("level").connect(({ value }) => {
			this.levelLabel.text = `Level ${value}`;
		});
	}

	private _healthText(): string {
		const full = "\u2665".repeat(gameState.health);
		const empty = "\u2661".repeat(gameState.maxHealth - gameState.health);
		return full + empty;
	}
}
```

### `scenes/dungeon-level.ts`

```typescript
import { Scene } from "@quintus/core";
import {
	AmbientLight, Camera3D, DirectionalLight, GLTFModel, MeshNode,
} from "@quintus/three";
import * as THREE from "three";
import { TILE_SIZE, COIN_SCORE } from "../config.js";
import { gameState } from "../state.js";
import { hasModels } from "../assets.js";
import { DungeonGrid } from "../entities/dungeon-grid.js";
import { PlayerCharacter } from "../entities/player.js";
import { CoinItem } from "../entities/coin-item.js";
import { TrapTile } from "../entities/trap-tile.js";
import { HUD } from "../hud/hud.js";

export abstract class DungeonLevel extends Scene {
	abstract readonly levelData: string[];
	abstract readonly nextScene: string;
	abstract readonly levelNumber: number;

	protected player!: PlayerCharacter;
	protected grid!: DungeonGrid;
	private _coins = new Map<string, CoinItem>();

	override onReady(): void {
		gameState.level = this.levelNumber;

		// Build dungeon grid (instanced floor + wall tiles)
		this.grid = this.add(DungeonGrid);
		this.grid.parseLevel(this.levelData);

		// Find player start
		const startCell = this.grid.findChar("P");
		if (!startCell) throw new Error("Level has no player start (P)");

		// Spawn player
		this.player = this.add(PlayerCharacter, {
			gridX: startCell.gridX,
			gridZ: startCell.gridZ,
		});
		this.player.dungeonGrid = this.grid;

		// Spawn items
		this._spawnItems();

		// Lighting
		this.add(AmbientLight, { intensity: 0.3, color: 0x8888cc });
		const sun = this.add(DirectionalLight, {
			intensity: 0.7,
			castShadow: true,
			shadowMapSize: 2048,
		});
		sun.position.set(8, 15, 8);

		// Camera
		const cam = this.add(Camera3D, {
			fov: 50,
			follow: this.player,
			followOffset: new THREE.Vector3(0, 12, 8),
			followSmoothing: 4,
		});
		cam.position.set(
			startCell.gridX * TILE_SIZE,
			12,
			startCell.gridZ * TILE_SIZE + 8,
		);

		// HUD
		this.add(HUD);

		// Wire signals
		this.player.reachedExit.connect(() => {
			this.switchTo(this.nextScene);
		});

		this.player.died.connect(() => {
			this.switchTo("game-over");
		});

		this.player.collected.connect(({ gridX, gridZ }) => {
			this._collectItem(gridX, gridZ);
		});
	}

	private _spawnItems(): void {
		for (const cell of this.grid.findAllChars("C")) {
			const coin = this.add(CoinItem, {
				gridX: cell.gridX,
				gridZ: cell.gridZ,
			});
			this._coins.set(`${cell.gridX},${cell.gridZ}`, coin);
		}

		for (const cell of this.grid.findAllChars("T")) {
			this.add(TrapTile, {
				gridX: cell.gridX,
				gridZ: cell.gridZ,
			});
		}

		// Exit stairs
		const exitCell = this.grid.findChar("E");
		if (exitCell) {
			if (hasModels(this.game)) {
				const stairs = this.add(GLTFModel, { src: "stairs" });
				stairs.position.set(
					exitCell.gridX * TILE_SIZE, 0,
					exitCell.gridZ * TILE_SIZE,
				);
			} else {
				const stairs = this.add(MeshNode, {
					geometry: new THREE.BoxGeometry(
						TILE_SIZE * 0.8, 0.5, TILE_SIZE * 0.8,
					),
					material: new THREE.MeshStandardMaterial({
						color: 0x44cc44,
					}),
				});
				stairs.position.set(
					exitCell.gridX * TILE_SIZE, 0.25,
					exitCell.gridZ * TILE_SIZE,
				);
			}
		}
	}

	private _collectItem(gridX: number, gridZ: number): void {
		const key = `${gridX},${gridZ}`;
		const coin = this._coins.get(key);
		if (coin) {
			gameState.score += COIN_SCORE;
			coin.destroy();
			this._coins.delete(key);
			this.grid.clearCell(gridX, gridZ);
		}
	}
}
```

### Level Definitions

```typescript
// scenes/level1.ts
import { DungeonLevel } from "./dungeon-level.js";

export class Level1 extends DungeonLevel {
	override readonly levelNumber = 1;
	override readonly nextScene = "level2";
	override readonly levelData = [
		"########",
		"#P.....#",
		"#..C...#",
		"#......#",
		"#...T..#",
		"#......#",
		"#....CE#",
		"########",
	];
}

// scenes/level2.ts — same pattern with nextScene = "level3"
// scenes/level3.ts — same pattern with nextScene = "win"
```

### `scenes/title-scene.ts`

```typescript
import { Scene } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Label, Layer } from "@quintus/ui";
import { AmbientLight, Camera3D, MeshNode } from "@quintus/three";
import * as THREE from "three";
import { GAME_WIDTH, GAME_HEIGHT } from "../config.js";
import { gameState } from "../state.js";

class RotatingCube extends MeshNode {
	geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
	material = new THREE.MeshStandardMaterial({ color: 0x6644aa });
	override castShadow = true;

	override onUpdate(dt: number): void {
		this.rotation.x += dt * 0.5;
		this.rotation.y += dt * 0.8;
	}
}

export class TitleScene extends Scene {
	override onReady(): void {
		gameState.reset();

		this.add(RotatingCube);
		this.add(AmbientLight, { intensity: 0.5 });
		const cam = this.add(Camera3D, { fov: 60 });
		cam.position.set(0, 3, 5);
		cam.lookAt(0, 0, 0);

		const ui = this.add(Layer);
		ui.renderFixed = true;

		ui.add(Label, {
			position: new Vec2(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40),
			text: "Dungeon Explorer",
			fontSize: 32,
			color: Color.WHITE,
			align: "center",
		});
		ui.add(Label, {
			position: new Vec2(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20),
			text: "Press Space to Start",
			fontSize: 16,
			color: Color.fromHex("#aaaaaa"),
			align: "center",
		});
	}

	override onFixedUpdate(): void {
		if (this.game.input.isJustPressed("interact")) {
			this.switchTo("level1");
		}
	}
}
```

### `scenes/win-scene.ts`

```typescript
import { Scene } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Label, Layer } from "@quintus/ui";
import { AmbientLight, Camera3D } from "@quintus/three";
import { GAME_WIDTH, GAME_HEIGHT } from "../config.js";
import { gameState } from "../state.js";

export class WinScene extends Scene {
	override onReady(): void {
		this.add(AmbientLight, { intensity: 0.5 });
		const cam = this.add(Camera3D, { fov: 60 });
		cam.position.set(0, 3, 5);
		cam.lookAt(0, 0, 0);

		const ui = this.add(Layer);
		ui.renderFixed = true;

		ui.add(Label, {
			position: new Vec2(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60),
			text: "Dungeon Cleared!",
			fontSize: 28,
			color: Color.fromHex("#81c784"),
			align: "center",
		});
		ui.add(Label, {
			position: new Vec2(GAME_WIDTH / 2, GAME_HEIGHT / 2),
			text: `Final Score: ${gameState.score}`,
			fontSize: 18,
			color: Color.WHITE,
			align: "center",
		});
		ui.add(Label, {
			position: new Vec2(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40),
			text: "Press Space to Play Again",
			fontSize: 14,
			color: Color.fromHex("#aaaaaa"),
			align: "center",
		});
	}

	override onFixedUpdate(): void {
		if (this.game.input.isJustPressed("interact")) {
			gameState.reset();
			this.switchTo("title");
		}
	}
}
```

### `scenes/game-over-scene.ts`

```typescript
import { Scene } from "@quintus/core";
import { Color, Vec2 } from "@quintus/math";
import { Label, Layer } from "@quintus/ui";
import { AmbientLight, Camera3D } from "@quintus/three";
import { GAME_WIDTH, GAME_HEIGHT } from "../config.js";
import { gameState } from "../state.js";

export class GameOverScene extends Scene {
	override onReady(): void {
		this.add(AmbientLight, { intensity: 0.3 });
		const cam = this.add(Camera3D, { fov: 60 });
		cam.position.set(0, 3, 5);
		cam.lookAt(0, 0, 0);

		const ui = this.add(Layer);
		ui.renderFixed = true;

		ui.add(Label, {
			position: new Vec2(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40),
			text: "Game Over",
			fontSize: 28,
			color: Color.fromHex("#ef5350"),
			align: "center",
		});
		ui.add(Label, {
			position: new Vec2(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10),
			text: `Score: ${gameState.score}`,
			fontSize: 16,
			color: Color.WHITE,
			align: "center",
		});
		ui.add(Label, {
			position: new Vec2(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50),
			text: "Press Space to Retry",
			fontSize: 14,
			color: Color.fromHex("#aaaaaa"),
			align: "center",
		});
	}

	override onFixedUpdate(): void {
		if (this.game.input.isJustPressed("interact")) {
			gameState.reset();
			this.switchTo("title");
		}
	}
}
```

---

## 10. Phase 6: Tests + Polish

- [ ] Create `__tests__/helpers.ts` — test setup with Three.js mocks
- [ ] Create `__tests__/grid.test.ts` — level parsing, walkability, cell lookup
- [ ] Create `__tests__/player.test.ts` — movement, collection, damage
- [ ] Create `__tests__/flow.test.ts` — level progression, game over, win
- [ ] Create `vitest.config.ts`
- [ ] Verify all 3 levels are completable via qdbg
- [ ] Verify fallback rendering works when GLB files are absent
- [ ] `pnpm build` + `pnpm test` + `pnpm lint`

### Test Approach

Tests use the same Three.js mock strategy as `@quintus/three` tests.

```typescript
// __tests__/helpers.ts
import { vi } from "vitest";

vi.mock("three", () =>
	import("@quintus/three/src/__test-utils__/three-mock.js")
);
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
	GLTFLoader: class {
		loadAsync() { return Promise.resolve({}); }
	},
}));
vi.mock("three/addons/utils/SkeletonUtils.js", () => ({
	clone: () => {
		const THREE = require("three");
		return new THREE.Object3D();
	},
}));

import { _resetNodeIdCounter } from "@quintus/core";
import { gameState } from "../state.js";

export function resetState(): void {
	gameState.reset();
	_resetNodeIdCounter();
}
```

### Grid Parsing Tests

```typescript
// __tests__/grid.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import { DungeonGrid } from "../entities/dungeon-grid.js";
import { resetState } from "./helpers.js";

describe("DungeonGrid", () => {
	beforeEach(() => resetState());

	it("parses level dimensions", () => {
		const grid = new DungeonGrid();
		grid.parseLevel([
			"####",
			"#P.#",
			"####",
		]);
		expect(grid.width).toBe(4);
		expect(grid.height).toBe(3);
	});

	it("identifies player start position", () => {
		const grid = new DungeonGrid();
		grid.parseLevel(["####", "#P.#", "####"]);
		const start = grid.findChar("P");
		expect(start).not.toBeNull();
		expect(start!.gridX).toBe(1);
		expect(start!.gridZ).toBe(1);
	});

	it("walls are not walkable, floors are", () => {
		const grid = new DungeonGrid();
		grid.parseLevel(["####", "#..#", "####"]);
		expect(grid.isWalkable(0, 0)).toBe(false);
		expect(grid.isWalkable(1, 1)).toBe(true);
	});

	it("finds all coins", () => {
		const grid = new DungeonGrid();
		grid.parseLevel(["####", "#CC#", "####"]);
		expect(grid.findAllChars("C")).toHaveLength(2);
	});

	it("out-of-bounds is not walkable", () => {
		const grid = new DungeonGrid();
		grid.parseLevel(["##", "##"]);
		expect(grid.isWalkable(-1, 0)).toBe(false);
		expect(grid.isWalkable(5, 5)).toBe(false);
	});

	it("clearCell marks cell as floor", () => {
		const grid = new DungeonGrid();
		grid.parseLevel(["####", "#C.#", "####"]);
		expect(grid.charAt(1, 1)).toBe("C");
		grid.clearCell(1, 1);
		expect(grid.charAt(1, 1)).toBe(".");
	});
});
```

---

## 11. Test Plan

### Unit Tests

**`__tests__/grid.test.ts`** — DungeonGrid (extends TileMap3D)
- Parse level dimensions from string array
- `isWalkable()` returns false for walls, true for floors/items
- `findChar()` locates player start, exit
- `findAllChars()` returns all coins/traps
- `charAt()` returns original character
- `clearCell()` changes char to floor
- Out-of-bounds returns not walkable

**`__tests__/player.test.ts`** — PlayerCharacter (requires headless game + mocks)
- Grid position updates after move input
- Cannot walk through walls
- Coin collection triggers signal with correct coordinates
- Trap damage reduces health
- Invincibility prevents repeated damage
- Death signal fires at health 0
- Exit signal fires on exit tile

**`__tests__/flow.test.ts`** — Game Flow
- Level 1 loads with correct grid dimensions
- Collecting all coins increases score
- Reaching exit switches to next scene
- Player death switches to game-over scene
- Title scene starts with reset state (score 0, health 3)
- Win scene displays final score

### Integration

- All 3 levels render without errors (with fallback cubes)
- Full game flow: title → level1 → level2 → level3 → win
- Game over flow: take 3 hits of trap damage → game over

---

## 12. Definition of Done

- [ ] All phases marked Done in status table
- [ ] TileMap3D class implemented in `@quintus/three` with tests
- [ ] Kenney GLB assets committed to `examples/3d-dungeon/assets/models/`
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes all tests (existing + new TileMap3D + game tests)
- [ ] `pnpm lint` clean (zero warnings)
- [ ] Demo runs in browser via `pnpm dev` at `/3d-dungeon/`
- [ ] Fallback rendering works when GLB assets are missing
- [ ] Game is completable: title → level 1 → level 2 → level 3 → win
