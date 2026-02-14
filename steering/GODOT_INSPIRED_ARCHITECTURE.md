# Quintus 2.0: A Godot-Inspired Architecture

## Why Godot, Not Pure ECS

The original modernization research proposed a hybrid ECS. But looking more carefully at what Quintus already is and what Godot proves works brilliantly, there's a better path: **a Node/Scene Tree architecture with typed components** — essentially what Quintus 1.0 already intuited, but with Godot's refinements and TypeScript's type system.

Here's the thing: Quintus 1.0 and Godot share DNA. Both use:

- A tree of game objects (Quintus: Stages → Sprites with children; Godot: SceneTree → Nodes)
- Composition via attachable behaviors (Quintus: `sprite.add('2d, platformerControls')`; Godot: scripts on nodes)
- Event-driven communication (Quintus: `on/trigger`; Godot: signals)
- Scene-based level organization (Quintus: `Q.scene()`; Godot: `.tscn` files)

Pure ECS (like Bevy or bitECS) optimizes for cache-coherent iteration over thousands of identical entities. That's great for simulation games, but it's overkill for the kind of games Quintus targets: platformers, puzzle games, top-down RPGs, small action games. For those, **the node tree is faster to build with, easier to reason about, and more natural for LLMs to generate**.

Godot's creators put it well: "Scenes and nodes operate at a higher level than ECS." The right level for a tiny, LLM-friendly engine.

---

## The Core Insight: Quintus Nodes

### Mapping Godot → Quintus 2.0

| Godot | Quintus 2.0 | Notes |
|-------|-------------|-------|
| `Node` | `Node` | Base class, pure logic, no rendering |
| `Node2D` | `Node2D` | 2D transform (x, y, rotation, scale) |
| `Node3D` | `Node3D` | 3D transform (via Three.js) |
| `Sprite2D` | `Sprite` | Sprite sheet rendering |
| `AnimatedSprite2D` | `AnimatedSprite` | Frame-based animation |
| `CharacterBody2D` | `Body` | Movement with collision (move_and_slide) |
| `StaticBody2D` | `StaticBody` | Immovable collision |
| `Area2D` | `Area` | Trigger/overlap detection |
| `RigidBody2D` | `RigidBody` | Physics-simulated |
| `TileMapLayer` | `TileMap` | Tile-based levels |
| `Camera2D` | `Camera` | Viewport following |
| `Control` | `UINode` | UI elements (rect-based layout) |
| `AudioStreamPlayer` | `AudioPlayer` | Sound playback |
| `CanvasLayer` | `Layer` | Rendering layer (z-isolation) |
| Scene (`.tscn`) | `Prefab` / scene function | Reusable node trees |
| Signal | `signal` / typed events | Observer pattern |
| Group | `tag` | Tagging & group queries |
| `@export` | `@prop` decorator or props object | Inspector-visible / serializable |
| `_ready()` | `ready()` | Called when node + children are in tree |
| `_process(delta)` | `update(dt)` | Per-frame update |
| `_physics_process(delta)` | `fixedUpdate(dt)` | Fixed timestep |
| `_input(event)` | `input(event)` | Input handling |
| `GDExtension` | Plugin system | Native extension mechanism |

### What Quintus Adds That Godot Can't

1. **Runs in any browser with zero build step** — `<script src="quintus.js">` still works
2. **TypeScript types as the "editor"** — No visual editor, but types + IDE = same productivity
3. **LLM-optimized API** — Designed for AI code generation from day one
4. **Tiny** — 15-50KB vs Godot's 30MB+ export
5. **Three.js for 3D** — Leverage the entire Three.js ecosystem instead of a custom renderer
6. **Plugin ecosystem via npm** — Not a walled garden

---

## Architecture in Detail

### 1. The Node Tree

Everything in Quintus 2.0 is a Node. Nodes form a tree. The tree is the game.

```typescript
// Base Node — pure logic container
class Node {
  name: string;
  parent: Node | null;
  children: Node[];
  tags: Set<string>;

  // Lifecycle (override these)
  ready(): void {}              // Called after node + all children enter tree
  update(dt: number): void {}   // Called every frame
  fixedUpdate(dt: number): void {} // Called at fixed timestep (60hz default)
  input(event: InputEvent): void {} // Called on input events
  destroyed(): void {}          // Called when removed from tree

  // Tree manipulation
  addChild(node: Node): this;
  addChild<T extends Node>(NodeClass: NodeConstructor<T>, props?: Partial<T>): T;
  removeChild(node: Node): void;
  getChild<T extends Node>(type: NodeConstructor<T>): T | null;
  getChildren<T extends Node>(type: NodeConstructor<T>): T[];
  find(name: string): Node | null;       // Find by name in subtree
  findAll(tag: string): Node[];          // Find by tag in subtree

  // Tag system (Godot's groups, simplified)
  tag(...tags: string[]): this;
  untag(...tags: string[]): this;
  hasTag(tag: string): boolean;

  // Scene-wide queries (searches entire tree, not just subtree)
  scene: Scene;
  scene.findAll(tag: string): Node[];
  scene.findByType<T>(type: NodeConstructor<T>): T[];

  // Lifecycle control
  paused: boolean;               // Skip update/fixedUpdate when paused
  processMode: ProcessMode;      // 'inherit' | 'always' | 'paused' | 'disabled'
  visible: boolean;              // Skip rendering (inherited by children)
  destroy(): void;               // Remove from tree + cleanup
}
```

**Why a tree, not a flat list?** Because games are naturally hierarchical. A player has a sprite, a collision shape, a weapon attachment point, and a health bar. The weapon has its own sprite and collision. In a tree, transforms cascade naturally — move the player, everything moves. Destroy the player, everything cleans up. This is what Godot gets right and what pure ECS makes awkward.

### 2. Node2D — The 2D Game Object

```typescript
class Node2D extends Node {
  // Transform (relative to parent)
  position: Vec2;       // { x, y }
  rotation: number;     // Radians
  scale: Vec2;          // { x, y }, default (1, 1)
  skew: Vec2;           // Optional

  // Computed (world-space, read-only)
  get globalPosition(): Vec2;
  get globalRotation(): number;
  get globalScale(): Vec2;
  get globalTransform(): Matrix2D;

  // Convenience
  lookAt(target: Vec2): void;
  moveToward(target: Vec2, speed: number, dt: number): void;

  // Rendering
  zIndex: number;        // Draw order within same layer
  modulate: Color;       // Tint (inherited by children)
  selfModulate: Color;   // Tint (NOT inherited)
  visible: boolean;      // Hide self + children

  // Custom drawing (like Godot's _draw())
  draw(ctx: DrawContext): void {}
}
```

**The transform cascade is key.** When you write `player.position.x += 5`, the player's weapon, health bar, and shadow all move too. No manual syncing. This is what Godot does and what makes node trees so productive.

### 3. Signals — Typed Event System

Godot's signals are its secret weapon. They decouple everything without the ceremony of dependency injection or event bus strings. Quintus 2.0 gets typed signals:

```typescript
import { signal, Signal } from 'quintus';

class Player extends Body {
  // Declare signals with their payload types
  readonly died = signal<void>();
  readonly healthChanged = signal<{ current: number; max: number }>();
  readonly coinCollected = signal<{ value: number }>();

  private _health = 3;

  get health() { return this._health; }
  set health(v: number) {
    this._health = Math.max(0, v);
    this.healthChanged.emit({ current: this._health, max: 3 });
    if (this._health <= 0) this.died.emit();
  }

  onAreaEntered(other: Node) {
    if (other.hasTag('coin')) {
      this.coinCollected.emit({ value: (other as Coin).value });
      other.destroy();
    }
  }
}

// Connecting signals — type-safe, autocomplete works
class HUD extends UINode {
  ready() {
    const player = this.scene.findByType(Player)[0];

    // Connect with full type safety
    player.healthChanged.connect(({ current, max }) => {
      this.healthBar.value = current / max;
    });

    player.coinCollected.connect(({ value }) => {
      this.score += value;
      this.scoreLabel.text = `Score: ${this.score}`;
    });

    player.died.connect(() => {
      this.scene.load('game-over');
    });
  }
}

// Signal utilities
signal.once()          // Auto-disconnect after first emit
signal.connectDeferred() // Execute next frame
signal.disconnect(fn)  // Manual disconnect
signal.disconnectAll() // Cleanup (automatic on destroy)

// Await signals (like Godot 4.x)
async ready() {
  await this.scene.findByType(Player)[0].died;
  this.scene.load('game-over');
}
```

**Why signals over Quintus 1.0's `on/trigger`?** Three reasons: type safety (the payload is typed), discoverability (signals are declared on the class, so LLMs and IDEs can see them), and Godot has proven they scale to real games.

**But keep namespaced events too** for dynamic, ad-hoc communication:

```typescript
// Signals for structured, typed, discoverable events
player.died.connect(handler);

// Events for dynamic, string-based, ad-hoc events
player.on('custom-thing', handler);
player.emit('custom-thing', data);
```

### 4. Scene System — Reusable Node Trees

In Godot, a "scene" is a saved tree of nodes that can be instantiated. In Quintus 2.0, scenes are functions or classes that produce node trees — and they double as prefabs:

```typescript
import { Scene, Sprite, Body, TileMap, Camera, AudioPlayer } from 'quintus';

// A scene is a function that builds a node tree
const Level1 = Scene.define('level1', (scene) => {
  // Load tilemap
  const map = scene.add(TileMap, {
    asset: 'levels/level1.json',
    tileSet: 'tiles',
  });

  // Player (a reusable prefab — see below)
  const player = scene.add(PlayerPrefab, {
    position: map.getSpawnPoint('player-start'),
  });

  // Camera follows player
  scene.add(Camera, {
    follow: player,
    smoothing: 0.1,
    bounds: map.bounds,
    zoom: 2,
  });

  // Spawn enemies from map objects
  for (const obj of map.getObjects('enemies')) {
    scene.add(GoombaPreab, {
      position: obj.position,
      ...obj.properties,    // Custom properties from Tiled
    });
  }

  // Background music
  scene.add(AudioPlayer, {
    stream: 'music/level1.ogg',
    autoplay: true,
    loop: true,
    volume: 0.7,
  });

  // UI overlay (separate rendering layer, like Godot's CanvasLayer)
  const ui = scene.add(Layer, { zIndex: 100 });
  ui.add(HealthBar, { player });
  ui.add(ScoreDisplay);
  ui.add(MiniMap, { map, player });
});

// Start the game
const game = new Game({ width: 320, height: 240, scale: 'fit', pixelArt: true });
game.load({ sprites: ['hero.png'], maps: ['level1.json'] });
game.start(Level1);
```

### 5. Prefabs — Scene Inheritance

Godot's killer feature: scenes that compose other scenes, with instance-specific overrides. In Quintus 2.0, prefabs are factory functions or classes:

```typescript
// === Method 1: Class-based prefab (best for complex entities) ===

class Player extends Body {
  // Exported props (like Godot's @export) — serializable, tweakable
  @prop speed = 200;
  @prop jumpForce = -400;
  @prop maxHealth = 3;

  // Signals
  readonly died = signal<void>();
  readonly healthChanged = signal<{ current: number; max: number }>();

  health = this.maxHealth;

  // Build the subtree (like Godot's scene composition)
  ready() {
    // Visual
    this.add(AnimatedSprite, {
      spriteSheet: 'hero',
      defaultAnim: 'idle',
    });

    // Collision shape
    this.add(CollisionShape, {
      shape: 'rect',
      width: 14,
      height: 24,
      offset: { x: 0, y: 4 },
    });

    // Weapon attachment point
    this.add(WeaponMount, {
      offset: { x: 8, y: -2 },
    });

    // Dust particles when running
    this.add(ParticleEmitter, {
      texture: 'dust',
      emitting: false,
    });

    // Sounds
    this.add(AudioPlayer, { name: 'sfx-jump', stream: 'sfx/jump.wav' });
    this.add(AudioPlayer, { name: 'sfx-hurt', stream: 'sfx/hurt.wav' });
  }

  update(dt: number) {
    const input = this.game.input;
    const sprite = this.getChild(AnimatedSprite)!;
    const particles = this.getChild(ParticleEmitter)!;

    // Movement
    this.velocity.x = 0;
    if (input.isPressed('left'))  this.velocity.x = -this.speed;
    if (input.isPressed('right')) this.velocity.x = this.speed;

    // Jumping
    if (input.isJustPressed('jump') && this.isOnFloor()) {
      this.velocity.y = this.jumpForce;
      this.find('sfx-jump')!.play();
    }

    // Animations
    if (!this.isOnFloor()) {
      sprite.play(this.velocity.y < 0 ? 'jump' : 'fall');
    } else if (this.velocity.x !== 0) {
      sprite.play('run');
      sprite.flipH = this.velocity.x < 0;
      particles.emitting = true;
    } else {
      sprite.play('idle');
      particles.emitting = false;
    }

    // Move with collision (Godot's move_and_slide equivalent)
    this.moveAndSlide(dt);
  }

  hurt(amount: number) {
    if (this.invulnerable) return;
    this.health -= amount;
    this.healthChanged.emit({ current: this.health, max: this.maxHealth });
    this.find('sfx-hurt')!.play();

    // Flash effect
    this.tween({ modulate: Color.RED }, 0.1)
        .then({ modulate: Color.WHITE }, 0.1)
        .repeat(3);

    if (this.health <= 0) {
      this.died.emit();
      this.destroy();
    }
  }
}


// === Method 2: Function prefab (good for simple/variant entities) ===

function Goomba(props: { patrol?: boolean; speed?: number } = {}) {
  return (parent: Node) => {
    const body = parent.add(Body, {
      gravity: 800,
    });

    body.tag('enemy', 'stompable');

    body.add(AnimatedSprite, {
      spriteSheet: 'goomba',
      defaultAnim: 'walk',
    });

    body.add(CollisionShape, {
      shape: 'rect',
      width: 16,
      height: 16,
    });

    // Optional patrol behavior
    if (props.patrol !== false) {
      body.add(PatrolBehavior, {
        speed: props.speed ?? 30,
        turnOnEdge: true,
        turnOnWall: true,
      });
    }

    return body;
  };
}

// Use it
scene.add(Goomba({ speed: 50 }), { position: { x: 300, y: 100 } });


// === Method 3: Prefab inheritance (like Godot's inherited scenes) ===

class FastGoomba extends Goomba {
  @prop speed = 80;          // Override default speed

  ready() {
    super.ready();           // Parent builds the subtree
    this.getChild(AnimatedSprite)!.modulate = Color.RED;  // Tint red
  }
}
```

### 6. Physics Bodies — Godot's Best Ideas

Godot's body type hierarchy is its most copied feature. It's simple, covers 95% of use cases, and maps perfectly to HTML5:

```typescript
// === Body (Godot's CharacterBody2D) ===
// YOU control movement, engine handles collision
class Body extends Node2D {
  velocity: Vec2 = Vec2.ZERO;
  gravity: number;  // Inherited from scene physics or overridden

  // Godot's move_and_slide — the killer feature
  moveAndSlide(dt: number): void;

  // Query collision state after moveAndSlide
  isOnFloor(): boolean;
  isOnWall(): boolean;
  isOnCeiling(): boolean;
  getSlideCollisions(): CollisionInfo[];
  getLastSlideCollision(): CollisionInfo | null;

  // Lower-level: move and get collision info
  moveAndCollide(motion: Vec2): CollisionInfo | null;

  // Collision config
  collisionLayer: number;   // What I AM (bitmask)
  collisionMask: number;    // What I SEE (bitmask)
}


// === StaticBody ===
// Doesn't move (or moves kinematically), blocks others
class StaticBody extends Node2D {
  // For moving platforms
  constantVelocity: Vec2 = Vec2.ZERO;

  collisionLayer: number;
}


// === RigidBody (optional — most games don't need this) ===
// Full physics simulation
class RigidBody extends Node2D {
  mass: number = 1;
  linearVelocity: Vec2 = Vec2.ZERO;
  angularVelocity: number = 0;
  friction: number = 0.5;
  bounce: number = 0;
  gravityScale: number = 1;

  applyForce(force: Vec2): void;
  applyImpulse(impulse: Vec2): void;
  applyTorque(torque: number): void;
}


// === Area (Godot's Area2D) ===
// Detects overlaps, doesn't block
class Area extends Node2D {
  // Signals — fire on overlap
  readonly bodyEntered = signal<Body>();
  readonly bodyExited = signal<Body>();
  readonly areaEntered = signal<Area>();
  readonly areaExited = signal<Area>();

  // Query what's inside right now
  getOverlappingBodies(): Body[];
  getOverlappingAreas(): Area[];

  collisionLayer: number;
  collisionMask: number;
  monitorable: boolean;   // Can other areas detect me?
  monitoring: boolean;    // Can I detect others?
}


// === CollisionShape — child of any physics body ===
class CollisionShape extends Node2D {
  shape: Shape2D;   // Rect, Circle, Polygon, Capsule

  // Disabled = temporarily ignore this shape
  disabled: boolean;
}

// Shape definitions
type Shape2D =
  | { type: 'rect'; width: number; height: number }
  | { type: 'circle'; radius: number }
  | { type: 'capsule'; radius: number; height: number }
  | { type: 'polygon'; points: Vec2[] };


// === Collision Layers (Godot-style named layers) ===
// In game config:
const game = new Game({
  physics: {
    gravity: { x: 0, y: 800 },
    layers: {
      player:    1,    // Layer 1
      enemies:   2,    // Layer 2
      world:     3,    // Layer 3
      items:     4,    // Layer 4
      projectiles: 5,  // Layer 5
    },
  },
});

// Usage — readable bitmasks
class Player extends Body {
  collisionLayer = Layers.player;
  collisionMask = Layers.world | Layers.enemies | Layers.items;
}

class EnemyBullet extends Area {
  collisionLayer = Layers.projectiles;
  collisionMask = Layers.player;  // Only hits player
}
```

**Why this over Quintus 1.0's collision?** Quintus 1.0 had collision bitmasks (good!) but everything was a `Sprite` — there was no distinction between "I block things" (StaticBody), "I'm controlled by code" (Body), "I follow physics" (RigidBody), and "I just detect overlaps" (Area). This distinction is why Godot games have so few collision bugs. Each type has exactly the behavior you'd expect.

### 7. The `moveAndSlide` Pattern

This is the single most important API to get right. Godot's `move_and_slide()` is why platformers are easy to make in Godot and painful in engines without it.

```typescript
class Player extends Body {
  @prop speed = 200;
  @prop jumpForce = -400;
  @prop gravity = 800;

  update(dt: number) {
    // Horizontal movement
    this.velocity.x = 0;
    if (this.input.isPressed('left'))  this.velocity.x = -this.speed;
    if (this.input.isPressed('right')) this.velocity.x = this.speed;

    // Gravity
    this.velocity.y += this.gravity * dt;

    // Jump (only on floor)
    if (this.input.isJustPressed('jump') && this.isOnFloor()) {
      this.velocity.y = this.jumpForce;
    }

    // THIS IS THE MAGIC:
    // Moves the body, slides along surfaces, updates velocity,
    // sets floor/wall/ceiling flags. One call.
    this.moveAndSlide(dt);
  }
}
```

Under the hood, `moveAndSlide` does:
1. Apply velocity × dt to get desired motion
2. Cast the collision shape along the motion vector
3. On collision: separate, calculate slide vector along surface
4. Repeat (up to 4 bounces) for remaining motion
5. Update `isOnFloor()` / `isOnWall()` / `isOnCeiling()` flags
6. Update velocity to reflect actual movement (no velocity into walls)

This replaces Quintus 1.0's collision events + manual separation, which required understanding SAT internals.

### 8. Input System — Godot's Action Maps

Godot's input system separates "what the player wants to do" (actions) from "what button they pressed" (events). Quintus 2.0 adopts this:

```typescript
const game = new Game({
  input: {
    actions: {
      // Action name → list of bindings
      left:   ['ArrowLeft', 'KeyA', 'gamepad:left-stick-left', 'gamepad:dpad-left'],
      right:  ['ArrowRight', 'KeyD', 'gamepad:left-stick-right', 'gamepad:dpad-right'],
      jump:   ['Space', 'ArrowUp', 'KeyW', 'gamepad:a'],
      attack: ['KeyZ', 'gamepad:x'],
      pause:  ['Escape', 'gamepad:start'],
    },
  },
});

// Usage in nodes — always use action names, never key codes
class Player extends Body {
  update(dt: number) {
    if (this.input.isPressed('left'))      this.velocity.x = -200;
    if (this.input.isPressed('right'))     this.velocity.x = 200;
    if (this.input.isJustPressed('jump'))  this.jump();
    if (this.input.isJustPressed('attack')) this.attack();

    // Analog input (gamepad sticks)
    const move = this.input.getAxis('left', 'right');  // -1 to 1
    this.velocity.x = move * 200;
  }
}

// Input propagation (Godot-style)
// 1. game.input(event)       — Global
// 2. node.input(event)       — Leaf-to-root (deepest first)
// 3. node.unhandledInput(event)  — Only if not consumed

class PauseMenu extends UINode {
  input(event: InputEvent) {
    if (event.isAction('pause')) {
      this.togglePause();
      event.consume();  // Don't propagate further
    }
  }
}
```

### 9. Animation — AnimatedSprite + Tween

```typescript
// === AnimatedSprite ===
// Frame-based sprite animation (most common for 2D pixel art)

class AnimatedSprite extends Node2D {
  spriteSheet: string;       // Asset name
  animations: AnimationMap;  // Auto-loaded from sprite sheet JSON
  currentAnim: string;
  frame: number;
  playing: boolean;
  speed: number = 1;
  flipH: boolean;
  flipV: boolean;

  readonly animationFinished = signal<string>();

  play(name: string, restart?: boolean): void;
  stop(): void;
  pause(): void;
}

// Animation map (JSON alongside sprite sheet)
// hero.sprites.json:
{
  "texture": "hero.png",
  "frameWidth": 16,
  "frameHeight": 24,
  "animations": {
    "idle":  { "frames": [0, 1], "fps": 4, "loop": true },
    "run":   { "frames": [2, 3, 4, 5], "fps": 12, "loop": true },
    "jump":  { "frames": [6], "loop": false },
    "fall":  { "frames": [7], "loop": false },
    "hurt":  { "frames": [8, 9], "fps": 10, "loop": false },
    "death": { "frames": [10, 11, 12, 13], "fps": 8, "loop": false }
  }
}


// === Tween System (Godot 4.x style) ===
// Code-driven, one-shot animations

class Player extends Body {
  hurt(amount: number) {
    // Flash red, then restore
    this.tween()
      .property(this, 'modulate', Color.RED, 0.05)
      .then()
      .property(this, 'modulate', Color.WHITE, 0.05)
      .repeat(3)
      .onComplete(() => { this.invulnerable = false; });

    // Or chain different animations
    this.tween()
      .property(this, 'position:y', this.position.y - 20, 0.2, Ease.quadOut)
      .then()
      .property(this, 'position:y', this.position.y, 0.2, Ease.quadIn)
      .parallel()
      .property(this, 'modulate:a', 0, 0.4);
  }
}

// Tween API
node.tween()
  .property(target, path, endValue, duration, easing?)
  .then()             // Sequential — wait for previous to finish
  .parallel()         // Parallel — run alongside previous
  .delay(seconds)     // Wait
  .callback(fn)       // Call function
  .repeat(count)      // Repeat chain (Infinity for forever)
  .onComplete(fn)     // When entire tween finishes
  .kill()             // Cancel
```

### 10. Tags & Groups — Godot Groups, Simplified

```typescript
// Tag nodes for querying
class Goomba extends Body {
  ready() {
    this.tag('enemy', 'stompable');
  }
}

class Spike extends StaticBody {
  ready() {
    this.tag('enemy', 'hazard');  // enemy but NOT stompable
  }
}

class Coin extends Area {
  ready() {
    this.tag('item', 'coin');
  }
}

// Query by tag
const enemies = this.scene.findAll('enemy');        // All enemies
const stompable = this.scene.findAll('stompable');  // Just stompable ones

// Call method on all tagged nodes (Godot's call_group)
this.scene.callGroup('enemy', 'freeze');

// Signal all tagged nodes
this.scene.emitToGroup('enemy', 'player-died');

// Count
const remaining = this.scene.count('coin');
if (remaining === 0) this.scene.load('victory');
```

### 11. Rendering — Layers + Draw Order

```typescript
// === Z-Index (within same layer) ===
// Higher = drawn on top
class Background extends Sprite {
  zIndex = -10;  // Behind everything
}
class Player extends Body {
  zIndex = 0;    // Default
}
class ForegroundDecor extends Sprite {
  zIndex = 10;   // In front of gameplay
}

// === Layers (Godot's CanvasLayer) ===
// Each layer has its own z-space and can have its own transform
// (useful for UI that doesn't scroll with the camera)

const Level1 = Scene.define('level1', (scene) => {
  // Game layer (default, scrolls with camera)
  const map = scene.add(TileMap, { asset: 'level1.json' });
  const player = scene.add(Player, { x: 100, y: 200 });

  scene.add(Camera, { follow: player });

  // Parallax background layer (scrolls slower)
  const bgLayer = scene.add(Layer, {
    zIndex: -100,
    parallax: { x: 0.5, y: 0.3 },  // Scrolls at half speed
  });
  bgLayer.add(Sprite, { texture: 'mountains.png' });
  bgLayer.add(Sprite, { texture: 'clouds.png', zIndex: 1 });

  // UI layer (doesn't scroll at all)
  const uiLayer = scene.add(Layer, {
    zIndex: 100,
    fixed: true,  // Ignores camera transform
  });
  uiLayer.add(HealthBar, { player });
  uiLayer.add(ScoreDisplay);
});


// === Custom Drawing (Godot's _draw) ===
class LaserBeam extends Node2D {
  from: Vec2 = Vec2.ZERO;
  to: Vec2 = Vec2.ZERO;
  width = 3;
  color = Color.RED;

  draw(ctx: DrawContext) {
    ctx.line(this.from, this.to, { width: this.width, color: this.color });
    ctx.circle(this.to, this.width * 2, { fill: Color.WHITE });
  }
}

// DrawContext wraps Canvas2D/WebGL with a clean API
interface DrawContext {
  line(from: Vec2, to: Vec2, style: LineStyle): void;
  rect(pos: Vec2, size: Vec2, style: ShapeStyle): void;
  circle(center: Vec2, radius: number, style: ShapeStyle): void;
  polygon(points: Vec2[], style: ShapeStyle): void;
  text(text: string, pos: Vec2, style: TextStyle): void;
  sprite(texture: string, pos: Vec2, frame?: number): void;
}
```

### 12. Three.js Integration — The 3D Story

This is where Quintus 2.0 goes beyond Godot in the web context. Instead of building a custom 3D renderer, we bridge to Three.js:

```typescript
import { Game, Scene, Node3D, Camera3D } from 'quintus';
import { ThreePlugin } from '@quintus/three';

const game = new Game().use(ThreePlugin);

// === Option A: 2D game with 3D effects layer ===
const Level = Scene.define('level', (scene) => {
  // Normal 2D gameplay
  scene.add(TileMap, { asset: 'level.json' });
  scene.add(Player, { x: 100, y: 200 });

  // 3D effect layer (rendered behind 2D)
  scene.add(ThreeLayer, {
    zIndex: -50,
    setup(three: THREE.Scene) {
      // Volumetric fog, particle effects, dynamic lighting
      three.add(new THREE.AmbientLight(0x404040));
      three.add(createRainEffect());
    },
  });
});

// === Option B: Full 3D game using Quintus patterns ===
const Level3D = Scene.define('3d-level', (scene) => {
  // 3D nodes work like 2D nodes but with Three.js under the hood
  const player = scene.add(MeshNode, {
    geometry: 'box',
    material: { color: 0xff0000 },
    position: { x: 0, y: 1, z: 0 },
  });
  player.tag('player');
  player.add(ThirdPersonController, { speed: 5, jumpForce: 8 });
  player.add(CollisionShape3D, { shape: 'capsule', radius: 0.5, height: 1.8 });

  // Camera
  scene.add(Camera3D, {
    type: 'perspective',
    follow: player,
    offset: { x: 0, y: 5, z: -8 },
    lookAt: player,
  });

  // Environment
  scene.add(GLTFModel, { asset: 'environment.glb' });
  scene.add(DirectionalLight, { position: { x: 5, y: 10, z: 5 } });

  // 2D HUD overlay on top of 3D
  const hud = scene.add(Layer, { fixed: true, zIndex: 100 });
  hud.add(HealthBar, { player });
});

// === Option C: 2D gameplay on 3D surfaces ===
// Think Paper Mario, Octopath Traveler style
const HybridLevel = Scene.define('hybrid', (scene) => {
  // 3D environment
  const world = scene.add(ThreeLayer);
  world.add(GLTFModel, { asset: 'town.glb' });

  // 2D sprites living in 3D space (billboarded)
  const player = scene.add(Billboard, {
    spriteSheet: 'hero',
    position3D: { x: 0, y: 0, z: 0 },
  });
  player.add(PlatformerControls3D);

  // Isometric camera
  scene.add(Camera3D, {
    type: 'orthographic',
    rotation: { x: -30, y: 45, z: 0 },
    follow: player,
  });
});
```

### 13. Resource Loading — Async, Typed, Progressive

```typescript
// === Asset manifest (preload at startup) ===
const game = new Game({
  assets: {
    // Sprites: auto-detects sprite sheets by companion .json
    sprites: [
      'hero.png',           // + hero.sprites.json for animation data
      'enemies.png',
      'tiles.png',
    ],
    // Tilemaps
    maps: ['level1.json', 'level2.json'],
    // Audio
    audio: {
      music: ['level1.ogg', 'boss.ogg'],
      sfx: ['jump.wav', 'coin.wav', 'hit.wav'],
    },
    // 3D models (only if using ThreePlugin)
    models: ['environment.glb'],
  },
});

// === Loading screen (automatic or custom) ===
game.scene('loading', (scene) => {
  const bar = scene.add(ProgressBar, { x: 160, y: 120, width: 200 });

  game.loader.onProgress.connect(({ loaded, total }) => {
    bar.value = loaded / total;
  });

  game.loader.onComplete.connect(() => {
    scene.transition('level1', { fade: 0.5 });
  });
});

// === Runtime loading (for large games) ===
class Portal extends Area {
  @prop targetLevel: string = 'level2';

  async onBodyEntered(body: Body) {
    if (body.hasTag('player')) {
      // Show loading screen, load assets, switch scene
      await this.scene.transition(this.targetLevel, {
        loadingScreen: 'loading',
        assets: game.getSceneAssets(this.targetLevel),
      });
    }
  }
}

// === Asset references (typed) ===
class Coin extends Area {
  @prop texture: SpriteAsset = 'coin';       // Type-checked asset reference
  @prop collectSound: AudioAsset = 'coin';   // Type-checked audio reference
}
```

### 14. Plugin System — npm-Distributed, Self-Describing

```typescript
import { definePlugin } from 'quintus';

// Plugins register new node types, systems, and capabilities
export const DialoguePlugin = definePlugin({
  name: 'dialogue',
  version: '1.0.0',
  description: 'RPG dialogue system with branching conversations',

  // New node types this plugin provides
  nodes: {
    DialogueBox,        // UI node for showing text
    DialogueTrigger,    // Area that starts conversation on enter
    NPCIndicator,       // Floating indicator above NPCs
  },

  // Resources
  assets: {
    loaders: {
      '.dialogue': DialogueFileLoader,  // Custom file format
    },
  },

  // Setup — runs when plugin is used
  setup(game) {
    // Add global dialogue manager
    game.dialogue = new DialogueManager(game);
  },

  // Type augmentation (for TypeScript)
  types: `
    declare module 'quintus' {
      interface Game {
        dialogue: DialogueManager;
      }
    }
  `,
});

// Using the plugin
import { DialoguePlugin } from '@quintus/plugin-dialogue';

const game = new Game().use(DialoguePlugin);

// Now DialogueBox, DialogueTrigger etc. are available
scene.add(DialogueTrigger, {
  asset: 'intro.dialogue',
  npc: 'elder',
});
```

---

## Complete Example: A Platformer

Putting it all together — a full small game showing how all these systems compose:

```typescript
// main.ts
import { Game, Scene, Body, Sprite, AnimatedSprite, Area,
         CollisionShape, TileMap, Camera, Layer, AudioPlayer,
         UINode, Label, ProgressBar, signal } from 'quintus';

// === Game Configuration ===
const game = new Game({
  width: 320,
  height: 240,
  scale: 'fit',
  pixelArt: true,
  backgroundColor: '#87CEEB',
  physics: {
    gravity: { x: 0, y: 800 },
    layers: {
      player: 1,
      enemies: 2,
      world: 3,
      items: 4,
      triggers: 5,
    },
  },
  input: {
    actions: {
      left:   ['ArrowLeft', 'KeyA'],
      right:  ['ArrowRight', 'KeyD'],
      jump:   ['Space', 'ArrowUp', 'KeyW'],
    },
  },
  assets: {
    sprites: ['hero.png', 'enemies.png', 'items.png', 'tiles.png'],
    maps: ['level1.json'],
    audio: {
      music: ['overworld.ogg'],
      sfx: ['jump.wav', 'coin.wav', 'stomp.wav', 'hurt.wav', 'powerup.wav'],
    },
  },
});


// === Player ===
class Player extends Body {
  @prop speed = 120;
  @prop jumpForce = -320;
  @prop maxHealth = 3;

  readonly died = signal<void>();
  readonly healthChanged = signal<{ current: number; max: number }>();
  readonly scoreChanged = signal<number>();

  health = this.maxHealth;
  score = 0;
  invulnerable = false;

  collisionLayer = Layers.player;
  collisionMask = Layers.world | Layers.enemies;

  ready() {
    this.tag('player');

    this.add(AnimatedSprite, { spriteSheet: 'hero', defaultAnim: 'idle' });
    this.add(CollisionShape, { shape: 'rect', width: 12, height: 22, offset: { x: 0, y: 1 } });
    this.add(AudioPlayer, { name: 'sfx', stream: 'jump.wav' });
  }

  update(dt: number) {
    const sprite = this.getChild(AnimatedSprite)!;

    // Move
    this.velocity.x = 0;
    if (this.input.isPressed('left'))  this.velocity.x = -this.speed;
    if (this.input.isPressed('right')) this.velocity.x = this.speed;

    // Jump
    if (this.input.isJustPressed('jump') && this.isOnFloor()) {
      this.velocity.y = this.jumpForce;
      this.find<AudioPlayer>('sfx')!.play('jump.wav');
    }

    // Animate
    if (!this.isOnFloor()) {
      sprite.play(this.velocity.y < 0 ? 'jump' : 'fall');
    } else if (Math.abs(this.velocity.x) > 0) {
      sprite.play('run');
      sprite.flipH = this.velocity.x < 0;
    } else {
      sprite.play('idle');
    }

    this.moveAndSlide(dt);

    // Die if fallen off
    if (this.position.y > 500) this.die();
  }

  collectCoin(value: number) {
    this.score += value;
    this.scoreChanged.emit(this.score);
  }

  hurt(amount: number) {
    if (this.invulnerable) return;
    this.health = Math.max(0, this.health - amount);
    this.healthChanged.emit({ current: this.health, max: this.maxHealth });
    this.find<AudioPlayer>('sfx')!.play('hurt.wav');

    this.invulnerable = true;
    this.tween().property(this, 'modulate:a', 0.3, 0.1)
      .then().property(this, 'modulate:a', 1, 0.1)
      .repeat(5)
      .onComplete(() => { this.invulnerable = false; });

    if (this.health <= 0) this.die();
  }

  die() {
    this.died.emit();
  }
}


// === Enemies ===
class Goomba extends Body {
  @prop speed = 30;
  direction = 1;

  collisionLayer = Layers.enemies;
  collisionMask = Layers.world | Layers.player;

  ready() {
    this.tag('enemy', 'stompable');
    this.add(AnimatedSprite, { spriteSheet: 'enemies', defaultAnim: 'goomba-walk' });
    this.add(CollisionShape, { shape: 'rect', width: 14, height: 14 });

    // Stomp detection area (slightly above the goomba)
    const stompZone = this.add(Area, { name: 'stomp-zone' });
    stompZone.add(CollisionShape, {
      shape: 'rect', width: 16, height: 6,
      offset: { x: 0, y: -10 },
    });
    stompZone.collisionMask = Layers.player;
    stompZone.bodyEntered.connect((body) => {
      if (body.hasTag('player') && body.velocity.y > 0) {
        this.stomp(body as Player);
      }
    });
  }

  update(dt: number) {
    this.velocity.x = this.speed * this.direction;
    this.moveAndSlide(dt);

    // Turn around on walls
    if (this.isOnWall()) this.direction *= -1;
    this.getChild(AnimatedSprite)!.flipH = this.direction < 0;
  }

  stomp(player: Player) {
    player.velocity.y = -200;  // Bounce player up
    this.getChild(AnimatedSprite)!.play('goomba-squish');
    this.find<AudioPlayer>('sfx')?.play('stomp.wav');

    // Flatten and remove after short delay
    this.tween()
      .property(this, 'scale:y', 0.2, 0.15)
      .then().delay(0.3)
      .then().callback(() => this.destroy());
  }
}


// === Items ===
class Coin extends Area {
  @prop value = 10;

  collisionMask = Layers.player;

  ready() {
    this.tag('coin', 'item');
    this.add(AnimatedSprite, { spriteSheet: 'items', defaultAnim: 'coin-spin' });
    this.add(CollisionShape, { shape: 'circle', radius: 6 });

    this.bodyEntered.connect((body) => {
      if (body.hasTag('player')) {
        (body as Player).collectCoin(this.value);
        // Float up and fade out
        this.tween()
          .property(this, 'position:y', this.position.y - 20, 0.3, Ease.quadOut)
          .parallel()
          .property(this, 'modulate:a', 0, 0.3)
          .onComplete(() => this.destroy());
      }
    });
  }
}


// === HUD ===
class HUD extends UINode {
  private hearts: Sprite[] = [];
  private scoreLabel!: Label;

  ready() {
    const player = this.scene.findByType(Player)[0];

    // Hearts
    for (let i = 0; i < player.maxHealth; i++) {
      this.hearts.push(this.add(Sprite, {
        texture: 'items', frame: 'heart-full',
        position: { x: 10 + i * 18, y: 10 },
      }));
    }

    // Score
    this.scoreLabel = this.add(Label, {
      text: 'Score: 0',
      position: { x: 160, y: 10 },
      font: '8px pixel',
      color: Color.WHITE,
      shadow: Color.BLACK,
    });

    // Connect signals
    player.healthChanged.connect(({ current }) => {
      this.hearts.forEach((h, i) => {
        h.frame = i < current ? 'heart-full' : 'heart-empty';
      });
    });

    player.scoreChanged.connect((score) => {
      this.scoreLabel.text = `Score: ${score}`;
    });
  }
}


// === Scenes ===
const Level1 = Scene.define('level1', (scene) => {
  const map = scene.add(TileMap, { asset: 'level1.json', tileSet: 'tiles' });
  const player = scene.add(Player, { position: map.getSpawnPoint('start') });

  // Spawn objects from Tiled map
  map.spawnObjects({
    goomba: Goomba,
    coin: Coin,
  });

  // Camera
  scene.add(Camera, {
    follow: player,
    smoothing: 0.08,
    bounds: map.bounds,
    zoom: 2,
  });

  // Background
  const bg = scene.add(Layer, { zIndex: -100, parallax: { x: 0.3, y: 0.5 } });
  bg.add(Sprite, { texture: 'background' });

  // UI (fixed, doesn't scroll)
  const ui = scene.add(Layer, { zIndex: 100, fixed: true });
  ui.add(HUD);

  // Music
  scene.add(AudioPlayer, { stream: 'overworld.ogg', autoplay: true, loop: true, volume: 0.5 });

  // Win condition
  const goal = scene.add(Area, { position: map.getSpawnPoint('goal') });
  goal.add(CollisionShape, { shape: 'rect', width: 16, height: 32 });
  goal.collisionMask = Layers.player;
  goal.bodyEntered.connect(() => scene.transition('victory', { fade: 0.5 }));

  // Lose condition
  player.died.connect(() => scene.transition('game-over', { fade: 0.3 }));
});

const Victory = Scene.define('victory', (scene) => {
  scene.add(Label, {
    text: 'You Win!',
    position: { x: 160, y: 100 },
    font: '16px pixel',
    align: 'center',
  });

  scene.add(Button, {
    text: 'Play Again',
    position: { x: 160, y: 160 },
    onPressed: () => scene.transition('level1'),
  });
});


// === Start ===
game.start(Level1);
```

---

## Summary: Godot Ideas Adopted vs. Rejected

### Adopted (fits Quintus perfectly)

| Godot Feature | Quintus 2.0 Adaptation | Why |
|---------------|----------------------|-----|
| **Node tree** | `Node` base class, parent/child hierarchy | Natural for games, transform cascade, cleanup |
| **Scenes as prefabs** | `Scene.define()` + class-based prefabs | Reusable, composable, instancable |
| **Signals** | Typed `signal<T>()` declarations | Type-safe, discoverable, proven at scale |
| **Body types** | `Body`, `StaticBody`, `RigidBody`, `Area` | Clear intent, fewer collision bugs |
| **moveAndSlide** | `Body.moveAndSlide(dt)` | Single most productive platformer API |
| **Input actions** | Named actions with multiple bindings | Rebindable, gamepad-friendly |
| **Groups** | `tag()` + `scene.findAll(tag)` | Simpler API, same power |
| **Collision layers** | Named bitmask layers | Readable collision configuration |
| **CanvasLayer** | `Layer` node with parallax/fixed options | Clean rendering separation |
| **Lifecycle** | `ready()`, `update()`, `fixedUpdate()`, `input()` | Predictable, well-ordered |
| **@export** | `@prop` decorator | Serializable, inspectable, tweakable |
| **Tween system** | `node.tween()` builder | Code-driven animation, chainable |
| **Custom draw** | `draw(ctx: DrawContext)` | Procedural graphics without sprites |
| **Process modes** | `processMode: 'always' \| 'paused'` | Pause-aware nodes |

### Adapted (Godot idea, but changed for web/TypeScript)

| Godot Feature | Quintus Adaptation | Why Different |
|---------------|-------------------|---------------|
| **GDScript** | TypeScript | Types > dynamic scripting for LLMs |
| **Visual editor** | IDE + types + hot reload | No desktop editor, but types provide same safety |
| **`.tscn` files** | Scene functions + class prefabs | Code-first, no binary format |
| **`preload()`** | `import` + manifest | ES modules handle static loading |
| **AnimationPlayer** | `AnimatedSprite` + `tween()` | Simpler, covers 90% of 2D needs |
| **GDExtension** | npm plugins + `definePlugin()` | Web ecosystem, not native binaries |
| **Resource system** | Asset manifest + typed refs | Simpler, web-native |
| **Autoloads** | Game-level singletons via plugins | Explicit > magic |

### Rejected (doesn't fit web/tiny engine)

| Godot Feature | Why Not |
|---------------|---------|
| **Visual scene editor** | Quintus is code-first; types + IDE replace the editor |
| **Full 3D renderer** | Three.js peer dep instead — don't reinvent the wheel |
| **Custom shader language** | Use Three.js shaders or CSS filters |
| **Navigation meshes** | Plugin territory, not core |
| **Skeleton animation** | 3D concern, defer to Three.js |
| **Multiplayer framework** | Plugin territory |
| **Tool scripts (editor execution)** | No editor to run in |
| **AnimationTree** | Overkill for 2D; plugin if needed |
| **Audio bus system** | Web Audio API handles routing natively |

---

## Revised Package Structure

Based on the Godot-inspired architecture, the package structure shifts:

```
@quintus/core        ~10KB  — Node, Node2D, Scene, Game, signals, events, game loop
@quintus/math        ~3KB   — Vec2, Vec3, Matrix2D, Color, Rect, math utils
@quintus/physics     ~10KB  — Body, StaticBody, RigidBody, Area, CollisionShape,
                              moveAndSlide, SAT, spatial hash
@quintus/sprites     ~5KB   — Sprite, AnimatedSprite, sprite sheets
@quintus/tilemap     ~5KB   — TileMap, Tiled JSON import, tile collision
@quintus/input       ~4KB   — Input actions, keyboard, mouse, touch, gamepad
@quintus/audio       ~3KB   — AudioPlayer, Web Audio API wrapper
@quintus/ui          ~5KB   — UINode, Label, Button, Container, ProgressBar
@quintus/tween       ~3KB   — Tween builder, easing functions
@quintus/camera      ~3KB   — Camera node, follow, shake, zoom, bounds
@quintus/particles   ~4KB   — ParticleEmitter, GPU particles
@quintus/three       ~5KB   — ThreeLayer, MeshNode, Camera3D, Three.js bridge
@quintus/debug       ~4KB   — FPS, node inspector, collision visualization

quintus              ~40KB  — Meta-package: core + physics + sprites + tilemap +
                              input + audio + ui + tween + camera
                              (everything except three/particles/debug)
```

**Why this is smaller than the ECS proposal:** No separate collision, scene, prefab, or renderer packages. The node tree IS the scene graph, IS the renderer's draw list, IS the collision world. One tree to rule them all — just like Godot.
