# create-quintus2

Scaffold a runnable [quintus2](https://www.npmjs.com/package/quintus2) game project in seconds — a starter with the engine wired up, a dev server, and everything you need to start building.

## Usage

```bash
npm create quintus2@latest my-game
```

Then follow the printed next steps:

```bash
cd my-game
npm run dev
```

The scaffolder asks whether you want a **2D** or **3D** starter, then copies the template, pins the matching `quintus2` engine version, installs dependencies, and initializes a git repo.

## Templates

| Template | What you get |
|----------|--------------|
| **2D** | Canvas-based game with the Node/Scene tree, physics, sprites, input, and audio |
| **3D** | Everything in 2D plus the `quintus2/three` layer and the `three` peer dependency |

## Options

Run non-interactively by passing flags (both `--flag value` and `--flag=value` work):

```bash
npm create quintus2@latest my-game --template=2d --no-install --no-git
```

| Flag | Purpose |
|------|---------|
| `--template 2d\|3d` | Starter template (skips the prompt) |
| `--name <pkg>` | Project package name (default: target dir name) |
| `--pm npm\|pnpm\|yarn\|bun` | Package manager (default: detected from the invocation) |
| `--no-install` | Skip installing dependencies |
| `--no-git` | Skip `git init` + initial commit |
| `--force` | Scaffold into a non-empty directory |
| `-h`, `--help` | Show usage |

Every generated project pins a single `quintus2` dependency to the exact engine version this scaffolder shipped with — no floating ranges, so a scaffold is reproducible.

## Docs

Full documentation: https://github.com/cykod/quintus2#readme

## License

MIT © Cykod LLC
