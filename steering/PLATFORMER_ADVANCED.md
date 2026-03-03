# Advanced Platformer — Detailed Design

> **Goal:** Build a feature-rich platformer showcasing the Kenney New Platformer Pack 1.1, with parallax scrolling, animated characters, ladders, multiple enemy types, moving platforms, slopes, breakable blocks, fall-away platforms, collectibles, power-ups, keys/locks, springs, and a polished HUD.
> **Outcome:** A 3-level game with Tiled-designed maps that serves as the flagship Quintus engine demo, proving out advanced mechanics and driving engine enhancements where needed.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Engine Enhancements | Done |
| 2 | Asset Pipeline & Tiled Setup | Done |
| 3 | Core Player Mechanics | Done |
| 4 | Terrain & Collision (Slopes, One-Way) | Done |
| 5 | Interactive Tiles (Breakable, Fall-Away, Springs, Ladders) | Done |
| 6 | Enemies | Done |
| 7 | Moving Platforms & Hazards | Done |
| 8 | Collectibles, Power-Ups, Keys/Locks | Done |
| 9 | Parallax Backgrounds & Camera | Done |
| 10 | HUD, Menus & Audio | Done |
| 11 | Level Design (3 Levels in Tiled) | Pending |
| 12 | Tests & Polish | Pending |

---

## Asset Pack Reference

All assets from `/workspaces/Quintus/tmp/kenney_new-platformer-pack-1.1/` (CC0 license).

| Asset Category | Source | Size |
|---------------|--------|------|
| Tiles | `Spritesheets/spritesheet-tiles-default.png` + `.xml` | 64x64 px per tile |
| Characters | `Spritesheets/spritesheet-characters-default.png` + `.xml` | 128x128 px per frame |
| Enemies | `Spritesheets/spritesheet-enemies-default.png` + `.xml` | 64x64 px per frame |
| Backgrounds | `Sprites/Backgrounds/Default/*.png` (individual files) | 256x256 px, tileable |
| Sounds | `Sounds/*.ogg` | 10 SFX files |

### Tile Size Decision

The Kenney tiles are 64x64 px. At zoom=2 on a 640x360 canvas, each tile occupies 128x128 screen pixels — too large. We use **zoom=3** on a **960x540** canvas (16:9), giving ~15 tiles across and ~8.4 tiles vertically at native scale. Alternatively, we use a **640x360 canvas at zoom=2** and scale down tile rendering by setting `tileWidth`/`tileHeight` in Tiled to 32 (each 64px source tile renders at 32px, then zoom=2 brings it to 64 screen px). We go with the **simpler approach**: use 64px tiles, **480x270 canvas, zoom=1**. Each tile is ~7.5 tiles tall, ~15 wide. Then the `scale: "fit"` mode upscales the canvas to fill the browser window. This gives us a good balance between visible area and visual crispness.

**Final decision:** Canvas **640x360**, Tiled tile size **64x64**, camera **zoom=1**, `scale: "fit"`. The game world coordinates match pixel coordinates 1:1. Characters at 128x128 are 2 tiles tall — perfect for the art style.

---

## Project Structure

```
examples/advanced-platformer/
├── index.html
├── main.ts
├── config.ts                    # collision groups, input bindings
├── state.ts                     # reactiveState (score, coins, health, lives, keys, powerups)
├── sprites.ts                   # TextureAtlas loading for tiles, characters, enemies
├── assets/
│   ├── tiles.png                # copy of spritesheet-tiles-default.png
│   ├── tiles.xml                # copy of spritesheet-tiles-default.xml
│   ├── characters.png           # copy of spritesheet-characters-default.png
│   ├── characters.xml           # copy of spritesheet-characters-default.xml
│   ├── enemies.png              # copy of spritesheet-enemies-default.png
│   ├── enemies.xml              # copy of spritesheet-enemies-default.xml
│   ├── bg_clouds.png            # background_clouds.png
│   ├── bg_fade_hills.png        # background_fade_hills.png
│   ├── bg_color_hills.png       # background_color_hills.png
│   ├── bg_solid_sky.png         # background_solid_sky.png
│   ├── bg_fade_desert.png       # for desert level
│   ├── bg_color_desert.png      # for desert level
│   ├── bg_solid_sand.png        # for desert level
│   ├── level1.tmx               # Grass themed
│   ├── level2.tmx               # Dirt/Desert themed
│   ├── level3.tmx               # Stone/Purple themed
│   ├── tileset.tsx              # shared Tiled tileset (external)
│   └── sounds/                  # copies of Kenney .ogg files
│       ├── jump.ogg
│       ├── jump_high.ogg
│       ├── coin.ogg
│       ├── gem.ogg
│       ├── hurt.ogg
│       ├── bump.ogg
│       ├── select.ogg
│       ├── throw.ogg
│       ├── magic.ogg
│       └── disappear.ogg
├── entities/
│   ├── player.tsx               # Player actor
│   ├── enemies/
│   │   ├── base-enemy.ts        # shared enemy logic
│   │   ├── slime.tsx            # ground patrol enemy
│   │   ├── bee.tsx              # flying sine-wave enemy
│   │   ├── snail.tsx            # slow patrol, shell defense
│   │   ├── frog.tsx             # jumping enemy
│   │   └── saw.tsx              # rotating hazard (path-following)
│   ├── breakable-block.tsx      # Mario-style breakable/coin block
│   ├── fall-away-platform.tsx   # crumbling platform
│   ├── moving-platform.tsx      # horizontal/vertical/path platforms
│   ├── spring.tsx               # bounce pad
│   ├── ladder-zone.ts           # Sensor for ladder climbing
│   ├── coin.tsx                 # collectible coin
│   ├── gem.tsx                  # high-value collectible
│   ├── heart-pickup.tsx         # health restore
│   ├── power-up.tsx             # star power-up
│   ├── key-pickup.tsx           # colored keys
│   ├── locked-door.tsx          # colored lock gates
│   ├── flag.tsx                 # checkpoint flag
│   ├── door-exit.tsx            # level exit door
│   ├── spike.ts                 # floor/ceiling hazard
│   └── water-zone.ts            # instant-death water
├── scenes/
│   ├── level.tsx                # abstract base level scene
│   ├── level1.tsx               # grass level
│   ├── level2.tsx               # desert level
│   ├── level3.tsx               # stone/purple level
│   ├── title.tsx                # title screen
│   ├── game-over.tsx            # game over screen
│   └── victory.tsx              # victory screen
├── hud/
│   ├── hud.tsx                  # main HUD layer
│   └── toast.ts                 # floating text notifications
├── parallax/
│   └── parallax-background.tsx  # ParallaxLayer node (game-level, not engine)
└── __tests__/
    ├── player.test.ts           # movement, jumping, ladder, damage
    ├── enemies.test.ts          # patrol, stomp, AI
    ├── breakable-block.test.ts  # hit from below, coin spawning
    ├── moving-platform.test.ts  # carry player, path following
    ├── power-up.test.ts         # star invincibility
    ├── key-lock.test.ts         # key pickup, door unlock
    └── integration.test.ts      # full level walkthrough
```

---

## Scene Tree

```
Scene (Level1)
├── ParallaxBackground (Node2D)
│   ├── SkyLayer (Sprite, scrollFactor=0)
│   ├── CloudLayer (Sprite, scrollFactor=0.1)
│   ├── FadeLayer (Sprite, scrollFactor=0.3)
│   └── ColorLayer (Sprite, scrollFactor=0.6)
├── TileMap
│   ├── [layer: "background"] — decorative, no collision
│   ├── [layer: "main"] — terrain, generates StaticColliders
│   ├── [layer: "foreground"] — decorative overlay (rendered on top)
│   ├── [StaticColliders from generateCollision]
│   ├── [SlopeColliders from generateSlopeCollision]
│   ├── BreakableBlock(s) (StaticCollider) — spawned from tile IDs
│   ├── Coin(s) (Sensor)
│   ├── Gem(s) (Sensor)
│   ├── KeyPickup(s) (Sensor)
│   ├── Spring(s) (StaticCollider)
│   ├── Spike(s) (Sensor)
│   └── WaterZone(s) (Sensor)
├── Player (Actor + Damageable)
│   ├── CollisionShape (rect 40x56, player is 128px but collision box smaller)
│   └── AnimatedSprite (characters atlas)
├── Slime(s) (Actor)
│   ├── CollisionShape
│   └── AnimatedSprite (enemies atlas)
├── Bee(s) (Actor)
├── Snail(s) (Actor)
├── Frog(s) (Actor)
├── Saw(s) (Node2D) — pure hazard, no physics body
├── MovingPlatform(s) (StaticCollider)
│   └── CollisionShape
├── FallAwayPlatform(s) (StaticCollider)
│   └── CollisionShape
├── LadderZone(s) (Sensor) — spawned from tile IDs
├── Flag(s) (Sensor) — checkpoints
├── DoorExit (Sensor) — level completion
├── LockedDoor(s) (StaticCollider)
├── Camera
└── HUD (Layer, fixed, zIndex=100)
    ├── HeartRow (hearts)
    ├── CoinIcon + CoinLabel
    ├── ScoreLabel
    ├── KeyIcons
    └── PowerUpIndicator
```

---

## Phase 1: Engine Enhancements

Several engine features need additions to support this game. These are minimal, targeted changes.

### 1a. ParallaxLayer Node (in `@quintus/camera`)

The camera currently applies one `viewTransform` to the entire scene. Background layers need to scroll at different rates. Rather than modifying the renderer, we add a `ParallaxLayer` node that offsets its own position based on camera position.

**Actually, this is better done at the game level** to avoid engine coupling. The game's `ParallaxBackground` node reads camera position each frame and adjusts child sprite positions. See Phase 9 for implementation.

**No engine change needed for parallax.** The game handles it.

### 1b. TileMap: Expose Per-Tile Definition Query

Currently `TiledTileDefinition` (type, properties, objectgroup, animation) is parsed but only accessible through the private `_parsed.tilesets[].tiles[]` array. The game needs to query tile properties at runtime (e.g., "is this tile a ladder?", "is this tile breakable?", "what slope shape does this tile have?").

**Add to `packages/tilemap/src/tilemap.ts`:**

```typescript
/**
 * Get the tile definition for a local tile ID.
 * Returns the TiledTileDefinition if it exists, or null.
 * Useful for querying custom properties, collision shapes, and animations.
 */
getTileDefinition(localId: number): TiledTileDefinition | null {
    if (!this._parsed) return null;
    for (const tileset of this._parsed.tilesets) {
        if (!tileset.tiles) continue;
        const def = tileset.tiles.find(t => t.id === localId);
        if (def) return def;
    }
    return null;
}

/**
 * Get all tile IDs that have a specific custom property value.
 * E.g., getTileIdsByProperty("type", "ladder") returns IDs of all ladder tiles.
 */
getTileIdsByProperty(name: string, value: boolean | number | string): number[] {
    if (!this._parsed) return [];
    const ids: number[] = [];
    for (const tileset of this._parsed.tilesets) {
        if (!tileset.tiles) continue;
        for (const tileDef of tileset.tiles) {
            if (!tileDef.properties) continue;
            for (const prop of tileDef.properties) {
                if (prop.name === name && prop.value === value) {
                    ids.push(tileDef.id);
                }
            }
        }
    }
    return ids;
}

/**
 * Get tile IDs by their Tiled type/class string.
 */
getTileIdsByType(type: string): number[] {
    if (!this._parsed) return [];
    const ids: number[] = [];
    for (const tileset of this._parsed.tilesets) {
        if (!tileset.tiles) continue;
        for (const tileDef of tileset.tiles) {
            if (tileDef.type === type) {
                ids.push(tileDef.id);
            }
        }
    }
    return ids;
}
```

### 1c. TileMap: Slope Collision Generation

`generateCollision()` currently only creates rect colliders. For slope tiles, we need to read the per-tile `objectgroup` collision shapes defined in Tiled's tile collision editor and create polygon colliders.

**Add to `packages/tilemap/src/tile-collision.ts`:**

```typescript
/**
 * Find tiles that have custom collision shapes (objectgroup) and create
 * individual StaticCollider+CollisionShape nodes with polygon shapes.
 * These tiles are excluded from the rect-merging solid grid.
 *
 * @returns Set of local tile IDs that were handled as slope/polygon colliders
 *          (so they can be excluded from the solid rect grid).
 */
export function createTileShapeColliders(
    layer: ParsedTileLayer,
    tilesets: TiledTileset[],
    tileWidth: number,
    tileHeight: number,
    collisionGroup: string,
    parent: Node2D,
    factories: PhysicsFactories & {
        shapePolygon: (points: Vec2[]) => unknown;
    },
): Set<number> {
    const handledIds = new Set<number>();

    // Build a map of localId -> objectgroup
    const tileShapes = new Map<number, TiledObjectGroup>();
    for (const ts of tilesets) {
        if (!ts.tiles) continue;
        for (const tileDef of ts.tiles) {
            if (tileDef.objectgroup && tileDef.objectgroup.objects.length > 0) {
                tileShapes.set(tileDef.id, tileDef.objectgroup);
            }
        }
    }

    if (tileShapes.size === 0) return handledIds;

    // Iterate the layer and create per-tile polygon colliders
    for (let row = 0; row < layer.height; row++) {
        for (let col = 0; col < layer.width; col++) {
            const tile = layer.tiles[row * layer.width + col];
            if (!tile) continue;

            const objGroup = tileShapes.get(tile.localId);
            if (!objGroup) continue;

            handledIds.add(tile.localId);

            // Create one StaticCollider per tile instance
            const tileX = col * tileWidth;
            const tileY = row * tileHeight;

            for (const obj of objGroup.objects) {
                if (obj.polygon && obj.polygon.length >= 3) {
                    // Polygon shape: vertices are relative to obj.x, obj.y within the tile
                    const points = obj.polygon.map(
                        p => new Vec2(
                            p.x + obj.x - tileWidth / 2,
                            p.y + obj.y - tileHeight / 2
                        )
                    );

                    const collider = new factories.StaticCollider();
                    collider.name = `SlopeCollider_${col}_${row}`;
                    collider.position.x = tileX + tileWidth / 2;
                    collider.position.y = tileY + tileHeight / 2;
                    collider.collisionGroup = collisionGroup;

                    const shape = new factories.CollisionShape();
                    shape.shape = factories.shapePolygon(points);
                    collider.add(shape);
                    parent.add(collider);
                } else if (!obj.polygon && obj.width > 0 && obj.height > 0) {
                    // Rectangle shape within the tile
                    const collider = new factories.StaticCollider();
                    collider.name = `TileShapeCollider_${col}_${row}`;
                    collider.position.x = tileX + obj.x + obj.width / 2;
                    collider.position.y = tileY + obj.y + obj.height / 2;
                    collider.collisionGroup = collisionGroup;

                    const shape = new factories.CollisionShape();
                    shape.shape = factories.shapeRect(obj.width, obj.height);
                    collider.add(shape);
                    parent.add(collider);
                }
            }
        }
    }

    return handledIds;
}
```

**Modify `generateCollision()` in `tilemap.ts`** to call `createTileShapeColliders()` first, then exclude those tile IDs from the solid rect grid.

### 1d. TileMap: Foreground Layer Rendering (zIndex Control)

The TileMap currently renders all tile layers in a single `onDraw()` call. For a proper foreground layer that renders on top of entities, we need per-layer zIndex control.

**Option A (simple):** Add a `layerZIndex` map to TileMap:

```typescript
/** Per-layer z-index overrides. If not set, layers render at the TileMap's zIndex. */
layerZIndex: Map<string, number> = new Map();
```

Then in `onDraw()`, split rendering: layers at the default zIndex render normally, and layers with custom zIndex spawn a lightweight child node that renders just that layer.

**Option B (simpler — use two TileMap instances):** Load the same TMX twice but only render specific layers from each. One TileMap at zIndex=0 for background+main, one at zIndex=50 for foreground. This works with the existing API since `_drawTileLayer` already filters by `layer.visible`.

**We go with Option B** — no engine change needed. Use two `TileMap` nodes pointing at the same asset, and control which layers are visible via Tiled layer visibility or a simple wrapper.

**Actually, Option B won't work cleanly** because both TileMaps would parse the same data and there's no API to hide specific layers. Let's add a minimal engine feature:

**Add to `packages/tilemap/src/tilemap.ts`:**

```typescript
/** Layer names to render. If empty, all layers are rendered. */
visibleLayers: string[] = [];

// Modify onDraw:
onDraw(ctx: DrawContext): void {
    if (!this._parsed) return;
    for (const layer of this._parsed.tileLayers) {
        if (!layer.visible) continue;
        if (this.visibleLayers.length > 0 && !this.visibleLayers.includes(layer.name)) continue;
        this._drawTileLayer(ctx, layer);
    }
}
```

This lets us create two TileMap nodes from the same asset:
- `mapBack` with `visibleLayers = ["background", "main"]`, `zIndex = 0`
- `mapFront` with `visibleLayers = ["foreground"]`, `zIndex = 50`

### 1e. TileMap: Animated Tiles

Tiled supports tile animations (e.g., water surface, torches, flags). The TMX parser already stores `TiledAnimationFrame[]` on tile definitions but the renderer ignores them. We need animated tile rendering.

**Add to `tilemap.ts` rendering logic:**

```typescript
// In _drawTileLayer, before computing sourceRect:
private _getAnimatedTileId(localId: number, tileset: TiledTileset): number {
    if (!tileset.tiles) return localId;
    const def = this._tileDefCache.get(localId);
    if (!def?.animation || def.animation.length === 0) return localId;

    // Compute current frame from elapsed time
    const totalDuration = def.animation.reduce((sum, f) => sum + f.duration, 0);
    const elapsed = ((this.game?.elapsed ?? 0) * 1000) % totalDuration;
    let accumulated = 0;
    for (const frame of def.animation) {
        accumulated += frame.duration;
        if (elapsed < accumulated) return frame.tileid;
    }
    return def.animation[0]!.tileid;
}
```

Also build a `_tileDefCache: Map<number, TiledTileDefinition>` once during `_loadMap()` for O(1) lookup.

### Summary of Engine Changes

| File | Change | Type |
|------|--------|------|
| `packages/tilemap/src/tilemap.ts` | `getTileDefinition()`, `getTileIdsByProperty()`, `getTileIdsByType()` | New public API |
| `packages/tilemap/src/tilemap.ts` | `visibleLayers: string[]` filter in `onDraw()` | New property |
| `packages/tilemap/src/tilemap.ts` | Animated tile rendering (`_getAnimatedTileId`) | New feature |
| `packages/tilemap/src/tilemap.ts` | Integrate `createTileShapeColliders()` into `generateCollision()` | Enhancement |
| `packages/tilemap/src/tile-collision.ts` | `createTileShapeColliders()` function | New function |
| `packages/sprites/src/sprite-sheet.ts` | `SpriteSheet.fromAtlas()` factory + `AtlasAnimationConfig` type | New public API |

**No changes needed to:** Camera, Physics (Actor/StaticCollider), Input, Core Renderer.

- [x] Add `getTileDefinition(localId)` to TileMap
- [x] Add `getTileIdsByProperty(name, value)` to TileMap
- [x] Add `getTileIdsByType(type)` to TileMap
- [x] Add `visibleLayers` filter to TileMap.onDraw()
- [x] Add animated tile support to TileMap rendering
- [x] Add `createTileShapeColliders()` to tile-collision.ts
- [x] Integrate slope colliders into `generateCollision()` with `tileShapeColliders` option
- [x] Add `shapePolygon` to `PhysicsFactories` interface
- [x] Write tests for all new TileMap APIs
- [x] Write tests for slope collision generation
- [x] Write tests for animated tiles
- [x] `pnpm build && pnpm test` passes

### Tests for Phase 1

**Unit:** `packages/tilemap/src/tilemap.test.ts`
- `getTileDefinition()` returns correct definition for known tile ID
- `getTileDefinition()` returns null for unknown tile ID
- `getTileIdsByProperty("solid", true)` returns expected IDs
- `getTileIdsByType("ladder")` returns expected IDs
- `visibleLayers` filters tile rendering to specified layers

**Unit:** `packages/tilemap/src/tile-collision.test.ts`
- `createTileShapeColliders()` creates polygon colliders from tile objectgroup
- `createTileShapeColliders()` returns correct set of handled tile IDs
- `createTileShapeColliders()` handles rect shapes within tiles
- `generateCollision()` with slope tiles excludes them from rect merging

**Unit:** `packages/tilemap/src/animated-tiles.test.ts`
- Animated tile cycles through frames based on elapsed time
- Animated tile wraps correctly at total duration boundary
- Non-animated tiles return their own ID unchanged

---

## Phase 2: Asset Pipeline & Tiled Setup

### 2a. Copy and Organize Assets

Copy from the Kenney pack into the example's `assets/` directory.

- [x] Copy `Spritesheets/spritesheet-tiles-default.png` → `assets/tiles.png`
- [x] Copy `Spritesheets/spritesheet-tiles-default.xml` → `assets/tiles.xml`
- [x] Copy `Spritesheets/spritesheet-characters-default.png` → `assets/characters.png`
- [x] Copy `Spritesheets/spritesheet-characters-default.xml` → `assets/characters.xml`
- [x] Copy `Spritesheets/spritesheet-enemies-default.png` → `assets/enemies.png`
- [x] Copy `Spritesheets/spritesheet-enemies-default.xml` → `assets/enemies.xml`
- [x] Copy background PNGs for hills, desert, and clouds themes
- [x] Copy all 10 sound files to `assets/sounds/`

### 2b. TextureAtlas Setup (`sprites.ts`)

Use `TextureAtlas.fromXml()` to load the three sprite sheets, then `SpriteSheet.fromAtlas()` to create animation-ready SpriteSheets using frame names directly. The `fromAtlas()` factory (added as an engine enhancement) bridges TextureAtlas and AnimatedSprite — no grid math or index computation needed.

For static sprites (HUD icons, blocks, collectibles), use `TextureAtlas.getFrame()` with `Sprite.sourceRect` directly.

```typescript
// sprites.ts
import { SpriteSheet, TextureAtlas } from "@quintus/sprites";

export let tileAtlas: TextureAtlas;
export let charAtlas: TextureAtlas;
export let enemyAtlas: TextureAtlas;
export let playerSheet: SpriteSheet;
export let slimeSheet: SpriteSheet;
// ... other sheets

export function loadAtlases(game: Game): void {
    tileAtlas = TextureAtlas.fromXml(game.assets.require<string>("tiles"), "tiles");
    charAtlas = TextureAtlas.fromXml(game.assets.require<string>("characters"), "characters");
    enemyAtlas = TextureAtlas.fromXml(game.assets.require<string>("enemies"), "enemies");

    // SpriteSheet.fromAtlas() maps frame names → atlas rects automatically.
    // Works with any atlas layout (not just uniform grids).
    playerSheet = SpriteSheet.fromAtlas(charAtlas, {
        idle: { frames: ["character_green_idle"], fps: 1, loop: true },
        walk: { frames: ["character_green_walk_a", "character_green_walk_b"], fps: 6, loop: true },
        jump: { frames: ["character_green_jump"], fps: 1, loop: false },
        duck: { frames: ["character_green_duck"], fps: 1, loop: false },
        climb: { frames: ["character_green_climb_a", "character_green_climb_b"], fps: 4, loop: true },
        hit: { frames: ["character_green_hit"], fps: 1, loop: false },
    });

    slimeSheet = SpriteSheet.fromAtlas(enemyAtlas, {
        walk: { frames: ["slime_normal_walk_a", "slime_normal_walk_b"], fps: 4, loop: true },
        rest: { frames: ["slime_normal_rest"], fps: 1, loop: false },
        flat: { frames: ["slime_normal_flat"], fps: 1, loop: false },
    });
    // ... bee, snail, frog, saw sheets follow the same pattern
}
```

**Two usage patterns** for atlas-backed sprites:
- **Animated sprites** (player, enemies): `SpriteSheet.fromAtlas()` → `AnimatedSprite`
- **Static sprites** (HUD, blocks, collectibles): `tileAtlas.getFrame("heart")` → `Sprite.sourceRect`

### 2c. Tiled Tileset (.tsx)

Create an external Tiled tileset file that all 3 levels share. In Tiled:

1. Create tileset from `tiles.png` (64x64 tile size, 1px spacing based on the XML)
2. Set tile **type/class** strings for special tiles:
   - `ladder` — ladder_top, ladder_middle, ladder_bottom
   - `breakable` — brick_brown, brick_grey, bricks_brown, bricks_grey
   - `coin_block` — block_coin
   - `exclamation_block` — block_exclamation
   - `spring` — spring
   - `spike` — spikes, block_spikes
   - `water` — water, water_top, water_top_low
   - `lava` — lava, lava_top, lava_top_low
   - `coin` — coin_gold, coin_silver, coin_bronze
   - `gem` — gem_blue, gem_green, gem_red, gem_yellow
   - `heart` — heart
   - `star` — star (power-up)
   - `key_red`, `key_blue`, `key_green`, `key_yellow` — keys
   - `lock_red`, `lock_blue`, `lock_green`, `lock_yellow` — locks
   - `flag` — flag_yellow_a, flag_off
   - `door` — door_closed, door_closed_top
3. Set tile **custom collision shapes** for slope tiles:
   - `terrain_*_ramp_short_a`: triangle polygon (0,64)→(64,0)→(64,64) (right-ascending)
   - `terrain_*_ramp_short_b`: triangle polygon (0,0)→(64,0)→(64,64) (right-ascending top)
   - `terrain_*_ramp_long_a/b/c`: partial slope polygons
   - Cloud tiles: one-way property `oneWay = true`
4. Set `solid = true` on all terrain block tiles, horizontal tiles, vertical tiles, bricks
5. Set `oneWay = true` on cloud tiles and horizontal platform tiles
6. Add animation to: water_top (shimmer), lava_top (bubble), torch (flicker), flag (wave)

### 2d. Tiled Level Structure (3 Layers)

Each TMX map has these layers:

```
Layers (bottom to top):
├── background (tile layer) — decorative, no collision
│   Uses: terrain patterns, decorations (bush, cactus, grass, sign, window, etc.)
│   Rendered behind everything
├── main (tile layer) — terrain, collision, interactive tiles
│   Uses: solid terrain, slopes, one-way platforms, ladders, breakable blocks,
│         coins, spikes, springs, water, keys, locks, doors, flags
│   Generates: StaticColliders, slope polygon colliders, one-way colliders
│   Spawns via spawnFromTiles: BreakableBlock, Coin, Gem, Spike, Spring,
│         KeyPickup, LockedDoor, Flag, DoorExit, HeartPickup, PowerUp
├── foreground (tile layer) — rendered on top of entities
│   Uses: fence, bridge rails, vines, decorative tile overhangs
│   No collision. zIndex > entities.
└── entities (object layer) — spawn points and config
    Object types: Player, Slime, Bee, Snail, Frog, Saw,
                  MovingPlatform, FallAwayPlatform, LadderZone
    Properties on MovingPlatform objects:
      - direction: "horizontal" | "vertical"
      - distance: number (pixels to travel)
      - speed: number (pixels/sec)
    Properties on Saw objects:
      - pathPoints: polyline defining movement path
```

- [x] Copy all sprite/sound assets to `examples/advanced-platformer/assets/`
- [x] Create `sprites.ts` with TextureAtlas loading and animation definitions
- [x] Create `tileset.tsx` external Tiled tileset with all tile types and collision shapes
- [x] Create template TMX with 3 tile layers + 1 object layer
- [x] Verify asset loading in a minimal `main.ts` test scene

---

## Phase 3: Core Player Mechanics

### Player Class (`entities/player.tsx`)

The player uses the green character variant (128x128 px, collision box smaller).

```tsx
const DamageableActor = Damageable(Actor, {
    maxHealth: 5,
    invincibilityDuration: 1.5,
    deathTween: true,
});

export class Player extends DamageableActor {
    // === Movement Config ===
    speed = 250;
    jumpForce = -500;
    doubleJumpForce = -420;
    climbSpeed = 150;
    duckSpeedMultiplier = 0.4;

    // === State ===
    private _canDoubleJump = false;
    private _facing: "left" | "right" = "right";
    private _isClimbing = false;
    private _isDucking = false;
    private _isOnLadder = false;       // set by LadderZone sensor
    private _starPower = false;
    private _starTimer = 0;

    // === Refs ===
    sprite!: AnimatedSprite;

    override collisionGroup = "player";
    override solid = true;

    override build() {
        return (
            <>
                <CollisionShape shape={Shape.rect(40, 56)} />
                <AnimatedSprite ref="sprite" spriteSheet={playerSheet} animation="idle"
                    centered={true} />
            </>
        );
    }

    override onReady() {
        super.onReady();
        this.tag("player");
    }

    override onFixedUpdate(dt: number) {
        super.onFixedUpdate(dt);

        const input = this.game.input;

        // Star power timer
        if (this._starPower) {
            this._starTimer -= dt;
            if (this._starTimer <= 0) {
                this._starPower = false;
                this.sprite.alpha = 1;
            } else {
                // Rainbow blink effect
                this.sprite.alpha = Math.sin(this.game.elapsed * 30) > 0 ? 0.5 : 1;
            }
        }

        if (this._isClimbing) {
            this._updateClimbing(dt, input);
        } else {
            this._updateNormal(dt, input);
        }
    }
}
```

### Movement States

**Normal (ground/air):**
- Left/Right → `velocity.x = ±speed`
- Jump (on floor) → `velocity.y = jumpForce`, enable double jump
- Jump (in air, canDoubleJump) → `velocity.y = doubleJumpForce`, disable double jump
- Duck (on floor) → reduce speed, play duck anim, shrink collision (optional)
- `move(dt)` handles gravity and collision

**Climbing (on ladder):**
- Enter: player overlaps LadderZone + presses up/down
- `applyGravity = false`, `velocity.x = 0`
- Up/Down → `velocity.y = ±climbSpeed`
- Jump while climbing → exit climb + jump force
- Exit: reach top/bottom of ladder, or move off horizontally
- Re-enable gravity on exit

### Animation State Machine

```
idle ←→ walk (velocity.x != 0, on floor)
idle/walk → jump (leave floor)
jump → idle/walk (land)
any → climb (on ladder)
climb → idle (exit ladder)
any → duck (duck pressed, on floor)
any → hit (take damage) → idle (after invincibility)
```

- [x] Create `Player` class with full movement, jumping, double jump
- [x] Implement ducking with animation
- [x] Implement ladder climbing state
- [x] Implement star power state
- [x] Implement invincibility blink
- [x] Implement fall death (below map bounds)
- [x] Implement animation state machine
- [x] Wire player to `gameState` for health/lives sync
- [x] Write player movement tests
- [x] Write player jump/double-jump tests
- [x] Write player ladder climb tests

### Tests for Phase 3

**Unit:** `examples/advanced-platformer/__tests__/player.test.ts`
- Player moves right when right action is pressed
- Player moves left when left action is pressed
- Player jumps when on floor and jump pressed (velocity.y < 0)
- Player double-jumps once in air, then cannot jump again
- Player double-jump resets when landing
- Player ducks on floor, reducing collision height
- Player dies when falling below map bounds
- Player invincibility prevents damage for 1.5s

---

## Phase 4: Terrain & Collision (Slopes, One-Way)

### Tile-Based Collision Setup

In the Level scene's `onReady()`:

```typescript
// 1. Generate slope/polygon colliders first (returns handled tile IDs)
const slopeTileIds = this.map.generateSlopeCollision({
    layer: "main",
    collisionGroup: "world",
});

// 2. Get one-way tile IDs from Tiled properties
const oneWayIds = this.map.getTileIdsByProperty("oneWay", true);

// 3. Generate rect colliders, excluding slopes and one-way tiles
this.map.generateCollision({
    layer: "main",
    allSolid: true,
    collisionGroup: "world",
    oneWayTileIds: oneWayIds,
    excludeTileIds: [...slopeTileIds],  // new option to exclude
});
```

### Slope Tiles

The Kenney pack includes `ramp_short_a/b` (2-tile slope) and `ramp_long_a/b/c` (3-tile slope) for each terrain theme. In Tiled's tile collision editor, define polygon collision shapes:

**Right-ascending short slope (ramp_short_a):**
```
Polygon: (0,64) → (64,0) → (64,64)
Shape: right triangle, slope goes from bottom-left to top-right
```

**Left-ascending short slope (flip of above):**
Use Tiled's horizontal flip on the tile. The engine already parses `flipH` on tiles — the collision generator needs to mirror the polygon vertices when `flipH = true`.

**The SAT solver already handles polygon shapes correctly.** The `floorMaxAngle` (default 45 degrees) means slopes up to 45 degrees register as floor, so `isOnFloor()` returns true on slopes. The player's `move()` will slide along the slope surface naturally.

### One-Way Platforms

Cloud tiles (`terrain_*_cloud_*`) and thin horizontal platforms (`terrain_*_horizontal_*`) get `oneWay = true` in Tiled's tile properties. The existing `oneWayTileIds` option in `generateCollision()` handles these perfectly.

- [x] Configure slope tile collision polygons in Tiled tileset
- [x] Implement `generateSlopeCollision()` or integrate into `generateCollision()` with `excludeTileIds`
- [x] Handle flipped tile polygon mirroring in slope collision generator
- [x] Set `oneWay = true` property on cloud and horizontal platform tiles
- [x] Test player walking up/down short slopes
- [x] Test player walking up/down long (3-tile) slopes
- [x] Test one-way platforms (pass through from below, land from above)
- [x] Test player `isOnFloor()` on slopes
- [x] Verify `floorMaxAngle` works correctly with slope angles

---

## Phase 5: Interactive Tiles (Breakable, Fall-Away, Springs, Ladders)

### 5a. Breakable Blocks (`entities/breakable-block.tsx`)

Two types of breakable blocks:

1. **Brick blocks** (brick_brown, brick_grey, bricks_*) — destroy when hit from below
2. **Coin blocks** (block_coin) — emit a coin when hit from below, then become `block_empty`
3. **Exclamation blocks** (block_exclamation) — emit a power-up when hit, become `block_empty`

**Spawning:** Use `spawnFromTiles()` with brick/block tile IDs. The tile is cleared from the visual layer; the BreakableBlock renders its own sprite.

```tsx
export class BreakableBlock extends StaticCollider {
    blockType: "brick" | "coin" | "exclamation" = "brick";
    private _hit = false;
    sprite!: Sprite;

    override collisionGroup = "world";

    override build() {
        return (
            <>
                <CollisionShape shape={Shape.rect(64, 64)} />
                <Sprite ref="sprite" texture="tiles" centered={true} />
            </>
        );
    }

    hitFromBelow(player: Player): void {
        if (this._hit && this.blockType !== "brick") return;

        this.game.audio.play("bump", { bus: "sfx" });

        if (this.blockType === "brick") {
            // Bump animation then destroy
            this.tween()
                .to({ position: { y: this.position.y - 8 } }, 0.05, Ease.quadOut)
                .chain()
                .to({ position: { y: this.position.y } }, 0.05, Ease.quadIn)
                .onComplete(() => this.destroy());
            // Spawn break particles (4 quarter-pieces flying out)
            this._spawnBreakParticles();
        } else {
            // Coin/exclamation: bump animation, spawn reward, become empty
            this._hit = true;
            this.tween()
                .to({ position: { y: this.position.y - 8 } }, 0.05, Ease.quadOut)
                .chain()
                .to({ position: { y: this.position.y } }, 0.05, Ease.quadIn);

            if (this.blockType === "coin") {
                this._spawnCoinAbove();
                this.sprite.sourceRect = tileAtlas.getFrame("block_empty")!;
            } else {
                this._spawnPowerUpAbove();
                this.sprite.sourceRect = tileAtlas.getFrame("block_empty")!;
            }
        }
    }
}
```

**Detection:** In the Level scene, use `physics.onContact("player", "world")` and check if `info.normal.y > 0` (player hit something above) and the collider is a BreakableBlock:

```typescript
this.game.physics.onContact("player", "world", (player, other, info) => {
    if (info.normal.y > 0 && other instanceof BreakableBlock) {
        other.hitFromBelow(player as Player);
    }
});
```

### 5b. Fall-Away Platforms (`entities/fall-away-platform.tsx`)

Platforms that shake and crumble when stepped on.

```tsx
export class FallAwayPlatform extends StaticCollider {
    fallDelay = 0.5;       // seconds before falling
    respawnDelay = 3.0;    // seconds before respawning (0 = no respawn)
    private _falling = false;
    private _originalY = 0;

    override collisionGroup = "world";

    override onReady() {
        this._originalY = this.position.y;
    }

    trigger(): void {
        if (this._falling) return;
        this._falling = true;

        // Shake for fallDelay seconds
        this.tween()
            .to({ position: { x: this.position.x + 3 } }, 0.03)
            .chain()
            .to({ position: { x: this.position.x - 3 } }, 0.03)
            .loop(Math.floor(this.fallDelay / 0.06))
            .onComplete(() => {
                // Fall and fade
                this.tween()
                    .to({ position: { y: this.position.y + 200 } }, 0.4, Ease.quadIn);
                this.sprite.tween()
                    .to({ alpha: 0 }, 0.3)
                    .onComplete(() => {
                        if (this.respawnDelay > 0) {
                            this.after(this.respawnDelay, () => this._respawn());
                        } else {
                            this.destroy();
                        }
                    });
            });
    }

    private _respawn(): void {
        this.position.y = this._originalY;
        this.sprite.alpha = 1;
        this._falling = false;
    }
}
```

**Trigger detection:** Check each frame if the player's floor collider is a FallAwayPlatform.

### 5c. Springs (`entities/spring.tsx`)

Bounce pads that launch the player upward.

```tsx
export class Spring extends StaticCollider {
    bounceForce = -800;  // strong upward launch
    sprite!: AnimatedSprite;

    override collisionGroup = "world";

    bounce(actor: Actor): void {
        actor.velocity.y = this.bounceForce;
        this.game.audio.play("jump_high", { bus: "sfx" });
        // Play spring extension animation
        this.sprite.sourceRect = tileAtlas.getFrame("spring_out")!;
        this.after(0.3, () => {
            this.sprite.sourceRect = tileAtlas.getFrame("spring")!;
        });
    }
}
```

**Detection:** `onContact("player", "world")` with `info.normal.y < 0` (player landing on top) and collider is Spring.

### 5d. Ladder Zones (`entities/ladder-zone.ts`)

Ladders are placed as tiles in the main layer. A `LadderZone` Sensor is spawned for each contiguous ladder column to detect player overlap.

**Spawning approach:** Rather than `spawnFromTiles` (which clears the tile), we scan the tile layer for ladder tile IDs and create Sensor zones covering the ladder column. The tiles remain visible.

```typescript
export function createLadderZones(map: TileMap, layerName: string): LadderZone[] {
    const ladderIds = map.getTileIdsByType("ladder");
    if (ladderIds.length === 0) return [];

    const ladderIdSet = new Set(ladderIds);
    const zones: LadderZone[] = [];
    const visited = new Set<string>();

    // Scan for contiguous vertical ladder columns
    for (let col = 0; col < map.mapWidth; col++) {
        for (let row = 0; row < map.mapHeight; row++) {
            const key = `${col},${row}`;
            if (visited.has(key)) continue;

            const tileId = map.getTileAt(col, row, layerName);
            if (!ladderIdSet.has(tileId)) continue;

            // Found start of a ladder column — extend downward
            let endRow = row;
            while (endRow < map.mapHeight && ladderIdSet.has(map.getTileAt(col, endRow, layerName))) {
                visited.add(`${col},${endRow}`);
                endRow++;
            }

            const height = (endRow - row) * map.tileHeight;
            const zone = new LadderZone();
            zone.position.x = col * map.tileWidth + map.tileWidth / 2;
            zone.position.y = row * map.tileHeight + height / 2;
            zone.ladderHeight = height;
            zone.ladderTop = row * map.tileHeight;
            zone.ladderBottom = endRow * map.tileHeight;

            // CollisionShape sized to the full ladder column
            const shape = new CollisionShape();
            shape.shape = Shape.rect(map.tileWidth * 0.8, height);
            zone.add(shape);

            map.add(zone);
            zones.push(zone);
        }
    }

    return zones;
}
```

```typescript
export class LadderZone extends Sensor {
    ladderHeight = 0;
    ladderTop = 0;
    ladderBottom = 0;

    override onReady() {
        this.tag("ladder");
        this.bodyEntered.connect((body) => {
            if (body instanceof Player) {
                body._isOnLadder = true;
            }
        });
        this.bodyExited.connect((body) => {
            if (body instanceof Player) {
                body._isOnLadder = false;
                body._isClimbing = false;
            }
        });
    }
}
```

- [x] Implement `BreakableBlock` with brick/coin/exclamation variants
- [x] Implement brick break particles (4 quarter-pieces)
- [x] Implement coin spawn from coin blocks (pop-up animation)
- [x] Implement `FallAwayPlatform` with shake-then-fall + optional respawn
- [x] Implement `Spring` bounce pad
- [x] Implement `LadderZone` sensor and `createLadderZones()` scanner
- [x] Wire ladder state into Player climbing logic
- [x] Add contact callbacks for breakable blocks (hit from below detection)
- [x] Add contact callbacks for springs
- [x] Add fall-away trigger detection (floor collider check)
- [x] Write tests for breakable blocks
- [x] Write tests for fall-away platforms
- [x] Write tests for springs
- [x] Write tests for ladder climbing

### Tests for Phase 5

**Unit:** `examples/advanced-platformer/__tests__/breakable-block.test.ts`
- Brick block destroys when hit from below
- Coin block spawns coin and becomes empty
- Exclamation block spawns power-up and becomes empty
- Block does not break when hit from side/above
- Already-hit coin block ignores further hits

**Unit:** `examples/advanced-platformer/__tests__/moving-platform.test.ts`
- Fall-away platform shakes when player lands on it
- Fall-away platform disappears after delay
- Fall-away platform respawns after respawnDelay (if set)

---

## Phase 6: Enemies

### Enemy Types (5 enemies, increasing difficulty across levels)

#### Base Enemy (`entities/enemies/base-enemy.ts`)

```typescript
const DamageableActor = Damageable(Actor, {
    maxHealth: 1,
    invincibilityDuration: 0,
    deathTween: false,
});

export abstract class BaseEnemy extends DamageableActor {
    scoreValue = 100;
    override collisionGroup = "enemies";
    override solid = true;

    override onReady() {
        super.onReady();
        this.tag("enemy");
    }

    stomp(): void {
        gameState.score += this.scoreValue;
        this.game.audio.play("disappear", { bus: "sfx" });
        // Squash animation
        this.tween()
            .to({ scale: { x: 1.5, y: 0.3 } }, 0.15, Ease.quadOut)
            .onComplete(() => this.destroy());
    }
}
```

#### 1. Slime (`entities/enemies/slime.tsx`) — Level 1+

Basic ground patrol. Walks left/right, reverses at edges and walls. Stompable.

```tsx
export class Slime extends BaseEnemy {
    speed = 60;
    direction = 1;
    scoreValue = 100;

    override build() {
        return (
            <>
                <CollisionShape shape={Shape.rect(48, 32)} />
                <AnimatedSprite ref="sprite" spriteSheet={slimeSheet} animation="walk" />
            </>
        );
    }

    override onFixedUpdate(dt: number) {
        const dir = this.direction > 0 ? Vec2.RIGHT : Vec2.LEFT;
        if (this.isOnFloor() && this.isEdgeAhead(dir)) this.direction *= -1;
        if (this.isOnWall()) this.direction *= -1;

        this.velocity.x = this.speed * this.direction;
        this.move(dt);
        this.sprite.flipH = this.direction < 0;
    }
}
```

**Variants:** Normal slime (green, 1HP), Fire slime (red, damages on stomp unless player has star power), Spike slime (unstompable — damages player on all contact).

#### 2. Bee (`entities/enemies/bee.tsx`) — Level 1+

Flying enemy with sine-wave vertical movement. Stompable.

```tsx
export class Bee extends BaseEnemy {
    speed = 50;
    amplitude = 40;
    frequency = 1.5;
    direction = 1;
    scoreValue = 150;
    private _time = 0;
    private _baseY = 0;

    override applyGravity = false;

    override onReady() {
        super.onReady();
        this._baseY = this.position.y;
    }

    override onFixedUpdate(dt: number) {
        this._time += dt;
        this.velocity.x = this.speed * this.direction;
        this.position.y = this._baseY + Math.sin(this._time * this.frequency * Math.PI * 2) * this.amplitude;
        this.move(dt);
        this.sprite.flipH = this.direction < 0;
    }
}
```

#### 3. Snail (`entities/enemies/snail.tsx`) — Level 2+

Slow ground patrol. When stomped, retreats into shell (becomes a kickable projectile).

```tsx
export class Snail extends BaseEnemy {
    speed = 30;
    shellSpeed = 300;
    direction = 1;
    scoreValue = 200;
    private _inShell = false;
    private _shellMoving = false;

    override stomp(): void {
        if (!this._inShell) {
            // First stomp: retreat into shell
            this._inShell = true;
            this.speed = 0;
            this.sprite.play("shell");
        } else if (!this._shellMoving) {
            // Second stomp: kick the shell
            this._shellMoving = true;
            this.speed = this.shellSpeed;
            this.direction = /* direction player kicked from */;
            this.tag("projectile");  // damages other enemies
        } else {
            // Stop the shell
            this._shellMoving = false;
            this.speed = 0;
        }
    }
}
```

#### 4. Frog (`entities/enemies/frog.tsx`) — Level 2+

Jumping enemy. Sits idle, then leaps toward the player periodically.

```tsx
export class Frog extends BaseEnemy {
    jumpForce = -400;
    jumpInterval = 2.0;  // seconds between jumps
    scoreValue = 250;
    private _jumpTimer = 0;

    override onFixedUpdate(dt: number) {
        if (this.isOnFloor()) {
            this._jumpTimer += dt;
            this.velocity.x = 0;
            this.sprite.play("rest");

            if (this._jumpTimer >= this.jumpInterval) {
                this._jumpTimer = 0;
                // Jump toward player
                const player = this.scene.findFirst("player");
                if (player) {
                    const dx = player.globalPosition.x - this.globalPosition.x;
                    this.velocity.x = Math.sign(dx) * 120;
                    this.velocity.y = this.jumpForce;
                    this.sprite.play("jump");
                }
            }
        }
        this.move(dt);
    }
}
```

#### 5. Saw (`entities/enemies/saw.tsx`) — Level 3

Spinning saw blade that follows a path defined in Tiled (polyline on the object). Always damages player on contact — cannot be stomped.

```tsx
export class Saw extends Node2D {
    speed = 100;
    path: Vec2[] = [];  // set by spawnObjects from Tiled polyline
    private _pathIndex = 0;
    private _forward = true;
    sprite!: AnimatedSprite;

    override build() {
        return (
            <>
                <Sensor>
                    <CollisionShape shape={Shape.circle(28)} />
                </Sensor>
                <AnimatedSprite ref="sprite" spriteSheet={sawSheet} animation="spin" />
            </>
        );
    }

    override onFixedUpdate(dt: number) {
        if (this.path.length < 2) return;
        const target = this.path[this._pathIndex]!;
        const diff = target.sub(this.position);
        const dist = diff.length();

        if (dist < 2) {
            // Reached waypoint — advance
            if (this._forward) {
                this._pathIndex++;
                if (this._pathIndex >= this.path.length) {
                    this._forward = false;
                    this._pathIndex = this.path.length - 2;
                }
            } else {
                this._pathIndex--;
                if (this._pathIndex < 0) {
                    this._forward = true;
                    this._pathIndex = 1;
                }
            }
        } else {
            const move = diff.normalized().scale(Math.min(this.speed * dt, dist));
            this.position = this.position.add(move);
        }
    }
}
```

### Stomp Detection

Reuse the platformer pattern — `physics.onContact("player", "enemies")`:

```typescript
this.game.physics.onContact("player", "enemies", (player, enemy, info) => {
    const p = player as Player;
    const e = enemy as BaseEnemy;

    if (p._starPower) {
        // Star power: destroy any enemy on contact
        e.stomp();
        return;
    }

    if (info.normal.y < 0 && p.velocity.y > 0) {
        // Player is above and falling → stomp
        if (e instanceof SpikeSlime) {
            p.takeDamage(1);  // can't stomp spike slime
        } else {
            e.stomp();
            p.velocity.y = -250;  // bounce
        }
    } else {
        // Side/below contact → damage player
        p.takeDamage(1);
    }
});
```

- [x] Implement `BaseEnemy` with stomp animation and score
- [x] Implement `Slime` (ground patrol, edge/wall turn)
- [ ] Implement spike slime variant (unstompable)
- [x] Implement `Bee` (flying sine-wave, stompable)
- [x] Implement `Snail` (shell mechanic: stomp → shell → kick)
- [x] Implement `Frog` (periodic jumping toward player)
- [x] Implement `Saw` (path-following hazard)
- [x] Wire stomp detection in Level scene
- [x] Wire star-power instant-kill logic
- [x] Write enemy patrol tests (edge detection, wall reversal)
- [x] Write stomp tests
- [x] Write snail shell kick test

### Tests for Phase 6

**Unit:** `examples/advanced-platformer/__tests__/enemies.test.ts`
- Slime reverses direction at edge
- Slime reverses direction at wall
- Slime dies when stomped, awards 100 points
- Bee oscillates vertically while moving horizontally
- Snail enters shell on first stomp
- Snail shell kicks on second stomp
- Frog jumps toward player after interval
- Saw follows path back and forth
- Spike slime damages player even when stomped
- Star power kills enemies on any contact

---

## Phase 7: Moving Platforms & Hazards

### 7a. Moving Platforms (`entities/moving-platform.tsx`)

Moving platforms use `StaticCollider` with `constantVelocity` for player carry. The platform's position is animated in `onFixedUpdate`.

```tsx
export class MovingPlatform extends StaticCollider {
    // Set from Tiled object properties
    direction: "horizontal" | "vertical" = "horizontal";
    distance = 128;   // pixels to travel
    speed = 60;       // pixels/sec
    waitTime = 0.5;   // pause at endpoints

    override collisionGroup = "world";
    private _startPos = new Vec2(0, 0);
    private _progress = 0;    // 0..1
    private _forward = true;
    private _waiting = 0;

    override build() {
        return (
            <>
                <CollisionShape shape={Shape.rect(128, 32)} />
                <Sprite texture="tiles" sourceRect={/* cloud_middle x2 */} centered={true} />
            </>
        );
    }

    override onReady() {
        this._startPos = this.position.clone();
    }

    override onFixedUpdate(dt: number) {
        if (this._waiting > 0) {
            this._waiting -= dt;
            this.constantVelocity.set(0, 0);
            return;
        }

        const moveDir = this._forward ? 1 : -1;
        const speedDt = (this.speed / this.distance) * dt;
        this._progress += speedDt * moveDir;

        if (this._progress >= 1) {
            this._progress = 1;
            this._forward = false;
            this._waiting = this.waitTime;
        } else if (this._progress <= 0) {
            this._progress = 0;
            this._forward = true;
            this._waiting = this.waitTime;
        }

        // Set position
        const offset = this._progress * this.distance;
        if (this.direction === "horizontal") {
            const newX = this._startPos.x + offset;
            this.constantVelocity.set(this.speed * moveDir, 0);
            this.position.x = newX;
        } else {
            const newY = this._startPos.y + offset;
            this.constantVelocity.set(0, this.speed * moveDir);
            this.position.y = newY;
        }
    }
}
```

### 7b. Hazards

**Spikes** (`entities/spike.ts`): Sensor placed at spike tile locations. Damages player on contact.

**Water/Lava Zones** (`entities/water-zone.ts`): Large Sensor covering water/lava regions. Instant death.

**Bombs** (optional): Placed as tiles. When player is nearby, fuse lights (bomb_active animation), then explodes after delay, damaging nearby entities.

- [x] Implement `MovingPlatform` with horizontal/vertical modes
- [x] Implement platform carry via `constantVelocity`
- [x] Implement endpoint waiting
- [x] Implement `Spike` sensor (damage on contact)
- [x] Implement `WaterZone` sensor (instant death)
- [x] Wire Tiled object properties to MovingPlatform (direction, distance, speed)
- [x] Write moving platform tests (player carry, direction reversal)

---

## Phase 8: Collectibles, Power-Ups, Keys/Locks

### 8a. Coins (`entities/coin.tsx`)

Three tiers: bronze (1 point), silver (5 points), gold (10 points).

```tsx
export class Coin extends Sensor {
    value = 10;  // default gold

    override build() {
        return (
            <>
                <CollisionShape shape={Shape.circle(20)} />
                <AnimatedSprite ref="sprite" spriteSheet={coinSheet} animation="spin" />
            </>
        );
    }

    override onReady() {
        this.tag("coin");
        this.bodyEntered.connect((body) => {
            if (body.hasTag("player")) {
                gameState.coins += this.value;
                gameState.score += this.value * 10;
                this.game.audio.play("coin", { bus: "sfx" });
                // Pop-up collect animation
                this.tween()
                    .to({ position: { y: this.position.y - 30 } }, 0.2, Ease.quadOut);
                this.sprite.tween()
                    .to({ alpha: 0 }, 0.2)
                    .onComplete(() => this.destroy());
            }
        });
    }
}
```

### 8b. Gems (`entities/gem.tsx`)

Higher-value collectible. 4 colors: blue (50), green (100), red (200), yellow (500).

### 8c. Heart Pickup (`entities/heart-pickup.tsx`)

Restores 1 health point. Uses the `heart` tile sprite.

### 8d. Power-Up Star (`entities/power-up.tsx`)

Grants 10 seconds of invincibility + speed boost + contact-kill enemies.

```tsx
export class PowerUp extends Sensor {
    powerType: "star" = "star";

    override onReady() {
        this.tag("powerup");
        this.bodyEntered.connect((body) => {
            if (body.hasTag("player")) {
                const player = body as Player;
                player.activateStarPower(10);  // 10 seconds
                this.game.audio.play("magic", { bus: "sfx" });
                gameState.score += 500;
                this.destroy();
            }
        });
    }
}
```

### 8e. Keys & Locks (`entities/key-pickup.tsx`, `entities/locked-door.tsx`)

4 colored keys (red, blue, green, yellow). Picking up a key adds it to `gameState.keys`. Touching a matching lock removes the key and destroys the lock gate.

```typescript
// state.ts
export const gameState = reactiveState({
    score: 0,
    coins: 0,
    health: 5,
    maxHealth: 5,
    lives: 3,
    currentLevel: 1,
    keys: { red: false, blue: false, green: false, yellow: false },
    starPower: false,
    starTimeRemaining: 0,
    checkpoint: null as Vec2 | null,
});
```

```tsx
export class LockedDoor extends StaticCollider {
    color: "red" | "blue" | "green" | "yellow" = "red";
    override collisionGroup = "world";

    // Player walks into locked door; if they have the key, it opens
    // Detected via a Sensor child that overlaps the door
}
```

### 8f. Checkpoint Flags (`entities/flag.tsx`)

When player touches a flag, it waves (animated) and sets `gameState.checkpoint`. On death, player respawns at last checkpoint instead of level start.

### 8g. Door Exit (`entities/door-exit.tsx`)

Level completion trigger. When touched:
1. Door opens (swap to `door_open` sprite)
2. Player walks into door (disable input, tween player position)
3. Transition to next level

- [x] Implement `Coin` (collect popup, score + coins)
- [x] Implement `Gem` (4 colors, high value)
- [x] Implement `HeartPickup` (restore 1 HP)
- [x] Implement `PowerUp` star (10s invincibility)
- [x] Implement `KeyPickup` (4 colors, auto-detect from tile type)
- [x] Implement `LockedDoor` (4 colors, blocks until matching key)
- [x] Implement `Flag` checkpoint (sets gameState.checkpoint)
- [x] Implement `DoorExit` level transition (signal-based, scene transition deferred)
- [x] Implement checkpoint-based spawn point
- [x] Wire all collectibles to `gameState`
- [x] Write key/lock tests
- [x] Write collectible tests (coin, gem, heart, power-up)
- [x] Write checkpoint/exit tests

### Tests for Phase 8

**Unit:** `examples/advanced-platformer/__tests__/power-up.test.ts`
- Star power activates on pickup, lasts 10 seconds
- Star power kills enemies on contact
- Star power does not stack (resets timer)
- Star power visual effect (blink) active during power-up

**Unit:** `examples/advanced-platformer/__tests__/key-lock.test.ts`
- Picking up red key sets gameState.keys.red = true
- Walking into red lock with red key destroys the lock
- Walking into red lock without red key does nothing (blocked)
- Lock opens visually before being removed

---

## Phase 9: Parallax Backgrounds & Camera

### Parallax Implementation (`parallax/parallax-background.tsx`)

No engine change needed. The parallax background is a game-level Node2D that positions tiling background sprites based on camera position.

```tsx
export class ParallaxBackground extends Node2D {
    override renderFixed = false;  // participates in camera transform

    override onUpdate(dt: number) {
        // Position this node to counteract camera movement at different rates per layer
        // Each child has a scrollFactor; this node stays at world origin
        // Children adjust their own drawing offset
    }
}

export class ParallaxLayer extends Node2D {
    scrollFactor = 0.5;
    texture = "";
    tileWidth = 256;
    tileHeight = 256;

    override onDraw(ctx: DrawContext) {
        if (!this.texture) return;

        const camera = this.scene.findByType(Camera)[0];
        if (!camera) return;

        const game = this.game;
        const camX = camera.position.x;
        const camY = camera.position.y;

        // Offset: how much this layer should be shifted relative to camera
        // A scrollFactor of 0 means the layer doesn't move (fixed sky)
        // A scrollFactor of 1 means it moves with the camera (foreground)
        const offsetX = -camX * (1 - this.scrollFactor);
        const offsetY = -camY * (1 - this.scrollFactor);

        // Calculate how many tiles we need to cover the visible area
        const viewW = game.width / (camera.zoom || 1);
        const viewH = game.height / (camera.zoom || 1);

        // Starting tile position (wrap around)
        const startX = Math.floor((camX - viewW / 2 + offsetX) / this.tileWidth) * this.tileWidth - offsetX;
        const startY = Math.floor((camY - viewH / 2 + offsetY) / this.tileHeight) * this.tileHeight - offsetY;

        // Draw tiled background covering the visible area + padding
        for (let y = startY - this.tileHeight; y < startY + viewH + this.tileHeight * 2; y += this.tileHeight) {
            for (let x = startX - this.tileWidth; x < startX + viewW + this.tileWidth * 2; x += this.tileWidth) {
                ctx.image(this.texture, new Vec2(x + offsetX, y + offsetY));
            }
        }
    }
}
```

### Layer Setup Per Level Theme

**Level 1 (Grass/Hills):**
```
ParallaxBackground
├── SolidSky (ParallaxLayer, scrollFactor=0, texture="bg_solid_sky")
├── Clouds (ParallaxLayer, scrollFactor=0.05, texture="bg_clouds")
├── FadeHills (ParallaxLayer, scrollFactor=0.2, texture="bg_fade_hills")
└── ColorHills (ParallaxLayer, scrollFactor=0.4, texture="bg_color_hills")
```

**Level 2 (Desert):**
```
ParallaxBackground
├── SolidSand (ParallaxLayer, scrollFactor=0, texture="bg_solid_sand")
├── Clouds (ParallaxLayer, scrollFactor=0.05, texture="bg_clouds")
├── FadeDesert (ParallaxLayer, scrollFactor=0.2, texture="bg_fade_desert")
└── ColorDesert (ParallaxLayer, scrollFactor=0.4, texture="bg_color_desert")
```

### Camera Setup

```typescript
const camera = this.add(Camera);
camera.follow = this.player;
camera.smoothing = 0.08;
camera.zoom = 1;
camera.bounds = new Rect(0, 0, map.bounds.width, map.bounds.height);
camera.offset.y = -30;  // look slightly ahead/above
```

- [x] Implement `ParallaxBackground` container node
- [x] Implement `ParallaxLayer` with tiling + scroll factor
- [x] Set up 4-layer parallax for each level theme
- [x] Configure camera follow with smoothing and bounds
- [x] Test parallax scrolling visually
- [x] Verify background tiles seamlessly at all camera positions

---

## Phase 10: HUD, Menus & Audio

### 10a. HUD (`hud/hud.tsx`)

```
HUD (Layer, fixed, zIndex=100)
├── HeartRow (Node2D, top-left)
│   ├── Heart1 (Sprite: hud_heart / hud_heart_half / hud_heart_empty)
│   ├── Heart2
│   ├── Heart3
│   ├── Heart4
│   └── Heart5
├── CoinDisplay (Node2D, below hearts)
│   ├── CoinIcon (Sprite: hud_coin)
│   ├── MultiplierIcon (Sprite: hud_character_multiply)
│   └── CoinDigits (Sprite[]: hud_character_0..9)
├── ScoreLabel (Label, top-right)
├── KeyRow (Node2D, below score)
│   ├── RedKey? (Sprite: hud_key_red, visible when collected)
│   ├── BlueKey?
│   ├── GreenKey?
│   └── YellowKey?
└── StarPowerBar (ProgressBar, bottom-center, visible during star power)
```

**HUD renders using the tile atlas HUD sprites** (64x64 pixel HUD elements) scaled down for the 640x360 canvas. Each heart icon is rendered at ~24x24 using `sourceRect` from the tile atlas.

**Coin counter uses sprite digits** (hud_character_0 through hud_character_9) for a pixel-art look matching the game's style.

### 10b. Title Screen (`scenes/title.tsx`)

```
TitleScene
├── ParallaxBackground (same as level 1)
├── Layer (fixed)
│   ├── Panel (centered, semi-transparent)
│   ├── Label "ADVANCED PLATFORMER" (large)
│   ├── CharacterFront (Sprite: character_green_front, centered)
│   ├── Button "Start Game"
│   └── Label "Arrow Keys / WASD + Space"
```

### 10c. Game Over / Victory Screens

Similar layout to title but with score display and retry/continue buttons.

### 10d. Audio Setup

```typescript
// In main.ts:
game.use(AudioPlugin());

// In level.ts onReady():
// Play background music (if we had a music track — Kenney pack has SFX only)
// Use the 10 SFX files:
// jump, jump_high, coin, gem, hurt, bump, select, throw, magic, disappear
```

| Sound | Trigger |
|-------|---------|
| `jump` | Player jumps |
| `jump_high` | Double jump / spring bounce |
| `coin` | Coin collected |
| `gem` | Gem collected |
| `hurt` | Player takes damage |
| `bump` | Hit breakable block |
| `select` | Menu selection, door open |
| `throw` | Snail shell kick |
| `magic` | Star power activated |
| `disappear` | Enemy killed |

### 10e. Input Configuration (`config.ts`)

```typescript
export const INPUT_BINDINGS = {
    left: ["ArrowLeft", "KeyA", "gamepad:left-stick-left", "gamepad:dpad-left"],
    right: ["ArrowRight", "KeyD", "gamepad:left-stick-right", "gamepad:dpad-right"],
    up: ["ArrowUp", "KeyW", "gamepad:left-stick-up", "gamepad:dpad-up"],
    down: ["ArrowDown", "KeyS", "gamepad:left-stick-down", "gamepad:dpad-down"],
    jump: ["Space", "KeyZ", "gamepad:a"],
    duck: ["ArrowDown", "KeyS", "gamepad:left-stick-down"],
    ui_confirm: ["Enter", "gamepad:a", "gamepad:start"],
};

export const COLLISION_GROUPS: CollisionGroupsConfig = {
    player:  { collidesWith: ["world", "enemies", "items"] },
    world:   { collidesWith: ["player", "enemies"] },
    enemies: { collidesWith: ["world", "player"] },
    items:   { collidesWith: ["player"] },
};
```

- [ ] Implement HUD with pixel-art hearts, coin counter, score, keys
- [ ] Implement sprite-digit coin counter using HUD character tiles
- [ ] Implement key icons (show/hide based on gameState)
- [ ] Implement star power indicator (progress bar or timer)
- [ ] Implement Title screen with parallax background
- [ ] Implement Game Over screen with score
- [ ] Implement Victory screen with total score
- [ ] Wire all audio SFX to game events
- [ ] Configure input bindings with gamepad support
- [ ] Add touch controls layout for mobile

---

## Phase 11: Level Design (3 Levels in Tiled)

### Level 1: Grasslands (Easy)

**Theme:** Grass terrain, hills background, blue sky.
**Size:** ~100x20 tiles (6400x1280 px).
**Features introduced:**
- Basic ground traversal, gaps to jump
- Gold coins scattered on platforms
- 2 Slimes patrolling
- 1 Bee flying over a gap
- 1 set of cloud one-way platforms
- 1 short slope ramp
- 1 spring to reach a high area
- 5 breakable brick blocks (1 containing a star power-up)
- 1 coin block (3 coins)
- Decorations: bushes, grass tufts, signs, fences
- 1 checkpoint flag at midpoint
- Door exit at end

### Level 2: Desert Ruins (Medium)

**Theme:** Dirt/sand terrain, desert background.
**Size:** ~120x25 tiles (7680x1600 px).
**Features introduced:**
- Ladders (3 ladder sections connecting vertical areas)
- Moving platforms (2 horizontal, 1 vertical)
- Fall-away platforms over a pit
- Snails and Frogs
- Red key + red locked door (requires exploration)
- Water hazard (instant death)
- Long slopes (3-tile ramps)
- Exclamation blocks with power-ups
- More coins + gems for higher score potential
- 2 checkpoint flags

### Level 3: Dark Fortress (Hard)

**Theme:** Stone/purple terrain, mushroom background.
**Size:** ~140x30 tiles (8960x1920 px).
**Features introduced:**
- Complex multi-path level with vertical sections
- Saw hazards on paths
- Spike slimes (unstompable)
- Multiple key colors needed (blue key, green key)
- Combination of all previous mechanics
- Tight platforming sections with precise jumps
- Moving platforms over lava
- Conveyor belts (push player in a direction)
- Hidden areas with gems behind breakable walls
- 3 checkpoint flags
- Boss-like section: multiple enemies + hazards before the exit

### Tiled Workflow

1. Create shared tileset (`tileset.tsx`) with all tile types, collision shapes, and properties
2. Build each level with 3 tile layers + 1 object layer
3. Place terrain as tiles in the `main` layer
4. Place decorations in `background` layer (behind entities)
5. Place foreground overlays in `foreground` layer (on top of entities)
6. Place enemy spawn points, moving platform paths, and player start as objects in `entities` layer
7. Test each level with `pnpm dev` before moving on

- [ ] Design and build Level 1 in Tiled (Grasslands)
- [ ] Design and build Level 2 in Tiled (Desert Ruins)
- [ ] Design and build Level 3 in Tiled (Dark Fortress)
- [ ] Test all level transitions
- [ ] Balance difficulty curve across levels
- [ ] Ensure all tile types are properly tagged/typed in the tileset

---

## Phase 12: Tests & Polish

### Automated Tests

Build on the existing test patterns (see `examples/platformer/__tests__/`).

```
examples/advanced-platformer/__tests__/
├── player.test.ts           # 15+ tests
├── enemies.test.ts          # 12+ tests
├── breakable-block.test.ts  # 6+ tests
├── moving-platform.test.ts  # 4+ tests
├── power-up.test.ts         # 4+ tests
├── key-lock.test.ts         # 4+ tests
└── integration.test.ts      # 5+ full scenarios
```

Integration tests use `TestRunner` with `InputScript` to play through level sections deterministically:

```typescript
test("player collects key and opens locked door", async () => {
    const result = await runLevel("level1", InputScript.create()
        .tap("right", 60)    // walk to key
        .wait(10)            // collect
        .tap("right", 30)    // walk to door
        .wait(10)
    );
    // Assert door is destroyed and player passed through
});
```

### Polish Checklist

- [ ] Particle effects for block breaking (4 quarter-pieces)
- [ ] Coin collect "pop" animation (bounce up + fade)
- [ ] Screen shake on player death
- [ ] Smooth scene transitions (fade to black)
- [ ] Enemy squash death animation
- [ ] Spring bounce squash-stretch on player
- [ ] Checkpoint flag wave animation
- [ ] Door open animation
- [ ] Player dust puffs on landing (optional)
- [ ] Score popup text at collection point (+100, +500, etc.)
- [ ] Update `examples/` section in CLAUDE.md
- [ ] Update CHANGELOG.md

---

## Definition of Done

- [ ] All 12 phases marked Done in status table
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes (including all new tests, 50+ minimum)
- [ ] `pnpm lint` clean
- [ ] Game runs in browser via `pnpm dev` → navigate to advanced-platformer
- [ ] All 3 levels playable start to finish
- [ ] Parallax scrolling background visible and smooth
- [ ] Player can climb ladders, jump, double jump, duck
- [ ] Breakable blocks break from below, coin/exclamation blocks yield rewards
- [ ] Fall-away platforms crumble on contact
- [ ] Moving platforms carry the player
- [ ] Slopes walkable without glitching
- [ ] All 5 enemy types functional with stomp kills
- [ ] Keys open matching colored locks
- [ ] Star power-up grants temporary invincibility
- [ ] Springs launch player upward
- [ ] Checkpoints save respawn position
- [ ] HUD displays hearts, coins, score, keys
- [ ] All 10 sound effects play at appropriate times
- [ ] Gamepad and touch controls work
- [ ] Title, Game Over, and Victory screens functional
