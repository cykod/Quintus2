# Quintus 2 — 3D Game

A 3D starter built with the [Quintus 2](https://github.com/cykod/quintus2) game engine (`quintus2`)
and its Three.js integration: a spinning mesh, a camera, and lights — a small but complete base to
build on.

This project uses [pnpm](https://pnpm.io). If you don't have it, `corepack enable` (bundled with
Node) activates the pinned version automatically.

## Quick Start

```bash
pnpm install       # install dependencies (incl. three)
pnpm dev           # start the dev server → http://localhost:3050
```

Open http://localhost:3050 to see the spinning cube.

> **Prefer a container?** This project ships a [`.devcontainer/`](./.devcontainer/) — open it in
> VS Code ("Reopen in Container") or a Codespace and dependencies install automatically.

## Scripts

| Command         | What it does                                             |
|-----------------|----------------------------------------------------------|
| `pnpm dev`      | Vite dev server on port 3050 (hot reload)                |
| `pnpm build`    | Production build into `dist/`                            |
| `pnpm preview`  | Serve the production build locally                       |
| `pnpm test`     | Run the headless Vitest suite                            |
| `pnpm qdbg`     | The `qdbg` game debugger CLI (see below)                 |

## Debugging with `qdbg`

`qdbg` drives the running game through the engine's debug bridge (renderer-agnostic, so it works
against the 3D scene) — inspect the scene tree, cameras, lights, and transforms from the terminal.

```bash
pnpm dev                    # in one terminal
pnpm qdbg connect           # opens the game paused at frame 0 (reads .qdbg.json)
pnpm qdbg tree              # print the scene tree
pnpm qdbg camera            # active 3D camera info
pnpm qdbg lights            # list lights
pnpm qdbg disconnect
```

> **`qdbg` requires `playwright-cli`, which is bundled with [Claude Code](https://claude.com/claude-code).**
> The game itself runs, builds, and tests without it — only `qdbg` needs it.

If you use npm instead of pnpm, forward args with `--`: `npm run qdbg -- connect`.

## Project Structure & Engine Guide

See [`CLAUDE.md`](./CLAUDE.md) for the engine cheat-sheet (node tree, `quintus2/three` nodes,
ThreePlugin bootstrap, headless testing) and [`.claude/skills/debug-game/`](./.claude/skills/debug-game/)
for the full debugging playbook. Open this project in Claude Code and it can build the game for you.

## License

MIT
