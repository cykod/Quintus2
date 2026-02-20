# JSX Declarative Build Pattern — Detailed Design

> **Goal:** Add an optional JSX-based `build()` pattern that makes node tree composition visual and concise — especially for UI, scene setup, and entity prefabs.
> **Outcome:** A new `@quintus/jsx` package that provides a custom JSX runtime. Users who opt in get `<TileMap asset="level1.json" />` syntax; everyone else keeps using `this.add(TileMap)` with zero impact.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Package setup & core runtime (`h`, `jsx`, `Fragment`, refs, coercion) | Done |
| 2 | TypeScript JSX type definitions | Done |
| 3 | Lifecycle integration (`build()` on Node, build owner, `$` ref resolution) | Done |
| 4 | Convert platformer example to TSX | Pending |
| 5 | Tests & examples | Pending |
| 6 | Reactive props (`bind()` connect bridge) | Pending |

---

## Design Principles

1. **Purely optional** — zero changes to existing imperative API. No user sees JSX unless they opt in.
2. **One-shot creation** — JSX runs once to build the node tree, like SolidJS. No virtual DOM, no re-rendering, no reconciliation.
3. **Nodes, not descriptors** — `h()` creates real Node instances eagerly. What you get back is the actual node, not a proxy.
4. **Template method inheritance** — base classes define structure with `buildXxx()` hooks; subclasses override the hooks to inject content into specific tree regions.
5. **Coercion for ergonomics** — `[100, 400]` becomes `Vec2(100, 400)`, `"#ff0000"` becomes `Color`, `"$player"` resolves to a ref'd node, etc.
6. **Signal-aware** — function props auto-connect to signals on the target node.
7. **No wrappers** — `build()` runs once, so refs are plain instance variables (`sprite?: AnimatedSprite`), not React-style `Ref<T>` wrapper objects. No `.current` anywhere.

---

## Package: `@quintus/jsx`

```
packages/jsx/
  src/
    index.ts              # Public API: h, Fragment, ref (legacy), bind
    jsx-runtime.ts        # Auto-import runtime (jsx, jsxs, Fragment)
    jsx-dev-runtime.ts    # Dev-mode runtime (same, can add warnings later)
    h.ts                  # Core factory function + jsx() wrapper + ref resolution
    ref.ts                # String ref + callback ref + legacy Ref<T> object
    coerce.ts             # Prop coercion logic + $ ref queueing
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

## Ref System Overview

Unlike React, `build()` runs exactly **once** — there's no re-rendering, so there's no need for `Ref<T>` wrapper objects. Refs are plain instance variables assigned during the synchronous build pass.

### Three Ref Forms

| Syntax | Purpose | Resolved when |
|--------|---------|--------------|
| `ref="sprite"` | Assign node to `this.sprite` on build owner | Immediately during `_createElement` |
| `"$player"` (in any prop) | Resolve to node ref'd as "player" | After `build()` returns (deferred) |
| `ref={n => this.x = n}` | Callback ref (edge cases) | Immediately during `_createElement` |

**String refs** are the primary pattern. The build owner (the object whose `build()` is executing) is tracked via `Symbol.for("quintus:currentBuildOwner")` — the same cross-package coordination pattern used by `IS_NODE_CLASS`.

**Dollar refs** (`"$player"`) solve ordering dependencies. During JSX evaluation, `$`-prefixed string values are queued instead of applied. After `build()` returns and all string refs are collected, the queued `$` refs are resolved. This means `<Camera follow="$player" />` works regardless of whether Camera or Player appears first in the JSX.

**Callback refs** (`ref={n => this.x = n}`) handle edge cases like conditional assignment, computed property names, or assigning to a different object.

### Usage

```tsx
class Player extends Actor {
  sprite?: AnimatedSprite;

  build() {
    return <>
      <CollisionShape shape={Shape.rect(6, 7)} />
      <AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="player_idle" />
    </>;
  }

  onReady() {
    this.tag("player");
    this.sprite!.play("run");  // populated by build(), no .current
  }
}
```

```tsx
abstract class Level extends Scene {
  protected player?: Player;
  protected camera?: Camera;

  build() {
    return <>
      <Camera ref="camera" follow="$player" smoothing={0.1} zoom={2} />
      <Player ref="player" />
    </>;
  }
}
```

Order doesn't matter — `follow="$player"` is resolved after all refs in this `build()` are collected.

---

## Phase 1: Core Runtime

### Two Entry Points: `jsx()` and `h()`

TypeScript's `react-jsx` transform emits `jsx(type, { ...props, children }, key?)` — children are **inside** the props object as `props.children`, and the third argument is `key`, not a child. The manual hyperscript API `h()` uses the more familiar `h(type, props, ...children)` rest-params signature.

Both entry points share the same internal creation logic:

```typescript
// packages/jsx/src/h.ts

import { Node, type NodeConstructor, IS_NODE_CLASS } from "@quintus/core";
import { applyProp } from "./coerce.js";

export const Fragment = Symbol("Fragment");

const CURRENT_BUILD_OWNER = Symbol.for("quintus:currentBuildOwner");

type NodeElementChild = Node | NodeElementChild[] | null | undefined | false;

// ---- String ref registry (per build() call) ----

const _stringRefs = new Map<string, Node>();
const _pendingDollarRefs: Array<{ node: object; key: string; refName: string }> = [];

/** Called by @quintus/core after build() returns, via Symbol.for registry. */
export function resolveDollarRefs(): void {
  for (const pending of _pendingDollarRefs) {
    const target = _stringRefs.get(pending.refName);
    if (target) {
      applyProp(pending.node, pending.key, target);
    }
  }
  _pendingDollarRefs.length = 0;
  _stringRefs.clear();
}

/** Queue a $-prefixed prop value for deferred resolution. */
export function queueDollarRef(node: object, key: string, refName: string): void {
  _pendingDollarRefs.push({ node, key, refName });
}

/** Register a string ref for later $ resolution. */
export function registerStringRef(name: string, node: Node): void {
  _stringRefs.set(name, node);
}

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
        if (typeof value === "string") {
          // String ref: assign to build owner's property + register for $ resolution
          registerStringRef(value, node);
          const owner = (globalThis as any)[CURRENT_BUILD_OWNER];
          if (owner) {
            (owner as Record<string, unknown>)[value] = node;
          }
        } else if (typeof value === "function") {
          // Callback ref: call with node
          (value as (node: T) => void)(node);
        }
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
import { queueDollarRef } from "./h.js";

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

  // 2. Dollar ref: "$name" → queue for deferred resolution after build()
  if (typeof value === "string" && value.startsWith("$")) {
    queueDollarRef(node, key, value.slice(1));
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
| `"$player"` on any prop | deferred | Queue for resolution after `build()` |
| `[100, 200]` on Vec2 prop | `Vec2` | `new Vec2(100, 200)` |
| `"#ff0000"` on color-named prop | `Color` | `Color.fromHex("#ff0000")` |
| `2` on `scale` | `Vec2` | `new Vec2(2, 2)` |
| anything else | — | Direct assignment |

**Note:** `$` refs are checked before color coercion, but there's no conflict — color props use `#` prefix, dollar refs use `$` prefix.

### String Refs and the Build Owner

String refs (`ref="sprite"`) assign the created node to `this[name]` on the **build owner** — the object whose `build()` method is currently executing. The build owner is tracked via a well-known symbol on `globalThis`:

```typescript
const CURRENT_BUILD_OWNER = Symbol.for("quintus:currentBuildOwner");
```

`@quintus/core` sets this before calling `build()` and clears it after (see Phase 3). `@quintus/jsx` reads it during `_createElement()`. No import dependency between packages — the symbol is the contract.

**Callback refs** (`ref={n => this.x = n}`) are also supported for edge cases where string refs don't fit (conditional assignment, different target object, computed keys).

**Legacy object refs** (`ref()` / `Ref<T>`) are retained for backward compatibility but not recommended. They add a `.current` indirection that string refs eliminate:

```typescript
// packages/jsx/src/ref.ts — kept for backward compat

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
- [x] Implement `applyProp()` with coercion (Vec2 tuples, Color strings, scale shorthand, Signal connect)
- [x] Implement string ref handling (assign to build owner via `Symbol.for`)
- [x] Implement callback ref handling (`typeof value === "function"`)
- [x] Implement `$` ref queueing in `applyProp()` + `resolveDollarRefs()`
- [x] Implement `registerStringRef()` for cross-ref resolution
- [x] Keep legacy `ref<T>()` factory and `isRef()` for backward compat
- [x] Implement `Fragment` symbol
- [x] Create `jsx-runtime.ts` and `jsx-dev-runtime.ts` exports
- [x] Export public API from `src/index.ts`
- [x] Unit tests for `jsx()`, `h()`, string refs, callback refs, `$` refs, `applyProp()`

---

## Phase 2: TypeScript JSX Type Definitions

The type system must ensure that `<Label text="foo" bogus={42} />` is a type error. This is the most technically complex part.

### Module-Scoped JSX Namespace

Modern TypeScript (5.1+) resolves JSX types from the `jsxImportSource` module, so **no global namespace pollution** is needed. The JSX namespace is exported from the runtime module, avoiding conflicts with React or other JSX libraries in the same project.

```typescript
// packages/jsx/src/types.ts

import type { Node, NodeConstructor, Signal } from "@quintus/core";
import type { Vec2, Color } from "@quintus/math";

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
  NonNullable<T> extends Node ? T | `$${string}` :
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
  ref?: string | ((node: T) => void);
  children?: Node | Node[];
  key?: string | number;
};
```

**Key type changes for the ref system:**

- `ref` accepts `string` (string ref) or `(node: T) => void` (callback ref). Legacy `Ref<T>` objects are runtime-supported but not in the primary type.
- `CoercedPropType` accepts `$${string}` template literal for Node-typed properties. This means `follow="$player"` compiles when `follow` is `Node | null`, but `position="$player"` is a type error (position is `Vec2`).

### JSX Namespace in Runtime Module

```typescript
// Appended to packages/jsx/src/jsx-runtime.ts (or a separate .d.ts)

import type { Node, NodeConstructor } from "@quintus/core";
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
- [x] Define `CoercedPropType<T>` with `$${string}` for Node-typed props
- [x] Define `SignalProps<T>`, `NodeJSXProps<T>` utility types
- [x] `ref` type accepts `string | ((node: T) => void)`
- [x] Export module-scoped `JSX` namespace from `jsx-runtime.ts`
- [x] Implement `LibraryManagedAttributes` to auto-derive props from Node classes
- [x] Verify type-checking: valid props pass, invalid props error
- [x] Verify coercion types: `position={[100, 200]}` accepted, `position="bad"` rejected
- [x] Verify dollar ref types: `follow="$player"` accepted, `position="$player"` rejected
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

### Build Owner Tracking

Before calling `build()`, core sets the current build owner on `globalThis` via a well-known symbol. After `build()` returns, core triggers `$` ref resolution (if a resolver is registered) and clears the owner.

```typescript
// Symbols for cross-package coordination (no import dependency)
const CURRENT_BUILD_OWNER = Symbol.for("quintus:currentBuildOwner");
const RESOLVE_BUILD_REFS = Symbol.for("quintus:resolveBuildRefs");
```

The JSX package registers its resolver at module load time:

```typescript
// @quintus/jsx — registered when the package is imported
(globalThis as any)[Symbol.for("quintus:resolveBuildRefs")] = resolveDollarRefs;
```

If `@quintus/jsx` is never imported, the resolver is absent and core skips the call. Zero overhead for non-JSX users.

### Integration Point: `_enterTreeRecursive`

The current flow in `_enterTreeRecursive`:

```
1. node._isInsideTree = true
2. node.onEnterTree()
3. node.treeEntered.emit()
4. for each existing child → recurse
5. if (!ready) → onReady(), readySignal.emit()
```

With `build()` + ref resolution:

```
1. node._isInsideTree = true
2. node.onEnterTree()
3. node.treeEntered.emit()
4. Set build owner → process build() → resolve $ refs → clear owner  [NEW]
5. for each child (existing + built) → recurse
6. if (!ready) → onReady(), readySignal.emit()
```

```typescript
// Modified _enterTreeRecursive in packages/core/src/node.ts

const CURRENT_BUILD_OWNER = Symbol.for("quintus:currentBuildOwner");
const RESOLVE_BUILD_REFS = Symbol.for("quintus:resolveBuildRefs");

private _enterTreeRecursive(node: Node): void {
  node._isInsideTree = true;
  node.onEnterTree();
  node.treeEntered.emit();

  // NEW: Process build() with owner tracking + $ ref resolution
  (globalThis as any)[CURRENT_BUILD_OWNER] = node;
  const built = node.build();
  const resolve = (globalThis as any)[RESOLVE_BUILD_REFS];
  if (typeof resolve === "function") resolve();
  (globalThis as any)[CURRENT_BUILD_OWNER] = null;

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

**Nesting works correctly** because everything is synchronous:

```
Scene.build() runs  → OWNER = scene, string refs collected, $ refs resolved
  Scene's children enter tree one by one:
    Player.build() runs → OWNER = player, fresh ref collections, resolved
      Player's children enter tree...
    Camera.build() runs → OWNER = camera, etc.
```

Each `build()` gets its own ref scope. No interleaving.

### Scene Special Case

`Game._loadScene()` calls `scene.onReady()` directly (Scene is the tree root, not added via `addChild`). We need to process `build()` here too:

```typescript
// In packages/core/src/game.ts

const CURRENT_BUILD_OWNER = Symbol.for("quintus:currentBuildOwner");
const RESOLVE_BUILD_REFS = Symbol.for("quintus:resolveBuildRefs");

private _loadScene(SceneClass: SceneConstructor): void {
  const scene = new SceneClass(this);
  this._currentScene = scene;

  // NEW: Process build() with owner tracking + $ ref resolution
  (globalThis as any)[CURRENT_BUILD_OWNER] = scene;
  const built = scene.build();
  const resolve = (globalThis as any)[RESOLVE_BUILD_REFS];
  if (typeof resolve === "function") resolve();
  (globalThis as any)[CURRENT_BUILD_OWNER] = null;

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
2. `scene.build()` → returns JSX tree (nodes created eagerly by `jsx()` / `h()`). String refs assigned to scene properties, `$` refs resolved.
3. `scene.add(player)` → player enters tree → player's `build()` runs → player's children enter tree → player's `onReady()` fires
4. `scene.add(camera)` → camera enters tree → camera's `onReady()` fires
5. `scene.onReady()` → runs AFTER all built children are ready

This means by the time `scene.onReady()` executes, every built child (and their children) are in the tree and ready. All string ref properties are populated. Imperative code in `onReady()` can safely access them.

### Interaction Between `build()` and `jsx()` Children

A node can have children from two sources:
1. **JSX composition children:** `<Player><HealthBar /></Player>` — HealthBar is added by `jsx()` before Player enters the tree
2. **`build()` children:** Player's own `build()` returns CollisionShape + AnimatedSprite

Both coexist. The order is:
- JSX children first (already in `_children` when `build()` runs)
- `build()` children second (appended during tree entry)

This is intuitive: "I'm a Player. The JSX that created me gave me a HealthBar. My own `build()` adds my intrinsic CollisionShape and Sprite."

### Phase 3 Checklist

- [x] Add `build(): Node | Node[] | null` virtual method to `Node` base class
- [x] Add `CURRENT_BUILD_OWNER` symbol tracking in `_enterTreeRecursive` and `_loadScene`
- [x] Call `RESOLVE_BUILD_REFS` resolver after `build()` returns
- [x] Modify `_enterTreeRecursive` to process `build()` before recursing children
- [x] Modify `Game._loadScene` to process Scene's `build()` before `onReady()`
- [x] Test: `build()` children are in tree before `onReady()` fires
- [x] Test: string refs populated by `onReady()` time
- [x] Test: `$` refs resolved correctly regardless of JSX order
- [x] Test: nested `build()` works (Scene builds Player, Player builds CollisionShape)
- [x] Test: `build()` + imperative `add()` in `onReady()` coexist
- [x] Test: nodes without `build()` (returns null) are unaffected
- [x] Test: Fragment return (multiple root nodes) works

---

## Phase 4: Convert Platformer Example to TSX

Convert the side-scrolling **platformer** demo to use JSX `build()` patterns. This validates the JSX system against real game code and demonstrates the before/after ergonomics. The dungeon example will be converted separately.

> **Note:** Functional components (prefabs) are already implemented in Phase 1's `_createElement()` — it detects plain functions via the `IS_NODE_CLASS` symbol absence. No additional runtime work is needed for Phase 4.

### Goals

1. **Validate the JSX system** against a non-trivial game example (not toy demos)
2. **Show where JSX helps** — entity structure, UI composition, HUD layout
3. **Show where imperative stays** — TileMap setup, physics callbacks, dynamic spawning, tweens
4. **Preserve all existing behavior** — the game must play identically after conversion
5. **Keep both versions** — the example gets a `src-tsx/` directory alongside the existing `src/`; the `index.html` selects which to load

### File Renames

Any file that uses JSX syntax must be renamed from `.ts` to `.tsx`. Files with no JSX (state, config, sprites, types) stay as `.ts`.

**Platformer files requiring `.tsx`:**
- `entities/player.tsx`, `entities/coin.tsx`, `entities/patrol-enemy.tsx`, `entities/flying-enemy.tsx`
- `entities/health-pickup.tsx`, `entities/spike.tsx`, `entities/level-exit.tsx`
- `scenes/level.tsx`, `scenes/level1.tsx`, `scenes/level2.tsx`
- `scenes/title-scene.tsx`, `scenes/game-over-scene.tsx`, `scenes/victory-scene.tsx`
- `hud/hud.tsx`

### TSConfig for Example

The example's `tsconfig.json` adds:

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@quintus/jsx"
  }
}
```

---

### 4A: Entity Conversions

Entities have the clearest JSX wins: their `onReady()` creates CollisionShape + AnimatedSprite children, which becomes a clean `build()`.

#### Platformer Player: Before (imperative)

```typescript
class Player extends Actor {
  private _sprite!: AnimatedSprite;

  override onReady() {
    super.onReady();
    this.add(CollisionShape).shape = Shape.rect(6, 7);
    this.tag("player");

    this._sprite = this.add(AnimatedSprite);
    this._sprite.spriteSheet = entitySheet;
    this._sprite.play("player_idle");
  }
}
```

#### Platformer Player: After (JSX)

```tsx
class Player extends Actor {
  sprite?: AnimatedSprite;

  build() {
    return <>
      <CollisionShape shape={Shape.rect(6, 7)} />
      <AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="player_idle" />
    </>;
  }

  override onReady() {
    super.onReady();
    this.tag("player");
  }

  // onFixedUpdate stays identical — purely imperative logic
}
```

**What changed:** `_sprite!` (definite assignment + private) → `sprite?` (plain optional instance variable). `ref="sprite"` assigns the created AnimatedSprite to `this.sprite` during build. No `.current` anywhere.

#### Platformer PatrolEnemy: After (JSX)

```tsx
class PatrolEnemy extends Actor {
  sprite?: AnimatedSprite;

  build() {
    return <>
      <CollisionShape shape={Shape.rect(7, 7)} />
      <AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="enemy_walk" />
    </>;
  }

  override onReady() {
    super.onReady();
    this.tag("enemy");
  }
}
```

Same pattern. All enemies follow this: shape + sprite in `build()`, tags in `onReady()`.

#### Platformer Coin: After (JSX)

```tsx
class Coin extends Sensor {
  sprite?: AnimatedSprite;

  build() {
    return <>
      <CollisionShape shape={Shape.circle(4)} />
      <AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="coin_idle" />
    </>;
  }

  override onReady() {
    super.onReady();
    this.tag("coin");

    // Tween + signal connection stay imperative (runtime state)
    const baseY = this.position.y;
    this.tween()
      .to({ position: { y: baseY - 4 } }, 0.8, Ease.sineInOut)
      .to({ position: { y: baseY } }, 0.8, Ease.sineInOut)
      .repeat();

    this.bodyEntered.connect((body) => {
      if (body.hasTag("player")) this._collect();
    });
  }
}
```

**Pattern:** `build()` handles structure. `onReady()` handles runtime setup (tweens, signal connections, anything needing `this.position`).

---

### 4B: UI Scene Conversions

UI scenes benefit the most — deep nesting of Panel/Label/Button becomes readable tree structure. Signal connections on buttons use the `onPressed` prop coercion.

#### Platformer TitleScene: Before (imperative)

```typescript
class TitleScene extends Scene {
  override onReady() {
    const ui = this.add(Layer);
    ui.fixed = true;

    ui.add(Panel, { width: 320, height: 240, backgroundColor: Color.fromHex("#1a1a2e") });
    ui.add(Label, { position: new Vec2(160, 50), text: "Quintus Platformer", ... });
    ui.add(Label, { position: new Vec2(160, 80), text: "A Quintus 2.0 Demo", ... });
    ui.add(Label, { position: new Vec2(160, 130), text: "Arrow keys to move...", ... });

    const startBtn = ui.add(Button, { position: new Vec2(110, 170), ... });
    startBtn.onPressed.connect(() => {
      gameState.reset();
      this.switchTo("level1");
    });
  }
}
```

#### Platformer TitleScene: After (JSX)

```tsx
class TitleScene extends Scene {
  build() {
    return (
      <Layer fixed>
        <Panel width={320} height={240} backgroundColor="#1a1a2e" />
        <Label position={[160, 50]} text="Quintus Platformer"
               fontSize={20} color="#4fc3f7" align="center" />
        <Label position={[160, 80]} text="A Quintus 2.0 Demo"
               fontSize={10} color="#888888" align="center" />
        <Label position={[160, 130]} text="Arrow keys to move, Up/Space to jump"
               fontSize={8} color="#aaaaaa" align="center" />
        <Button position={[110, 170]} width={100} height={32}
                text="Start" fontSize={16}
                backgroundColor="#4fc3f7" hoverColor="#81d4fa"
                pressedColor="#29b6f6" textColor="#ffffff"
                onPressed={() => { gameState.reset(); this.switchTo("level1"); }} />
      </Layer>
    );
  }
}
```

**Wins:** Tree structure visible at a glance. Color hex strings coerced automatically. Position tuples coerced to Vec2. Signal handler `onPressed` auto-connected. No `onReady()` needed at all.

GameOverScene and VictoryScene follow the same pattern — pure `build()`, no `onReady()`.

---

### 4C: HUD Conversion

HUDs are partially declarative (layout) and partially imperative (reactive signal updates). The `build()` handles initial structure; `onReady()` wires up the signal-driven updates.

#### Platformer HUD: Before (imperative)

```typescript
class HUD extends Layer {
  private hearts: Sprite[] = [];
  private scoreLabel!: Label;
  private coinLabel!: Label;

  override onReady() {
    this.fixed = true;
    this.zIndex = 100;

    for (let i = 0; i < gameState.maxHealth; i++) {
      const heart = this.add(Sprite, {
        texture: "tileset",
        sourceRect: i < gameState.health ? HEART_FULL : HEART_EMPTY,
        centered: false,
        position: new Vec2(4 + i * 10, 4),
      });
      this.hearts.push(heart);
    }

    this.coinLabel = this.add(Label, { ... });
    this.scoreLabel = this.add(Label, { ... });

    gameState.on("health").connect(({ value }) => { ... });
    gameState.on("coins").connect(({ value }) => { ... });
    gameState.on("score").connect(({ value }) => { ... });
  }
}
```

#### Platformer HUD: After (JSX)

```tsx
class HUD extends Layer {
  fixed = true;
  override zIndex = 100;

  private hearts: Sprite[] = [];
  coinLabel?: Label;
  scoreLabel?: Label;

  build() {
    // Hearts are dynamic (count from gameState) — build them in a loop
    this.hearts = Array.from({ length: gameState.maxHealth }, (_, i) =>
      <Sprite
        texture="tileset"
        sourceRect={i < gameState.health ? HEART_FULL : HEART_EMPTY}
        centered={false}
        position={[4 + i * 10, 4]}
      /> as Sprite
    );

    return <>
      {...this.hearts}
      <Label ref="coinLabel" position={[8, 16]}
             text={`Coins: ${gameState.coins}`} fontSize={8} color="#ffd54f" />
      <Label ref="scoreLabel" position={[250, 4]}
             text={`Score: ${gameState.score}`} fontSize={8} color="#ffffff" align="right" />
    </>;
  }

  override onReady() {
    // Signal-driven updates (no polling)
    gameState.on("health").connect(({ value }) => {
      for (let i = 0; i < this.hearts.length; i++) {
        this.hearts[i].sourceRect = i < value ? HEART_FULL : HEART_EMPTY;
      }
    });
    gameState.on("coins").connect(({ value }) => {
      this.coinLabel!.text = `Coins: ${value}`;
    });
    gameState.on("score").connect(({ value }) => {
      this.scoreLabel!.text = `Score: ${value}`;
    });
  }
}
```

**Pattern:** Static layout in `build()`. Dynamic updates via signal connections in `onReady()`. Note `fixed = true` is set as a class property instead of in `onReady()`. String refs (`ref="coinLabel"`, `ref="scoreLabel"`) assign directly — no `.current!`.

---

### 4D: Level Scene Conversion

Level scenes are the **hybrid case**: structural nodes (TileMap, Camera, HUD) suit JSX, but map setup (generateCollision, spawnObjects, getSpawnPoint) and physics callbacks are inherently imperative. Dollar refs (`"$player"`) eliminate ordering concerns.

#### Platformer Level: After (JSX + imperative onReady)

```tsx
abstract class Level extends Scene {
  abstract readonly levelAsset: string;
  abstract readonly nextScene: string;

  protected player?: Player;
  protected map?: TileMap;
  protected camera?: Camera;

  build() {
    return <>
      <TileMap ref="map" tilesetImage="tileset" asset={this.levelAsset} />
      <Player ref="player" />
      <Camera ref="camera" follow="$player" smoothing={0.1} zoom={2} />
      <HUD />
    </>;
  }

  override onReady() {
    // Imperative map setup (no JSX equivalent)
    this.map!.generateCollision({ layer: "ground", allSolid: true, collisionGroup: "world" });

    // Position player at map spawn point
    this.player!.position = this.map!.getSpawnPoint("player_start");

    // Spawn entities from Tiled object layer
    const spawned = this.map!.spawnObjects("entities", {
      Coin, PatrolEnemy, FlyingEnemy, HealthPickup, LevelExit, Spike,
    });
    for (const node of spawned) {
      if (node instanceof LevelExit) node.nextScene = this.nextScene;
    }

    // Physics contact handler
    this.game.physics.onContact("player", "enemies", (p, e, info) => {
      if (info.normal.y < 0) {
        (e as PatrolEnemy).stomp();
        (p as Player).velocity.y = -200;
      } else {
        (p as Player).takeDamage();
      }
    });

    // Camera bounds from map
    this.camera!.bounds = new Rect(0, 0, this.map!.bounds.width, this.map!.bounds.height);

    // Handle player death
    this.player!.died.connect(() => this._onPlayerDied());
  }
}
```

**What moved to `build()`:** Node creation with static props (TileMap asset, Camera smoothing/zoom/follow, HUD). Note `follow="$player"` — Camera is created before Player in the JSX but the `$` ref resolves after all refs are collected. No ordering dependency.

**What stays in `onReady()`:** Map collision generation, spawn point lookup, object spawning, physics contacts, camera bounds (depends on map), signal connections.

Level1 and Level2 subclasses only set `levelAsset` and `nextScene` — no `build()` override needed.

---

### What Stays Imperative

Not everything should be JSX. These patterns are better left in `onReady()` / `onFixedUpdate()`:

| Pattern | Why imperative | Example |
|---------|---------------|---------|
| `map.generateCollision()` | Method call, not prop | Collision shape generation from tile layers |
| `map.spawnObjects()` | Data-driven at runtime | Entity types from Tiled object layers |
| `map.getSpawnPoint()` | Returns runtime position | Player starting position |
| Physics contact handlers | Runtime callback registration | Stomp mechanic |
| Tween chains | Depend on runtime state (`this.position.y`) | Coin float animation |
| Signal connections | Wire up after tree is built | `player.died.connect(...)` |
| Dynamic creation | Spawned during gameplay | `WeaponHitbox` on attack |
| Camera bounds | Depends on map dimensions | `camera.bounds = new Rect(...)` |
| Tags | Imperative method call | `this.tag("player")` |

**Rule of thumb:** If it's about **what nodes exist and their initial props**, use `build()`. If it's about **runtime behavior, method calls, or values computed from other nodes**, use `onReady()`.

---

### Conversion Summary

| Component type | JSX coverage | Imperative remainder |
|---------------|-------------|---------------------|
| Entity structure (shape + sprite) | ~100% via `build()` | Tags in `onReady()` |
| UI scenes (title, game over, victory) | ~100% via `build()` | None |
| HUD layout | ~80% via `build()` | Signal update wiring |
| Level scenes | ~30% via `build()` | Map setup, physics, spawning |
| Entity behavior | 0% | `onFixedUpdate()` unchanged |
| Dynamic spawning (weapons, etc.) | 0% | Spawned at runtime |

### Phase 4 Checklist

**Setup:**
- [ ] Add `@quintus/jsx` as devDependency to platformer example package.json
- [ ] Add JSX tsconfig options to platformer example
- [ ] Create `src-tsx/` directory (copy from `src/`)

**Platformer conversions (in `src-tsx/`):**
- [ ] Convert `Player` to use `build()` with `ref="sprite"`
- [ ] Convert `PatrolEnemy` and `FlyingEnemy` to use `build()`
- [ ] Convert `Coin`, `HealthPickup`, `Spike`, `LevelExit` to use `build()`
- [ ] Convert `TitleScene`, `GameOverScene`, `VictoryScene` to pure `build()` (no onReady)
- [ ] Convert `HUD` to use `build()` for layout + `onReady()` for signal wiring
- [ ] Convert `Level` base class to hybrid `build()` + `onReady()` with `$` refs
- [ ] Verify Level1 and Level2 work without changes beyond import paths

**Validation:**
- [ ] Example builds with `pnpm build`
- [ ] Example runs correctly in browser (`pnpm dev`)
- [ ] Gameplay identical to imperative version (manual play-through)
- [ ] Platformer integration tests pass against TSX version
- [ ] No TypeScript errors in TSX files

---

## Template Method Inheritance Pattern

This isn't a separate implementation phase — it's a **usage pattern** enabled by Phases 1–3. But it's the core architectural value of JSX for games, so it's documented here.

### The Pattern

A base class defines the overall scene structure with named hook methods. Subclasses override hooks to inject content into specific regions of the tree.

```tsx
abstract class Level extends Scene {
  player?: Player;
  map?: TileMap;

  // Subclasses must provide:
  abstract mapAsset: string;
  abstract spawnPoint: [number, number];

  build() {
    return <>
      <TileMap
        ref="map"
        tilesetImage="tileset"
        asset={this.mapAsset}
      />
      <Player ref="player" position={this.spawnPoint} />
      <Camera follow="$player" smoothing={0.1} />
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

Note: `follow="$player"` resolves after `build()` returns — Camera doesn't need to come after Player in the JSX. The `$` ref finds the node registered under "player" regardless of order.

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
  boss?: Dragon;

  buildEntities() {
    return <Dragon ref="boss" position={[400, 200]} />;
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
  sprite?: AnimatedSprite;

  build() {
    return <>
      <CollisionShape shape={Shape.rect(6, 7)} />
      <AnimatedSprite ref="sprite" spriteSheet={entitySheet} animation="player_idle" />
    </>;
  }

  onReady() {
    this.tag("player");
    // this.sprite is the AnimatedSprite instance — no .current
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
import { h, Fragment } from "@quintus/jsx";
import { Player, Camera, TileMap } from "./entities.js";

class Level1 extends Scene {
  player?: Player;

  build() {
    return h(Fragment, null,
      h(TileMap, { tilesetImage: "tileset", asset: "level1.json" }),
      h(Player, { ref: "player", position: [100, 400] }),
      h(Camera, { follow: "$player", smoothing: 0.1 }),
    );
  }
}
```

Not as pretty, but works with zero config changes. String refs and `$` refs work identically in `h()` — they're just string values in the props object. This is also what tests use when testing the runtime without needing `.tsx` compilation.

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
- String ref: `ref="sprite"` assigns to build owner's property
- String ref: registered for `$` resolution
- Callback ref: `ref={fn}` calls function with node
- `$` ref: `"$player"` queued during applyProp, not applied immediately
- `$` ref: resolved after `resolveDollarRefs()` called
- `$` ref: order-independent (target before or after source)
- Fragment returns flat Node array
- null/false children are skipped
- Coercion: tuple → Vec2
- Coercion: string → Color for color props
- Coercion: `$` prefix NOT treated as color on color props
- Coercion: number → Vec2 for scale
- Signal auto-connect: function prop on Signal property
- Functional component: calls function and returns result
- Functional component: detected via IS_NODE_CLASS absence
- Nested children builds correct tree
- Scene subclass in jsx() throws runtime error

**Integration: `packages/jsx/src/build.test.ts`**
- Scene with `build()` → children in tree before `onReady()`
- Node with `build()` → children ready before parent's `onReady()`
- Nested `build()` → grandchildren ready before grandparent
- `build()` + imperative `add()` in `onReady()` coexist
- `build()` returning null → no effect
- `build()` returning Fragment → multiple root children
- Template method pattern: base class `build()` calls subclass hook
- String ref populated by `onReady()` time (plain instance variable)
- `$` ref resolved correctly (Camera follow="$player" + Player ref="player")
- Nested build owners don't leak (Player's refs don't assign to Scene)

**Type tests: `packages/jsx/src/types.test-d.ts`**
- `<Label text="foo" />` — valid
- `<Label bogus={42} />` — type error
- `<Label position={[10, 20]} />` — valid (Vec2 coercion)
- `<Label position="bad" />` — type error
- `<Button onPressed={() => {}} />` — valid (Signal handler)
- `<Button onPressed={42} />` — type error
- `<Label onUpdate={...} />` — type error (methods excluded)
- `<Label _parent={...} />` — type error (underscore excluded)
- `<Camera follow="$player" />` — valid (`$` ref on Node-typed prop)
- `<Label position="$player" />` — type error (`$` ref on Vec2-typed prop)
- `ref="sprite"` — valid (string ref)
- `ref={n => ...}` — valid (callback ref)

### Example Conversion

Convert the tween-ui example to offer a JSX variant alongside the imperative one, demonstrating both approaches work:

- [ ] Create `examples/jsx-demo/` with JSX versions of UI composition
- [ ] Show template method inheritance with a simple Level base class

### Phase 5 Checklist

- [ ] Unit tests for `jsx()` and `h()` (class, Fragment, coercion, signals, children, string refs, callback refs, `$` refs, key)
- [ ] Integration tests for `build()` lifecycle (owner tracking, `$` resolution, nesting)
- [ ] Type-level tests for JSX prop validation (including `$` ref acceptance/rejection)
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
// In applyProp(), added as rule 2 (before $ ref check):

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
| `"$player"` on any prop | deferred | Queue for resolution after `build()` |
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
  boss?: Dragon;

  buildHUD() {
    return <>
      {super.buildHUD()}
      <ProgressBar
        value={bind(this.boss!.healthChanged, (hp) => hp / 100)}
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
- [ ] Add reactive binding detection to `applyProp()` (before `$` ref check)
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
- [ ] Platformer JSX variant runs in browser via `pnpm dev`
- [ ] Existing tests unaffected (build() returns null by default)
- [ ] No bundle size impact on users who don't import `@quintus/jsx`
