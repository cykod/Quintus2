# JSX Declarative Build Pattern — Detailed Design

> **Goal:** Add an optional JSX-based `declare()` pattern that makes node tree composition visual and concise — especially for UI, scene setup, and entity prefabs.
> **Outcome:** A new `@quintus/jsx` package that provides a custom JSX runtime. Users who opt in get `<TileMap asset="level1.json" />` syntax; everyone else keeps using `this.add(TileMap)` with zero impact.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Package setup & core runtime (`h`, `Fragment`, `ref`, coercion) | Pending |
| 2 | TypeScript JSX type definitions | Pending |
| 3 | Lifecycle integration (`declare()` on Node) | Pending |
| 4 | Functional components (prefabs) | Pending |
| 5 | Tests & examples | Pending |

---

## Design Principles

1. **Purely optional** — zero changes to existing imperative API. No user sees JSX unless they opt in.
2. **One-shot creation** — JSX runs once to build the node tree, like SolidJS. No virtual DOM, no re-rendering, no reconciliation.
3. **Nodes, not descriptors** — `h()` creates real Node instances eagerly. What you get back is the actual node, not a proxy.
4. **Template method inheritance** — base classes define structure with `declareXxx()` hooks; subclasses override the hooks to inject content into specific tree regions.
5. **Coercion for ergonomics** — `[100, 400]` becomes `Vec2(100, 400)`, `"#ff0000"` becomes `Color`, etc.
6. **Signal-aware** — function props auto-connect to signals on the target node.

---

## Package: `@quintus/jsx`

```
packages/jsx/
  src/
    index.ts              # Public API: h, Fragment, ref, materialize
    jsx-runtime.ts        # Auto-import runtime (jsx, jsxs, Fragment)
    jsx-dev-runtime.ts    # Dev-mode runtime (same, can add warnings later)
    h.ts                  # Core factory function
    ref.ts                # Ref<T> type and ref() factory
    coerce.ts             # Prop coercion logic
    types.ts              # JSX namespace augmentation
  tsconfig.json
  tsup.config.ts
  package.json
```

### Dependencies

```json
{
  "name": "@quintus/jsx",
  "peerDependencies": {
    "@quintus/core": "workspace:*",
    "@quintus/math": "workspace:*"
  }
}
```

No hard dep on `@quintus/ui`, `@quintus/physics`, etc. — the JSX factory works with any `Node` subclass regardless of package.

### User Opt-In

To use JSX, a user adds two things:

1. Install the package:
   ```bash
   pnpm add @quintus/jsx
   ```

2. Configure TypeScript (in their `tsconfig.json` or the base one):
   ```jsonc
   {
     "compilerOptions": {
       "jsx": "react-jsx",
       "jsxImportSource": "@quintus/jsx"
     }
   }
   ```

3. Rename files to `.tsx` where JSX is used.

Without this, everything works exactly as before.

---

## Phase 1: Core Runtime

### The `h()` Function

The heart of the system. Creates a real Node instance, applies props with coercion, adds children, fills refs.

```typescript
// packages/jsx/src/h.ts

import { Node, type NodeConstructor } from "@quintus/core";
import { Vec2, Color } from "@quintus/math";
import type { Signal } from "@quintus/core";
import type { Ref } from "./ref.js";

export const Fragment = Symbol("Fragment");

type NodeElementChild = Node | NodeElementChild[] | null | undefined | false;

export function h<T extends Node>(
  type: NodeConstructor<T> | typeof Fragment,
  props: Record<string, unknown> | null,
  ...children: NodeElementChild[]
): T | Node[] {
  // Fragment: just return flattened children
  if (type === Fragment) {
    return flattenChildren(children);
  }

  const node = new type();

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key === "ref") {
        // Fill ref after node is created
        (value as Ref<T>).current = node;
        continue;
      }
      if (key === "children") continue; // handled below
      applyProp(node, key, value);
    }
  }

  // Add children
  for (const child of flattenChildren(children)) {
    node.addChild(child);
  }

  return node;
}
```

**Evaluation order:** JSX evaluates children first, bottom-up. So `<Player><CollisionShape /></Player>` first creates the CollisionShape, then creates Player and adds CollisionShape as its child. The tree is built inside-out, exactly matching the engine's `onReady()` order (children ready before parent).

### Prop Application with Coercion

```typescript
// packages/jsx/src/coerce.ts

import { Vec2, Color } from "@quintus/math";
import { Signal } from "@quintus/core";

/** Property names that should coerce string values to Color. */
const COLOR_PROPS = new Set([
  "color", "fillColor", "backgroundColor", "hoverColor",
  "pressedColor", "borderColor", "textColor",
]);

export function applyProp(node: object, key: string, value: unknown): void {
  // 1. Signal auto-connect: function value + target is a Signal
  const existing = (node as Record<string, unknown>)[key];
  if (typeof value === "function" && existing instanceof Signal) {
    existing.connect(value as (...args: unknown[]) => void);
    return;
  }

  // 2. Vec2 coercion: [x, y] tuple → Vec2
  if (Array.isArray(value) && value.length === 2
      && typeof value[0] === "number" && typeof value[1] === "number") {
    (node as Record<string, unknown>)[key] = new Vec2(value[0], value[1]);
    return;
  }

  // 3. Color coercion: "#hex" string on color-named props → Color
  if (typeof value === "string" && COLOR_PROPS.has(key)) {
    (node as Record<string, unknown>)[key] = Color.fromHex(value);
    return;
  }

  // 4. Uniform scale shorthand: scale={2} → Vec2(2, 2)
  if (key === "scale" && typeof value === "number") {
    (node as Record<string, unknown>)[key] = new Vec2(value, value);
    return;
  }

  // 5. Direct assignment (default path)
  (node as Record<string, unknown>)[key] = value;
}
```

Coercion rules (in priority order):

| Input | Target | Result |
|-------|--------|--------|
| `() => {}` on Signal prop | `Signal<T>` | `.connect(fn)` |
| `[100, 200]` on Vec2 prop | `Vec2` | `new Vec2(100, 200)` |
| `"#ff0000"` on color-named prop | `Color` | `Color.fromHex("#ff0000")` |
| `2` on `scale` | `Vec2` | `new Vec2(2, 2)` |
| anything else | — | Direct assignment |

### The `ref<T>()` Function

```typescript
// packages/jsx/src/ref.ts

import type { Node } from "@quintus/core";

export interface Ref<T extends Node = Node> {
  current: T | null;
}

export function ref<T extends Node>(): Ref<T> {
  return { current: null };
}
```

Usage:
```tsx
class Level extends Scene {
  player = ref<Player>();

  declare() {
    return <Player ref={this.player} position={[100, 400]} />;
  }

  onReady() {
    // this.player.current is the Player instance
    this.player.current!.tag("hero");
  }
}
```

`ref.current` is filled during `h()` execution — before the node enters the tree or `onReady()` fires. By the time any lifecycle method runs, all refs from `declare()` are populated.

### Fragment & Children Flattening

```typescript
function flattenChildren(children: NodeElementChild[]): Node[] {
  const result: Node[] = [];
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) {
      result.push(...flattenChildren(child));
    } else if (child instanceof Node) {
      result.push(child);
    }
  }
  return result;
}
```

Fragments `<>...</>` compile to `h(Fragment, null, ...children)` which returns a flat `Node[]`. This lets `declare()` return multiple root nodes.

### JSX Runtime Modules

TypeScript's `react-jsx` transform auto-imports from `@quintus/jsx/jsx-runtime`:

```typescript
// packages/jsx/src/jsx-runtime.ts
export { h as jsx, h as jsxs, Fragment } from "./h.js";
```

```typescript
// packages/jsx/src/jsx-dev-runtime.ts
export { h as jsxDEV, Fragment } from "./h.js";
```

### Phase 1 Checklist

- [ ] Create `packages/jsx/` package structure (package.json, tsconfig, tsup.config)
- [ ] Implement `h()` function with overloads for class components and Fragment
- [ ] Implement `flattenChildren()` with null/false/array handling
- [ ] Implement `applyProp()` with coercion (Vec2 tuples, Color strings, scale shorthand, Signal connect)
- [ ] Implement `ref<T>()` factory
- [ ] Implement `Fragment` symbol
- [ ] Create `jsx-runtime.ts` and `jsx-dev-runtime.ts` exports
- [ ] Export public API from `src/index.ts`
- [ ] Unit tests for `h()`, `ref()`, `applyProp()`

---

## Phase 2: TypeScript JSX Type Definitions

The type system must ensure that `<Label text="foo" bogus={42} />` is a type error. This is the most technically complex part.

### JSX Namespace

```typescript
// packages/jsx/src/types.ts

import type { Node, NodeConstructor, Signal } from "@quintus/core";
import type { Vec2, Color } from "@quintus/math";
import type { Ref } from "./ref.js";

// ---- Utility types ----

/** Extract writable (non-readonly) keys from a type. */
type WritableKeys<T> = {
  [K in keyof T]-?: IfEquals<
    { [Q in K]: T[K] }, { -readonly [Q in K]: T[K] }, K
  >
}[keyof T];

type IfEquals<X, Y, A = X, B = never> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B;

/** Coerce property types for JSX ergonomics. */
type CoercedPropType<T> =
  T extends Vec2 ? Vec2 | [number, number] :
  T extends Color ? Color | string :
  T;

/** For Signal<T> properties, accept a handler function. */
type SignalPropType<T> =
  T extends Signal<infer P> ? ((payload: P) => void) | Signal<P> : CoercedPropType<T>;

/**
 * JSX props for a Node class T:
 * - All writable public properties (with coercion)
 * - Signal properties accept handler functions
 * - Plus ref, children, name, key
 */
type NodeJSXProps<T extends Node> = {
  [K in WritableKeys<T>]?: SignalPropType<T[K]>;
} & {
  ref?: Ref<T>;
  children?: JSX.Element | JSX.Element[];
  key?: string | number;
};

// ---- JSX Namespace ----

declare global {
  namespace JSX {
    /** A JSX expression evaluates to a Node (or Node[] for fragments). */
    type Element = Node | Node[];

    /** Class components must extend Node. */
    type ElementClass = Node;

    /** Props for class components are derived from the class's writable properties. */
    interface IntrinsicClassAttributes<T> {
      ref?: T extends Node ? Ref<T> : never;
      key?: string | number;
      children?: Element | Element[];
    }

    /** Tell TypeScript to look for __jsxProps on classes for prop types. */
    interface ElementAttributesProperty {
      __jsxProps: {};
    }

    /** No intrinsic elements (no lowercase tags like <div>). */
    interface IntrinsicElements {}
  }
}
```

### Prop Type Derivation Strategy

The main challenge: TypeScript needs to know what props each Node class accepts. There are two approaches:

**Approach A: `__jsxProps` marker type (explicit).**
Each Node class declares its prop type:
```typescript
class Label extends UINode {
  declare __jsxProps: NodeJSXProps<Label>;
  text = "";
  fontSize = 16;
  // ...
}
```

Pro: Precise control. Con: Every class needs the declaration.

**Approach B: `LibraryManagedAttributes` (automatic).**
TypeScript's `LibraryManagedAttributes` transforms props globally:
```typescript
declare global {
  namespace JSX {
    type LibraryManagedAttributes<C, P> =
      C extends NodeConstructor<infer T> ? NodeJSXProps<T> : P;
  }
}
```

Pro: Zero boilerplate — any Node class works as JSX automatically. Con: May allow setting internal properties; harder to exclude specific keys.

**Recommendation:** Start with Approach B (automatic). If we find cases where certain properties should be excluded (like `_parent`, `id`), add a `JsxExclude` type helper or filter by naming convention (exclude `_` prefixed and `readonly`). The `WritableKeys` utility already excludes `readonly` properties, which handles `id`, `_isScene`, signal properties, etc.

### Handling `readonly` Signal Props

Signals are declared `readonly` (e.g., `readonly onPressed: Signal<void>`), so `WritableKeys` excludes them. But we want `<Button onPressed={() => ...} />` to work. Solution: a separate signal-props type that's merged in:

```typescript
/** Extract Signal properties (including readonly ones) and offer handler functions. */
type SignalProps<T> = {
  [K in keyof T as T[K] extends Signal<unknown> ? K : never]?:
    T[K] extends Signal<infer P> ? (payload: P) => void : never;
};

type NodeJSXProps<T extends Node> = {
  [K in WritableKeys<T>]?: CoercedPropType<T[K]>;
} & SignalProps<T> & {
  ref?: Ref<T>;
  children?: JSX.Element | JSX.Element[];
  key?: string | number;
};
```

Now `<Button onPressed={() => play()} />` type-checks correctly, mapping the function to `Signal<void>.connect()` at runtime.

### Phase 2 Checklist

- [ ] Define `WritableKeys<T>`, `CoercedPropType<T>`, `SignalProps<T>`, `NodeJSXProps<T>` utility types
- [ ] Declare global `JSX` namespace with `Element`, `ElementClass`, `IntrinsicClassAttributes`
- [ ] Implement `LibraryManagedAttributes` to auto-derive props from Node classes
- [ ] Verify type-checking: valid props pass, invalid props error
- [ ] Verify coercion types: `position={[100, 200]}` accepted, `position="bad"` rejected
- [ ] Verify signal types: `onPressed={() => {}}` accepted, `onPressed={42}` rejected
- [ ] Write type-level tests (`.test-d.ts` files using `expectTypeOf` / `assertType`)

---

## Phase 3: Lifecycle Integration

### The `declare()` Method

Added to `Node` as a no-op virtual method. Returns the node's "declared" children — nodes created via JSX (or `h()` directly) that should be added as children when the node enters the tree.

```typescript
// In packages/core/src/node.ts

/** Override to declaratively define child nodes (used with @quintus/jsx). */
declare(): Node | Node[] | null {
  return null;
}
```

### Integration Point: `_enterTreeRecursive`

The current flow in `_enterTreeRecursive`:

```
1. node._isInsideTree = true
2. node.onEnterTree()
3. node.treeEntered.emit()
4. for each existing child → recurse
5. if (!ready) → onReady(), readySignal.emit()
```

With `declare()`:

```
1. node._isInsideTree = true
2. node.onEnterTree()
3. node.treeEntered.emit()
4. Process declare() → add returned nodes as children  [NEW]
5. for each child (existing + declared) → recurse
6. if (!ready) → onReady(), readySignal.emit()
```

```typescript
// Modified _enterTreeRecursive in packages/core/src/node.ts

private _enterTreeRecursive(node: Node): void {
  node._isInsideTree = true;
  node.onEnterTree();
  node.treeEntered.emit();

  // NEW: Process declare() — add declared children before recursing
  const declared = node.declare();
  if (declared) {
    const nodes = Array.isArray(declared) ? declared.flat(Infinity) : [declared];
    for (const child of nodes) {
      if (child instanceof Node && !child.parent) {
        node.addChild(child);  // _addChildNode skips _enterTreeRecursive
                                // because we're mid-recursion — see below
      }
    }
  }

  // Enter children (now includes both pre-existing and declared children)
  for (const child of node._children) {
    if (!child._isInsideTree) {
      this._enterTreeRecursive(child);
    }
  }

  // Ready (bottom-up: children before parent)
  if (!node._isReady) {
    node._isReady = true;
    node.onReady();
    node.readySignal.emit();
    // ... debug logging
  }
}
```

**Important subtlety:** When `node.addChild(child)` is called inside `_enterTreeRecursive`, the parent node already has `_isInsideTree = true`. This means `_addChildNode` would normally trigger a nested `_enterTreeRecursive` on the child. But we need to defer that until step 5 (the child loop), where we skip already-entered children via the `!child._isInsideTree` guard.

To handle this cleanly, we can add the children directly to `_children` without going through `_addChildNode`:

```typescript
// Inside _enterTreeRecursive, after declare():
if (declared) {
  const nodes = Array.isArray(declared) ? declared.flat(Infinity) : [declared];
  for (const child of nodes) {
    if (child instanceof Node && !child._parent) {
      // Direct add: skip _enterTreeRecursive (we'll handle it in the loop below)
      node._children.push(child);
      child._parent = node;
    }
  }
}
```

This ensures declared children are added to the tree but their `_enterTreeRecursive` is called in order with all other children.

### Scene Special Case

`Scene._loadScene()` calls `scene.onReady()` directly (Scene is the tree root, not added via `addChild`). We need to process `declare()` here too:

```typescript
// In packages/core/src/game.ts

private _loadScene(SceneClass: SceneConstructor): void {
  const scene = new SceneClass(this);
  this._currentScene = scene;

  // NEW: Process declare() for the scene root
  const declared = scene.declare();
  if (declared) {
    const nodes = Array.isArray(declared) ? declared.flat(Infinity) : [declared];
    for (const child of nodes) {
      if (child instanceof Node) {
        scene.addChild(child);  // triggers _enterTreeRecursive normally
      }
    }
  }

  scene.onReady();
  scene._markReady();
  scene.sceneReady.emit();

  this.renderer?.markRenderDirty();
}
```

**Flow for a Scene with `declare()`:**
1. `new Level1(game)` — constructor runs, but `declare()` NOT called yet
2. `scene.declare()` → returns JSX tree (nodes created eagerly by `h()`)
3. `scene.addChild(player)` → player enters tree → player's `declare()` runs → player's children enter tree → player's `onReady()` fires
4. `scene.addChild(camera)` → camera enters tree → camera's `onReady()` fires
5. `scene.onReady()` → runs AFTER all declared children are ready

This means by the time `scene.onReady()` executes, every declared child (and their children) are in the tree and ready. All refs are populated. Imperative code in `onReady()` can safely access them.

### Interaction Between `declare()` and `h()` Children

A node can have children from two sources:
1. **JSX composition children:** `<Player><HealthBar /></Player>` — HealthBar is added by `h()` before Player enters the tree
2. **`declare()` children:** Player's own `declare()` returns CollisionShape + AnimatedSprite

Both coexist. The order is:
- JSX children first (already in `_children` when `declare()` runs)
- `declare()` children second (appended during tree entry)

This is intuitive: "I'm a Player. The JSX that created me gave me a HealthBar. My own `declare()` adds my intrinsic CollisionShape and Sprite."

### Phase 3 Checklist

- [ ] Add `declare(): Node | Node[] | null` virtual method to `Node` base class
- [ ] Modify `_enterTreeRecursive` to process `declare()` before recursing children
- [ ] Modify `Game._loadScene` to process Scene's `declare()` before `onReady()`
- [ ] Test: `declare()` children are in tree before `onReady()` fires
- [ ] Test: refs from `declare()` are populated by `onReady()` time
- [ ] Test: nested `declare()` works (Scene declares Player, Player declares CollisionShape)
- [ ] Test: `declare()` + imperative `addChild` in `onReady()` coexist
- [ ] Test: nodes without `declare()` (returns null) are unaffected
- [ ] Test: Fragment return (multiple root nodes) works

---

## Phase 4: Functional Components (Prefabs)

Functional components are plain functions that return JSX. They don't add behavior — they define reusable tree structures.

### Basic Pattern

```tsx
function HealthBar(props: { max: number; current: number }) {
  return (
    <Container direction="horizontal" gap={2}>
      {Array.from({ length: props.max }, (_, i) => (
        <Sprite
          texture="ui"
          sourceRect={i < props.current ? HEART_FULL : HEART_EMPTY}
        />
      ))}
    </Container>
  );
}

// Usage:
<HealthBar max={5} current={3} />
```

### How It Works in `h()`

When `h()` receives a plain function instead of a class constructor:

```typescript
export function h<T extends Node>(
  type: NodeConstructor<T> | typeof Fragment | ((props: unknown) => Node | Node[]),
  props: Record<string, unknown> | null,
  ...children: NodeElementChild[]
): T | Node[] {
  // Fragment
  if (type === Fragment) {
    return flattenChildren(children);
  }

  // Functional component
  if (typeof type === "function" && !isNodeConstructor(type)) {
    const mergedProps = { ...props, children: flattenChildren(children) };
    return type(mergedProps) as T | Node[];
  }

  // Class component (existing logic)
  const node = new (type as NodeConstructor<T>)();
  // ... apply props, add children, fill ref
  return node;
}

function isNodeConstructor(fn: Function): boolean {
  // Check if it's a class (has prototype chain from Node)
  return fn.prototype instanceof Node || fn === Node;
}
```

### Prefab with Refs

Functional components can accept and forward refs:

```tsx
function PlayerPrefab(props: { ref?: Ref<Actor> }) {
  return (
    <Actor ref={props.ref}>
      <CollisionShape shape={Shape.rect(6, 7)} />
      <AnimatedSprite spriteSheet={entitySheet} animation="idle" />
    </Actor>
  );
}
```

### Composition Prefabs (No Root Node)

A functional component can return a Fragment — useful for injecting a group of children:

```tsx
function StandardHUD() {
  return <>
    <Label text="Score: 0" position={[10, 10]} fontSize={8} />
    <Label text="Health" position={[10, 22]} fontSize={8} />
    <ProgressBar position={[50, 22]} width={60} height={8} value={100} />
  </>;
}

// Usage in a Layer:
<Layer fixed zIndex={100}>
  <StandardHUD />
</Layer>
```

### Phase 4 Checklist

- [ ] Detect functional components in `h()` (function that doesn't extend Node)
- [ ] Pass merged props (including flattened children) to functional component
- [ ] Support Fragment return from functional components
- [ ] Support ref forwarding in functional components
- [ ] Unit tests for functional components
- [ ] Type checking: functional component props are validated

---

## Template Method Inheritance Pattern

This isn't a separate implementation phase — it's a **usage pattern** enabled by Phases 1–3. But it's the core architectural value of JSX for games, so it's documented here.

### The Pattern

A base class defines the overall scene structure with named hook methods. Subclasses override hooks to inject content into specific regions of the tree.

```tsx
abstract class Level extends Scene {
  player = ref<Player>();
  map = ref<TileMap>();
  score = signal(0);

  // Subclasses must provide:
  abstract mapAsset: string;
  abstract spawnPoint: [number, number];

  declare() {
    return <>
      <TileMap
        ref={this.map}
        tilesetImage="tileset"
        asset={this.mapAsset}
      />
      <Player ref={this.player} position={this.spawnPoint} />
      <Camera follow={this.player} smoothing={0.1} />
      <Node2D ySortChildren zIndex={1}>
        {this.declareEntities()}
      </Node2D>
      <Layer fixed zIndex={100}>
        {this.declareHUD()}
      </Layer>
    </>;
  }

  // Hooks with sensible defaults
  declareEntities(): JSX.Element { return <></>; }

  declareHUD(): JSX.Element {
    return <Label text={() => `Score: ${this.score.value}`} position={[10, 10]} />;
  }
}
```

### Subclass: Simple Level

```tsx
class Level1 extends Level {
  mapAsset = "level1.json";
  spawnPoint: [number, number] = [100, 400];

  declareEntities() {
    return <>
      <Skeleton position={[200, 300]} />
      <Skeleton position={[500, 280]} />
      <Coin position={[350, 200]} />
      <Coin position={[380, 200]} />
    </>;
  }
}
```

### Subclass: Boss Level (Override HUD)

```tsx
class BossLevel extends Level {
  mapAsset = "boss-arena.json";
  spawnPoint: [number, number] = [50, 400];
  boss = ref<Dragon>();

  declareEntities() {
    return <Dragon ref={this.boss} position={[400, 200]} />;
  }

  declareHUD() {
    return <>
      {super.declareHUD()}
      <ProgressBar
        value={() => this.boss.current!.health / this.boss.current!.maxHealth}
        width={200}
        fillColor="#ff0000"
        position={[100, 10]}
      />
    </>;
  }
}
```

### Subclass: Completely Custom

A subclass can override `declare()` entirely if the parent structure doesn't fit:

```tsx
class CutsceneLevel extends Level {
  mapAsset = "cutscene.json";
  spawnPoint: [number, number] = [0, 0];

  // Full override — ignores parent structure
  declare() {
    return <>
      <TileMap asset="cutscene.json" tilesetImage="cutscene-tiles" />
      <CutscenePlayer position={[100, 200]} />
      {/* No camera, no HUD, no entity layer */}
    </>;
  }
}
```

### Customization Spectrum

| Customization depth | Mechanism | Example |
|---|---|---|
| Change a value | Override class property | `mapAsset = "level2.json"` |
| Add content to a region | Override `declareXxx()` hook | `declareEntities() { return <Skeleton .../> }` |
| Extend a region | `super.declareXxx()` + additions | `super.declareHUD()` + boss health bar |
| Replace entire structure | Override `declare()` | Custom cutscene layout |
| Add imperative logic | `onReady()` after super | Dynamic spawning from Tiled data |

---

## Entity `declare()` Example

Entities (not just Scenes) benefit from `declare()`:

### Before (imperative)

```typescript
class Player extends Actor {
  private _sprite!: AnimatedSprite;

  override onReady() {
    super.onReady();
    this.addChild(CollisionShape).shape = Shape.rect(6, 7);
    this.tag("player");
    this._sprite = this.addChild(AnimatedSprite);
    this._sprite.spriteSheet = entitySheet;
    this._sprite.play("player_idle");
  }
}
```

### After (JSX)

```tsx
class Player extends Actor {
  private sprite = ref<AnimatedSprite>();

  declare() {
    return <>
      <CollisionShape shape={Shape.rect(6, 7)} />
      <AnimatedSprite ref={this.sprite} spriteSheet={entitySheet} animation="player_idle" />
    </>;
  }

  onReady() {
    this.tag("player");
    // this.sprite.current is ready
  }
}
```

---

## UI Composition Example

UI benefits the most from JSX — deep nesting becomes readable:

### Before (imperative, from tween-ui example)

```typescript
onReady() {
  const hud = new Layer();
  hud.fixed = true;
  hud.zIndex = 100;
  this.addChild(hud);

  const topPanel = new Panel();
  topPanel.width = 500;
  topPanel.height = 36;
  topPanel.backgroundColor = Color.fromHex("#000000").withAlpha(0.6);
  hud.addChild(topPanel);

  const title = new Label();
  title.text = "Tween & UI Showcase";
  title.fontSize = 18;
  title.color = Color.fromHex("#e0e0e0");
  title.align = "center";
  title.width = 500;
  title.height = 36;
  hud.addChild(title);

  const btnContainer = new Container();
  btnContainer.direction = "horizontal";
  btnContainer.gap = 10;
  btnContainer.padding = 10;
  hud.addChild(btnContainer);

  const bounceBtn = new Button();
  bounceBtn.text = "Bounce";
  bounceBtn.width = 90;
  bounceBtn.height = 34;
  bounceBtn.fontSize = 13;
  bounceBtn.backgroundColor = Color.fromHex("#e91e63");
  btnContainer.addChild(bounceBtn);

  bounceBtn.onPressed.connect(() => this.doBounce());
  // ... repeat for each button
}
```

### After (JSX)

```tsx
declare() {
  return (
    <Layer fixed zIndex={100}>
      <Panel width={500} height={36} backgroundColor="#000000">
        <Label text="Tween & UI Showcase" fontSize={18} color="#e0e0e0"
               align="center" width={500} height={36} />
      </Panel>
      <Container direction="horizontal" gap={10} padding={10} position={[10, 298]}>
        <Button text="Bounce" width={90} height={34} fontSize={13}
                backgroundColor="#e91e63" onPressed={() => this.doBounce()} />
        <Button text="Fade" width={90} height={34} fontSize={13}
                backgroundColor="#2196f3" onPressed={() => this.doFade()} />
        <Button text="Spin" width={90} height={34} fontSize={13}
                backgroundColor="#ff9800" onPressed={() => this.doSpin()} />
      </Container>
    </Layer>
  );
}
```

The tree structure is visible. 40+ lines become 15.

---

## The `h()` Function Without JSX

Users who don't want to configure TypeScript for JSX can use `h()` directly:

```typescript
import { h, Fragment, ref } from "@quintus/jsx";
import { Player, Camera, TileMap } from "./entities.js";

class Level1 extends Scene {
  player = ref<Player>();

  declare() {
    return h(Fragment, null,
      h(TileMap, { tilesetImage: "tileset", asset: "level1.json" }),
      h(Player, { ref: this.player, position: [100, 400] }),
      h(Camera, { follow: this.player, smoothing: 0.1 }),
    );
  }
}
```

Not as pretty, but works with zero config changes. This is also what tests use when testing the runtime without needing `.tsx` compilation.

---

## Phase 5: Tests & Examples

### Tests

**Unit: `packages/jsx/src/h.test.ts`**
- `h()` with class component creates node instance
- `h()` applies props via Object.assign
- `h()` adds children to node
- `h()` fills ref.current
- `h()` with Fragment returns flat Node array
- `h()` with null/false children skips them
- `h()` coercion: tuple → Vec2
- `h()` coercion: string → Color for color props
- `h()` coercion: number → Vec2 for scale
- `h()` signal auto-connect: function prop on Signal property
- `h()` with functional component calls function and returns result
- `h()` with nested children builds correct tree

**Unit: `packages/jsx/src/ref.test.ts`**
- `ref()` starts with current === null
- ref.current set by h() when ref prop is provided
- Multiple refs in same tree all populated

**Integration: `packages/jsx/src/declare.test.ts`**
- Scene with `declare()` → children in tree before `onReady()`
- Node with `declare()` → children ready before parent's `onReady()`
- Nested `declare()` → grandchildren ready before grandparent
- `declare()` + imperative `addChild` in `onReady()` coexist
- `declare()` returning null → no effect
- `declare()` returning Fragment → multiple root children
- Template method pattern: base class `declare()` calls subclass hook
- Ref populated by `onReady()` time

**Type tests: `packages/jsx/src/types.test-d.ts`**
- `<Label text="foo" />` — valid
- `<Label bogus={42} />` — type error
- `<Label position={[10, 20]} />` — valid (Vec2 coercion)
- `<Label position="bad" />` — type error
- `<Button onPressed={() => {}} />` — valid (Signal handler)
- `<Button onPressed={42} />` — type error

### Example Conversion

Convert the tween-ui example to offer a JSX variant alongside the imperative one, demonstrating both approaches work:

- [ ] Create `examples/jsx-demo/` with JSX versions of UI composition
- [ ] Show template method inheritance with a simple Level base class

### Phase 5 Checklist

- [ ] Unit tests for `h()` (class, Fragment, coercion, signals, children, refs)
- [ ] Unit tests for `ref()`
- [ ] Integration tests for `declare()` lifecycle
- [ ] Type-level tests for JSX prop validation
- [ ] JSX demo example
- [ ] Verify `pnpm build` and `pnpm test` pass across all packages

---

## Build Configuration

### tsup Configuration

```typescript
// packages/jsx/tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/jsx-runtime.ts",
    "src/jsx-dev-runtime.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
});
```

Note: three entry points. The `jsx-runtime` and `jsx-dev-runtime` are resolved by TypeScript's automatic JSX transform — they must be importable as `@quintus/jsx/jsx-runtime`.

### package.json Exports

```json
{
  "name": "@quintus/jsx",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./jsx-runtime": {
      "import": "./dist/jsx-runtime.js",
      "require": "./dist/jsx-runtime.cjs",
      "types": "./dist/jsx-runtime.d.ts"
    },
    "./jsx-dev-runtime": {
      "import": "./dist/jsx-dev-runtime.js",
      "require": "./dist/jsx-dev-runtime.cjs",
      "types": "./dist/jsx-dev-runtime.d.ts"
    }
  }
}
```

### TypeScript Configuration for JSX Users

Users add this to their `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@quintus/jsx"
  }
}
```

This is per-project, NOT in the engine's tsconfig.base.json. The engine packages themselves don't use JSX — only user code does (and optionally, JSX-based examples).

---

## What This Design Does NOT Include

1. **Reactive props / signals-as-props** — the `() => expression` pattern shown in the brainstorm (where function props auto-subscribe to signals) is deferred. V1 only connects signals, it doesn't create reactive bindings. Reactive UI would be a future enhancement.
2. **Key-based reconciliation** — no list diffing or DOM-style reconciliation. JSX runs once. Dynamic lists use imperative code.
3. **Context / providers** — no React-style context system. Use the existing scene tree queries (`findByType`, signals) for cross-node communication.
4. **Hot reloading** — no HMR for JSX trees. Changing JSX requires a scene restart.

---

## Definition of Done

- [ ] All phases marked Done in status table
- [ ] `@quintus/jsx` package builds successfully
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes with no warnings
- [ ] `pnpm lint` clean
- [ ] JSX demo runs in browser via `pnpm dev`
- [ ] Existing tests unaffected (declare() returns null by default)
- [ ] No bundle size impact on users who don't import `@quintus/jsx`
