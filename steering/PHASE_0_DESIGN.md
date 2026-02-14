# Phase 0: Project Bootstrap — Detailed Design

> **Goal:** Monorepo infrastructure, CI, empty packages, developer tooling.
> **Duration:** ~3 days
> **Outcome:** Running `pnpm install && pnpm build && pnpm test && pnpm lint && pnpm dev` all succeed.

---

## Table of Contents

1. [Monorepo Setup](#1-monorepo-setup)
2. [TypeScript Configuration](#2-typescript-configuration)
3. [Build System (tsup)](#3-build-system-tsup)
4. [Package Scaffolding](#4-package-scaffolding)
5. [Test Framework (Vitest)](#5-test-framework-vitest)
6. [Linting & Formatting (Biome)](#6-linting--formatting-biome)
7. [Dev Environment (Vite)](#7-dev-environment-vite)
8. [CI Pipeline (GitHub Actions)](#8-ci-pipeline-github-actions)
9. [Documentation (TypeDoc)](#9-documentation-typedoc)
10. [Git Hygiene](#10-git-hygiene)
11. [Root Scripts](#11-root-scripts)
12. [Definition of Done](#12-definition-of-done)

---

## 1. Monorepo Setup

### pnpm Workspace

Create `pnpm-workspace.yaml` at the project root:

```yaml
packages:
  - "packages/*"
  - "examples"
```

### Root `package.json`

```json
{
  "name": "quintus-monorepo",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.28.1",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "pnpm --recursive --sort run build --if-present",
    "test": "vitest run",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "lint": "biome check .",
    "lint:fix": "biome check . --write",
    "dev": "vite examples",
    "docs": "typedoc",
    "clean": "pnpm --recursive exec rm -rf dist",
    "preinstall": "npx only-allow pnpm"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.3.0",
    "tsup": "^8.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0",
    "@vitest/coverage-v8": "^3.0.0",
    "jsdom": "^25.0.0",
    "typedoc": "^0.27.0"
  }
}
```

### Directory Layout After Phase 0

```
quintus/
├── packages/
│   ├── core/              @quintus/core        ~10KB
│   ├── math/              @quintus/math        ~3KB
│   ├── physics/           @quintus/physics     ~10KB
│   ├── sprites/           @quintus/sprites     ~5KB
│   ├── tilemap/           @quintus/tilemap     ~5KB
│   ├── input/             @quintus/input       ~4KB
│   ├── audio/             @quintus/audio       ~3KB
│   ├── ui/                @quintus/ui          ~5KB
│   ├── tween/             @quintus/tween       ~3KB
│   ├── camera/            @quintus/camera      ~3KB
│   ├── particles/         @quintus/particles   ~4KB
│   ├── three/             @quintus/three       ~5KB
│   ├── debug/             @quintus/debug       ~4KB
│   ├── headless/          @quintus/headless    ~5KB
│   ├── test/              @quintus/test        ~8KB
│   ├── snapshot/          @quintus/snapshot    ~4KB
│   ├── mcp/               @quintus/mcp         ~6KB
│   ├── ai-prefabs/        @quintus/ai-prefabs  ~15KB
│   └── quintus-core/      @quintus/quintus-core ~40KB (meta-package)
├── examples/
│   ├── vite.config.ts
│   ├── package.json
│   └── index.html
├── old/                    (legacy reference only)
├── pnpm-workspace.yaml
├── tsconfig.json
├── tsconfig.base.json
├── vitest.config.ts
├── biome.json
├── typedoc.json
├── package.json
├── .gitignore
├── .npmrc
└── .github/
    └── workflows/
        └── ci.yml
```

---

## 2. TypeScript Configuration

### Shared Base Config (`tsconfig.base.json`)

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInImports": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false
  }
}
```

**Key decisions:**
- `target: ES2022` — supports `structuredClone`, `at()`, top-level await
- `moduleResolution: bundler` — modern resolution for tsup/Vite
- `verbatimModuleSyntax: true` — enforces explicit `type` imports (makes `esModuleInterop` unnecessary)
- `noUncheckedIndexedAccess: true` — catches undefined array/map access
- `strict: true` — non-negotiable, no `any` escape hatches
- Unused-code detection is handled by Biome (not TypeScript) so it can auto-fix

### Root Config (`tsconfig.json`)

A root `tsconfig.json` extends the base config and provides IDE integration for root-level files:

```json
{
  "extends": "./tsconfig.base.json",
  "include": ["vitest.config.ts", "examples/**/*.ts"],
  "exclude": ["node_modules", "dist", "old"]
}
```

### Per-Package Config (`packages/*/tsconfig.json`)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

---

## 3. Build System (tsup)

### Per-Package Build Config (`packages/*/tsup.config.ts`)

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
});
```

**Output per package:**
```
dist/
├── index.js       # ESM
├── index.cjs      # CJS
├── index.d.ts     # TypeScript declarations
├── index.d.cts    # CTS declarations
└── index.js.map   # Source map
```

### Build Order

`pnpm --recursive --sort run build` handles dependency ordering automatically. The dependency graph for Phase 0 doesn't matter (all packages are empty), but later phases will rely on:

```
math → core → physics, sprites, input, tilemap, camera, audio, tween, ui → quintus-core
```

---

## 4. Package Scaffolding

### 19 Packages to Scaffold

Each package follows an identical template. Below is the template, then the list of all packages.

#### Template: `package.json`

```json
{
  "name": "@quintus/{name}",
  "version": "0.0.0",
  "description": "{description}",
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
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch"
  },
  "keywords": ["game-engine", "quintus", "html5", "2d"],
  "license": "SEE LICENSE IN LICENSE.md",
  "repository": {
    "type": "git",
    "url": "https://github.com/cykod/Quintus",
    "directory": "packages/{name}"
  }
}
```

#### Template: `src/index.ts`

```typescript
export {};
```

#### Template: `tsup.config.ts`

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
});
```

#### Template: `tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

### Package List

| # | Directory | npm Name | Description |
|---|-----------|----------|-------------|
| 1 | `packages/math` | `@quintus/math` | Vec2, Matrix2D, Color, Rect, AABB, SeededRandom, math utilities |
| 2 | `packages/core` | `@quintus/core` | Node, Node2D, Scene, Game, Signal, game loop, Canvas2D renderer |
| 3 | `packages/physics` | `@quintus/physics` | Body, StaticBody, RigidBody, Area, CollisionShape, SAT, spatial hash |
| 4 | `packages/sprites` | `@quintus/sprites` | Sprite, AnimatedSprite, SpriteSheet, sprite sheet loader |
| 5 | `packages/tilemap` | `@quintus/tilemap` | TileMap, Tiled JSON import, tile collision generation |
| 6 | `packages/input` | `@quintus/input` | Input action map, keyboard, mouse, touch, gamepad |
| 7 | `packages/audio` | `@quintus/audio` | AudioPlayer node, Web Audio API, audio bus |
| 8 | `packages/ui` | `@quintus/ui` | UINode, Label, Button, Container, ProgressBar, Panel, Layer |
| 9 | `packages/tween` | `@quintus/tween` | Tween builder, easing functions, chainable animations |
| 10 | `packages/camera` | `@quintus/camera` | Camera node, follow, shake, zoom, bounds, dead zone |
| 11 | `packages/particles` | `@quintus/particles` | ParticleEmitter, object pooling, batch rendering |
| 12 | `packages/three` | `@quintus/three` | ThreeLayer, MeshNode, Camera3D, Three.js bridge |
| 13 | `packages/debug` | `@quintus/debug` | FPS counter, node inspector, collision visualization |
| 14 | `packages/headless` | `@quintus/headless` | HeadlessGame, Node.js runtime, manual stepping |
| 15 | `packages/test` | `@quintus/test` | TestRunner, InputScript, game assertions, scenarios |
| 16 | `packages/snapshot` | `@quintus/snapshot` | StateSnapshot, filmstrip, visual regression |
| 17 | `packages/mcp` | `@quintus/mcp` | MCP server for AI tool integration |
| 18 | `packages/ai-prefabs` | `@quintus/ai-prefabs` | 30+ pre-built game components |
| 19 | `packages/quintus-core` | `@quintus/quintus-core` | Meta-package bundling core packages |

---

## 5. Test Framework (Vitest)

### Root Config (`vitest.config.ts`)

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["packages/*/src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["packages/*/src/**/*.test.ts", "packages/*/src/**/*.bench.ts"],
    },
    benchmark: {
      include: ["packages/*/src/**/*.bench.ts"],
    },
  },
});
```

**Key decisions:**
- `environment: jsdom` — needed for Canvas/DOM APIs (note: jsdom lacks Canvas API; later phases should use per-package environment overrides — `environment: "node"` for math/physics, `@vitest/browser` or the `canvas` npm package for rendering tests)
- `globals: true` — `describe`, `it`, `expect` without imports
- Tests live alongside source: `src/foo.ts` → `src/foo.test.ts`
- Coverage target: >90% per package (enforced in CI later)

### Vitest Global Types

Add to root `tsconfig.base.json` or a separate `tsconfig.test.json` if needed — Vitest injects globals via its own type declarations.

---

## 6. Linting & Formatting (Biome)

### Config (`biome.json`)

```json
{
  "$schema": "https://biomejs.dev/schemas/2.3.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noForEach": "warn"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error"
      },
      "suspicious": {
        "noExplicitAny": "error"
      },
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always"
    }
  },
  "files": {
    "ignore": ["dist", "node_modules", "old", "old/**/*.json"]
  }
}
```

**Key decisions:**
- `noExplicitAny: error` — enforces the no-`any` rule
- `indentStyle: tab` — (adjust to preference, tabs are more accessible)
- `noUnusedImports: error` — keeps code clean
- Ignores: `dist/`, `node_modules/`, `old/` (legacy code), `old/**/*.json`

---

## 7. Dev Environment (Vite)

### Examples Directory

`examples/package.json`:
```json
{
  "name": "@quintus/examples",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

`examples/vite.config.ts`:
```typescript
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const pkg = (name: string) =>
  fileURLToPath(new URL(`../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  root: ".",
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    alias: {
      "@quintus/core": pkg("core"),
      "@quintus/math": pkg("math"),
      "@quintus/physics": pkg("physics"),
      "@quintus/sprites": pkg("sprites"),
      "@quintus/tilemap": pkg("tilemap"),
      "@quintus/input": pkg("input"),
      "@quintus/audio": pkg("audio"),
      "@quintus/ui": pkg("ui"),
      "@quintus/tween": pkg("tween"),
      "@quintus/camera": pkg("camera"),
      "@quintus/particles": pkg("particles"),
      "@quintus/three": pkg("three"),
      "@quintus/debug": pkg("debug"),
      "@quintus/headless": pkg("headless"),
      "@quintus/test": pkg("test"),
      "@quintus/snapshot": pkg("snapshot"),
      "@quintus/mcp": pkg("mcp"),
      "@quintus/ai-prefabs": pkg("ai-prefabs"),
      "@quintus/quintus-core": pkg("quintus-core"),
    },
  },
});
```

`examples/index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quintus 2.0 Examples</title>
  <style>
    body { margin: 0; background: #1a1a2e; color: #e0e0e0; font-family: system-ui; }
    canvas { display: block; margin: 2rem auto; border: 1px solid #333; }
    h1 { text-align: center; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>Quintus 2.0</h1>
  <canvas id="game" width="800" height="600"></canvas>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

`examples/main.ts` (placeholder):
```typescript
// Quintus 2.0 — Example game will go here in Phase 1
const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D context not available");
ctx.fillStyle = "#16213e";
ctx.fillRect(0, 0, 800, 600);
ctx.fillStyle = "#e94560";
ctx.font = "bold 48px system-ui";
ctx.textAlign = "center";
ctx.fillText("Quintus 2.0", 400, 300);
ctx.font = "20px system-ui";
ctx.fillStyle = "#0f3460";
ctx.fillText("Phase 0 Complete — Engine coming soon", 400, 350);
```

---

## 8. CI Pipeline (GitHub Actions)

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]

jobs:
  check:
    name: Lint, Build & Test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test

      - name: Coverage
        if: matrix.node-version == 22
        run: pnpm test:coverage
```

**Key decisions:**
- Tests on Node 20 and 22
- `--frozen-lockfile` ensures reproducible installs
- Coverage only runs on Node 22 (avoid duplicate work)
- Simple pipeline: lint → build → test (sequential in one job)

---

## 9. Documentation (TypeDoc)

### Config (`typedoc.json`)

```json
{
  "$schema": "https://typedoc.org/schema.json",
  "entryPoints": ["packages/*"],
  "entryPointStrategy": "packages",
  "out": "docs/api",
  "name": "Quintus 2.0",
  "readme": "README.md",
  "excludePrivate": true,
  "excludeInternal": true,
  "includeVersion": true
}
```

This generates API docs from TSDoc comments. In Phase 0 the docs will be nearly empty — they become useful as code is written in Phase 1+.

---

## 10. Git Hygiene

### `.gitignore`

```gitignore
# Dependencies
node_modules/

# Build output
dist/
*.tsbuildinfo

# Coverage
coverage/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local

# Docs output
docs/api/

# Debug
*.log
```

### `.npmrc`

```ini
auto-install-peers=true
strict-peer-dependencies=false
```

### Legacy Code

The `old/` directory already exists and contains the original Quintus code. It stays as reference only — never imported, never built, never tested. It is excluded from Biome linting via the `files.ignore` config.

---

## 11. Root Scripts

Summary of all scripts available after Phase 0:

| Script | Command | Purpose |
|--------|---------|---------|
| `pnpm install` | — | Install all dependencies |
| `pnpm build` | `pnpm --recursive --sort run build --if-present` | Build all packages (tsup) |
| `pnpm test` | `vitest run` | Run all tests once |
| `pnpm test:watch` | `vitest --watch` | Run tests in watch mode |
| `pnpm test:coverage` | `vitest run --coverage` | Run tests with coverage report |
| `pnpm lint` | `biome check .` | Check linting & formatting |
| `pnpm lint:fix` | `biome check . --write` | Auto-fix linting & formatting |
| `pnpm dev` | `vite examples` | Start Vite dev server on port 3000 |
| `pnpm docs` | `typedoc` | Generate API documentation |
| `pnpm clean` | `rm -rf dist` (recursive) | Remove all build outputs |

---

## 12. Definition of Done

Phase 0 is complete when **all** of the following pass:

- [ ] `pnpm install` — succeeds with no errors
- [ ] `pnpm build` — compiles all 19 packages (empty but valid ESM/CJS/DTS output)
- [ ] `pnpm test` — runs with 0 tests, 0 failures
- [ ] `pnpm lint` — passes with no errors
- [ ] `pnpm dev` — starts Vite dev server, loads `examples/index.html` in browser
- [ ] `pnpm docs` — generates TypeDoc output to `docs/api/`
- [ ] CI pipeline (GitHub Actions) runs green on push
- [ ] All 19 packages have: `src/index.ts`, `package.json`, `tsconfig.json`, `tsup.config.ts`
- [ ] `old/` directory is excluded from builds, tests, and linting
- [ ] No TypeScript errors across the entire monorepo

---

## Execution Order

Recommended order for implementing Phase 0:

1. **Root config files** — `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.npmrc`
2. **Tooling configs** — `biome.json`, `vitest.config.ts`, `typedoc.json`
3. **Scaffold all 19 packages** — use a script or do manually (template above)
4. **Examples directory** — `vite.config.ts`, `index.html`, `main.ts`, `package.json`
5. **CI pipeline** — `.github/workflows/ci.yml`
6. **Install & verify** — `pnpm install && pnpm build && pnpm test && pnpm lint && pnpm dev`
7. **Docs** — `pnpm docs` (verify TypeDoc runs)
8. **Final check** — run all Definition of Done items
