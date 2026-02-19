# JSX Declarative Build Pattern — Detailed Design

> **Goal:** Add an optional JSX-based `build()` pattern that makes node tree composition visual and concise — especially for UI, scene setup, and entity prefabs.
> **Outcome:** A new `@quintus/jsx` package that provides a custom JSX runtime. Users who opt in get `<TileMap asset="level1.json" />` syntax; everyone else keeps using `this.add(TileMap)` with zero impact.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Package setup & core runtime (`h`, `jsx`, `Fragment`, `ref`, coercion) | Done |
| 2 | TypeScript JSX type definitions | Done |
| 3 | Lifecycle integration (`build()` on Node) | Pending |
| 4 | Functional components (prefabs) | Pending |
| 5 | Tests & examples | Pending |
| 6 | Reactive props (`bind()` connect bridge) | Pending |

---

## Design Principles

1. **Purely optional** — zero changes to existing imperative API. No user sees JSX unless they opt in.
2. **One-shot creation** — JSX runs once to build the node tree, like SolidJS. No virtual DOM, no re-rendering, no reconciliation.
3. **Nodes, not descriptors** — `h()` creates real Node instances eagerly. What you get back is the actual node, not a proxy.
4. **Template method inheritance** — base classes define structure with `buildXxx()` hooks; subclasses override the hooks to inject content into specific tree regions.
5. **Coercion for ergonomics** — `[100, 400]` becomes `Vec2(100, 400)`, `"#ff0000"` becomes `Color`, etc.
6. **Signal-aware** — function props auto-connect to signals on the target node.

---

## Package: `@quintus/jsx`

```
packages/jsx/
  src/
    index.ts              # Public API: h, Fragment, ref, bind
    jsx-runtime.ts        # Auto-import runtime (jsx, jsxs, Fragment)
    jsx-dev-runtime.ts    # Dev-mode runtime (same, can add warnings later)
    h.ts                  # Core factory function + jsx() wrapper
    ref.ts                # Ref<T> type and ref() factory
    coerce.ts             # Prop coercion logic
    types.ts              # JSX namespace (module-scoped)
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

### Two Entry Points: `jsx()` and `h()`

TypeScript's `react-jsx` transform emits `jsx(type, { ...props, children }, key?)` — children are **inside** the props object as `props.children`, and the third argument is `key`, not a child. The manual hyperscript API `h()` uses the more familiar `h(type, props, ...children)` rest-params signature.

Both entry points share the same internal creation logic:

```typescript
// packages/jsx/src/h.ts

import { Node, type NodeConstructor, IS_NODE_CLASS } from "@quintus/core";
import { applyProp } from "./coerce.js";
import { isRef, type Ref } from "./ref.js";

export const Fragment = Symbol("Fragment");

type NodeElementChild = Node | NodeElementChild[] | null | undefined | false;

// ---- Shared internal logic ----

function _createElement<T extends Node>(
  type: NodeConstructor<T> | typeof Fragment | ((props: Record<string, unknown>) => Node | Node[]),
  props: Record<string, unknown> | null,
  children: Node[],
  key?: string | number,
): T | Node[] {
  // Fragment: just return children
  if (type === Fragment) {
    return children;
  }

  // Functional component (plain function, not a Node class)
  if (typeof type === "function" && !(IS_NODE_CLASS in type)) {
    const mergedProps = { ...props, children };
    return type(mergedProps) as T | Node[];
  }

  // Class component: create real Node instance
  const node = new (type as NodeConstructor<T>)();

  // Apply key as name (for debugging / lookups)
  if (key != null) node.name = String(key);

  if (props) {
    for (const [k, value] of Object.entries(props)) {
      if (k === "ref") {
        (value as Ref<T>).current = node;
        continue;
      }
      if (k === "children" || k === "key") continue;
      applyProp(node, k, value);
    }
  }

  // Add children via public API
  for (const child of children) {
    node.add(child);
  }

  return node;
}

// ---- JSX runtime entry point ----
// Called by TypeScript's react-jsx transform: jsx(type, { ...props, children }, key?)

export function jsx<T extends Node>(
  type: NodeConstructor<T> | typeof Fragment | ((props: Record<string, unknown>) => Node | Node[]),
  props: Record<string, unknown> | null,
  key?: string | number,
): T | Node[] {
  // Extract children from props (where TypeScript puts them)
  const rawChildren = props?.children;
  const children = rawChildren
    ? flattenChildren(Array.isArray(rawChildren) ? rawChildren : [rawChildren])
    : [];

  return _createElement(type, props, children, key);
}

export { jsx as jsxs };

// ---- Manual hyperscript entry point ----
// Called by users directly: h(Type, { prop: value }, child1, child2)

export function h<T extends Node>(
  type: NodeConstructor<T> | typeof Fragment | ((props: Record<string, unknown>) => Node | Node[]),
  props: Record<string, unknown> | null,
  ...children: NodeElementChild[]
): T | Node[] {
  return _createElement(type, props, flattenChildren(children));
}
```

**Key difference:** `jsx()` reads children from `props.children` (how TypeScript emits it), while `h()` takes children as rest params (how users write it manually). Both converge in `_createElement()`.

**`IS_NODE_CLASS`** is a `Symbol.for("quintus:NodeClass")` exported from `@quintus/core` and set as a static property on `Node`. Using `Symbol.for()` ensures it works even if multiple package instances are loaded.

### Prop Application with Coercion

```typescript
// packages/jsx/src/coerce.ts

import { Vec2, Color } from "@quintus/math";
import { Signal } from "@quintus/core";
import { isRef } from "./ref.js";

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

  // 2. Ref unwrapping: Ref<T> → T.current (the referenced node)
  if (isRef(value)) {
    (node as Record<string, unknown>)[key] = value.current;
    return;
  }

  // 3. Vec2 coercion: [x, y] tuple → Vec2
  if (Array.isArray(value) && value.length === 2
      && typeof value[0] === "number" && typeof value[1] === "number") {
    (node as Record<string, unknown>)[key] = new Vec2(value[0], value[1]);
    return;
  }

  // 4. Color coercion: "#hex" string on color-named props → Color
  if (typeof value === "string" && COLOR_PROPS.has(key)) {
    (node as Record<string, unknown>)[key] = Color.fromHex(value);
    return;
  }

  // 5. Uniform scale shorthand: scale={2} → Vec2(2, 2)
  if (key === "scale" && typeof value === "number") {
    (node as Record<string, unknown>)[key] = new Vec2(value, value);
    return;
  }

  // 6. Direct assignment (default path)
  (node as Record<string, unknown>)[key] = value;
}
```

Coercion rules (in priority order):

| Input | Target | Result |
|-------|--------|--------|
| `() => {}` on Signal prop | `Signal<T>` | `.connect(fn)` |
| `Ref<T>` | any Node prop | Unwrap to `ref.current` |
| `[100, 200]` on Vec2 prop | `Vec2` | `new Vec2(100, 200)` |
| `"#ff0000"` on color-named prop | `Color` | `Color.fromHex("#ff0000")` |
| `2` on `scale` | `Vec2` | `new Vec2(2, 2)` |
| anything else | — | Direct assignment |

### The `ref<T>()` Function

```typescript
// packages/jsx/src/ref.ts

import type { Node } from "@quintus/core";

const REF_BRAND = Symbol("Ref");

export interface Ref<T extends Node = Node> {
  current: T | null;
  readonly [REF_BRAND]: true;
}

export function ref<T extends Node>(): Ref<T> {
  return { current: null, [REF_BRAND]: true } as Ref<T>;
}

export function isRef(value: unknown): value is Ref {
  return value != null && typeof value === "object" && REF_BRAND in (value as object);
}
```

Usage:
```tsx
class Level extends Scene {
  player = ref<Player>();

  build() {
    return <Player ref={this.player} position={[100, 400]} />;
  }

  onReady() {
    // this.player.current is the Player instance
    this.player.current!.tag("hero");
  }
}
```

`ref.current` is filled during `jsx()` / `h()` execution — before the node enters the tree or `onReady()` fires. By the time any lifecycle method runs, all refs from `build()` are populated.

Refs are also **unwrapped** when passed as props to other nodes. For example, `<Camera follow={this.player} />` unwraps to `camera.follow = this.player.current` (the actual Player node), not the Ref wrapper.

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

Fragments `<>...</>` compile to `jsx(Fragment, { children: [...] })` which returns a flat `Node[]`. This lets `build()` return multiple root nodes.

### JSX Runtime Modules

TypeScript's `react-jsx` transform auto-imports from `@quintus/jsx/jsx-runtime`:

```typescript
// packages/jsx/src/jsx-runtime.ts
export { jsx, jsxs, Fragment } from "./h.js";
```

```typescript
// packages/jsx/src/jsx-dev-runtime.ts
import { jsx, Fragment } from "./h.js";
export { jsx as jsxDEV, Fragment };
```

Note: `jsxDEV` has additional parameters `(type, props, key, isStaticChildren, source, self)` in React's convention. We accept and ignore the extras since `jsx()` uses `...rest` for future compatibility.

### Phase 1 Checklist

- [x] Create `packages/jsx/` package structure (package.json, tsconfig, tsup.config)
- [x] Add `IS_NODE_CLASS` symbol to `Node` in `@quintus/core` (static readonly property + export)
- [x] Implement `_createElement()` shared factory logic
- [x] Implement `jsx()` entry point (children in props, key param)
- [x] Implement `h()` entry point (children as rest params)
- [x] Implement `flattenChildren()` with null/false/array handling
- [x] Implement `applyProp()` with coercion (Vec2 tuples, Color strings, scale shorthand, Signal connect, Ref unwrapping)
- [x] Implement `ref<T>()` factory with branded symbol
- [x] Implement `isRef()` type guard
- [x] Implement `Fragment` symbol
- [x] Create `jsx-runtime.ts` and `jsx-dev-runtime.ts` exports
- [x] Export public API from `src/index.ts`
- [x] Unit tests for `jsx()`, `h()`, `ref()`, `isRef()`, `applyProp()`

---

## Phase 2: TypeScript JSX Type Definitions

The type system must ensure that `<Label text="foo" bogus={42} />` is a type error. This is the most technically complex part.

### Module-Scoped JSX Namespace

Modern TypeScript (5.1+) resolves JSX types from the `jsxImportSource` module, so **no global namespace pollution** is needed. The JSX namespace is exported from the runtime module, avoiding conflicts with React or other JSX libraries in the same project.

```typescript
// packages/jsx/src/types.ts

import type { Node, NodeConstructor, Signal } from "@quintus/core";
import type { Vec2, Color } from "@quintus/math";
import type { Ref } from "./ref.js";

// ---- Utility types ----

/** Extract writable (non-readonly) keys from a type, excluding methods and _ prefixed. */
type WritableKeys<T> = {
  [K in keyof T]-?: K extends `_${string}` ? never :
    T[K] extends Function ? never :
    IfEquals<{ [Q in K]: T[K] }, { -readonly [Q in K]: T[K] }, K>
}[keyof T];

type IfEquals<X, Y, A = X, B = never> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B;

/** Coerce property types for JSX ergonomics. */
type CoercedPropType<T> =
  T extends Vec2 ? Vec2 | [number, number] :
  T extends Color ? Color | string :
  T;

/** Extract Signal properties (including readonly ones) and offer handler functions. */
type SignalProps<T> = {
  [K in keyof T as T[K] extends Signal<unknown> ? K : never]?:
    T[K] extends Signal<infer P> ? (payload: P) => void : never;
};

/**
 * JSX props for a Node class T:
 * - All writable, non-method, non-underscored public properties (with coercion)
 * - Signal properties accept handler functions (even if readonly)
 * - Plus ref, children, key
 */
export type NodeJSXProps<T extends Node> = {
  [K in WritableKeys<T>]?: CoercedPropType<T[K]>;
} & SignalProps<T> & {
  ref?: Ref<T>;
  children?: Node | Node[];
  key?: string | number;
};
```

### JSX Namespace in Runtime Module

```typescript
// Appended to packages/jsx/src/jsx-runtime.ts (or a separate .d.ts)

import type { Node, NodeConstructor } from "@quintus/core";
import type { Ref } from "./ref.js";
import type { NodeJSXProps } from "./types.js";

export namespace JSX {
  /** A JSX expression evaluates to a Node (or Node[] for fragments). */
  export type Element = Node | Node[];

  /** Class components must extend Node. */
  export type ElementClass = Node;

  /** Tell TS how to derive prop types from Node constructors. */
  export type LibraryManagedAttributes<C, P> =
    C extends NodeConstructor<infer T> ? NodeJSXProps<T> : P;

  /** No intrinsic elements (no lowercase tags like <div>). */
  export interface IntrinsicElements {}
}
```

### Prop Type Derivation Strategy

We use `LibraryManagedAttributes` (automatic approach) — zero boilerplate, any Node class works as JSX automatically. The `WritableKeys` utility already handles safety:

- `readonly` properties excluded (handles `id`, `_isScene`, etc.)
- `_`-prefixed properties excluded (handles `_parent`, `_children`, etc.)
- Function-typed properties excluded (handles `onUpdate`, `destroy`, etc.)
- Signal properties handled separately via `SignalProps` (allows handler connection even though signals are readonly)

### Scene Exclusion

`Scene` requires a `game: Game` constructor argument, so its constructor signature `new (game: Game) => Scene` doesn't match `NodeConstructor<T>` which requires `new () => T`. This means `<Level1 />` is already a **type error** — Scene subclasses can't be used in JSX because they don't satisfy the zero-arg constructor constraint.

For extra safety, `_createElement` can add a runtime check:

```typescript
if (typeof type === "function" && type.prototype?._isScene) {
  throw new Error(`Cannot use Scene class "${type.name}" in JSX. Scenes are created via game.start().`);
}
```

### Phase 2 Checklist

- [x] Define `WritableKeys<T>` (excluding methods, `_` prefixed, readonly)
- [x] Define `CoercedPropType<T>`, `SignalProps<T>`, `NodeJSXProps<T>` utility types
- [x] Export module-scoped `JSX` namespace from `jsx-runtime.ts`
- [x] Implement `LibraryManagedAttributes` to auto-derive props from Node classes
- [x] Verify type-checking: valid props pass, invalid props error
- [x] Verify coercion types: `position={[100, 200]}` accepted, `position="bad"` rejected
- [x] Verify signal types: `onPressed={() => {}}` accepted, `onPressed={42}` rejected
- [x] Verify Scene exclusion: `<Level1 />` is a type error
- [x] Write type-level tests (`.test-d.ts` files using `expectTypeOf` / `assertType`)

---

## Phase 3: Lifecycle Integration

### The `build()` Method

Added to `Node` as a no-op virtual method. Returns the node's "built" children — nodes created via JSX (or `h()` directly) that should be added as children when the node enters the tree.

```typescript
// In packages/core/src/node.ts

/** Override to declaratively define child nodes (used with @quintus/jsx). */
build(): Node | Node[] | null {
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

With `build()`:

```
1. node._isInsideTree = true
2. node.onEnterTree()
3. node.treeEntered.emit()
4. Process build() → add returned nodes as children  [NEW]
5. for each child (existing + built) → recurse
6. if (!ready) → onReady(), readySignal.emit()
```

```typescript
// Modified _enterTreeRecursive in packages/core/src/node.ts

private _enterTreeRecursive(node: Node): void {
  node._isInsideTree = true;
  node.onEnterTree();
  node.treeEntered.emit();

  // NEW: Process build() — add built children before recursing
  const built = node.build();
  if (built) {
    const nodes = Array.isArray(built) ? built.flat(Infinity) : [built];
    for (const child of nodes) {
      if (child instanceof Node && !child._parent) {
        // Direct add to _children — skip nested _enterTreeRecursive
        // (we'll enter these children in the loop below)
        node._children.push(child);
        child._parent = node;
      }
    }
  }

  // Enter children (now includes both pre-existing and built children)
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

**Why direct `_children.push` instead of `_addChildNode()`?** Because `_addChildNode` would trigger a nested `_enterTreeRecursive` call (the parent already has `_isInsideTree = true`). We need to defer tree-entry until step 5, where all children (pre-existing + built) are entered in order. The `!child._isInsideTree` guard ensures no double-entry.

This code is all within the `Node` class (in `@quintus/core`), so private field access is valid.

### Scene Special Case

`Game._loadScene()` calls `scene.onReady()` directly (Scene is the tree root, not added via `addChild`). We need to process `build()` here too:

```typescript
// In packages/core/src/game.ts

private _loadScene(SceneClass: SceneConstructor): void {
  const scene = new SceneClass(this);
  this._currentScene = scene;

  // NEW: Process build() for the scene root
  const built = scene.build();
  if (built) {
    const nodes = Array.isArray(built) ? built.flat(Infinity) : [built];
    for (const child of nodes) {
      if (child instanceof Node) {
        scene.add(child);  // triggers _enterTreeRecursive normally
      }
    }
  }

  scene.onReady();
  scene._markReady();
  scene.sceneReady.emit();

  this.renderer?.markRenderDirty();
}
```

**Flow for a Scene with `build()`:**
1. `new Level1(game)` — constructor runs, but `build()` NOT called yet
2. `scene.build()` → returns JSX tree (nodes created eagerly by `jsx()` / `h()`)
3. `scene.add(player)` → player enters tree → player's `build()` runs → player's children enter tree → player's `onReady()` fires
4. `scene.add(camera)` → camera enters tree → camera's `onReady()` fires
5. `scene.onReady()` → runs AFTER all built children are ready

This means by the time `scene.onReady()` executes, every built child (and their children) are in the tree and ready. All refs are populated. Imperative code in `onReady()` can safely access them.

### Interaction Between `build()` and `jsx()` Children

A node can have children from two sources:
1. **JSX composition children:** `<Player><HealthBar /></Player>` — HealthBar is added by `jsx()` before Player enters the tree
2. **`build()` children:** Player's own `build()` returns CollisionShape + AnimatedSprite

Both coexist. The order is:
- JSX children first (already in `_children` when `build()` runs)
- `build()` children second (appended during tree entry)

This is intuitive: "I'm a Player. The JSX that created me gave me a HealthBar. My own `build()` adds my intrinsic CollisionShape and Sprite."

### Phase 3 Checklist

- [ ] Add `build(): Node | Node[] | null` virtual method to `Node` base class
- [ ] Modify `_enterTreeRecursive` to process `build()` before recursing children
- [ ] Modify `Game._loadScene` to process Scene's `build()` before `onReady()`
- [ ] Test: `build()` children are in tree before `onReady()` fires
- [ ] Test: refs from `build()` are populated by `onReady()` time
- [ ] Test: nested `build()` works (Scene builds Player, Player builds CollisionShape)
- [ ] Test: `build()` + imperative `add()` in `onReady()` coexist
- [ ] Test: nodes without `build()` (returns null) are unaffected
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

### How It Works in `_createElement()`

Functional components are detected via the `IS_NODE_CLASS` symbol:

```typescript
// In _createElement():
if (typeof type === "function" && !(IS_NODE_CLASS in type)) {
  // It's a functional component — call it with merged props
  const mergedProps = { ...props, children };
  return type(mergedProps) as T | Node[];
}
```

**Why `IS_NODE_CLASS` instead of `fn.prototype instanceof Node`?** The symbol check is resilient to duplicate package instances (uses `Symbol.for()`), doesn't require prototype chain traversal, and works even with minified or proxied constructors. It's set as a static property on `Node`:

```typescript
// In @quintus/core/src/node.ts
export const IS_NODE_CLASS = Symbol.for("quintus:NodeClass");

class Node {
  static readonly [IS_NODE_CLASS] = true;
  // ... rest of Node
}
```

All Node subclasses inherit the static symbol automatically.

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

- [ ] Detect functional components in `_createElement()` via `IS_NODE_CLASS` symbol
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

  // Subclasses must provide:
  abstract mapAsset: string;
  abstract spawnPoint: [number, number];

  build() {
    return <>
      <TileMap
        ref={this.map}
        tilesetImage="tileset"
        asset={this.mapAsset}
      />
      <Player ref={this.player} position={this.spawnPoint} />
      <Camera follow={this.player} smoothing={0.1} />
      <Node2D ySortChildren zIndex={1}>
        {this.buildEntities()}
      </Node2D>
      <Layer fixed zIndex={100}>
        {this.buildHUD()}
      </Layer>
    </>;
  }

  // Hooks with sensible defaults
  buildEntities(): JSX.Element { return <></>; }

  buildHUD(): JSX.Element {
    return <Label text="Score: 0" position={[10, 10]} />;
  }
}
```

Note: `follow={this.player}` passes a `Ref<Player>` — the coercion system auto-unwraps it to `this.player.current` (the actual Player node).

### Subclass: Simple Level

```tsx
class Level1 extends Level {
  mapAsset = "level1.json";
  spawnPoint: [number, number] = [100, 400];

  buildEntities() {
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

  buildEntities() {
    return <Dragon ref={this.boss} position={[400, 200]} />;
  }

  buildHUD() {
    return <>
      {super.buildHUD()}
      <ProgressBar
        width={200}
        fillColor="#ff0000"
        position={[100, 10]}
      />
    </>;
  }
}
```

Note: The boss health bar's `value` would be updated imperatively in `onReady()` or via the `bind()` reactive bridge (see Phase 6).

### Subclass: Completely Custom

A subclass can override `build()` entirely if the parent structure doesn't fit:

```tsx
class CutsceneLevel extends Level {
  mapAsset = "cutscene.json";
  spawnPoint: [number, number] = [0, 0];

  // Full override — ignores parent structure
  build() {
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
| Add content to a region | Override `buildXxx()` hook | `buildEntities() { return <Skeleton .../> }` |
| Extend a region | `super.buildXxx()` + additions | `super.buildHUD()` + boss health bar |
| Replace entire structure | Override `build()` | Custom cutscene layout |
| Add imperative logic | `onReady()` after super | Dynamic spawning from Tiled data |

---

## Entity `build()` Example

Entities (not just Scenes) benefit from `build()`:

### Before (imperative)

```typescript
class Player extends Actor {
  private _sprite!: AnimatedSprite;

  override onReady() {
    super.onReady();
    this.add(CollisionShape, { shape: Shape.rect(6, 7) });
    this.tag("player");
    this._sprite = this.add(AnimatedSprite);
    this._sprite.spriteSheet = entitySheet;
    this._sprite.play("player_idle");
  }
}
```

### After (JSX)

```tsx
class Player extends Actor {
  private sprite = ref<AnimatedSprite>();

  build() {
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
  const hud = this.add(Layer);
  hud.fixed = true;
  hud.zIndex = 100;

  const topPanel = hud.add(Panel);
  topPanel.width = 500;
  topPanel.height = 36;
  topPanel.backgroundColor = Color.fromHex("#000000").withAlpha(0.6);

  const title = hud.add(Label);
  title.text = "Tween & UI Showcase";
  title.fontSize = 18;
  title.color = Color.fromHex("#e0e0e0");
  title.align = "center";
  title.width = 500;
  title.height = 36;

  const btnContainer = hud.add(Container);
  btnContainer.direction = "horizontal";
  btnContainer.gap = 10;
  btnContainer.padding = 10;

  const bounceBtn = btnContainer.add(Button);
  bounceBtn.text = "Bounce";
  bounceBtn.width = 90;
  bounceBtn.height = 34;
  bounceBtn.fontSize = 13;
  bounceBtn.backgroundColor = Color.fromHex("#e91e63");

  bounceBtn.onPressed.connect(() => this.doBounce());
  // ... repeat for each button
}
```

### After (JSX)

```tsx
build() {
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

  build() {
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
- `jsx()` with class component creates node instance
- `jsx()` extracts children from props.children
- `jsx()` passes key to node.name
- `h()` with class component creates node instance
- `h()` takes children as rest params
- `h()` / `jsx()` applies props via applyProp
- `h()` / `jsx()` fills ref.current
- Fragment returns flat Node array
- null/false children are skipped
- Coercion: tuple → Vec2
- Coercion: string → Color for color props
- Coercion: number → Vec2 for scale
- Coercion: Ref → unwrapped .current
- Signal auto-connect: function prop on Signal property
- Functional component: calls function and returns result
- Functional component: detected via IS_NODE_CLASS absence
- Nested children builds correct tree
- Scene subclass in jsx() throws runtime error

**Unit: `packages/jsx/src/ref.test.ts`**
- `ref()` starts with current === null
- `ref()` has REF_BRAND symbol
- `isRef()` returns true for ref objects
- `isRef()` returns false for plain objects
- ref.current set by jsx() when ref prop is provided
- Multiple refs in same tree all populated

**Integration: `packages/jsx/src/build.test.ts`**
- Scene with `build()` → children in tree before `onReady()`
- Node with `build()` → children ready before parent's `onReady()`
- Nested `build()` → grandchildren ready before grandparent
- `build()` + imperative `add()` in `onReady()` coexist
- `build()` returning null → no effect
- `build()` returning Fragment → multiple root children
- Template method pattern: base class `build()` calls subclass hook
- Ref populated by `onReady()` time

**Type tests: `packages/jsx/src/types.test-d.ts`**
- `<Label text="foo" />` — valid
- `<Label bogus={42} />` — type error
- `<Label position={[10, 20]} />` — valid (Vec2 coercion)
- `<Label position="bad" />` — type error
- `<Button onPressed={() => {}} />` — valid (Signal handler)
- `<Button onPressed={42} />` — type error
- `<Label onUpdate={...} />` — type error (methods excluded)
- `<Label _parent={...} />` — type error (underscore excluded)

### Example Conversion

Convert the tween-ui example to offer a JSX variant alongside the imperative one, demonstrating both approaches work:

- [ ] Create `examples/jsx-demo/` with JSX versions of UI composition
- [ ] Show template method inheritance with a simple Level base class

### Phase 5 Checklist

- [ ] Unit tests for `jsx()` and `h()` (class, Fragment, coercion, signals, children, refs, key)
- [ ] Unit tests for `ref()` and `isRef()`
- [ ] Integration tests for `build()` lifecycle
- [ ] Type-level tests for JSX prop validation
- [ ] JSX demo example
- [ ] Verify `pnpm build` and `pnpm test` pass across all packages

---

## Phase 6: Reactive Props (`bind()` Connect Bridge)

Phases 1–5 provide one-shot JSX — `build()` runs once to create the tree. But game UIs often need dynamic updates: score labels, health bars, ammo counters. Phase 6 adds a lightweight **connect bridge** that links signals to node properties without a full reactive system.

### The `bind()` Helper

```typescript
// packages/jsx/src/bind.ts

import type { Signal } from "@quintus/core";

const BINDING_BRAND = Symbol("Binding");

export interface ReactiveBinding<T = unknown> {
  readonly [BINDING_BRAND]: true;
  readonly signal: Signal<unknown>;
  readonly compute: (...args: unknown[]) => T;
}

/**
 * Create a reactive binding: when the signal emits, the compute function
 * is called and its return value is assigned to the target property.
 *
 * The compute function is also called once immediately during applyProp()
 * to set the initial value.
 */
export function bind<S, T>(
  signal: Signal<S>,
  compute: (payload: S) => T,
): ReactiveBinding<T>;
export function bind<T>(
  signal: Signal<void>,
  compute: () => T,
): ReactiveBinding<T>;
export function bind(
  signal: Signal<unknown>,
  compute: (...args: unknown[]) => unknown,
): ReactiveBinding {
  return { [BINDING_BRAND]: true, signal, compute };
}

export function isBinding(value: unknown): value is ReactiveBinding {
  return value != null && typeof value === "object" && BINDING_BRAND in (value as object);
}
```

### Integration with `applyProp()`

A new coercion rule (highest priority after signal auto-connect):

```typescript
// In applyProp(), added as rule 2:

// 2. Reactive binding: bind(signal, compute) → initial value + auto-update
if (isBinding(value)) {
  // Set initial value
  (node as Record<string, unknown>)[key] = value.compute();
  // Connect for future updates
  value.signal.connect((...args: unknown[]) => {
    (node as Record<string, unknown>)[key] = value.compute(...args);
  });
  return;
}
```

Updated coercion rules (in priority order):

| Input | Target | Result |
|-------|--------|--------|
| `() => {}` on Signal prop | `Signal<T>` | `.connect(fn)` |
| `bind(signal, fn)` | any prop | Initial `fn()` + re-assign on emit |
| `Ref<T>` | any Node prop | Unwrap to `ref.current` |
| `[100, 200]` on Vec2 prop | `Vec2` | `new Vec2(100, 200)` |
| `"#ff0000"` on color-named prop | `Color` | `Color.fromHex("#ff0000")` |
| `2` on `scale` | `Vec2` | `new Vec2(2, 2)` |
| anything else | — | Direct assignment |

### Usage Examples

**Score label (Signal<void>, reads value by closure):**
```tsx
class Level extends Scene {
  private _score = 0;
  readonly scoreChanged = signal<void>();

  buildHUD() {
    return <Label
      text={bind(this.scoreChanged, () => `Score: ${this._score}`)}
      position={[10, 10]}
    />;
  }

  addScore(points: number) {
    this._score += points;
    this.scoreChanged.emit();
  }
}
```

**Boss health bar (Signal<number>, uses payload directly):**
```tsx
class BossLevel extends Level {
  boss = ref<Dragon>();

  buildHUD() {
    return <>
      {super.buildHUD()}
      <ProgressBar
        value={bind(this.boss.current!.healthChanged, (hp) => hp / 100)}
        width={200}
        fillColor="#ff0000"
        position={[100, 10]}
      />
    </>;
  }
}
```

### Cleanup

When a node is removed from the tree (`destroy()` or `removeChild()`), signal connections made by `bind()` must be disconnected to prevent memory leaks.

**Approach:** `applyProp()` stores binding disconnect handles on the node (e.g., in a `WeakMap<Node, Array<() => void>>`). The `Node.destroy()` override (or an `onExitTree` hook) calls all disconnect handles.

```typescript
// Internal cleanup registry
const bindingCleanups = new WeakMap<Node, Array<() => void>>();

// In applyProp(), after connecting:
const disconnect = value.signal.connect((...args) => { ... });
const cleanups = bindingCleanups.get(node as Node) ?? [];
cleanups.push(disconnect);
bindingCleanups.set(node as Node, cleanups);
```

The cleanup integration hooks into `Node.onExitTree()` or is called explicitly during `destroy()`. Since this only affects nodes using `bind()`, there's zero overhead for nodes that don't.

### Phase 6 Checklist

- [ ] Implement `bind()` factory and `isBinding()` guard
- [ ] Add reactive binding detection to `applyProp()` (before Ref unwrapping)
- [ ] Implement cleanup registry (WeakMap of disconnect handles)
- [ ] Hook cleanup into `Node.destroy()` / `onExitTree()`
- [ ] Unit tests: `bind()` sets initial value via `compute()`
- [ ] Unit tests: `bind()` updates value on signal emit
- [ ] Unit tests: `bind()` with payload (Signal<number>)
- [ ] Unit tests: `bind()` with void signal (Signal<void>)
- [ ] Unit tests: cleanup disconnects on node destroy
- [ ] Integration test: score label updates in real scene
- [ ] Type checking: `bind(signal, compute)` return type matches target prop type

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

1. **Key-based reconciliation** — no list diffing or DOM-style reconciliation. JSX runs once. Dynamic lists use imperative code.
2. **Context / providers** — no React-style context system. Use the existing scene tree queries (`findByType`, signals) for cross-node communication.
3. **Hot reloading** — no HMR for JSX trees. Changing JSX requires a scene restart.

---

## Definition of Done

- [ ] All phases marked Done in status table
- [ ] `@quintus/jsx` package builds successfully
- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes with no warnings
- [ ] `pnpm lint` clean
- [ ] JSX demo runs in browser via `pnpm dev`
- [ ] Existing tests unaffected (build() returns null by default)
- [ ] No bundle size impact on users who don't import `@quintus/jsx`
