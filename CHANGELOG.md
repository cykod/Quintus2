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

## [0.0.1] - 2026-07-02

### Added

- Initial release of Quintus2 to npm: the bundled **`quintus2`** engine (2D + core,
  with 3D under the `quintus2/three` subpath) and the **`create-quintus2`** project
  scaffolder.
