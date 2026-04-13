# Deployed Examples — Detailed Design

> **Goal:** Build and deploy all Quintus example games to GitHub Pages so they are playable at `https://cykod.github.io/Quintus2/`
> **Outcome:** A `pnpm build:examples` script produces a static site, and a GitHub Actions workflow deploys it to gh-pages on every push to `main`

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Vite build config + path fixes | Done |
| 2 | Build script and npm command | Done |
| 3 | GitHub Actions workflow | Done |

---

## Architecture Overview

```
Push to main
     │
     ▼
GitHub Actions workflow
     │
     ├── pnpm install
     ├── pnpm build              (engine packages)
     ├── pnpm build:examples     (Vite MPA build)
     │
     ▼
examples/dist/
├── .nojekyll
├── index.html                   (landing page)
├── bouncing-balls/
│   ├── index.html
│   └── assets/
├── platformer/
│   ├── index.html
│   └── assets/
├── ...18 examples total
│
     ▼
Deploy via actions/deploy-pages
```

**Deployed URL:** `https://cykod.github.io/Quintus2/`

Each example is accessible at `/Quintus2/<example-name>/` (e.g., `/Quintus2/platformer/`).

---

## Critical Design Decision: Runtime Asset Copying

Quintus examples load all game assets (images, audio, tilemaps, 3D models) at runtime via `fetch()` through the engine's `AssetLoader`. These assets are referenced as relative URL strings in asset manifests:

```typescript
game.assets.load({
  images: ["assets/tileset.png"],
  audio: ["assets/jump.ogg"],
  tmx: ["assets/level1.tmx", "assets/tileset.tsx"],
  glb: ["assets/models/floor.glb"],
});
```

**Vite cannot see these.** Since they're fetched at runtime by URL (not imported as ES modules), Vite's module graph doesn't include them, and they won't appear in the build output. This affects ALL asset types: `.png`, `.ogg`, `.tmx`, `.tsx` (Tiled XML), `.json`, `.glb`, `.xml`, `.csv`.

**Solution:** A Vite `writeBundle` plugin that copies each example's `assets/` directory into the build output, preserving the relative path structure. This is simple, robust, and handles all asset types without needing to enumerate file extensions.

---

## Phase 1: Vite Build Configuration + Path Fixes

Vite supports multi-page apps (MPA) via `build.rollupOptions.input`. Each example's `index.html` becomes an entry point.

- [x] Update `examples/vite.config.ts` with build configuration and asset-copy plugin
- [x] Add `rollupOptions.input` that auto-discovers example HTML entry points
- [x] Set `base` from `QUINTUS_BASE` env var (defaults to `/` for dev, `/Quintus2/` for deploy)
- [x] Add `copy-example-assets` plugin to copy `assets/` directories to build output
- [x] Add `.nojekyll` file generation to prevent GitHub Pages Jekyll processing
- [x] Fix `examples/index.html` links from root-absolute to relative paths
- [x] Fix back-links in the 5 examples that have them (`href="/"` → `href="../"`)

### Updated `examples/vite.config.ts`

```typescript
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const pkg = (name: string) =>
  fileURLToPath(new URL(`../packages/${name}/src/index.ts`, import.meta.url));

const subpath = (name: string, path: string) =>
  fileURLToPath(new URL(`../packages/${name}/src/${path}.ts`, import.meta.url));

// Discover all example directories that contain an index.html
const examplesDir = fileURLToPath(new URL(".", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", "dist", "__tests__"]);

function discoverExamples(): Record<string, string> {
  const input: Record<string, string> = {
    main: resolve(examplesDir, "index.html"),
  };
  for (const entry of readdirSync(examplesDir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const dir = join(examplesDir, entry);
    try {
      if (!statSync(dir).isDirectory()) continue;
      statSync(join(dir, "index.html"));
      input[entry] = join(dir, "index.html");
    } catch {
      // Not a directory or no index.html — skip
    }
  }
  return input;
}

export default defineConfig({
  root: ".",
  base: process.env.QUINTUS_BASE || "/",
  server: {
    port: 3050,
    open: !process.env.DEVCONTAINER,
    host: process.env.DEVCONTAINER ? "0.0.0.0" : undefined,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: discoverExamples(),
    },
  },
  plugins: [
    {
      // Serve Tiled tileset .tsx files (XML) as plain text instead of
      // transforming them as TypeScript JSX.
      name: "serve-tiled-tsx",
      enforce: "pre",
      load(id) {
        if (id.endsWith(".tsx") && id.includes("/assets/")) {
          return `export default ""`;
        }
      },
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.endsWith(".tsx") && req.url.includes("/assets/")) {
            const filePath = join(server.config.root, req.url);
            try {
              const content = readFileSync(filePath, "utf-8");
              res.setHeader("Content-Type", "text/xml");
              res.end(content);
            } catch {
              next();
            }
          } else {
            next();
          }
        });
      },
    },
    {
      // Copy each example's assets/ directory into the build output.
      // Game assets are loaded at runtime via fetch() and are invisible
      // to Vite's module graph, so they must be copied explicitly.
      name: "copy-example-assets",
      apply: "build",
      writeBundle(options) {
        const outDir = options.dir || join(examplesDir, "dist");
        const examples = discoverExamples();
        for (const [name] of Object.entries(examples)) {
          if (name === "main") continue;
          const assetsDir = join(examplesDir, name, "assets");
          if (existsSync(assetsDir)) {
            const destDir = join(outDir, name, "assets");
            cpSync(assetsDir, destDir, { recursive: true });
          }
        }
        // Write .nojekyll to prevent GitHub Pages from running Jekyll
        writeFileSync(join(outDir, ".nojekyll"), "");
      },
    },
  ],
  resolve: {
    alias: {
      "@quintus/jsx/jsx-runtime": subpath("jsx", "jsx-runtime"),
      "@quintus/jsx/jsx-dev-runtime": subpath("jsx", "jsx-dev-runtime"),
      "@quintus/jsx": pkg("jsx"),
      "@quintus/tilemap/physics": subpath("tilemap", "physics"),
      "@quintus/particles/three": subpath("particles", "three"),
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
      "@quintus/prefabs": pkg("prefabs"),
      "@quintus/quintus-core": pkg("quintus-core"),
    },
  },
});
```

### How Asset Copying Works

The `copy-example-assets` plugin runs after Vite writes its bundled output. For each discovered example, it copies the entire `assets/` directory (if it exists) into the corresponding output subdirectory using `fs.cpSync`. This handles all asset types uniformly:

- `.png` images and sprite sheets
- `.xml` sprite atlases
- `.tmx` Tiled map files
- `.tsx` Tiled tileset files (XML, not TypeScript)
- `.ogg` audio files
- `.glb` / `.gltf` 3D models
- `.json` data files
- `.csv` configuration files

The `platformer-tsx/assets` symlink (pointing to `../platformer/assets`) is followed by `cpSync` on Linux/macOS, so the assets are copied correctly. The GitHub Actions workflow runs on `ubuntu-latest`, which handles symlinks natively.

### Path Fixes

**`examples/index.html`** — Change all card links from root-absolute to relative:

```html
<!-- Before -->
<a class="card" href="/bouncing-balls/">

<!-- After -->
<a class="card" href="./bouncing-balls/">
```

All 18 card links need this change. Root-absolute paths like `/bouncing-balls/` would resolve to `https://cykod.github.io/bouncing-balls/` instead of `https://cykod.github.io/Quintus2/bouncing-balls/`.

**Back-links in 5 examples** — Change `href="/"` to `href="../"`:

- `examples/basic_platformer/index.html`
- `examples/bouncing-balls/index.html`
- `examples/particles/index.html`
- `examples/tilemap/index.html`
- `examples/tween-ui/index.html`

The other 13 examples have no back-link. Adding one to all examples is optional and out of scope for this design.

### Base Path Handling

Assets loaded at runtime by the Quintus asset loader use relative paths like `assets/tileset.png`. Since each example's `index.html` is served from its own subdirectory (e.g., `/Quintus2/platformer/index.html`), relative asset URLs resolve correctly to `/Quintus2/platformer/assets/tileset.png`.

The `base` config only affects Vite-processed references (JS/CSS imports, `<script>` tags in HTML). Runtime `fetch()` calls with relative paths are unaffected by the base path.

---

## Phase 2: Build Script and npm Command

- [x] Add `build:examples` script to root `package.json`
- [x] Script cleans stale output, builds engine packages, then runs Vite build
- [x] Verify build output structure

### Script in root `package.json`

```json
{
  "scripts": {
    "build:examples": "pnpm build && rm -rf examples/dist && vite build examples"
  }
}
```

The `rm -rf examples/dist` step ensures a clean build — stale output from previous builds won't interfere with the `discoverExamples()` scanner or cause confusing artifacts.

### Expected Output Structure

```
examples/dist/
├── .nojekyll
├── index.html
├── assets/                     (Vite JS chunk output)
│   ├── main-[hash].js
│   ├── platformer-[hash].js
│   └── ...
├── bouncing-balls/
│   └── index.html
├── basic_platformer/
│   └── index.html
├── platformer/
│   ├── index.html
│   └── assets/
│       ├── background.png
│       ├── level1.tmx
│       ├── jump.ogg
│       └── ...
├── platformer-tsx/
│   ├── index.html
│   └── assets/               (copied from resolved symlink)
├── dungeon/
│   ├── index.html
│   └── assets/
│       ├── tileset.tsx        (Tiled XML, copied as-is)
│       ├── tileset.png
│       └── ...
├── 3d-dungeon/
│   ├── index.html
│   └── assets/
│       └── models/*.glb
└── ...18 examples total
```

Vite handles:
- Bundling all TypeScript → JS with tree-shaking and code-splitting
- Processing HTML entry points (rewriting `<script>` tags to point to bundled JS)
- Applying `base` path prefix to Vite-managed URLs

The `copy-example-assets` plugin handles:
- Copying all `assets/` directories verbatim into the output
- Writing `.nojekyll` marker file

---

## Phase 3: GitHub Actions Workflow

- [x] Create `.github/workflows/deploy-examples.yml`
- [x] Trigger on push to `main` and manual dispatch
- [x] Use `actions/deploy-pages` (no gh-pages branch needed)
- [x] Add post-build verification step
- [ ] Enable GitHub Pages in repo settings (source: GitHub Actions)

### Workflow File: `.github/workflows/deploy-examples.yml`

```yaml
name: Deploy Examples to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm build

      - name: Build examples
        run: vite build examples
        env:
          QUINTUS_BASE: /Quintus2/

      - name: Verify build output
        run: |
          test -f examples/dist/index.html
          test -f examples/dist/.nojekyll
          test -f examples/dist/platformer/index.html
          test -f examples/dist/platformer/assets/tileset.png
          test -f examples/dist/dungeon/assets/tileset.tsx
          test -f examples/dist/3d-dungeon/assets/models/floor.glb
          echo "Build verification passed"

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: examples/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Key Decisions

1. **`pnpm/action-setup@v4`** — auto-detects pnpm version from `packageManager` field in `package.json`
2. **`--frozen-lockfile`** — ensures reproducible builds in CI
3. **`QUINTUS_BASE: /Quintus2/`** — sets the base path so Vite-processed URLs include the repo prefix
4. **`cancel-in-progress: true`** — rapid pushes to `main` cancel stale deploys since only the latest matters
5. **Build verification step** — catches silent failures (missing assets, empty output) before deploying a broken site
6. **`workflow_dispatch`** — allows manual re-deployment without a code push
7. **No `gh-pages` branch** — the modern `actions/deploy-pages` approach uploads artifacts directly, no branch management needed

### Repository Setup Required

The repo owner needs to enable GitHub Pages:
1. Go to Settings → Pages
2. Set Source to **"GitHub Actions"** (not "Deploy from a branch")

---

## Test Plan

### Local Verification (Phase 1-2)

1. **Build test:**
   ```bash
   QUINTUS_BASE=/Quintus2/ pnpm build:examples
   ```
   Verify `examples/dist/` contains all 18 example directories with `index.html` files and `assets/` directories where expected.

2. **Local preview with correct base path:**
   ```bash
   npx serve examples/dist --single
   ```
   Open the served URL and verify:
   - Landing page loads with all example cards
   - Clicking each card navigates to the correct example
   - Each example loads and runs (canvas renders, no console errors)
   - Audio plays on user interaction
   - Tiled maps load correctly (including `.tsx` tileset files)
   - 3D examples render (Three.js, GLTF models load)
   - Back-links return to the index

3. **Asset loading spot-check** (open Network tab):
   - **platformer:** TMX maps, sprite PNGs, OGG audio — no 404s
   - **dungeon:** `tileset.tsx` (Tiled XML) loads as XML
   - **3d-dungeon:** `.glb` model files load
   - **advanced-platformer:** parallax background PNGs, multiple TMX files

4. **Dev mode unchanged:**
   ```bash
   pnpm dev
   ```
   Verify local development still works exactly as before on port 3050.

### CI Verification (Phase 3)

5. **Push to `main`** and verify:
   - GitHub Actions workflow triggers and completes
   - Build verification step passes
   - Pages deploy succeeds
   - Live site at `https://cykod.github.io/Quintus2/` works

---

## Definition of Done

- [ ] `pnpm build:examples` produces a working static site in `examples/dist/`
- [ ] All 18 examples load and run when served from a subdirectory path
- [ ] All runtime assets (images, audio, tilemaps, models) are present in the build output
- [ ] `.github/workflows/deploy-examples.yml` deploys on push to `main`
- [ ] `https://cykod.github.io/Quintus2/` serves the examples landing page
- [ ] `pnpm dev` still works unchanged for local development
- [ ] No changes to engine packages — build-only concern
