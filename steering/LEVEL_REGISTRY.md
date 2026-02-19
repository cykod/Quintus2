# Scene Registry — Detailed Design

> **Goal:** Eliminate circular dependency workarounds and simplify scene transitions by adding a name-based scene registry to Game.
> **Outcome:** Games register scenes by name in `main.ts` and reference them by string anywhere. The `_Level1Ref` / `_setLevel1Ref` hack is removed from all examples. Both string names and class references work everywhere (backwards compatible).

---

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Core registry API on Game + Scene.switchTo overload | Pending |
| 2 | Update platformer example to use string-based scenes | Pending |
| 3 | Update dungeon example to use string-based scenes | Pending |
| 4 | Tests | Pending |

---

## Problem

When scenes need to reference each other for transitions, circular imports arise. Both the platformer and dungeon examples work around this with an ugly mutable-reference pattern:

```typescript
// game-over-scene.ts — exports mutable reference + setter
export let _Level1Ref: SceneConstructor | null = null;
export function _setLevel1Ref(ref: SceneConstructor): void { _Level1Ref = ref; }

// level1.ts — calls setter at module load time
_setLevel1Ref(Level1);

// game-over-scene.ts — guards against null
if (_Level1Ref) this.switchTo(_Level1Ref);
```

This pattern is:
- **Fragile** — depends on module evaluation order
- **Non-obvious** — new users (and LLMs) won't guess this pattern
- **Duplicated** — identical workaround in platformer + dungeon
- **Nullable** — forces defensive checks at every call site

### Dependency Graph (Current)

```
TitleScene ──→ Level1
Level1 ──→ Level2, GameOverScene
Level2 ──→ VictoryScene (or Level3), GameOverScene
GameOverScene ──✗──→ Level1  (circular!)
VictoryScene  ──✗──→ Level1  (circular!)
```

### Dependency Graph (After)

```
main.ts registers: { title, level1, level2, gameOver, victory }

TitleScene ──→ switchTo("level1")     // no import
Level1     ──→ switchTo("gameOver")   // no import
LevelExit  ──→ switchTo(nextScene)    // string property
GameOverScene → switchTo("level1")    // no import, no circular dep
VictoryScene  → switchTo("level1")    // no import, no circular dep
```

All scene-class imports converge in `main.ts` — the single wiring point.

---

## Phase 1: Core Registry API

### 1.1 New Type Alias

Add a `SceneTarget` type that accepts either a string name or a class reference.

**File:** `packages/core/src/scene.ts`

```typescript
/** A scene reference: either a registered name or a constructor. */
export type SceneTarget = string | SceneConstructor;
```

- [ ] Add `SceneTarget` type to `packages/core/src/scene.ts`
- [ ] Export `SceneTarget` from `packages/core/src/index.ts`

### 1.2 Registry on Game

Add an internal `Map<string, SceneConstructor>` and public registration methods.

**File:** `packages/core/src/game.ts`

```typescript
class Game {
  private _sceneRegistry = new Map<string, SceneConstructor>();

  /** Register a scene class by name. */
  registerScene(name: string, sceneClass: SceneConstructor): this {
    if (this._sceneRegistry.has(name)) {
      console.warn(`Scene "${name}" is already registered. Overwriting.`);
    }
    this._sceneRegistry.set(name, sceneClass);
    return this;
  }

  /** Register multiple scenes at once. */
  registerScenes(scenes: Record<string, SceneConstructor>): this {
    for (const [name, sceneClass] of Object.entries(scenes)) {
      this.registerScene(name, sceneClass);
    }
    return this;
  }

  /** Resolve a SceneTarget to a SceneConstructor. Throws on missing name. */
  private _resolveScene(target: SceneTarget): SceneConstructor {
    if (typeof target === "string") {
      const cls = this._sceneRegistry.get(target);
      if (!cls) {
        throw new Error(
          `Scene "${target}" is not registered. Call game.registerScene("${target}", YourScene) first.`
        );
      }
      return cls;
    }
    return target;
  }
}
```

- [ ] Add `_sceneRegistry` private field to `Game`
- [ ] Add `registerScene()` method (returns `this` for chaining)
- [ ] Add `registerScenes()` method (returns `this` for chaining)
- [ ] Add `_resolveScene()` private method

### 1.3 Update `Game.start()` and `Game._switchScene()`

Both methods accept `SceneTarget` instead of `SceneConstructor`.

**File:** `packages/core/src/game.ts`

```typescript
// Before:
start(SceneClass: SceneConstructor): void {
  this._loadScene(SceneClass);
  // ...
}

_switchScene(SceneClass: SceneConstructor): void {
  // ...
  this._loadScene(SceneClass);
  // ...
}

// After:
start(target: SceneTarget): void {
  this._loadScene(this._resolveScene(target));
  // ...
}

_switchScene(target: SceneTarget): void {
  // ...
  this._loadScene(this._resolveScene(target));
  // ...
}
```

- [ ] Update `start()` signature to accept `SceneTarget`
- [ ] Update `_switchScene()` signature to accept `SceneTarget`
- [ ] Both resolve via `_resolveScene()` before calling `_loadScene()`
- [ ] `_loadScene()` still takes `SceneConstructor` (already resolved)

### 1.4 Update `Scene.switchTo()`

**File:** `packages/core/src/scene.ts`

```typescript
// Before:
switchTo(SceneClass: SceneConstructor): void {
  this._game._switchScene(SceneClass);
}

// After:
switchTo(target: SceneTarget): void {
  this._game._switchScene(target);
}
```

Import `SceneTarget` (it's in the same file, so just use it).

- [ ] Update `switchTo()` signature to accept `SceneTarget`

### 1.5 Update `HeadlessGame`

`HeadlessGame` extends `Game` and inherits `start()`, so no changes needed to the class itself. But its usage in tests may pass class references — those continue to work.

**File:** `packages/headless/src/headless-game.ts` — no changes required.

- [ ] Verify `HeadlessGame` inherits the updated signatures (no code change needed)

---

## Phase 2: Update Platformer Example

### 2.1 Centralize Scene Registration in `main.ts`

**File:** `examples/platformer/main.ts`

```typescript
import { TitleScene } from "./scenes/title-scene.js";
import { Level1 } from "./scenes/level1.js";
import { Level2 } from "./scenes/level2.js";
import { GameOverScene } from "./scenes/game-over-scene.js";
import { VictoryScene } from "./scenes/victory-scene.js";

// Register all scenes by name
game.registerScenes({
  title: TitleScene,
  level1: Level1,
  level2: Level2,
  gameOver: GameOverScene,
  victory: VictoryScene,
});

game.start("title");
```

- [ ] Import all scene classes in `main.ts`
- [ ] Add `game.registerScenes()` call before `game.start()`
- [ ] Change `game.start(TitleScene)` to `game.start("title")`

### 2.2 Simplify Level Base Class

**File:** `examples/platformer/scenes/level.ts`

Change `nextScene` from `SceneConstructor` to `string`:

```typescript
// Before:
abstract readonly nextScene: SceneConstructor;

// After:
abstract readonly nextScene: string;
```

- [ ] Change `nextScene` type from `SceneConstructor` to `string`
- [ ] Remove `import type { SceneConstructor } from "@quintus/core"`

### 2.3 Simplify Level1

**File:** `examples/platformer/scenes/level1.ts`

```typescript
// Before:
import type { SceneConstructor } from "@quintus/core";
import { _setLevel1Ref, GameOverScene } from "./game-over-scene.js";
import { Level } from "./level.js";
import { Level2 } from "./level2.js";

export class Level1 extends Level {
  readonly levelAsset = "level1";
  readonly nextScene: SceneConstructor = Level2;
  protected _goToGameOver(): void { this.switchTo(GameOverScene); }
}
_setLevel1Ref(Level1);

// After:
import { Level } from "./level.js";

export class Level1 extends Level {
  readonly levelAsset = "level1";
  readonly nextScene = "level2";
  protected _goToGameOver(): void { this.switchTo("gameOver"); }
}
```

- [ ] Replace `nextScene = Level2` with `nextScene = "level2"`
- [ ] Replace `this.switchTo(GameOverScene)` with `this.switchTo("gameOver")`
- [ ] Remove all scene-class imports
- [ ] Remove `_setLevel1Ref(Level1)` call

### 2.4 Simplify Level2

**File:** `examples/platformer/scenes/level2.ts`

Same pattern as Level1.

- [ ] Replace `nextScene = VictoryScene` with `nextScene = "victory"`
- [ ] Replace `this.switchTo(GameOverScene)` with `this.switchTo("gameOver")`
- [ ] Remove scene-class imports

### 2.5 Simplify GameOverScene

**File:** `examples/platformer/scenes/game-over-scene.ts`

```typescript
// Remove entirely:
export let _Level1Ref: SceneConstructor | null = null;
export function _setLevel1Ref(ref: SceneConstructor): void { _Level1Ref = ref; }

// Before:
if (_Level1Ref) this.switchTo(_Level1Ref);

// After:
this.switchTo("level1");
```

- [ ] Remove `_Level1Ref` variable and `_setLevel1Ref()` function
- [ ] Replace `if (_Level1Ref) this.switchTo(_Level1Ref)` with `this.switchTo("level1")`
- [ ] Remove `SceneConstructor` import

### 2.6 Simplify VictoryScene

**File:** `examples/platformer/scenes/victory-scene.ts`

```typescript
// Before:
import { _Level1Ref } from "./game-over-scene.js";
if (_Level1Ref) this.switchTo(_Level1Ref);

// After:
this.switchTo("level1");
```

- [ ] Remove `_Level1Ref` import
- [ ] Replace guarded `switchTo` with `this.switchTo("level1")`

### 2.7 Simplify TitleScene

**File:** `examples/platformer/scenes/title-scene.ts`

```typescript
// Before:
import { Level1 } from "./level1.js";
this.switchTo(Level1);

// After:
this.switchTo("level1");
```

- [ ] Replace `this.switchTo(Level1)` with `this.switchTo("level1")`
- [ ] Remove `Level1` import

### 2.8 Simplify LevelExit Entity

**File:** `examples/platformer/entities/level-exit.ts`

```typescript
// Before:
import type { SceneConstructor } from "@quintus/core";
nextScene!: SceneConstructor;

// After:
nextScene!: string;
```

- [ ] Change `nextScene` type from `SceneConstructor` to `string`
- [ ] Remove `SceneConstructor` import

---

## Phase 3: Update Dungeon Example

Same pattern as platformer. All changes mirror Phase 2.

### 3.1 Centralize Scene Registration in `main.ts`

**File:** `examples/dungeon/main.ts`

- [ ] Import all scene classes
- [ ] Add `game.registerScenes()` call
- [ ] Change `game.start(TitleScene)` to `game.start("title")`

### 3.2 Simplify DungeonLevel Base Class

**File:** `examples/dungeon/scenes/dungeon-level.ts`

- [ ] Change `nextScene` type from `SceneConstructor` to `string`
- [ ] Remove `SceneConstructor` import

### 3.3 Simplify Level1, Level2, Level3

**Files:** `examples/dungeon/scenes/level1.ts`, `level2.ts`, `level3.ts`

- [ ] Replace class-reference `nextScene` values with string names
- [ ] Replace `this.switchTo(GameOverScene)` with `this.switchTo("gameOver")`
- [ ] Remove scene-class imports and `_setLevel1Ref()` call from `level1.ts`

### 3.4 Simplify GameOverScene

**File:** `examples/dungeon/scenes/game-over-scene.ts`

- [ ] Remove `_Level1Ref` and `_setLevel1Ref()` exports
- [ ] Replace guarded `switchTo` with `this.switchTo("level1")`

### 3.5 Simplify VictoryScene

**File:** `examples/dungeon/scenes/victory-scene.ts`

- [ ] Remove `_Level1Ref` import
- [ ] Replace guarded `switchTo` with `this.switchTo("level1")`

### 3.6 Simplify TitleScene

**File:** `examples/dungeon/scenes/title-scene.ts`

- [ ] Replace `this.switchTo(Level1)` with `this.switchTo("level1")`
- [ ] Remove `Level1` import

### 3.7 Simplify Door Entity

**File:** `examples/dungeon/entities/door.ts`

- [ ] Change `nextScene` type from `SceneConstructor` to `string`
- [ ] Remove `SceneConstructor` import

---

## Phase 4: Tests

### 4.1 Unit Tests for Scene Registry

**File:** `packages/core/src/game.test.ts` (add to existing test file)

```typescript
describe("scene registry", () => {
  // registerScene
  it("registers a scene by name", () => { ... });
  it("warns on duplicate registration", () => { ... });
  it("returns this for chaining", () => { ... });

  // registerScenes
  it("registers multiple scenes at once", () => { ... });

  // start() with string
  it("starts a registered scene by name", () => { ... });
  it("throws on unregistered scene name", () => { ... });
  it("still accepts SceneConstructor directly", () => { ... });

  // switchTo() with string
  it("switches to a registered scene by name", () => { ... });
  it("throws on unregistered name during switchTo", () => { ... });
  it("still accepts SceneConstructor in switchTo", () => { ... });
});
```

- [ ] Add `registerScene()` tests
- [ ] Add `registerScenes()` tests
- [ ] Add `start()` with string name tests
- [ ] Add `switchTo()` with string name tests
- [ ] Add error case tests (unregistered name throws)
- [ ] Add backwards-compatibility tests (class refs still work)
- [ ] All existing tests continue to pass unchanged

---

## Design Decisions

### Why strings, not symbols or enums?

Strings are the most LLM-friendly option. An LLM can generate `this.switchTo("level1")` without knowing anything about the project's type system. Symbols aren't serializable. Enums require an extra definition file that every scene imports — recreating the coupling problem.

### Why centralized registration in `main.ts`?

The alternative — auto-registration via static `sceneName` on each class — is implicit and requires every scene to be imported somewhere anyway. Centralized registration makes the full scene graph visible in one place, which is valuable for debugging and for LLMs trying to understand game flow.

### Why not a separate SceneRegistry class?

The registry is a simple `Map` with three methods. Extracting it to its own class would add a file and an indirection (`game.scenes.register()`) without meaningful benefit. Keeping it on `Game` matches the existing `game.use()` pattern for plugins.

### Why `this` return for chaining?

Matches `game.use(plugin)` which also returns `this`. Allows:

```typescript
game
  .registerScenes({ title: TitleScene, level1: Level1 })
  .use(PhysicsPlugin({ gravity: new Vec2(0, 800) }))
  .start("title");
```

### Backwards compatibility

Every API that previously accepted `SceneConstructor` now accepts `SceneTarget = string | SceneConstructor`. Existing code that passes class references is unchanged. The only breaking change is the TypeScript signature widening, which is additive (not breaking).

---

## Definition of Done

- [ ] All phases marked Done in status table
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes with no warnings
- [ ] `pnpm lint` clean
- [ ] Platformer example runs: title → level1 → level2 → victory, retry from game over
- [ ] Dungeon example runs: title → level1 → level2 → level3 → victory, retry from game over
- [ ] No `_Level1Ref` or `_setLevel1Ref` anywhere in the codebase
- [ ] No circular dependency workarounds in any example
