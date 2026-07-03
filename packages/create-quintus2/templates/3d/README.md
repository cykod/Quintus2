# Quintus 2 — 3D Game

A 3D starter built with the [Quintus 2](https://github.com/cykod/quintus2) game engine (`quintus2`)
and its Three.js integration: a spinning mesh, a camera, and lights — a small but complete base to
build on.

## Quick Start

```bash
npm install        # install dependencies (incl. three)
npm run dev        # start the dev server → http://localhost:3050
```

Open http://localhost:3050 to see the spinning cube.

## Scripts

| Command          | What it does                                             |
|------------------|----------------------------------------------------------|
| `npm run dev`    | Vite dev server on port 3050 (hot reload)                |
| `npm run build`  | Production build into `dist/`                            |
| `npm run preview`| Serve the production build locally                       |
| `npm test`       | Run the headless Vitest suite                            |
| `npm run qdbg`   | The `qdbg` game debugger CLI (see below)                 |

## Debugging with `qdbg`

`qdbg` drives the running game through the engine's debug bridge (renderer-agnostic, so it works
against the 3D scene) — inspect the scene tree, cameras, lights, and transforms from the terminal.

```bash
npm run dev                    # in one terminal
npm run qdbg -- connect        # opens the game paused at frame 0 (reads .qdbg.json)
npm run qdbg -- tree           # print the scene tree
npm run qdbg -- camera         # active 3D camera info
npm run qdbg -- lights         # list lights
npm run qdbg -- disconnect
```

> **`qdbg` requires `playwright-cli`, which is bundled with [Claude Code](https://claude.com/claude-code).**
> The game itself runs, builds, and tests without it — only `qdbg` needs it.

If you use pnpm, `pnpm qdbg connect` works without the `--` separator.

## Project Structure & Engine Guide

See [`CLAUDE.md`](./CLAUDE.md) for the engine cheat-sheet (node tree, `quintus2/three` nodes,
ThreePlugin bootstrap, headless testing) and [`.claude/skills/debug-game/`](./.claude/skills/debug-game/)
for the full debugging playbook. Open this project in Claude Code and it can build the game for you.

## License

MIT
