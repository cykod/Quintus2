# Phase 9: AI Prefabs & Example Games — Detailed Design

> **Goal:** Build 4 polished example games that exercise every engine system, then distill common patterns into a `@quintus/ai-prefabs` proposal for review.
> **Outcome:** Seven example games run and are playable (bouncing balls, basic platformer, tilemap, tween-ui already exist as minimal demos; platformer and dungeon are the two full games). Four new full example games — Breakout, Space Shooter, Tower Defense, and Puzzle (Sokoban) — are built incrementally, each with comprehensive integration tests. The object pooling system (from `steering/POOLING_PLAN.md`) is implemented between Breakout and Space Shooter to support high-volume entity lifecycle. After all games are complete, a `PREFABS_PROPOSAL.md` documents the reusable patterns extracted across all games, ready for review before implementation.

---

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Asset preparation (download packs, create tile CSVs) | Done |
| 1.5 | XML Texture Atlas support in `@quintus/sprites` | Done |
| 2 | Breakout game | Done |
| 3 | Object pooling system (`steering/POOLING_PLAN.md`) | Done |
| 4 | Space Shooter game (uses pooling) | Done |
| 5 | Tower Defense game | Done |
| 6 | Puzzle game (Sokoban) | Pending |
| 7 | Cross-game review & prefabs proposal | Pending |

---

## Table of Contents

1. [Strategy](#1-strategy)
2. [Kenney Asset Review](#2-kenney-asset-review)
3. [Phase 1: Asset Preparation](#3-phase-1-asset-preparation)
4. [Phase 1.5: XML Texture Atlas Support](#4-phase-15-xml-texture-atlas-support)
5. [Phase 2: Breakout](#5-phase-2-breakout)
6. [Phase 3: Object Pooling](#6-phase-3-object-pooling)
7. [Phase 4: Space Shooter](#7-phase-4-space-shooter)
8. [Phase 5: Tower Defense](#8-phase-5-tower-defense)
9. [Phase 6: Puzzle (Sokoban)](#9-phase-6-puzzle-sokoban)
10. [Phase 7: Cross-Game Review & Prefabs Proposal](#10-phase-7-cross-game-review--prefabs-proposal)
11. [Shared Patterns & Conventions](#11-shared-patterns--conventions)
12. [Test Infrastructure](#12-test-infrastructure)
13. [Definition of Done](#13-definition-of-done)

---

## 1. Strategy

### 1.1 Approach: One Game at a Time

Each game is built as a self-contained phase. Games are built sequentially so each one can benefit from patterns discovered in the previous one. The order progresses from simplest physics to most complex game logic, with a pooling infrastructure pause before the high-throughput Space Shooter:

1. **Asset Preparation** — Download all Kenney asset packs, create tile description CSVs for human review before implementation begins.
2. **XML Texture Atlas Support** — Add `TextureAtlas` to `@quintus/sprites` so games can load sprite frames by name from XML atlas files instead of hardcoding source rects or frame indices. All downloaded Kenney packs already include XML atlases.
3. **Breakout** — Simple bouncing physics, no tilemaps, no AI enemies. Tests the core loop + collision response in a clean environment.
4. **Object Pooling** — Implement the pooling system from `steering/POOLING_PLAN.md`. This gives us `NodePool<T>` and physics pipeline temp-pool optimizations before building the entity-heavy Space Shooter.
5. **Space Shooter** — Scrolling, spawning, projectiles, wave management. Tests entity lifecycle at scale using `NodePool<T>` for bullet/enemy recycling.
6. **Tower Defense** — Grid-based placement, pathfinding, targeting, economy. Tests strategic game patterns and complex UI.
7. **Puzzle (Sokoban)** — Turn-based grid movement, undo, level progression. Tests a completely different game paradigm — no physics, no real-time input, pure logic.
8. **Cross-Game Review** — After all four games exist alongside the platformer and dungeon, review all six full games to extract reusable prefab patterns into `steering/PREFABS_PROPOSAL.md`.

**Retrospective checkpoint:** After each game is complete, spend 30 minutes reviewing what patterns emerged and whether the next game's design should adjust. This avoids repeating suboptimal patterns across games.

### 1.2 Existing Games (Already Complete)

These games are already built with full tests and don't need changes:

| Game | Type | Key Systems | Tests |
|------|------|-------------|-------|
| **platformer** | Side-scrolling platformer | Physics, sprites, tilemap (TMX), camera, audio, input, tween, UI | 7 integration tests |
| **dungeon** | Top-down RPG crawler | Physics (no gravity), equipment, inventory, buffs, combat, Y-sorting | ~70 integration tests across 10 files |

### 1.3 What Each New Game Must Deliver

Every new example game ships with:

1. **Runnable demo** via `pnpm dev` (Vite dev server on `:3050`)
2. **TSX entities and scenes** using `build()` pattern from `@quintus/jsx` (matching platformer-tsx and dungeon examples)
3. **Multiple levels or waves** demonstrating progression
4. **Title screen + game over screen** (scene transitions)
5. **HUD** displaying score and game-specific state
6. **Sound effects** (at least 3 SFX per game)
7. **Integration tests** using `TestRunner` from `@quintus/test`
8. **Vitest config** (`examples/{game}/vitest.config.ts`)
9. **Asset attribution** (`examples/{game}/assets/ATTRIBUTION.md`)
10. **Debug-friendly** — `serialize()` overrides on custom entities for `qdbg` introspection

### 1.4 TSX Build Pattern

All new example games use the JSX `build()` pattern from `@quintus/jsx`, matching the conventions established in `examples/platformer-tsx/` and `examples/dungeon/`. Key patterns:

**Entities** — CollisionShape + AnimatedSprite in `build()`, tags and signal connections in `onReady()`:
```tsx
class Paddle extends Actor {
  sprite?: AnimatedSprite;

  override build() {
    return <>
      <CollisionShape shape={Shape.rect(32, 8)} />
      <Sprite ref="sprite" texture="tileset" sourceRect={PADDLE_RECT} centered={false} />
    </>;
  }

  override onReady() {
    super.onReady();
    this.tag("paddle");
  }
}
```

**UI Scenes** — Pure `build()`, no `onReady()` needed:
```tsx
class TitleScene extends Scene {
  override build() {
    return (
      <Layer fixed>
        <Panel width={480} height={640} backgroundColor="#1a1a2e" />
        <Label position={[240, 100]} text="BREAKOUT" fontSize={24} color="#4fc3f7" align="center" />
        <Button position={[190, 300]} width={100} height={32} text="Start" fontSize={16}
                backgroundColor="#4fc3f7" textColor="#ffffff"
                onPressed={() => { resetState(); this.switchTo("level1"); }} />
      </Layer>
    );
  }
}
```

**Level Scenes** — Hybrid `build()` + `onReady()`, dollar refs for cross-node dependencies:
```tsx
abstract class BreakoutLevel extends Scene {
  abstract readonly nextScene: string;
  protected paddle?: Paddle;
  protected camera?: Camera;

  override build() {
    return <>
      <Paddle ref="paddle" />
      <Camera ref="camera" />
      <HUD />
    </>;
  }

  override onReady() {
    // Imperative setup: walls, brick grid, physics contacts
  }
}
```

**HUD** — `build()` for layout, `onReady()` for signal-driven updates:
```tsx
class HUD extends Layer {
  override zIndex = 100;
  scoreLabel?: Label;

  override build() {
    this.fixed = true;
    return <>
      <Label ref="scoreLabel" position={[10, 4]} text="Score: 0" fontSize={8} color="#ffffff" />
    </>;
  }

  override onReady() {
    gameState.on("score").connect(({ value }) => {
      this.scoreLabel!.text = `Score: ${value}`;
    });
  }
}
```

---

## 2. Kenney Asset Review

All assets are from [kenney.nl](https://kenney.nl/assets) — CC0 (public domain), free, no attribution required (but we credit anyway).

### 2.1 Selected Asset Packs

| Game | Primary Pack | URL | Assets | Supplement |
|------|-------------|-----|--------|------------|
| **Breakout** | Puzzle Pack 2 | [kenney.nl/assets/puzzle-pack-2](https://kenney.nl/assets/puzzle-pack-2) | 795 | Particle Pack for break effects |
| **Space Shooter** | Space Shooter Redux | [kenney.nl/assets/space-shooter-redux](https://kenney.nl/assets/space-shooter-redux) | 295 | Space Shooter Extension (270) for variety |
| **Tower Defense** | Tower Defense (Top-Down) | [kenney.nl/assets/tower-defense-top-down](https://kenney.nl/assets/tower-defense-top-down) | 300 | UI Pack for tower selection panel |
| **Puzzle (Sokoban)** | Sokoban | [kenney.nl/assets/sokoban](https://kenney.nl/assets/sokoban) | 100 | Standalone — complete set |

All Kenney packs come with **pre-made sprite sheets** (PNG) and individual sprites. We use the provided sheets directly — no manual sprite sheet assembly required.

### 2.2 Additional Kenney Packs Worth Noting

For future games or prefab demos:

| Pack | Assets | Good For |
|------|--------|----------|
| [Pixel Shmup](https://kenney.nl/assets/pixel-shmup) | 128 | Retro pixel space shooter variant |
| [Tiny Battle](https://kenney.nl/assets/tiny-battle) | 190 | Tower defense enemy units |
| [Roguelike/RPG Pack](https://kenney.nl/assets/roguelike-rpg-pack) | 1700 | Extended RPG content |
| [UI Pack](https://kenney.nl/assets/ui-pack) | 430 | General UI elements |
| [Pixel UI Pack](https://kenney.nl/assets/pixel-ui-pack) | 750 | Pixel-art UI |
| [Particle Pack](https://kenney.nl/assets/particle-pack) | 80 | Explosion/smoke effects |
| [1-Bit Pack](https://kenney.nl/assets/1-bit-pack) | 1078 | Massive versatile pixel set |

---

## 3. Phase 1: Asset Preparation

### 3.1 Purpose

Download all Kenney asset packs, place the pre-made sprite sheets in each game's `assets/` directory, and create a **tile description CSV** for each game that maps sprite frame indices to game roles. The CSV is reviewed and corrected by a human before implementation begins — this avoids misidentified tiles causing bugs during game development.

### 3.2 Process

For each game:

1. **Download** the Kenney asset pack ZIP from the URL in §2.1
2. **Extract** the pre-made sprite sheet PNG (each pack includes one or more consolidated sheets)
3. **Place** the sheet as `examples/{game}/assets/tileset.png`
4. **Create** a `tile_description.csv` in `examples/{game}/` with columns:
   - `frame` — sprite frame index (0-based, left-to-right, top-to-bottom)
   - `name` — descriptive name (e.g., `paddle_blue`, `brick_red`, `ball`)
   - `role` — game role (e.g., `paddle`, `brick_normal`, `brick_hard`, `ball`, `powerup_wide`, `background`)
   - `notes` — any observations about the tile (e.g., "may be too large", "alternate color")
5. **Create** `examples/{game}/assets/ATTRIBUTION.md` crediting Kenney
6. **Create** audio placeholder list (sound effects to source or generate later)

### 3.3 CSV Format

Following the pattern from `examples/dungeon/tile_description.csv`:

```csv
frame,name,role,notes
0,paddle_blue,paddle,Main paddle sprite
1,paddle_blue_wide,paddle_wide,Wide paddle for power-up
2,ball_blue,ball,Standard ball
3,brick_red,brick_normal,1-hit brick
4,brick_green,brick_hard,2-hit brick
5,brick_grey,brick_metal,3-hit brick
...
```

### 3.4 Per-Game Asset Specifics

**Breakout** (from Puzzle Pack 2):
- Paddle sprites (normal + wide variants)
- Ball sprite
- Brick sprites (3+ color/type variations for health levels)
- Power-up icons (wide paddle, multi-ball, speed)
- Background pattern tile

**Space Shooter** (from Space Shooter Redux):
- Player ship sprite (1 design)
- Enemy ship sprites (3+ designs for basic, weaver, bomber)
- Boss sprite (large ship)
- Bullet sprites (player + enemy, different colors)
- Power-up icons (shield, rapid fire, spread shot)
- Explosion animation frames (if available as sheet strip)
- Star/space background tiles
- Meteor sprites (environmental hazard)

**Tower Defense** (from Tower Defense Top-Down):
- Terrain tiles (grass, path, water/border)
- Tower base sprites (3 types)
- Tower turret sprites (3 types, rotatable)
- Enemy sprites (3 types — basic, fast, tank)
- Projectile sprites (arrow, cannonball)
- UI elements (gold icon, selection indicator)

**Sokoban** (from Sokoban pack):
- Floor tile sprites (multiple patterns)
- Wall tile sprites
- Crate sprite (normal + on-target variant)
- Player sprite (4 directional or single)
- Target marker sprite
- Background/border elements

### 3.5 Sound Effects

Sound effects will be sourced separately (CC0 from freesound.org or generated). For each game, create a list of needed `.ogg` files:

| Game | SFX Files |
|------|-----------|
| **Breakout** | `bounce.ogg`, `brick-break.ogg`, `powerup.ogg`, `lose-life.ogg`, `level-clear.ogg` |
| **Space Shooter** | `shoot.ogg`, `explosion.ogg`, `player-hit.ogg`, `powerup.ogg`, `boss-warning.ogg`, `shield.ogg` |
| **Tower Defense** | `build.ogg`, `arrow.ogg`, `cannon.ogg`, `enemy-die.ogg`, `wave-start.ogg`, `life-lost.ogg` |
| **Sokoban** | `move.ogg`, `push.ogg`, `solved.ogg`, `undo.ogg`, `level-complete.ogg`, `cant-move.ogg` |

### 3.6 Deliverables

- [x] Download Kenney Puzzle Pack 2 → `examples/breakout/assets/` (multiple category sheets: paddles, balls, tiles by color, coins, particles, backtiles)
- [x] Download Kenney Space Shooter Redux → `examples/space-shooter/assets/tileset.png` + `tileset.xml`
- [x] Download Kenney Tower Defense (Top-Down) → `examples/tower-defense/assets/tileset.png`
- [x] Download Kenney Sokoban → `examples/sokoban/assets/tileset.png` + `spritesheet.png`/`spritesheet.xml`
- [x] Create `examples/breakout/tile_description.csv` with frame→role mapping
- [x] Create `examples/space-shooter/tile_description.csv` with frame→role mapping
- [x] Create `examples/tower-defense/tile_description.csv` with frame→role mapping
- [x] Create `examples/sokoban/tile_description.csv` with frame→role mapping
- [x] Create `ATTRIBUTION.md` for each game's `assets/` directory
- [x] **Human review:** Verify all CSVs have correct tile identifications before proceeding to Phase 2

---

## 4. Phase 1.5: XML Texture Atlas Support

### 4.1 Motivation

All Kenney asset packs ship with **Texture Atlas XML** files that map sprite names to source rectangles. Currently, the `SpriteSheet` class only supports uniform grid-based layouts (fixed `frameWidth` × `frameHeight`), which forces games to either:

1. Hardcode `sourceRect` values on every `Sprite` — verbose, error-prone, breaks if the atlas changes
2. Use frame indices into a grid that doesn't match the actual atlas layout

The Kenney atlases have **variable-sized frames** (e.g., breakout paddles range from 500×120 to 640×141). A grid-based SpriteSheet can't represent these. Adding a `TextureAtlas` class that parses the XML and provides name-based frame lookup makes the example games much cleaner to write and more maintainable.

### 4.2 Existing XML Files

Every game's assets already include XML atlas files:

| Game | XML Files | Image |
|------|-----------|-------|
| **Breakout** | `paddles.xml`, `balls.xml`, `tiles_blue.xml`, `tiles_green.xml`, `tiles_grey.xml`, `tiles_red.xml`, `tiles_yellow.xml`, `coins.xml`, `particles.xml`, `backtiles.xml` | `sprites.png` per category |
| **Space Shooter** | `tileset.xml` | `sheet.png` |
| **Sokoban** | `spritesheet.xml` | `sokoban_spritesheet.png` |
| **Tower Defense** | (single sheet, no XML — uses grid) | `tileset.png` |

### 4.3 XML Format

All files use the industry-standard **Texture Atlas XML** format (TexturePacker, Kenney, Aseprite):

```xml
<TextureAtlas imagePath="sprites.png">
  <SubTexture name="paddle_01.png" x="0" y="794" width="520" height="140"/>
  <SubTexture name="paddle_02.png" x="0" y="0" width="640" height="140"/>
  <SubTexture name="ball_blue.png" x="0" y="0" width="66" height="66"/>
  ...
</TextureAtlas>
```

Each `<SubTexture>` defines:
- `name` — sprite identifier (typically `category_nn.png`)
- `x`, `y` — pixel offset in the atlas image
- `width`, `height` — frame dimensions (variable per frame)

### 4.4 Design: `TextureAtlas` Class

Add a new `TextureAtlas` class to `@quintus/sprites`. This is **not** a replacement for `SpriteSheet` — it's a complementary class for atlas-based (name-lookup) sprite access, while `SpriteSheet` remains for grid-based (index-lookup) access.

**New file:** `packages/sprites/src/texture-atlas.ts`

```typescript
import { Rect } from "@quintus/math";

export interface TextureAtlasFrame {
  /** Frame name from the XML (e.g., "paddle_01.png"). */
  readonly name: string;
  /** Source rectangle in the atlas image. */
  readonly rect: Rect;
}

export class TextureAtlas {
  /** Texture asset name (the atlas image, e.g., "sprites"). */
  readonly texture: string;

  /** All frames, indexed by name. */
  private readonly _frames: Map<string, Rect>;

  constructor(texture: string, frames: Map<string, Rect>) {
    this.texture = texture;
    this._frames = frames;
  }

  /** Get the source rectangle for a named frame. Returns undefined if not found. */
  getFrame(name: string): Rect | undefined {
    return this._frames.get(name);
  }

  /** Get the source rectangle for a named frame. Throws if not found. */
  getFrameOrThrow(name: string): Rect {
    const rect = this._frames.get(name);
    if (!rect) {
      throw new Error(
        `Frame "${name}" not found in atlas "${this.texture}". ` +
        `Available: ${this.frameNames.slice(0, 10).join(", ")}${this.frameCount > 10 ? "..." : ""}`
      );
    }
    return rect;
  }

  /** Check if a frame exists. */
  hasFrame(name: string): boolean {
    return this._frames.has(name);
  }

  /** Get all frame names. */
  get frameNames(): string[] {
    return [...this._frames.keys()];
  }

  /** Total number of frames. */
  get frameCount(): number {
    return this._frames.size;
  }

  /**
   * Get all frames whose names start with a given prefix.
   * Useful for grouping related sprites (e.g., "paddle_" returns all paddle variants).
   * Returns frames sorted by name.
   */
  getFramesByPrefix(prefix: string): TextureAtlasFrame[] {
    const results: TextureAtlasFrame[] = [];
    for (const [name, rect] of this._frames) {
      if (name.startsWith(prefix)) {
        results.push({ name, rect });
      }
    }
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Parse a Texture Atlas XML string.
   *
   * @param xml - The XML content (TextureAtlas format).
   * @param texture - Texture asset name to use. If omitted, uses the
   *                  `imagePath` attribute from the XML (minus extension).
   */
  static fromXml(xml: string, texture?: string): TextureAtlas {
    const doc = parseXml(xml);
    const root = doc.documentElement;

    if (root.tagName !== "TextureAtlas") {
      throw new Error(
        `Expected root <TextureAtlas> element, got <${root.tagName}>.`
      );
    }

    const imagePath = root.getAttribute("imagePath") ?? "";
    const resolvedTexture = texture ?? imagePath.replace(/\.[^.]+$/, "");

    const frames = new Map<string, Rect>();
    for (const child of root.children) {
      if (child.tagName !== "SubTexture") continue;
      const name = child.getAttribute("name");
      if (!name) continue;
      const x = Number.parseInt(child.getAttribute("x") ?? "0", 10);
      const y = Number.parseInt(child.getAttribute("y") ?? "0", 10);
      const w = Number.parseInt(child.getAttribute("width") ?? "0", 10);
      const h = Number.parseInt(child.getAttribute("height") ?? "0", 10);
      frames.set(name, new Rect(x, y, w, h));
    }

    return new TextureAtlas(resolvedTexture, frames);
  }
}
```

### 4.5 XML Parsing

The XML parsing helpers (`parseXml`, `childByTag`, etc.) already exist in `@quintus/tilemap/src/tmx-parser.ts` as private functions. For Phase 1.5, we have two options:

**Option A (chosen): Duplicate the tiny `parseXml` helper in `@quintus/sprites`.**
The helper is 6 lines. Duplicating avoids adding `@quintus/tilemap` as a dependency of `@quintus/sprites`, which would be an undesirable coupling (sprites shouldn't depend on tilemaps). The `TextureAtlas.fromXml()` parser is simple enough that it doesn't need the full `childByTag`/`reqAttr` helpers — it just iterates `root.children` directly.

**Option B (deferred): Extract shared XML utils to `@quintus/core` or a new `@quintus/xml` package.**
If more packages need XML parsing in the future, we can extract later. Not worth the package overhead now.

### 4.6 Usage in Example Games

**Before (hardcoded rects):**
```tsx
// examples/breakout/sprites.ts — manual, error-prone
const PADDLE_RECT = new Rect(0, 794, 520, 140);
const BALL_RECT = new Rect(0, 0, 66, 66);

// In entity:
<Sprite texture="paddles" sourceRect={PADDLE_RECT} />
```

**After (XML atlas lookup):**
```tsx
// examples/breakout/sprites.ts — clean, maintainable
import { TextureAtlas } from "@quintus/sprites";

// Loaded once from XML file content
export let paddleAtlas: TextureAtlas;
export let ballAtlas: TextureAtlas;

export function loadAtlases(game: Game) {
  paddleAtlas = TextureAtlas.fromXml(game.assets.getText("paddles-xml"), "paddles");
  ballAtlas = TextureAtlas.fromXml(game.assets.getText("balls-xml"), "balls");
}

// In entity — reference by name:
<Sprite texture="paddles" sourceRect={paddleAtlas.getFrameOrThrow("paddle_01.png")} />

// Or for dynamic selection:
const paddleFrame = paddleAtlas.getFrameOrThrow(
  wide ? "paddle_02.png" : "paddle_01.png"
);
```

**Space Shooter (single large atlas):**
```tsx
export let atlas: TextureAtlas;

export function loadAtlas(game: Game) {
  atlas = TextureAtlas.fromXml(game.assets.getText("tileset-xml"), "tileset");
}

// Player ship:
<Sprite texture="tileset" sourceRect={atlas.getFrameOrThrow("playerShip1_blue.png")} />

// Enemy:
<Sprite texture="tileset" sourceRect={atlas.getFrameOrThrow("enemyBlack1.png")} />
```

**Sokoban:**
```tsx
export let atlas: TextureAtlas;

// Crate:
<Sprite texture="spritesheet" sourceRect={atlas.getFrameOrThrow("crate_01.png")} />

// Player:
<Sprite texture="spritesheet" sourceRect={atlas.getFrameOrThrow("player_01.png")} />
```

### 4.7 Asset Loading

Each game's `main.ts` loads the XML files as text assets, then parses them into `TextureAtlas` instances. The pattern follows the existing TMX loading convention:

```typescript
// Register XML text loader (one-time, in main.ts)
game.assets.registerLoader("xml", async (_name, path) => {
  const resp = await fetch(path);
  return resp.text();
});

// Load assets
await game.assets.load({
  images: { paddles: "assets/sprites.png" },
  xml: { "paddles-xml": "assets/paddles.xml" },
});

// Parse atlas
const paddleAtlas = TextureAtlas.fromXml(
  game.assets.getText("paddles-xml"),
  "paddles"
);
```

For headless tests, XML files are loaded from disk via `readFile()` and stored with `game.assets._storeCustom()`, matching the existing TMX test pattern.

### 4.8 Impact on Game Code in Later Phases

With `TextureAtlas` available, the Breakout, Space Shooter, and Sokoban designs (Phases 2, 4, 6) should use atlas-based sprite lookup instead of hardcoded rects. The design document's `sprites.ts` pattern (§11.4) gains a new variant:

```typescript
// examples/{game}/sprites.ts — Atlas-based pattern (new)
import { TextureAtlas } from "@quintus/sprites";

export let atlas: TextureAtlas;

export function loadAtlas(game: Game) {
  atlas = TextureAtlas.fromXml(game.assets.getText("atlas-xml"), "tileset");
}
```

Tower Defense (Phase 5) can still use the grid-based `SpriteSheet` since its tileset is a uniform grid without an XML atlas.

### 4.9 Tests

**`packages/sprites/src/texture-atlas.test.ts`:**

```typescript
describe("TextureAtlas", () => {
  test("parses XML with SubTexture entries", () => {
    const xml = `<TextureAtlas imagePath="sprites.png">
      <SubTexture name="paddle_01.png" x="0" y="794" width="520" height="140"/>
      <SubTexture name="ball_blue.png" x="10" y="20" width="66" height="66"/>
    </TextureAtlas>`;

    const atlas = TextureAtlas.fromXml(xml);
    expect(atlas.texture).toBe("sprites");
    expect(atlas.frameCount).toBe(2);
    expect(atlas.hasFrame("paddle_01.png")).toBe(true);

    const rect = atlas.getFrameOrThrow("paddle_01.png");
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(794);
    expect(rect.width).toBe(520);
    expect(rect.height).toBe(140);
  });

  test("texture override takes precedence over imagePath", () => {
    const xml = `<TextureAtlas imagePath="sprites.png">
      <SubTexture name="a.png" x="0" y="0" width="16" height="16"/>
    </TextureAtlas>`;

    const atlas = TextureAtlas.fromXml(xml, "custom-texture");
    expect(atlas.texture).toBe("custom-texture");
  });

  test("getFrameOrThrow throws for missing frame", () => {
    const xml = `<TextureAtlas imagePath="s.png">
      <SubTexture name="a.png" x="0" y="0" width="16" height="16"/>
    </TextureAtlas>`;

    const atlas = TextureAtlas.fromXml(xml);
    expect(() => atlas.getFrameOrThrow("missing.png")).toThrow(/not found/);
  });

  test("getFrame returns undefined for missing frame", () => {
    const xml = `<TextureAtlas imagePath="s.png">
      <SubTexture name="a.png" x="0" y="0" width="16" height="16"/>
    </TextureAtlas>`;

    const atlas = TextureAtlas.fromXml(xml);
    expect(atlas.getFrame("missing.png")).toBeUndefined();
  });

  test("getFramesByPrefix groups related sprites", () => {
    const xml = `<TextureAtlas imagePath="s.png">
      <SubTexture name="paddle_01.png" x="0" y="0" width="100" height="20"/>
      <SubTexture name="paddle_02.png" x="0" y="20" width="120" height="20"/>
      <SubTexture name="ball_01.png" x="0" y="40" width="16" height="16"/>
    </TextureAtlas>`;

    const atlas = TextureAtlas.fromXml(xml);
    const paddles = atlas.getFramesByPrefix("paddle_");
    expect(paddles).toHaveLength(2);
    expect(paddles[0].name).toBe("paddle_01.png");
    expect(paddles[1].name).toBe("paddle_02.png");
  });

  test("frameNames returns all frame names", () => {
    const xml = `<TextureAtlas imagePath="s.png">
      <SubTexture name="a.png" x="0" y="0" width="16" height="16"/>
      <SubTexture name="b.png" x="16" y="0" width="16" height="16"/>
    </TextureAtlas>`;

    const atlas = TextureAtlas.fromXml(xml);
    expect(atlas.frameNames).toEqual(["a.png", "b.png"]);
  });

  test("throws on invalid root element", () => {
    const xml = `<SpriteSheet><frame/></SpriteSheet>`;
    expect(() => TextureAtlas.fromXml(xml)).toThrow(/TextureAtlas/);
  });

  test("parses real Kenney breakout paddles.xml", async () => {
    // Integration test using actual asset file
    const xml = await readFile("examples/breakout/assets/paddles.xml", "utf-8");
    const atlas = TextureAtlas.fromXml(xml, "paddles");
    expect(atlas.frameCount).toBe(12);
    expect(atlas.hasFrame("paddle_01.png")).toBe(true);
  });
});
```

### 4.10 File Changes

| File | Change |
|------|--------|
| `packages/sprites/src/texture-atlas.ts` | **New** — `TextureAtlas` class + `fromXml()` parser |
| `packages/sprites/src/texture-atlas.test.ts` | **New** — Unit tests |
| `packages/sprites/src/index.ts` | **Edit** — Export `TextureAtlas` and `TextureAtlasFrame` |

### 4.11 Deliverables

- [x] Implement `TextureAtlas` class in `@quintus/sprites`
- [x] Implement `TextureAtlas.fromXml()` parser
- [x] Implement `getFrame()`, `getFrameOrThrow()`, `getFramesByPrefix()`, `hasFrame()`, `frameNames`
- [x] Write unit tests (XML parsing, frame lookup, prefix grouping, error cases)
- [x] Write integration test with real Kenney XML file
- [x] Export from `@quintus/sprites` index
- [x] `pnpm build` succeeds
- [x] `pnpm test` passes (all packages)
- [x] `pnpm lint` clean

---

## 5. Phase 2: Breakout

### 5.1 Game Design

Classic brick-breaker: paddle at bottom, ball bounces off walls/paddle/bricks, destroy all bricks to advance. Simple enough to be a "hello world" for the physics system, complex enough to exercise collision response, scoring, and level progression.

**Gameplay:**
- Paddle moves left/right with keyboard (A/D or arrows) or mouse
- Ball launches on Space/click
- Bricks take 1-3 hits depending on type
- Power-ups drop from destroyed bricks (multi-ball, wide paddle, speed)
- 3 lives per game
- 3 levels with increasing difficulty

### 5.2 Scene Tree

```
Scene (BreakoutLevel)
├── Walls (Node)
│   ├── TopWall (StaticCollider)
│   ├── LeftWall (StaticCollider)
│   └── RightWall (StaticCollider)
├── DeathZone (Sensor)            — bottom of screen
├── Paddle (Actor)
│   └── CollisionShape (rect)
├── Ball (Actor)
│   └── CollisionShape (circle)
├── BrickGrid (Node)
│   ├── Brick (StaticCollider)    — repeated, grid layout
│   │   └── CollisionShape (rect)
│   └── ...
├── PowerUp (Actor)               — spawned on brick destroy
│   └── CollisionShape (rect)
├── Camera (Camera)
└── HUD (Layer, fixed)
    ├── ScoreLabel (Label)
    ├── LivesDisplay (Node2D)     — heart icons
    └── LevelLabel (Label)
```

### 5.3 Key Entities

**Paddle** (`examples/breakout/entities/paddle.tsx`)
```tsx
class Paddle extends Actor {
  speed = 400;
  width = 64;  // default, changes with power-up
  sprite?: Sprite;

  override build() {
    return <>
      <CollisionShape shape={Shape.rect(this.width / 2, 8)} />
      <Sprite ref="sprite" texture="tileset" sourceRect={PADDLE_RECT} centered={false} />
    </>;
  }

  override onReady() {
    super.onReady();
    this.tag("paddle");
  }

  override serialize() {
    return { ...super.serialize(), width: this.width };
  }

  onFixedUpdate(dt: number) {
    this.velocity.x = 0;
    if (this.game.input.isPressed("left")) this.velocity.x = -this.speed;
    if (this.game.input.isPressed("right")) this.velocity.x = this.speed;
    this.move(dt);
    // Clamp to screen bounds
  }
}
```

**Ball** (`examples/breakout/entities/ball.tsx`)

The ball uses `moveAndCollide()` instead of `move()` because the default `move()` slides along surfaces and kills velocity into collision normals. A bouncing ball needs to **reflect** its velocity across the collision normal.

```tsx
class Ball extends Actor {
  speed = 300;
  attached = true;  // Stuck to paddle until launch
  sprite?: Sprite;

  override build() {
    return <>
      <CollisionShape shape={Shape.circle(4)} />
      <Sprite ref="sprite" texture="tileset" sourceRect={BALL_RECT} />
    </>;
  }

  override onReady() {
    super.onReady();
    this.tag("ball");
  }

  override serialize() {
    return { ...super.serialize(), speed: this.speed, attached: this.attached };
  }

  onFixedUpdate(dt: number) {
    if (this.attached) {
      // Follow paddle position
      return;
    }
    // Use moveAndCollide for reflection (NOT move() which slides)
    const motion = this.velocity.clone().scale(dt);
    const info = this.moveAndCollide(motion);
    if (info) {
      // Reflect velocity across collision normal
      const dot = this.velocity.dot(info.normal);
      this.velocity.x -= 2 * dot * info.normal.x;
      this.velocity.y -= 2 * dot * info.normal.y;
    }
  }

  launch() {
    this.attached = false;
    this.velocity = new Vec2(this.speed * 0.7, -this.speed);
  }
}
```

For paddle collisions, the reflection angle is modified based on the horizontal offset from paddle center — hitting the paddle edge sends the ball at a steeper angle, hitting the center sends it more vertically. This is handled in the `onContact` callback registered in the level scene.

**Brick** (`examples/breakout/entities/brick.tsx`)
```tsx
class Brick extends StaticCollider {
  health = 1;       // 1, 2, or 3
  points = 10;      // Score value
  powerUpChance = 0.1;
  sprite?: Sprite;

  override build() {
    return <>
      <CollisionShape shape={Shape.rect(16, 8)} />
      <Sprite ref="sprite" texture="tileset" sourceRect={this.getBrickRect()} />
    </>;
  }

  override onReady() {
    super.onReady();
    this.tag("brick");
  }

  override serialize() {
    return { ...super.serialize(), health: this.health, points: this.points };
  }
}
```

Brick types by health:
- **Normal** (1 hit) — colored bricks, 10 points
- **Hard** (2 hits) — darker color, 20 points
- **Metal** (3 hits) — metallic look, 30 points

**PowerUp** (`examples/breakout/entities/power-up.tsx`)
- Falls down when brick destroyed (sensor, gravity-driven)
- Types: `wide-paddle` (1.5x width for 10s), `multi-ball` (split into 3), `speed-up` (ball +20%)

### 5.4 Physics Setup

```typescript
// examples/breakout/main.ts
const game = new Game({
  width: 480,
  height: 640,
  canvas: "game",
  pixelArt: true,
  backgroundColor: "#1a1a2e",
  seed: 42,
});

game.use(PhysicsPlugin({
  gravity: new Vec2(0, 0),  // No gravity for ball (custom for power-ups)
  collisionGroups: COLLISION_GROUPS,
}));
game.use(InputPlugin({ actions: INPUT_BINDINGS }));
game.use(TweenPlugin());
game.use(AudioPlugin());
```

```typescript
// examples/breakout/config.ts
export const COLLISION_GROUPS = {
  paddle:  { collidesWith: ["walls", "ball", "powerup"] },
  ball:    { collidesWith: ["walls", "paddle", "bricks"] },
  bricks:  { collidesWith: ["ball"] },
  walls:   { collidesWith: ["paddle", "ball"] },
  powerup: { collidesWith: ["paddle"] },
};

export const INPUT_BINDINGS = {
  left:   ["ArrowLeft", "KeyA"],
  right:  ["ArrowRight", "KeyD"],
  launch: ["Space", "ArrowUp"],
};
```

### 5.5 Scenes

| Scene | Purpose |
|-------|---------|
| `TitleScene` | "BREAKOUT" title, "Press Space to Start", high score display |
| `BreakoutLevel` | Base level class — wall setup, brick grid generation, game logic |
| `Level1` | 5 rows of normal bricks |
| `Level2` | 5 rows mixed normal + hard bricks |
| `Level3` | 5 rows mixed normal + hard + metal bricks |
| `GameOverScene` | Final score, "Play Again" button |
| `VictoryScene` | "You Win!" after clearing all 3 levels |

### 5.6 File Structure

```
examples/breakout/
├── main.ts
├── config.ts                  — collision groups, input bindings
├── state.ts                   — score, lives, level
├── sprites.ts                 — SpriteSheet definition + frame rects
├── tile_description.csv       — tile identification (from Phase 1)
├── index.html
├── entities/
│   ├── paddle.tsx
│   ├── ball.tsx
│   ├── brick.tsx
│   ├── power-up.tsx
│   └── walls.tsx              — wall + death zone setup
├── scenes/
│   ├── breakout-level.tsx     — base level class
│   ├── level1.tsx
│   ├── level2.tsx
│   ├── level3.tsx
│   ├── title-scene.tsx
│   ├── game-over-scene.tsx
│   └── victory-scene.tsx
├── hud/
│   └── hud.tsx                — score, lives, level display
├── __tests__/
│   ├── helpers.ts
│   ├── paddle.test.ts
│   ├── ball.test.ts
│   ├── bricks.test.ts
│   ├── powerups.test.ts
│   └── flow.test.ts
├── assets/
│   ├── tileset.png
│   ├── bounce.ogg
│   ├── brick-break.ogg
│   ├── powerup.ogg
│   ├── lose-life.ogg
│   ├── level-clear.ogg
│   └── ATTRIBUTION.md
├── vitest.config.ts
└── tsconfig.json
```

### 5.7 Engine Features Exercised

| Feature | How It's Used |
|---------|---------------|
| `Actor.moveAndCollide()` | Ball movement with velocity reflection |
| `Actor.move()` | Paddle movement (clamped) |
| `StaticCollider` | Walls, bricks |
| `Sensor` | Death zone at bottom |
| `CollisionShape` | Rect (paddle, bricks, walls), circle (ball) |
| Collision groups | Ball hits bricks but not power-ups; paddle catches power-ups |
| `game.physics.onContact()` | Ball reflection angle, brick damage, power-up collection |
| `Sprite` | Paddle, ball, brick, power-up sprites |
| `game.audio.play()` | Sound effects on impact |
| `Tween` | Brick shatter animation, paddle width transition |
| `UI` (Label, Layer) | Score, lives, level display |
| Signals | `brickDestroyed`, `liveLost`, `levelCleared` |
| Scene transitions | Title → Level1 → Level2 → Level3 → Victory / GameOver |
| JSX `build()` | All entity structure + UI scenes |

### 5.8 Tests

**`__tests__/paddle.test.ts`:**
- Paddle moves left/right with input
- Paddle clamps to screen bounds
- Paddle width changes with wide-paddle power-up

**`__tests__/ball.test.ts`:**
- Ball launches on space press
- Ball reflects off walls (velocity.y flips on top wall, velocity.x flips on side walls)
- Ball reflects off paddle with angle variation
- Ball attached to paddle before launch

**`__tests__/bricks.test.ts`:**
- Brick destroyed after correct number of hits
- Brick count decreases as ball hits bricks
- Power-up spawns on brick destroy (with seeded RNG)
- All bricks destroyed triggers level complete

**`__tests__/powerups.test.ts`:**
- Wide paddle power-up increases paddle width
- Multi-ball splits into 3 balls
- Power-up falls and is caught by paddle

**`__tests__/flow.test.ts`:**
- Title scene transitions to Level1 on input
- Level complete transitions to next level
- Losing all lives transitions to GameOver
- Clearing Level3 transitions to Victory
- Deterministic: same seed + same inputs = same final score

### 5.9 Deliverables

- [x] Create `examples/breakout/` directory structure
- [x] Implement Paddle entity (TSX build, left/right movement, screen clamping)
- [x] Implement Ball entity (TSX build, `moveAndCollide()`, reflection, paddle-angle mechanics)
- [x] Implement Brick entity (TSX build, health, points, destroy behavior)
- [x] Implement PowerUp entity (wide paddle, multi-ball, speed)
- [x] Implement wall and death zone setup
- [x] Implement 3 levels with brick grid generation
- [x] Implement title, game over, and victory scenes (pure TSX `build()`)
- [x] Implement HUD (score, lives, level)
- [ ] Add sound effects and audio integration
- [x] Write integration tests (paddle, ball, bricks, power-ups, flow)
- [x] Add vitest config and tsconfig (with JSX settings)
- [ ] Verify `pnpm dev` serves the game and it's playable
- [x] Verify `pnpm test examples/breakout` passes
- [ ] Verify `qdbg connect breakout` works for debugging

---

## 6. Phase 3: Object Pooling

### 6.1 Purpose

Before building the Space Shooter (which spawns/destroys 100+ projectiles per second), implement the object pooling system designed in `steering/POOLING_PLAN.md`. This gives us:

1. **Physics pipeline temporary pools** — Eliminate per-frame Vec2/AABB/Matrix2D garbage in hot paths (`castMotion`, `testOverlap`, `findTOI`, `Actor.move()`)
2. **`NodePool<T>`** — A public API for reusing Actor/Sensor/Node2D instances across spawn/destroy cycles

### 6.2 Scope

Implement all three phases from `steering/POOLING_PLAN.md`:

- **Phase 1:** Inline scalars in `Actor.move()` and `castMotion()`, add scalar `queryRect()` to `SpatialHash`, reuse Sets in `stepMonitoring()`, reduce SAT allocations, pool `Matrix2D` in `findTOI()`
- **Phase 2:** `Poolable` interface, `NodePool<T>` class, `_poolReset()` chain (Node → Node2D → CollisionObject → Actor → Sensor), lifecycle integration
- **Phase 3:** Bullet-hell stress-test example, benchmark scripts

See `steering/POOLING_PLAN.md` for full implementation details, API sketches, and test specifications.

### 6.3 Deliverables

- [x] Implement physics pipeline temporary pool optimizations (POOLING_PLAN Phase 1)
- [x] Implement `NodePool<T>` with `Poolable` interface (POOLING_PLAN Phase 2)
- [x] Implement `_poolReset()` chain across Node hierarchy
- [x] All existing physics tests pass (zero regressions)
- [x] Pool unit tests pass (acquire, release, reset, lifecycle)
- [x] Pool determinism tests pass
- [x] `pnpm build` and `pnpm lint` clean

---

## 7. Phase 4: Space Shooter

### 7.1 Game Design

Vertical-scrolling space shooter (shmup). Player ship at bottom, enemies scroll down from top, shoot to destroy. Tests entity lifecycle at high volume — bullets and enemies are constantly created and destroyed. Uses `NodePool<T>` from Phase 3 for all projectile lifecycle.

**Gameplay:**
- Player ship moves freely in lower half of screen
- Shoots projectiles upward (auto-fire or button)
- Enemies spawn in waves from the top, moving downward
- Enemy types: basic (straight), weaver (sine wave), bomber (drops bombs)
- Boss every 3 waves
- Power-ups: rapid fire, shield, spread shot
- Scrolling star background (parallax)

### 7.2 Scene Tree

```
Scene (ShooterLevel)
├── Background (Node)
│   ├── StarLayer1 (Node2D)      — slow parallax
│   └── StarLayer2 (Node2D)      — fast parallax
├── Player (Actor)
│   ├── CollisionShape (rect)
│   └── ShieldEffect (Node2D)    — when shield active
├── BulletManager (Node)
│   ├── PlayerBullet (Actor)     — pooled via NodePool
│   └── ...
├── EnemyManager (Node)
│   ├── BasicEnemy (Actor)
│   ├── WeaverEnemy (Actor)
│   ├── BomberEnemy (Actor)
│   └── Boss (Actor)
├── EnemyBulletManager (Node)
│   ├── EnemyBullet (Actor)      — pooled via NodePool
│   └── ...
├── PowerUpManager (Node)
│   ├── PowerUp (Sensor)
│   └── ...
├── ExplosionManager (Node)
│   └── Explosion (Node2D)       — pooled via NodePool
├── Camera (Camera)
└── HUD (Layer, fixed)
    ├── ScoreLabel (Label)
    ├── LivesDisplay (Node2D)
    ├── WaveLabel (Label)
    └── PowerUpIndicator (Node2D)
```

### 7.3 Key Entities

**Player** (`examples/space-shooter/entities/player.tsx`)
```tsx
class Player extends Actor {
  speed = 250;
  fireRate = 0.2;      // seconds between shots
  fireTimer = 0;
  health = 3;
  shieldActive = false;
  spreadShot = false;
  sprite?: Sprite;

  override build() {
    return <>
      <CollisionShape shape={Shape.rect(12, 16)} />
      <Sprite ref="sprite" texture="tileset" sourceRect={PLAYER_RECT} />
    </>;
  }

  override onReady() {
    super.onReady();
    this.tag("player");
  }

  override serialize() {
    return {
      ...super.serialize(),
      health: this.health,
      shieldActive: this.shieldActive,
      spreadShot: this.spreadShot,
    };
  }

  onFixedUpdate(dt: number) {
    // 4-directional movement (clamped to screen)
    this.velocity._set(0, 0);
    if (this.game.input.isPressed("left"))  this.velocity.x = -this.speed;
    if (this.game.input.isPressed("right")) this.velocity.x = this.speed;
    if (this.game.input.isPressed("up"))    this.velocity.y = -this.speed;
    if (this.game.input.isPressed("down"))  this.velocity.y = this.speed;
    this.move(dt);

    // Auto-fire
    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && this.game.input.isPressed("fire")) {
      this.shoot();
      this.fireTimer = this.fireRate;
    }
  }
}
```

**Bullet Pooling Pattern** (`examples/space-shooter/entities/player-bullet.tsx`)

```tsx
class PlayerBullet extends Actor implements Poolable {
  speed = 500;
  damage = 10;
  sprite?: Sprite;

  override build() {
    return <>
      <CollisionShape shape={Shape.rect(2, 6)} />
      <Sprite ref="sprite" texture="tileset" sourceRect={BULLET_RECT} />
    </>;
  }

  override onReady() {
    super.onReady();
    this.collisionGroup = "pBullets";
  }

  reset(): void {
    this.speed = 500;
    this.damage = 10;
  }

  onFixedUpdate(dt: number) {
    this.velocity._set(0, -this.speed);
    this.move(dt);
    // Release to pool when off-screen
    if (this.position.y < -20) {
      bulletPool.release(this);
    }
  }
}

// Module-level pool
export const bulletPool = new NodePool(PlayerBullet, { prefill: 50, maxSize: 200 });
```

**WaveManager** (`examples/space-shooter/entities/wave-manager.ts`)
```typescript
class WaveManager extends Node {
  wave = 0;
  spawnTimer = 0;
  enemiesRemaining = 0;
  readonly waveCleared = signal<number>();

  // Defines wave composition
  static WAVES = [
    { basic: 5, weaver: 0, bomber: 0 },
    { basic: 3, weaver: 3, bomber: 0 },
    { basic: 2, weaver: 2, bomber: 2 },
    // ... boss waves etc.
  ];
}
```

### 7.4 Physics Setup

```typescript
// examples/space-shooter/config.ts
export const COLLISION_GROUPS = {
  player:   { collidesWith: ["enemies", "eBullets", "powerups"] },
  pBullets: { collidesWith: ["enemies"] },
  enemies:  { collidesWith: ["player", "pBullets"] },
  eBullets: { collidesWith: ["player"] },
  powerups: { collidesWith: ["player"] },
};
```

```typescript
// examples/space-shooter/main.ts
game.use(PhysicsPlugin({
  gravity: new Vec2(0, 0),  // Space — no gravity
  collisionGroups: COLLISION_GROUPS,
}));
```

### 7.5 Enemy Types

| Enemy | Movement | Health | Points | Shoots? |
|-------|----------|--------|--------|---------|
| **BasicEnemy** | Straight down at constant speed | 1 | 10 | No |
| **WeaverEnemy** | Sine wave horizontal + downward drift | 1 | 20 | No |
| **BomberEnemy** | Straight down, drops bombs periodically | 2 | 30 | Yes (downward) |
| **Boss** | Horizontal patrol at top, fires patterns | 20+ | 500 | Yes (spread) |

### 7.6 Scenes

| Scene | Purpose |
|-------|---------|
| `TitleScene` | "SPACE SHOOTER" title, "Press Fire to Start", high score |
| `ShooterLevel` | Main gameplay — wave spawning, score tracking |
| `GameOverScene` | Final score, "Play Again" button |

The game is endless-style (single scene, escalating waves) rather than discrete levels. Boss every 3 waves provides milestones.

### 7.7 File Structure

```
examples/space-shooter/
├── main.ts
├── config.ts
├── state.ts                    — score, lives, wave, power-up timers
├── sprites.ts
├── tile_description.csv        — tile identification (from Phase 1)
├── index.html
├── entities/
│   ├── player.tsx
│   ├── player-bullet.tsx       — implements Poolable
│   ├── basic-enemy.tsx
│   ├── weaver-enemy.tsx
│   ├── bomber-enemy.tsx
│   ├── enemy-bullet.tsx        — implements Poolable
│   ├── boss.tsx
│   ├── power-up.tsx
│   ├── explosion.tsx           — implements Poolable
│   └── wave-manager.ts
├── scenes/
│   ├── shooter-level.tsx
│   ├── title-scene.tsx
│   └── game-over-scene.tsx
├── hud/
│   └── hud.tsx
├── __tests__/
│   ├── helpers.ts
│   ├── player.test.ts
│   ├── enemies.test.ts
│   ├── bullets.test.ts
│   ├── waves.test.ts
│   ├── powerups.test.ts
│   └── flow.test.ts
├── assets/
│   ├── tileset.png
│   ├── shoot.ogg
│   ├── explosion.ogg
│   ├── player-hit.ogg
│   ├── powerup.ogg
│   ├── boss-warning.ogg
│   ├── shield.ogg
│   └── ATTRIBUTION.md
├── vitest.config.ts
└── tsconfig.json
```

### 7.8 Engine Features Exercised

| Feature | How It's Used |
|---------|---------------|
| `Actor` (zero gravity) | Player, enemies, bullets — all free-moving |
| `Sensor` | Power-ups (overlap only, no physics response) |
| `NodePool<T>` + `Poolable` | Bullets, explosions recycle instead of create/destroy |
| `game.physics.onContact()` | Bullet-enemy, bullet-player, power-up collection |
| `Sprite` / `AnimatedSprite` | Ship sprites, explosion animations |
| `game.audio.play()` | Shoot, explode, power-up SFX |
| `Tween` | Explosion fade, score pop, shield pulse |
| `UI` (Label, Layer) | Score, lives, wave counter, power-up timer |
| Signals | `enemyDestroyed`, `waveCleared`, `playerHit` |
| Scene transitions | Title → ShooterLevel → GameOver |
| Entity lifecycle at scale | Hundreds of entities pooled per wave |
| JSX `build()` | All entity structure + UI scenes |

### 7.9 Tests

**`__tests__/player.test.ts`:**
- Player moves in 4 directions
- Player clamps to screen bounds
- Player fires bullets on input
- Player takes damage from enemy bullets
- Shield blocks damage

**`__tests__/enemies.test.ts`:**
- BasicEnemy moves straight down
- WeaverEnemy follows sine wave path
- BomberEnemy drops bombs periodically
- Enemies destroyed when health reaches 0
- Enemies removed when off-screen (below bottom)

**`__tests__/bullets.test.ts`:**
- Player bullets move upward
- Enemy bullets move downward
- Bullets destroyed on collision with target
- Bullets released to pool when leaving screen bounds
- Pool reuses bullet instances (acquire count stable)

**`__tests__/waves.test.ts`:**
- Wave 1 spawns correct enemy types and counts
- Wave cleared signal fires when all enemies destroyed
- Next wave starts after wave clear
- Boss spawns every 3 waves

**`__tests__/powerups.test.ts`:**
- Shield power-up makes player invincible temporarily
- Spread shot fires 3 bullets
- Rapid fire decreases fire rate

**`__tests__/flow.test.ts`:**
- Title → game transition on input
- Player death → GameOver transition
- Deterministic replay

### 7.10 Deliverables

- [x] Create `examples/space-shooter/` directory structure
- [x] Implement Player with 4-directional movement and auto-fire (TSX build)
- [x] Implement 3 enemy types (basic, weaver, bomber) (TSX build)
- [x] Implement Boss enemy with multi-phase pattern
- [x] Implement bullet system with `NodePool<T>` pooling
- [x] Implement WaveManager with escalating difficulty
- [x] Implement power-up system (shield, rapid fire, spread shot)
- [x] Implement explosion animations (pooled)
- [x] Implement scrolling star background (parallax)
- [x] Implement title and game over scenes (pure TSX build)
- [x] Implement HUD (score, lives, wave, power-up indicator)
- [ ] Add sound effects and audio integration
- [x] Write integration tests (player, enemies, bullets, waves, power-ups, flow)
- [x] Verify game is playable via `pnpm dev`
- [x] Verify all tests pass
- [ ] Verify `qdbg connect space-shooter` works for debugging

---

## 8. Phase 5: Tower Defense

### 8.1 Game Design

Classic tower defense: enemies follow a path from entrance to exit, player places towers along the path to stop them. Tests grid-based placement, targeting AI, projectile tracking, and economy management.

**Gameplay:**
- Top-down view of a map with a winding path
- Enemies spawn in waves and follow the path
- Player places towers on grid cells adjacent to the path
- Towers auto-target and shoot nearby enemies
- Earn gold from killing enemies, spend gold on towers
- Lose lives when enemies reach the exit
- 5 waves per level, 2 levels

### 8.2 Scene Tree

```
Scene (TDLevel)
├── Map (Node)
│   ├── PathTiles (Node2D)          — visual path rendering
│   ├── PlacementGrid (Node)        — valid tower placement cells
│   └── TileMap (optional)          — terrain tiles
├── PathFollowers (Node)
│   ├── BasicCreep (Actor)          — follows path waypoints
│   ├── FastCreep (Actor)
│   ├── TankCreep (Actor)
│   └── ...
├── Towers (Node)
│   ├── ArrowTower (Node2D)
│   │   └── CollisionShape (circle) — range indicator
│   ├── CannonTower (Node2D)
│   └── SlowTower (Node2D)
├── Projectiles (Node)
│   ├── Arrow (Node2D)              — homing toward target
│   └── Cannonball (Node2D)
├── Camera (Camera)
└── HUD (Layer, fixed)
    ├── GoldLabel (Label)
    ├── LivesLabel (Label)
    ├── WaveLabel (Label)
    └── TowerPanel (Container)      — tower selection buttons with costs
        ├── ArrowTowerButton (Button)
        ├── CannonTowerButton (Button)
        └── SlowTowerButton (Button)
```

### 8.3 Path System

The path is defined as a sequence of waypoints (grid coordinates). Enemies follow the path from start to end using linear interpolation between waypoints.

```tsx
interface PathDef {
  waypoints: Vec2[];  // Grid coordinates
  cellSize: number;   // Pixels per cell (e.g., 32)
}

class PathFollower extends Actor {
  pathDef!: PathDef;
  waypointIndex = 0;
  speed = 60;
  sprite?: Sprite;
  readonly reachedExit = signal<void>();

  override build() {
    return <>
      <CollisionShape shape={Shape.rect(8, 8)} />
      <Sprite ref="sprite" texture="tileset" sourceRect={this.getCreepRect()} />
    </>;
  }

  override onReady() {
    super.onReady();
    this.tag("enemy");
  }

  onFixedUpdate(dt: number) {
    const target = this.pathDef.waypoints[this.waypointIndex];
    const worldTarget = target.clone().scale(this.pathDef.cellSize);
    const dir = worldTarget.clone().sub(this.position);
    if (dir.length() < 2) {
      this.waypointIndex++;
      if (this.waypointIndex >= this.pathDef.waypoints.length) {
        this.reachedExit.emit();
        this.destroy();
        return;
      }
    }
    dir.normalize().scale(this.speed);
    this.velocity.copy(dir);
    this.move(dt);
  }
}
```

### 8.4 Tower Types

| Tower | Cost | Range | Damage | Rate | Special |
|-------|------|-------|--------|------|---------|
| **ArrowTower** | 50g | 120px | 10 | 1/s | Fast, single target |
| **CannonTower** | 100g | 100px | 30 | 0.5/s | Slow, splash damage (40px radius) |
| **SlowTower** | 75g | 100px | 0 | — | Slows enemies in range by 50% |

Tower targeting: each tower has a `Sensor` child with a circle collision shape equal to its range. When an enemy enters the sensor, it's added to a target list. Tower shoots at the enemy closest to the exit (furthest along the path).

### 8.5 Enemy Types

| Enemy | Health | Speed | Gold Reward | Appears |
|-------|--------|-------|-------------|---------|
| **BasicCreep** | 30 | 60 | 10g | Wave 1+ |
| **FastCreep** | 15 | 120 | 15g | Wave 2+ |
| **TankCreep** | 100 | 40 | 30g | Wave 3+ |

### 8.6 Placement System

Grid-based tower placement using mouse/touch. **Important:** `game.input.mousePosition` returns screen coordinates. For grid-cell lookup, convert to world coordinates via `camera.screenToWorld(game.input.mousePosition)`.

1. Player clicks a tower button in the HUD panel
2. Selected tower type is highlighted, cursor shows placement preview
3. Player clicks a valid grid cell (not on path, not already occupied)
4. If player has enough gold, tower is placed and gold is deducted
5. Invalid placements show a red overlay

```tsx
class PlacementManager extends Node {
  selectedTower: TowerType | null = null;
  occupiedCells = new Set<string>(); // "x,y" keys

  canPlace(gridX: number, gridY: number): boolean {
    const key = `${gridX},${gridY}`;
    return !this.occupiedCells.has(key) && !this.isPathCell(gridX, gridY);
  }

  // Convert screen mouse position to grid cell
  getGridCell(): { x: number; y: number } | null {
    const camera = this.findByType(Camera);
    if (!camera) return null;
    const worldPos = camera.screenToWorld(this.game.input.mousePosition);
    return {
      x: Math.floor(worldPos.x / CELL_SIZE),
      y: Math.floor(worldPos.y / CELL_SIZE),
    };
  }
}
```

**Testing note:** In headless tests, there's no real mouse. Use `(game.input as any)._setMousePosition(x, y)` to inject mouse position for placement tests.

### 8.7 Scenes

| Scene | Purpose |
|-------|---------|
| `TitleScene` | "TOWER DEFENSE" title, level select |
| `TDLevel` | Base level class — path, grid, wave logic |
| `Level1` | Simple S-curve path, 5 waves |
| `Level2` | Complex path with branches, 5 waves, harder enemies |
| `GameOverScene` | Win/lose summary, final score |

### 8.8 File Structure

```
examples/tower-defense/
├── main.ts
├── config.ts                    — collision groups, input bindings
├── state.ts                     — gold, lives, wave, score
├── sprites.ts
├── path.ts                      — PathDef, path utilities
├── tile_description.csv         — tile identification (from Phase 1)
├── index.html
├── entities/
│   ├── path-follower.tsx        — base class for all enemies
│   ├── basic-creep.tsx
│   ├── fast-creep.tsx
│   ├── tank-creep.tsx
│   ├── tower-base.tsx           — base targeting + firing logic
│   ├── arrow-tower.tsx
│   ├── cannon-tower.tsx
│   ├── slow-tower.tsx
│   ├── projectile.tsx
│   ├── wave-manager.ts
│   └── placement-manager.ts
├── scenes/
│   ├── td-level.tsx             — base level class
│   ├── level1.tsx
│   ├── level2.tsx
│   ├── title-scene.tsx
│   └── game-over-scene.tsx
├── hud/
│   └── hud.tsx                  — gold, lives, wave, tower buttons
├── __tests__/
│   ├── helpers.ts
│   ├── path.test.ts
│   ├── enemies.test.ts
│   ├── towers.test.ts
│   ├── placement.test.ts
│   ├── waves.test.ts
│   └── flow.test.ts
├── assets/
│   ├── tileset.png
│   ├── level1.tmx
│   ├── level2.tmx
│   ├── build.ogg
│   ├── arrow.ogg
│   ├── cannon.ogg
│   ├── enemy-die.ogg
│   ├── wave-start.ogg
│   ├── life-lost.ogg
│   └── ATTRIBUTION.md
├── vitest.config.ts
└── tsconfig.json
```

### 8.9 Engine Features Exercised

| Feature | How It's Used |
|---------|---------------|
| `Actor` (zero gravity) | Path-following enemies |
| `Sensor` (circle range) | Tower range detection |
| `StaticCollider` | Map boundaries |
| Grid-based placement | Mouse click → `screenToWorld()` → grid coordinate → tower spawn |
| `game.physics.onContact()` | Projectile hits enemy |
| `TileMap` (TMX) | Terrain rendering, path definition |
| `Sprite` / `AnimatedSprite` | Tower turrets, enemy walk cycles, explosions |
| `game.audio.play()` | Build, shoot, kill SFX |
| `Tween` | Tower placement animation, enemy death fade |
| `UI` (Button, Label, Container, Panel) | Tower selection panel, economy display |
| `Camera` | Static camera (no scroll needed for small maps) |
| `Camera.screenToWorld()` | Convert mouse position to world coordinates for placement |
| Signals | `enemyKilled`, `waveStarted`, `waveCleared`, `enemyReachedExit` |
| Mouse input | `game.input.mousePosition` for tower placement |
| JSX `build()` | All entity structure + UI scenes |

### 8.10 Tests

**`__tests__/path.test.ts`:**
- Enemy follows waypoints in order
- Enemy signals `reachedExit` when path complete
- Enemy destroyed after reaching exit
- Speed affects traversal time

**`__tests__/enemies.test.ts`:**
- BasicCreep has correct health and speed
- FastCreep moves faster than BasicCreep
- TankCreep takes more hits to kill
- Enemy drops gold on death

**`__tests__/towers.test.ts`:**
- ArrowTower fires at enemy in range
- CannonTower deals splash damage
- SlowTower reduces enemy speed
- Tower targets enemy closest to exit
- Tower stops firing when no enemies in range

**`__tests__/placement.test.ts`:**
- Can place tower on valid cell
- Cannot place tower on path
- Cannot place tower on occupied cell
- Gold deducted on placement
- Cannot place if insufficient gold

**`__tests__/waves.test.ts`:**
- Wave 1 spawns correct enemies
- Wave progression increases difficulty
- All enemies killed triggers wave clear

**`__tests__/flow.test.ts`:**
- Full game flow: place towers, survive waves
- Losing all lives triggers game over
- Deterministic replay

### 8.11 Deliverables

- [x] Create `examples/tower-defense/` directory structure
- [x] Implement path system with waypoint following (TSX build)
- [x] Implement 3 enemy types with path following (TSX build)
- [x] Implement 3 tower types with targeting and firing (TSX build)
- [x] Implement projectile system (homing arrows, splash cannonballs)
- [x] Implement grid-based placement system with grid coordinate conversion
- [x] Implement wave manager with escalating difficulty
- [x] Implement economy (gold earned/spent)
- [x] Implement 2 levels with different path layouts
- [x] Implement HUD with tower selection panel (TSX build)
- [ ] Add sound effects and audio integration
- [x] Write integration tests (path, enemies, towers, placement, waves, flow)
- [ ] Verify game is playable via `pnpm dev`
- [x] Verify all tests pass
- [ ] Verify `qdbg connect tower-defense` works for debugging

---

## 9. Phase 6: Puzzle (Sokoban)

### 9.1 Game Design

Classic Sokoban box-pushing puzzle. Player moves on a grid, pushes crates onto target squares. Tests a completely different paradigm: turn-based, grid-locked movement, undo system, no physics simulation.

**Gameplay:**
- Grid-based movement (up/down/left/right, one cell per move)
- Player can push crates but not pull them
- Push a crate onto a target square to "solve" it
- All targets covered = level complete
- Undo last move(s) with a button
- 5+ levels with increasing difficulty
- Move counter (par score)

### 9.2 Scene Tree

```
Scene (SokobanLevel)
├── Grid (Node)
│   ├── Floor tiles (Node2D)        — static, visual only
│   ├── Wall tiles (Node2D)         — static, visual only
│   └── Target markers (Node2D)     — visual, pulsing glow
├── Player (Node2D)                 — grid-locked position
├── Crates (Node)
│   ├── Crate (Node2D)             — grid-locked, pushable
│   └── ...
├── Camera (Camera)
└── HUD (Layer, fixed)
    ├── LevelLabel (Label)
    ├── MovesLabel (Label)
    ├── UndoButton (Button)
    └── ResetButton (Button)
```

### 9.3 Grid System

This game does NOT use the physics engine. Movement is purely grid-based logic.

**Undo system** stores lightweight deltas (player position + optional crate move) instead of full state snapshots. Walls and targets are immutable and never stored in undo history.

```typescript
interface MoveRecord {
  playerFrom: Vec2;          // Player position before move
  crateIndex: number;        // Index of pushed crate (-1 if no push)
  crateFrom: Vec2 | null;    // Crate position before push (null if no push)
}

class SokobanGrid extends Node {
  // Immutable level data
  readonly width: number;
  readonly height: number;
  readonly walls: boolean[][];
  readonly targets: Vec2[];

  // Mutable game state
  crates: Vec2[];
  player: Vec2;
  moveCount = 0;
  history: MoveRecord[] = [];

  tryMove(dir: Vec2): boolean {
    const newPos = this.player.clone().add(dir);

    // Check wall
    if (this.isWall(newPos)) return false;

    // Check crate — can we push it?
    const crateIdx = this.crateAt(newPos);
    if (crateIdx >= 0) {
      const crateDest = newPos.clone().add(dir);
      if (this.isWall(crateDest) || this.crateAt(crateDest) >= 0) {
        return false;  // Can't push into wall or another crate
      }
      // Save undo record and push crate
      this.history.push({
        playerFrom: this.player.clone(),
        crateIndex: crateIdx,
        crateFrom: this.crates[crateIdx].clone(),
      });
      this.crates[crateIdx] = crateDest;
    } else {
      // Save undo record (no crate push)
      this.history.push({
        playerFrom: this.player.clone(),
        crateIndex: -1,
        crateFrom: null,
      });
    }

    // Move player
    this.player = newPos;
    this.moveCount++;
    return true;
  }

  undo(): boolean {
    if (this.history.length === 0) return false;
    const record = this.history.pop()!;
    this.player = record.playerFrom;
    if (record.crateIndex >= 0 && record.crateFrom) {
      this.crates[record.crateIndex] = record.crateFrom;
    }
    this.moveCount--;
    return true;
  }

  isSolved(): boolean {
    return this.targets.every(t =>
      this.crates.some(c => c.x === t.x && c.y === t.y)
    );
  }
}
```

### 9.4 Key Design: No Physics

Sokoban is purely logical — no collision detection, no velocity, no `move()`. This deliberately exercises the engine WITHOUT physics to show it works for non-physics games:

- **Player** extends `Node2D` (not Actor) — position snaps to grid
- **Crates** extend `Node2D` — pushed via grid logic, not physics
- **Walls** are grid data, not `StaticCollider` objects
- **Movement** is discrete (one cell per input), not continuous
- **Tweens** animate the smooth sliding between grid positions

This means input handling is different: each arrow key press = one grid move (not continuous movement). Use `isJustPressed` exclusively.

### 9.5 Level Format

Levels stored as simple string grids (classic Sokoban format):

```
# = wall
. = target
$ = crate
@ = player
+ = player on target
* = crate on target
(space) = floor
```

```typescript
const LEVELS: string[] = [
  // Level 1: Tutorial
  `
  #####
  #   #
  # $ #
  # . #
  # @ #
  #####
  `,
  // Level 2: Two crates
  `
  ######
  #    #
  # $$ #
  # .. #
  # @  #
  ######
  `,
  // ... more levels
];
```

### 9.6 Scenes

| Scene | Purpose |
|-------|---------|
| `TitleScene` | "SOKOBAN" title, level select grid |
| `SokobanLevel` | Gameplay — grid rendering, move logic, undo |
| `LevelSelect` | Grid of level buttons (completed levels show checkmark) |
| `LevelCompleteOverlay` | "Level Complete!" + moves count + par + next level button |

### 9.7 File Structure

```
examples/sokoban/
├── main.ts
├── config.ts                    — input bindings
├── state.ts                     — current level, completed levels, move counts
├── sprites.ts
├── levels.ts                    — level string definitions
├── grid.ts                      — SokobanGrid logic (pure, no rendering)
├── tile_description.csv         — tile identification (from Phase 1)
├── index.html
├── entities/
│   ├── grid-renderer.tsx        — renders grid state to Node2D children
│   ├── player-sprite.tsx        — animated player on grid
│   └── crate-sprite.tsx         — crate with on-target visual
├── scenes/
│   ├── sokoban-level.tsx        — gameplay scene
│   ├── title-scene.tsx
│   ├── level-select.tsx
│   └── level-complete.tsx
├── hud/
│   └── hud.tsx                  — moves, level, undo/reset buttons
├── __tests__/
│   ├── helpers.ts
│   ├── grid.test.ts             — pure logic tests (no engine)
│   ├── movement.test.ts         — player grid movement
│   ├── push.test.ts             — crate pushing rules
│   ├── undo.test.ts             — undo system
│   ├── levels.test.ts           — all levels are solvable
│   └── flow.test.ts             — level progression
├── assets/
│   ├── tileset.png
│   ├── move.ogg
│   ├── push.ogg
│   ├── solved.ogg
│   ├── undo.ogg
│   ├── level-complete.ogg
│   ├── cant-move.ogg
│   └── ATTRIBUTION.md
├── vitest.config.ts
└── tsconfig.json
```

### 9.8 Engine Features Exercised

| Feature | How It's Used |
|---------|---------------|
| `Node2D` (no Actor/physics) | Player and crates — pure visual, grid-locked |
| `Tween` | Smooth sliding animation between grid cells |
| `game.input.isJustPressed()` | Discrete grid movement (one press = one move) |
| `game.audio.play()` | Move, push, solved, undo SFX |
| `UI` (Button, Label, Container) | Level select, undo/reset, move counter |
| `Sprite` | Tile rendering, player, crate sprites |
| Signals | `levelSolved`, `cratePlaced`, `moveUndone` |
| Scene transitions | Title → LevelSelect → SokobanLevel → LevelComplete |
| Pure logic (no physics) | Grid system is pure TypeScript, testable without engine |
| State persistence | Track completed levels across scene transitions |
| JSX `build()` | All UI scenes + grid renderer |

### 9.9 Tests

**`__tests__/grid.test.ts`:** (Pure logic, no engine — fastest tests)
- Player moves to empty cell
- Player blocked by wall
- Player pushes crate to empty cell
- Player can't push crate into wall
- Player can't push crate into another crate
- Solved detection when all targets covered
- Undo reverses last move (restores player position)
- Undo reverses crate push (restores crate position)
- Multiple undos work correctly
- Undo stack empty at start
- Undo record is lightweight (only delta, not full state)

**`__tests__/movement.test.ts`:** (With engine)
- Arrow key moves player one grid cell
- Player position snaps to grid
- Tween animates between grid positions
- Move counter increments

**`__tests__/push.test.ts`:** (With engine)
- Pushing crate triggers push sound
- Crate on target triggers solved sound
- Crate visual changes when on target

**`__tests__/undo.test.ts`:** (With engine)
- Undo button reverses last move
- Undo button disabled when no history
- Reset button resets entire level

**`__tests__/levels.test.ts`:**
- All levels parse correctly
- All levels have at least one crate and one target
- Crate count equals target count per level
- (Optional) All levels are solvable (brute-force BFS solver for small levels)

**`__tests__/flow.test.ts`:**
- Title → LevelSelect → Level1 flow
- Level complete → next level transition
- Completed levels tracked in state
- Deterministic replay

### 9.10 Deliverables

- [ ] Create `examples/sokoban/` directory structure
- [ ] Implement SokobanGrid pure logic class (move, push, delta-based undo, solve detection)
- [ ] Implement grid renderer (TSX build, Node2D children for tiles, crates, player)
- [ ] Implement discrete grid movement with tweened animation
- [ ] Implement undo system with lightweight delta records
- [ ] Implement 5+ levels of increasing difficulty
- [ ] Implement level select scene with completion tracking (TSX build)
- [ ] Implement HUD with moves counter, undo/reset buttons (TSX build)
- [ ] Add sound effects and audio integration
- [ ] Write pure logic tests (grid.test.ts — no engine dependency)
- [ ] Write integration tests (movement, push, undo, levels, flow)
- [ ] Verify game is playable via `pnpm dev`
- [ ] Verify all tests pass
- [ ] Verify `qdbg connect sokoban` works for debugging

---

## 10. Phase 7: Cross-Game Review & Prefabs Proposal

### 10.1 Purpose

After all six full example games are built and tested, review them holistically to identify reusable patterns. Write `steering/PREFABS_PROPOSAL.md` for human review before implementing `@quintus/ai-prefabs`.

### 10.2 Process

1. **Inventory all entities** across all 6 games (platformer, dungeon, breakout, space-shooter, tower-defense, sokoban)
2. **Identify shared patterns** — entities that appear in multiple games or have a clear generic form
3. **Categorize by abstraction level:**
   - **Direct reuse** — entity works as-is across games (e.g., `HealthPickup`)
   - **Parameterized reuse** — entity works with config changes (e.g., `PatrolEnemy` with speed/range params)
   - **Pattern extraction** — common logic extracted as a base class or mixin (e.g., `PathFollower`, `WaveManager`)
   - **Too game-specific** — entity is unique to one game, not worth generalizing
4. **Propose prefab list** with API sketches and schema definitions
5. **Estimate size** — will the full prefab package fit in the 15KB gzipped budget?

### 10.3 Review Dimensions

For each entity across all games, evaluate:

| Dimension | Question |
|-----------|----------|
| **Reuse frequency** | How many games use this pattern? |
| **Parameterization** | Can it be configured via a `static schema` to fit multiple games? |
| **Composability** | Can an LLM combine it with other prefabs to build new games? |
| **Size** | How much code does it add to the bundle? |
| **Dependencies** | Does it require specific packages (physics, tilemap, etc.)? |
| **Testability** | Can it be tested in isolation? |

### 10.4 Expected Entity Inventory

Based on the games planned, we expect to find these patterns:

**Characters & Movement:**
- Platformer player (run, jump, double-jump) — from platformer
- Top-down player (4-dir movement, attack, defend) — from dungeon
- Free-moving player (4-dir, no grid) — from space-shooter
- Grid-locked player (discrete movement) — from sokoban

**Enemies & AI:**
- Patrol enemy (walk back and forth, edge detection) — from platformer
- Flying enemy (sine wave movement) — from platformer
- Chasing enemy (move toward player) — from dungeon
- Path-following enemy (waypoint sequence) — from tower-defense
- Wave-spawned enemy — from space-shooter, tower-defense
- Boss (multi-phase, high HP) — from space-shooter

**Items & Pickups:**
- Coin/gold (collect for score) — from platformer, dungeon
- Health pickup (restore HP) — from platformer, dungeon
- Power-up (temporary buff) — from breakout, space-shooter
- Equipment drop (weapon/armor) — from dungeon

**Environment:**
- Moving platform — from platformer
- Spike/hazard — from platformer
- Destructible object (chest) — from dungeon
- Door/exit (level transition trigger) — from platformer, dungeon
- Pushable block — from sokoban

**Systems:**
- Wave manager — from space-shooter, tower-defense
- Placement system — from tower-defense
- Inventory/equipment system — from dungeon
- Undo system — from sokoban
- HUD (health, score, level) — from all games

**UI:**
- Score display — all games
- Health bar — platformer, dungeon, space-shooter
- Tower/item selection panel — tower-defense
- Level select grid — sokoban

### 10.5 Output Document

Write `steering/PREFABS_PROPOSAL.md` containing:

1. **Entity inventory table** — every entity from every game, categorized
2. **Proposed prefab list** — ~30 prefabs organized by category
3. **API sketches** — TypeScript class signatures with `static schema` for each prefab
4. **Dependency map** — which prefabs require which packages
5. **Size estimates** — rough byte budget per prefab
6. **What NOT to include** — game-specific entities that aren't worth generalizing
7. **Implementation order** — which prefabs to build first based on dependency and usefulness

### 10.6 Deliverables

- [ ] Inventory all entities across 6 example games
- [ ] Identify shared patterns and categorize by abstraction level
- [ ] Draft proposed prefab list (~30 prefabs)
- [ ] Write API sketches with `static schema` for each proposed prefab
- [ ] Estimate size budget for `@quintus/ai-prefabs` package
- [ ] Write `steering/PREFABS_PROPOSAL.md` for human review
- [ ] Include recommendations for which patterns are NOT worth abstracting

---

## 11. Shared Patterns & Conventions

### 11.1 TSX Build Pattern

All new games use the JSX `build()` pattern from `@quintus/jsx`. See §1.4 for the full pattern reference. The key rule of thumb:

- **`build()`** — What nodes exist and their initial props (structure)
- **`onReady()`** — Runtime behavior, method calls, signal connections, values computed from other nodes

### 11.2 Game State Pattern

Every game uses a global state object for cross-scene data:

```typescript
// examples/{game}/state.ts
interface GameState {
  score: number;
  // ... game-specific fields
}

export const gameState: GameState = { score: 0 };

export function resetState() {
  Object.assign(gameState, { score: 0 /* ... */ });
}
```

### 11.3 Config Pattern

Collision groups and input bindings are defined in a config file, passed to plugins (NOT to the Game constructor):

```typescript
// examples/{game}/config.ts
export const COLLISION_GROUPS = {
  player: { collidesWith: ["world", "enemies", "items"] },
  // ...
};

export const INPUT_BINDINGS = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  // ...
};
```

```typescript
// examples/{game}/main.ts
game.use(PhysicsPlugin({ gravity: new Vec2(0, 0), collisionGroups: COLLISION_GROUPS }));
game.use(InputPlugin({ actions: INPUT_BINDINGS }));
```

### 11.4 Sprite Sheet Pattern

**Grid-based (uniform frames):** For tilesets with a regular grid layout (e.g., Tower Defense):

```typescript
// examples/{game}/sprites.ts
export const SPRITES = new SpriteSheet({
  texture: "tileset",
  frameWidth: 16,
  frameHeight: 16,
  columns: 12,
  animations: {
    "player-idle": { frames: [0, 1], fps: 4, loop: true },
    // ...
  },
});
```

**Atlas-based (variable frames):** For Kenney packs with XML atlases (Breakout, Space Shooter, Sokoban):

```typescript
// examples/{game}/sprites.ts
import { TextureAtlas } from "@quintus/sprites";

export let atlas: TextureAtlas;

export function loadAtlas(game: Game) {
  atlas = TextureAtlas.fromXml(game.assets.getText("atlas-xml"), "tileset");
}

// Usage in entities:
// <Sprite texture="tileset" sourceRect={atlas.getFrameOrThrow("paddle_01.png")} />
```

### 11.5 Scene Base Class Pattern

Games with multiple levels use an abstract base scene class with `build()`:

```tsx
// examples/{game}/scenes/base-level.tsx
abstract class BaseLevel extends Scene {
  abstract readonly levelAsset: string;
  abstract readonly nextScene: string;

  protected player?: Player;
  protected camera?: Camera;

  override build() {
    return <>
      <Player ref="player" />
      <Camera ref="camera" follow="$player" smoothing={0.1} />
      <HUD />
    </>;
  }

  override onReady() {
    // Common imperative setup
  }
}
```

### 11.6 Entity serialize() Pattern

All custom entities override `serialize()` for debug introspection:

```typescript
class MyEntity extends Actor {
  health = 3;
  override serialize() {
    return { ...super.serialize(), health: this.health };
  }
}
```

### 11.7 Vite Dev Server Integration

Each game is registered in the Vite dev server's example index. The `examples/` directory's `index.html` (or Vite config) lists all available games for quick access.

---

## 12. Test Infrastructure

### 12.1 Per-Game Test Setup

Each game gets:

```
examples/{game}/
├── __tests__/
│   ├── helpers.ts          — gamePlugins(), loadAssets(), resetState(), runLevel()
│   ├── *.test.ts           — test files by feature
├── vitest.config.ts        — extends root config, points to __tests__/
└── tsconfig.json           — extends root tsconfig, adds JSX settings
```

### 12.2 TSConfig for JSX Examples

```jsonc
// examples/{game}/tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@quintus/jsx",
    "noEmit": true
  }
}
```

### 12.3 Vitest Config Pattern

Following the dungeon example's pattern:

```typescript
// examples/{game}/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "@quintus/jsx",
  },
  server: {
    fs: { strict: false },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["vitest-canvas-mock"],
    include: ["examples/{game}/__tests__/**/*.test.ts"],
  },
});
```

### 12.4 Test Helpers Template

```typescript
// examples/{game}/__tests__/helpers.ts
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { HeadlessGame } from "@quintus/headless";
import { TestRunner, InputScript } from "@quintus/test";
import { _resetNodeIdCounter } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { InputPlugin } from "@quintus/input";
import { TweenPlugin } from "@quintus/tween";
import { AudioPlugin } from "@quintus/audio";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "../config";
import { gameState, resetState } from "../state";
import { Level1 } from "../scenes/level1";
import { SPRITES } from "../sprites";

const ASSETS_DIR = resolve(__dirname, "../assets");

export function gamePlugins() {
  return [
    PhysicsPlugin({ gravity: new Vec2(0, 0), collisionGroups: COLLISION_GROUPS }),
    InputPlugin({ actions: INPUT_BINDINGS }),
    TweenPlugin(),
    AudioPlugin(),
  ];
}

export async function loadAssets(game: HeadlessGame) {
  game.assets._storeCustom("tileset", "placeholder");
  // Load TMX files if applicable
  // const tmx = await readFile(resolve(ASSETS_DIR, "level1.tmx"), "utf-8");
  // game.assets._storeCustom("level1", tmx);
}

export function runLevel(
  input?: InputScript,
  duration?: number,
  afterReset?: () => void,
) {
  return TestRunner.run({
    scene: Level1,
    seed: 42,
    width: 480,
    height: 640,
    plugins: gamePlugins(),
    input,
    duration,
    snapshotInterval: 1,
    setup: loadAssets,
    beforeRun: () => {
      resetState();
      _resetNodeIdCounter();
      afterReset?.();
    },
  });
}
```

### 12.5 Test Script in Root package.json

```json
{
  "scripts": {
    "test:breakout": "vitest run --config examples/breakout/vitest.config.ts",
    "test:shooter": "vitest run --config examples/space-shooter/vitest.config.ts",
    "test:td": "vitest run --config examples/tower-defense/vitest.config.ts",
    "test:sokoban": "vitest run --config examples/sokoban/vitest.config.ts",
    "test:examples": "vitest run --config examples/*/vitest.config.ts"
  }
}
```

### 12.6 Determinism Requirement

Every game must pass a determinism test:

```typescript
test("deterministic replay", async () => {
  const input = InputScript.create()
    .press("right", 60)
    .tap("fire")
    .wait(30);

  const run1 = await runLevel(input);
  const run2 = await runLevel(input);

  const diffs = diffSnapshots(run1.finalState, run2.finalState);
  expect(diffs).toHaveLength(0);
});
```

---

## 13. Definition of Done

### Per-Game Criteria

For each of the 4 new games (Breakout, Space Shooter, Tower Defense, Sokoban):

- [ ] Game runs in browser via `pnpm dev`
- [ ] Game is playable from title screen through game over/victory
- [ ] Uses TSX `build()` pattern for all entities and UI scenes
- [ ] At least 2 levels or escalating waves
- [ ] HUD displays score and game-specific state
- [ ] Sound effects play on game events
- [ ] Integration tests cover core mechanics
- [ ] Deterministic replay test passes
- [ ] `pnpm test examples/{game}` passes with no warnings
- [ ] `pnpm lint` clean
- [ ] `pnpm build` succeeds
- [ ] `qdbg connect {game}` works for debugging
- [ ] `serialize()` overrides on all custom entities
- [ ] Asset attribution in `ATTRIBUTION.md`

### Phase 3 (Pooling) Criteria

- [ ] All existing physics tests pass (zero regressions)
- [ ] `NodePool<T>` acquire/release/reset tests pass
- [ ] Pool determinism tests pass
- [ ] `pnpm build` and `pnpm lint` clean

### Phase 7 (Prefabs) Criteria

- [ ] All 6 full example games inventoried
- [ ] `steering/PREFABS_PROPOSAL.md` written with:
  - Entity inventory table
  - Proposed ~30 prefabs with API sketches
  - Size estimates
  - Implementation priority
- [ ] Proposal ready for human review before implementation

### Overall Phase 9 Criteria

- [ ] All 4 new games pass all tests
- [ ] Each game demonstrates a different game genre
- [ ] Each game exercises different engine features
- [ ] Object pooling system implemented and used in Space Shooter
- [ ] `PREFABS_PROPOSAL.md` reviewed and approved (or revised)
- [ ] An LLM can read any example game and extend it with a new feature
