# Packaging, npm Releases & `create-quintus2` — Detailed Design

> **Goal:** Make the Quintus 2.0 engine publishable to npm with an automated, versioned release flow, and ship a `create-quintus2` scaffolder that spins up a runnable 2D or 3D game project pre-wired with the `debug-game` skill.
> **Outcome:** `pnpm release` publishes the bundled **`quintus2`** engine and the **`create-quintus2`** CLI to npm under one lockstep version starting at **`0.0.1`**; a user runs `npm create quintus2@latest my-game`, picks 2D or 3D, and gets a project that runs (`npm run dev`), tests (`npm test`), and debugs (`pnpm qdbg`) out of the box — with a `CLAUDE.md` and the `debug-game` skill that let an LLM build the game.

> **Naming & version:** The project is **Quintus2**. It ships **two** npm packages (see **§D2**): the unscoped **`quintus2`** engine (the current `quintus` meta-package, renamed and expanded to *bundle the whole engine*; the name also avoids colliding with the legacy Quintus 1.0 `quintus` package and matches `npm create quintus2`) and **`create-quintus2`** (the scaffolder). The 19 `@quintus/*` packages remain **private internal workspace packages** — bundled into `quintus2`'s `dist`, never published. 3D lives behind a `quintus2/three` subpath with an optional `three` peer (**§D3a**). Both published packages start at **`0.0.1`** and move in lockstep. A `0.x` line makes no API-stability promise — no prerelease/`alpha` tagging; releases go to the `latest` dist-tag and the `0.x` semver itself signals churn.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Publish-readiness: privatize internals, build the `quintus2` bundle, LICENSE, metadata | Done |
| 2 | CHANGELOG-driven `pnpm release` script + CI check | Done |
| 3 | `create-quintus2` CLI skeleton (prompts, flags, copy engine, version injection) | Done |
| 4 | 2D starter template | Done |
| 5 | 3D starter template | Done |
| 6 | Bundled tooling in scaffolds (debug-game skill, standalone qdbg, CLAUDE.md) | Done |
| 7 | End-to-end scaffold+build CI test and docs | Done |

---

## Background — Current State (verified against the repo)

- **21 scoped packages** under `packages/` at placeholder version **`0.0.0`**; the unscoped meta-package (dir `packages/quintus`) is named **`quintus`** and is at **`2.0.0-alpha.1`**, re-exporting 11 of them. No git tags exist — nothing has ever been released. This design **renames the meta-package to `quintus2`**, expands it to bundle the whole engine, makes all 19 `@quintus/*` packages **private**, and starts the two published packages at **`0.0.1`** (see **§D2**).
- Build is already publish-shaped: each package has `tsup` producing **ESM + CJS + `.d.ts`**, correct `exports`/`main`/`module`/`types` pointing at `./dist/*`, and `"files": ["dist"]`. Cross-package deps use `workspace:*`. Under D2 these internal packages are no longer published individually; `quintus2` bundles them via `noExternal`.
- **Missing for publish:** no `LICENSE.md` (every `package.json` declares `"license": "SEE LICENSE IN LICENSE.md"` but the file did not exist — now created), no `author`/`homepage`/`bugs`, non-canonical `repository.url`. (`publishConfig.access` is a non-issue: both published names are unscoped/public-by-default.)
- **No release tooling at all:** the repo had no changesets/semantic-release/publish CI; this design adds `scripts/release.mjs`. The only workflow is `deploy-examples.yml` (GitHub Pages).
- **Two empty stubs** (`quintus-core`, `mcp`) — irrelevant under D2 since *all* internal packages become private.
- **`packages/three` exports reference raw `src/*.ts`** (`./test-utils`, a `.js`-mapped test mock). Now that three is bundled into `quintus2` and no longer published standalone, its consumer-facing subpaths must be re-homed under `quintus2/three` / `quintus2/testing`; the in-repo test-util importers still resolve via the workspace `@quintus/three` package.
- **Examples are not standalone.** All of `examples/` shares ONE `vite.config.ts`, ONE `package.json` (`workspace:*` deps), and Vite `resolve.alias` maps `@quintus/*` straight to package **source**. A scaffolded project must be fully self-contained: inline tsconfig, published version ranges, no source aliases, its own assets.
- **Debug bridge is free.** `@quintus/core`'s `Game` installs `window.__quintusDebug` automatically when the URL has `?debug`. No import, plugin, or dep is needed in a game project. `bin/qdbg` (bash, 830 lines) drives it through Claude Code's bundled `playwright-cli`. `qdbg connect <full-url>` already works standalone; only the no-arg default assumes the monorepo's multi-page `/${demo}/` layout.
- Best template models: **2D → `examples/platformer-tsx/`** (JSX, `Game` + plugins + `registerScenes` + `assets.load`), **3D → `examples/3d-cube/`** (`new Game({ renderer: null })` + `ThreePlugin`, no `<canvas>`).

---

## Design Decisions & Alternatives

### D1 — Locked (lockstep) versioning via a CHANGELOG-driven release script

All engine packages ship together and are tightly coupled (physics depends on core depends on math…). Independent SemVer per package creates a compatibility matrix nobody can reason about, and an LLM writing a game can't guess which `@quintus/*` versions are mutually compatible.

**Decision:** Version the **whole surface in lockstep** — every published package (`@quintus/*`, the `quintus2` meta, and `create-quintus2`) always carries the same version, starting at **`0.0.1`**. This is enforced not by Changesets but by a single **`pnpm release` script** (`scripts/release.mjs`, §Phase 2) that reads the target version from the top of **`CHANGELOG.md`**, runs the pre-release gate, bumps every non-private package to that version, commits/tags, and publishes. Compatibility is trivial (one number), and `create-quintus2` injects its **own** version as the engine dependency for the scaffold (§Phase 3), so the generated project references a set that was published together. (Exact-pin vs caret is decided in **§D6**.)

- **Alternative — Changesets:** rejected. Its per-change `.changeset/*.md` files and Version-PR flow duplicate the repo's existing `CHANGELOG.md` + `/changelog` skill convention, and its main value (workspace-dep rewriting, topological publish) is already provided by `pnpm -r publish`. A ~120-line script gives us lockstep bumping and a CHANGELOG gate with far less machinery.
- **Alternative — independent versioning:** rejected. Correct for loosely-coupled libraries; wrong for a single engine. Would reintroduce the `0.0.0`/`2.0.0-alpha` split we're killing.
- **Alternative — semantic-release / release-please:** rejected. Commit-message-driven; overkill for a single-maintainer lockstep monorepo with a human-authored CHANGELOG.

### D2 — Ship ONE bundled `quintus2` package; the 19 `@quintus/*` stay private

A game engine is adopted as a whole, and this one already versions in lockstep — so the per-package boundaries buy nothing on the *distribution* side. Publishing 19 granular packages is the toolchain pattern (`@babel/*`, `@angular/*`), not the engine pattern. Every major JS engine ships as **one** package — `three`, `phaser`, `excalibur` — and PixiJS **consolidated its `@pixi/*` split back into a single `pixi.js` in v8** precisely because the split caused duplicate-core version-mismatch bugs and install confusion.

**Decision:** Publish exactly **two** npm packages: the unscoped **`quintus2`** engine (the current `quintus` meta-package, renamed and expanded to bundle the whole engine into its own `dist`) and **`create-quintus2`** (the CLI). All **19 `@quintus/*` packages become `"private": true`** internal workspace packages — kept for code organization and separate test suites, but never published. `quintus2`'s build inlines them (`tsup` `noExternal: [/^@quintus\//]`), so there is only ever **one copy of core** on a user's machine (the duplicate-core bug class is impossible by construction).

- **Public surface via subpath exports:** `quintus2` (2D + core barrel), `quintus2/jsx-runtime` + `quintus2/jsx-dev-runtime` (for `jsxImportSource`), `quintus2/three` (3D — see D3a), `quintus2/testing` (headless + test utilities for game test suites). Side-effect registrations that were subpath imports (`@quintus/tilemap/physics`, JSX runtime, three's `augment`) are preserved as explicit subpaths, and `sideEffects` lists them so tree-shaking keeps them while dropping unused API.
- **No scope/`publishConfig.access` needed** — both published names are unscoped (public by default). The empty stubs `quintus-core`/`mcp` are simply part of the "all internal packages are private" set.
- **Alternative — 19 scoped packages (prior design):** rejected per the above.

### D3 — Scaffolder (and docs) import from `quintus2`

With a single published package, the granular `@quintus/*` names don't exist on npm, so scaffolded projects and public docs must import from `quintus2`.

**Decision:** Templates depend on **just `quintus2`** (plus `three` for the 3D template). Game code imports `{ Game, Actor, … } from "quintus2"`, sets `jsxImportSource: "quintus2"`, and pulls 3D from `quintus2/three`. This also *shrinks* the scaffolder's version-injection to a single dependency (§Phase 3). The in-repo `examples/` keep importing `@quintus/*` via workspace resolution (they're the dev harness, not shipped) — only the published templates and docs use `quintus2`.

- **Alternative — templates import `@quintus/*`:** moot; those names are unpublished under D2.

### D3a — 3D via `quintus2/three` with an optional `three` peer

`three` is a large (~600 KB) dependency a 2D game must not be forced to install.

**Decision:** `quintus2` declares `three` as an **optional peer** (`peerDependenciesMeta.three.optional = true`) and exposes 3D only under the `quintus2/three` subpath, whose build keeps `three` external. A 2D user (`npm i quintus2`) never installs three and sees **no peer warning** (optional); a 3D user runs `npm i quintus2 three` and imports `quintus2/three`. The main barrel never references three, so it's never pulled transitively.

- **Alternative — separate `@quintus/three` companion package:** viable (3 packages, three as a hard peer), but the optional-peer subpath keeps the "2 packages, one install" promise the maintainer chose.

### D4 — Templates are hand-authored minimal starters, vendored in the package, and CI-verified

Templates must be self-contained (no `workspace:*`, no source aliases), so they can't literally be the monorepo examples. Deriving them from examples at publish time is complex and fragile.

**Decision:** Hand-author **minimal** starters (a player, one scene, a HUD, a few assets — not the full flagship game) under `packages/create-quintus2/templates/{2d,3d}/`. Keep them honest with a CI test that scaffolds both and builds them against **packed tarballs** of the real engine (§Phase 7).

- **Alternative — `degit` the repo / GitHub template repo:** rejected. Couples the tool to GitHub availability and a specific ref, and can't rewrite `workspace:*` → published ranges.
- **Alternative — copy the full example games:** rejected. Too much code for a starter; obscures "how do I add my own thing."

### D5 — `qdbg` standalone via a `.qdbg.json` project config

`qdbg connect <url>` already works, but the ergonomic no-arg `connect` builds `http://localhost:PORT/${demo}/?debug` (monorepo multi-page assumption). A single-game scaffold serves at the root.

**Decision:** Teach `bin/qdbg` to read an optional **`.qdbg.json`** in the cwd (`{ "url": "http://localhost:3050" }`); when present, `connect` with no demo arg uses that root URL (appending `?debug`). Scaffolds ship this file. This is a small, backward-compatible addition (monorepo behavior unchanged when the file is absent). The scaffold's Vite dev port is set to **3050** so it also falls inside qdbg's existing 3050–3055 probe range.

---

### D6 — Exact pin for the injected engine version (the `0.x` line)

`create-quintus2` writes the engine version into the scaffold's `package.json`.

**Decision:** inject an **exact pin** (`"@quintus/core": "0.0.3"`, no caret). Every scaffold is then reproducible and frozen to the exact version the CLI shipped with; users opt into upgrades explicitly — the right default while the API churns. Note this is also the *only* honest option at `0.0.x`: a caret on a `0.0.x` version (`"^0.0.3"`) is special-cased by semver to match **only** `0.0.3` anyway, so caret buys nothing until the engine reaches `0.1.0`. **Revisit at `1.0.0`:** switch to caret (`"^1.0.0"`) once the API is stable so bugfix/minor releases flow to scaffolds automatically.

- **Alternative — caret now:** rejected. At `0.0.x` it's equivalent to an exact pin (see above); at `0.x.y` (once `0.1.0` ships) `"^0.1.0"` would float within `0.1.x` but not to `0.2.0` — desirable eventually, but premature while the surface is still moving fast.

## Assumptions

1. The unscoped npm names **`quintus2`** and **`create-quintus2`** are available (no npm org/scope needed under D2 — both are public-by-default), and the maintainer is `npm login`-authenticated locally (the release runs from a maintainer's machine, not CI). npm 2FA, if enabled, is satisfied at publish time via `NPM_CONFIG_OTP` or an interactive prompt. (No npm-provenance signing — that requires a CI/OIDC publish; a CI variant can be added later.)
2. **License is MIT**, © Cykod LLC (Quintus 1.0 was MIT). Root `LICENSE.md` is created (done). If the holder/year is wrong, only that file changes.
3. Releases start at **`0.0.1`** and publish to the **`latest`** dist-tag. There is no prerelease/`alpha` tagging — the `0.x` semver line itself communicates "unstable API, expect breaking changes." Graduation to a `1.0.0` stability promise is out of scope here.
4. `create-quintus2` users run inside **Claude Code**, so `playwright-cli` is on `PATH` for `qdbg`. The scaffold still runs/builds/tests without it; only `qdbg` needs it. This is documented in the scaffold's README/CLAUDE.md.
5. The engine packages are published **before** `create-quintus2`'s templates can `npm install` real versions. The `pnpm release` script bumps and publishes the entire lockstep set (including `create-quintus2`) in one run, so the scaffolder never references a version that wasn't published alongside it.
6. `npm create quintus2` resolves to the `create-quintus2` package (npm's `create-<name>` convention). The literal string `npx create quintus2` the user typed is documented as `npm create quintus2@latest` / `npx create-quintus2`.
7. Node ≥ 20 (matches root `engines`), pnpm 10.x for engine dev; scaffolded projects support npm/pnpm/yarn/bun (the CLI detects the invoking package manager).

---

## Phase 1: Publish-Readiness of Engine Packages

Turn the 19 `@quintus/*` into private internals, and build `quintus2` as the single bundled, publishable engine.

- [x] Create root `LICENSE.md` (MIT, © 2026 Cykod LLC). **Done.**
- [x] Point all `repository.url` references at the real repo `https://github.com/cykod/quintus2` (was `cykod/Quintus`). **Done** across all `packages/*/package.json`.
- [x] **Privatize all internals:** add `"private": true` to every `packages/*/package.json` **except** `packages/quintus` (→ `quintus2`) and `packages/create-quintus2` (Phase 3). This is what makes `pnpm -r publish` / `pnpm release` emit exactly two packages (**D2**). **Done** — all 21 `@quintus/*` packages are now `"private": true`; only `quintus2` remains publishable this phase (`create-quintus2` arrives in Phase 3).
- [x] **Rename & relocate the meta-package:** `packages/quintus` → `packages/quintus2`, `"name": "quintus"` → `"quintus2"`, `repository.directory` → `packages/quintus2`. Set its version to **`0.0.0`**. **Done** via `git mv` (history preserved); `pnpm-workspace.yaml` unchanged (uses the `packages/*` glob).
- [x] **Expand the `quintus2` barrel** (`src/index.ts`). **Done** — added `@quintus/prefabs` (now 12 packages) plus a side-effect `import "@quintus/tilemap/physics"` so tile-collision wiring is baked into the bundled `dist/index.js`. **Deviation:** `@quintus/particles` is deliberately **excluded** from the main barrel — its `index.ts` re-exports `ParticleEmitter3D`, which imports `three` and `@quintus/three`; including it would pull `three` into `dist/index.js` and violate **D3a** ("the main barrel never references three"). `snapshot`/`debug` also stay out (not game-facing runtime API). JSX runtime, 3D, and testing remain subpaths.
- [x] **Make `quintus2` bundle its internals.** **Done** — `tsup.config.ts` sets `noExternal: [/^@quintus\//]` and `splitting: false` (each entry is a self-contained bundle so registrations survive and `dist/index.js` has zero `@quintus/*` imports). The `@quintus/*` deps moved from `dependencies` → `devDependencies` (workspace links for build-time resolution only), so the published package has **no** runtime `dependencies`. Multi-entry map: `index`, `jsx-runtime`, `jsx-dev-runtime`, `three` (with `external: ["three", /^three\//]`), `testing`.
- [x] **`exports` + peer + sideEffects** in `packages/quintus2/package.json`. **Done** — `exports` map for `.`, `./jsx-runtime`, `./jsx-dev-runtime`, `./three`, `./testing` (each `types`/`import`/`require`); `peerDependencies.three` + `peerDependenciesMeta.three.optional`; `sideEffects` lists the built modules that carry runtime registrations (`dist/index.{js,cjs}` — tilemap↔physics + augments — and `dist/three.{js,cjs}` — three's `augment`). The pure `jsx-runtime`/`testing` entries stay tree-shakeable.
- [x] **Metadata** on the published `quintus2` (`create-quintus2` metadata deferred to Phase 3, when that package is created): `"license": "MIT"`, `"author"`, `"homepage"`, `"bugs"`, canonical `"repository"`. **Done.**
- [x] Add a **license fan-out** to `scripts/release.mjs` — **implemented in Phase 2.** Note: `pnpm publish` already auto-copies the workspace-root `LICENSE.md` into the tarball, so `quintus2`'s `npm pack` already includes `LICENSE.md`; the explicit fan-out makes this deterministic and pnpm-version-independent (copies into the package dir just before publish, removes after, git-ignored).
- [x] Write a real `README.md` for **`quintus2`** (npm package page). **Done.** (`create-quintus2` README is Phase 3/6.)

**Versioning note (bootstrap):** published packages sit at `0.0.0` locally as the "never released" sentinel. `CHANGELOG.md`'s top entry is `## [0.0.1]`, so the first `pnpm release` sees `0.0.1 > 0.0.0` and publishes `0.0.1`; the script then commits the bump so subsequent releases compare against the real published version.

### Files touched
`LICENSE.md` (done), `CHANGELOG.md` (done), `scripts/release.mjs` (done — license fan-out pending), every `packages/*/package.json` (repo URL done; `private` flag pending on the 19), rename `packages/quintus` → `packages/quintus2` with expanded `src/index.ts` + new `src/{jsx-runtime,jsx-dev-runtime,three,testing}.ts` + `tsup.config.ts` (`noExternal`) + `package.json` (`exports`/peer/metadata), `packages/create-quintus2/package.json` (metadata), `README.md` ×2.

### Tests / Success Criteria
- `pnpm -r publish --dry-run --no-git-checks` lists **exactly** `quintus2` and `create-quintus2` — nothing else.
- `npm pack --dry-run` in `packages/quintus2` includes `LICENSE.md`, `README.md`, and `dist/**` (incl. `dist/three.*`, `dist/jsx-runtime.*`, `dist/testing.*`), and **excludes** `src/**`.
- After `pnpm build`, `packages/quintus2/dist/index.js` contains the inlined engine (no `import ... from "@quintus/..."` remains) and `dist/three.*` keeps `three` external (a bare `from "three"` import survives).
- A scratch consumer: `import { Game, Actor, Vec2 } from "quintus2"` type-checks and runs headless; `import { ThreePlugin } from "quintus2/three"` resolves only when `three` is installed; installing `quintus2` **without** three yields no peer-dependency warning. **This "type-checks" criterion now genuinely passes via external `tsc`** — verified by scaffolding the 2D template from a packed tarball OUTSIDE the pnpm workspace and running `npx tsc --noEmit` (0 errors, down from 58). See the `.d.ts` note under Phase 4.

---

## Phase 2: CHANGELOG-Driven Release Script

A single `pnpm release` command runs the whole flow locally: gate → bump-lockstep → commit/tag → publish → push. The CHANGELOG entry is the **only** thing allowed to be uncommitted when it starts.

- [x] Add **`CHANGELOG.md`** (Keep-a-Changelog format) as the release-notes source of truth, distinct from the dev-narrative `HISTORY.md`. **Done** — seeded with an `## [Unreleased]` section and the first `## [0.0.1]` entry. (Continue authoring entries via the `/changelog` skill.)
- [x] Add **`scripts/release.mjs`** and the root `"release": "node scripts/release.mjs"` script. **Done.** Dependency-free Node ESM; supports `--dry-run` (checks only, no mutation) and `--yes` (skip the confirm prompt). Its steps:
  1. **Parse target version** from the topmost `## [x.y.z]` heading in `CHANGELOG.md`.
  2. **Monotonicity** — assert `target > max(current package versions)`; abort otherwise.
  3. **Clean-tree gate** — `git status --porcelain`; the only path allowed to be dirty is `CHANGELOG.md`. Any other uncommitted change aborts the release.
  4. **Pre-release gate** — `pnpm install --frozen-lockfile && pnpm lint && pnpm test && pnpm build`.
  5. **Confirm** (unless `--yes`/`--dry-run`), then **bump every publishable package** (`packages/*/package.json` without `"private": true`) to `target` — the lockstep bump.
  6. **Commit** `"Release v<target>"` (CHANGELOG entry + version bumps) and **tag** `v<target>`.
  7. **Publish** with `pnpm -r publish --access public --no-git-checks` — pnpm rewrites `workspace:*` deps to the concrete `target` and skips `private` packages automatically.
  8. **Push** with `git push --follow-tags`.
- [x] Add the **license fan-out** to the script (Phase 1 item): copy root `LICENSE.md` into each publishable package dir immediately before step 7, and remove the copies after. **Done** — the copy → `pnpm -r publish` → remove sequence is wrapped in a `try/finally` so the temporary copies are cleaned up even if publish fails; `--dry-run` prints the copy/remove steps without touching disk. `.gitignore` now ignores `packages/*/LICENSE.md`.
- [x] Add a lightweight **CI check** workflow `.github/workflows/ci.yml` (PRs + pushes to `main`): `pnpm install --frozen-lockfile && pnpm lint && pnpm test && pnpm build`. This is a *gate only* — it does **not** publish (publishing is the maintainer's local `pnpm release`, since npm-provenance/OIDC is out of scope per Assumption #1). **Done** — uses `pnpm/action-setup@v4` (pnpm version from `packageManager`) + `actions/setup-node@v4` (Node 20, pnpm cache). To make the gate genuinely green, four pre-existing lint violations unrelated to this work were fixed (see note below).
- [x] Document the flow in `CONTRIBUTING.md`: add a `CHANGELOG.md` entry under a new `## [x.y.z]` heading (leave uncommitted) → `pnpm release`. **Done.**
- [x] **`scripts/release.test.mjs`** — unit-tests the pure helpers. **Done** — `release.mjs` now exports `parseChangelogVersion` and `semverCmp`, and only runs the CLI flow when executed directly (`import.meta.url === pathToFileURL(process.argv[1]).href`) so tests can import it. `vitest.config.ts`'s `include` gained `scripts/**/*.test.mjs`.

**Bug fixed during Phase 2:** the clean-tree gate did `git status --porcelain` then `.trim()` on the *whole* blob before splitting, which ate the leading space of the **first** porcelain line and shifted its column parse by one — so a lone dirty `CHANGELOG.md` (the normal release case) misparsed as `HANGELOG.md`, failed the `!== "CHANGELOG.md"` check, and aborted the release incorrectly. Fixed by splitting first and slicing each line's `XY ` prefix (no global trim).

**Lint debt fixed to green the CI gate:** `packages/touch/src/touch-overlay.ts` (`current !== null && current.sticky` → `current?.sticky`), `examples/space-shooter/assets/build-particles.mjs` (`x + "\n"` → template literal), and two dead variables in `examples/3d-dungeon/__tests__/torch.test.ts` (`intensities`, `result`) removed. All safe, behavior-preserving.

### Release flow (ASCII)

```
Author bumps CHANGELOG.md  →  ## [0.0.2] - <date>   (uncommitted; nothing else dirty)
      │
      ▼  pnpm release
scripts/release.mjs
  ├─ read target = 0.0.2 from CHANGELOG.md;  assert 0.0.2 > current
  ├─ assert git clean except CHANGELOG.md
  ├─ gate: install → lint → test → build
  ├─ confirm  →  bump the non-private packages (quintus2, create-quintus2) to 0.0.2
  ├─ git commit "Release v0.0.2"  +  git tag v0.0.2
  ├─ pnpm -r publish  (skips the 19 private @quintus/*; quintus2 ships them bundled)
  └─ git push --follow-tags
      │
      ▼
npm: quintus2 , create-quintus2   (both @ 0.0.2, latest dist-tag)
```

### Files touched
`CHANGELOG.md` (done), `scripts/release.mjs` (done), `package.json` (`release` script — done), `.github/workflows/ci.yml` (new), `CONTRIBUTING.md` (new), `.gitignore` (add `packages/*/LICENSE.md`).

### Tests / Success Criteria
- `pnpm release --dry-run` on a scratch branch (with a bumped `CHANGELOG.md`) runs the full gate, prints the exact publishable set and target version, and **mutates nothing** (no version writes, no git ops, no publish).
- With an intentionally dirty non-CHANGELOG file present, `pnpm release --dry-run` **aborts** at the clean-tree gate naming the offending path.
- With the CHANGELOG top version ≤ current, it **aborts** at the monotonicity check.
- `scripts/release.test.mjs`: unit-test the pure helpers — CHANGELOG version parse (`## [0.0.2] - …` → `0.0.2`) and `semverCmp` ordering (incl. prerelease `<` release).
- `pnpm -r publish --dry-run --no-git-checks` lists **exactly** `quintus2` and `create-quintus2` (all 19 `@quintus/*` and `examples` skipped as private).

---

## Phase 3: `create-quintus2` CLI Skeleton

A new workspace package `packages/create-quintus2/` — a Node CLI that copies a template, rewrites its `package.json`, and installs deps.

- [x] `packages/create-quintus2/package.json`:

```jsonc
{
  "name": "create-quintus2",
  "version": "0.0.0",
  "type": "module",
  "bin": { "create-quintus2": "./dist/index.js" },
  "files": ["dist", "templates"],
  "engines": { "node": ">=20" },
  "dependencies": { "prompts": "^2.4.2", "picocolors": "^1.0.0" },
  "scripts": { "build": "tsup src/index.ts --format esm --clean" }
}
```

- [x] CLI behavior (`src/index.ts`):
  - Usage: `npm create quintus2@latest [dir] [--template 2d|3d] [--name <pkg>] [--no-install] [--no-git] [--pm npm|pnpm|yarn|bun]`.
  - **Interactive** (via `prompts`) when flags are omitted: target directory → template (**2D / 3D**) → install deps? → git init?
  - Non-interactive when flags/`CI` are set (for scripted use and the Phase 7 test).
  - Refuse to scaffold into a non-empty dir unless `--force`.
  - Copy `templates/<template>/**` → target, renaming `_gitignore` → `.gitignore`, `_npmrc` → `.npmrc` (npm strips **only** `.gitignore`/`.npmrc` from published tarballs — the classic create-* workaround; `.claude/`, `.qdbg.json`, and other dotfiles publish as-is and need no rename).
  - After copying, **`chmod 0o755` the shipped `bin/qdbg`** (and any other scripts): npm normalizes file modes to `0644` on publish, so a template `bin/qdbg` extracts non-executable and must be re-marked (it is not a `bin`-field entry of `create-quintus2`).
  - **Version injection:** read this CLI's own `version` (from its `package.json`, resolved at runtime) and write it into the template's single `quintus2` dependency (**D1/D3** — templates depend on `quintus2`, not `@quintus/*`). Because `create-quintus2` and `quintus2` are released in lockstep, the CLI's own version *is* the matching engine version. Inject as an **exact pin** (no caret) per **§D6**. Also set the project `name` from `--name`/dir.
  - Detect the invoking package manager from `npm_config_user_agent`; run `<pm> install` unless `--no-install`; `git init` + initial commit unless `--no-git`.
  - Print next steps (`cd`, `dev`, `qdbg`, "open in Claude Code and read CLAUDE.md").
- [x] Land the `create-quintus2` `package.json` (this phase) at `version: 0.0.0` with no `private` flag, so `pnpm release` picks it up as the second publishable, lockstep-versioned package. It's covered by `pnpm-workspace.yaml`'s existing `packages/*` glob. (Unscoped → no `publishConfig.access` needed.)

### Copy/transform module (the testable core)

```
src/
  index.ts        # `#!/usr/bin/env node` shebang (line 1) + arg parse + prompts + orchestration
  scaffold.ts     # pure: (opts) => writes files to targetDir  ← unit-tested
  package-json.ts # pure: rewrite name + inject engine version  ← unit-tested
  pm.ts           # detect & run package manager
templates/
  2d/  …          # Phase 4
  3d/  …          # Phase 5
```

### Files touched
`packages/create-quintus2/**` (new), `biome.json` (exclude `packages/create-quintus2/templates` from monorepo lint — templates are consumer projects with their own toolchain, not engine source), `pnpm-lock.yaml` (prompts/picocolors/@types/prompts).

**Implementation notes (Phase 3):**
- **Placeholder templates.** `templates/{2d,3d}/` began as minimal placeholders (a `package.json` with the sentinel `"quintus2": "0.0.0"` dep, a `_gitignore`, and one `src/main.ts`). **`templates/2d/` (Phase 4) and `templates/3d/` (Phase 5) are now real starters.**
- **Non-interactive template default.** When `--template` is omitted and the run is non-interactive (`CI`/no TTY), the CLI defaults to `2d` rather than erroring, so scripted/CI use needs only a target dir.
- **`readOwnVersion()`** reads `create-quintus2`'s own `package.json` at runtime (`../package.json` relative to `dist/index.js`) and injects it as the exact engine pin (D6). At `0.0.0` the E2E scaffold pins `"quintus2": "0.0.0"`; the exact-pin transform itself is asserted at `0.0.3` in the unit test.
- **Extra ergonomics** beyond the doc's flag list: `--force` (spec'd in the CLI-behavior bullet), `--help`/`-h`, and a dedicated `src/pm.ts` for PM detection + `git init`. Bin `chmod 0o755` logic is present (`markBinExecutable`) but a no-op until Phase 6 ships `bin/qdbg`.

### Tests / Success Criteria
- `packages/create-quintus2/src/package-json.test.ts`: given a template `package.json` with sentinel `"quintus2": "0.0.0"` and CLI version `0.0.3`, the rewrite yields the exact pin `"quintus2": "0.0.3"` (no caret, per D6) and sets the project `name`.
- `packages/create-quintus2/src/scaffold.test.ts`: scaffolds `2d` into a temp dir; asserts expected files exist, `_gitignore`→`.gitignore` renamed, and the only engine dep is a pinned `quintus2` (no `@quintus/*`, no `workspace:*`).
- `node dist/index.js tmp --template 2d --no-install --no-git` exits 0 and produces a tree with a valid `package.json` (parses, single `quintus2` engine dep).

---

## Phase 4: 2D Starter Template

A minimal but real JSX platformer-style starter (model: `examples/platformer-tsx/`, trimmed to one player, one scene, a HUD, a coin).

### Template tree (`packages/create-quintus2/templates/2d/`)

```
_gitignore  _npmrc  index.html  package.json  tsconfig.json  vite.config.ts
README.md   CLAUDE.md            .qdbg.json          # (Phase 6 adds CLAUDE.md + .qdbg.json + .claude/)
vitest.config.ts
src/
  main.ts            # Game + PhysicsPlugin + InputPlugin + JSX, registerScenes, assets.load
  config.ts          # COLLISION_GROUPS, INPUT_BINDINGS
  state.ts           # reactiveState({ score, lives })
  sprites.ts         # SpriteSheet defs
  entities/player.tsx
  entities/coin.tsx
  scenes/level1.tsx
  hud/hud.tsx
  __tests__/player.test.ts   # headless smoke test
assets/
  tiles.png  player.png  coin.ogg   # small, real, attributed
```

- [x] `package.json` deps: a **single** `"quintus2"` engine dep (sentinel `"0.0.0"`, injected by the CLI); devDeps: `vite`, `typescript`, `vitest`, `jsdom`, `@types/node`. Scripts: `dev`, `build`, `preview`, `test` (`qdbg` deferred to Phase 6). All engine imports (`Game`, `Actor`, `AudioPlugin`, headless/test helpers via `quintus2/testing`) come from that one package.
- [x] `tsconfig.json` — **inline** the `tsconfig.base.json` options (can't `extends` a monorepo path) plus `"jsx": "react-jsx"`, `"jsxImportSource": "quintus2"` (resolves `quintus2/jsx-runtime`), `"noEmit": true`.
- [x] `vite.config.ts` — single-page, `server: { port: 3050, host: true }`, no MPA discovery, no source aliases (`quintus2` resolves from `node_modules`). The `serve-tiled-tsx` plugin is omitted (the starter uses a code-defined `SpriteSheet`, no Tiled `.tsx` tileset).
- [x] `index.html` — `<canvas id="game" width="320" height="240">` + `<script type="module" src="/src/main.ts">` + pixelated CSS.
- [x] `main.ts` — `import { AudioPlugin, Game, InputPlugin, PhysicsPlugin, Vec2 } from "quintus2"`; construct **`new Game({ width:320, height:240, canvas:"game", scale:"fit", pixelArt:true, seed:42 })`** (the engine exposes a `Game` class constructed with `new`, not a `Game()` factory), `game.use(PhysicsPlugin(...))`, `game.use(InputPlugin(...))`, `game.use(AudioPlugin())`, `game.registerScenes({ level1: Level1 })`, `game.assets.load({ images:["assets/tiles.png","assets/player.png"], audio:["assets/coin.ogg"] }).then(() => game.start("level1"))`. (`AudioPlugin` is needed to *play* `coin.ogg` — `assets.load` only fetches it.)
- [x] Assets referenced by **relative path** (`assets/tiles.png` etc.), matching the engine's runtime `fetch()` loader.

### Files touched
`packages/create-quintus2/templates/2d/**` (new).

### Deviations (Phase 4)
- **`new Game(...)`, not `Game(...)`** — the engine's `Game` is a class; the design's factory-call shorthand was normalized to `new Game(...)` to match `@quintus/core`.
- **Assets live under `public/assets/`, not project-root `assets/`.** Vite only copies `public/` (and module-graph imports) into `dist/`; a root-level `assets/` serves in `dev` but is **absent from `vite build` output**, producing a broken production bundle. `public/assets/` is Vite's zero-config convention and keeps the runtime paths unchanged (`assets/tiles.png` resolves in both `dev` and `build`). No custom asset-copy Vite plugin needed (unlike the monorepo `examples/`).
- **Entity `onReady()` overrides call `super.onReady()`** — required: `Actor.onReady()` initializes gravity from the world and `CollisionObject.onReady()` registers the body for collision. (A first cut that omitted `super.onReady()` produced a player that never fell — caught by the smoke test during validation.)
- Assets are the CC0 Kenney Pico-8 tileset + a Sci-Fi sound; `tiles.png`/`player.png` are the same tileset image under two texture names (attributed in `public/assets/ATTRIBUTION.md`).

### Tests / Success Criteria
- [x] `vite build` succeeds and emits `dist/` (incl. `dist/assets/*` copied from `public/assets/`) — verified locally by scaffolding via the CLI, linking a `file:` tarball of the locally-built `quintus2`, `npm install`, and `npx vite build`. (Full published-tarball E2E remains Phase 7.)
- [x] The bundled `__tests__/player.test.ts` (importing `TestRunner` from `quintus2/testing`) **passes** in the scaffolded project: the player falls under gravity and `isOnFloor()` is true within 60 frames.
- [x] Every engine symbol imported by the template resolves in `quintus2`'s exports. **FIXED (was a carried-forward Phase 1 defect):** previously `dts: true` emitted `export * from "@quintus/audio"` etc. in the consumer `.d.ts`, which didn't resolve for consumers (the private packages aren't installed) — a scaffolded project's `npx tsc --noEmit` reported **58 errors**. The naive `dts: { resolve: [...] }` fix duplicated shared `@quintus/core` types (`Game`, `Plugin`) per inlined package (spurious identity errors) and `experimentalDts` failed the build. **Resolution:** `quintus2` now builds declarations via a dedicated `dts-bundle-generator` pass (`packages/quintus2/scripts/build-dts.mjs`, wired into `build` as `tsup && node scripts/build-dts.mjs`; `tsup` sets `dts: false`). `index.d.ts` is one self-contained bundle (source of truth, no `@quintus/*`, no `three`); every other entry (`testing`, `three`, jsx runtimes) imports the shared engine types from `./index.js` (matching on the base name to undo dts-bundle-generator's `$n` aliasing), so `Game`/`Node`/`Plugin`/`Vec2`/the `JSX` element type are a SINGLE declaration across entries. `three` stays an external `import * as THREE from "three"` and its `game.three` augmentation is re-pointed at the shared `./index.js` `Game`. Both `.d.ts` and `.d.cts` are emitted. **Verified externally:** packed tarball → scaffold outside the workspace → `npm install` (no `@quintus/*` present) → `npx tsc --noEmit` = **0 errors** (was 58); cross-entry `game.use(PhysicsPlugin())` + mixed `quintus2`/`quintus2/testing` typecheck cleanly; `game.use(ThreePlugin())`/`game.three` typecheck with `@types/three` installed; `npx vitest run` + `npx vite build` still pass.

---

## Phase 5: 3D Starter Template

Minimal Three.js starter (model: `examples/3d-cube/`): a spinning mesh, a camera, and lights.

### Template tree (`packages/create-quintus2/templates/3d/`)

```
_gitignore  _npmrc  index.html  package.json  tsconfig.json  vite.config.ts
README.md   CLAUDE.md  .qdbg.json  vitest.config.ts
src/
  main.ts               # tiny boot entry: new Game({ renderer:null, scale:"fit" }) + ThreePlugin
  scenes/main-scene.ts  # MainScene: Camera3D, lights, a MeshNode (imported by main.ts AND the test)
  entities/spinner.ts
  __tests__/scene.test.ts
```

- [x] `package.json` deps: `"quintus2"` (injected version) and `"three": "^0.172.0"` (the real dep that satisfies quintus2's optional `three` peer, **D3a**); devDeps add `@types/three`. Same script set as 2D. **Done** — the existing placeholder `package.json` already had the correct shape (`quintus2` sentinel `0.0.0` + `three ^0.172.0`, `@types/three` in devDeps); kept as-is.
- [x] `index.html` — **no `<canvas>`** (ThreePlugin creates the WebGL canvas); just the module script + full-viewport CSS. **Done** (mirrors `examples/3d-cube/index.html`; `Game` auto-creates + appends a canvas when no `canvas` option is given).
- [x] `main.ts` — `import { Game } from "quintus2"` and `import { ThreePlugin } from "quintus2/three"`; `new Game({ width: 800, height: 600, renderer: null, scale: "fit", seed: 42 })`, `game.use(ThreePlugin({ antialias: true, background: "#101018" }))`, `game.start(MainScene)`. **Done.** `background` accepts a hex string (`ThreePluginConfig.background: THREE.ColorRepresentation | null`), so `"#101018"` is valid (the reference used the numeric `0x1a1a2e` — both work). `game.start` takes the Scene class directly. **`scale: "fit"`** (added in the review fix pass) matches the 2D template and the `examples/3d-cube` reference — without it `Game` defaults to `"fixed"`, leaving a non-responsive 800×600 canvas. `MainScene` (the `Camera3D`, `AmbientLight` + `DirectionalLight`, and the `Spinner` `MeshNode` that rotates in `onFixedUpdate`) lives in `src/scenes/main-scene.ts`; `entities/spinner.ts` holds the `MeshNode` subclass.
- [x] Plain `.ts` (no JSX) by default; `tsconfig.json` omits the JSX options. **Done** — inlined base options, no `jsx`/`jsxImportSource`. `@types/three` resolves via normal module resolution for `import * as THREE from "three"` (no `types`-array entry needed).
- [x] `.qdbg.json` present so `qdbg` works against the 3D scene too (debug bridge is renderer-agnostic). **Done in Phase 6** (marked "(Phase 6 adds …)" in the template tree above), matching the 2D template which also ships `.qdbg.json`/`CLAUDE.md`/`README.md` in Phase 6.

### Files touched
`packages/create-quintus2/templates/3d/**` (new): `_gitignore`, `_npmrc`, `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `src/main.ts`, `src/scenes/main-scene.ts`, `src/entities/spinner.ts`, `src/__tests__/scene.test.ts`.

### Deviations (Phase 5)
- **Spinner rotates in `onFixedUpdate`, not `onUpdate`** — the design specifies `onFixedUpdate` (deterministic, fixed-timestep); the `examples/3d-cube` reference used `onUpdate`. `game.step()` calls both, so either works headless; matched the design.
- **`MainScene` lives in its own module `src/scenes/main-scene.ts`; `main.ts` is a tiny boot entry that imports it and boots unconditionally** — reconciled to the 2D template's pattern (`scenes/level1.tsx` + a boot-only `main.ts`) during the review fix pass. The headless `scene.test.ts` imports `MainScene` from `../scenes/main-scene.js` (a side-effect-free module), so importing it never boots `ThreePlugin`, whose `THREE.WebGLRenderer` needs a real WebGL context jsdom lacks. **This removed the earlier `if (import.meta.env.MODE !== "test")` bootstrap guard and its `/// <reference types="vite/client" />`** (originally added because `MainScene` was inlined into `main.ts` — flagged by code-review F2 / retro F3 as a smell that taught consumers to branch their boot on the test env). Under `vite dev`/`build`, `main.ts` boots the game normally.
- **The scene test omits `ThreePlugin`** (WebGL constraint above). It runs `MainScene` via `TestRunner.run` (from `quintus2/testing`) with no plugins — `Camera3D` degrades gracefully when no Three.js context is installed, and `MeshNode`/lights build their `THREE` objects without a GL context. It asserts the observable-headless surface: the scene tree contains the `Spinner` (a `MeshNode`), a `Camera3D`, and both lights (via `.not.toBeNull()` — **not** `.toBeDefined()`, which `findByType`'s `null` return would falsely pass; fixed per code-review F1 and verified load-bearing by removing a light and confirming the test fails), and `spinner.rotation.y` advances (> 0) after stepping 60 frames.

### Known cosmetic issue (deferred, not a Phase 5 defect)
- **`@quintus/*: workspace:*` appears in the published `quintus2` tarball's `devDependencies`.** These are genuine build-time links (`quintus2` bundles the packages via `noExternal`); npm never installs a dependency's devDependencies, so a consumer scaffold installs **0** `@quintus/*` and its own runtime tree is clean (confirmed by the Phase 5 runtime review). The raw unresolvable `workspace:*` specifiers only surface via `npm pack` (used by the local-tarball validation dance), which does not understand the workspace protocol; the **real** publish path (`scripts/release.mjs` → `pnpm -r publish`) rewrites `workspace:*` to the concrete target version, so the actually-published manifest is correct. **Decision: not worth stripping in `release.mjs`** — a pre-publish strip/restore of private devDeps (mirroring the LICENSE fan-out) adds mutation risk to the release flow for a purely cosmetic artifact that never reaches the real published package. Revisit only if the `npm pack` tidiness becomes a real consumer concern.

### Tests / Success Criteria
- [x] Phase 7 E2E builds the 3D template with `three` installed; `dist/` produced. **Validated ahead of Phase 7 via the local-tarball dance:** packed `quintus2`, scaffolded `3d` via the CLI outside the workspace, pointed `quintus2` at the tarball (kept `three` from npm), `npm install` (0 vulns, **no peer warning**), then `npx vite build` → `dist/` emitted (632 KB bundle incl. `three`, as expected).
- [x] Bundled `__tests__/scene.test.ts` asserts the 3D scene tree contains the mesh, a `Camera3D`, and both lights after `game.start`, and that the mesh's rotation advances after stepping frames (headless). **Done — passes in the scaffolded project** (`npx vitest run` → 1 passed). See the WebGL/ThreePlugin constraint in Deviations.
- [x] **Consumer typecheck (first real test of `quintus2/three`'s fixed `.d.ts`):** in the scaffolded 3D project, `npx tsc --noEmit` = **0 errors** — `quintus2/three`'s consumer types resolve with `three` external (from the consumer's `@types/three`).

---

## Phase 6: Bundled Tooling — debug-game Skill, Standalone qdbg, CLAUDE.md

Make every scaffold immediately debuggable and LLM-buildable. Applies to **both** templates.

- [x] **Ship the skill.** Copy `.claude/skills/debug-game/{SKILL.md,references/**}` into each template's `.claude/skills/debug-game/`. The template's copy of `qdbg` is a **real file** (not the monorepo symlink): place the `bin/qdbg` script at the template's `bin/qdbg` and point the skill's `qdbg` reference at it (relative), or reference the project `pnpm qdbg` script. **Done** — SKILL.md + `references/**` copied verbatim into both templates (kept in sync with the monorepo skill); `bin/qdbg` is a real 0755 file in each template. The skill's `SKILL.md` uses `pnpm qdbg`/the project's `qdbg` script (which templates wire in `package.json`), so no in-skill `qdbg` symlink is shipped (the CLI's `copyDir` skips symlinks anyway).
- [x] **`bin/qdbg` `.qdbg.json` support (D5).** In `cmd_connect`, gate on `[ $# -eq 0 ]` **before** the existing `local demo="${1:-platformer}"` default (an absent arg is otherwise indistinguishable from an explicit `platformer`): if no arg **and** `./.qdbg.json` exists, connect to its `url` (+ `?debug`). `bin/qdbg` is pure bash with no `jq`, so parse the JSON with **`node -e`** (Node is guaranteed in any Quintus project), e.g. `url=$(node -e 'console.log(require("./.qdbg.json").url)')`. Absent file → today's `/${demo}/` behavior (zero regression for the monorepo). Ship the same script in templates. **Done** — extracted a side-effect-free `resolve_connect_url()` (+ `append_debug`/`detect_port` helpers) and a **`connect --print-url`** dry-run flag that prints the resolved URL without launching playwright/dev-server/browser (also moved `check_playwright_cli` from the dispatch into `cmd_connect` after the flag so the dry run needs no playwright). The `.qdbg.json` branch normalizes the root URL to `${url%/}/?debug` (so `http://localhost:3050` → `http://localhost:3050/?debug`, matching the success criteria). Tested by `scripts/qdbg-connect-url.test.mjs` (shells out to `bin/qdbg connect --print-url`): asserts the `.qdbg.json` case → `http://localhost:3050/?debug` and the monorepo root case → `http://localhost:<port>/platformer/?debug`.
  - Template `.qdbg.json`: `{ "url": "http://localhost:3050" }`. **Done** (both templates).
  - Template `package.json` gets `"qdbg": "./bin/qdbg"` so `npm run qdbg -- connect` / `pnpm qdbg connect` works. **Done** (both templates).
- [x] **`CLAUDE.md` per template** — a concise engine cheat-sheet so an LLM (or human) can build the game: the Node→Node2D→Actor/StaticCollider/Sensor chain, the JSX `build()` pattern (2D), the `Game`/plugin/`registerScenes`/`assets.load` bootstrap, `reactiveState` HUDs, and a **"Debugging" section** pointing at the `debug-game` skill + `pnpm qdbg connect` recipe. Distinct 2D vs 3D variants. **Done** — 2D covers the JSX `build()`/refs/coercion + PhysicsPlugin/InputPlugin/AudioPlugin bootstrap + reactive HUD; 3D covers the `renderer:null` + `ThreePlugin` bootstrap, `quintus2/three` nodes (`MeshNode`/`Camera3D`/lights), and the headless-3D testing caveat (no ThreePlugin under jsdom). Both grounded in the shipped template source.
- [x] **README.md per template** — human quick-start: install, `dev`, `test`, `qdbg`, note that `qdbg` needs Claude Code's `playwright-cli`. **Done** (both templates).

### qdbg connect resolution (after change)

```
qdbg connect              ┌─ ./.qdbg.json present? ─► url = json.url + "?debug"   (scaffold)
                          └─ else ─► probe 3050-3055, url = host/${demo:-platformer}/?debug  (monorepo)
qdbg connect <url>        ─► url + "?debug"                                        (already works)
qdbg connect <demo-name>  ─► monorepo multi-page path                             (unchanged)
```

### Files touched
`bin/qdbg` (surgical: `.qdbg.json` read in `connect`), `packages/create-quintus2/templates/{2d,3d}/{.claude/**,bin/qdbg,.qdbg.json,CLAUDE.md,README.md}` (new).

### Tests / Success Criteria
- `bin/qdbg` change has a shell-level check: in a temp dir containing `.qdbg.json` with a stub URL, `qdbg`'s URL-resolution function returns `http://localhost:3050/?debug` (extract the URL-building into a testable function or assert via a `--print-url` dry-run flag). Running `qdbg` from the monorepo root (no `.qdbg.json` in cwd) still resolves the `/${demo}/` URL — assert both.
- After scaffolding, `.claude/skills/debug-game/SKILL.md` and `bin/qdbg` (executable bit set) exist in the project; `grep -q playwright-cli bin/qdbg` confirms it's the real script.
- Manual acceptance: in a scaffolded 2D project, `npm run dev` then `pnpm qdbg connect` → `pnpm qdbg tree` prints the scene tree.

---

## Phase 7: End-to-End Scaffold + Build CI Test and Docs

Prove the whole chain works against **published-shaped** artifacts, and document it.

- [x] **E2E smoke test** `packages/create-quintus2/e2e/scaffold-build.test.ts`:
  1. `npm pack` `quintus2` into a temp `registry/` dir of tarballs. **Deviation (fidelity/speed tradeoff, per the doc's "use judgment" note):** only `quintus2` is packed+installed (the load-bearing check — real bundled engine + self-contained `.d.ts`); the scaffolder is run from the built workspace `dist/index.js` (which reads the exact same `templates/**` that would be packed) rather than from its own tarball. Verdaccio and running the CLI from its tarball are noted as higher-fidelity options.
  2. Runs `create-quintus2` non-interactively for `2d` and `3d` into `mkdtemp` dirs (`--no-install --no-git`).
  3. Rewrites the injected `quintus2` dep → local tarball path (`file:...`); 3D keeps real `three` from npm.
  4. Asserts: `npm install` succeeds; **no `node_modules/@quintus`** and **no `@quintus/`/`workspace:` strings** in the installed project; `npm run build` emits `dist/`; `npm test` (bundled headless test) passes; **`npx tsc --noEmit` is clean** (hard gate guarding the self-contained-`.d.ts` fix).
- [x] Chose **tarball-path** (fast, ~12s for both templates) over verdaccio; verdaccio noted in this doc as the higher-fidelity option.
- [x] Wired the E2E as a **separate CI workflow** (`.github/workflows/e2e.yml`), matrix `[2d, 3d]` (`QUINTUS_E2E_TEMPLATE` env per leg), path-gated on `packages/create-quintus2/**`, `packages/quintus2/**`, `packages/*/src/**`. The fast lint/test/build gate (`ci.yml`) is untouched. **Decision:** the E2E is kept OUT of the default `pnpm test` — it lives under `e2e/` (not `src/`), so the root config's src-only glob never picks it up; it runs via a dedicated `vitest.e2e.config.ts` + `pnpm test:e2e`.
- [x] **Docs:** added a `Getting Started` section to root `README.md` — `npm create quintus2@latest my-game`, the 2D/3D choice, non-interactive flags, and the `qdbg` debug loop. Clarifies the invocation forms (`npm create quintus2` / `npx create-quintus2` / `pnpm create quintus2`; not `npx create quintus2`). The `--help` drift guard is a fast unit test (`src/help.test.ts`) over a pure `src/help.ts` (the help text's single source of truth), asserting help ↔ `parseArgs` flag parity.
- [x] Updated root `CLAUDE.md`: Project Status (packaging done, two-published model), Monorepo Layout table (`quintus2` + `create-quintus2` rows; 19 private internals), and Build & Test Commands (`pnpm release`, `pnpm test:e2e`).

### Files touched
`packages/create-quintus2/e2e/scaffold-build.test.ts` (new), `packages/create-quintus2/vitest.e2e.config.ts` (new), `packages/create-quintus2/src/help.ts` + `src/help.test.ts` (new; `index.ts` uses `helpText()`), `.github/workflows/e2e.yml` (new), root `package.json` (`test:e2e` script), root `README.md` (Getting Started), root `CLAUDE.md`.

### Tests / Success Criteria
- [x] E2E is **green** for both `2d` and `3d`: scaffold → install (from the `quintus2` tarball) → build → test → `tsc --noEmit` all pass, with the only engine dep being `quintus2` (no `@quintus/*`, no `workspace:` strings) in the installed project. Verified locally (`pnpm test:e2e`: 2 passed, ~12s).
- [x] `npm create quintus2` documentation matches actual CLI flags — the `--help` drift guard (`src/help.test.ts`) passes in the default suite.

---

## Definition of Done

- [x] All phases marked **Done** in the status table.
- [x] `pnpm build` and `pnpm test` pass (2548 tests); `pnpm lint` clean (includes the new `create-quintus2` package and `scripts/*`).
- [x] `pnpm -r publish --dry-run --no-git-checks` lists exactly **two** packages — `quintus2` and `create-quintus2` — at one lockstep version. All 19 `@quintus/*` and `examples` are skipped as private. (Phase 2 covers the full `pnpm release --dry-run` gate.)
- [x] The two published tarballs (`npm pack --dry-run`) each contain a `README.md` and `dist/**`, and **no** engine `src/**` (`quintus2` src count = 0; `create-quintus2` ships only its `dist` + the `templates/**` starter sources); `quintus2`'s `dist` has the engine inlined (no `@quintus/*` imports) with `three` external in `dist/three.*`. **`LICENSE.md` appears only at real `pnpm publish`/release fan-out time, not in a bare `npm pack`** (per Phase 1/2 findings).
- [x] The Phase 7 E2E is green for both templates (scaffold → install → build → test → tsc), locally via `pnpm test:e2e` and wired as `.github/workflows/e2e.yml` (matrix `[2d, 3d]`).
- [x] A scaffolded project contains a working `.claude/skills/debug-game/`, an executable `bin/qdbg`, a `.qdbg.json`, and a `CLAUDE.md` (Phase 6); `pnpm qdbg connect` + `pnpm qdbg tree` work against a running `npm run dev`.
- [x] `.github/workflows/ci.yml` gate is green on PRs; real publish (`pnpm release`) deferred until the npm names are claimed and the maintainer is `npm login`-authenticated locally.

## Out of Scope (deliberately not built)

- Publishing any `@quintus/*` package individually — all 19 are private internals under D2; only `quintus2` + `create-quintus2` ship. (Revisit only if a genuine need for granular installs appears.)
- A `1.0.0` / SemVer-stable API guarantee — the `0.x` line makes no stability promise; graduating to `1.0.0` (and switching D6 to caret injection) is a later decision.
- Migrating existing `examples/` to standalone projects — they remain the monorepo dev harness; templates are separate minimal starters.
- Auto-starting the dev server from `qdbg` in scaffolds (user runs `npm run dev`; `connect <url>` already works). Can be added later.
- A hosted template gallery / additional templates beyond 2D and 3D (the copy engine supports more `templates/*` dirs when wanted).
