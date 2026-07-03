/**
 * Package-manager detection + the side-effecting install / git-init steps.
 * Kept out of scaffold.ts so the copy engine stays pure and unit-testable.
 */
import { execFileSync } from "node:child_process";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/** The allowlist of supported package managers — the single source of truth. */
export const KNOWN: readonly PackageManager[] = ["npm", "pnpm", "yarn", "bun"];

/**
 * Detect the package manager that invoked the CLI from `npm_config_user_agent`
 * (e.g. `"pnpm/10.28.1 npm/? node/..."`). Falls back to `npm`.
 */
export function detectPackageManager(
	userAgent = process.env.npm_config_user_agent,
): PackageManager {
	if (!userAgent) return "npm";
	const name = userAgent.split(" ")[0]?.split("/")[0];
	return KNOWN.find((pm) => pm === name) ?? "npm";
}

/**
 * Run `<pm> install` in `cwd`, inheriting stdio. Uses `execFileSync` (no shell)
 * so the package-manager token can never be interpreted by `/bin/sh`.
 */
export function runInstall(pm: PackageManager, cwd: string): void {
	execFileSync(pm, ["install"], { cwd, stdio: "inherit" });
}

/** `git init` + stage everything + an initial commit in `cwd`. */
export function gitInit(cwd: string): void {
	execFileSync("git", ["init", "-q"], { cwd, stdio: "inherit" });
	execFileSync("git", ["add", "-A"], { cwd, stdio: "inherit" });
	execFileSync("git", ["commit", "-q", "-m", "Initial commit from create-quintus2"], {
		cwd,
		stdio: "inherit",
	});
}
