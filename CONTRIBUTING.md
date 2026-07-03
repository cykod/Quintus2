# Contributing to Quintus2

## Development

```bash
pnpm install      # install all workspace dependencies
pnpm build        # build every package (dependency-ordered)
pnpm test         # run the full test suite
pnpm lint         # Biome check (must be clean — CI gates on it)
pnpm dev          # Vite dev server for the examples (port 3050)
```

Every push and pull request runs the `.github/workflows/ci.yml` gate:
`pnpm install --frozen-lockfile && pnpm lint && pnpm test && pnpm build`. It does
**not** publish — publishing is a manual, local step (below).

## Releasing

Releases are **lockstep**: every publishable package ships together under one
version. The single source of truth for that version is the top of
[`CHANGELOG.md`](./CHANGELOG.md). Only two packages are published — `quintus2`
and (once it exists) `create-quintus2`; all the `@quintus/*` workspace packages
are `"private": true` internals bundled into `quintus2`.

### Steps

1. **Author a CHANGELOG entry.** Add a new heading at the top of `CHANGELOG.md`:

   ```markdown
   ## [0.0.2] - 2026-07-15

   ### Added
   - …
   ```

   The version must be **greater** than the currently published version. Leave
   this change **uncommitted** — it is the only file allowed to be dirty when the
   release runs. (The `/changelog` skill can draft the entry for you.)

2. **Run the release.**

   ```bash
   pnpm release            # interactive — confirms before mutating
   pnpm release --yes      # non-interactive (skip the confirm prompt)
   pnpm release --dry-run  # run the full gate + print the plan, mutate nothing
   ```

`pnpm release` (`scripts/release.mjs`) then:

1. Reads the target version from the topmost `## [x.y.z]` heading in `CHANGELOG.md`.
2. Asserts it is greater than the current max package version (monotonicity).
3. Asserts the working tree is clean **except** for `CHANGELOG.md` (any other
   dirty path aborts the release, naming the offending file).
4. Runs the pre-release gate: `pnpm install --frozen-lockfile && pnpm lint &&
   pnpm test && pnpm build`.
5. Prompts for confirmation (unless `--yes`/`--dry-run`), then bumps every
   publishable package to the target version.
6. Commits `Release v<version>` and tags `v<version>`.
7. Copies the root `LICENSE.md` into each publishable package (so it lands in the
   npm tarball), runs `pnpm -r publish` (which rewrites `workspace:*` deps and
   skips private packages), then removes the temporary license copies.
8. Pushes the commit and tag with `git push --follow-tags`.

`--dry-run` runs the full gate and prints the exact publishable set and target
version but performs **no** version writes, git operations, publish, or license
copies — use it to preview a release safely.

> **Prerequisites for a real publish:** be `npm login`-authenticated locally with
> publish rights to `quintus2` (and `create-quintus2`). CI does not publish.
