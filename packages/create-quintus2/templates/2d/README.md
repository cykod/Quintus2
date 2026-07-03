# Quintus 2 — 2D Game

A 2D platformer starter built with the [Quintus 2](https://github.com/cykod/quintus2) game engine
(`quintus2`). A player, a floor, a collectible coin, and a reactive HUD — a small but complete base
to build on.

## Quick Start

```bash
npm install        # install dependencies
npm run dev        # start the dev server → http://localhost:3050
```

Open http://localhost:3050 and use the arrow keys / WASD to move, Space/Up to jump.

## Scripts

| Command          | What it does                                             |
|------------------|----------------------------------------------------------|
| `npm run dev`    | Vite dev server on port 3050 (hot reload)                |
| `npm run build`  | Production build into `dist/`                            |
| `npm run preview`| Serve the production build locally                       |
| `npm test`       | Run the headless Vitest suite                            |
| `npm run qdbg`   | The `qdbg` game debugger CLI (see below)                 |

## Debugging with `qdbg`

`qdbg` drives the running game through the engine's debug bridge — inspect the scene tree, step
frames, simulate input, and analyze physics from the terminal.

```bash
npm run dev                    # in one terminal
npm run qdbg -- connect        # opens the game paused at frame 0 (reads .qdbg.json)
npm run qdbg -- tree           # print the scene tree
npm run qdbg -- step 30        # advance 30 frames
npm run qdbg -- physics Player # inspect the player's physics state
npm run qdbg -- disconnect
```

> **`qdbg` requires `playwright-cli`, which is bundled with [Claude Code](https://claude.com/claude-code).**
> The game itself runs, builds, and tests without it — only `qdbg` needs it.

If you use pnpm, `pnpm qdbg connect` works without the `--` separator.

## Project Structure & Engine Guide

See [`CLAUDE.md`](./CLAUDE.md) for the engine cheat-sheet (node tree, JSX `build()` pattern,
plugins, reactive HUD, testing) and [`.claude/skills/debug-game/`](./.claude/skills/debug-game/)
for the full debugging playbook. Open this project in Claude Code and it can build the game for you.

## License

MIT
