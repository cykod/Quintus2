# Phase 6: The `quintus` Meta-Package & First Complete Game — Detailed Design

> **Goal:** Bundle the "batteries included" meta-package and build the first complete example game (platformer) that exercises every Phase 1-5 system.
> **Duration:** ~1.5 weeks
> **Outcome:** A single `quintus` npm package re-exports all engine packages. A complete multi-file platformer game in `examples/platformer/` demonstrates every system working together: physics, sprites, input, tilemap, camera, audio, tweens, and UI. The game is well-organized, well-commented, and serves as integration test, API validation, and LLM documentation.

---

## Table of Contents

1. [Meta-Package: `quintus`](#1-meta-package-quintus)
   - [Package Configuration](#11-package-configuration)
   - [Export Strategy](#12-export-strategy)
   - [Side-Effect Imports](#13-side-effect-imports)
   - [Size Budget & Verification](#14-size-budget--verification)
   - [Tree-Shaking Guarantee](#15-tree-shaking-guarantee)
2. [Game Design: Complete Platformer](#2-game-design-complete-platformer)
   - [Game Specifications](#21-game-specifications)
   - [Scene Flow](#22-scene-flow)
   - [Persistent State](#23-persistent-state)
   - [Player](#24-player)
   - [Enemies](#25-enemies)
   - [Collectibles & Triggers](#26-collectibles--triggers)
   - [Level Design](#27-level-design)
   - [HUD](#28-hud)
   - [Audio](#29-audio)
   - [Death & Respawn](#210-death--respawn)
   - [Scene Transitions & Effects](#211-scene-transitions--effects)
3. [File Structure](#3-file-structure)
4. [Cross-Cutting Concerns](#4-cross-cutting-concerns)
   - [API Validation](#41-api-validation)
   - [LLM Readability](#42-llm-readability)
   - [Performance](#43-performance)
   - [Determinism](#44-determinism)
5. [Test Plan](#5-test-plan)
6. [Demo: What the Platformer Exercises](#6-demo-what-the-platformer-exercises)
7. [Definition of Done](#7-definition-of-done)
8. [Execution Order](#8-execution-order)

---

## 1. Meta-Package: `quintus`

The meta-package is a thin re-export layer that lets users import everything from a single package:

```typescript
import { Game, Actor, Vec2, Camera, TileMap, Label, Ease } from "quintus";
```

Instead of:

```typescript
import { Game } from "@quintus/core";
import { Actor } from "@quintus/physics";
import { Vec2 } from "@quintus/math";
import { Camera } from "@quintus/camera";
// ... 6 more imports
```

### 1.1 Package Configuration

**Directory:** `packages/quintus/` (NEW package — do NOT modify `packages/quintus-core/`)
**Published name:** `quintus` (not scoped)

> **Important:** The meta-package is a NEW directory. `packages/quintus-core/` remains `@quintus/core` — renaming it would break every other package's `workspace:*` dependency on `@quintus/core`.

Create `packages/quintus/package.json`:

```json
{
  "name": "quintus",
  "version": "2.0.0-alpha.1",
  "description": "A modern HTML5 game engine for the AI/LLM era",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "sideEffects": true,
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch"
  },
  "dependencies": {
    "@quintus/core": "workspace:*",
    "@quintus/math": "workspace:*",
    "@quintus/physics": "workspace:*",
    "@quintus/sprites": "workspace:*",
    "@quintus/input": "workspace:*",
    "@quintus/tilemap": "workspace:*",
    "@quintus/camera": "workspace:*",
    "@quintus/tween": "workspace:*",
    "@quintus/audio": "workspace:*",
    "@quintus/ui": "workspace:*"
  },
  "keywords": [
    "game-engine", "quintus", "html5", "2d", "canvas",
    "typescript", "game", "platformer", "physics"
  ],
  "license": "SEE LICENSE IN LICENSE.md",
  "repository": {
    "type": "git",
    "url": "https://github.com/cykod/Quintus",
    "directory": "packages/quintus"
  }
}
```

**Why `quintus` not `@quintus/quintus`?** The meta-package is the primary entry point. An unscoped name is shorter, memorable, and conventional for "batteries included" packages (e.g., `three`, `pixi.js`, `phaser`).

### 1.2 Export Strategy

All named exports from all 10 packages are re-exported via `export *`:

```typescript
// packages/quintus/src/index.ts

// === Foundation ===
export * from "@quintus/math";
export * from "@quintus/core";

// === Physics ===
export * from "@quintus/physics";

// === Rendering ===
export * from "@quintus/sprites";

// === Input ===
export * from "@quintus/input";

// === World ===
export * from "@quintus/tilemap";
export * from "@quintus/camera";

// === Juice ===
export * from "@quintus/tween";
export * from "@quintus/audio";
export * from "@quintus/ui";
```

**No naming conflicts exist.** All exported names across the 10 packages are unique. Verified by inspection:

| Package | Sample exports | No conflicts with |
|---------|---------------|-------------------|
| math | `Vec2`, `Matrix2D`, `Color`, `Rect`, `AABB`, `SeededRandom` | All |
| core | `Game`, `Node`, `Node2D`, `Scene`, `Signal`, `Canvas2DRenderer` | All |
| physics | `Actor`, `StaticCollider`, `Sensor`, `CollisionShape`, `Shape`, `PhysicsPlugin` | All |
| sprites | `Sprite`, `AnimatedSprite`, `SpriteSheet` | All |
| input | `Input`, `InputEvent`, `InputPlugin` | All |
| tilemap | `TileMap`, `parseTiledMap` | All |
| camera | `Camera` | All |
| tween | `Tween`, `Ease`, `TweenPlugin` | All |
| audio | `AudioPlayer`, `AudioPlugin`, `AudioSystem` | All |
| ui | `UINode`, `Label`, `Button`, `Container`, `ProgressBar`, `Panel`, `Layer` | All |

**If a conflict is discovered during implementation**, resolve by omitting the less-common name from `export *` and re-exporting it under an alias. But this is unlikely given the careful naming across packages.

### 1.3 Side-Effect Imports

Four packages use side-effect imports for module augmentation:

| Package | Side-Effect | What It Does |
|---------|-------------|--------------|
| `@quintus/physics` | `import "./augment.js"` | Adds `game.physics` accessor to Game prototype |
| `@quintus/input` | `import "./augment.js"` | Adds `game.input` accessor to Game prototype |
| `@quintus/tween` | `import "./augment.js"` | Adds `node.tween()` and `node.killTweens()` to Node prototype |
| `@quintus/audio` | `import "./augment.js"` | Adds `game.audio` accessor to Game prototype |

When the meta-package does `export * from "@quintus/tween"`, the ES module system executes the tween package's `index.ts` top-level code, which includes `import "./augment.js"`. This means **side effects execute automatically** when the meta-package is imported.

**However**, bundlers with aggressive tree-shaking may drop re-exports that aren't consumed by the downstream app. If only `Ease` is imported from `quintus`, a bundler might optimize away the `@quintus/tween` module execution.

**Mitigation:** The meta-package's `package.json` includes `"sideEffects": true`. This tells bundlers not to tree-shake away module executions. This is correct for the meta-package — users who import `quintus` want all augmentations active. Users who want tree-shaking import individual `@quintus/*` packages directly.

### 1.4 Size Budget & Verification

**Target:** Under 40KB gzipped for the full meta-package bundle.

Individual package budgets (from implementation plan):

| Package | Budget |
|---------|--------|
| `@quintus/core` | ~10KB |
| `@quintus/math` | ~3KB |
| `@quintus/physics` | ~10KB |
| `@quintus/sprites` | ~5KB |
| `@quintus/input` | ~4KB |
| `@quintus/tilemap` | ~5KB |
| `@quintus/camera` | ~3KB |
| `@quintus/tween` | ~3KB |
| `@quintus/audio` | ~3KB |
| `@quintus/ui` | ~5KB |
| **Total (raw sum)** | **~51KB** |
| **After dedup + compression** | **~35-40KB** |

The meta-package will be smaller than the raw sum because:
1. Shared dependencies (`@quintus/math`, `@quintus/core`) are only included once
2. gzip compresses similar code patterns well
3. TypeScript type information is stripped

**Verification script:** Add a `size` script to the root `package.json`:

```bash
# Build the meta-package, then measure
pnpm --filter quintus build
gzip -c packages/quintus/dist/index.js | wc -c
```

**CI check:** Add a size assertion to the CI pipeline that fails if the gzipped output exceeds 45KB (with 5KB headroom for edge cases).

### 1.5 Tree-Shaking Guarantee

Users who import individual packages (`@quintus/core`, `@quintus/physics`) must NOT pull in unrelated packages. This is guaranteed by the monorepo structure — each package has its own `package.json` with explicit dependencies.

**Verification:** After the meta-package ships, test that:

```typescript
// This import should NOT include tilemap, audio, ui, etc.
import { Game, Node2D } from "@quintus/core";
```

Verify via bundler output analysis (Vite's `rollup-plugin-visualizer` or `source-map-explorer`).

---

## 2. Game Design: Complete Platformer

The platformer serves four purposes:
1. **Integration test** — exercises every package working together
2. **API validation** — if the code is awkward, the API needs fixing
3. **Documentation** — the best documentation is a working example
4. **LLM benchmark** — can an LLM read this code and extend it?

### 2.1 Game Specifications

| Property | Value |
|----------|-------|
| Resolution | 320 × 240 pixels |
| Tile size | 8 × 8 pixels (Kenney Pico-8 tileset) |
| Tileset | 150 tiles, 15 columns × 10 rows, packed (no spacing) |
| Canvas zoom | 2× (renders at 640 × 480 CSS pixels) |
| Physics gravity | (0, 800) |
| Fixed timestep | 1/60s |
| Pixel art mode | Enabled (nearest-neighbor scaling) |
| RNG seed | 42 (deterministic) |

**Tileset:** Kenney Pico-8 Platformer (CC0 license, https://kenney.nl/assets/pico-8-platformer). 8×8 pixel tiles with an orange terrain theme, pink terrain variant, characters, enemies, items, and number tiles.

**Why 320×240?** Classic pixel-art resolution that looks crisp at 2× zoom. With 8×8 tiles, the viewable area is 40×30 tiles — large enough for detailed levels in the PICO-8 aesthetic.

### 2.2 Scene Flow

```
TitleScene ──[start]──► Level1 ──[exit]──► Level2 ──[exit]──► VictoryScene
                            │                   │
                            └───[death]──► GameOverScene ◄──[death]──┘
                                               │
                                          [retry] → Level1 or Level2
```

| Scene | Purpose | Key Features |
|-------|---------|--------------|
| `TitleScene` | Game start | Title text, "Start" button, background music |
| `Level1` | Tutorial level | Gentle introduction, few enemies, coins |
| `Level2` | Challenge level | More enemies, harder platforming, health pickups |
| `GameOverScene` | Death screen | "Game Over" text, final score, "Retry" button |
| `VictoryScene` | Win screen | "Victory!" text, final score, "Play Again" button |

Scene transitions use the existing `scene.switchTo(SceneClass)` API.

### 2.3 Persistent State

Game state persists across scene transitions via a module-level state object. This is simple, predictable, and easy for LLMs to understand.

```typescript
// examples/platformer/state.ts

export interface GameState {
  score: number;
  coins: number;
  health: number;
  maxHealth: number;
  currentLevel: number;
}

/** Mutable game state shared across scenes. */
export const gameState: GameState = {
  score: 0,
  coins: 0,
  health: 3,
  maxHealth: 3,
  currentLevel: 1,
};

/** Reset state for a new game. */
export function resetState(): void {
  gameState.score = 0;
  gameState.coins = 0;
  gameState.health = gameState.maxHealth;
  gameState.currentLevel = 1;
}
```

**Why module-level state, not a Game plugin?** A plugin would be more "proper" but adds complexity for a demo game. Module-level state is the most readable pattern and explicitly shows that state lives outside the scene tree. For a production game, users could upgrade to a proper state management approach.

### 2.4 Player

The player is an `Actor` with run, jump, and double-jump mechanics. Visual rendering uses colored shapes (no sprite art required).

```typescript
// examples/platformer/entities/player.ts

class Player extends Actor {
  // === Config ===
  speed = 120;
  jumpForce = -300;
  doubleJumpForce = -250;
  collisionGroup = "player";
  invincibilityDuration = 1.5; // seconds

  // === State ===
  private _canDoubleJump = false;
  private _invincible = false;
  private _invincibleTimer = 0;
  private _facing: "left" | "right" = "right";

  // === Signals ===
  readonly damaged: Signal<number> = signal<number>();   // emits remaining health
  readonly died: Signal<void> = signal<void>();

  onReady() {
    super.onReady();
    this.addChild(CollisionShape).shape = Shape.rect(12, 16);
    this.tag("player");
  }

  onFixedUpdate(dt: number) {
    const input = this.game!.input;

    // Horizontal movement
    this.velocity.x = 0;
    if (input.isPressed("left")) {
      this.velocity.x = -this.speed;
      this._facing = "left";
    }
    if (input.isPressed("right")) {
      this.velocity.x = this.speed;
      this._facing = "right";
    }

    // Jump + double-jump
    if (input.isJustPressed("jump")) {
      if (this.isOnFloor()) {
        this.velocity.y = this.jumpForce;
        this._canDoubleJump = true;
        this.game!.audio.play("jump", { bus: "sfx" });
      } else if (this._canDoubleJump) {
        this.velocity.y = this.doubleJumpForce;
        this._canDoubleJump = false;
        this.game!.audio.play("jump", { bus: "sfx", volume: 0.7 });
      }
    }

    // Reset double-jump on landing
    if (this.isOnFloor()) {
      this._canDoubleJump = false; // Reset; next jump from floor re-enables it
    }

    this.move(dt);

    // Invincibility timer
    if (this._invincible) {
      this._invincibleTimer -= dt;
      if (this._invincibleTimer <= 0) {
        this._invincible = false;
        this.alpha = 1;
      }
    }

    // Fall death
    if (this.position.y > 400) {
      gameState.health = 0;
      this.died.emit();
    }
  }

  takeDamage(): void {
    if (this._invincible) return;

    gameState.health--;
    this._invincible = true;
    this._invincibleTimer = this.invincibilityDuration;

    // Flash effect via tween (repeat(3) = 4 total cycles: 1 initial + 3 repeats)
    this.tween()
      .to({ alpha: 0.2 }, 0.1)
      .to({ alpha: 1 }, 0.1)
      .repeat(3);

    this.game!.audio.play("hit", { bus: "sfx" });
    this.damaged.emit(gameState.health);

    if (gameState.health <= 0) {
      this.died.emit();
    }
  }

  onDraw(ctx: DrawContext) {
    const flipX = this._facing === "left" ? -1 : 1;
    // Body
    ctx.rect(new Vec2(-6 * flipX, -8), new Vec2(12, 16), {
      fill: Color.fromHex("#4fc3f7"),
    });
    // Eyes
    ctx.rect(new Vec2(flipX * 1, -5), new Vec2(3, 3), {
      fill: Color.WHITE,
    });
  }
}
```

**Player states expressed visually:**

| State | Visual Cue |
|-------|------------|
| Idle | Static colored rectangle |
| Running | Facing direction flips |
| Jumping/falling | Same shape (future: squash/stretch via tween) |
| Hurt | Alpha blinks via tween |
| Invincible | Semi-transparent (alpha < 1) |

### 2.5 Enemies

Two enemy types demonstrate different movement patterns. Both die when jumped on from above and damage the player on side/bottom contact.

#### PatrolEnemy (Slime)

Walks back and forth along a platform. Reverses direction at edges or walls.

```typescript
// examples/platformer/entities/patrol-enemy.ts

class PatrolEnemy extends Actor {
  speed = 40;
  direction = 1; // 1 = right, -1 = left
  solid = true; // Player's move() will detect this as a physical obstacle
  collisionGroup = "enemies";

  readonly died: Signal<void> = signal<void>();

  onReady() {
    super.onReady();
    this.addChild(CollisionShape).shape = Shape.rect(14, 12);
    this.tag("enemy");
  }

  onFixedUpdate(dt: number) {
    this.velocity.x = this.speed * this.direction;

    // Reverse on wall
    if (this.isOnWall()) {
      this.direction *= -1;
    }

    this.move(dt);
  }

  /** Called by collision handler when player stomps from above. */
  stomp(): void {
    this.game!.audio.play("stomp", { bus: "sfx" });
    gameState.score += 100;

    // Squash + fade death animation
    this.killTweens();
    this.tween()
      .to({ scale: { x: 1.5, y: 0.3 } }, 0.15, Ease.quadOut)
      .parallel()
      .to({ alpha: 0 }, 0.15)
      .onComplete(() => this.destroy());

    this.died.emit();
  }

  onDraw(ctx: DrawContext) {
    ctx.rect(new Vec2(-7, -6), new Vec2(14, 12), {
      fill: Color.fromHex("#66bb6a"),
    });
    // Eyes
    const ex = this.direction > 0 ? 1 : -4;
    ctx.rect(new Vec2(ex, -4), new Vec2(2, 2), { fill: Color.WHITE });
  }
}
```

#### FlyingEnemy (Bat)

Moves in a sine wave pattern. Does not interact with gravity.

```typescript
// examples/platformer/entities/flying-enemy.ts

class FlyingEnemy extends Actor {
  speed = 50;
  amplitude = 30;     // Vertical oscillation amplitude
  frequency = 2;      // Oscillations per second
  direction = -1;     // -1 = left, 1 = right
  solid = true; // Player's move() will detect this as a physical obstacle
  collisionGroup = "enemies";

  private _time = 0;
  private _baseY = 0;

  readonly died: Signal<void> = signal<void>();

  onReady() {
    super.onReady();
    this.addChild(CollisionShape).shape = Shape.rect(16, 10);
    this.tag("enemy");
    this._baseY = this.position.y;
    this.applyGravity = false; // Immune to gravity (no gravityScale property; use applyGravity toggle)
  }

  onFixedUpdate(dt: number) {
    this._time += dt;
    this.velocity.x = this.speed * this.direction;
    // Drive vertical motion via velocity (derivative of sine), not direct position set,
    // so move() integrates position consistently and collision detection works.
    this.velocity.y = this.amplitude * this.frequency * Math.PI * 2
      * Math.cos(this._time * this.frequency * Math.PI * 2);

    // Reverse at horizontal boundaries (driven by level bounds or wall collision)
    if (this.isOnWall()) {
      this.direction *= -1;
    }

    this.move(dt);
  }

  stomp(): void {
    this.game!.audio.play("stomp", { bus: "sfx" });
    gameState.score += 200;

    this.killTweens();
    this.tween()
      .to({ scale: { y: 0 }, alpha: 0 }, 0.2, Ease.quadIn)
      .onComplete(() => this.destroy());

    this.died.emit();
  }

  onDraw(ctx: DrawContext) {
    // Body
    ctx.rect(new Vec2(-8, -5), new Vec2(16, 10), {
      fill: Color.fromHex("#ab47bc"),
    });
    // Wings (simple triangles approximated as small rects)
    const wingY = Math.sin(this._time * 10) * 2;
    ctx.rect(new Vec2(-10, -7 + wingY), new Vec2(4, 4), {
      fill: Color.fromHex("#ce93d8"),
    });
    ctx.rect(new Vec2(6, -7 + wingY), new Vec2(4, 4), {
      fill: Color.fromHex("#ce93d8"),
    });
  }
}
```

#### Enemy-Player Collision Handling

Enemy collision is handled in the level scene setup, not inside individual enemy classes. This keeps the collision logic centralized and easy to modify.

Enemies are marked `solid = true`, so the player's `move()` physically collides with them. The `onContact()` API (from FIX_COLLISION_DESIGN.md, now implemented) fires callbacks with `CollisionInfo` including the contact normal:

```typescript
// In the Level scene's onReady(), after spawning enemies:
this.game!.physics.onContact("player", "enemies", (player, enemy, info) => {
  const p = player as Player;
  const e = enemy as PatrolEnemy | FlyingEnemy;

  // Normal points into the player. y < 0 means player landed on enemy from above.
  if (info.normal.y < 0) {
    e.stomp();
    p.velocity.y = -200; // Bounce up after stomp
  } else {
    // Side or bottom contact — enemy damages player
    p.takeDamage();
  }
});
```

**How it works:** Enemies set `solid = true`, so `castMotion()` treats them as physical obstacles. When the player's `move()` slides against a solid enemy, the `collided` signal fires with a `CollisionInfo` containing the contact normal. `onContact()` matches by collision group and invokes the callback. See `FIX_COLLISION_DESIGN.md` §2.3–2.4 for the full design.

### 2.6 Collectibles & Triggers

#### Coin

```typescript
class Coin extends Sensor {
  collisionGroup = "items";

  onReady() {
    super.onReady();
    this.addChild(CollisionShape).shape = Shape.circle(6);
    this.tag("coin");

    // Float animation
    this.tween()
      .to({ position: { y: this.position.y - 4 } }, 0.8, Ease.sineInOut)
      .to({ position: { y: this.position.y } }, 0.8, Ease.sineInOut)
      .repeat();

    this.bodyEntered.connect((body) => {
      if (body.hasTag("player")) this._collect();
    });
  }

  private _collect() {
    gameState.coins++;
    gameState.score += 10;
    this.game!.audio.play("coin", { bus: "sfx" });

    // Pop + fade effect
    this.killTweens();
    this.tween()
      .to({ scale: { x: 1.8, y: 1.8 }, alpha: 0 }, 0.2, Ease.backOut)
      .onComplete(() => this.destroy());
  }

  onDraw(ctx: DrawContext) {
    ctx.circle(Vec2.ZERO, 6, { fill: Color.fromHex("#ffd54f") });
  }
}
```

#### HealthPickup

```typescript
class HealthPickup extends Sensor {
  collisionGroup = "items";

  onReady() {
    super.onReady();
    this.addChild(CollisionShape).shape = Shape.rect(10, 10);
    this.tag("health");

    this.bodyEntered.connect((body) => {
      if (body.hasTag("player") && gameState.health < gameState.maxHealth) {
        gameState.health++;
        this.game!.audio.play("heal", { bus: "sfx" });

        this.killTweens();
        this.tween()
          .to({ position: { y: this.position.y - 16 }, alpha: 0 }, 0.3, Ease.quadOut)
          .onComplete(() => this.destroy());
      }
    });
  }

  onDraw(ctx: DrawContext) {
    // Heart shape approximated as a pink square with a cross
    ctx.rect(new Vec2(-5, -5), new Vec2(10, 10), {
      fill: Color.fromHex("#ef5350"),
    });
    ctx.rect(new Vec2(-1, -4), new Vec2(2, 8), { fill: Color.WHITE });
    ctx.rect(new Vec2(-4, -1), new Vec2(8, 2), { fill: Color.WHITE });
  }
}
```

#### LevelExit

A sensor zone that triggers the transition to the next scene:

```typescript
class LevelExit extends Sensor {
  collisionGroup = "items";
  nextScene!: SceneConstructor;

  onReady() {
    super.onReady();
    this.addChild(CollisionShape).shape = Shape.rect(16, 32);
    this.tag("exit");

    this.bodyEntered.connect((body) => {
      if (body.hasTag("player")) {
        gameState.currentLevel++;
        this.game!.audio.play("victory", { bus: "sfx" });
        this.scene!.switchTo(this.nextScene);
      }
    });
  }

  onDraw(ctx: DrawContext) {
    // Pulsing door
    ctx.rect(new Vec2(-8, -16), new Vec2(16, 32), {
      fill: Color.fromHex("#81c784"),
    });
  }
}
```

### 2.7 Level Design

Levels use TileMap with Tiled JSON files. Each level is a small, horizontally-scrolling world.

#### Tileset

Uses the **Kenney Pico-8 Platformer** tileset (CC0 license, https://kenney.nl/assets/pico-8-platformer).

| Property | Value |
|----------|-------|
| File | `tileset.png` (transparent packed, no spacing) |
| Tile size | 8 × 8 pixels |
| Sheet size | 120 × 80 pixels (15 columns × 10 rows) |
| Total tiles | 150 |
| Theme | Orange terrain, pink variant, characters, items, numbers |

Key tile IDs (GID = index + 1, since firstgid=1):

| GID | Index | Purpose |
|-----|-------|---------|
| 1 | 0 | Interior fill (light tan solid) |
| 3 | 2 | Dark background fill (sky/cave) |
| 5 | 4 | Top surface edge (orange) |
| 7 | 6 | Left surface edge |
| 8 | 7 | Outer corner top-left |
| 9 | 8 | Outer corner top-right |
| 17 | 16 | Bottom surface edge |
| 20 | 19 | Right surface edge |
| 25 | 24 | Outer corner bottom-left |

Edge tiles support Tiled flip flags (H, V, D) for all orientations — a single edge tile serves all 4 directions.

A level generator script (`examples/platformer/tools/generate-levels.mjs`) converts text-art level descriptions to Tiled JSON with autotiled edges.

#### Map Format

Each level is a Tiled JSON file with these layers:

| Layer | Type | Purpose |
|-------|------|---------|
| `background` | Tile layer | Decorative tiles (no collision) |
| `ground` | Tile layer | Solid tiles (collision generated from this) |
| `entities` | Object layer | Spawn points for player, enemies, coins, etc. |

#### Level 1: "Green Hills" (Tutorial)

- Size: 107 × 30 tiles (856 × 240 world pixels)
- ~2.7 screens of horizontal scrolling
- Features:
  - Ground with two gaps to jump across
  - Several raised platforms with coins on top
  - 2 patrol enemies
  - ~15 coins spread across platforms
  - Level exit on the right edge
  - Player start on the left

#### Level 2: "Cave Depths" (Challenge)

- Size: 140 × 30 tiles (1120 × 240 world pixels)
- ~3.5 screens of horizontal scrolling
- Features:
  - More complex terrain with vertical sections
  - 2 patrol enemies, 2 flying enemies
  - ~20 coins, 1 health pickup
  - Tighter platforming, wider gaps
  - Level exit leads to VictoryScene

#### Level Generation

Levels are defined as text-art in `examples/platformer/tools/generate-levels.mjs` and converted to Tiled JSON with autotiled edges:

```
Legend:  # = solid  . = air  P = player  C = coin  S = slime  B = bat  H = health  E = exit
```

Run `node examples/platformer/tools/generate-levels.mjs` to regenerate `level1.json` and `level2.json`. Edit the text-art grids in the script to modify level layout.

#### Tiled JSON Structure

Each level JSON uses the standard Tiled format with the Kenney Pico-8 tileset:

```json
{
  "width": 107, "height": 30,
  "tilewidth": 8, "tileheight": 8,
  "tilesets": [{
    "firstgid": 1,
    "image": "tileset.png",
    "imagewidth": 120, "imageheight": 80,
    "tilewidth": 8, "tileheight": 8,
    "tilecount": 150, "columns": 15
  }],
  "layers": [
    { "name": "background", "type": "tilelayer", "data": [ /* dark fill tiles */ ] },
    { "name": "ground", "type": "tilelayer", "data": [ /* autotiled terrain */ ] },
    {
      "name": "entities", "type": "objectgroup",
      "objects": [
        { "name": "player_start", "type": "Player", "x": 44, "y": 140, "point": true },
        { "name": "coin", "type": "Coin", "x": 116, "y": 100, "point": true },
        { "name": "patrol_enemy", "type": "PatrolEnemy", "x": 284, "y": 116, "point": true },
        { "name": "exit", "type": "LevelExit", "x": 772, "y": 140, "point": true }
      ]
    }
  ]
}
```

#### Collision Generation

Collision is generated from the "ground" tile layer using TileMap's existing `generateCollision()`:

```typescript
// In onReady() — asset must be set AFTER the node enters the tree
const map = this.add(TileMap);
map.asset = "level1"; // Triggers _loadMap() since node is already in tree
map.generateCollision({
  layer: "ground",
  allSolid: true,
  collisionGroup: "world",
});
```

> **Timing:** `TileMap.asset` must be set after the node is in the tree (i.e., in `onReady()` or after `add()`). Setting it in the constructor will silently fail because `_loadMap()` requires `isInsideTree`.

This uses the greedy rectangle merging algorithm from Phase 4 to create efficient `StaticCollider` shapes from the tile grid.

### 2.8 HUD

The HUD uses `@quintus/ui` widgets in a fixed `Layer` that ignores camera scrolling.

```typescript
// examples/platformer/hud/hud.ts

class HUD extends Layer {
  private healthBar!: ProgressBar;
  private scoreLabel!: Label;
  private coinLabel!: Label;

  onReady() {
    this.fixed = true;
    this.zIndex = 100;

    // Health bar
    this.healthBar = this.addChild(ProgressBar);
    this.healthBar.position = new Vec2(8, 8);
    this.healthBar.width = 48;
    this.healthBar.height = 6;
    this.healthBar.maxValue = gameState.maxHealth;
    this.healthBar.value = gameState.health;
    this.healthBar.fillColor = Color.fromHex("#ef5350");
    this.healthBar.backgroundColor = Color.fromHex("#424242");

    // Health label
    const healthLabel = this.addChild(Label);
    healthLabel.position = new Vec2(60, 8);
    healthLabel.text = `${gameState.health}/${gameState.maxHealth}`;
    healthLabel.fontSize = 8;
    healthLabel.color = Color.WHITE;

    // Coin icon + counter
    this.coinLabel = this.addChild(Label);
    this.coinLabel.position = new Vec2(8, 20);
    this.coinLabel.text = `Coins: ${gameState.coins}`;
    this.coinLabel.fontSize = 8;
    this.coinLabel.color = Color.fromHex("#ffd54f");

    // Score
    this.scoreLabel = this.addChild(Label);
    this.scoreLabel.position = new Vec2(250, 8);
    this.scoreLabel.text = `Score: ${gameState.score}`;
    this.scoreLabel.fontSize = 8;
    this.scoreLabel.color = Color.WHITE;
    this.scoreLabel.align = "right";
  }

  onUpdate(_dt: number) {
    // Sync HUD with game state every frame
    this.healthBar.value = gameState.health;
    this.scoreLabel.text = `Score: ${gameState.score}`;
    this.coinLabel.text = `Coins: ${gameState.coins}`;
  }
}
```

**Design decision: polling vs events.** The HUD polls `gameState` every frame instead of connecting signals from every entity. This is simpler, costs nothing at 60fps with 3 comparisons, and avoids complex signal wiring. For a larger game, event-driven updates would be better.

### 2.9 Audio

The game uses both the simple `game.audio.play()` API for sound effects and `AudioPlayer` nodes for music.

#### Sound Effects

| Sound | When | Bus |
|-------|------|-----|
| `jump` | Player jumps | sfx |
| `coin` | Coin collected | sfx |
| `hit` | Player takes damage | sfx |
| `stomp` | Enemy stomped | sfx |
| `heal` | Health pickup collected | sfx |
| `victory` | Level completed | sfx |

#### Music

| Track | Scene | Bus |
|-------|-------|-----|
| `title-music` | TitleScene | music |
| `level-music` | Level1, Level2 | music |
| `gameover-music` | GameOverScene | music |

Music is played via `AudioPlayer` nodes with `loop = true` and `autoplay = true`.

#### Audio Assets

Sound effects use the **Kenney Sci-Fi Sounds** pack (CC0, https://kenney.nl/assets/sci-fi-sounds):

| Game Sound | Source File | Size |
|------------|-------------|------|
| `jump.ogg` | `laserRetro_004.ogg` | 12KB |
| `coin.ogg` | `laserSmall_000.ogg` | 7KB |
| `hit.ogg` | `impactMetal_000.ogg` | 15KB |
| `stomp.ogg` | `slime_000.ogg` | 20KB |
| `heal.ogg` | `forceField_003.ogg` | 23KB |
| `victory.ogg` | `doorOpen_000.ogg` | 19KB |

Total audio: ~96KB (all OGG format). Already copied to `examples/platformer/assets/`.

Music tracks are deferred — the `AudioSystem` handles missing assets gracefully (warns once, returns no-op handle). The game is fully playable without music.

### 2.10 Death & Respawn

When the player dies (health reaches 0 or falls off the map):

1. Player's `died` signal fires
2. The level scene connects to `died` and switches to `GameOverScene`
3. `GameOverScene` shows final score and a "Retry" button
4. "Retry" calls `resetState()` then `switchTo(Level1)` (or the level where death occurred)

> **Scene transition safety:** Entity callbacks (tween `onComplete`, signal handlers) may fire after `switchTo()` destroys the scene. Guard `gameState` mutations in entity callbacks with `if (!this.isInsideTree) return;` to prevent stale writes. Verify that `killTweens()` is called on `destroy()`.

```typescript
// In Level scene's onReady():
player.died.connect(() => {
  // Brief delay before switching (let death feel register)
  const timer = this.add(Node);
  let elapsed = 0;
  timer.onUpdate = (dt) => {
    elapsed += dt;
    if (elapsed > 0.5) {
      this.switchTo(GameOverScene);
    }
  };
});
```

### 2.11 Scene Transitions & Effects

Scenes can optionally use tween-based fade transitions:

```typescript
// Fade out before switching scenes
class Level extends Scene {
  protected fadeAndSwitchTo(NextScene: SceneConstructor) {
    // Create a full-screen black overlay
    const overlay = this.add(Panel);
    overlay.renderFixed = true;
    overlay.width = this.game!.width;
    overlay.height = this.game!.height;
    overlay.backgroundColor = Color.BLACK;
    overlay.alpha = 0;
    overlay.zIndex = 999;

    overlay.tween()
      .to({ alpha: 1 }, 0.3, Ease.quadIn)
      .onComplete(() => this.switchTo(NextScene));
  }
}
```

This is a convenience pattern, not a required feature. The `switchTo()` call works fine for instant transitions.

---

## 3. File Structure

```
examples/platformer/
├── index.html              # HTML page with <canvas id="game">
├── main.ts                 # Entry point: Game setup, plugin registration, asset loading
├── state.ts                # GameState interface + mutable gameState + resetState()
├── config.ts               # Collision groups, input bindings, constants
├── scenes/
│   ├── title-scene.ts      # Title screen with start button
│   ├── level.ts            # Base Level class (shared level setup logic)
│   ├── level1.ts           # Level 1 (extends Level)
│   ├── level2.ts           # Level 2 (extends Level)
│   ├── game-over-scene.ts  # Game over screen with retry button
│   └── victory-scene.ts    # Victory screen with final score
├── entities/
│   ├── player.ts           # Player character (Actor)
│   ├── patrol-enemy.ts     # Walking patrol enemy (Actor)
│   ├── flying-enemy.ts     # Sine-wave flying enemy (Actor)
│   ├── coin.ts             # Collectible coin (Sensor)
│   ├── health-pickup.ts    # Health restore item (Sensor)
│   └── level-exit.ts       # Level completion trigger (Sensor)
├── hud/
│   └── hud.ts              # HUD layer with health bar, score, coin counter
├── tools/
│   └── generate-levels.mjs  # Text-art → Tiled JSON level generator
└── assets/
    ├── ATTRIBUTION.md       # Kenney CC0 license attribution
    ├── tileset.png          # 120×80 Kenney Pico-8 tileset (150 tiles, 8×8 packed)
    ├── level1.json          # Tiled JSON for Level 1 (107×30 tiles)
    ├── level2.json          # Tiled JSON for Level 2 (140×30 tiles)
    ├── jump.ogg             # Jump SFX (Kenney Sci-Fi Sounds, CC0)
    ├── coin.ogg             # Coin collect SFX
    ├── hit.ogg              # Player damage SFX
    ├── stomp.ogg            # Enemy stomp SFX
    ├── heal.ogg             # Health pickup SFX
    └── victory.ogg          # Level complete SFX
```

**Total: ~15 source files.** Each file is focused on one concern and under 100 lines.

### Entry Point

```typescript
// examples/platformer/main.ts

import { Game } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { InputPlugin } from "@quintus/input";
import { TweenPlugin } from "@quintus/tween";
import { AudioPlugin } from "@quintus/audio";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "./config.js";
import { TitleScene } from "./scenes/title-scene.js";

const game = new Game({
  width: 320,
  height: 240,
  canvas: "game",
  pixelArt: true,
  backgroundColor: "#1a1a2e",
  seed: 42,
});

// === Plugins ===
game.use(PhysicsPlugin({
  gravity: new Vec2(0, 800),
  collisionGroups: COLLISION_GROUPS,
}));
game.use(InputPlugin({ actions: INPUT_BINDINGS }));
game.use(TweenPlugin());
game.use(AudioPlugin());

// === Load & Start ===
// NOTE: Verify AssetLoader.load() supports this batch interface.
// Fallback: use Vite ES module imports (import level1 from "./assets/level1.json")
// and pass data to TileMap directly.
game.assets.load({
  images: ["tileset.png"],
  json: ["level1.json", "level2.json"],
  audio: ["jump.ogg", "coin.ogg", "hit.ogg", "stomp.ogg", "heal.ogg", "victory.ogg"],
}).then(() => {
  game.start(TitleScene);
});
```

### Configuration

```typescript
// examples/platformer/config.ts

import type { CollisionGroupsConfig } from "@quintus/physics";

export const COLLISION_GROUPS: CollisionGroupsConfig = {
  player:  { collidesWith: ["world", "enemies", "items"] },
  world:   { collidesWith: ["player", "enemies"] },
  enemies: { collidesWith: ["world"] },  // One-sided: player detects enemies, NOT vice versa
  items:   { collidesWith: ["player"] },
};

export const INPUT_BINDINGS: Record<string, string[]> = {
  left:  ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  jump:  ["ArrowUp", "Space", "KeyW"],
  pause: ["Escape", "KeyP"],
};
```

### Vite Configuration

Add the platformer example to the Vite multi-page setup:

```typescript
// examples/vite.config.ts (updated)
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  // ...existing config...
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        platformer: resolve(__dirname, "platformer/index.html"),
        // ...other demos
      },
    },
  },
});
```

---

## 4. Cross-Cutting Concerns

### 4.1 API Validation

The platformer is the primary API validation tool. If writing the game feels awkward, the underlying API needs improvement. Watch for:

| Smell | Indicates |
|-------|-----------|
| Too many imports | Meta-package re-exports are incomplete |
| Boilerplate in entity setup | `onReady` + `addChild(CollisionShape)` pattern might need a shorthand |
| Messy state management | Scene transition API might need a state-passing mechanism |
| Verbose HUD updates | UI data binding might be worth adding in a future phase |

**If API issues are discovered during implementation**, file them as follow-up tasks for Phase 7+ rather than blocking Phase 6. The game should work with the existing API even if it's slightly verbose.

### 4.5 Asset Loading

The entry point uses `game.assets.load()` to preload tilesets and level JSON. **Before writing game code**, verify that `AssetLoader` supports the `{ images: [...], json: [...] }` batch loading interface and that `game.assets.getJSON(name)` returns cached results for `TileMap`. If the asset pipeline is incomplete, use Vite's ES module imports as a fallback (`import level1Data from "./assets/level1.json"`).

**TileMap timing:** `TileMap.asset` must be set in `onReady()` (after the node enters the tree), not in the constructor. `_loadMap()` only runs when `isInsideTree && asset` are both true.

### 4.6 Scene Transition Safety

Entity callbacks (tween `onComplete`, signal handlers) may fire after `switchTo()` destroys the scene. Guard state mutations with `this.isInsideTree` checks in entity callbacks before mutating `gameState`. The tween system should call `killTweens()` on `destroy()` — verify this during implementation.

### 4.2 LLM Readability

The game code is optimized for LLM comprehension:

1. **One class per file** — LLMs can read individual files without losing context
2. **Explicit imports** — No barrel imports that hide where things come from
3. **Simple state** — Module-level `gameState` is immediately understandable
4. **Clear naming** — `PatrolEnemy`, `HealthPickup`, `LevelExit` — no abbreviations
5. **Minimal inheritance** — Only extends engine base classes (`Actor`, `Sensor`, `Scene`)
6. **Comments explain "why"** — Not "what" (the code does that)

**LLM test:** After implementation, ask Claude to "add a new power-up that gives the player a speed boost for 5 seconds." If it can do this correctly on the first try by reading the game code, the code is LLM-readable.

### 4.3 Performance

The platformer is small enough that performance is not a concern:

| Metric | Expected |
|--------|----------|
| Total nodes | ~50-100 |
| Active collision bodies | ~20-30 |
| Draw calls per frame | ~50-80 |
| Target FPS | Solid 60fps on any modern device |

No performance optimization work is expected in Phase 6.

### 4.4 Determinism

The game is deterministic when started with the same seed:

- `game.random` is seeded (seed 42)
- Fixed timestep (1/60s)
- No `Math.random()` or `Date.now()` in game code
- Tween timing is frame-based
- Input can be injected programmatically

This enables future Phase 7 work (headless testing, input scripts, replay).

---

## 5. Test Plan

Phase 6 tests focus on integration — verifying that all packages work together correctly. Unit tests for individual packages are already complete from Phases 1-5.

### Meta-Package Tests

| Category | Test | Details |
|----------|------|---------|
| **Exports** | All public APIs accessible | Import every major class/function from `quintus`, verify they're defined |
| **Augmentation** | `game.input` works | Create Game, use InputPlugin via meta-package, verify `game.input` exists |
| **Augmentation** | `node.tween()` works | Create Node, use TweenPlugin via meta-package, verify `node.tween()` exists |
| **Augmentation** | `game.audio` works | Create Game, use AudioPlugin via meta-package, verify `game.audio` exists |
| **Types** | Type-level verification | TypeScript compiles without errors when using meta-package types |
| **Size** | Bundle under 40KB | Measure gzipped output, assert < 40KB |

### Game Integration Tests

These tests use `Game.step()` for headless testing (no browser required):

| Category | Test | Details |
|----------|------|---------|
| **Player** | Moves right | Inject "right" input, step 30 frames, verify player.position.x increased |
| **Player** | Jumps from floor | Inject "jump" input when on floor, verify velocity.y < 0 |
| **Player** | Double-jump | Jump, wait, jump again mid-air, verify second velocity change |
| **Player** | Falls to death | Position player below map, step frames, verify died signal fires |
| **Enemy** | Patrol reverses | Place PatrolEnemy, step frames, verify it reverses at wall |
| **Enemy** | Stomp kills enemy | Position player above enemy, step frames, verify enemy destroyed |
| **Coin** | Collection | Move player into coin, verify gameState.coins incremented |
| **Health** | Pickup restores health | Reduce health, move player into HealthPickup, verify health increased |
| **HUD** | Reflects state | Change gameState values, step frame, verify HUD label texts |
| **Scene** | Title to Level1 | Start at TitleScene, trigger start, verify scene switches |
| **Scene** | Death to GameOver | Kill player, verify scene switches to GameOverScene |
| **Scene** | Level1 to Level2 | Reach exit, verify scene switches to Level2 |

### Test Implementation Pattern

```typescript
// examples/platformer/__tests__/player.test.ts

import { describe, test, expect } from "vitest";
import { Game } from "@quintus/core";
import { Vec2 } from "@quintus/math";
import { PhysicsPlugin } from "@quintus/physics";
import { InputPlugin } from "@quintus/input";
import { TweenPlugin } from "@quintus/tween";
import { COLLISION_GROUPS, INPUT_BINDINGS } from "../config.js";
import { Level1 } from "../scenes/level1.js";
import { Player } from "../entities/player.js";
import { gameState, resetState } from "../state.js";

function createTestGame(): Game {
  const canvas = document.createElement("canvas");
  const game = new Game({
    width: 320, height: 240,
    canvas,
    seed: 42,
    renderer: null, // Headless
  });
  game.use(PhysicsPlugin({
    gravity: new Vec2(0, 800),
    collisionGroups: COLLISION_GROUPS,
  }));
  game.use(InputPlugin({ actions: INPUT_BINDINGS }));
  game.use(TweenPlugin());
  return game;
}

describe("Player", () => {
  test("moves right when right input is held", () => {
    resetState();
    const game = createTestGame();
    game.start(Level1);

    const player = game.currentScene!.findAllByType(Player)[0];
    const startX = player.position.x;

    game.input.inject("right", true);
    for (let i = 0; i < 30; i++) game.step();
    game.input.inject("right", false);

    expect(player.position.x).toBeGreaterThan(startX);
  });

  test("jumps when on floor and jump pressed", () => {
    resetState();
    const game = createTestGame();
    game.start(Level1);

    const player = game.currentScene!.findAllByType(Player)[0];

    // Let player land on floor first
    for (let i = 0; i < 60; i++) game.step();
    expect(player.isOnFloor()).toBe(true);

    game.input.inject("jump", true);
    game.step();
    game.input.inject("jump", false);

    expect(player.velocity.y).toBeLessThan(0);
  });
});
```

---

## 6. Demo: What the Platformer Exercises

Every Phase 1-5 system is used in the platformer:

| Package | How It's Used |
|---------|---------------|
| **@quintus/core** | `Game`, `Scene`, `Node`, `Node2D`, `Signal`, `signal()`, `AssetLoader`, `Canvas2DRenderer`, scene transitions (`switchTo`), lifecycle hooks (`onReady`, `onUpdate`, `onFixedUpdate`, `onDraw`) |
| **@quintus/math** | `Vec2` (positions, velocities), `Color` (entity colors), `Rect` (bounds), math utils (`clamp`) |
| **@quintus/physics** | `Actor` (Player, enemies with `solid = true`), `StaticCollider` (tile collision), `Sensor` (coins, exits), `CollisionShape`, `Shape`, `PhysicsPlugin`, collision groups, `move()`, `isOnFloor()`, `isOnWall()`, `onContact()`, `onOverlap()`, `game.physics` accessor |
| **@quintus/sprites** | `Sprite` used for at least one element (e.g., level exit door or background decoration) to validate the sprites pipeline end-to-end. Full AnimatedSprite usage deferred to when sprite art is available. |
| **@quintus/input** | `InputPlugin`, action bindings, `isPressed()`, `isJustPressed()`, `inject()` for tests |
| **@quintus/tilemap** | `TileMap`, Tiled JSON parsing, `generateCollision()`, `getSpawnPoint()`, `spawnObjects()` |
| **@quintus/camera** | `Camera`, `follow`, `smoothing`, `zoom`, `bounds` |
| **@quintus/tween** | `node.tween()`, `killTweens()`, `.to()`, `.parallel()`, `.repeat()`, `.onComplete()`, `Ease` functions, coin float, enemy death squash, player damage flash, scene fade transitions |
| **@quintus/audio** | `AudioPlugin`, `game.audio.play()` for SFX, `AudioPlayer` for music, bus routing (sfx/music) |
| **@quintus/ui** | `Layer` (fixed HUD), `Label` (score, coins), `ProgressBar` (health), `Button` (title/game-over), `Panel` (backgrounds) |

### Systems NOT Exercised (Future Phases)

| System | Why Not | When |
|--------|---------|------|
| `@quintus/sprites` AnimatedSprite | No sprite art assets for animation; basic `Sprite` used for tileset rendering | Phase 9 (AI Prefabs) or when art is added |
| `@quintus/debug` | Debug tools not yet built | Phase 11 |
| `@quintus/headless` | Headless runtime not yet built | Phase 7 |
| `@quintus/test` | Test framework not yet built | Phase 7 |
| `@quintus/particles` | Particle system not yet built | Phase 11 |

The platformer uses `null` renderer for its test suite, which is a basic form of headless execution. The full `@quintus/headless` package (Phase 7) will formalize this.

---

## 7. Definition of Done

All of these must be true before Phase 6 is complete:

### Meta-Package

- [ ] `packages/quintus/` created as new meta-package (`@quintus/core` untouched)
- [ ] `packages/quintus/package.json` lists all 10 packages as dependencies with `sideEffects: true`
- [ ] `packages/quintus/src/index.ts` re-exports all 10 packages via `export *`
- [ ] `import { Game, Actor, Vec2, Camera, TileMap, Label, Ease } from "quintus"` works in TypeScript
- [ ] Module augmentations active: `game.physics`, `game.input`, `game.audio`, `node.tween()` all work
- [ ] `pnpm build` builds the meta-package without errors
- [ ] Gzipped bundle size under 40KB
- [ ] Import from individual `@quintus/*` packages still works (no regression)

### Platformer Game

- [ ] Game starts at TitleScene with title and start button
- [ ] Player runs left/right with keyboard input
- [ ] Player jumps and double-jumps
- [ ] Player interacts with tile collision (stands on ground, blocked by walls)
- [ ] PatrolEnemy walks back and forth, reverses at walls
- [ ] FlyingEnemy moves in sine-wave pattern
- [ ] Enemies damage player on contact (non-stomp)
- [ ] Enemies die when stomped from above with visual effect
- [ ] Coins collected on contact, increment score and coin count
- [ ] HealthPickup restores health when below max
- [ ] LevelExit triggers scene transition
- [ ] Camera follows player with smoothing and bounds clamping
- [ ] Camera zoom at 2× for pixel-art rendering
- [ ] HUD displays health bar, score, and coin count in screen space
- [ ] HUD stays fixed while camera scrolls
- [ ] Player death (0 health or fall) leads to GameOverScene
- [ ] GameOverScene shows score and retry button
- [ ] Retry resets state and restarts the level
- [ ] Level1 exit leads to Level2
- [ ] Level2 exit leads to VictoryScene
- [ ] VictoryScene shows final score and play-again button
- [ ] Audio plays (or silently no-ops if no audio assets)
- [ ] Tween effects work: coin float, enemy death squash, player flash

### Assets

- [x] `tileset.png` exists (Kenney Pico-8 tileset, 120×80px, 150 tiles at 8×8, CC0)
- [x] `level1.json` exists (valid Tiled JSON, 107×30 tiles, 23 entities)
- [x] `level2.json` exists (valid Tiled JSON, 140×30 tiles, 30 entities)
- [x] `ATTRIBUTION.md` credits Kenney (kenney.nl) with CC0 license
- [x] 6 sound effects exist: jump, coin, hit, stomp, heal, victory (Kenney Sci-Fi Sounds, CC0)
- [ ] All assets load without errors via AssetLoader or Vite imports

### Tests

- [ ] Meta-package export tests pass
- [ ] Player movement tests pass
- [ ] Player jump/double-jump tests pass
- [ ] Enemy behavior tests pass
- [ ] Coin collection tests pass
- [ ] Scene transition tests pass
- [ ] HUD update tests pass
- [ ] All tests run without browser (jsdom + null renderer)

### Quality

- [ ] All Phase 1-5 tests still pass (no regressions)
- [ ] `pnpm build` succeeds for all packages
- [ ] `pnpm lint` passes (Biome clean)
- [ ] Game code is well-commented and organized (one class per file)
- [ ] An LLM can read the game code and add a new entity type

---

## 8. Execution Order

Build the meta-package first (quick win), then build the game bottom-up from entities to scenes.

```
Day 1: Meta-Package
───────────────────────────────────────
Step 1: Meta-package setup                                    (0.5 day)
        → Create new packages/quintus/ directory (do NOT modify quintus-core)
        → Write package.json (name: "quintus", deps on all 10 packages, sideEffects: true)
        → Write src/index.ts with all re-exports
        → Add tsup.config.ts
        → Build and verify: pnpm build succeeds
        → Write meta-package tests (exports, augmentations including game.physics, types)
        → Measure bundle size, verify < 40KB

Step 2: Update CLAUDE.md and project docs                     (0.25 day)
        → Mark Phase 5 as Done in CLAUDE.md
        → Update Phase 6 status
        → Verify pnpm build/test/lint all clean

Day 2: Assets & Level Data
───────────────────────────────────────
Step 3: Verify tileset and level data                          (0.25 day)
        → Assets already created: tileset.png (Kenney Pico-8, CC0), level1.json, level2.json
        → Level generator: examples/platformer/tools/generate-levels.mjs
        → Verify AssetLoader.load({ images, json }) works; fallback to ES module imports if not
        → Verify TileMap loads and renders both levels (set asset in onReady, not constructor)
        → Tweak level layouts in generate-levels.mjs as needed during playtesting

Day 3-4: Game Entities
───────────────────────────────────────
Step 4: state.ts + config.ts                                  (0.25 day)
        → GameState interface, mutable state, resetState()
        → Collision groups config, input bindings

Step 5: Player entity                                         (0.5 day)
        → Movement, jump, double-jump, damage, death
        → Visual rendering with facing direction
        → Invincibility and flash effect

Step 6: Enemies                                               (0.5 day)
        → PatrolEnemy with wall reversal
        → FlyingEnemy with sine-wave pattern
        → Stomp detection and death animation

Step 7: Collectibles & triggers                               (0.5 day)
        → Coin with float animation and collect effect
        → HealthPickup with conditional healing
        → LevelExit with scene transition

Day 5-6: Scenes & HUD
───────────────────────────────────────
Step 8: HUD                                                   (0.25 day)
        → Layer with ProgressBar, Labels
        → State polling for live updates

Step 9: Base Level scene                                      (0.5 day)
        → TileMap loading, collision generation, entity spawning
        → Camera setup (follow, smoothing, zoom, bounds)
        → HUD instantiation
        → Player death handling
        → Enemy-player collision logic

Step 10: Level1 & Level2                                      (0.5 day)
         → Level1 extends Level (tutorial)
         → Level2 extends Level (challenge, LevelExit → VictoryScene)

Step 11: TitleScene, GameOverScene, VictoryScene               (0.5 day)
         → Title: background + start button
         → GameOver: score display + retry button
         → Victory: congratulations + final score + play-again button

Day 7: Integration & Polish
───────────────────────────────────────
Step 12: Audio integration                                    (0.25 day)
         → Wire up game.audio.play() calls in entities
         → Add AudioPlayer for background music (if assets available)

Step 13: Scene transitions                                    (0.25 day)
         → Verify all scene flow paths work
         → Optional: fade transition effect

Step 14: Integration tests                                    (0.5 day)
         → Player movement/jump tests
         → Enemy behavior tests
         → Collection tests
         → Scene transition tests
         → HUD tests

Step 15: Polish & verification                                (0.5 day)
         → Play-test the full game flow
         → Fix edge cases discovered during play
         → Verify all Definition of Done items
         → Final pnpm build + test + lint
```

**Total: ~7 working days (~1.5 weeks)**

### Parallelism Notes

- Steps 4-7 (entities) can be developed in parallel with Step 3 (assets), since entities can be tested without tilemap assets using programmatic level construction.
- Steps 8-11 (scenes) require entities to be complete.
- Step 12 (audio) can run in parallel with Step 14 (tests).
- Step 14 (tests) requires all scenes and entities to be functional.

### Risk: TileMap Asset Creation

Creating Tiled JSON by hand is tedious. If this blocks progress:
- **Fallback:** Build levels programmatically (like the existing `platformer-demo.ts`) and defer TileMap integration to a polish step.
- **Alternative:** Write a small TypeScript helper that generates valid Tiled JSON from a text-art level description.
- The level JSON files are small enough (~750-1050 tile IDs) that manual creation is feasible but time-consuming.

### ~~Risk: Tileset PNG Creation~~ — RESOLVED

Tileset sourced from Kenney Pico-8 Platformer (CC0). Already copied to `examples/platformer/assets/tileset.png`.

### Risk: Asset Loading Pipeline

`game.assets.load({ images, json })` may not support the batch loading interface shown in the entry point. Verify early in Step 3. Fallback: use Vite ES module imports (`import level1 from "./assets/level1.json"`) and pass data directly to TileMap.
