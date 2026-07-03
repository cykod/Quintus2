/**
 * The `--help` text, kept in its own pure module so it can be unit-tested for
 * drift against the actual flags `parseArgs` (args.ts) accepts. Keeping the single
 * source of truth here means the docs/CLI can't silently diverge — `help.test.ts`
 * fails if a supported flag stops being documented (or vice versa).
 */
import pc from "picocolors";

export function helpText(): string {
	return `
${pc.bold("create-quintus2")} — scaffold a Quintus2 game

${pc.bold("Usage:")}
  npm create quintus2@latest [dir] [options]

${pc.bold("Options:")}
  --template 2d|3d        Starter template
  --name <pkg>            Project package name
  --pm npm|pnpm|yarn|bun  Package manager
  --no-install            Skip installing dependencies
  --no-git                Skip git init
  --force                 Allow a non-empty target directory
  -h, --help              Show this help
`;
}
