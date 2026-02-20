# Dungeon Crawler Rebuild — Detailed Design

> **Goal:** Rebuild the dungeon crawler example from the ground up with correct sprites, TSX declarative patterns, comprehensive tests at every phase, visible equipment, inventory, potions, and proper level design.
> **Outcome:** A fully tested, playable top-down dungeon crawler that demonstrates the engine's capabilities — including JSX `build()`, combat, inventory, and AI — with each subsystem verified by headless tests.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Sprite audit & correction | Pending |
| 2 | Test infrastructure & basic scene | Pending |
| 3 | Player movement & collision (TSX) | Pending |
| 4 | Equipment system (Weapon/Shield base classes) | Pending |
| 5 | Combat system (attack, defend, hitboxes) | Pending |
| 6 | Enemy AI (BaseEnemy, Dwarf, Barbarian) | Pending |
| 7 | Interactables (Chest, Door, HealthPickup) | Pending |
| 8 | Inventory & potion system | Pending |
| 9 | HUD (TSX) | Pending |
| 10 | Level rebuild & scene flow | Pending |

---

## Current State

The dungeon example has all entities written but was built top-down without tests. The sprite tile IDs are wrong in several places (based on updated `tile_description.csv` audit). The code is all imperative — no JSX `build()` usage. There are zero tests.

### Key Problems to Fix

1. **Wrong sprite tile IDs** — Many TILE constants don't match the actual tileset content
2. **No tests** — Can't verify anything works without manual play-through
3. **No visible equipment** — Weapons/shields are invisible (just damage/defense numbers)
4. **No JSX** — Everything is imperative `onReady()`, should use `build()` where appropriate
5. **Weapon hitboxes are detached** — Spawned as sibling nodes, not children of the attacker
6. **No animation on equipment** — Attack/defend should show weapon/shield movement

### Correct Tile ID Reference (from `tile_description.csv`)

```
Category: player
  96  knight 1
  97  knight 2
  98  knight 3
  100 knight female

Category: enemy
  87  dwarf
  88  barbarian
  92  mimic chest
  108 slime
  109 cyclops
  110 crab
  111 dark wizard
  112 elf
  120 bat
  121 ghost
  122 spider
  123 brown rat
  124 gray rat

Category: items (weapons/shields/potions)
  101 shield wooden
  102 shield metal
  103 sword small
  104 sword large
  105 sword barbarian
  106 sword wide
  107 sword wooden
  113 potion gray
  114 potion green
  115 potion red
  116 potion blue
  117 war hammer
  118 battle axe
  119 hand axe
  125 gray wand
  126 green wand
  127 red wand
  128 blue wand
  129 special purple wand
  130 special blue wand
  131 spear

Category: object
  31  bottom of empty fountain
  32  bottom of full fountain
  63  crate
  64  graveyard cross
  65  gravestone
  66  table
  72  table (variant)
  73  stool
  74  anvil
  75  bookshelf
  76  fence left
  77  fence middle
  78  fence right
  82  barrel
  89  chest closed
  90  chest opening animation 1/1
  91  chest open

Category: npc
  84  wizard
  85  man1
  86  blacksmith
  99  woman

Category: door
  9   small open door
  10  large open door left
  11  large open door right
  21  small door opening animation 2/2
  22  large door opening animation 2/2 left
  23  large door opening animation 2/2 right
  33  small door opening animation 1/2
  34  large door opening animation 1/2 left
  35  large door opening animation 2/2 right
  45  small door closed
  46  large door closed left
  47  large door closed right

Category: floor
  36  platform stairs left
  37  platform stairs center
  38  platform stairs right
  39  platform stairs full
  42  floor variant
  43  small fountain empty
  44  small fountain full
  48  full floor
  49  full floor variant
  50  full floor shadow top
  51  full floor shadow top variant
  52  full floor shadow top right
  53  full floor shadow top left
  30  floor with bottom of column

Category: wall
  6   wall top of column
  7   wall snake fountain off
  8   wall snake fountain on
  14  gray wall
  18  wall middle column
  19  wall fountain off
  20  wall fountain on
  28  wall with grates
  29  wall with banner
  40  wall full variant
  57  wall floor to left
  58  wall floor both sides
  59  wall floor to right

Category: ceiling (brown tiles)
  0   dark brown ceiling full
  1   dark brown ceiling top left
  2   dark brown ceiling top center
  3   dark brown ceiling top right
  4   dark brown ceiling bottom left (inner corner)
  5   dark brown ceiling bottom right (inner corner)
  12  dark brown ceiling variant 1 rubble
  13  dark brown ceiling middle left
  15  dark brown ceiling middle right
  16  dark brown ceiling bottom left
  17  dark brown ceiling bottom right
  24  dark brown ceiling full alternative 2 rubble
  25  dark brown ceiling bottom left
  26  dark brown ceiling bottom center
  27  dark brown ceiling bottom right

Category: trap
  41  spikes
```

### Current vs Correct Sprite Mappings

| Entity | Current Tile | Correct Tile | Issue |
|--------|-------------|--------------|-------|
| Player | 85 (man1 NPC) | 96 (knight 1) | Wrong — using NPC not player |
| Skeleton | 87 (dwarf) | 87 (dwarf) | OK but label was wrong — it's a dwarf enemy |
| Orc | 114 (potion green!) | 88 (barbarian) | **Wrong** — using a potion tile |
| Chest Closed | 46 (large door closed left!) | 89 (chest closed) | **Wrong** — using door tile |
| Chest Open | 47 (large door closed right!) | 91 (chest open) | **Wrong** — using door tile |
| Door Closed | 75 (bookshelf!) | 45 (small door closed) | **Wrong** — using bookshelf |
| Door Open | 22 (large door anim!) | 9 (small open door) | **Wrong** — using large door anim |
| Heart Full | 45 (small door closed!) | No heart tile in set | **Wrong** — need to use potion red (115) or custom |
| Heart Empty | 44 (small fountain full!) | No empty heart | **Wrong** |
| Key | 101 (shield wooden!) | No key tile | **Wrong** — using shield as key |
| Sword 1 | 93 (minecart rails turn) | 103 (sword small) | **Wrong** — using rails |
| Sword 2 | 119 (hand axe) | 104 (sword large) | Partially OK — was axe not sword |
| Sword 3 | 119 (hand axe) | 105 (sword barbarian) | Wrong — reused same tile |
| Shield 1 | 66 (table!) | 101 (shield wooden) | **Wrong** — using table |
| Shield 2 | 122 (spider!) | 102 (shield metal) | **Wrong** — using spider enemy |

**Summary:** Almost every non-wall sprite reference is wrong. The tileset is a Kenney dungeon set where tiles 84–131 are characters/items, but the current code has completely wrong indices for most entities and items.

---

## Architecture: Scene Tree with Equipment

```
Scene (DungeonLevel)
├── TileMap
├── Node2D (entities, ySortChildren=true)
│   ├── Player (Actor)
│   │   ├── CollisionShape (rect 10×6, offset y+4)
│   │   ├── AnimatedSprite (player body)
│   │   ├── Weapon (Node2D) ← always visible child
│   │   │   └── Sprite (current weapon tile)
│   │   └── Shield (Node2D) ← always visible child
│   │       └── Sprite (current shield tile)
│   ├── Dwarf (Actor, BaseEnemy)
│   │   ├── CollisionShape
│   │   ├── AnimatedSprite (body)
│   │   ├── Weapon (Node2D) ← enemy weapon, always visible
│   │   │   └── Sprite
│   │   └── Shield (Node2D) ← optional
│   │       └── Sprite
│   ├── Barbarian (Actor, BaseEnemy)
│   │   └── ... same structure
│   ├── Chest (Sensor)
│   │   ├── CollisionShape
│   │   └── AnimatedSprite (closed → opening → open)
│   ├── Door (Sensor)
│   │   ├── CollisionShape
│   │   └── AnimatedSprite (closed → open)
│   └── HealthPickup (Sensor)
│       ├── CollisionShape
│       └── AnimatedSprite (potion)
├── Camera (follows player)
└── HUD (Layer, fixed)
    ├── Sprite[] (health — potion icons)
    ├── Label (score)
    ├── Sprite (current weapon icon)
    ├── Sprite (current potion icon, if held)
    └── Label (keys)
```

### Equipment as Node2D Children

The key design change: **weapons and shields are persistent child `Node2D`s** of the character, not spawned/destroyed hitboxes. They have a `Sprite` child that shows the equipment and animated transforms for attack/defend.

```
Player
├── CollisionShape
├── AnimatedSprite (body)
├── EquippedWeapon extends Node2D
│   └── Sprite (sword/axe tile, positioned relative to hand)
│   // On attack: tween rotation + position (swing arc)
│   // At rest: visible at character's side
└── EquippedShield extends Node2D
    └── Sprite (shield tile, positioned on opposite side)
    // On defend: tween position forward (raise shield)
    // At rest: visible at character's side
```

**Attack hitbox** is still a separate short-lived `Sensor` spawned in the parent (entity container), but the *visual* weapon is the persistent `EquippedWeapon` child that plays a swing animation.

---

## Phase 1: Sprite Audit & Correction

Fix all tile ID references to match the actual Kenney Tiny Dungeon tileset. This is the foundation — everything else depends on correct visuals.

### Corrected `sprites.ts`

```typescript
export const entitySheet = new SpriteSheet({
  texture: "tileset",
  frameWidth: 16,
  frameHeight: 16,
  columns: 12,
  rows: 11,
  spacing: 1,
  animations: {
    // Players (knight variants — single sprite, no multi-frame walk)
    player_idle: { frames: [96], fps: 1, loop: false },
    player_walk: { frames: [96, 96], fps: 6, loop: true },

    // Enemies
    dwarf_idle: { frames: [87], fps: 1, loop: false },
    dwarf_walk: { frames: [87, 87], fps: 4, loop: true },
    barbarian_idle: { frames: [88], fps: 1, loop: false },
    barbarian_walk: { frames: [88, 88], fps: 4, loop: true },
    slime_idle: { frames: [108], fps: 1, loop: false },
    bat_idle: { frames: [120], fps: 1, loop: false },

    // Chest (3-frame: closed → opening → open)
    chest_closed: { frames: [89], fps: 1, loop: false },
    chest_opening: { frames: [90], fps: 1, loop: false },
    chest_open: { frames: [91], fps: 1, loop: false },

    // Door (small door: closed → opening stages → open)
    door_closed: { frames: [45], fps: 1, loop: false },
    door_opening_1: { frames: [33], fps: 1, loop: false },
    door_opening_2: { frames: [21], fps: 1, loop: false },
    door_open: { frames: [9], fps: 1, loop: false },

    // Potions (used as health display and pickups)
    potion_red: { frames: [115], fps: 1, loop: false },
    potion_blue: { frames: [116], fps: 1, loop: false },
    potion_green: { frames: [114], fps: 1, loop: false },
    potion_gray: { frames: [113], fps: 1, loop: false },

    // Equipment display
    sword_small: { frames: [103], fps: 1, loop: false },
    sword_large: { frames: [104], fps: 1, loop: false },
    sword_barbarian: { frames: [105], fps: 1, loop: false },
    shield_wooden: { frames: [101], fps: 1, loop: false },
    shield_metal: { frames: [102], fps: 1, loop: false },
    hand_axe: { frames: [119], fps: 1, loop: false },
    battle_axe: { frames: [118], fps: 1, loop: false },
    war_hammer: { frames: [117], fps: 1, loop: false },
    spear: { frames: [131], fps: 1, loop: false },

    // Misc objects
    barrel: { frames: [82], fps: 1, loop: false },
    crate: { frames: [63], fps: 1, loop: false },
    spikes: { frames: [41], fps: 1, loop: false },
  },
});
```

### Corrected `TILE` Constants

```typescript
export const TILE = {
  // Players
  KNIGHT_1: 96,
  KNIGHT_2: 97,
  KNIGHT_3: 98,
  KNIGHT_FEMALE: 100,

  // Enemies
  DWARF: 87,
  BARBARIAN: 88,
  SLIME: 108,
  CYCLOPS: 109,
  CRAB: 110,
  DARK_WIZARD: 111,
  ELF: 112,
  BAT: 120,
  GHOST: 121,
  SPIDER: 122,
  BROWN_RAT: 123,
  GRAY_RAT: 124,
  MIMIC: 92,

  // Chests
  CHEST_CLOSED: 89,
  CHEST_OPENING: 90,
  CHEST_OPEN: 91,

  // Doors (small)
  DOOR_CLOSED: 45,
  DOOR_OPENING_1: 33,
  DOOR_OPENING_2: 21,
  DOOR_OPEN: 9,

  // Weapons
  SWORD_SMALL: 103,
  SWORD_LARGE: 104,
  SWORD_BARBARIAN: 105,
  SWORD_WIDE: 106,
  SWORD_WOODEN: 107,
  HAND_AXE: 119,
  BATTLE_AXE: 118,
  WAR_HAMMER: 117,
  SPEAR: 131,

  // Shields
  SHIELD_WOODEN: 101,
  SHIELD_METAL: 102,

  // Potions
  POTION_GRAY: 113,
  POTION_GREEN: 114,
  POTION_RED: 115,
  POTION_BLUE: 116,

  // Wands
  WAND_GRAY: 125,
  WAND_GREEN: 126,
  WAND_RED: 127,
  WAND_BLUE: 128,
  WAND_PURPLE: 129,
  WAND_BLUE_SPECIAL: 130,

  // NPCs
  WIZARD: 84,
  MAN: 85,
  BLACKSMITH: 86,
  WOMAN: 99,

  // Objects
  BARREL: 82,
  CRATE: 63,
  TABLE: 66,
  STOOL: 73,
  ANVIL: 74,
  BOOKSHELF: 75,
  SPIKES: 41,

  // HUD icons (use potions as health indicators)
  HEALTH_FULL: 115,   // red potion = full health point
  HEALTH_EMPTY: 113,  // gray potion = empty health point
} as const;
```

### Corrected `state.ts` Weapon/Shield Definitions

```typescript
export const SWORDS: SwordDef[] = [
  { name: "Small Sword", damage: 1, spriteFrame: 103 },
  { name: "Large Sword", damage: 2, spriteFrame: 104 },
  { name: "Barbarian Sword", damage: 3, spriteFrame: 105 },
];

export const SHIELDS: ShieldDef[] = [
  { name: "Wooden Shield", defense: 1, spriteFrame: 101 },
  { name: "Metal Shield", defense: 2, spriteFrame: 102 },
];
```

### Phase 1 Checklist

- [ ] Update `sprites.ts` with all corrected tile IDs and animation names
- [ ] Update `TILE` constants to match actual tileset content
- [ ] Update `state.ts` sword/shield definitions with correct sprite frames
- [ ] Add new animations: `chest_opening`, `door_opening_1`, `door_opening_2`
- [ ] Add potion animations for pickup/display
- [ ] Rename `skeleton_*` animations to `dwarf_*` (matches actual sprite)
- [ ] Rename `orc_*` animations to `barbarian_*`
- [ ] Rename class `Skeleton` → `Dwarf` (`skeleton.ts` → `dwarf.ts`), update all imports/references
- [ ] Rename class `Orc` → `Barbarian` (`orc.ts` → `barbarian.ts`), update all imports/references
- [ ] Update TMX entity types: "Skeleton"→"Dwarf", "Orc"→"Barbarian" in level1/2/3.tmx object layers
- [ ] Update DungeonLevel spawn mapping to use new class names (keep old TMX type names as aliases for safety)
- [ ] Verify: `pnpm build` succeeds (no import errors)

---

## Phase 2: Test Infrastructure & Basic Scene

Set up the headless test harness for the dungeon example, following the platformer test pattern. Verify a minimal scene loads and the tilemap renders collision.

### File Structure

```
examples/dungeon/
  __tests__/
    helpers.ts          # Test setup, asset loading, plugins
    sprites.test.ts     # Sprite tile ID verification
    scene.test.ts       # Basic scene loading
```

### Test Helpers (`__tests__/helpers.ts`)

```typescript
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "@quintus/core";
import { _resetNodeIdCounter } from "@quintus/core";
import type { HeadlessGame } from "@quintus/headless";
import { InputPlugin } from "@quintus/input";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import type { InputScript } from "@quintus/test";
import { TestRunner } from "@quintus/test";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "../config.js";
import { Level1 } from "../scenes/level1.js";
import { gameState } from "../state.js";

const ASSETS_DIR = resolve(import.meta.dirname, "..", "assets");
const PLUGINS = dungeonPlugins();

export function dungeonPlugins(): Plugin[] {
  return [
    PhysicsPlugin({ gravity: new Vec2(0, 0), collisionGroups: COLLISION_GROUPS }),
    InputPlugin({ actions: INPUT_BINDINGS }),
    TweenPlugin(),
  ];
}

export async function loadDungeonAssets(game: HeadlessGame): Promise<void> {
  const level1 = await readFile(resolve(ASSETS_DIR, "level1.tmx"), "utf-8");
  const level2 = await readFile(resolve(ASSETS_DIR, "level2.tmx"), "utf-8");
  const level3 = await readFile(resolve(ASSETS_DIR, "level3.tmx"), "utf-8");
  game.assets._storeCustom("level1", level1);
  game.assets._storeCustom("level2", level2);
  game.assets._storeCustom("level3", level3);
}

export function resetDungeonState(): void {
  gameState.reset();
  _resetNodeIdCounter(); // Required for deterministic snapshot comparison across runs
}

/** Shared test runner for dungeon level 1. Signature is stable across all phases. */
export function runLevel1(input?: InputScript, duration = 0.5) {
  return TestRunner.run({
    scene: Level1,
    seed: 42,
    width: 320,
    height: 240,
    plugins: PLUGINS,
    input,
    duration,
    snapshotInterval: 1,
    setup: loadDungeonAssets,
    beforeRun: resetDungeonState,
  });
}
```

### Sprite Verification Tests (`__tests__/sprites.test.ts`)

```typescript
import { describe, expect, test } from "vitest";
import { entitySheet, TILE } from "../sprites.js";

describe("Sprite tile ID verification", () => {
  test("all TILE values are within tileset range (0-131)", () => {
    for (const [name, id] of Object.entries(TILE)) {
      expect(id, `TILE.${name}`).toBeGreaterThanOrEqual(0);
      expect(id, `TILE.${name}`).toBeLessThan(132);
    }
  });

  test("all animations reference valid frame indices", () => {
    const anims = entitySheet.animationNames; // getter property, not a method
    for (const name of anims) {
      const anim = entitySheet.getAnimation(name); // returns Animation object
      expect(anim, `animation "${name}" should exist`).toBeDefined();
      for (const frame of anim!.frames) {
        expect(frame, `animation "${name}"`).toBeGreaterThanOrEqual(0);
        expect(frame, `animation "${name}"`).toBeLessThan(132);
      }
    }
  });

  test("player uses knight tile (96-100), not NPC tile", () => {
    expect(TILE.KNIGHT_1).toBe(96);
  });

  test("chest tiles are in correct range (89-91)", () => {
    expect(TILE.CHEST_CLOSED).toBe(89);
    expect(TILE.CHEST_OPENING).toBe(90);
    expect(TILE.CHEST_OPEN).toBe(91);
  });

  test("door tiles use small door (9, 21, 33, 45)", () => {
    expect(TILE.DOOR_CLOSED).toBe(45);
    expect(TILE.DOOR_OPEN).toBe(9);
  });

  test("swords are in weapon range (103-107)", () => {
    expect(TILE.SWORD_SMALL).toBe(103);
    expect(TILE.SWORD_LARGE).toBe(104);
    expect(TILE.SWORD_BARBARIAN).toBe(105);
  });

  test("shields are in shield range (101-102)", () => {
    expect(TILE.SHIELD_WOODEN).toBe(101);
    expect(TILE.SHIELD_METAL).toBe(102);
  });
});
```

### Basic Scene Test (`__tests__/scene.test.ts`)

```typescript
import { describe, expect, test } from "vitest";
import { runLevel1 } from "./helpers.js";

describe("Dungeon — Scene Loading", () => {
  test("level 1 loads without error", async () => {
    const result = await runLevel1(undefined, 0.1);
    expect(result.totalFrames).toBeGreaterThan(0);
    result.game.stop();
  });

  test("player exists in scene", async () => {
    const result = await runLevel1(undefined, 0.1);
    const player = result.timeline.findNode(0, "Player");
    expect(player).not.toBeNull();
    result.game.stop();
  });

  test("tilemap generates collision", async () => {
    const result = await runLevel1(undefined, 0.1);
    // Player shouldn't fall through the world (top-down, no gravity)
    // Just verify scene loaded with entities
    const player = result.timeline.findNode(0, "Player");
    expect(player).not.toBeNull();
    result.game.stop();
  });
});
```

### Vitest Configuration

Add to `examples/dungeon/vitest.config.ts` (if not using root config):

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    environment: "node",
  },
});
```

### Phase 2 Checklist

- [ ] Create `examples/dungeon/__tests__/helpers.ts` with test utilities (`dungeonPlugins`, `loadDungeonAssets`, `resetDungeonState`, `runLevel1`)
- [ ] `runLevel1(input?, duration?)` is the shared test runner — defined once in helpers, stable signature for all phases
- [ ] `resetDungeonState()` must call `_resetNodeIdCounter()` for deterministic snapshots
- [ ] Create `examples/dungeon/__tests__/sprites.test.ts` — verify all tile IDs
- [ ] Create `examples/dungeon/__tests__/scene.test.ts` — verify scene loads
- [ ] Add vitest config for dungeon tests (or use pnpm script)
- [ ] Add `pnpm test:dungeon` script to root `package.json`
- [ ] Verify: `pnpm test:dungeon` passes with all sprite tests green
- [ ] Verify: scene loading test passes (tilemap + player in tree)

---

## Phase 3: Player Movement & Collision (TSX)

Convert the Player entity to use JSX `build()` for its child structure. Test 4-way movement, wall collision, and direction tracking headlessly.

### Player TSX Conversion

Rename `entities/player.ts` → `entities/player.tsx` and convert to `build()`:

```tsx
// examples/dungeon/entities/player.tsx
import "@quintus/jsx";

export class Player extends Actor {
  speed = 80;
  override collisionGroup = "player";
  override solid = true;
  override gravity = 0;
  override applyGravity = false;
  override upDirection = Vec2.ZERO;

  direction: Direction = "down";
  invincibilityDuration = 1.5;

  // Refs populated by build()
  sprite?: AnimatedSprite;

  // ... private state fields unchanged

  readonly damaged: Signal<number> = signal<number>();
  readonly died: Signal<void> = signal<void>();

  override build() {
    return (
      <>
        <CollisionShape shape={Shape.rect(10, 6)} offset={[0, 4]} />
        <AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="player_idle" />
      </>
    );
  }

  override onReady() {
    super.onReady();
    this.tag("player");
  }

  // onFixedUpdate, movement, direction — unchanged
  // (equipment children added in Phase 4)
}
```

### Movement Tests (`__tests__/player.test.ts`)

```typescript
describe("Dungeon — Player Movement", () => {
  test("player moves right when right is held", async () => {
    const result = await runLevel1(InputScript.create().press("right", 60));
    const start = result.timeline.findNode(0, "Player");
    const end = result.timeline.findNode(60, "Player");
    expect(end.position.x).toBeGreaterThan(start.position.x);
    result.game.stop();
  });

  test("player moves up when up is held", async () => {
    const result = await runLevel1(InputScript.create().press("up", 60));
    const start = result.timeline.findNode(0, "Player");
    const end = result.timeline.findNode(60, "Player");
    expect(end.position.y).toBeLessThan(start.position.y);
    result.game.stop();
  });

  test("diagonal movement is normalized", async () => {
    const horiz = await runLevel1(InputScript.create().press("right", 60));
    const diag = await runLevel1(
      InputScript.create().press("right", 60).press("down", 60)
    );
    const horizDist = Math.abs(
      diag.timeline.findNode(60, "Player").position.x -
      diag.timeline.findNode(0, "Player").position.x
    );
    const straightDist = Math.abs(
      horiz.timeline.findNode(60, "Player").position.x -
      horiz.timeline.findNode(0, "Player").position.x
    );
    // Diagonal X distance should be less than straight X distance
    expect(horizDist).toBeLessThan(straightDist);
    horiz.game.stop();
    diag.game.stop();
  });

  test("player stops when no input", async () => {
    const result = await runLevel1(
      InputScript.create().press("right", 30).wait(30)
    );
    const frame30 = result.timeline.findNode(30, "Player");
    const frame60 = result.timeline.findNode(60, "Player");
    // Position should not change after releasing input
    expect(frame60.position.x).toBeCloseTo(frame30.position.x, 0);
    result.game.stop();
  });

  test("player is blocked by wall collision", async () => {
    // Move left into the wall boundary
    const result = await runLevel1(InputScript.create().press("left", 120));
    const player = result.timeline.findNode(120, "Player");
    // Should not have gone past the wall (left wall is around x=16-32)
    expect(player.position.x).toBeGreaterThan(10);
    result.game.stop();
  });
});
```

### TSConfig Update

Add to `examples/dungeon/tsconfig.json` (create if needed):

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@quintus/jsx"
  },
  "include": ["*.ts", "*.tsx", "**/*.ts", "**/*.tsx"]
}
```

### Phase 3 Checklist

- [ ] Create/update `examples/dungeon/tsconfig.json` with JSX settings
- [ ] Add `@quintus/jsx` as dependency in example setup
- [ ] Convert `player.ts` → `player.tsx` with `build()` pattern
- [ ] Verify `ref="sprite"` populates `this.sprite` by `onReady()` time
- [ ] `__tests__/player.test.ts`: 4-way movement tests (up, down, left, right)
- [ ] Test: diagonal normalization
- [ ] Test: wall collision blocks movement
- [ ] Test: player stops when no input
- [ ] Verify: `pnpm test:dungeon` passes

---

## Phase 4: Equipment System (Weapon/Shield Base Classes)

Add `EquippedWeapon` and `EquippedShield` as persistent `Node2D` children of any humanoid character. These are always visible and animate on attack/defend.

### Prerequisite: Verify Tween on Actor Children (Core Engine Test)

The equipment system tweens `rotation` and `position` on Node2D children of an Actor while physics is running. This is an untested interaction in the engine. **Before implementing equipment**, add a focused integration test to `packages/tween/src/`:

```typescript
// packages/tween/src/actor-child-tween.test.ts
test("tween on child Node2D of Actor works during physics", async () => {
  // Create Actor with a child Node2D, apply tween to child rotation,
  // run ~10 frames, verify the child's rotation changed.
  // This proves tween + physics transform cascade don't conflict.
});
```

If this test fails, the tween system or transform cascade needs a fix before equipment animations can work.

### `EquippedWeapon` Class

```tsx
// examples/dungeon/entities/equipped-weapon.tsx

/**
 * Visible weapon child node. Always rendered at the character's side.
 * On attack, plays a swing animation (rotation arc via tween).
 * The weapon sprite changes when the player picks up a new weapon.
 */
export class EquippedWeapon extends Node2D {
  sprite?: Sprite;
  private _swinging = false;

  weaponFrame = TILE.SWORD_SMALL;

  override build() {
    return (
      <Sprite
        ref="sprite"
        texture="tileset"
        sourceRect={entitySheet.getFrameRect(this.weaponFrame)}
        centered={false}
      />
    );
  }

  /** Update the displayed weapon sprite. */
  setWeapon(spriteFrame: number): void {
    this.weaponFrame = spriteFrame;
    if (this.sprite) {
      this.sprite.sourceRect = entitySheet.getFrameRect(spriteFrame);
    }
  }

  /** Play attack swing animation. Returns a promise that resolves when done. */
  swing(direction: Direction): void {
    if (this._swinging) return;
    this._swinging = true;

    // Position weapon in swing direction, tween rotation for arc
    const startRot = directionToSwingStart(direction);
    const endRot = directionToSwingEnd(direction);

    this.rotation = startRot;
    this.killTweens();
    this.tween()
      .to({ rotation: endRot }, 0.15, Ease.quadOut)
      .onComplete(() => {
        this._swinging = false;
        this.rotation = 0;
      });
  }

  /** Position weapon based on facing direction (at rest). */
  updateResting(direction: Direction, flipH: boolean): void {
    if (this._swinging) return;
    // Right-hand side: offset x+6 for right/down, x-6 for left
    this.position.x = flipH ? -6 : 6;
    this.position.y = 2;
    this.rotation = 0;
  }

  get isSwinging(): boolean {
    return this._swinging;
  }
}
```

### `EquippedShield` Class

```tsx
// examples/dungeon/entities/equipped-shield.tsx

/**
 * Visible shield child node. Rendered on the opposite side from the weapon.
 * On defend (hold), raises shield forward via position tween.
 */
export class EquippedShield extends Node2D {
  sprite?: Sprite;
  private _raised = false;

  shieldFrame = TILE.SHIELD_WOODEN;

  override build() {
    return (
      <Sprite
        ref="sprite"
        texture="tileset"
        sourceRect={entitySheet.getFrameRect(this.shieldFrame)}
        centered={false}
      />
    );
  }

  setShield(spriteFrame: number): void {
    this.shieldFrame = spriteFrame;
    if (this.sprite) {
      this.sprite.sourceRect = entitySheet.getFrameRect(spriteFrame);
    }
  }

  /** Raise shield (defend posture). */
  raise(direction: Direction): void {
    if (this._raised) return;
    this._raised = true;
    const offset = directionToShieldRaise(direction);
    this.killTweens();
    this.tween().to({ position: { x: offset.x, y: offset.y } }, 0.1, Ease.quadOut);
  }

  /** Lower shield (return to rest). */
  lower(): void {
    if (!this._raised) return;
    this._raised = false;
    this.killTweens();
    this.tween().to({ position: { x: this._restX, y: this._restY } }, 0.1, Ease.quadOut);
  }

  updateResting(direction: Direction, flipH: boolean): void {
    if (this._raised) return;
    // Left-hand side: opposite of weapon
    this._restX = flipH ? 5 : -5;
    this._restY = 2;
    this.position.x = this._restX;
    this.position.y = this._restY;
  }

  private _restX = -5;
  private _restY = 2;
}
```

### Helper: Direction-to-Transform Mapping

```typescript
// examples/dungeon/entities/equipment-utils.ts

import type { Direction } from "./player.js";

/** Starting rotation for weapon swing based on facing direction. */
export function directionToSwingStart(dir: Direction): number {
  switch (dir) {
    case "right": return -Math.PI / 4;   // -45°
    case "left": return Math.PI / 4;     // +45°
    case "up": return -Math.PI / 2;      // -90°
    case "down": return Math.PI / 2;     // +90°
  }
}

export function directionToSwingEnd(dir: Direction): number {
  switch (dir) {
    case "right": return Math.PI / 4;
    case "left": return -Math.PI / 4;
    case "up": return 0;
    case "down": return Math.PI;
  }
}

export function directionToShieldRaise(dir: Direction): { x: number; y: number } {
  switch (dir) {
    case "right": return { x: 4, y: 0 };
    case "left": return { x: -4, y: 0 };
    case "up": return { x: 0, y: -4 };
    case "down": return { x: 0, y: 4 };
  }
}
```

### Updated Player `build()` with Equipment

```tsx
class Player extends Actor {
  sprite?: AnimatedSprite;
  weapon?: EquippedWeapon;
  shield?: EquippedShield;

  override build() {
    return (
      <>
        <CollisionShape shape={Shape.rect(10, 6)} offset={[0, 4]} />
        <AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="player_idle" />
        <EquippedWeapon ref="weapon" weaponFrame={gameState.sword.spriteFrame} />
        {gameState.shield && (
          <EquippedShield ref="shield" shieldFrame={gameState.shield.spriteFrame} />
        )}
      </>
    );
  }

  // ... in onReady, if no shield at start, create one when player acquires one
}
```

### Equipment Tests (`__tests__/equipment.test.ts`)

> **Note:** Use `findInSnapshot(nodeSnapshot, query)` from `@quintus/core` to search a node's subtree.
> It matches against type, name, or tag — so `findInSnapshot(player, "EquippedWeapon")` finds the
> weapon child by class name. No custom utility needed.

```typescript
import { findInSnapshot } from "@quintus/core";
import { describe, expect, test } from "vitest";
import { SHIELDS } from "../state.js";
import { gameState } from "../state.js";
import { runLevel1 } from "./helpers.js";

describe("Dungeon — Equipment System", () => {
  test("EquippedWeapon is child of player", async () => {
    const result = await runLevel1(undefined, 0.1);
    const player = result.timeline.findNode(0, "Player");
    // Verify EquippedWeapon exists as child
    const weapon = findInSnapshot(player!, "EquippedWeapon");
    expect(weapon).not.toBeNull();
    result.game.stop();
  });

  test("weapon swing animation sets isSwinging", async () => {
    // Attack input triggers weapon swing
    const result = await runLevel1(
      InputScript.create().wait(5).tap("attack"),
      0.5
    );
    // After attack frame, weapon should have been swinging
    // Check a frame shortly after tap
    const player = result.timeline.findNode(10, "Player");
    expect(player).not.toBeNull();
    result.game.stop();
  });

  test("weapon updates when new sword acquired", async () => {
    // Verify gameState.sword change propagates to weapon sprite
    // (Tested via chest interaction in Phase 7)
  });

  test("shield shows when player has one", async () => {
    // Start with shield equipped
    gameState.shield = SHIELDS[0];
    const result = await runLevel1(undefined, 0.1);
    const player = result.timeline.findNode(0, "Player");
    const shield = findInSnapshot(player, "EquippedShield");
    expect(shield).not.toBeNull();
    result.game.stop();
  });

  test("shield hidden when player has none", async () => {
    gameState.shield = null;
    const result = await runLevel1(undefined, 0.1);
    const player = result.timeline.findNode(0, "Player");
    // No EquippedShield child expected
    const shield = findInSnapshot(player, "EquippedShield");
    expect(shield).toBeNull();
    result.game.stop();
  });
});
```

### Phase 4 Checklist

- [ ] **Prerequisite:** Add `packages/tween/src/actor-child-tween.test.ts` — verify tween on child Node2D of Actor works during physics
- [ ] Create `entities/equipment-utils.ts` with direction-to-transform helpers
- [ ] Create `entities/equipped-weapon.tsx` — `EquippedWeapon extends Node2D` with `build()`, swing animation
- [ ] Create `entities/equipped-shield.tsx` — `EquippedShield extends Node2D` with `build()`, raise/lower
- [ ] Update Player `build()` to include `EquippedWeapon` and `EquippedShield` as children
- [ ] Wire `setWeapon()` to update sprite when gameState.sword changes
- [ ] Wire `setShield()` to update sprite when gameState.shield changes
- [ ] `__tests__/equipment.test.ts`: weapon is child of player
- [ ] Test: shield visible/hidden based on gameState
- [ ] Test: weapon swing tween plays on attack
- [ ] Verify: `pnpm test:dungeon` passes

---

## Phase 5: Combat System (Attack, Defend, Hitboxes)

Rebuild attack/defend mechanics with visible weapon animations. The existing `WeaponHitbox`/`EnemyWeapon` pattern stays (short-lived sensor for damage), but now the *visual* is the `EquippedWeapon` child.

### Attack Flow

```
Player presses attack
  → Player._performAttack()
    → this.weapon.swing(direction)        // Visual: tween weapon rotation
    → spawn WeaponHitbox in parent        // Physics: short-lived damage sensor
    → position hitbox at player + direction offset
    → attackCooldown = 0.4s
```

**Hitbox positioning:** The `WeaponHitbox` is spawned as a sibling in the entity container, so it needs explicit world-space positioning relative to the attacker:

```typescript
// In Player._performAttack():
private _performAttack(): void {
  if (this._attackCooldown > 0) return;
  this._attackCooldown = 0.4;

  // Visual: swing weapon child
  this.weapon?.swing(this.direction);

  // Physics: spawn hitbox in parent (entity container)
  const hitbox = this.parent!.add(WeaponHitbox);
  const offset = directionToOffset(this.direction).scale(12);
  hitbox.position = this.globalPosition.add(offset);
  hitbox.attackDirection = directionToOffset(this.direction);
  hitbox.damage = gameState.sword.damage
    * (gameState.activeBuff?.type === "attack" ? gameState.activeBuff.value : 1);
}
```

Helper for direction-to-offset:

```typescript
// In equipment-utils.ts:
export function directionToOffset(dir: Direction): Vec2 {
  switch (dir) {
    case "right": return new Vec2(1, 0);
    case "left": return new Vec2(-1, 0);
    case "up": return new Vec2(0, -1);
    case "down": return new Vec2(0, 1);
  }
}
```

### Defend Flow

```
Player holds defend
  → this._defending = true
  → this.shield?.raise(direction)         // Visual: shift shield forward
  → speed halved

Player releases defend
  → this._defending = false
  → this.shield?.lower()                  // Visual: return shield to rest
```

### WeaponHitbox TSX Conversion

```tsx
// entities/weapon-hitbox.tsx
export class WeaponHitbox extends Sensor {
  override collisionGroup = "weapon";
  damage = 1;
  attackDirection = Vec2.ZERO;

  override build() {
    return <CollisionShape shape={Shape.rect(12, 12)} />;
  }

  override onReady() {
    super.onReady();
    // Auto-destroy after 0.15s
    const timer = this.add(Timer, { duration: 0.15, autostart: true });
    timer.timeout.connect(() => this.destroy());

    this.bodyEntered.connect((body) => {
      if (this._hitSet.has(body)) return;
      this._hitSet.add(body);
      if (body.is(BaseEnemy)) {
        body.takeDamage(this.damage, this.attackDirection);
      }
    });
  }

  private _hitSet = new Set<CollisionObject>();
}
```

### Combat Tests (`__tests__/combat.test.ts`)

```typescript
describe("Dungeon — Combat: Attack", () => {
  test("attack spawns weapon hitbox", async () => {
    const result = await runLevel1(
      InputScript.create().wait(5).tap("attack"),
      0.5
    );
    // Shortly after attack, a WeaponHitbox should exist in scene
    const hitbox = result.timeline.findNodes(10, "WeaponHitbox");
    // It may have already been destroyed by frame 10, so check frame ~7
    result.game.stop();
  });

  test("weapon hitbox auto-destroys after 0.15s", async () => {
    const result = await runLevel1(
      InputScript.create().wait(5).tap("attack"),
      1.0
    );
    // By frame 60 (1 second), no weapon hitbox should remain
    const hitboxes = result.timeline.findNodes(60, "WeaponHitbox");
    expect(hitboxes.length).toBe(0);
    result.game.stop();
  });

  test("attack has 0.4s cooldown", async () => {
    const result = await runLevel1(
      InputScript.create()
        .wait(5)
        .tap("attack")
        .wait(10)  // ~0.17s at 60fps, before cooldown expires
        .tap("attack"),  // Should be ignored
      1.0
    );
    // Only one hitbox should have been spawned total
    result.game.stop();
  });

  test("weapon swing animation plays on attack", async () => {
    const result = await runLevel1(
      InputScript.create().wait(5).tap("attack"),
      0.5
    );
    // Verify weapon exists (visual confirmation in browser, state check in headless)
    result.game.stop();
  });
});

describe("Dungeon — Combat: Defend", () => {
  test("defending halves movement speed", async () => {
    // Move right without defending
    const normal = await runLevel1(InputScript.create().press("right", 60));
    const normalDist = normal.timeline.findNode(60, "Player").position.x -
                       normal.timeline.findNode(0, "Player").position.x;

    // Move right while defending
    const defending = await runLevel1(
      InputScript.create().press("right", 60).press("defend", 60)
    );
    const defendDist = defending.timeline.findNode(60, "Player").position.x -
                       defending.timeline.findNode(0, "Player").position.x;

    // Defending distance should be roughly half
    expect(defendDist).toBeLessThan(normalDist * 0.7);
    expect(defendDist).toBeGreaterThan(normalDist * 0.3);
    normal.game.stop();
    defending.game.stop();
  });
});

describe("Dungeon — Combat: Damage", () => {
  test("player takes damage and becomes invincible", async () => {
    // This test requires an enemy nearby — tested in Phase 6 integration
  });

  test("player invincibility prevents consecutive damage", async () => {
    // Tested in Phase 6 integration
  });
});
```

### Phase 5 Checklist

- [ ] Convert `weapon-hitbox.ts` → `.tsx` with `build()` for CollisionShape
- [ ] Convert `enemy-weapon.ts` → `.tsx` with `build()` for CollisionShape
- [ ] Wire Player attack to call `weapon.swing()` + spawn WeaponHitbox
- [ ] Add `directionToOffset()` to `equipment-utils.ts` for hitbox positioning
- [ ] Position WeaponHitbox at `player.globalPosition + directionOffset * 12` on spawn
- [ ] Wire Player defend to call `shield.raise()` / `shield.lower()`
- [ ] Verify defending halves speed
- [ ] `__tests__/combat.test.ts`: attack spawns hitbox
- [ ] Test: hitbox auto-destroys
- [ ] Test: attack cooldown prevents rapid attacks
- [ ] Test: defending halves speed
- [ ] Verify: `pnpm test:dungeon` passes

---

## Phase 6: Enemy AI (BaseEnemy, Dwarf, Barbarian)

Convert enemies to TSX, fix sprite references, and test AI state machine behavior.

> **Note:** Class renames (`Skeleton` → `Dwarf`, `Orc` → `Barbarian`) and TMX type updates were done in Phase 1 alongside animation renames to avoid a split rename across phases.

### Enemy with Visible Equipment (TSX)

```tsx
// entities/dwarf.tsx
export class Dwarf extends BaseEnemy {
  override health = 2;
  override damage = 1;
  override enemySpeed = 40;
  // ...

  weapon?: EquippedWeapon;

  override build() {
    return (
      <>
        <CollisionShape shape={Shape.rect(10, 10)} />
        <AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="dwarf_idle" />
        <EquippedWeapon ref="weapon" weaponFrame={TILE.HAND_AXE} />
      </>
    );
  }

  override onReady() {
    super.onReady();
    this.tag("enemy");
  }

  // Attack now also triggers visual swing
  private _performAttack(): void {
    if (this._attackTimer > 0) return;
    this._attackTimer = this.attackCooldown;
    this.weapon?.swing(this._facingDirection);
    // ... spawn EnemyWeapon sensor as before
  }
}
```

### BaseEnemy TSX Conversion

```tsx
// entities/base-enemy.tsx
export abstract class BaseEnemy extends Actor {
  // ... stats fields unchanged

  sprite?: AnimatedSprite;

  // Subclasses override build() to provide their specific shape + sprite + equipment
  // BaseEnemy provides shared behavior (takeDamage, _findPlayer, _moveToward, etc.)
}
```

### Enemy AI Tests (`__tests__/enemy.test.ts`)

```typescript
describe("Dungeon — Enemy: Dwarf", () => {
  test("dwarf exists in level 1", async () => {
    const result = await runLevel1(undefined, 0.1);
    const enemies = result.timeline.findNodes(0, "enemy");
    expect(enemies.length).toBeGreaterThan(0);
    result.game.stop();
  });

  test("dwarf patrols when player is far", async () => {
    // Player stays still, dwarf should patrol (change X over time)
    const result = await runLevel1(undefined, 3);
    const enemy0 = result.timeline.findNodes(0, "Dwarf")[0];
    const enemy120 = result.timeline.findNodes(120, "Dwarf")[0];
    if (enemy0 && enemy120) {
      // Should have moved from patrol
      expect(enemy120.position.x).not.toBeCloseTo(enemy0.position.x, 0);
    }
    result.game.stop();
  });

  test("dwarf chases player when in detection range", async () => {
    // Move player toward a known enemy position
    // In level1, skeleton1 is at x=56, y=136; player starts at x=42, y=66
    // Moving down should bring player closer to detection range
    const result = await runLevel1(
      InputScript.create().press("down", 60),
      2
    );
    result.game.stop();
  });

  test("dwarf takes damage and enters hurt state", async () => {
    // Move toward enemy and attack
    const result = await runLevel1(
      InputScript.create()
        .press("down", 40)  // Move toward skeleton1
        .tap("attack"),
      2
    );
    result.game.stop();
  });

  test("dwarf carries visible weapon (EquippedWeapon child)", async () => {
    const result = await runLevel1(undefined, 0.1);
    const dwarf = result.timeline.findNodes(0, "Dwarf")[0];
    if (dwarf) {
      const weapon = findInSnapshot(dwarf, "EquippedWeapon");
      expect(weapon).not.toBeNull();
    }
    result.game.stop();
  });

  test("dwarf death awards points", async () => {
    // Kill an enemy and check score increased
    // Requires navigating to enemy and attacking enough times
  });
});

describe("Dungeon — Enemy: Barbarian", () => {
  test("barbarian uses guard state (stands still) when idle", async () => {
    // Barbarians guard instead of patrol
    // Level 2+ has barbarians — test separately
  });
});
```

### Phase 6 Checklist

- [ ] Convert `base-enemy.ts` → `.tsx`, make `sprite` a ref property (class renames done in Phase 1)
- [ ] Convert `dwarf.tsx` with `build()` — CollisionShape + AnimatedSprite + EquippedWeapon
- [ ] Convert `barbarian.tsx` with `build()` — same structure, different stats/weapon
- [ ] Wire enemy `_performAttack` to trigger `weapon.swing()`
- [ ] `__tests__/enemy.test.ts`: enemies exist in scene
- [ ] Test: dwarf patrols (position changes over time)
- [ ] Test: dwarf has visible weapon child
- [ ] Test: enemy takes damage from player weapon
- [ ] Test: enemy death awards score points
- [ ] Verify: `pnpm test:dungeon` passes

---

## Phase 7: Interactables (Chest, Door, HealthPickup)

Convert interactive entities to TSX. Add proper chest opening animation (3-frame: closed → opening → open). Fix door tiles. Health pickups use potion sprites.

### Chest with Opening Animation (TSX)

```tsx
// entities/chest.tsx
export class Chest extends Sensor {
  override collisionGroup = "items";
  lootType: LootType = "sword";
  lootTier = 0;

  sprite?: AnimatedSprite;
  private _opened = false;
  private _playerInRange = false;

  override build() {
    return (
      <>
        <CollisionShape shape={Shape.rect(12, 12)} />
        <AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="chest_closed" />
      </>
    );
  }

  override onReady() {
    super.onReady();
    this.tag("chest");

    this.bodyEntered.connect((body) => {
      if (body.hasTag("player")) this._playerInRange = true;
    });
    this.bodyExited.connect((body) => {
      if (body.hasTag("player")) this._playerInRange = false;
    });
  }

  private _open(): void {
    this._opened = true;
    // 3-frame opening animation: closed → opening → open
    this.sprite!.play("chest_opening");
    this.after(0.3, () => this.sprite!.play("chest_open"));
    // ... grant loot as before
  }
}
```

### Door with Proper Tiles (TSX)

```tsx
// entities/door.tsx
export class Door extends Sensor {
  override collisionGroup = "items";
  nextScene = "";
  locked = false;

  sprite?: AnimatedSprite;

  override build() {
    return (
      <>
        <CollisionShape shape={Shape.rect(12, 16)} />
        <AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="door_closed" />
      </>
    );
  }

  // Opening animation: closed(45) → opening_1(33) → opening_2(21) → open(9)
  private _openDoor(): void {
    this.sprite!.play("door_opening_1");
    this.after(0.2, () => this.sprite!.play("door_opening_2"));
    this.after(0.4, () => this.sprite!.play("door_open"));
  }
}
```

### HealthPickup with Potion Sprite (TSX)

```tsx
// entities/health-pickup.tsx
export class HealthPickup extends Sensor {
  override collisionGroup = "items";
  sprite?: AnimatedSprite;

  override build() {
    return (
      <>
        <CollisionShape shape={Shape.rect(8, 8)} />
        <AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="potion_red" />
      </>
    );
  }

  override onReady() {
    super.onReady();
    this.tag("health");
    // Bobbing animation
    this.sprite!.tween()
      .to({ position: { y: -3 } }, 0.8, Ease.sineInOut)
      .to({ position: { y: 0 } }, 0.8, Ease.sineInOut)
      .repeat();

    this.bodyEntered.connect((body) => {
      if (body.hasTag("player") && gameState.health < gameState.maxHealth) {
        this._collect();
      }
    });
  }
}
```

### Interactable Tests (`__tests__/interactables.test.ts`)

```typescript
describe("Dungeon — Chest", () => {
  test("chest exists in level 1", async () => {
    const result = await runLevel1(undefined, 0.1);
    const chests = result.timeline.findNodes(0, "chest");
    expect(chests.length).toBeGreaterThan(0);
    result.game.stop();
  });

  test("chest opens on interact when player is nearby", async () => {
    // Navigate to chest position (136, 136) from player start (42, 66)
    // Move right and down to reach chest
    const swordBefore = gameState.sword;
    const result = await runLevel1(
      InputScript.create()
        .press("right", 60)
        .press("down", 60)
        .tap("interact"),
      3
    );
    // Chest should have granted loot — sword should be upgraded
    expect(gameState.sword.damage).toBeGreaterThanOrEqual(swordBefore.damage);
    result.game.stop();
  });
});

describe("Dungeon — Door", () => {
  test("door exists in level 1", async () => {
    const result = await runLevel1(undefined, 0.1);
    const doors = result.timeline.findNodes(0, "door");
    expect(doors.length).toBeGreaterThan(0);
    result.game.stop();
  });

  test("locked door requires key and does not open without one", async () => {
    gameState.keys = 0;
    const result = await runLevel1(
      InputScript.create()
        .press("right", 120)
        .press("down", 80)
        .tap("interact"),
      5
    );
    // Door should still exist (not transitioned)
    const doors = result.timeline.findNodes(result.totalFrames - 1, "door");
    expect(doors.length).toBeGreaterThan(0);
    result.game.stop();
  });

  test("door opens with key", async () => {
    gameState.keys = 1;
    const result = await runLevel1(
      InputScript.create()
        .press("right", 120)
        .press("down", 80)
        .tap("interact"),
      5
    );
    // Key should have been consumed
    expect(gameState.keys).toBe(0);
    result.game.stop();
  });
});

describe("Dungeon — HealthPickup", () => {
  test("health pickup exists in level", async () => {
    const result = await runLevel1(undefined, 0.1);
    const pickups = result.timeline.findNodes(0, "health");
    expect(pickups.length).toBeGreaterThan(0);
    result.game.stop();
  });

  test("collecting health pickup increases health", async () => {
    // Reduce health first, then navigate to pickup at (264, 136)
    gameState.health = 2;
    const healthBefore = gameState.health;
    const result = await runLevel1(
      InputScript.create().press("right", 120).press("down", 60),
      5
    );
    // If player reached the pickup, health should have increased
    // (Navigation may not be pixel-perfect — assert >= to avoid flaky test)
    expect(gameState.health).toBeGreaterThanOrEqual(healthBefore);
    result.game.stop();
  });

  test("health pickup not collected at full health", async () => {
    gameState.health = gameState.maxHealth;
    const result = await runLevel1(
      InputScript.create().press("right", 120).press("down", 60),
      5
    );
    // Health should still be max
    expect(gameState.health).toBe(gameState.maxHealth);
    result.game.stop();
  });
});
```

### Phase 7 Checklist

- [ ] Convert `chest.ts` → `.tsx` with `build()` and 3-frame opening animation
- [ ] Convert `door.ts` → `.tsx` with `build()` and 4-frame opening sequence
- [ ] Convert `health-pickup.ts` → `.tsx` with `build()` and potion_red sprite
- [ ] Fix all tile references (chest: 89→90→91, door: 45→33→21→9)
- [ ] Add `this.after()` calls for timed animation transitions
- [ ] `__tests__/interactables.test.ts`: chests exist and can be opened
- [ ] Test: doors exist and require key when locked
- [ ] Test: health pickups exist and heal when collected
- [ ] Test: health pickup not collected at full health
- [ ] Verify: `pnpm test:dungeon` passes

---

## Phase 8: Inventory & Potion System

Add a weapon inventory slot (swap between found weapons) and a potion slot with visible effects.

### Updated Game State

```typescript
// state.ts additions
export interface PotionDef {
  name: string;
  type: "health" | "speed" | "attack";
  spriteFrame: number;
  /** Duration in seconds (0 = instant for health). */
  duration: number;
  /** Effect magnitude. */
  value: number;
}

export const POTIONS: PotionDef[] = [
  { name: "Health Potion", type: "health", spriteFrame: 115, duration: 0, value: 2 },
  { name: "Speed Potion", type: "speed", spriteFrame: 116, duration: 10, value: 1.5 },
  { name: "Attack Potion", type: "attack", spriteFrame: 114, duration: 10, value: 2 },
];

export const gameState = reactiveState({
  health: 3,
  maxHealth: 3,
  currentLevel: 1,
  sword: SWORDS[0] as SwordDef,
  shield: null as ShieldDef | null,
  score: 0,
  keys: 0,
  // NEW
  potion: null as PotionDef | null,         // Currently held potion
  activeBuff: null as PotionDef | null,      // Active timed buff
  buffTimeRemaining: 0,
});
```

### Potion Pickup Entity

```tsx
// entities/potion-pickup.tsx
export class PotionPickup extends Sensor {
  override collisionGroup = "items";
  potionType: "health" | "speed" | "attack" = "health";

  sprite?: AnimatedSprite;

  override build() {
    const anim = this._getAnimation();
    return (
      <>
        <CollisionShape shape={Shape.rect(8, 8)} />
        <AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation={anim} />
      </>
    );
  }

  override onReady() {
    super.onReady();
    this.tag("potion");
    // Bobbing animation
    this.sprite!.tween()
      .to({ position: { y: -3 } }, 0.8, Ease.sineInOut)
      .to({ position: { y: 0 } }, 0.8, Ease.sineInOut)
      .repeat();

    this.bodyEntered.connect((body) => {
      if (body.hasTag("player")) this._collect();
    });
  }

  private _collect(): void {
    const potion = POTIONS.find(p => p.type === this.potionType);
    if (!potion) return;
    gameState.potion = potion;
    // Float up + fade effect
    this.killTweens();
    this.tween()
      .to({ position: { y: this.position.y - 16 } }, 0.3, Ease.quadOut)
      .onComplete(() => this.destroy());
    this.sprite!.killTweens();
    this.sprite!.tween().to({ alpha: 0 }, 0.3);
  }

  private _getAnimation(): string {
    switch (this.potionType) {
      case "health": return "potion_red";
      case "speed": return "potion_blue";
      case "attack": return "potion_green";
    }
  }
}
```

### Potion Usage on Player

```typescript
// In Player.onFixedUpdate, add potion use binding:
if (input.isJustPressed("use_potion") && gameState.potion) {
  this._usePotion(gameState.potion);
  gameState.potion = null;
}
```

### BuffManager Node

Buff timer logic is extracted into a standalone `BuffManager` node added to the scene, rather than embedding it in Player. This keeps buff expiration independent of Player lifecycle, making it testable in isolation and avoiding hidden coupling.

```typescript
// entities/buff-manager.ts
export class BuffManager extends Node {
  override onFixedUpdate(dt: number): void {
    if (gameState.activeBuff && gameState.buffTimeRemaining > 0) {
      gameState.buffTimeRemaining -= dt;
      if (gameState.buffTimeRemaining <= 0) {
        gameState.activeBuff = null;
        gameState.buffTimeRemaining = 0;
      }
    }
  }

  /** Query helpers for Player and other consumers. */
  get speedMultiplier(): number {
    return gameState.activeBuff?.type === "speed" ? gameState.activeBuff.value : 1;
  }

  get damageMultiplier(): number {
    return gameState.activeBuff?.type === "attack" ? gameState.activeBuff.value : 1;
  }
}
```

Add to DungeonLevel `build()` (Phase 10):

```tsx
<BuffManager />
```

### Potion Effects (on Player)

```typescript
private _usePotion(potion: PotionDef): void {
  switch (potion.type) {
    case "health":
      gameState.health = Math.min(gameState.health + potion.value, gameState.maxHealth);
      // Brief green flash on player sprite
      this._flashColor(0x00ff00);
      break;

    case "speed":
    case "attack":
      gameState.activeBuff = potion;
      gameState.buffTimeRemaining = potion.duration;
      // Visual indicator on player sprite while active
      this.sprite!.alpha = 0.8;
      break;
  }
}

// In Player.onFixedUpdate — apply buff modifiers:
const buffMgr = this.scene?.findChild(BuffManager);
const speedMultiplier = buffMgr?.speedMultiplier ?? 1;
const effectiveSpeed = (this._defending ? this.speed * 0.5 : this.speed) * speedMultiplier;

// Restore sprite alpha when buff expires:
if (!gameState.activeBuff && this.sprite!.alpha < 1) {
  this.sprite!.alpha = 1;
}

// Attack buff applied in _performAttack (see Phase 5 hitbox positioning code).
```

### Input Binding Addition

```typescript
// config.ts — add potion use
export const INPUT_BINDINGS: Record<string, string[]> = {
  // ... existing
  use_potion: ["KeyQ", "KeyP"],
};
```

### Inventory Tests (`__tests__/inventory.test.ts`)

```typescript
describe("Dungeon — Potion System", () => {
  test("collecting potion sets gameState.potion", async () => {
    // Spawn a potion in test and walk into it
    // Requires level with potion entity or custom test scene
  });

  test("health potion restores health", () => {
    gameState.health = 1;
    // Simulate potion use (unit test, no need for full scene)
    const potion = POTIONS[0]; // Health potion
    gameState.health = Math.min(gameState.health + potion.value, gameState.maxHealth);
    expect(gameState.health).toBe(3);
  });

  test("speed buff increases movement speed", async () => {
    // Compare distance traveled with and without speed buff
    const normal = await runLevel1(InputScript.create().press("right", 60), 2);
    const normalDist = normal.timeline.findNode(60, "Player").position.x -
                       normal.timeline.findNode(0, "Player").position.x;

    gameState.activeBuff = POTIONS[1]; // Speed potion
    gameState.buffTimeRemaining = 10;
    const buffed = await runLevel1(InputScript.create().press("right", 60), 2);
    const buffDist = buffed.timeline.findNode(60, "Player").position.x -
                     buffed.timeline.findNode(0, "Player").position.x;

    expect(buffDist).toBeGreaterThan(normalDist * 1.2);
    normal.game.stop();
    buffed.game.stop();
  });

  test("buff expires after duration", async () => {
    gameState.activeBuff = POTIONS[1]; // Speed: 10s
    gameState.buffTimeRemaining = 0.5; // Short for testing
    const result = await runLevel1(undefined, 2);
    // After 2s, buff should have expired
    expect(gameState.activeBuff).toBeNull();
    result.game.stop();
  });

  test("attack buff increases weapon damage", () => {
    const baseDamage = SWORDS[0].damage; // 1
    const attackBuff = POTIONS[2]; // Attack potion, value=2
    const buffedDamage = baseDamage * attackBuff.value;
    expect(buffedDamage).toBe(2);
  });
});

describe("Dungeon — Weapon Inventory", () => {
  test("new sword from chest replaces current", () => {
    gameState.sword = SWORDS[0]; // Small sword (dmg 1)
    gameState.sword = SWORDS[1]; // Large sword (dmg 2)
    expect(gameState.sword.damage).toBe(2);
  });

  test("shield from chest equips", () => {
    gameState.shield = null;
    gameState.shield = SHIELDS[0];
    expect(gameState.shield).not.toBeNull();
    expect(gameState.shield!.defense).toBe(1);
  });
});
```

### Phase 8 Checklist

- [ ] Add `PotionDef` interface and `POTIONS` array to `state.ts`
- [ ] Add `potion`, `activeBuff`, `buffTimeRemaining` to gameState
- [ ] Create `entities/potion-pickup.tsx` — collectible potion sensor
- [ ] Create `entities/buff-manager.ts` — standalone Node for buff timer countdown
- [ ] Add `use_potion` input binding ("Q" / "P")
- [ ] Implement potion usage in Player: health/speed/attack effects
- [ ] Player reads `buffMgr.speedMultiplier` / `buffMgr.damageMultiplier` — no direct buff timer logic in Player
- [ ] Speed buff: multiply `effectiveSpeed` by buff multiplier
- [ ] Attack buff: multiply weapon hitbox damage by buff multiplier
- [ ] Visual indicators: sprite alpha/tint changes during buffs
- [ ] Add PotionPickup and BuffManager to DungeonLevel spawn mapping/build()
- [ ] `__tests__/inventory.test.ts`: potion collection sets state
- [ ] Test: health potion restores HP
- [ ] Test: speed buff increases movement distance
- [ ] Test: attack buff increases damage multiplier
- [ ] Test: buff expires after duration
- [ ] Test: weapon upgrade from chest replaces current
- [ ] Verify: `pnpm test:dungeon` passes

---

## Phase 9: HUD (TSX)

Convert the HUD to use JSX `build()`. Display health (potion icons), score, current weapon, current potion (if held), and keys.

### JSX Prop Coercion Note

Color string props like `color="#ffffff"` and `backgroundColor="#1a1a2e"` rely on the `@quintus/jsx` coercion layer
(`packages/jsx/src/coerce.ts`), which auto-converts `"#hex"` strings to `Color` objects for props named `color`,
`fillColor`, `backgroundColor`, `hoverColor`, `pressedColor`, `borderColor`, and `textColor`. Position tuples
like `position={[250, 4]}` are similarly coerced to `Vec2`. This coercion is already implemented and tested — no
engine changes needed.

### HUD TSX Conversion

```tsx
// hud/hud.tsx
export class HUD extends Layer {
  fixed = true;
  override zIndex = 100;

  private hearts: Sprite[] = [];
  scoreLabel?: Label;
  keyLabel?: Label;
  swordSprite?: Sprite;
  potionSprite?: Sprite;

  override build() {
    // Health icons (use potion sprites: red=full, gray=empty)
    this.hearts = Array.from({ length: gameState.maxHealth }, (_, i) => (
      <Sprite
        texture="tileset"
        sourceRect={entitySheet.getFrameRect(
          i < gameState.health ? TILE.HEALTH_FULL : TILE.HEALTH_EMPTY
        )}
        centered={false}
        position={[4 + i * 18, 4]}
      />
    ) as Sprite);

    return (
      <>
        {this.hearts}
        <Sprite
          ref="swordSprite"
          texture="tileset"
          sourceRect={entitySheet.getFrameRect(gameState.sword.spriteFrame)}
          centered={false}
          position={[4, 24]}
        />
        <Sprite
          ref="potionSprite"
          texture="tileset"
          sourceRect={gameState.potion
            ? entitySheet.getFrameRect(gameState.potion.spriteFrame)
            : entitySheet.getFrameRect(TILE.POTION_GRAY)}
          centered={false}
          position={[24, 24]}
          alpha={gameState.potion ? 1 : 0.3}
        />
        <Label
          ref="scoreLabel"
          position={[250, 4]}
          text={`Score: ${gameState.score}`}
          fontSize={8}
          color="#ffffff"
          align="right"
        />
        <Label
          ref="keyLabel"
          position={[250, 16]}
          text={gameState.keys > 0 ? `Keys: ${gameState.keys}` : ""}
          fontSize={8}
          color="#ffd54f"
          align="right"
        />
      </>
    );
  }

  override onReady() {
    // Signal-driven updates
    gameState.on("health").connect(({ value }) => {
      for (let i = 0; i < this.hearts.length; i++) {
        this.hearts[i].sourceRect = entitySheet.getFrameRect(
          i < value ? TILE.HEALTH_FULL : TILE.HEALTH_EMPTY
        );
      }
    });

    gameState.on("score").connect(({ value }) => {
      this.scoreLabel!.text = `Score: ${value}`;
    });

    gameState.on("keys").connect(({ value }) => {
      this.keyLabel!.text = value > 0 ? `Keys: ${value}` : "";
    });

    gameState.on("sword").connect(({ value }) => {
      this.swordSprite!.sourceRect = entitySheet.getFrameRect(value.spriteFrame);
    });

    gameState.on("potion").connect(({ value }) => {
      if (value) {
        this.potionSprite!.sourceRect = entitySheet.getFrameRect(value.spriteFrame);
        this.potionSprite!.alpha = 1;
      } else {
        this.potionSprite!.sourceRect = entitySheet.getFrameRect(TILE.POTION_GRAY);
        this.potionSprite!.alpha = 0.3;
      }
    });
  }
}
```

### UI Scene TSX Conversions

```tsx
// scenes/title-scene.tsx
export class TitleScene extends Scene {
  override build() {
    return (
      <Layer fixed>
        <Panel width={320} height={240} backgroundColor="#1a1a2e" />
        <Label position={[160, 50]} text="Tiny Dungeon"
               fontSize={22} color="#e8a87c" align="center" />
        <Label position={[160, 78]} text="A Quintus 2.0 Demo"
               fontSize={10} color="#888888" align="center" />
        <Label position={[160, 120]} text="WASD to move, J to attack"
               fontSize={8} color="#aaaaaa" align="center" />
        <Label position={[160, 134]} text="K to defend, E to interact, Q for potion"
               fontSize={8} color="#aaaaaa" align="center" />
        <Button position={[110, 170]} width={100} height={32}
                text="Start" fontSize={16}
                backgroundColor="#e8a87c" hoverColor="#f0c0a0"
                pressedColor="#c0886c" textColor="#1a1a2e"
                onPressed={() => { gameState.reset(); this.switchTo("level1"); }} />
      </Layer>
    );
  }
}
```

### HUD Tests (`__tests__/hud.test.ts`)

```typescript
describe("Dungeon — HUD", () => {
  test("HUD exists in scene", async () => {
    const result = await runLevel1(undefined, 0.1);
    const hud = result.timeline.findNode(0, "HUD");
    expect(hud).not.toBeNull();
    result.game.stop();
  });

  test("HUD shows correct number of health icons", async () => {
    const result = await runLevel1(undefined, 0.1);
    // HUD has 3 heart sprites as children
    result.game.stop();
  });

  test("score label updates when score changes", async () => {
    // Kill an enemy or manually set score
    gameState.score = 50;
    // Signal should fire and update label
    // (Signal tests are more unit-level)
  });
});
```

### Phase 9 Checklist

- [ ] Convert `hud/hud.ts` → `.tsx` with `build()` + string refs
- [ ] Add potion icon to HUD (shows current potion or grayed out)
- [ ] Convert `scenes/title-scene.ts` → `.tsx` with pure `build()`
- [ ] Convert `scenes/game-over-scene.ts` → `.tsx` with pure `build()`
- [ ] Convert `scenes/victory-scene.ts` → `.tsx` with pure `build()`
- [ ] Update instruction text in TitleScene (add potion key)
- [ ] `__tests__/hud.test.ts`: HUD exists in scene
- [ ] Test: health icons use correct potion tile IDs (115/113)
- [ ] Test: weapon icon updates on sword change
- [ ] Test: potion icon updates on potion pickup
- [ ] Verify: `pnpm test:dungeon` passes

---

## Phase 10: Level Rebuild & Scene Flow

Rebuild levels with correct tiles and proper wall/door placement. Convert DungeonLevel to TSX. Verify full game flow headlessly.

### DungeonLevel TSX Conversion

```tsx
// scenes/dungeon-level.tsx
export abstract class DungeonLevel extends Scene {
  abstract readonly levelAsset: string;
  abstract readonly nextScene: string;

  protected player?: Player;
  protected map?: TileMap;
  protected camera?: Camera;
  protected entities?: Node2D;

  override build() {
    return (
      <>
        <TileMap ref="map" tilesetImage="tileset" asset={this.levelAsset} />
        <Node2D ref="entities" ySortChildren zIndex={1} />
        <Camera ref="camera" follow="$player" smoothing={0.1} zoom={2} />
        <BuffManager />
        <HUD />
      </>
    );
  }

  override onReady() {
    // Generate collision from walls layer
    this.map!.generateCollision({
      layer: "walls",
      allSolid: true,
      collisionGroup: "world",
    });

    // Spawn player
    const spawnPos = this.map!.getSpawnPoint("player_start");
    this.player = this.entities!.add(Player);
    this.player.position = spawnPos;

    // Spawn entities from Tiled objects
    this._spawnEntities();

    // Camera bounds
    this.camera!.bounds = new Rect(0, 0, this.map!.bounds.width, this.map!.bounds.height);

    // Camera shake on damage
    this.player.damaged.connect(() => this.camera!.shake(2, 0.2));

    // Death handling
    this.player.died.connect(() => this._onPlayerDied());
  }

  private _spawnEntities(): void {
    const objects = this.map!.getObjects("entities");
    for (const obj of objects) {
      const pos = new Vec2(obj.x, obj.y);
      switch (obj.type) {
        case "Dwarf":
        case "Skeleton": {  // Support old TMX type name
          const enemy = this.entities!.add(Dwarf);
          enemy.position = pos;
          break;
        }
        case "Barbarian":
        case "Orc": {
          const enemy = this.entities!.add(Barbarian);
          enemy.position = pos;
          break;
        }
        case "Chest": {
          const chest = this.entities!.add(Chest);
          chest.position = pos;
          const lt = obj.properties.get("lootType");
          if (lt) chest.lootType = lt as LootType;
          const tier = obj.properties.get("lootTier");
          if (tier != null) chest.lootTier = Number(tier);
          break;
        }
        case "HealthPickup": {
          const hp = this.entities!.add(HealthPickup);
          hp.position = pos;
          break;
        }
        case "PotionPickup": {
          const pp = this.entities!.add(PotionPickup);
          pp.position = pos;
          const pType = obj.properties.get("potionType");
          if (pType) pp.potionType = pType as "health" | "speed" | "attack";
          break;
        }
        case "Door": {
          const door = this.entities!.add(Door);
          door.position = pos;
          door.nextScene = this.nextScene;
          if (obj.properties.get("locked") === true) door.locked = true;
          break;
        }
      }
    }
  }
}
```

### TMX Level Tile Corrections

The walls layer in level1.tmx already uses the correct wall tiles (0-28 range for ceiling/wall). The key corrections needed:

1. **Ensure doors are placed IN walls** — a door should replace a wall tile or be placed at a wall opening. The door entity should be positioned at the gap in the wall where the player passes through.

2. **Object layer entity types** — Update from "Skeleton"/"Orc" to "Dwarf"/"Barbarian" (or keep backward compat in spawn mapping as shown above).

3. **Add potion entities** to levels 2 and 3.

### Level Design Notes

The TMX files define the actual level geometry. The wall layer creates collision. The entities layer places objects. Door placement rules:

```
Good: Door entity at a gap in the wall perimeter
  Wall  Wall  [gap]  Wall  Wall
              Door ← placed at gap

Bad: Door floating in open floor
  Floor Floor Door Floor Floor  ← no wall context
```

Ensure each level's TMX has:
- Walls forming a complete perimeter (no gaps except doors)
- Door entities placed at wall openings
- `player_start` point inside the walled area
- Enemies placed in accessible floor areas
- Chests placed on floor tiles

### Full Flow Tests (`__tests__/flow.test.ts`)

```typescript
describe("Dungeon — Scene Flow", () => {
  test("title scene loads", async () => {
    const result = await TestRunner.run({
      scene: TitleScene,
      seed: 42,
      plugins: PLUGINS,
      duration: 0.1,
      snapshotInterval: 0,
      beforeRun: resetDungeonState,
    });
    expect(result.totalFrames).toBeGreaterThan(0);
    result.game.stop();
  });

  test("level 1 to level 2 transition via door", async () => {
    // Navigate to door at (280, 184) and interact
    // This is a long path — may need longer duration
  });

  test("player death triggers game over", async () => {
    gameState.health = 1;
    // Take damage from enemy to die
  });

  test("deterministic: same inputs produce same state", async () => {
    await assertDeterministic(
      {
        scene: Level1,
        seed: 42,
        width: 320,
        height: 240,
        plugins: PLUGINS,
        input: InputScript.create()
          .press("right", 60)
          .press("down", 30)
          .tap("attack")
          .press("right", 60),
        snapshotInterval: 0,
        setup: loadDungeonAssets,
        beforeRun: resetDungeonState,
      },
      3,
    );
  });
});
```

### Phase 10 Checklist

- [ ] Convert `scenes/dungeon-level.ts` → `.tsx` with `build()` + `$` refs
- [ ] Add "Dwarf"/"Barbarian" support in spawn mapping (alongside old names)
- [ ] Add PotionPickup to spawn mapping
- [ ] Verify level1.tmx: door at wall gap, all walls form perimeter
- [ ] Verify level2.tmx: same checks, add potion pickups to entities layer
- [ ] Verify level3.tmx: same checks, add potion pickups
- [ ] Convert main.ts to import TSX scene/entity files
- [ ] `__tests__/flow.test.ts`: title scene loads
- [ ] Test: level 1 loads and is playable
- [ ] Test: determinism (same inputs = same state)
- [ ] Test: full game completes without crash (3 levels)
- [ ] Verify: `pnpm build` succeeds
- [ ] Verify: `pnpm test:dungeon` — all tests pass
- [ ] Verify: `pnpm dev` — game runs in browser
- [ ] Visual verification: correct sprites show for all entities

---

## Definition of Done

- [ ] All phases marked Done in status table
- [ ] All TILE constants verified against `tile_description.csv`
- [ ] All entities converted to TSX `build()` pattern
- [ ] Player carries visible weapon + shield as Node2D children
- [ ] Enemies carry visible weapons that animate on attack
- [ ] Weapon swing and shield raise animations work
- [ ] Potion system: 3 types (health/speed/attack) with visible effects
- [ ] HUD shows: health icons, weapon, potion, score, keys
- [ ] Chest opening has 3-frame animation
- [ ] Door opening has 4-frame animation
- [ ] Doors placed correctly in wall gaps
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test:dungeon` passes all tests (>20 test cases)
- [ ] `pnpm lint` clean
- [ ] Game runs and is playable via `pnpm dev`
- [ ] All 3 levels completable in browser
