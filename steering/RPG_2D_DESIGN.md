# Top-Down 2D Dungeon Crawler — Design

> **Goal:** Build a small top-down dungeon crawler demo that exercises the engine's capabilities and identifies any engine-level gaps for non-platformer games.
> **Outcome:** A playable 2–3 level dungeon with combat (attack/defend), equipment (swords/shields), enemies with AI, chests with loot, health pickups, and a HUD — plus any small engine enhancements needed to make top-down games ergonomic.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| A1 | Engine: Y-sort rendering mode | Done |
| A2 | Engine: Timer node | Done |
| B1 | Project scaffold & tileset integration | Pending |
| B2 | Player movement & animation | Pending |
| B3 | Combat system (attack/defend) | Pending |
| B4 | Enemies & AI | Pending |
| B5 | Equipment, chests, items | Pending |
| B6 | Multi-level flow, HUD, polish | Pending |

---

## Engine Gap Analysis

The engine already supports top-down games well. Here's what works today and what needs small additions:

### What Already Works

| Need | Engine Feature | Notes |
|------|---------------|-------|
| Top-down movement | `Actor` with `gravity=0`, `applyGravity=false`, `upDirection=Vec2.ZERO` | `move(dt)` handles collision sliding |
| 4-direction input | `input.getVector('left','right','up','down')` or per-action `isPressed()` | Analog stick support included |
| Wall collision | `StaticCollider` + `TileMap.generateCollision()` | Greedy rect merge for efficiency |
| Directional sprites | `AnimatedSprite` with named anims (`walk_down`, `walk_up`, etc.) + `flipH` | Up to 256 anims per sheet |
| Weapon attachment | Child `Sprite`/`AnimatedSprite` on player node | Transform cascade handles positioning |
| Overlap triggers | `Sensor` + `bodyEntered`/`bodyExited` signals | Chests, pickups, doors |
| Collision groups | Named groups (`player`, `enemies`, `world`, `items`, `weapon`) | Configurable who collides with whom |
| Camera follow | `Camera` with follow, zoom, bounds, smoothing | Pixel-perfect zoom for pixel art |
| Tilemap + objects | `TileMap` with TMX support, `spawnObjects()` for entity placement | Object layer properties auto-injected |
| Audio | `AudioPlugin` with music/sfx buses | One-shot SFX + looped BGM |
| Tweens | `node.tween().to(...)` chains with easing | Knockback, flash, item bounce |
| HUD | `Layer { fixed: true }` + `Label`, `Sprite`, `ProgressBar` | Hearts, score, inventory slot display |
| Scene transitions | `scene.switchTo(NextLevel)` | Shared `gameState` for persistence |
| Deterministic testing | `@quintus/headless` + `@quintus/test` | InputScript, TestRunner, snapshots |

### What Needs Engine Additions

Two small, high-value additions make top-down games significantly more ergonomic:

---

## Part A: Engine Enhancements

### Phase A1: Y-Sort Rendering Mode

**Problem:** In top-down games, entities must be drawn in Y-order (lower Y = further back, higher Y = in front). Currently, developers must manually set `zIndex = Math.floor(position.y)` every frame on every entity. This is error-prone, forces zIndex to be overloaded (can't use it for layering anymore), and triggers a full render list re-sort every frame.

**Solution:** Add a `ySortChildren` property to `Node` (mirrors Godot's `Node2D.y_sort_enabled`). When enabled, the renderer sorts that node's children by `globalPosition.y` instead of `zIndex` during the render phase.

- [ ] Add `ySortChildren: boolean = false` property to `Node2D` (`packages/core/src/node2d.ts`)
- [ ] Update `Canvas2DRenderer._collectRenderList()` to sort children by `globalPosition.y` when parent has `ySortChildren = true` (falls back to `zIndex` otherwise)
- [ ] Ensure `zIndex` still works as a tie-breaker within Y-sorted groups (e.g., shadow sprite at zIndex -1 still renders below its sibling character sprite)
- [ ] Add unit tests for Y-sort behavior
- [ ] Verify `pnpm build && pnpm test` passes

**Implementation Detail:**

```typescript
// packages/core/src/node2d.ts — add to Node2D class
ySortChildren = false;
```

```typescript
// packages/core/src/canvas2d-renderer.ts — in _collectRenderList()
// When collecting children of a node with ySortChildren, sort by globalPosition.y
private _collectRenderList(node: Node, list: Node2D[]): void {
  let children = node.children;
  if (node instanceof Node2D && node.ySortChildren) {
    // Sort children by Y position (stable: preserves zIndex as secondary)
    children = [...children].sort((a, b) => {
      if (a instanceof Node2D && b instanceof Node2D) {
        const yDiff = a.globalPosition.y - b.globalPosition.y;
        if (yDiff !== 0) return yDiff;
        return a.zIndex - b.zIndex; // tie-breaker
      }
      return 0;
    });
  }
  for (const child of children) {
    if (child instanceof Node2D) {
      if (!child.visible) continue;
      if (child.onDraw !== Node2D.prototype.onDraw || child.children.length > 0) {
        list.push(child);
      }
      this._collectRenderList(child, list);
    }
  }
}
```

**Usage in dungeon crawler:**

```typescript
class DungeonLevel extends Scene {
  onReady() {
    // Floor tiles (always behind)
    const floorMap = this.add(TileMap);
    floorMap.zIndex = 0;

    // Y-sorted entity container
    const entities = this.add(Node2D);
    entities.ySortChildren = true;
    entities.zIndex = 1;

    // All actors added as children of this container
    const player = entities.addChild(Player);
    const enemy = entities.addChild(Skeleton);
    // Rendering order is now automatic: whoever has lower Y renders first

    // Wall tops / foreground decorations (always on top)
    const fgMap = this.add(TileMap);
    fgMap.zIndex = 2;
  }
}
```

### Tests for Phase A1

**Unit:** `packages/core/src/canvas2d-renderer.test.ts`
- Y-sorted parent: children rendered in Y order, not tree order
- Y-sort tie-breaking: same Y position falls back to zIndex
- Y-sort disabled (default): children use zIndex order as before
- Nested Y-sort: Y-sorted container inside another Y-sorted container
- Non-Node2D children in Y-sorted parent: skipped gracefully

---

### Phase A2: Timer Node

**Problem:** The platformer demo uses a manual timer pattern (create a Node, override onUpdate, track elapsed time — see `examples/platformer/scenes/level.ts:109-117`). Dungeon crawlers need many timers: attack cooldowns, invincibility frames, enemy patrol pauses, chest open delays. A built-in Timer node eliminates boilerplate.

**Solution:** Add a `Timer` class to `@quintus/core` (similar to Godot's Timer node).

- [ ] Create `packages/core/src/timer.ts` with `Timer extends Node`
- [ ] Export from `packages/core/src/index.ts`
- [ ] Add unit tests `packages/core/src/timer.test.ts`
- [ ] Verify `pnpm build && pnpm test` passes

**Implementation:**

```typescript
// packages/core/src/timer.ts
import { Node, signal, type Signal } from "./index.js";

export class Timer extends Node {
  /** Duration in seconds. */
  duration = 1;

  /** If true, restarts automatically after firing. */
  repeat = false;

  /** If true, starts counting immediately on onReady(). */
  autostart = false;

  /** Emitted when the timer expires. */
  readonly timeout: Signal<void> = signal<void>();

  private _elapsed = 0;
  private _running = false;

  get running(): boolean {
    return this._running;
  }

  get timeLeft(): number {
    return Math.max(0, this.duration - this._elapsed);
  }

  start(duration?: number): void {
    if (duration !== undefined) this.duration = duration;
    this._elapsed = 0;
    this._running = true;
  }

  stop(): void {
    this._running = false;
    this._elapsed = 0;
  }

  override onReady(): void {
    if (this.autostart) this.start();
  }

  override onFixedUpdate(dt: number): void {
    if (!this._running) return;
    this._elapsed += dt;
    if (this._elapsed >= this.duration) {
      this._running = false;
      this.timeout.emit();
      if (this.repeat) {
        this._elapsed -= this.duration; // carry over excess
        this._running = true;
      }
    }
  }
}
```

**Usage:**

```typescript
// Attack cooldown
const cooldown = this.addChild(Timer, { duration: 0.4 });
cooldown.timeout.connect(() => { this._canAttack = true; });

// Enemy patrol pause
const pauseTimer = this.addChild(Timer, { duration: 2, repeat: true, autostart: true });
pauseTimer.timeout.connect(() => { this._reverseDirection(); });

// One-shot delay
const delay = this.addChild(Timer, { duration: 0.5 });
delay.timeout.connect(() => { scene.switchTo(GameOver); delay.destroy(); });
delay.start();
```

### Tests for Phase A2

**Unit:** `packages/core/src/timer.test.ts`
- Timer fires after duration
- Timer with repeat fires multiple times
- Timer with autostart begins in onReady
- `stop()` resets and prevents firing
- `timeLeft` decreases correctly
- Timer does not fire when not started
- Duration override via `start(newDuration)`
- Excess time carries over on repeat (no drift)

---

## Part B: Demo Game — Dungeon Crawler

### Asset: Kenney Tiny Dungeon

The tileset shown in the screenshots is the [Kenney Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) pack (CC0 1.0):
- 16x16 pixel tiles
- Dungeon terrain: stone walls, floors, doors, ladders, water
- Characters: multiple hero types, skeletons, orcs, slimes, demons
- Items: swords, shields, axes, staffs, potions, keys
- Props: chests, barrels, tables, torches, bookshelves
- Separate weapon/equipment sprites that can be composed onto characters

The tileset has individual character sprites (front-facing) and separate weapon/shield sprites. For 4-directional animation, we'll use flipH for left/right and different frames for up/down where available, or rotation-based approaches for weapons.

---

### Phase B1: Project Scaffold & Tileset Integration

- [ ] Create `examples/dungeon/` directory structure:

```
examples/dungeon/
├── main.ts
├── config.ts              # collision groups, input bindings
├── state.ts               # shared game state
├── sprites.ts             # SpriteSheet definitions
├── assets/
│   ├── tileset.png        # Kenney Tiny Dungeon spritesheet
│   ├── level1.tmx         # Tiled map (room 1)
│   ├── level2.tmx         # Tiled map (room 2)
│   └── level3.tmx         # Tiled map (boss room)
├── entities/
│   ├── player.ts
│   ├── skeleton.ts
│   ├── orc.ts
│   ├── chest.ts
│   ├── health-pickup.ts
│   └── door.ts
├── scenes/
│   ├── dungeon-level.ts   # Base level scene
│   ├── level1.ts
│   ├── level2.ts
│   ├── level3.ts
│   ├── title-scene.ts
│   ├── game-over-scene.ts
│   └── victory-scene.ts
└── hud/
    └── hud.ts
```

- [ ] Download Kenney Tiny Dungeon tileset PNG into `examples/dungeon/assets/`
- [ ] Create `sprites.ts` with `SpriteSheet` config mapping tile indices to named animations
- [ ] Create `config.ts` with collision groups and input bindings
- [ ] Create `state.ts` with game state interface
- [ ] Create `main.ts` with Game setup (320x240, pixelArt, zoom 2)
- [ ] Create Level 1 map in Tiled with:
  - "ground" tile layer (walls, floor)
  - "decorations" tile layer (props, furniture)
  - "entities" object layer (spawn points, enemies, chests, doors)
- [ ] Add dungeon example to `examples/index.html`
- [ ] Verify `pnpm dev` serves the example and shows the tilemap

**Config:**

```typescript
// config.ts
export const COLLISION_GROUPS: CollisionGroupsConfig = {
  player:  { collidesWith: ["world", "enemies", "items"] },
  world:   { collidesWith: ["player", "enemies"] },
  enemies: { collidesWith: ["world", "player"] },
  items:   { collidesWith: ["player"] },
  weapon:  { collidesWith: ["enemies"] },     // Player weapon hitbox
  eWeapon: { collidesWith: ["player"] },      // Enemy weapon hitbox
};

export const INPUT_BINDINGS: Record<string, string[]> = {
  left:     ["ArrowLeft", "KeyA", "gamepad:dpad-left", "gamepad:left-stick-left"],
  right:    ["ArrowRight", "KeyD", "gamepad:dpad-right", "gamepad:left-stick-right"],
  up:       ["ArrowUp", "KeyW", "gamepad:dpad-up", "gamepad:left-stick-up"],
  down:     ["ArrowDown", "KeyS", "gamepad:dpad-down", "gamepad:left-stick-down"],
  attack:   ["Space", "KeyZ", "gamepad:a"],
  defend:   ["ShiftLeft", "KeyX", "gamepad:lb"],
  interact: ["KeyE", "gamepad:y"],
};
```

**State:**

```typescript
// state.ts
export interface EquipmentSlot {
  name: string;
  spriteFrame: number;   // Frame index in tileset
  damage?: number;       // For weapons
  defense?: number;      // For shields
}

export interface GameState {
  health: number;
  maxHealth: number;
  currentLevel: number;
  sword: EquipmentSlot;
  shield: EquipmentSlot;
  score: number;
  keys: number;          // For locked doors/chests
}

export const gameState: GameState = {
  health: 5,
  maxHealth: 5,
  currentLevel: 1,
  sword: { name: "Rusty Sword", spriteFrame: 0, damage: 1 },
  shield: { name: "Wooden Shield", spriteFrame: 0, defense: 1 },
  score: 0,
  keys: 0,
};

export function resetState(): void { /* reset to defaults */ }
```

**Scene Tree (per level):**

```
Scene (DungeonLevel)
├── TileMap ("ground" — walls/floors, collision generated)
├── TileMap ("decorations" — foreground props, no collision)
├── EntityContainer (Node2D, ySortChildren = true)
│   ├── Player (Actor)
│   │   ├── CollisionShape (rect 10x8, offset down for feet)
│   │   ├── AnimatedSprite (character body)
│   │   ├── Sprite (weapon — child of body sprite)
│   │   └── Sprite (shield — child of body sprite)
│   ├── Skeleton (Actor)
│   │   ├── CollisionShape
│   │   ├── AnimatedSprite
│   │   └── Sprite (weapon)
│   ├── Chest (Sensor)
│   │   └── AnimatedSprite (closed/open)
│   ├── HealthPickup (Sensor)
│   │   └── Sprite (potion)
│   └── Door (Sensor)
│       └── Sprite (door)
├── Camera
└── HUD (Layer, fixed)
    ├── Heart sprites × maxHealth
    ├── Label (score)
    ├── Sprite (current sword icon)
    └── Sprite (current shield icon)
```

### Tests for Phase B1

**Manual:** Open `pnpm dev`, navigate to dungeon example, verify:
- Tilemap renders with walls and floor
- Camera shows the level
- No console errors

---

### Phase B2: Player Movement & Animation

- [ ] Create `Player` class extending `Actor`
- [ ] Configure for top-down: `gravity = 0`, `applyGravity = false`, `upDirection = Vec2.ZERO`
- [ ] 4-directional movement via input actions (left/right/up/down)
- [ ] Diagonal movement normalized to prevent faster diagonal speed
- [ ] Track facing direction (up/down/left/right) — last non-zero input direction
- [ ] Create directional animation set:
  - `walk_down`, `walk_up`, `walk_left` (flipH of walk_right), `walk_right`
  - `idle_down`, `idle_up`, `idle_left`, `idle_right`
- [ ] AnimatedSprite plays correct animation based on direction + moving state
- [ ] Use `flipH` for left-facing (reuse right-facing frames)
- [ ] Collision shape smaller than sprite (feet-only hitbox for top-down feel)
- [ ] Collision shape offset downward (center collision at feet, not body center)
- [ ] Camera follows player with smoothing and map bounds
- [ ] Verify `pnpm dev` — player walks around level, collides with walls

**Implementation:**

```typescript
// entities/player.ts
export type Direction = "up" | "down" | "left" | "right";

export class Player extends Actor {
  speed = 80;
  override collisionGroup = "player";
  direction: Direction = "down";

  private _sprite!: AnimatedSprite;
  private _weaponSprite!: Sprite;
  private _shieldSprite!: Sprite;

  override onReady() {
    super.onReady();
    this.gravity = 0;
    this.applyGravity = false;
    this.upDirection = Vec2.ZERO;
    this.tag("player");

    // Feet-only collision (narrower than sprite, offset down)
    const shape = this.addChild(CollisionShape);
    shape.shape = Shape.rect(10, 6);
    shape.position.y = 4; // push hitbox to feet area

    this._sprite = this.addChild(AnimatedSprite);
    this._sprite.spriteSheet = playerSheet;
    this._sprite.centered = true;
    this._sprite.play("idle_down");

    // Weapon/shield sprites attached to character
    this._weaponSprite = this._sprite.addChild(Sprite);
    this._weaponSprite.texture = "tileset";
    this._weaponSprite.centered = true;
    this._weaponSprite.visible = false; // shown during attack

    this._shieldSprite = this._sprite.addChild(Sprite);
    this._shieldSprite.texture = "tileset";
    this._shieldSprite.centered = true;
    this._shieldSprite.visible = false; // shown during defend
  }

  override onFixedUpdate(dt: number) {
    const input = this.game?.input;
    if (!input) return;

    // Movement
    const moveX = input.getAxis("left", "right");
    const moveY = input.getAxis("up", "down");

    let vx = moveX * this.speed;
    let vy = moveY * this.speed;

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy);
      vx = (vx / len) * this.speed;
      vy = (vy / len) * this.speed;
    }

    this.velocity.x = vx;
    this.velocity.y = vy;
    this.move(dt);

    // Track facing direction
    if (Math.abs(moveX) > Math.abs(moveY)) {
      this.direction = moveX > 0 ? "right" : "left";
    } else if (moveY !== 0) {
      this.direction = moveY > 0 ? "down" : "up";
    }

    // Animation
    const moving = vx !== 0 || vy !== 0;
    const anim = moving ? `walk_${this.direction}` : `idle_${this.direction}`;
    this._sprite.flipH = this.direction === "left";
    // Use "right" frames for "left" direction
    const actualAnim = anim.replace("_left", "_right");
    this._sprite.play(actualAnim);
  }
}
```

### Tests for Phase B2

**Manual:** Verify in browser:
- WASD/arrows move player in 4 directions
- Diagonal movement is same speed as cardinal
- Correct animation plays for each direction
- Player collides with walls and slides along them
- Camera follows smoothly

---

### Phase B3: Combat System (Attack & Defend)

This is the core mechanic. The attack/defend system uses child `Sensor` nodes for hitboxes that are enabled/disabled during combat actions.

- [ ] Add attack state machine to Player: `idle` → `attacking` → `cooldown` → `idle`
- [ ] On attack press: spawn a temporary `Sensor` (weapon hitbox) in the facing direction
- [ ] Weapon hitbox: small rect or arc in front of player, lives for ~0.2s, collision group "weapon"
- [ ] Show weapon sprite during attack (positioned based on direction, with rotation for swing)
- [ ] Weapon swing animation via Tween: rotate weapon sprite from -45deg to +45deg over 0.2s
- [ ] Attack cooldown: 0.4s via Timer before can attack again
- [ ] On defend press (hold): show shield sprite, set `_defending = true`
- [ ] While defending: movement speed halved, incoming damage reduced by shield's defense value
- [ ] Shield positioned in facing direction
- [ ] Player `takeDamage(amount)`: reduce health, invincibility frames (alpha blink), knockback via Tween
- [ ] If defending, damage = max(0, amount - shield.defense), no knockback
- [ ] Player death signal when health <= 0
- [ ] Audio: sword swing SFX, hit SFX, block SFX, damage SFX

**Attack Hitbox Pattern:**

```typescript
// Weapon hitbox — spawned as child Sensor, auto-destroyed after duration
class WeaponHitbox extends Sensor {
  damage = 1;
  override collisionGroup = "weapon";

  onReady() {
    super.onReady();
    this.addChild(CollisionShape).shape = Shape.rect(12, 12);

    // Auto-destroy after short duration
    const timer = this.addChild(Timer, { duration: 0.15, autostart: true });
    timer.timeout.connect(() => this.destroy());

    // Track what we've already hit (prevent double-hit)
    const hitSet = new Set<number>();
    this.bodyEntered.connect((body) => {
      if (hitSet.has(body.id)) return;
      hitSet.add(body.id);
      if ("takeDamage" in body) {
        (body as any).takeDamage(this.damage);
      }
    });
  }
}
```

**Attack execution on Player:**

```typescript
performAttack(): void {
  if (this._attacking || !this._canAttack) return;
  this._attacking = true;
  this._canAttack = false;

  // Spawn hitbox in facing direction
  const hitbox = this.addChild(WeaponHitbox);
  hitbox.damage = gameState.sword.damage;
  const offsets: Record<Direction, Vec2> = {
    right: new Vec2(10, 0),
    left:  new Vec2(-10, 0),
    down:  new Vec2(0, 10),
    up:    new Vec2(0, -10),
  };
  hitbox.position = offsets[this.direction];

  // Show weapon sprite + tween swing
  this._weaponSprite.visible = true;
  this._weaponSprite.sourceRect = getSwordRect(gameState.sword);
  this._weaponSprite.position = offsets[this.direction].scale(0.5);

  const swingFrom = directionToAngle(this.direction) - Math.PI / 4;
  const swingTo = directionToAngle(this.direction) + Math.PI / 4;
  this._weaponSprite.rotation = swingFrom;

  this.tween()
    .to({ _weaponSprite: { rotation: swingTo } }, 0.15, Ease.quadOut)
    .callback(() => {
      this._weaponSprite.visible = false;
      this._attacking = false;
    });

  // Cooldown timer
  this._attackCooldown.start(0.4);
  this._attackCooldown.timeout.connect(() => { this._canAttack = true; });

  this.game?.audio.play("sword_swing", { bus: "sfx" });
}
```

**Defend:**

```typescript
// In onFixedUpdate:
const defending = input.isPressed("defend");
if (defending && !this._attacking) {
  this._shieldSprite.visible = true;
  this._shieldSprite.sourceRect = getShieldRect(gameState.shield);
  // Position shield in front based on direction
  const shieldOffset: Record<Direction, Vec2> = {
    right: new Vec2(6, 0),
    left:  new Vec2(-6, 0),
    down:  new Vec2(0, 6),
    up:    new Vec2(0, -6),
  };
  this._shieldSprite.position = shieldOffset[this.direction];
  // Half speed while defending
  this.velocity.x *= 0.5;
  this.velocity.y *= 0.5;
} else {
  this._shieldSprite.visible = false;
}
```

### Tests for Phase B3

**Manual:** Verify in browser:
- Space/Z swings sword in facing direction
- Weapon sprite appears and sweeps
- Shift/X shows shield, slows movement
- Can't attack while attack is on cooldown
- Can't attack while defending
- Audio plays on swing

---

### Phase B4: Enemies & AI

Two enemy types with simple AI:

**Skeleton (melee patrol):**
- Patrols back and forth along a path (or between walls)
- Detects player within range via `findNearest()` or distance check
- Chases player when in range
- Attacks when close enough (same WeaponHitbox pattern as player)
- Takes damage from player's weapon hitbox
- Death: plays death animation, drops item (optional), destroys

**Orc (ranged/guard):**
- Stands in place or guards an area
- Attacks if player gets close
- Slower but more health and damage
- Shields briefly before attacking (telegraphed)

- [ ] Create `BaseEnemy` class extending `Actor` with shared behavior:
  - `health`, `maxHealth`, `damage`, `speed`, `detectionRange`, `attackRange`
  - `takeDamage(amount)`: flash, knockback tween, check death
  - `die()`: destroy with tween (fade + scale), emit signal, award score
  - `collisionGroup = "enemies"`
- [ ] Create `Skeleton` extending `BaseEnemy`:
  - Patrol state: walk back and forth, reverse on wall collision
  - Chase state: move toward player when within `detectionRange` (line of sight via `hasLineOfSight()`)
  - Attack state: when within `attackRange`, spawn `EnemyWeaponHitbox` (collision group "eWeapon")
  - Attack cooldown: 1.0s
  - Stats: health 2, damage 1, speed 50, detectionRange 80, attackRange 14
- [ ] Create `Orc` extending `BaseEnemy`:
  - Guard state: stand still, face toward player if within range
  - Attack state: charge at player, swing weapon
  - Stats: health 4, damage 2, speed 35, detectionRange 60, attackRange 16
- [ ] Enemy-player damage: `eWeapon` group collides with player → `player.takeDamage()`
  - If player is defending AND facing toward enemy: damage reduced by shield defense, play block SFX
  - Otherwise: full damage + knockback
- [ ] Player weapon → enemy: `weapon` group triggers `enemy.takeDamage()`
- [ ] Enemy death: flash, shrink tween, award `gameState.score += 10`, destroy
- [ ] Audio: enemy attack SFX, enemy hit SFX, enemy death SFX

**State Machine Pattern (simple enum + switch):**

```typescript
type EnemyState = "patrol" | "chase" | "attack" | "hurt" | "dead";

class Skeleton extends BaseEnemy {
  private _state: EnemyState = "patrol";
  private _patrolDir = 1;

  override onFixedUpdate(dt: number) {
    if (this._state === "dead") return;

    const player = this.scene?.findByType(Player);
    const dist = player ? this.position.distanceTo(player.position) : Infinity;

    switch (this._state) {
      case "patrol":
        this.velocity.x = this._patrolDir * this.speed;
        this.velocity.y = 0;
        this.move(dt);
        // Reverse on wall hit
        if (this.getSlideCollisions().length > 0) this._patrolDir *= -1;
        // Transition to chase
        if (dist < this.detectionRange && this.hasLineOfSight(player!)) {
          this._state = "chase";
        }
        break;

      case "chase":
        const dir = player!.position.subtract(this.position).normalize();
        this.velocity = dir.scale(this.speed);
        this.move(dt);
        if (dist < this.attackRange) this._state = "attack";
        if (dist > this.detectionRange * 1.5) this._state = "patrol";
        break;

      case "attack":
        this.velocity.set(0, 0);
        this._performAttack();
        break;
    }
  }
}
```

### Tests for Phase B4

**Manual:** Verify in browser:
- Skeletons patrol back and forth
- Skeletons detect and chase player
- Skeletons attack when close
- Player sword damages enemies (health decreases)
- Enemies die with animation
- Player defending reduces damage from enemy attacks
- Block SFX plays when shield absorbs damage

---

### Phase B5: Equipment, Chests, Items

- [ ] Create `Chest` class extending `Sensor`:
  - Two states: closed, open
  - On player interact (press E while overlapping): open → award item
  - Items: sword upgrade, shield upgrade, health potion, key
  - Each chest has a `lootType` property (set in Tiled object properties)
  - Opening animation: sprite swap or simple tween
  - Cannot be re-opened
- [ ] Create `HealthPickup` class extending `Sensor`:
  - On overlap with player: heal 1 HP, destroy, play SFX
  - Bobbing tween (float up/down)
- [ ] Create `Door` class extending `Sensor`:
  - Links to next level (`targetScene` property, set in Tiled or code)
  - Some doors require keys (`locked` property + `gameState.keys`)
  - On overlap + interact: if unlocked, transition to target scene
  - Visual: sprite changes for locked vs. unlocked
- [ ] Equipment system in `state.ts`:
  - `sword` and `shield` are `EquipmentSlot` objects with stats
  - Upgrading: chest contains a better sword/shield, replaces current
  - HUD updates to show current equipment icons
- [ ] Define 3 swords and 2 shields:

| Sword | Damage | Sprite |
|-------|--------|--------|
| Rusty Sword | 1 | Basic sword tile |
| Steel Sword | 2 | Nicer sword tile |
| Magic Sword | 3 | Glowing sword tile |

| Shield | Defense | Sprite |
|--------|---------|--------|
| Wooden Shield | 1 | Basic shield tile |
| Iron Shield | 2 | Metal shield tile |

- [ ] Audio: chest open SFX, item pickup SFX, door SFX, locked door SFX

**Chest Implementation:**

```typescript
class Chest extends Sensor {
  lootType: "sword" | "shield" | "health" | "key" = "health";
  lootTier = 1;  // 1=basic, 2=upgraded, 3=magic
  private _opened = false;
  private _sprite!: AnimatedSprite;
  private _playerInRange = false;

  override onReady() {
    super.onReady();
    this.addChild(CollisionShape).shape = Shape.rect(14, 14);
    this.collisionGroup = "items";
    this._sprite = this.addChild(AnimatedSprite);
    this._sprite.spriteSheet = propsSheet;
    this._sprite.play("chest_closed");

    this.bodyEntered.connect((body) => {
      if (body.hasTag("player")) this._playerInRange = true;
    });
    this.bodyExited.connect((body) => {
      if (body.hasTag("player")) this._playerInRange = false;
    });
  }

  override onFixedUpdate(dt: number) {
    if (this._opened || !this._playerInRange) return;
    if (this.game?.input.isJustPressed("interact")) {
      this._open();
    }
  }

  private _open(): void {
    this._opened = true;
    this._sprite.play("chest_open");
    this.game?.audio.play("chest_open", { bus: "sfx" });

    switch (this.lootType) {
      case "sword":
        gameState.sword = SWORDS[this.lootTier];
        break;
      case "shield":
        gameState.shield = SHIELDS[this.lootTier];
        break;
      case "health":
        gameState.health = Math.min(gameState.health + 2, gameState.maxHealth);
        break;
      case "key":
        gameState.keys++;
        break;
    }
  }
}
```

### Tests for Phase B5

**Manual:** Verify in browser:
- Chests open when player presses E while overlapping
- Correct item is awarded (check HUD updates)
- Sword upgrade increases attack damage
- Shield upgrade reduces incoming damage
- Health pickups restore HP (visible in HUD hearts)
- Keys increment counter
- Locked doors require key, unlocked doors transition levels

---

### Phase B6: Multi-Level Flow, HUD, Polish

- [ ] Create 3 Tiled maps with increasing difficulty:
  - **Level 1:** Tutorial room — few skeletons, a chest with sword upgrade, health pickups, door to level 2
  - **Level 2:** Larger dungeon — mixed enemies, locked door requiring key, chest with shield, more complex layout
  - **Level 3:** Boss room — stronger orc enemies, final treasure chest, victory trigger
- [ ] Create `DungeonLevel` base scene (like platformer's `Level` base):
  - Load tilemap, generate collision, spawn entities from object layer
  - Setup Y-sorted entity container
  - Camera follow with bounds
  - HUD overlay
- [ ] Create level-specific scenes: `Level1`, `Level2`, `Level3`
- [ ] Create `TitleScene` with game title + "Press Space to Start"
- [ ] Create `GameOverScene` with "You Died" + "Press Space to Retry"
- [ ] Create `VictoryScene` with score display
- [ ] Create `HUD` class (Layer, fixed):
  - Row of heart sprites (filled/empty based on health)
  - Current sword icon + name
  - Current shield icon + name
  - Key count (if > 0)
  - Score
- [ ] Background music: looped dungeon ambient track
- [ ] Sound effects for all interactions (swing, hit, block, pickup, chest, door, death)
- [ ] Screen shake on player damage (`camera.shake(3, 0.2)`)
- [ ] Enemy death particles (or simple scale/fade tween since particles are Phase 11)
- [ ] Player invincibility frames after damage (alpha blink, 1s duration)
- [ ] "You got: Steel Sword!" popup when opening equipment chests (Label tween)
- [ ] Verify full playthrough: title → level 1 → level 2 → level 3 → victory

**HUD Layout:**

```
┌─────────────────────────────────┐
│ ♥♥♥♡♡  ⚔ Steel Sword  🛡 Iron │
│         Score: 120    🔑 x2    │
└─────────────────────────────────┘
```

```typescript
class HUD extends Layer {
  override onReady() {
    this.fixed = true;
    this.zIndex = 100;

    // Hearts row
    for (let i = 0; i < gameState.maxHealth; i++) {
      this.addChild(Sprite, {
        texture: "tileset",
        sourceRect: HEART_FULL_RECT,
        centered: false,
        position: new Vec2(4 + i * 10, 4),
      });
    }

    // Sword icon + label
    this.addChild(Sprite, {
      texture: "tileset",
      sourceRect: getSwordRect(gameState.sword),
      centered: false,
      position: new Vec2(60, 2),
    });
    this.addChild(Label, {
      position: new Vec2(76, 4),
      text: gameState.sword.name,
      fontSize: 6,
      color: Color.WHITE,
    });

    // Shield icon + label
    // Score label
    // Key count (conditional)
  }
}
```

**Level Base Scene:**

```typescript
abstract class DungeonLevel extends Scene {
  abstract readonly levelAsset: string;
  abstract readonly nextScene: SceneConstructor;
  protected player!: Player;

  override onReady() {
    TileMap.registerPhysics({
      StaticCollider: StaticCollider as never,
      CollisionShape: CollisionShape as never,
      shapeRect: Shape.rect,
    });

    // Ground layer (walls)
    const map = this.add(TileMap);
    map.tilesetImage = "tileset";
    map.asset = this.levelAsset;
    map.generateCollision({ layer: "ground", allSolid: true, collisionGroup: "world" });

    // Y-sorted entity container
    const entities = this.add(Node2D);
    entities.ySortChildren = true;
    entities.zIndex = 1;

    // Spawn player
    const spawnPos = map.getSpawnPoint("player_start");
    this.player = entities.addChild(Player);
    this.player.position = spawnPos;
    this.player.health = gameState.health;

    // Spawn entities
    const spawned = map.spawnObjects("entities", {
      Skeleton: Skeleton,
      Orc: Orc,
      Chest: Chest,
      HealthPickup: HealthPickup,
      Door: Door,
    });

    // Reparent spawned entities into Y-sorted container
    for (const node of spawned) {
      node.removeSelf();
      entities.addChild(node);
      if (node instanceof Door) {
        node.targetScene = this.nextScene;
      }
    }

    // Enemy weapon → player collision
    this.game?.physics.onOverlap("eWeapon", "player", (weapon, player) => {
      const p = player as Player;
      const w = weapon as EnemyWeaponHitbox;
      p.takeDamage(w.damage, this.player.direction);
    });

    // Camera
    const camera = this.add(Camera);
    camera.follow = this.player;
    camera.smoothing = 0.1;
    camera.zoom = 2;
    camera.bounds = new Rect(0, 0, map.bounds.width, map.bounds.height);

    // HUD
    this.add(HUD);

    // Music
    const bgm = this.addChild(AudioPlayer);
    bgm.stream = "dungeon_bgm";
    bgm.loop = true;
    bgm.bus = "music";
    bgm.volume = 0.4;
    bgm.autoplay = true;

    // Player death handling
    this.player.died.connect(() => {
      const timer = this.addChild(Timer, { duration: 1.0, autostart: true });
      timer.timeout.connect(() => this.switchTo(GameOverScene));
    });
  }
}
```

### Tests for Phase B6

**Manual:** Full playthrough test:
- Title screen → press start → Level 1
- Walk around, kill skeleton, open chest (get sword upgrade)
- Find door, transition to Level 2
- More enemies, locked door, find key, unlock door
- Level 3: tougher enemies, final chest, victory trigger
- Game over: die → game over screen → retry resets to level 1
- Victory: clear level 3 → victory screen with score
- HUD updates correctly throughout
- Music loops, SFX play for all interactions
- Camera shakes on damage

---

## Definition of Done

- [ ] Phase A1: `ySortChildren` property on Node2D, renderer sorts by Y, tests pass
- [ ] Phase A2: Timer node in `@quintus/core`, tests pass
- [ ] Phase B1–B6: Dungeon crawler example is playable start to finish
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes (engine tests + any new unit tests)
- [ ] `pnpm lint` clean
- [ ] Demo runs in browser via `pnpm dev` at the dungeon example route
- [ ] Full playthrough possible: title → 3 levels → victory (or death → game over → retry)
