# Quintus 2 — 3D Game Starter

This is a starter game built on the **Quintus 2** HTML5 game engine (npm package `quintus2`) with
its Three.js integration. Core engine imports come from `quintus2`; 3D nodes come from the
`quintus2/three` subpath. This file is the engine cheat-sheet. For runtime debugging, see
**Debugging** at the bottom and the `debug-game` skill in `.claude/skills/`.

## Project Layout

```
index.html            No <canvas> — ThreePlugin creates the WebGL canvas
src/
  main.ts             Game bootstrap: renderer:null + ThreePlugin → start(MainScene)
  scenes/main-scene.ts  Scene: Camera3D, lights, the spinning mesh
  entities/spinner.ts   MeshNode subclass (geometry + material + per-frame rotation)
  __tests__/          Headless Vitest smoke test (no ThreePlugin — see below)
```

## Node / Scene Tree

Quintus is a **Node/Scene tree** (Godot-inspired), not an ECS. The base chain is
`Node → Node2D → ...`; the 3D nodes live under `quintus2/three`:

- **`Node`** — base class: parent/child tree, `build()`/`onReady()`/`onUpdate()`/`onFixedUpdate()` lifecycle.
- **`MeshNode`** — a node that owns a `THREE.Mesh` built from a `geometry` + `material` you assign.
  Its `position`/`rotation`/`scale` drive the Three.js object.
- **`Camera3D`** — the viewpoint (`fov`, `position.set(...)`, `lookAt(...)`).
- **`AmbientLight` / `DirectionalLight`** — lights (`intensity`, `position`).
- **`Scene`** — the screen root; start it with `game.start(MainScene)`.
- **`Signal<T>`** — typed observer pattern (`sig.connect(fn)` / `sig.emit(value)`) for decoupled events.

## Game Bootstrap (`main.ts`)

```ts
import { Game } from "quintus2";
import { ThreePlugin } from "quintus2/three";
import { MainScene } from "./scenes/main-scene.js";

// renderer:null hands rendering to ThreePlugin, which installs the Three.js WebGL renderer
// and creates its own canvas. scale:"fit" keeps that canvas responsive.
const game = new Game({ width: 800, height: 600, renderer: null, scale: "fit", seed: 42 });
game.use(ThreePlugin({ antialias: true, background: "#101018" }));
game.start(MainScene);
```

- **`renderer: null`** — disables the 2D canvas renderer; `ThreePlugin` takes over rendering.
- **`ThreePlugin({...})`** — installs `THREE.WebGLRenderer`, a scene, and its own canvas (so
  `index.html` has **no** `<canvas>`). `background` takes a hex string or `null`.
- **`game.start(MainScene)`** — pass the `Scene` class directly (or register + start by name).
- `seed` makes the fixed-timestep sim deterministic.

## Building a Scene (`scenes/main-scene.ts`)

Add nodes imperatively in `onReady()` with `this.add(NodeClass, props)`:

```ts
export class MainScene extends Scene {
	override onReady(): void {
		const cam = this.add(Camera3D, { fov: 75 });
		cam.position.set(0, 2, 5);
		cam.lookAt(0, 0, 0);

		this.add(AmbientLight, { intensity: 0.4 });
		const sun = this.add(DirectionalLight, { intensity: 0.8 });
		sun.position.set(5, 10, 5);

		this.add(Spinner);
	}
}
```

## Mesh Nodes (`entities/spinner.ts`)

Subclass `MeshNode`, assign `geometry` + `material`, and animate in `onFixedUpdate` (deterministic,
fixed timestep):

```ts
export class Spinner extends MeshNode {
	override geometry = new THREE.BoxGeometry(1, 1, 1);
	override material = new THREE.MeshStandardMaterial({ color: 0x44aa88 });

	override onFixedUpdate(dt: number): void {
		this.rotation.x += dt * 0.5;
		this.rotation.y += dt * 0.7;
	}
}
```

Swap the geometry (sphere, torus…) or the material to change how it looks. `import * as THREE from "three"`
resolves from the real `three` dependency; `quintus2` declares `three` as an optional peer, so a 3D
project installs `three` (and `@types/three` for typings) explicitly.

## JSX (optional)

This template uses plain `.ts` (no JSX). If you want the declarative `build()` JSX pattern, set
`"jsx": "react-jsx"` + `"jsxImportSource": "quintus2"` in `tsconfig.json` and author `.tsx` files —
the same runtime the 2D template uses.

## Testing (headless)

Tests run in Vitest via `quintus2/testing`'s `TestRunner`. **Do not install `ThreePlugin` in a
headless test** — its `THREE.WebGLRenderer` needs a real WebGL context that jsdom lacks. The scene
graph and fixed-update loop are fully exercisable without it: `Camera3D` degrades gracefully and
`MeshNode`/lights build their Three.js objects with no GL context.

```ts
const result = await TestRunner.run({ scene: MainScene, seed: 42, width: 800, height: 600, duration: 1 });
const scene = result.game.currentScene;
// findByType returns null when absent — assert `.not.toBeNull()`, not `.toBeDefined()`.
expect(scene?.findByType(Spinner)).not.toBeNull();
expect(scene?.findByType(Camera3D)).not.toBeNull();
result.game.stop(); // always stop — a lingering loop leaks across tests
```

Run with `pnpm test`. Deterministic: same `seed` → same result.

## Debugging

Use the **`debug-game` skill** (`.claude/skills/debug-game/`) — it drives the game through the
engine's debug bridge with the `qdbg` CLI (the bridge is renderer-agnostic, so it works against the
3D scene too). `qdbg` needs Claude Code's bundled `playwright-cli`.

```bash
pnpm dev               # start the Vite dev server on http://localhost:3050
pnpm qdbg connect      # opens the game at ./.qdbg.json's url + ?debug, paused at frame 0
pnpm qdbg tree         # print the scene tree
pnpm qdbg step 30      # advance 30 frames
pnpm qdbg camera       # active 3D camera info (fov, aspect, position)
pnpm qdbg lights       # list lights (type, intensity, color)
pnpm qdbg inspect Spinner   # full node snapshot (incl. transform)
pnpm qdbg disconnect
```

`pnpm qdbg connect` with no argument reads `./.qdbg.json` (`{ "url": "http://localhost:3050" }`)
and appends `?debug`, which auto-installs the debug bridge — no code change needed. See
`.claude/skills/debug-game/SKILL.md` for the full command reference and recipes.
