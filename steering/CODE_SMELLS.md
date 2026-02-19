# API Ergonomics: Code Smell Fixes — Detailed Design

> **Goal:** Eliminate recurring boilerplate, type unsafety, and API friction discovered during examples review — making the engine delightful for both humans and LLMs.
> **Outcome:** All existing examples rewritten to be clean, idiomatic, and copy-paste ready as templates for future games.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Type narrowing & lifecycle guarantees | Pending |
| 2 | Unified `add()` API + props pattern | Pending |
| 3 | Type guards & typed queries | Pending |
| 4 | TileMap physics side-effect import | Pending |
| 5 | Convenience methods (`after`, `interval`) | Pending |
| 6 | Reactive state helper | Pending |
| 7 | Constants registry | Pending |
| 8 | Tween & minor API polish | Pending |
| 9 | Update all examples | Pending |

---

## Phase 1: Type Narrowing & Lifecycle Guarantees

The single most repeated boilerplate is the null-check ceremony:

```typescript
// This appears in EVERY entity in EVERY example:
const input = this.game?.input;
if (!input) return;
```

`onReady()`, `onUpdate()`, `onFixedUpdate()`, and `onDestroy()` only fire when a node is inside the tree, so `game` and `scene` are guaranteed non-null. The types should reflect this.

### Approach: Non-Null Lifecycle Accessors

Add a set of non-null property accessors on `Node` that throw if called outside the tree, but are guaranteed safe inside lifecycle hooks:

**File: `packages/core/src/node.ts`**

```typescript
/**
 * The Game this node belongs to. Throws if not inside tree.
 * Safe to call in onReady(), onUpdate(), onFixedUpdate(), onDestroy().
 */
get game!(): Game {
  // Note: can't use `!` on getters — implement with runtime assert
}
```

TypeScript doesn't support `!` on getters. Two options:

#### Option A: Separate `requireGame()` / `requireScene()` methods

```typescript
/** Guaranteed non-null. Call in lifecycle hooks only. */
requireGame(): Game {
  const g = this.game;
  if (!g) throw new Error(`${this.name} is not in the scene tree`);
  return g;
}

requireScene(): Scene {
  const s = this.scene;
  if (!s) throw new Error(`${this.name} is not in the scene tree`);
  return s;
}
```

**Pro:** Clear naming, no type lie. **Con:** Verbose, `this.requireGame().input` every frame.

#### Option B: Non-null getters that only lie about nullability (Recommended)

Override the getter return types via `declare` in a separate `.d.ts` augmentation that narrows within lifecycle hooks. This is fragile and confusing.

#### Option C: Protected non-null properties set on tree entry (Recommended)

When a node enters the tree, set `protected _scene: Scene` and `protected _game: Game` as concrete references (not walked on every access). Clear them on tree exit.

```typescript
// In Node class:
protected _scene!: Scene;  // Set on tree entry, cleared on tree exit
protected _game!: Game;    // Derived from _scene.game

// Lifecycle methods receive strongly-typed context:
get scene(): Scene | null {
  return this._isInsideTree ? this._scene : null;
}

// But also provide the non-null version used in subclasses:
/** @internal Non-null scene ref. Only valid inside tree. */
protected get $scene(): Scene { return this._scene; }
protected get $game(): Game { return this._game; }
```

Wait — this adds two new accessors that feel hacky. Let's go simpler.

#### Option D: Just narrow the getter types (Simplest, Recommended)

Change `get game()` to return `Game` (non-null). The getter already walks up to the scene root. If called outside the tree, it returns `null` at runtime — but for lifecycle hooks (the 99% case), it's correct. Add a `@throws` JSDoc.

This is a small type lie, but it matches how every game engine works. Unity's `gameObject` doesn't return nullable. Godot's `get_tree()` doesn't return nullable in GDScript.

```typescript
// packages/core/src/node.ts
get scene(): Scene {
  // Walk up to root. Returns Scene or throws if not in tree.
  let current: Node = this;
  while (current) {
    if ((current as any)._isScene) return current as Scene;
    if (!current._parent) break;
    current = current._parent;
  }
  throw new Error(`${this.name}.scene accessed outside the scene tree`);
}

get game(): Game {
  return this.scene.game;
}
```

**This is the right call.** Accessing `.game` or `.scene` outside the tree is a bug — we should fail loud, not return null silently. Every example's null checks become dead code and can be removed.

### Deliverables

- [ ] Change `Node.scene` return type from `Scene | null` to `Scene`, throw if outside tree
- [ ] Change `Node.game` return type from `Game | null` to `Game`, throw if outside tree
- [ ] Add `Node.sceneOrNull` and `Node.gameOrNull` for the rare case someone needs the nullable version
- [ ] Update `Scene.game` override to match (already returns `Game`, no change needed)
- [ ] Update all tests that relied on `game` being `null` before tree entry
- [ ] Verify `pnpm build` and `pnpm test` pass

### Tests

**Unit: `packages/core/src/node.test.ts`**
- `node.game` throws when node is not in tree
- `node.game` returns `Game` when node is in tree (inside `onReady`, `onUpdate`, `onFixedUpdate`)
- `node.gameOrNull` returns `null` when not in tree, `Game` when in tree
- Same suite for `node.scene`

---

## Phase 2: Unified `add()` API + Props Pattern

### Problem

Examples mix `addChild()` and `add()` inconsistently. `add()` only exists on `Scene`. The `CollisionShape` chaining pattern feels accidental:

```typescript
// Current — chained assignment on return value, feels like a side effect
this.addChild(CollisionShape).shape = Shape.rect(14, 24);

// Could already be (addChild supports props!):
this.addChild(CollisionShape, { shape: Shape.rect(14, 24) });
```

### Approach

1. **Promote `add()` to `Node`** (not just Scene). It's the same as `addChild()` with a better name.
2. **Remove `addChild()` from public API.** Make it `protected` or `@internal`. This is not in production — no deprecation needed.
3. **Ensure props pattern works for all common cases**, especially CollisionShape.

### Changes

**File: `packages/core/src/node.ts`**

```typescript
// Rename addChild → add on Node
add(node: Node): this;
add<T extends Node>(NodeClass: NodeConstructor<T>, props?: Partial<T>): T;
add(nodeOrClass: Node | NodeConstructor<Node>, props?: Partial<Node>): Node | this {
  if (typeof nodeOrClass === "function") {
    const node = new nodeOrClass();
    if (props) Object.assign(node, props);
    this._addChildNode(node);
    return node;
  }
  this._addChildNode(nodeOrClass);
  return this;
}
```

**File: `packages/core/src/scene.ts`**

Remove the `add()` overloads from Scene — it inherits from Node now.

**Usage in examples becomes:**

```typescript
// Before (mixed patterns):
this.addChild(CollisionShape).shape = Shape.rect(14, 24);
const sprite = this.addChild(AnimatedSprite);
sprite.spriteSheet = entitySheet;

// After (consistent):
this.add(CollisionShape, { shape: Shape.rect(14, 24) });
this.add(AnimatedSprite, { spriteSheet: entitySheet, animation: "idle" });

// Scene-level spawning (same API):
const player = this.add(Player);
player.position.set(100, 200);

// Or with props:
this.add(Player, { position: new Vec2(100, 200) });
```

### AnimatedSprite Props

The `AnimatedSprite` class needs a way to accept `spriteSheet` and initial animation via props. Check if `Object.assign` handles the `spriteSheet` setter correctly — it should, since setters are assignable.

For `play()` as a constructor option, add an `animation` property:

**File: `packages/sprites/src/animated-sprite.ts`**

```typescript
/** If set, auto-plays this animation on ready. */
animation: string | null = null;

override onReady(): void {
  if (this.animation) this.play(this.animation);
}
```

This enables: `this.add(AnimatedSprite, { spriteSheet: sheet, animation: "run" })`.

### Deliverables

- [ ] Move `add()` from Scene to Node (with same overloads)
- [ ] Rename old `addChild()` to `_addChildNode()` (already exists as private), make `addChild` `@internal`
- [ ] Update Scene to inherit `add()` from Node (remove duplicate)
- [ ] Add `animation` prop to AnimatedSprite for auto-play on ready
- [ ] Global find-and-replace: `addChild(` → `add(` across all examples and engine code
- [ ] Switch examples to use props pattern where it improves readability
- [ ] Verify `pnpm build` and `pnpm test` pass

### Tests

**Unit: `packages/core/src/node.test.ts`**
- `node.add(ChildClass)` creates and returns instance of `ChildClass`
- `node.add(ChildClass, { name: "test" })` assigns props
- `node.add(existingNode)` adds and returns `this` for chaining
- `scene.add(Player, { position: new Vec2(10, 20) })` sets position

**Unit: `packages/sprites/src/animated-sprite.test.ts`**
- AnimatedSprite with `animation` prop auto-plays on ready

---

## Phase 3: Type Guards & Typed Queries

### Problem

Collision callbacks deliver `CollisionObject` and game code needs specific types. The current pattern is unsafe:

```typescript
// Dungeon weapon-hitbox — runtime duck-typing, defeats TypeScript
if (body.hasTag("enemy") &&
    typeof (body as Record<string, unknown>).takeDamage === "function") {
  (body as { takeDamage: (n: number, d?: Vec2) => void }).takeDamage(10, dir);
}
```

### Approach: `is<T>()` Type Guard + Typed `findAll`

#### 3a. Node Type Guard

Add an `is<T>()` method to Node that serves as a TypeScript type guard:

**File: `packages/core/src/node.ts`**

```typescript
/**
 * Type-narrowing check. Use in collision callbacks and queries.
 *
 * @example
 * this.bodyEntered.connect((body) => {
 *   if (body.is(Player)) {
 *     body.takeDamage(10); // TypeScript knows body is Player
 *   }
 * });
 */
is<T extends Node>(type: NodeConstructor<T>): this is T {
  return this instanceof type;
}
```

Usage:

```typescript
// Before:
if (body.hasTag("enemy") && typeof (body as any).takeDamage === "function") {
  (body as any).takeDamage(10, dir);
}

// After:
if (body.is(BaseEnemy)) {
  body.takeDamage(10, dir);  // fully typed, no casts
}
```

This is a one-liner that works with TypeScript's `is` return type narrowing. Tags remain useful for grouping (`"enemy"`, `"collectible"`) but `is()` handles the type narrowing.

#### 3b. Typed `findAll` with Tag + Type

Add an overload to `findAll` that combines tag filtering with type narrowing:

```typescript
// Existing (untyped):
findAll(tag: string): Node[]

// New overload (typed):
findAll<T extends Node>(tag: string, type: NodeConstructor<T>): T[]

// Implementation:
findAll<T extends Node>(tag: string, type?: NodeConstructor<T>): Node[] | T[] {
  const results: Node[] = [];
  this._findAllRecursive(tag, results);
  if (type) return results.filter((n): n is T => n instanceof type);
  return results;
}
```

Also add a convenience `findFirst`:

```typescript
findFirst(tag: string): Node | null;
findFirst<T extends Node>(tag: string, type: NodeConstructor<T>): T | null;
```

Usage:

```typescript
// Before:
const players = this.scene?.findAll("player");
return players[0] as unknown as CollisionObject;

// After:
const player = this.scene.findFirst("player", Player);
// player is Player | null, no casts needed
```

### Deliverables

- [ ] Add `is<T>(type): this is T` to Node
- [ ] Add typed overload to `findAll(tag, type)`
- [ ] Add `findFirst(tag)` and `findFirst<T>(tag, type)` to Node
- [ ] Update examples to use `is()` in collision callbacks
- [ ] Update examples to use typed `findFirst` / `findAll`
- [ ] Verify `pnpm build` and `pnpm test` pass

### Tests

**Unit: `packages/core/src/node.test.ts`**
- `node.is(Player)` returns true for Player instances, false for others
- `node.is(Node2D)` returns true for Node2D subclasses (Actor, etc.)
- Type narrowing works in conditional blocks (compile-time check)
- `scene.findAll("enemy", PatrolEnemy)` returns only PatrolEnemy instances
- `scene.findFirst("player", Player)` returns typed Player or null

---

## Phase 4: TileMap Physics Side-Effect Import

### Problem

Every tilemap example requires this ugly incantation with `as never` casts:

```typescript
TileMap.registerPhysics({
  StaticCollider: StaticCollider as never,
  CollisionShape: CollisionShape as never,
  shapeRect: Shape.rect,
});
```

The `as never` exists because `PhysicsFactories` types `CollisionShape` as `new () => Node2D & { shape: unknown }` — deliberately loose to avoid importing from `@quintus/physics`. This decoupling is architecturally correct but ergonomically awful.

### Approach: Side-Effect Import

Create a bridge module that auto-registers when imported:

**New file: `packages/tilemap/src/physics.ts`**

```typescript
import { StaticCollider, CollisionShape, Shape } from "@quintus/physics";
import { TileMap } from "./tilemap.js";

// Auto-register physics factories on import
TileMap.registerPhysics({
  StaticCollider,
  CollisionShape,
  shapeRect: Shape.rect,
});
```

This requires `@quintus/physics` as an **optional peer dependency** of `@quintus/tilemap`. The bridge file only exists to be imported when both packages are present.

**Usage becomes:**

```typescript
// Before (3 lines of ceremony):
import { StaticCollider, CollisionShape, Shape } from "@quintus/physics";
TileMap.registerPhysics({ StaticCollider: StaticCollider as never, ... });

// After (1 import):
import "@quintus/tilemap/physics";
```

### Package.json Exports

**File: `packages/tilemap/package.json`**

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./physics": {
      "import": "./dist/physics.js",
      "require": "./dist/physics.cjs",
      "types": "./dist/physics.d.ts"
    }
  }
}
```

### Fix the PhysicsFactories Types

Also fix the `PhysicsFactories` interface so it doesn't need casts even for manual registration:

```typescript
export interface PhysicsFactories {
  StaticCollider: new () => Node2D;
  CollisionShape: new () => Node2D;
  shapeRect: (w: number, h: number) => unknown;
}
```

The `& { collisionGroup: string }` and `& { shape: unknown }` constraints are unnecessary — `Object.assign` handles property assignment after construction.

### Deliverables

- [ ] Create `packages/tilemap/src/physics.ts` bridge module
- [ ] Add `./physics` export to tilemap `package.json`
- [ ] Update `tsup.config.ts` to build the additional entry point
- [ ] Simplify `PhysicsFactories` interface (remove intersection types)
- [ ] Add `@quintus/physics` as optional `peerDependencies` in tilemap
- [ ] Update all examples to use `import "@quintus/tilemap/physics"`
- [ ] Verify `pnpm build` and `pnpm test` pass

### Tests

**Unit: `packages/tilemap/src/physics.test.ts`**
- Importing `@quintus/tilemap/physics` auto-registers factories
- `TileMap.generateCollision()` works after side-effect import
- Manual `registerPhysics()` still works (no regression)

---

## Phase 5: Convenience Methods (`after`, `interval`)

### Problem

Creating throwaway Nodes for delays is a recurring anti-pattern:

```typescript
const timer = this.add(Node);
let elapsed = 0;
timer.onUpdate = (dt: number) => {
  elapsed += dt;
  if (elapsed > 0.5) {
    timer.destroy();
    this._goToGameOver();
  }
};
```

The `Timer` node exists but is verbose for one-shot use.

### Approach: Add `after()` and `every()` to Node

**File: `packages/core/src/node.ts`**

```typescript
/**
 * Run a callback after `seconds` have elapsed. The timer auto-destroys.
 * Uses fixedUpdate for deterministic timing.
 *
 * @returns A Timer node that can be cancelled via `.destroy()`
 *
 * @example
 * // Flash invincibility for 2 seconds
 * this.after(2, () => { this.invincible = false; });
 *
 * // Cancel early
 * const timer = this.after(5, () => this.explode());
 * timer.destroy(); // cancelled
 */
after(seconds: number, callback: () => void): Timer {
  const timer = this.add(Timer, { duration: seconds, autostart: true });
  timer.timeout.once(() => {
    callback();
    timer.destroy();
  });
  return timer;
}

/**
 * Run a callback every `seconds`. Returns a Timer for cancellation.
 *
 * @example
 * // Spawn an enemy every 3 seconds
 * this.every(3, () => this.spawnEnemy());
 */
every(seconds: number, callback: () => void): Timer {
  const timer = this.add(Timer, {
    duration: seconds,
    repeat: true,
    autostart: true,
  });
  timer.timeout.connect(callback);
  return timer;
}
```

### Usage in Examples

```typescript
// Before:
const timer = this.add(Node);
let elapsed = 0;
timer.onUpdate = (dt: number) => {
  elapsed += dt;
  if (elapsed > 0.5) { timer.destroy(); this._goToGameOver(); }
};

// After:
this.after(0.5, () => this._goToGameOver());
```

### Deliverables

- [ ] Add `after(seconds, callback)` to Node
- [ ] Add `every(seconds, callback)` to Node
- [ ] Both return the Timer for cancellation
- [ ] Update examples to use `after()` / `every()` instead of manual timer hacks
- [ ] Verify `pnpm build` and `pnpm test` pass

### Tests

**Unit: `packages/core/src/node.test.ts`**
- `node.after(1, cb)` fires callback after 1 second of fixedUpdate steps
- `node.after(1, cb)` auto-destroys the Timer after firing
- Returned Timer can be cancelled via `.destroy()` before firing
- `node.every(0.5, cb)` fires repeatedly at 0.5s intervals
- `node.every(0.5, cb)` Timer persists across firings
- Timer is destroyed when parent node is destroyed

---

## Phase 6: Reactive State Helper

### Problem

Both platformer and dungeon use a bare mutable object for game state, with the HUD polling every frame:

```typescript
// state.ts — bare object, no events
export const gameState = { health: 3, maxHealth: 3, coins: 0 };

// player.ts — direct mutation
gameState.health -= damage;

// hud.ts — polls EVERY frame
onUpdate() {
  this.scoreLabel.text = `Score: ${gameState.score}`;
  for (let i = 0; i < this.hearts.length; i++) {
    this.hearts[i].visible = i < gameState.health;
  }
}
```

### Approach: `ReactiveState<T>` with Signals

Create a lightweight reactive wrapper that emits signals on property changes, built on `Proxy`:

**New file: `packages/core/src/reactive-state.ts`**

```typescript
import { type Signal, signal } from "./signal.js";

type ChangePayload<T, K extends keyof T> = {
  key: K;
  value: T[K];
  previous: T[K];
};

/**
 * A reactive wrapper around a plain state object.
 * Emits `changed` when any property is set to a new value.
 * Emits per-key signals via `on(key)`.
 *
 * @example
 * const state = reactiveState({ health: 3, coins: 0 });
 *
 * // Listen to any change
 * state.changed.connect(({ key, value, previous }) => {
 *   console.log(`${key}: ${previous} → ${value}`);
 * });
 *
 * // Listen to a specific key
 * state.on("health").connect(({ value }) => updateHearts(value));
 *
 * // Read and write normally
 * state.health = 2;        // fires changed + on("health")
 * console.log(state.coins); // 0
 *
 * // Reset to initial values
 * state.reset();
 */
export interface ReactiveState<T extends Record<string, unknown>> {
  /** Fires on any property change. */
  readonly changed: Signal<ChangePayload<T, keyof T & string>>;

  /** Get a signal for a specific property. */
  on<K extends keyof T & string>(key: K): Signal<{ value: T[K]; previous: T[K] }>;

  /** Reset all properties to their initial values. */
  reset(): void;

  /** Snapshot current state as a plain object. */
  snapshot(): Readonly<T>;
}

// The returned proxy IS both T and ReactiveState<T>:
export type ReactiveState<T> = T & ReactiveStateAPI<T>;

export function reactiveState<T extends Record<string, unknown>>(
  initial: T,
): ReactiveState<T> { ... }
```

### Implementation

Uses a `Proxy` that intercepts `set` traps. Per-key signals are lazily created (only allocated when `state.on("health")` is first called). The `reset()` method restores the initial snapshot.

```typescript
export function reactiveState<T extends Record<string, unknown>>(
  initial: T,
): ReactiveState<T> {
  const data = { ...initial };
  const initialSnapshot = { ...initial };
  const changedSignal = signal<ChangePayload<T, keyof T & string>>();
  const keySignals = new Map<string, Signal<any>>();

  function getKeySignal<K extends keyof T & string>(key: K) {
    let s = keySignals.get(key);
    if (!s) { s = signal(); keySignals.set(key, s); }
    return s;
  }

  const handler: ProxyHandler<T> = {
    get(_, prop: string | symbol) {
      if (prop === "changed") return changedSignal;
      if (prop === "on") return getKeySignal;
      if (prop === "reset") return () => {
        for (const [k, v] of Object.entries(initialSnapshot)) {
          const prev = data[k];
          if (prev !== v) {
            (data as any)[k] = v;
            changedSignal.emit({ key: k, value: v, previous: prev } as any);
            keySignals.get(k)?.emit({ value: v, previous: prev });
          }
        }
      };
      if (prop === "snapshot") return () => ({ ...data });
      return (data as any)[prop];
    },
    set(_, prop: string | symbol, value) {
      const key = prop as string;
      const previous = (data as any)[key];
      if (previous === value) return true;  // no-op, no signal
      (data as any)[key] = value;
      changedSignal.emit({ key, value, previous } as any);
      keySignals.get(key)?.emit({ value, previous });
      return true;
    },
  };

  return new Proxy(data, handler) as ReactiveState<T>;
}
```

### Usage in Examples

```typescript
// state.ts — reactive
import { reactiveState } from "@quintus/core";

export const gameState = reactiveState({
  health: 3,
  maxHealth: 3,
  coins: 0,
  score: 0,
});

// player.ts — writes are the same
gameState.health -= damage;  // auto-emits changed signal

// hud.ts — signal-driven, NOT polling
onReady() {
  gameState.on("health").connect(({ value }) => this._updateHearts(value));
  gameState.on("coins").connect(({ value }) => {
    this.coinLabel.text = `Coins: ${value}`;
  });
  gameState.on("score").connect(({ value }) => {
    this.scoreLabel.text = `Score: ${value}`;
  });
}

// Scene restart — one call resets everything
gameState.reset();
```

### Deliverables

- [ ] Create `packages/core/src/reactive-state.ts` with `reactiveState<T>()` factory
- [ ] Export from `packages/core/src/index.ts`
- [ ] Write comprehensive unit tests
- [ ] Update platformer example `state.ts` to use `reactiveState`
- [ ] Update platformer HUD to be signal-driven
- [ ] Update dungeon example similarly
- [ ] Verify `pnpm build` and `pnpm test` pass

### Tests

**Unit: `packages/core/src/reactive-state.test.ts`**
- Setting a property emits `changed` with key, value, previous
- Setting same value is a no-op (no signal)
- `on("key")` returns a signal that fires only for that key
- `reset()` restores initial values and emits signals for each changed key
- `snapshot()` returns a frozen copy of current state
- Works with numeric, string, boolean, and object properties
- Multiple listeners on same key all fire

---

## Phase 7: Constants Registry

### Problem

Magic numbers are scattered throughout every example with no names, no documentation, and no way to tweak them at runtime:

```typescript
gravity: new Vec2(0, 800),       // Why 800?
jumpForce = -350;                 // Why -350?
Shape.rect(10, 6)               // Why 10x6?
dt * 8                           // Player bob speed — vs enemy's dt * 6
```

### Approach: `game.consts` Registry

A lightweight key-value store where game constants are registered with names, types, and default values. Constants are:
- **Named** — appear in debug UI, can be searched
- **Typed** — Vec2, number, string, Color, etc.
- **Tweakable** — editable via future debug panel or MCP server
- **Loadable** — can be loaded from a JSON file for per-game tuning

**New file: `packages/core/src/constants.ts`**

```typescript
import { type Signal, signal } from "./signal.js";

export interface ConstantDef<T = unknown> {
  name: string;
  value: T;
  description?: string;
  category?: string;
  min?: number;       // for numeric constants
  max?: number;       // for numeric constants
  step?: number;      // for numeric constants (slider granularity)
}

export class ConstantsRegistry {
  private _values = new Map<string, unknown>();
  private _defs = new Map<string, ConstantDef>();

  /** Fires when any constant changes (name, newValue, oldValue). */
  readonly changed: Signal<{ name: string; value: unknown; previous: unknown }> = signal();

  /**
   * Register and return a constant. If already registered, returns existing value.
   *
   * @example
   * const GRAVITY = game.consts.define("player.gravity", new Vec2(0, 800), {
   *   description: "Gravity applied to the player each frame",
   *   category: "physics",
   * });
   */
  define<T>(name: string, defaultValue: T, options?: Partial<ConstantDef<T>>): T {
    if (!this._values.has(name)) {
      this._values.set(name, defaultValue);
      this._defs.set(name, { name, value: defaultValue, ...options });
    }
    return this._values.get(name) as T;
  }

  /** Get a constant's current value. */
  get<T>(name: string): T {
    if (!this._values.has(name)) {
      throw new Error(`Unknown constant: "${name}"`);
    }
    return this._values.get(name) as T;
  }

  /** Set a constant (for debug panel / MCP). */
  set<T>(name: string, value: T): void {
    const previous = this._values.get(name);
    this._values.set(name, value);
    this.changed.emit({ name, value, previous });
  }

  /** Load constants from a JSON object (e.g., parsed from a tuning file). */
  load(data: Record<string, unknown>): void {
    for (const [name, value] of Object.entries(data)) {
      if (this._values.has(name)) {
        this.set(name, value);
      }
    }
  }

  /** Export all constants as a JSON-serializable object. */
  export(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [name, value] of this._values) {
      result[name] = value;
    }
    return result;
  }

  /** All registered definitions (for debug UI enumeration). */
  get definitions(): ReadonlyMap<string, ConstantDef> {
    return this._defs;
  }
}
```

### Integration with Game

**File: `packages/core/src/game.ts`**

```typescript
export class Game {
  readonly consts = new ConstantsRegistry();
  // ...
}
```

### Usage in Examples

```typescript
// config.ts — register all constants up front
export function registerConstants(game: Game) {
  game.consts.define("player.speed", 150, {
    description: "Horizontal movement speed (px/s)",
    category: "player", min: 50, max: 500, step: 10,
  });
  game.consts.define("player.jumpForce", -350, {
    description: "Jump impulse (negative = up)",
    category: "player", min: -800, max: -100, step: 10,
  });
  game.consts.define("player.gravity", 800, {
    description: "Gravity acceleration (px/s^2)",
    category: "physics", min: 100, max: 2000, step: 50,
  });
}

// player.ts — use named constants
class Player extends Actor {
  onFixedUpdate(dt: number) {
    const speed = this.game.consts.get<number>("player.speed");
    const jumpForce = this.game.consts.get<number>("player.jumpForce");
    // ...
  }
}
```

### Loading from File

```json
// constants.json (shipping with the game or loaded from editor)
{
  "player.speed": 180,
  "player.jumpForce": -400,
  "player.gravity": 900
}
```

```typescript
const data = await fetch("constants.json").then(r => r.json());
game.consts.load(data);
```

### Future Debug Panel Integration

The `definitions` map provides everything a debug UI needs: name, category, description, min/max/step for sliders. Phase 11 (debug tools) can build a panel that enumerates `game.consts.definitions` and renders editors.

### Deliverables

- [ ] Create `packages/core/src/constants.ts` with `ConstantsRegistry`
- [ ] Add `readonly consts: ConstantsRegistry` to Game class
- [ ] Export from `packages/core/src/index.ts`
- [ ] Write unit tests
- [ ] Update one example (platformer) to use `game.consts` for key values
- [ ] Verify `pnpm build` and `pnpm test` pass

### Tests

**Unit: `packages/core/src/constants.test.ts`**
- `define()` registers and returns default value
- `define()` on existing key returns existing value (no overwrite)
- `get()` returns current value
- `get()` on unknown key throws
- `set()` updates value and emits `changed`
- `load()` applies JSON overrides for registered keys, ignores unknown keys
- `export()` returns all key/value pairs
- `definitions` enumerates all registered constants with metadata

---

## Phase 8: Tween & Minor API Polish

### 8a. `andThen()` Removal

`andThen()` does nothing except reset the `_nextParallel` flag, which is the default state. Sequential execution happens automatically — only `parallel()` changes behavior. Remove `andThen()` entirely.

```typescript
// Before:
shape.tween()
  .to({ position: { y: startY + 80 } }, 0.4, Ease.bounceOut)
  .andThen()  // ← this does nothing
  .to({ position: { y: startY } }, 0.3, Ease.quadOut);

// After (identical behavior):
shape.tween()
  .to({ position: { y: startY + 80 } }, 0.4, Ease.bounceOut)
  .to({ position: { y: startY } }, 0.3, Ease.quadOut);
```

### 8b. Unused Signals Cleanup

Remove unused `died` signals from dungeon enemies (never connected to anything). If the signal is needed for future features, at minimum add a `// TODO` comment.

### 8c. Vec2 Direction Constants Documentation

`Vec2.UP`, `Vec2.DOWN`, `Vec2.LEFT`, `Vec2.RIGHT` already exist (frozen). The dungeon example manually creates a `DIRECTION_VECTORS` map instead of using these. Update examples to reference the statics.

```typescript
// Before (dungeon/player.ts):
const DIRECTION_VECTORS: Record<Direction, Vec2> = {
  up: new Vec2(0, -1), down: new Vec2(0, 1),
  left: new Vec2(-1, 0), right: new Vec2(1, 0),
};

// After:
const DIRECTION_VECTORS: Record<Direction, Vec2> = {
  up: Vec2.UP, down: Vec2.DOWN,
  left: Vec2.LEFT, right: Vec2.RIGHT,
};
```

### 8d. `nextScene!: string` Non-Null Assertion Fix

Both `LevelExit` and `Door` use `nextScene!: string` which is a runtime bomb if unset. Change to an optional property with a guard:

```typescript
nextScene?: string;

// In usage:
if (this.nextScene) {
  this.scene.switchTo(this.nextScene);
}
```

### Deliverables

- [ ] Remove `andThen()` from Tween API
- [ ] Update examples that used `andThen()` (tween-ui)
- [ ] Clean up unused signals in dungeon enemies (or add TODO comments)
- [ ] Update dungeon player to use `Vec2.UP/DOWN/LEFT/RIGHT`
- [ ] Fix `nextScene!` to `nextScene?` with guards in LevelExit and Door
- [ ] Verify `pnpm build` and `pnpm test` pass

### Tests

- Existing tween tests pass without `andThen()` (verify no test calls it)
- Sequential tweens work without explicit `andThen()` separator

---

## Phase 9: Update All Examples

Apply all the improvements from Phases 1–9 to every example. This is the validation phase — if the examples are clean and readable, the API changes worked.

### Per-Example Checklist

**bouncing-balls:**
- [ ] Remove `game?.` null checks
- [ ] Use direct `position.x`/`.y` mutation instead of `new Vec2()`
- [ ] Use `Vec2.clamp()` or direct `Math.max/min` on components
- [ ] Use `this.add()` consistently

**tilemap:**
- [ ] Replace `TileMap.registerPhysics(...)` with `import "@quintus/tilemap/physics"`
- [ ] Use props pattern: `this.add(CollisionShape, { shape: Shape.rect(...) })`
- [ ] Remove null checks on `game`/`scene`
- [ ] Use `reactiveState` for score
- [ ] Use typed `findFirst` for player queries

**basic_platformer:**
- [ ] Remove null checks on `game`/`input`
- [ ] Use `this.add()` everywhere
- [ ] Use `after()` for any delays
- [ ] Use `body.is(Player)` in sensor callbacks

**tween-ui:**
- [ ] Remove `andThen()` calls from tween chains
- [ ] Remove redundant `as Node2D` casts
- [ ] Use `game.consts` for layout constants (optional)

**platformer:**
- [ ] Replace `gameState` with `reactiveState()`
- [ ] Rewrite HUD to be signal-driven
- [ ] Use `body.is()` in all contact handlers
- [ ] Use `this.after()` for death delay timer
- [ ] Use `import "@quintus/tilemap/physics"`
- [ ] Register key constants with `game.consts`
- [ ] Use props pattern for CollisionShape and AnimatedSprite
- [ ] Fix `nextScene!` to `nextScene?`
- [ ] Remove all `game?.` / `scene?.` null checks

**dungeon:**
- [ ] Same as platformer (reactive state, is(), after(), consts, etc.)
- [ ] Replace `DIRECTION_VECTORS` with `Vec2.UP/DOWN/LEFT/RIGHT`
- [ ] Use `body.is(BaseEnemy)` instead of tag + duck-typing casts
- [ ] Clean up unused enemy `died` signals

### Deliverables

- [ ] All 6 examples rewritten with new patterns
- [ ] All examples build and run (`pnpm dev`)
- [ ] Platformer integration tests still pass
- [ ] No `as never`, `as unknown as`, or `as any` casts in example code
- [ ] No `this.game?.` or `this.scene?.` null checks in lifecycle hooks
- [ ] `pnpm lint` clean

---

## Definition of Done

- [ ] All phases marked Done in status table
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes with no warnings
- [ ] `pnpm lint` clean
- [ ] All 6 examples run in browser via `pnpm dev`
- [ ] Platformer integration tests pass (`pnpm test:platformer`)
- [ ] Zero `as never` / `as unknown as` / `as any` casts in example code
- [ ] Zero `this.game?.` null checks inside lifecycle hooks in examples
- [ ] API feels natural to copy-paste — an LLM generating game code from these examples would produce clean, type-safe output
