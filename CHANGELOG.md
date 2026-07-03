# Changelog

All notable changes to **Quintus2** are recorded here. This file is the source of
truth for released versions: the release script (`pnpm release`) reads the
**topmost `## [x.y.z]` heading** to decide the version to publish, and refuses to
release unless that version is greater than the currently published one.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/). The whole engine ships in
lockstep — every published package shares the version at the top of this file.

> **HISTORY.md** holds the day-to-day development narrative (per-commit milestones).
> **CHANGELOG.md** (this file) holds the released-version notes. Add your entry
> under a new `## [x.y.z] - YYYY-MM-DD` heading, leave it uncommitted, and run
> `pnpm release`.

## [Unreleased]

_Add changes for the next release here, then promote to a versioned heading._

## [0.0.4] - 2026-07-03 — Playable 2D starter

### Added

- The scaffolded 2D starter is now a small but complete platformer: a visible
  `Block` component provides a solid floor and bordering walls plus a three-step
  platform staircase, three collectible coins, a patrolling enemy that reverses
  at walls and ledges and costs a life (with respawn + brief invulnerability) on
  contact, and a `WinScene` that triggers once every coin is collected.
- Coin counter in the starter HUD.

### Changed

- Raised the starter's render resolution to 640×480 with sprites drawn at 2×, so
  art stays chunky instead of shrinking.

### Fixed

- The examples GitHub Pages deploy no longer fails with "Deployment failed, try
  again later" — the `pages` concurrency group now uses `cancel-in-progress:
  false` so in-flight deployments are not cancelled mid-flight. CI also moved off
  the deprecated Node 20 runner to Node 24.

## [0.0.3] - 2026-07-03 — Scaffold in a container

### Added

- Ship a `.devcontainer/` in the scaffolded 2D and 3D projects — open the project
  in VS Code ("Reopen in Container") or a Codespace and dependencies install
  automatically, with the Vite dev server (port 3050) and `qdbg` ready to run.

### Changed

- Scaffolded projects now use **pnpm**: a pinned `packageManager` field plus
  pnpm-based `README` and `CLAUDE.md` docs (with an npm fallback note).

### Fixed

- `pnpm release` now prints the `git push --follow-tags` command for you to run
  instead of pushing itself — the release environment has no git credentials.

## [0.0.2] - 2026-07-02

### Added

- Initial release of Quintus2 to npm: the bundled **`quintus2`** engine (2D + core,
  with 3D under the `quintus2/three` subpath) and the **`create-quintus2`** project
  scaffolder.

## [0.0.1] - 2026-07-01

- Unreleased
